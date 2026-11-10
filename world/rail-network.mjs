// Rail footprints come from the imported OSM map. Heights and supports are solved against the same
// lane graph as traffic; this module deliberately has no Three.js or browser dependencies.
export const RAIL_STYLES = Object.freeze({
  monorail: Object.freeze({ height: 9.5, depth: 2.4, halfWidth: 3.1, pierHalf: 0.7, pierTop: 2.2, spacing: 30, grade: 0.045 }),
  funicular: Object.freeze({ height: 7.5, depth: 1.4, halfWidth: 1.5, pierHalf: 0.6, pierTop: 1.4, spacing: 28, grade: 0.045 }),
});

export const ROAD_CLEARANCE = 5.6;
const SURFACE_OFFSET = 0.18, ROAD_MARGIN = 0.8, CELL = 48, EPS = 1e-8;
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = x => Math.max(0, Math.min(1, x));
const pointAt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function projection(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  return clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1));
}

function distanceToSegment(p, a, b) {
  return distance(p, pointAt(a, b, projection(p, a, b)));
}

function clip(interval, a, b, lo, hi) {
  if (Math.abs(b) < EPS) return a >= lo - EPS && a <= hi + EPS;
  const p = (lo - a) / b, q = (hi - a) / b;
  interval[0] = Math.max(interval[0], Math.min(p, q));
  interval[1] = Math.min(interval[1], Math.max(p, q));
  return interval[0] <= interval[1] + EPS;
}

/** Exact interval of AB inside a radius-r capsule around CD, including parallel/endpoint overlaps. */
export function capsuleInterval(a, b, c, d, radius) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz;
  if (len2 < EPS) return distanceToSegment(a, c, d) <= radius ? [0, 1] : null;
  const intervals = [];
  for (const p of [c, d]) {
    const px = a[0] - p[0], pz = a[1] - p[1], dot = px * dx + pz * dz;
    const disc = dot * dot - len2 * (px * px + pz * pz - radius * radius);
    if (disc < -EPS) continue;
    const root = Math.sqrt(Math.max(0, disc));
    const lo = Math.max(0, (-dot - root) / len2), hi = Math.min(1, (-dot + root) / len2);
    if (lo <= hi + EPS) intervals.push([lo, hi]);
  }
  const rx = d[0] - c[0], rz = d[1] - c[1], len = Math.hypot(rx, rz);
  if (len > EPS) {
    const hx = rx / len, hz = rz / len, px = a[0] - c[0], pz = a[1] - c[1], range = [0, 1];
    if (clip(range, px * hx + pz * hz, dx * hx + dz * hz, 0, len)
      && clip(range, -px * hz + pz * hx, -dx * hz + dz * hx, -radius, radius)) intervals.push(range);
  }
  return intervals.length ? [Math.min(...intervals.map(r => r[0])), Math.max(...intervals.map(r => r[1]))] : null;
}

function bounds(points, radius = 0) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  return [x0 - radius, z0 - radius, x1 + radius, z1 + radius];
}

function spatialIndex() {
  const cells = new Map();
  const visit = (box, fn) => {
    for (let x = Math.floor(box[0] / CELL); x <= Math.floor(box[2] / CELL); x++)
      for (let z = Math.floor(box[1] / CELL); z <= Math.floor(box[3] / CELL); z++) fn(`${x},${z}`);
  };
  return {
    insert(value, box) { visit(box, key => { if (!cells.has(key)) cells.set(key, []); cells.get(key).push(value); }); },
    query(box) {
      const seen = new Set();
      visit(box, key => { for (const value of cells.get(key) ?? []) seen.add(value); });
      return [...seen];
    },
  };
}

function insidePolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function polygonInterval(a, b, polygon, radius) {
  const ranges = [];
  if (insidePolygon(a, polygon)) ranges.push([0, 0]);
  if (insidePolygon(b, polygon)) ranges.push([1, 1]);
  for (let i = 0; i < polygon.length; i++) {
    const range = capsuleInterval(a, b, polygon[i], polygon[(i + 1) % polygon.length], radius);
    if (range) ranges.push(range);
  }
  // Source junction hulls are convex. This also conservatively covers a concave input hull.
  return ranges.length ? [Math.min(...ranges.map(r => r[0])), Math.max(...ranges.map(r => r[1]))] : null;
}

