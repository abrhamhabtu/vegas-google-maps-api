import { toLocal } from '../landmarks/georeference.mjs';

// The centreline only blends the pavement material. Lane shapes come from the graph.
const path = [
  [36.08206, -115.17278], // Welcome sign
  [36.08800, -115.17286],
  [36.09360, -115.17291], // Mandalay Bay Road
  [36.10086, -115.17296], // Tropicana Avenue
  [36.10653, -115.17314],
  [36.11468, -115.17288], // Flamingo Road
  [36.11737, -115.17293],
  [36.11930, -115.17263],
  [36.12339, -115.17057],
  [36.12547, -115.16932], // Sands Avenue
  [36.13060, -115.16597],
  [36.13580, -115.16254],
  [36.14367, -115.15740], // Sahara Avenue
  [36.14844, -115.15423], // The STRAT and Main Street
].map(([lat, lng]) => toLocal(lat, lng));

export const STRIP_PAVEMENT = { path, color: 'roadStrip', innerRadius: 72, outerRadius: 155 };
const stripName = 'South Las Vegas Boulevard';

// Untagged midblock Strip ways that otherwise inherit inflated turn-pocket counts
// from neighboring intersections (e.g. Venetian NB 5L->4L, Resorts World SB 6L->4L).
const STRIP_LANE_OVERRIDES = new Map([
  [255169900, 4],   // NB Strip fronting Venetian / Treasure Island
  [1037094415, 4],  // SB Strip fronting Resorts World
  [1077672936, 4],  // SB Strip at Convention Center Dr
]);

export function stripLaneCount(way) {
  return STRIP_LANE_OVERRIDES.get(way.id);
}

// Calibrated Las Vegas Strip urban arterial lane widths (10.0-10.5 ft on Strip
// turn-pocket approaches vs 11.5 ft generic arterial default) so carriageways
// align cleanly with aerial curbs and preserve central dividers.
export function stripLaneWidth(way, total, cls, southStrip, stripCorridor) {
  if (!southStrip && !stripCorridor) return undefined;
  if (way.w) return undefined;
  if (way.name === stripName || way.name === 'Las Vegas Boulevard South') {
    if (total >= 6) return 3.05;
    if (total === 5) return 3.12;
    return 3.20;
  }
  if (cls === 'arterial') {
    if (total >= 6) return 3.10;
    if (total === 5) return 3.18;
    return 3.28;
  }
  if (cls === 'collector') {
    return total >= 4 ? 3.15 : 3.25;
  }
  return undefined;
}
const flamingo = toLocal(36.11468, -115.17288);
const tropicana = toLocal(36.10086, -115.17296);
const sands = toLocal(36.12547, -115.16932);
const wynnGate = [603.5, -1273.45];
const gateHeading = 28 * Math.PI / 180;
const gateCos = Math.cos(gateHeading), gateSin = Math.sin(gateHeading);
const wynnGateNodes = new Set([137442843, 1490596683]);
export const isWynnGateJunction = members => members.some(id => wynnGateNodes.has(id));

// The added turn lanes narrow toward the existing curb, leaving room for the
// planted divider that runs up to each boulevard crosswalk.
export function wynnMedianInset(edge, station) {
  if (edge.way?.id !== 1030272955 && edge.way?.id !== 1030297250) return 0;
  if (!wynnGateNodes.has(edge.toNode)) return 0;
  const length = edge.ref.length;
  const fade = Math.max(length - 32, length * 0.5);
  const t = Math.max(0, Math.min(1, 1 - station / fade));
  return 2.85 * (1 - t * t * (3 - 2 * t));
}

export function wynnGateShape(way, points, heights) {
  if (way.id !== 1043470556 || points.length < 4) return { pts: points, y: heights };
  // Two mapped nodes less than a metre apart introduce a reverse segment
  // when offset by the full four-lane approach. Keep the node at the crossing.
  const keep = points.map((p, i) => i === 0 || i >= points.length - 2 || Math.hypot(p[0] - points[i + 1][0], p[1] - points[i + 1][1]) >= 1);
  return { pts: points.filter((_, i) => keep[i]), y: heights.filter((_, i) => keep[i]) };
}

