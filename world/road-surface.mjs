// Road deck heights for the lane graph, so cars on different levels
// (freeway bridge vs. street below) never interact and manual driving
// follows ramps.
export const LEVEL_GAP = 3;

export function sameRoadLevel(a, b) {
  return Math.abs((a.y || 0) - (b.y || 0)) < LEVEL_GAP;
}

export function createRoadSurface(graph, { cell = 40, reach = 7 } = {}) {
  const grid = new Map();
  const key = (i, j) => i * 100003 + j;
  const add = (x, z, y) => {
    const k = key(Math.floor(x / cell), Math.floor(z / cell));
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(x, z, y);
  };
  for (const lane of graph.lanes ?? []) {
    const { pts, y } = lane.line ?? {};
    if (!pts) continue;
    for (let i = 0; i < pts.length; i++) {
      add(pts[i][0], pts[i][1], y[i] ?? 0);
      if (i + 1 < pts.length) {
        const a = pts[i], b = pts[i + 1];
        const n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4);
        for (let s = 1; s <= n; s++) {
          const t = s / (n + 1);
          add(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (y[i] ?? 0) + ((y[i + 1] ?? 0) - (y[i] ?? 0)) * t);
        }
      }
    }
  }
  return {
    // Height of the deck under (x, z); among decks in reach prefer the one
    // closest to the current height so cars stay on their level.
    heightAt(x, z, currentY = 0) {
      const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
      let best = null, bestScore = Infinity;
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
        const arr = grid.get(key(i, j));
        if (!arr) continue;
        for (let k = 0; k < arr.length; k += 3) {
          const d = Math.hypot(arr[k] - x, arr[k + 1] - z);
          if (d > reach) continue;
          const score = Math.abs(arr[k + 2] - currentY) * 2 + d;
          if (score < bestScore) { bestScore = score; best = arr[k + 2]; }
        }
      }
      return best ?? 0;
    },
  };
}
