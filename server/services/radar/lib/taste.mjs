// Learns from your 👍/👎: genres and subreddits you like get boosted,
// and artists that "sound like" ones you liked get a bump.
export function tasteModel(state) {
  const g = {}, s = {}, liked = new Set(), disliked = new Set();
  const bump = (m, k, v) => { m[k] ||= { up: 0, down: 0 }; m[k][v > 0 ? "up" : "down"]++; };
  for (const p of state.picks) {
    const v = state.feedback[p.id];
    if (!v) continue;
    for (const genre of p.genres || []) bump(g, genre, v);
    for (const sub of p.subs || []) bump(s, sub, v);
    (v > 0 ? liked : disliked).add(p.key);
  }
  const weight = ({ up, down }) => Math.min(1.8, Math.max(0.5, Math.sqrt((up + 1) / (down + 1))));
  const genreWeights = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, +weight(v).toFixed(2)]));
  const subWeights = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +weight(v).toFixed(2)]));
  const neighbors = new Set();
  for (const e of Object.values(state.edges)) {
    if (liked.has(e.a)) neighbors.add(e.b);
    if (liked.has(e.b)) neighbors.add(e.a);
  }
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1);
  return {
    genreWeights, subWeights, liked, disliked, neighbors,
    factor(c) {
      if (disliked.has(c.key)) return 0.3;
      const gw = mean(c.genres.map((x) => genreWeights[x]).filter(Boolean));
      const sw = mean(c.subs.map((x) => subWeights[x]).filter(Boolean));
      return Math.min(2.2, Math.max(0.4, gw * sw * (neighbors.has(c.key) ? 1.3 : 1)));
    },
  };
}
