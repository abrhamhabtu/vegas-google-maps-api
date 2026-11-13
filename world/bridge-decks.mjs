const MAX_MEDIAN_WIDTH = 22;

// The road rims are piecewise linear. Clip each overlap in the common
// longitudinal coordinate so its two edges land exactly on the road meshes.
function overlap(a, b, axis) {
  let from = Math.max(a.from, b.from);
  let to = Math.min(a.to, b.to);
  if (to - from < 1e-4) return;
  const at = (segment, s) => {
    const t = (s - segment.p[axis]) / (segment.q[axis] - segment.p[axis]);
    return {
      point: segment.p.map((v, i) => v + (segment.q[i] - v) * t),
      y: segment.y0 + (segment.y1 - segment.y0) * t,
      station: segment.s0 + (segment.s1 - segment.s0) * t,
    };
  };
  const rowsAt = s => [at(a, s), at(b, s)];
  const gap = ([p, q]) => axis === 0 ? p.point[1] - q.point[1] : q.point[0] - p.point[0];
  const clip = measure => {
    const v0 = measure(rowsAt(from));
    const v1 = measure(rowsAt(to));
    if (v0 < 0 && v1 < 0) return false;
    if (v0 < 0) from += (to - from) * v0 / (v0 - v1);
    else if (v1 < 0) to -= (to - from) * v1 / (v1 - v0);
    return to - from >= 1e-4;
  };
  if (!clip(gap) || !clip(rows => MAX_MEDIAN_WIDTH - gap(rows))) return;
  // A shallow crossfall is expected on paired approaches. A road on another
  // level must keep its own deck and the clearance below it.
  const levelRoom = rows => 0.5 + gap(rows) * 0.09;
  if (!clip(rows => levelRoom(rows) + rows[0].y - rows[1].y) ||
      !clip(rows => levelRoom(rows) + rows[1].y - rows[0].y)) return;
  const start = rowsAt(from);
  const end = rowsAt(to);
  if (Math.max(start[0].y, start[1].y, end[0].y, end[1].y) <= 0.03) return;
  return {
    a: a.edge,
    b: b.edge,
    left: { pts: [start[1].point, end[1].point], y: [start[1].y, end[1].y] },
    right: { pts: [start[0].point, end[0].point], y: [start[0].y, end[0].y] },
    aSpan: [start[0].station, end[0].station],
    bSpan: [end[1].station, start[1].station],
  };
}

export function planBridgeDecks(edges, innerEdge) {
  const roads = new Map();
  for (const edge of edges) {
    const { name, hw, tn } = edge.way;
    if (!edge.oneway || !name || tn || hw.endsWith('_link') ||
        (edge.cls !== 'arterial' && edge.cls !== 'collector')) continue;
    if (!roads.has(name)) roads.set(name, []);
    roads.get(name).push(edge);
  }
  const spans = [], joined = new Map();
  for (const road of roads.values()) {
    const raised = road.filter(e => e.elevated);
    if (!raised.length) continue;
    let dx = 0, dz = 0;
    for (const { ref } of raised) {
      for (let i = 1; i < ref.pts.length; i++) {
        dx += Math.abs(ref.pts[i][0] - ref.pts[i - 1][0]);
        dz += Math.abs(ref.pts[i][1] - ref.pts[i - 1][1]);
      }
    }
    const axis = dx >= dz ? 0 : 1;
    const forward = [], reverse = [];
    for (const edge of road) {
      const line = innerEdge(edge);
      for (let i = 1; i < line.pts.length; i++) {
        const p = line.pts[i - 1], q = line.pts[i];
        const d = q[axis] - p[axis];
        if (Math.abs(d) < 0.55 * (line.cum[i] - line.cum[i - 1]) || Math.abs(d) < 1e-4) continue;
        const segment = {
          edge, p, q, y0: line.y[i - 1], y1: line.y[i], s0: line.cum[i - 1], s1: line.cum[i],
          from: Math.min(p[axis], q[axis]), to: Math.max(p[axis], q[axis]),
        };
        (d > 0 ? forward : reverse).push(segment);
      }
    }
    reverse.sort((a, b) => a.from - b.from);
    for (const a of forward) {
      for (const b of reverse) {
        if (b.from >= a.to) break;
        if (b.to <= a.from || a.edge === b.edge) continue;
        const seam = overlap(a, b, axis);
        if (!seam) continue;
        spans.push(seam);
        for (const [edge, range] of [[seam.a, seam.aSpan], [seam.b, seam.bSpan]]) {
          if (!joined.has(edge.id)) joined.set(edge.id, []);
          joined.get(edge.id).push(range);
        }
      }
    }
  }
  for (const ranges of joined.values()) ranges.sort((a, b) => a[0] - b[0]);
  return { spans, joined };
}
