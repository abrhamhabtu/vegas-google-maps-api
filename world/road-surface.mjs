// Road deck heights for the lane graph, so cars on different levels
// (freeway bridge vs. street below) never interact and manual driving
// follows ramps.
export const LEVEL_GAP = 3;
export const BRIDGE_SLAB_DEPTH = 1.25;

export function sameRoadLevel(a, b) {
  return Math.abs((a.y || 0) - (b.y || 0)) < LEVEL_GAP;
}

export function createRoadSurface(graph, { cell = 40, reach = 7 } = {}) {
  const grid = new Map();
  const key = (i, j) => i * 100003 + j;
  const add = (a, b, y0, y1) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const segment = [a[0], a[1], y0, dx, dz, y1 - y0, dx * dx + dz * dz || 1];
    const x0 = Math.floor((Math.min(a[0], b[0]) - reach) / cell), x1 = Math.floor((Math.max(a[0], b[0]) + reach) / cell);
    const z0 = Math.floor((Math.min(a[1], b[1]) - reach) / cell), z1 = Math.floor((Math.max(a[1], b[1]) + reach) / cell);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = key(x, z);
      let segments = grid.get(k);
      if (!segments) grid.set(k, segments = []);
      segments.push(segment);
    }
  };
  for (const lane of graph.lanes ?? []) {
    const { pts, y } = lane.line ?? {};
    if (!pts?.length) continue;
    if (pts.length === 1) add(pts[0], pts[0], y?.[0] ?? 0, y?.[0] ?? 0);
    for (let i = 1; i < pts.length; i++) add(pts[i - 1], pts[i], y?.[i - 1] ?? 0, y?.[i] ?? 0);
  }
  return {
    // Project onto the actual lane segment to interpolate ramp height continuously.
    // A moving vehicle can supply a maximum elevation change for one physics step.
    heightAt(x, z, currentY = 0, maxStep = Infinity) {
      const segments = grid.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? [];
      let best = null, bestScore = Infinity;
      for (const [ax, az, y0, dx, dz, dy, length2] of segments) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length2));
        const y = y0 + dy * t, step = Math.abs(y - currentY);
        if (step > maxStep) continue;
        const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
        if (d > reach) continue;
        const score = step * 2 + d;
        if (score < bestScore) { bestScore = score; best = y; }
      }
      return best ?? (Number.isFinite(maxStep) ? currentY : 0);
    },
  };
}
