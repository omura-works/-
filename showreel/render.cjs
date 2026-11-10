// レンダラ: ヘッドレス Chromium で 1 フレームずつ描画し、ffmpeg に流し込む
//   node render.cjs                 全編を out/ に書き出す
//   node render.cjs still <scene> <frame> <out.png>   確認用の静止画
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const { once } = require('events');
const fs = require('fs'), path = require('path');

const ROOT = __dirname, OUT = path.join(ROOT, 'out');
const JOBS = +(process.env.JOBS || 4), FPS = 30, SR = 48000, SECONDS = 60;
const srcFiles = ['src/lib.js', ...fs.readdirSync(path.join(ROOT, 'src/scenes')).sort().map(f => 'src/scenes/' + f), 'render.cjs', 'audio.py'];
const src = srcFiles.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const CFG = {
  title: process.env.TITLE || 'SHOWREEL', credit: process.env.CREDIT || '',
  aa: +(process.env.AA || 2), src,
  stats: { lines: src.split('\n').length, samples: SR * SECONDS * 2 },
};

async function open() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  await page.addInitScript(c => { window.__CFG = c; }, CFG);
  await page.goto('file://' + path.join(ROOT, 'src/index.html'));
  return { browser, page };
}

async function runJob(job) {
  const { browser, page } = await open();
  await page.evaluate(s => window.initScene(s), job.scene);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', FPS, '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '17', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-g', '60', job.file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = job.from; i < job.to; i++) {
    await page.evaluate(([s, i]) => window.renderFrame(s, i), [job.scene, i]);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await once(ff.stdin, 'drain');
  }
  ff.stdin.end(); await once(ff, 'close'); await browser.close();
  console.log(`${job.name} ${job.from}-${job.to}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page } = await open();
  const scenes = await page.evaluate(() => window.sceneList());
  if (process.argv[2] === 'still') {
    const [, , , name, frame, file] = process.argv, s = scenes.findIndex(x => x.name === name);
    await page.evaluate(s => window.initScene(s), s);
    const t0 = Date.now();
    for (let i = scenes[s].split > 1 ? +frame : 0; i <= +frame; i++) await page.evaluate(([s, i]) => window.renderFrame(s, i), [s, i]);
    await page.screenshot({ path: file, type: 'png' }); await browser.close();
    return console.log(`${name}#${frame} ${Date.now() - t0}ms`);
  }
  await browser.close();
  const jobs = [];
  scenes.forEach((sc, s) => {
    for (let k = 0; k < sc.split; k++) jobs.push({ scene: s, name: sc.name, from: Math.round(sc.frames * k / sc.split), to: Math.round(sc.frames * (k + 1) / sc.split), file: path.join(OUT, `seg_${s}_${k}.mp4`) });
  });
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;   // 一部の章だけ描き直す
  const queue = jobs.filter(j => !only || only.includes(j.name)).sort((a, b) => (b.name === 'bulb') - (a.name === 'bulb'));   // 重いものから
  await Promise.all(Array.from({ length: JOBS }, async () => { while (queue.length) await runJob(queue.shift()); }));
  fs.writeFileSync(path.join(OUT, 'list.txt'), jobs.map(j => `file '${j.file}'`).join('\n'));
  const final = path.join(OUT, process.env.NAME || 'showreel.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'list.txt'), '-i', path.join(OUT, 'audio.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
  console.log('→', final);
})().catch(e => { console.error(e); process.exit(1); });
