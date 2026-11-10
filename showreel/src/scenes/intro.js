// 00 イントロ: 粒子が流れ、タイトルの形に収束する
SCENES.push((() => {
  const N = 18000, DUR = 7.2; let P, size;
  return {
    name: 'intro', frames: 216, split: 2,
    init(ctx) {
      size = titleSize(ctx);
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      drawTitle(x, H / 2 + size * 0.30, 1, size);
      const d = x.getImageData(0, 0, W, H).data, pts = [];
      for (let yy = 0; yy < H; yy += 2) for (let xx = 0; xx < W; xx += 2) if (d[(yy * W + xx) * 4 + 3] > 128) pts.push(xx, yy);
      const r = rng(11); P = new Float32Array(N * 7);
      for (let i = 0; i < N; i++) {
        const k = (r() * pts.length / 2 | 0) * 2;
        // 収束の遅延は左→右へ掃くように (文字が書かれていく印象)
        P.set([pts[k] + r() * 2, pts[k + 1] + r() * 2, r() * W, r() * H, (pts[k] - 380) / 1160 * 0.75 + r() * 0.25, r() * 6.283, r()], i * 7);
      }
    },
    frame(ctx, i, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cols = ['#ff8a4c', '#6fb7ff', '#f2efe8'];
      for (let b = 0; b < 3; b++) {
        ctx.fillStyle = cols[b];
        for (let j = b; j < N; j += 3) {
          const o = j * 7, tx = P[o], ty = P[o + 1], dl = P[o + 4], ph = P[o + 5], z = P[o + 6];
          // 収束前: ゆるい流れ場を漂う
          const fx = P[o + 2] + 150 * Math.sin(t * 0.35 + ph) + 60 * Math.sin(t * 0.9 + ph * 3) + t * 30 * (z - .5);
          const fy = P[o + 3] + 110 * Math.cos(t * 0.3 + ph * 1.7) + 50 * Math.sin(t * 0.7 + ph * 2);
          const k = easeInOut((t - 3.9 - dl * 1.3) / 1.0);
          const sw = (1 - k) * k * 420;            // 収束途中で渦を巻く
          const x = lerp(fx, tx, k) + Math.cos(ph + t * 3) * sw, y = lerp(fy, ty, k) + Math.sin(ph + t * 3) * sw;
          const s = lerp(1.5 + z * z * 4.5, 1.7, k);
          ctx.globalAlpha = lerp(0.3 + z * 0.55, 0.6, k) * (0.75 + 0.25 * Math.sin(t * 5 + ph * 9));
          ctx.fillRect(x, y, s, s);
        }
      }
      ctx.restore();
      const l1 = win(t, 0.5, 2.5, 0.5), l2 = win(t, 2.4, 4.4, 0.5);
      text(ctx, 'この映像に、撮影された素材は 1 フレームもない。', W / 2, H / 2 + 20 - 12 * (1 - l1), { size: 62, weight: 700, align: 'center', alpha: l1, shadow: 30 });
      text(ctx, 'すべてのピクセルと音は、コードから計算されている。', W / 2, H / 2 + 20 - 12 * (1 - l2), { size: 62, weight: 700, align: 'center', alpha: l2, shadow: 30 });
      const ta = sstep(5.6, 6.3, t);
      drawTitle(ctx, H / 2 + size * 0.30, ta * 0.92, size);
      text(ctx, 'CODE-GENERATED SHOWREEL  ·  1920×1080  ·  60 SEC', W / 2, H / 2 + size * 0.30 + 96, { size: 26, weight: 500, font: MONO, color: COL.acc, align: 'center', alpha: sstep(6.0, 6.6, t), spacing: 6 });
      edgeFade(ctx, t, DUR, 0.8, 0.5);
    }
  };
})());