const wynnCrossings = new Map([
  ['Wynn Main Gate Drive', [1269039870, 1269039902]],
  ['Fashion Show Drive', [5255307397]],
  ['South Las Vegas Boulevard', [[5255307353, 5255307354], [5255307364, 5255307374]]],
]);

export function wynnCrossingIds(leg) {
  const name = leg.entries[0]?.e.way.name;
  const ids = wynnCrossings.get(name);
  return name === stripName ? ids[leg.a[1] < 0 ? 0 : 1] : ids;
}

const gateCoordinates = (x, z) => {
  const dx = x - wynnGate[0], dz = z - wynnGate[1];
  return [gateCos * dx + gateSin * dz, -gateSin * dx + gateCos * dz];
};

export function inWynnGateThroat(x, z) {
  const [u, v] = gateCoordinates(x, z);
  return u >= 12 && u <= 54 && Math.abs(v) < 8;
}

export const isWynnGateMedian = area => area.k === 'park' && area.pts.every(([x, z]) => inWynnGateThroat(x, z));

export function isWynnGateSplit(center, legs) {
  const [u, v] = gateCoordinates(...center);
  return u > 45 && u < 80 && Math.abs(v) < 20 && legs.length === 2 &&
    legs.every(leg => leg.entries.every(({ e }) => e.way.name === 'Wynn Main Gate Drive'));
}

// Fill minor seams between the two driveways around the mapped refuge island.
// The finishing pass subtracts the real lanes, refuge, and adjoining sidewalks.
export const WYNN_GATE_APRON = [[14, -1.5], [21, -4.3], [51, -5.6], [51, 5.1], [23, 5], [14, 2.6]]
  .map(([u, v]) => [wynnGate[0] + u * gateCos - v * gateSin, wynnGate[1] + u * gateSin + v * gateCos]);

function edgeMidpoint(edge) {
  const [x0, z0] = edge.ref.pts[0];
  const [x1, z1] = edge.ref.pts.at(-1);
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}

export function isStripEdge(edge) {
  if (edge.internal || edge.elevated || edge.way.name !== stripName) return false;
  const z = edgeMidpoint(edge)[1];
  return z <= path[0][1] + 235 && z >= path.at(-1)[1];
}

export function hasPavedStripMedian(edge, x, z) {
  const name = edge.way.name;
  if (name === 'East Flamingo Road' || name === 'West Flamingo Road') return Math.hypot(x - flamingo[0], z - flamingo[1]) < 145;
  if (name === 'Sands Avenue' || name === 'Spring Mountain Road') return Math.hypot(x - sands[0], z - sands[1]) < 150;
  // Keep S Las Vegas Blvd medians continuously landscaped right up to their
  // smoothly rounded curbed noses instead of abruptly slamming into flat gray wedges.
  return false;
}

// The southwest Sands turn is mapped as a separate path, but the aerial view
// shows a continuous paved corner with one outer curb beside the Palazzo.
export const flushStripCorner = edge => edge.way.id === 277512381 ? sands : undefined;

// Dedicated median-crossing dual left-turn links at MGM Road / Bruno Mars Drive.
const MGM_LEFT_LINKS = new Set([277512377, 277512378, 1123959362]);
export const isStripChannelizedLeft = edge => MGM_LEFT_LINKS.has(edge.way.id);

// Landscaped median envelopes bracketing the MGM / Bruno Mars diagonal left-turn bays;
// the Strip corridor CSG pass carves out the exact drivable lanes and rounds acute gore tips.
export const MGM_CHANNELIZED_ISLANDS = [
  [[133.0, 1264], [151.0, 1264], [151.0, 1367], [133.0, 1367]],
  [[132.0, 1385], [151.0, 1385], [151.0, 1494], [132.0, 1494]],
];