function lineNormals(points, mitreStart, mitreEnd) {
  return points.map((p, i) => {
    if (i === 0 && mitreStart) return mitreStart;
    if (i === points.length - 1 && mitreEnd) return mitreEnd;
    let nx = 0, nz = 0;
    for (const [a, b] of [[points[Math.max(0, i - 1)], p], [p, points[Math.min(points.length - 1, i + 1)]]]) {
      const length = distance(a, b);
      if (length > EPS) { nx -= (b[1] - a[1]) / length; nz += (b[0] - a[0]) / length; }
    }
    const length = Math.hypot(nx, nz) || 1;
    nx /= length; nz /= length;
    if (i > 0 && i < points.length - 1) {
      const b = points[i + 1], length = distance(p, b) || 1;
      const scale = Math.min(2.2, 1 / Math.max(0.45, nx * -(b[1] - p[1]) / length + nz * (b[0] - p[0]) / length));
      nx *= scale; nz *= scale;
    }
    return [nx, nz];
  });
}

function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const side = list => {
    const result = [];
    for (const p of list) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop();
      result.push(p);
    }
    result.pop();
    return result;
  };
  return [...side(sorted), ...side(sorted.slice().reverse())];
}

// Match the source lanegraph's cornerFillets: tight ground-level hotel-drive turns are paved inside
// their chord as well as along each connector lane. A support cannot stand in that intervening fill.
function cornerPolygons(graph) {
  const lanes = graph.lanes ?? [], polygons = [], seen = new Set();
  const minor = id => ['service', 'local'].includes(graph.edges?.[lanes[id]?.edge]?.cls);
  const raised = line => line?.y?.some(height => height > 2.5);
  for (const connector of lanes) {
    if (!connector.connector || !connector.prev?.length || !connector.next?.length || raised(connector.line)) continue;
    const before = connector.prev[0], first = connector.next[0];
    if ((!minor(before) && !minor(first)) || raised(lanes[before]?.line) || raised(lanes[first]?.line)) continue;
    const back = lanes[before]?.line;
    if (!back || !lanes[first]?.line) continue;
    const points = [];
    for (let i = back.pts.length - 1, got = 0; i >= 0 && got < 10; i--) {
      points.unshift(back.pts[i]);
      if (i > 0) got += distance(back.pts[i], back.pts[i - 1]);
    }
    points.push(...connector.line.pts);
    let lane = first, got = 0;
    for (let hops = 0; hops < 8 && got < 10; hops++) {
      const line = lanes[lane]?.line;
      if (!line) break;
      for (let i = 0; i < line.pts.length && got < 10; i++) {
        got += distance(points.at(-1), line.pts[i]); points.push(line.pts[i]);
      }
      const next = lanes[lane].next?.[0];
      if (next === undefined) break;
      lane = next;
    }
    const a = points[0], b = points.at(-1), dx = b[0] - a[0], dz = b[1] - a[1], chord = distance(a, b) || 1;
    let depth = 0;
    for (const p of points) depth = Math.max(depth, Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / chord);
    if (depth < 1 || depth > 9 || chord > 34) continue;
    const key = `${Math.round(a[0])},${Math.round(a[1])},${Math.round(b[0])},${Math.round(b[1])}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const polygon = convexHull(points);
    if (polygon.length >= 3) polygons.push(polygon);
  }
  return polygons;
}

/** Indexed conservative pavement envelopes, including service roads, raw lanes, tapers and raised decks. */
export function createRoadIndex(graph = {}) {
  const index = spatialIndex();
  const addLine = (line, radius) => {
    if (!line?.pts) return;
    for (let i = 0; i + 1 < line.pts.length; i++) {
      const a = line.pts[i], b = line.pts[i + 1];
      const segment = { a, b, y0: line.y?.[i] ?? 0, y1: line.y?.[i + 1] ?? 0, radius };
      index.insert(segment, bounds([a, b], radius));
    }
  };
  for (const lane of graph.lanes ?? []) {
    const radius = (lane.width ?? 3.5) / 2 + ROAD_MARGIN;
    addLine(lane.line, radius);
    if (lane.raw && lane.raw !== lane.line) addLine(lane.raw, radius);
  }
  // Edge envelopes include the centre turning lane and any joint flare outside a lane's centreline.
  for (const edge of graph.edges ?? []) {
    const ref = edge.ref;
    if (!ref?.pts?.length) continue;
    const width = (edge.lanes?.length ?? 1) * (edge.laneWidth ?? 3.5);
    const centre = !edge.oneway && (edge.way?.lanes ?? 0) % 2 === 1 && (edge.way?.lanes ?? 0) >= 3 && !edge.way?.lf ? (edge.laneWidth ?? 3.5) / 2 : 0;
    const normal = lineNormals(ref.pts, edge.mitreStart, edge.mitreEnd);
    const points = [], radii = [];
    for (let i = 0; i < ref.pts.length; i++) {
      const at = ref.cum?.[i] ?? 0, length = ref.length ?? 0;
      const boundary = (lane, base) => {
        const ease = t => { const k = clamp(t); return k * k * (3 - 2 * k); };
        let result = base;
        if (edge.jointStart && edge.taperStart) result += ((edge.jointStart[lane] ?? base) - base) * ease(1 - at / edge.taperStart);
        if (edge.jointEnd && edge.taperEnd) result += ((edge.jointEnd[lane] ?? base) - base) * ease(1 - (length - at) / edge.taperEnd);
        return result;
      };
      const left = boundary(0, 0) - centre - 0.15, right = boundary(edge.lanes?.length ?? 1, width) + 0.15;
      points.push([ref.pts[i][0] + normal[i][0] * (left + right) / 2, ref.pts[i][1] + normal[i][1] * (left + right) / 2]);
      radii.push((right - left) / 2 * Math.hypot(...normal[i]) + ROAD_MARGIN);
    }
    for (let i = 0; i + 1 < points.length; i++) addLine({ pts: [points[i], points[i + 1]], y: [ref.y?.[i] ?? 0, ref.y?.[i + 1] ?? 0] }, Math.max(radii[i], radii[i + 1]));
  }
  for (const polygon of graph.hulls ?? []) {
    if (polygon.length < 3) continue;
    const box = bounds(polygon, ROAD_MARGIN);
    let height = 0;
    for (const segment of index.query(box)) height = Math.max(height, segment.polygon ? segment.height : Math.max(segment.y0, segment.y1));
    index.insert({ polygon, height }, box);
  }
  for (const polygon of cornerPolygons(graph)) index.insert({ polygon, height: 0 }, bounds(polygon, ROAD_MARGIN));
  return index;
}

/** The complete support footprint must be clear, irrespective of the road deck's elevation. */
export function isRoadFootprint(index, x, z, radius = 0) {
  const point = [x, z];
  return index.query(bounds([point], radius)).some(road => {
    if (!road.polygon) return distanceToSegment(point, road.a, road.b) <= road.radius + radius;
    return insidePolygon(point, road.polygon) || road.polygon.some((a, i) => distanceToSegment(point, a, road.polygon[(i + 1) % road.polygon.length]) <= radius + ROAD_MARGIN);
  });
}

function roadCrossing(a, b, road, radius) {
  if (road.polygon) {
    const range = polygonInterval(a, b, road.polygon, radius + ROAD_MARGIN);
    return range && { range, height: road.height };
  }
  const range = capsuleInterval(a, b, road.a, road.b, road.radius + radius);
  if (!range) return null;
  // Reserve the highest part of the road that can overlap the entire width of the guideway.
  const spread = (radius + road.radius) / (distance(road.a, road.b) || 1);
  const u = projection(pointAt(a, b, range[0]), road.a, road.b), v = projection(pointAt(a, b, range[1]), road.a, road.b);
  const y0 = lerp(road.y0, road.y1, clamp(Math.min(u, v) - spread));
  const y1 = lerp(road.y0, road.y1, clamp(Math.max(u, v) + spread));
  return { range, height: Math.max(y0, y1) };
}

// A maximum heap lets a high crossing propagate a gentle approach through every connected rail way.
function maxHeap() {
  const entries = [];
  return {
    push(value) {
      let i = entries.push(value) - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (entries[parent][0] >= value[0]) break;
        entries[i] = entries[parent]; i = parent;
      }
      entries[i] = value;
    },
    pop() {
      if (!entries.length) return null;
      const top = entries[0], last = entries.pop();
      if (entries.length) {
        let i = 0;
        while (2 * i + 1 < entries.length) {
          let child = 2 * i + 1;
          if (child + 1 < entries.length && entries[child + 1][0] > entries[child][0]) child++;
          if (entries[child][0] <= last[0]) break;
          entries[i] = entries[child]; i = child;
        }
        entries[i] = last;
      }
      return top;
    },
  };
}

function solveHeights(lines) {
  const nodes = [], grid = new Map(), tolerance = 0.25;
  for (const line of lines) {
    const ids = [];
    for (let i = 0; i < line.points.length; i++) {
      const p = line.points[i], cx = Math.floor(p[0]), cz = Math.floor(p[1]);
      let match;
      for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) {
        for (const id of grid.get(`${line.kind}:${x},${z}`) ?? []) {
          if (distance(nodes[id].point, p) <= tolerance) { match = id; break; }
        }
      }
      if (match === undefined) {
        match = nodes.length;
        nodes.push({ point: p, height: line.heights[i], links: [] });
        const key = `${line.kind}:${cx},${cz}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(match);
      } else nodes[match].height = Math.max(nodes[match].height, line.heights[i]);
      ids.push(match);
      if (i > 0 && ids[i - 1] !== match) {
        const previous = ids[i - 1], cost = distance(line.points[i - 1], p) * RAIL_STYLES[line.kind].grade;
        nodes[match].links.push([previous, cost]);
        nodes[previous].links.push([match, cost]);
      }
    }
    line.nodeIds = ids;
  }
  const heap = maxHeap();
  nodes.forEach((node, id) => heap.push([node.height, id]));
  for (let entry; (entry = heap.pop());) {
    const [height, id] = entry;
    if (height < nodes[id].height - EPS) continue;
    for (const [to, cost] of nodes[id].links) {
      const needed = height - cost;
      if (needed > nodes[to].height + EPS) { nodes[to].height = needed; heap.push([needed, to]); }
    }
  }
  for (const line of lines) {
    line.heights = line.nodeIds.map(id => nodes[id].height);
    delete line.nodeIds;
  }
}

