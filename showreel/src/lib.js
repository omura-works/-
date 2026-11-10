// 共通ライブラリ: 乱数・イージング・WebGLヘルパ・字幕
'use strict';
const W = 1920, H = 1080, FPS = 30;
const SCENES = [];
const CFG = Object.assign({ title: 'SHOWREEL', stats: {}, src: '' }, window.__CFG || {});
const COL = { bg: '#07080c', ink: '#f2efe8', dim: 'rgba(242,239,232,0.62)', acc: '#ff8a4c', sky: '#6fb7ff' };
const JP = '"NSJ","Inter",sans-serif', EN = '"Inter","NSJ",sans-serif', MONO = '"JetBrains Mono",monospace';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
// 区間 [a,b] で 1、前後 d 秒でフェード
const win = (t, a, b, d = 0.5) => sstep(a, a + d, t) * (1 - sstep(b - d, b, t));
function rng(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 余弦パレット (a + b*cos(2π(c t + d)))
function pal(t, a, b, c, d) { return [0, 1, 2].map(i => clamp(a[i] + b[i] * Math.cos(6.28318 * (c[i] * t + d[i])))); }

function makeGL(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false });
  if (!gl) throw new Error('WebGL2 が使えません');
  const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  function program(fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + fs));
    gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const loc = {};
    return {
      use(u = {}) {
        gl.useProgram(pr); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        for (const k in u) {
          const l = loc[k] ??= gl.getUniformLocation(pr, k), v = u[k];
          if (typeof v === 'number') gl.uniform1f(l, v);
          else if (v.tex !== undefined) gl.uniform1i(l, v.tex);
          else if (v.length === 2) gl.uniform2fv(l, v); else if (v.length === 3) gl.uniform3fv(l, v); else gl.uniform4fv(l, v);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  }
  return { cv, gl, program };
}

// ---- 画面共通パーツ ----
function fade(ctx, a) { if (a > 0) { ctx.save(); ctx.globalAlpha = clamp(a); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
// シーン端の暗転 (t: 秒, dur: シーン長)
function edgeFade(ctx, t, dur, din = 0.5, dout = 0.5) { fade(ctx, 1 - sstep(0, din, t) + sstep(dur - dout, dur, t)); }

function text(ctx, s, x, y, { size = 40, weight = 400, font = JP, color = COL.ink, align = 'left', alpha = 1, spacing = 0, shadow = 0 } = {}) {
  ctx.save(); ctx.globalAlpha = clamp(alpha); ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = spacing + 'px';
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = shadow; }
  ctx.fillText(s, x, y); ctx.restore();
}

// 章ラベル (左下) : 番号 / 英題 / 和文説明
function chapter(ctx, t, dur, no, en, jp, note) {
  const a = win(t, 0.5, dur - 0.4, 0.6), dx = (1 - easeOut((t - 0.5) / 0.9)) * -40;
  ctx.save();
  const g = ctx.createLinearGradient(0, H - 330, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.78)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, H - 330, W, 330); ctx.restore();
  const x = 96 + dx;
  text(ctx, no, x, H - 178, { size: 26, weight: 700, font: MONO, color: COL.acc, alpha: a, spacing: 4 });
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.acc; ctx.fillRect(x + 60, H - 188, 64 * easeOut((t - 0.7) / 0.8), 3); ctx.restore();
  text(ctx, en, x + 144, H - 178, { size: 26, weight: 600, font: EN, color: COL.dim, alpha: a, spacing: 6 });
  text(ctx, jp, x, H - 112, { size: 58, weight: 900, alpha: a, shadow: 24 });
  text(ctx, note, x, H - 62, { size: 28, weight: 400, color: COL.dim, alpha: a * sstep(1.2, 2.0, t), shadow: 16 });
}

// タイトルロゴ (イントロとアウトロで共用)。幅に収まる文字サイズを返す
function titleSize(ctx, max = 1500, base = 260) {
  ctx.save(); ctx.font = `900 ${base}px ${EN}`; ctx.letterSpacing = '-6px'; const w = ctx.measureText(CFG.title).width; ctx.restore();
  return Math.min(base, base * max / w);
}
function drawTitle(ctx, y, alpha, size) {
  text(ctx, CFG.title, W / 2, y, { size, weight: 900, font: EN, align: 'center', alpha, spacing: -6 });
}

// ---- レンダラから呼ばれる入口 ----
let _ctx;
window.initScene = async s => {
  await Promise.all(['400', '700', '900'].map(w => document.fonts.load(`${w} 20px "NSJ"`, 'あ漢')));
  await document.fonts.ready;
  _ctx = document.getElementById('out').getContext('2d', { willReadFrequently: false });
  const sc = SCENES[s]; if (sc.init) sc.init(_ctx);
};
window.renderFrame = (s, i) => {
  const c = _ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = COL.bg; c.fillRect(0, 0, W, H);
  SCENES[s].frame(c, i, i / FPS);
};
window.sceneList = () => SCENES.map(s => ({ name: s.name, frames: s.frames, split: s.split || 1 }));