// Underlying asphalt apron across the MGM / Bruno Mars median zone so rounded
// island noses and intersection throats never expose hollow base-map voids.
export const MGM_CHANNELIZED_APRONS = [
  [[130.0, 1263], [153.5, 1263], [153.5, 1495], [130.0, 1495]],
];

function collectSlipLanes(graph, junctionRoads) {
  const { edges, nodes } = graph;
  const isLink = e => e.oneway && !e.elevated && !e.internal && e.way.hw === 'primary_link';
  const dirEnd = (edge, atStart) => {
    const pts = edge.ref.pts;
    const a = atStart ? pts[0] : pts[pts.length - 2];
    const b = atStart ? pts[1] : pts[pts.length - 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    return [dx / L, dz / L];
  };
  const chains = [];
  for (const edge of edges) {
    if (!isLink(edge)) continue;
    const [x, z] = edgeMidpoint(edge);
    const nearby = [...junctionRoads].filter(([[cx, cz]]) => Math.hypot(x - cx, z - cz) < 85);
    if (!nearby.length) continue;
    const inbound = nodes.get(edge.fromNode).inEdges.map(i => edges[i]);
    if (inbound.some(isLink)) continue;
    const chain = [edge];
    let length = edge.ref.length;
    let outgoing = nodes.get(edge.toNode).outEdges.map(i => edges[i]);
    while (outgoing.length === 1 && isLink(outgoing[0]) && !chain.includes(outgoing[0]) && length < 130) {
      const next = outgoing[0];
      chain.push(next);
      length += next.ref.length;
      outgoing = nodes.get(next.toNode).outEdges.map(i => edges[i]);
    }
    if (length < 18 || length > 130) continue;
    const [a, b] = edge.ref.pts;
    const [c, d] = chain.at(-1).ref.pts.slice(-2);
    const turn = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
    if (turn <= 0) continue;
    const attached = nearby.some(([, names]) => inbound.some(inE =>
      inE.cls === 'arterial' && names.has(inE.way.name) && outgoing.some(outE => {
        if (outE.cls !== 'arterial' || !names.has(outE.way.name) || inE.way.name === outE.way.name) return false;
        if (inE.way.name !== stripName && outE.way.name !== stripName) return false;
        const [ahx, ahz] = dirEnd(inE, false);
        const [bhx, bhz] = dirEnd(outE, true);
        return ahx * bhz - ahz * bhx > 0.25;
      })));
    if (attached) chains.push(chain);
  }
  return chains;
}

export function planStripStreets(graph, plan) {
  const approaches = new Set(graph.edges.filter(isStripEdge).map(e => e.id));
  const centers = new Set(plan.legs.filter(leg => leg.entries.some(({ e }) => approaches.has(e.id))).map(leg => leg.ctr));
  const junctionRoads = new Map();
  const junctions = new Set();
  const includeApproach = (edge, outgoing) => {
    let current = edge;
    let length = 0;
    while (current && length < 145 && current.way.name === edge.way.name && current.ref.length <= 225 &&
      !current.elevated && !current.internal && (current.cls === 'arterial' || current.cls === 'collector')) {
      approaches.add(current.id);
      length += current.ref.length;
      current = graph.edges[outgoing ? current.next : current.prev];
    }
  };
  for (const leg of plan.legs) {
    if (!centers.has(leg.ctr)) continue;
    if (!junctionRoads.has(leg.ctr)) junctionRoads.set(leg.ctr, new Set());
    const names = junctionRoads.get(leg.ctr);
    for (const { e, node, atStart } of leg.entries) {
      if (e.way.name && e.cls === 'arterial') names.add(e.way.name);
      includeApproach(e, atStart);
      const junction = plan.intersectionAt(node);
      if (junction) junctions.add(junction.id);
    }
  }
  const slips = collectSlipLanes(graph, junctionRoads);
  for (const chain of slips) for (const edge of chain) approaches.add(edge.id);
  return { approaches, junctions, slips };
}
