// 05 エンディング: この動画自身のソースコードを背景に、制作の実数値を示す
SCENES.push((() => {
  const DUR = 14.4; let lines, size;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  return {
    name: 'outro', frames: 432, split: 3,
    init(ctx) { lines = (CFG.src || '// source').split('\n').filter(l => l.trim()); size = titleSize(ctx); },
    frame(ctx, i, t) {
      // 背景: ソースコードが 4 列で流れる
      const ba = 0.20 * sstep(0, 1, t) * (1 - 0.45 * sstep(8.2, 9.4, t));
      ctx.save(); ctx.font = `400 17px ${MONO}`; ctx.fillStyle = COL.sky; ctx.globalAlpha = ba;
      for (let c = 0; c < 4; c++) {
        const sp = 46 + c * 17, off = t * sp + c * 1300, x = 60 + c * 470;
        ctx.save(); ctx.beginPath(); ctx.rect(x, 0, 440, H); ctx.clip();
        for (let r = -1; r < 50; r++) {
          const li = Math.floor(off / 23) + r + c * 211, y = r * 23 - (off % 23) + 23;
          ctx.fillText(lines[((li % lines.length) + lines.length) % lines.length], x, y);
        }
        ctx.restore();
      }
      ctx.restore();
      const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1000); g.addColorStop(0, 'rgba(7,8,12,.80)'); g.addColorStop(1, 'rgba(7,8,12,.15)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // 前半: 実数値
      const sa = win(t, 0.4, 8.4, 0.6), st = CFG.stats;
      text(ctx, 'この 60 秒をつくったもの', W / 2, 190, { size: 44, weight: 700, align: 'center', alpha: sa, spacing: 4 });
      const rows = [
        [st.lines || 0, '行のコード', 'JavaScript / GLSL / Python'],
        [1800 * W * H, '個のピクセル', '1,800 フレーム × 1920 × 1080'],
        [st.samples || 0, '個の音声サンプル', '波形を 1 点ずつ数式で合成'],
        [0, '点の外部素材', '撮影・画像・音源・3D モデルなし'],
      ];
      rows.forEach(([n, lab, sub], k) => {
        const t0 = 1.0 + k * 0.75, a = sa * sstep(t0, t0 + 0.5, t), x = W / 2 + (k % 2 ? 80 : -820), y = 420 + (k >> 1) * 290 + 20 * (1 - easeOut((t - t0) / 0.8));
        const v = n * easeOut((t - t0) / 1.4);
        text(ctx, fmt(v), x, y, { size: n > 1e9 ? 104 : 120, weight: 800, font: EN, color: k === 3 ? COL.acc : COL.ink, alpha: a, spacing: -3 });
        text(ctx, lab, x + 4, y + 62, { size: 36, weight: 700, alpha: a });
        text(ctx, sub, x + 4, y + 108, { size: 24, font: sub.charCodeAt(0) < 128 ? MONO : JP, color: COL.dim, alpha: a });
      });

      // 後半: タイトル
      const ta = sstep(8.8, 9.8, t), ty = H / 2 + size * 0.22;
      drawTitle(ctx, ty - 30 + 16 * (1 - easeOut((t - 8.8) / 1.2)), ta, size);
      ctx.save(); ctx.globalAlpha = ta; ctx.fillStyle = COL.acc; const bw = 420 * easeOut((t - 9.4) / 1.2); ctx.fillRect(W / 2 - bw / 2, ty + 22, bw, 5); ctx.restore();
      text(ctx, '企画・演出・描画エンジン・音楽 ― すべて、ひとつの対話セッションで。', W / 2, ty + 110, { size: 38, weight: 700, align: 'center', alpha: sstep(10.0, 10.9, t) });
      if (CFG.credit) text(ctx, CFG.credit, W / 2, ty + 172, { size: 24, font: MONO, color: COL.dim, align: 'center', alpha: sstep(10.8, 11.6, t), spacing: 3 });
      fade(ctx, 1 - sstep(0, 0.6, t) + sstep(DUR - 1.6, DUR - 0.2, t));
    }
  };
})());
