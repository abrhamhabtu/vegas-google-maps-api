// The lane edge and its reference have the same vertices but different arclengths.
export function offsetStation(reference, line, distance) {
  const station = Math.max(0, Math.min(reference.length, distance));
  let low = 0;
  let high = reference.cum.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (reference.cum[middle] <= station) low = middle;
    else high = middle;
  }
  const span = reference.cum[high] - reference.cum[low];
  const t = span > 0 ? (station - reference.cum[low]) / span : 0;
  return line.cum[low] + t * (line.cum[high] - line.cum[low]);
}

export function dashRuns(start, end, length, gap, phase) {
  const period = length + gap;
  const runs = [];
  for (let mark = Math.floor((start + phase) / period) * period - phase; mark < end; mark += period) {
    const from = Math.max(start, mark);
    const to = Math.min(end, mark + length);
    if (to - from >= 0.55) runs.push([from, to]);
  }
  return runs;
}

// Sample across a median, then refine the boundaries of the widest clear span.
// This keeps the curb smooth when the next carriageway or turn sweeps past it.
export function widestClearSpan(width, blocked) {
  const count = Math.max(2, Math.ceil(width / 0.22));
  let open = !blocked(0);
  let start = 0;
  let best = [0, 0];
  for (let i = 1; i <= count; i++) {
    const at = width * i / count;
    const next = !blocked(at);
    if (next === open) continue;
    let lo = width * (i - 1) / count;
    let hi = at;
    for (let k = 0; k < 6; k++) {
      const mid = (lo + hi) / 2;
      if (!blocked(mid) === open) lo = mid;
      else hi = mid;
    }
    if (open && lo - start > best[1] - best[0]) best = [start, lo];
    if (next) start = hi;
    open = next;
  }
  return open && width - start > best[1] - best[0] ? [start, width] : best;
}

export function arrowMarking(movements, laneWidth) {
  if (laneWidth < 1.8) return [];
  const through = movements.includes('through') || movements.includes('merge');
  const left = movements.includes('left');
  const right = movements.includes('right');
  const uturn = movements.includes('uturn');
  if (!through && !left && !right && !uturn) return [];

  const polygons = [];
  const stem = (from, to, width = 0.22) => {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const scale = width / (2 * Math.hypot(dx, dy));
    const x = -dy * scale, y = dx * scale;
    polygons.push([
      [from[0] - x, from[1] - y],
      [from[0] + x, from[1] + y],
      [to[0] + x, to[1] + y],
      [to[0] - x, to[1] - y],
    ]);
  };
  const turn = sign => {
    stem([0, 0.16], [sign * 0.29, 0.59]);
    stem([sign * 0.23, 0.54], [sign * 0.75, 0.54]);
    polygons.push([[sign * 1.18, 0.54], [sign * 0.70, 0.92], [sign * 0.70, 0.16]]);
  };
  stem([0, -1.88], [0, through ? 1.25 : 0.42]);
  if (through) polygons.push([[0, 1.88], [-0.40, 1.18], [0.40, 1.18]]);
  if (left) turn(-1);
  if (right) turn(1);
  if (uturn) {
    stem([0, 0.35], [-0.26, 0.68]);
    stem([-0.20, 0.63], [-0.72, 0.63]);
    stem([-0.66, 0.68], [-0.66, -0.52]);
    polygons.push([[-0.66, -1.04], [-0.99, -0.46], [-0.33, -0.46]]);
  }

  const lateralScale = Math.min(1, (laneWidth * 0.5 - 0.22) / 1.18);
  return polygons.map(polygon => polygon.map(([u, v]) => [u * lateralScale, v]));
}

export function zebraBars(from, to) {
  const stripe = 0.46;
  const spacing = 1.02;
  const count = Math.floor((to - from - stripe) / spacing) + 1;
  const first = (from + to - (count - 1) * spacing - stripe) / 2;
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const start = first + i * spacing;
    return [start, start + stripe];
  });
}
