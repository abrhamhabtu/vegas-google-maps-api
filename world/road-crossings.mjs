import { sample } from '../landmarks/vendor/map/lanegraph.js';

export const CROSSWALK_HALF = 1.35;
export const CROSSWALK_OFFSET = 2.2;
const CLEARANCE = 0.55;
const GROUND = 0.4;

function along(leg, [x, z]) {
  return (x - leg.ctr[0]) * leg.a[0] + (z - leg.ctr[1]) * leg.a[1];
}

function continuation(edges, edge, atStart) {
  const next = edges[atStart ? edge.next : edge.prev];
  if (next && edge.elevated === next.elevated && next.way.name === edge.way.name) return next;
}

// Walk toward the street side of the crossing plane. Boundary vertices share
// stations with the reference line even when the approach curves or flares.
function distancePastPlane(ref, line, leg, plane, atStart) {
  const count = line.pts.length;
  let previous = -Infinity, previousDistance = 0;
  for (let k = 0; k < count; k++) {
    const i = atStart ? k : count - 1 - k;
    const projection = along(leg, line.pts[i]);
    const distance = atStart ? ref.cum[i] : ref.length - ref.cum[i];
    if (projection >= plane) {
      return k === 0 ? 0 : previousDistance + (distance - previousDistance) *
        (plane - previous) / (projection - previous);
    }
    previous = projection;
    previousDistance = distance;
  }
  return ref.length;
}

function outboundCrossing(edge, leg, edges) {
  const plane = leg.d + CROSSWALK_OFFSET;
  for (let road = edge, walked = 0; road && walked < 34 && !road.elevated; road = continuation(edges, road, true)) {
    const station = distancePastPlane(road.ref, road.ref, leg, plane, true);
    if (station >= CROSSWALK_HALF && station <= road.ref.length - CROSSWALK_HALF) return { road, station };
    walked += road.ref.length;
  }
}

function closestStation(line, x, z) {
  let station = 0, distance = Infinity;
  for (let i = 1; i < line.pts.length; i++) {
    const [ax, az] = line.pts[i - 1], [bx, bz] = line.pts[i];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d >= distance) continue;
    station = line.cum[i - 1] + t * (line.cum[i] - line.cum[i - 1]);
    distance = d;
  }
  return { station, distance };
}

export function planCrossingPaint(data, graph, plan, laneBoundary, stripSlipEdges) {
  const { edges } = graph;
  const junctions = new Map(), arrivals = new Map(), departures = new Map(), gaps = new Map();
  const reserve = (road, from, to) => {
    if (to - from <= 0.001) return;
    const list = gaps.get(road.id);
    if (list) list.push([from, to]);
    else gaps.set(road.id, [[from, to]]);
  };
  for (const leg of plan.legs) {
    const paint = [];
    for (const { e, atStart } of leg.entries) {
      const mouth = (atStart ? plan.mouthStart : plan.mouthEnd).get(e.id);
      if (mouth?.leg !== leg) continue;
      let hit;
      if (mouth.band) {
        const middle = (mouth.band[0] + mouth.band[1]) / 2;
        hit = { road: e, station: atStart ? middle : e.ref.length - middle };
      } else if (atStart && leg.cross && leg.markedEdges?.has(e.id)) {
        hit = outboundCrossing(e, leg, edges);
      }
      if (!hit) continue;
      paint.push(hit);
      (atStart ? departures : arrivals).set(e.id, leg);
      const plane = leg.d + CROSSWALK_OFFSET + CROSSWALK_HALF + CLEARANCE;
      for (let road = e, walked = 0; road && walked < leg.d + 36; road = continuation(edges, road, atStart)) {
        const length = road.ref.length;
        const clear = Math.max(
          distancePastPlane(road.ref, laneBoundary(road, 0), leg, plane, atStart),
          distancePastPlane(road.ref, laneBoundary(road, road.lanes.length), leg, plane, atStart)
        );
        if (atStart) reserve(road, 0, clear);
        else reserve(road, length - clear, length);
        if (clear < length - 0.001) break;
        walked += length;
      }
    }
    if (paint.length) junctions.set(leg, paint);
  }

  const crossingsByNode = new Map(data.crossings.filter(c =>
    c.k !== 'unmarked' && c.k !== 'no' && c.m !== 'unmarked' && c.m !== 'no'
  ).map(c => [c.id, c]));
  const standalone = new Map();
  for (const road of edges) {
    if (road.cls === 'motorway' || road.cls === 'ramp' || road.way.svc === 'parking_aisle' ||
      road.twin !== undefined && road.id > road.twin) continue;
    for (const id of road.way.n) {
      const c = crossingsByNode.get(id);
      if (!c || plan.usedCrossings.has(id) && !(stripSlipEdges.has(road.id) && c.m)) continue;
      if (road.cls === 'arterial' && !/traffic_signals/.test(c.k ?? '')) continue;
      const { station, distance } = closestStation(road.ref, c.x, c.z);
      if (distance > 25) continue;
      const point = sample(road.ref, station);
      if (point.y > GROUND) continue;
      if (road.cls === 'service' || /_link$/.test(road.way.hw)) {
        if (station < plan.endSetback(road, road.fromNode) + 1 ||
          station > road.ref.length - plan.endSetback(road, road.toNode) - 1) continue;
      }
      const prior = standalone.get(id);
      if (!prior || prior.road.cls === 'service' && road.cls !== 'service' ||
        (prior.road.cls === 'service') === (road.cls === 'service') && distance < prior.distance) {
        standalone.set(id, { road, station, point, distance });
      }
    }
  }
  const half = CROSSWALK_HALF + CLEARANCE;
  for (const { road, station, point } of standalone.values()) {
    const twin = edges[road.twin];
    const reserveBand = (edge, at) => {
      const length = edge.ref.length;
      reserve(edge, Math.max(0, at - half), Math.min(length, at + half));
      for (let road = continuation(edges, edge, false), rest = half - at;
        road && rest > 0.001; road = continuation(edges, road, false)) {
        reserve(road, Math.max(0, road.ref.length - rest), road.ref.length);
        rest -= road.ref.length;
      }
      for (let road = continuation(edges, edge, true), rest = at + half - length;
        road && rest > 0.001; road = continuation(edges, road, true)) {
        reserve(road, 0, Math.min(rest, road.ref.length));
        rest -= road.ref.length;
      }
    };
    reserveBand(road, station);
    if (twin) reserveBand(twin, closestStation(twin.ref, point.x, point.z).station);
  }
  for (const list of gaps.values()) list.sort((a, b) => a[0] - b[0]);
  return { junctions, standalone, arrivals, departures, gaps };
}

export function* paintSpans(from, to, gaps) {
  for (const [start, end] of gaps) {
    if (end <= from) continue;
    if (start >= to) break;
    if (start > from) yield [from, start];
    from = end;
  }
  if (to > from) yield [from, to];
}

export function guideClearsCrossing(points, leg) {
  const limit = leg.d + CROSSWALK_OFFSET - CROSSWALK_HALF - CLEARANCE - 0.06;
  return points.every(point => along(leg, point) <= limit);
}
