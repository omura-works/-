// 04 ストレンジアトラクタ: 2 行の漸化式を毎フレーム数百万回反復し、点の密度を描く
SCENES.push((() => {
  const DUR = 9.6, NP = CFG.attrN || 3200000; let dens, hue, img, LUT;
  return {
    name: 'attractor', frames: 288, split: 4,
    init(ctx) {
      dens = new Float32Array(W * H); hue = new Float32Array(W * H); img = ctx.createImageData(W, H);
      LUT = new Uint8Array(1024 * 3);
      for (let k = 0; k < 1024; k++) { const c = pal(k / 1023, [.55, .5, .5], [.45, .42, .5], [.9, .8, .7], [.0, .17, .43]); LUT.set(c.map(v => v * 255), k * 3); }
    },
    frame(ctx, i, t) {
      // カオス領域に留まり続ける軌道を事前探索して選んだ係数
      const a = 1.5 + 0.129 * Math.sin(t * 0.257 + 0.29), b = -1.8 + 0.086 * Math.sin(t * 0.485 + 5.91), c = 1.6 + 0.233 * Math.sin(t * 0.316 + 2.15), d = 0.9 + 0.14 * Math.sin(t * 0.29 + 5.6);
      dens.fill(0); hue.fill(0);
      const S = 226, cx = W / 2 - 70, cy = H / 2 - 6, rot = 0.05 * Math.sin(t * 0.4), cr = Math.cos(rot), sr = Math.sin(rot);
      let x = 0.1, y = 0.1;
      for (let n = 0; n < NP; n++) {
        const nx = Math.sin(a * y) + c * Math.cos(a * x), ny = Math.sin(b * x) + d * Math.cos(b * y);
        const sp = (nx - x) * (nx - x) + (ny - y) * (ny - y); x = nx; y = ny;
        const px = cx + (x * cr - y * sr) * S * 1.3 | 0, py = cy + (x * sr + y * cr) * S | 0;
        if (px >= 0 && px < W && py >= 0 && py < H) { const o = py * W + px; dens[o]++; hue[o] += sp; }
      }
      const D = img.data, k = 1 / Math.log(1 + NP / 50000);
      for (let o = 0, p = 0; o < W * H; o++, p += 4) {
        const n = dens[o];
        if (n === 0) { D[p] = 7; D[p + 1] = 8; D[p + 2] = 12; D[p + 3] = 255; continue; }
        const v = Math.min(1, Math.log(1 + n) * k), l = Math.min(1.25, Math.pow(v, 1.15) * 1.5), h = Math.min(1023, (hue[o] / n * 0.115 + 0.08 + v * 0.25) * 1023 | 0) * 3;
        D[p] = Math.min(255, 7 + LUT[h] * l); D[p + 1] = Math.min(255, 8 + LUT[h + 1] * l); D[p + 2] = Math.min(255, 12 + LUT[h + 2] * l); D[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      chapter(ctx, t, DUR, '04', 'STRANGE ATTRACTOR', '2 行の数式から', `毎フレーム ${(NP / 1e4).toLocaleString()} 万回の反復。点の密度だけで形が現れる`);
      ctx.save(); ctx.globalAlpha = win(t, 0.8, DUR - .4) * 0.7; ctx.fillStyle = '#07080c'; ctx.fillRect(W - 590, 60, 530, 164); ctx.restore();
      text(ctx, 'x′ = sin(a·y) + c·cos(a·x)', W - 96, 110, { size: 30, font: MONO, align: 'right', alpha: win(t, 1, DUR - .4) * .85, shadow: 14 });
      text(ctx, 'y′ = sin(b·x) + d·cos(b·y)', W - 96, 154, { size: 30, font: MONO, align: 'right', alpha: win(t, 1.2, DUR - .4) * .85, shadow: 14 });
      text(ctx, `a=${a.toFixed(3)}  b=${b.toFixed(3)}  c=${c.toFixed(3)}  d=${d.toFixed(3)}`, W - 96, 198, { size: 22, font: MONO, align: 'right', color: COL.acc, alpha: win(t, 1.4, DUR - .4), shadow: 14 });
      edgeFade(ctx, t, DUR);
    }
  };
})());
