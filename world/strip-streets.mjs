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
const flamingo = toLocal(36.11468, -115.17288);
const tropicana = toLocal(36.10086, -115.17296);

function edgeMidpoint(edge) {
  const [x0, z0] = edge.ref.pts[0];
  const [x1, z1] = edge.ref.pts.at(-1);
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}

export function isStripEdge(edge) {
  if (edge.internal || edge.elevated || edge.way.name !== stripName) return false;
  const z = edgeMidpoint(edge)[1];
  return z <= path[0][1] && z >= path.at(-1)[1];
}

export function hasPavedStripMedian(edge) {
  if (!isStripEdge(edge)) return false;
  const [x, z] = edgeMidpoint(edge);
  // The two reference views show unplanted median noses on these approaches.
  return Math.hypot(x - tropicana[0], z - tropicana[1]) < 85 ||
    z < flamingo[1] && Math.hypot(x - flamingo[0], z - flamingo[1]) < 155;
}

function collectSlipLanes(graph, junctionRoads) {
  const { edges, nodes } = graph;
  const isLink = e => e.oneway && !e.elevated && !e.internal && e.way.hw === 'primary_link';
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
    while (outgoing.length === 1 && isLink(outgoing[0]) && !chain.includes(outgoing[0]) && length < 105) {
      const next = outgoing[0];
      chain.push(next);
      length += next.ref.length;
      outgoing = nodes.get(next.toNode).outEdges.map(i => edges[i]);
    }
    if (length < 18 || length > 105) continue;
    const [a, b] = edge.ref.pts;
    const [c, d] = chain.at(-1).ref.pts.slice(-2);
    const turn = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
    if (turn <= 0) continue;
    const attached = nearby.some(([, names]) => inbound.some(a =>
      a.cls === 'arterial' && names.has(a.way.name) && outgoing.some(b =>
        b.cls === 'arterial' && names.has(b.way.name) && a.way.name !== b.way.name &&
        (a.way.name === stripName || b.way.name === stripName))));
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