/** Sample a planned guideway in source metres, with its solved height and travel heading. */
export function sampleRail(line, at) {
  let accumulated = 0;
  for (let i = 0; i + 1 < line.points.length; i++) {
    const a = line.points[i], b = line.points[i + 1], length = distance(a, b);
    if (at <= accumulated + length || i === line.points.length - 2) {
      const t = clamp((at - accumulated) / (length || 1));
      return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), height: lerp(line.heights[i], line.heights[i + 1], t), yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    accumulated += length;
  }
  return null;
}

function placePiers(lines, roads) {
  const placed = spatialIndex();
  for (const line of lines) {
    const style = RAIL_STYLES[line.kind];
    const length = line.points.slice(1).reduce((sum, p, i) => sum + distance(line.points[i], p), 0);
    const shifts = [0, -2, 2, -4, 4, -6, 6, -8, 8, -10, 10, -12, 12];
    for (let station = Math.min(style.spacing / 2, length / 2); station < length; station += style.spacing) {
      for (const shift of shifts) {
        const at = station + shift;
        if (at < 1 || at > length - 1) continue;
        const pier = sampleRail(line, at), point = [pier.x, pier.z];
        // A circumscribed circle includes all four corners of the square concrete shaft.
        if (isRoadFootprint(roads, pier.x, pier.z, Math.SQRT2 * style.pierHalf + 0.5)) continue;
        if (placed.query(bounds([point], style.spacing * 0.42)).some(other => distance(point, other) < style.spacing * 0.42)) continue;
        line.piers.push({ x: pier.x, z: pier.z, height: pier.height - style.pierTop, yaw: pier.yaw });
        placed.insert(point, bounds([point]));
        break;
      }
    }
  }
}

