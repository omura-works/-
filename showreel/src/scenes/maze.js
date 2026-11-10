// 03 迷路: 深さ優先で生成 → 幅優先探索の波 → 最短経路
SCENES.push((() => {
  const DUR = 9.6, C = 20, NX = W / C, NY = H / C, N = NX * NY;
  let order, par, dist, bfsPar, maxD, path, colStr, links, rank;
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  return {
    name: 'maze', frames: 288, split: 2,
    init() {
      const r = rng(2024), seen = new Uint8Array(N), adj = Array.from({ length: N }, () => []);
      order = []; par = new Int32Array(N).fill(-1); rank = new Int32Array(N);
      const st = [0]; seen[0] = 1; order.push(0);
      while (st.length) {               // 深さ優先 (再帰バックトラッカー)
        const c = st[st.length - 1], x = c % NX, y = c / NX | 0, opt = [];
        for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx >= 0 && ny >= 0 && nx < NX && ny < NY && !seen[ny * NX + nx]) opt.push(ny * NX + nx); }
        if (!opt.length) { st.pop(); continue; }
        const n = opt[r() * opt.length | 0]; seen[n] = 1; par[n] = c; rank[n] = order.length; order.push(n); st.push(n); adj[c].push(n); adj[n].push(c);
      }
      links = [];                         // 追加の抜け道 (ループを作り最短経路を非自明にする)
      for (let k = 0; k < N * 0.07; k++) {
        const c = r() * N | 0, d = r() * 2 | 0, x = c % NX + DX[d], y = (c / NX | 0) + DY[d];
        if (x < NX && y < NY && !adj[c].includes(y * NX + x)) { const n = y * NX + x; adj[c].push(n); adj[n].push(c); links.push([c, n]); }
      }
      dist = new Int32Array(N).fill(-1); bfsPar = new Int32Array(N).fill(-1); dist[0] = 0;
      for (let q = [0], h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (dist[n] < 0) { dist[n] = dist[q[h]] + 1; bfsPar[n] = q[h]; q.push(n); }
      maxD = Math.max(...dist); path = [];
      for (let c = N - 1; c >= 0; c = bfsPar[c]) path.push(c); path.reverse();
      colStr = Array.from(dist, d => { const [R, G, B] = pal(d / maxD, [.5, .45, .5], [.5, .4, .45], [1.1, .9, .7], [.02, .22, .52]); return `rgb(${R * 235 | 0},${G * 235 | 0},${B * 235 | 0})`; });
    },
    frame(ctx, i, t) {
      const carve = easeInOut((t - 0.4) / 2.9) * N, wave = sstep(3.5, 6.9, t) * (maxD + 12), pl = easeInOut((t - 7.0) / 1.5) * path.length;
      const cell = (c, p, pad, col) => {
        const x = c % NX * C, y = (c / NX | 0) * C; ctx.fillStyle = col; ctx.fillRect(x + pad, y + pad, C - 2 * pad, C - 2 * pad);
        if (p >= 0) { const px = p % NX * C, py = (p / NX | 0) * C; ctx.fillRect(Math.min(x, px) + pad, Math.min(y, py) + pad, Math.abs(x - px) + C - 2 * pad, Math.abs(y - py) + C - 2 * pad); }
      };
      const colOf = c => {
        const d = wave - dist[c];
        if (d < 0) return '#1a2236';
        return d < 10 ? `rgb(255,${225 - d * 6 | 0},${200 - d * 12 | 0})` : colStr[c];
      };
      const dimPath = sstep(7.0, 8.2, t);
      for (let k = 0; k < carve; k++) {
        const c = order[k], head = carve - k;
        cell(c, par[c], 3, head < 50 && carve < N - 1 ? `rgb(255,${138 + (50 - head) * 2 | 0},${76 + (50 - head) * 3 | 0})` : colOf(c));
      }
      if (carve >= N - 1) for (const [a, b] of links) cell(a, b, 3, colOf(dist[a] > dist[b] ? a : b));
      if (dimPath > 0) { ctx.fillStyle = `rgba(7,8,12,${dimPath * 0.62})`; ctx.fillRect(0, 0, W, H); }
      if (pl > 0) {
        ctx.save(); ctx.shadowColor = COL.acc; ctx.shadowBlur = 18;
        for (let k = 0; k < pl; k++) cell(path[k], k ? path[k - 1] : -1, 5, '#fff7ea');
        ctx.restore();
      }
      const hud = (s, y, a) => text(ctx, s, W - 96, y, { size: 26, font: MONO, align: 'right', color: COL.ink, alpha: a, shadow: 14 });
      const vis = dist.reduce((n, d) => n + (d <= wave ? 1 : 0), 0);
      const ha = win(t, 0.6, DUR - 0.4, 0.5);
      ctx.save(); ctx.globalAlpha = ha * 0.72; ctx.fillStyle = '#07080c'; ctx.fillRect(W - 470, 60, 400, 150); ctx.restore();
      hud(`cells    ${String(Math.min(N, carve | 0)).padStart(5)} / ${N}`, 106, ha);
      hud(`visited  ${String(t > 3.5 ? Math.min(N, vis) : 0).padStart(5)} / ${N}`, 146, ha);
      hud(`path     ${String(pl | 0).padStart(5)} steps`, 186, ha);
      chapter(ctx, t, DUR, '03', 'ALGORITHMS', '生成して、解く', '5,184 マスの迷路を生成 → 幅優先探索 → 最短経路');
      edgeFade(ctx, t, DUR);
    }
  };
})());