/**
 * Preserve source monorail/elevated-tram geometry, raising only connected approaches that need clearance.
 * Heights are guideway running-surface elevations; pier heights are ground-to-column-top distances.
 * Call after road/intersection construction so graph.hulls includes the rendered junction pavement.
 */
export function planRailways(data, graph) {
  const roads = createRoadIndex(graph), lines = [];
  for (const rail of data.rail ?? []) {
    const style = RAIL_STYLES[rail.k];
    if (!style || (rail.k === 'funicular' && !rail.br) || rail.pts.length < 2) continue;
    const line = { name: rail.name || (rail.k === 'monorail' ? 'Las Vegas Monorail' : 'Resort tram'), kind: rail.k, points: [], heights: [], piers: [] };
    const normal = lineNormals(rail.pts);
    for (let i = 0; i + 1 < rail.pts.length; i++) {
      const a = rail.pts[i], b = rail.pts[i + 1], length = distance(a, b);
      if (length < EPS) continue;
      const radius = style.halfWidth * Math.max(1, Math.hypot(...normal[i]), Math.hypot(...normal[i + 1]));
      const requirements = [];
      const cuts = [0, 1], count = Math.ceil(length / 10);
      for (let k = 1; k < count; k++) cuts.push(k / count);
      for (const road of roads.query(bounds([a, b], radius))) {
        const hit = roadCrossing(a, b, road, radius);
        if (!hit) continue;
        requirements.push({ range: hit.range, height: hit.height + SURFACE_OFFSET + ROAD_CLEARANCE + style.depth });
        cuts.push(...hit.range);
      }
      cuts.sort((x, y) => x - y);
      let previous = -1;
      for (const t of cuts) {
        if (t - previous < EPS) continue;
        previous = t;
        let height = style.height;
        for (const need of requirements) if (t >= need.range[0] - EPS && t <= need.range[1] + EPS) height = Math.max(height, need.height);
        if (line.points.length && t === 0) {
          line.heights[line.heights.length - 1] = Math.max(line.heights.at(-1), height);
        } else { line.points.push(pointAt(a, b, t)); line.heights.push(height); }
      }
    }
    if (line.points.length > 1) lines.push(line);
  }
  solveHeights(lines);
  placePiers(lines, roads);
  return { lines };
}
