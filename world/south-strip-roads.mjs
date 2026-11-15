// The first review runs from Four Seasons Drive to the Reno Avenue approaches.
export const SOUTH_STRIP_BOUNDS = [-167, 1980, 320, 3060];
const [west, north, east, south] = SOUTH_STRIP_BOUNDS;

export function inSouthStrip(x, z, margin = 0) {
  return x >= west - margin && x <= east + margin && z >= north - margin && z <= south + margin;
}

export function isSouthStripRoad(way) {
  return !way.br && !way.tn && !way.hw.startsWith('motorway') && !way.hw.startsWith('trunk') &&
    (way.name === 'South Las Vegas Boulevard' ||
      way.pts.every(([x, z]) => inSouthStrip(x, z, 24))) &&
    way.pts.some(([x, z]) => inSouthStrip(x, z)) &&
    (way.name || way.hw === 'service' || way.hw.endsWith('_link'));
}

// Fillet each bend within the mapped road. Preserve graph nodes at the ends
// of each edge and cap the inward displacement at about half a metre.
export function roundSouthStripRoad(points, heights, closed = false) {
  const n = points.length;
  const pts = closed ? [] : [points[0]], y = closed ? [] : [heights[0]];
  for (let i = closed ? 0 : 1; i < n - (closed ? 0 : 1); i++) {
    const prev = (i + n - 1) % n, next = (i + 1) % n;
    const a = points[prev], b = points[i], c = points[next];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (ab < 0.6 || bc < 0.6) {
      pts.push(b);
      y.push(heights[i]);
      continue;
    }
    const ux = (b[0] - a[0]) / ab, uz = (b[1] - a[1]) / ab;
    const vx = (c[0] - b[0]) / bc, vz = (c[1] - b[1]) / bc;
    const dot = ux * vx + uz * vz;
    if (dot > 0.999 || dot < -0.3) {
      pts.push(b);
      y.push(heights[i]);
      continue;
    }
    const reach = Math.min(ab * 0.46, bc * 0.46, 9, 2.2 / Math.hypot(ux - vx, uz - vz));
    const y0 = heights[i] + (heights[prev] - heights[i]) * reach / ab;
    const y2 = heights[i] + (heights[next] - heights[i]) * reach / bc;
    const count = Math.max(4, Math.ceil(reach * 2));
    for (let j = 0; j <= count; j++) {
      const t = j / count, u = 1 - t;
      pts.push([b[0] + reach * (vx * t * t - ux * u * u), b[1] + reach * (vz * t * t - uz * u * u)]);
      y.push(u * u * y0 + 2 * u * t * heights[i] + t * t * y2);
    }
  }
  if (!closed) {
    pts.push(points.at(-1));
    y.push(heights.at(-1));
  }
  return { pts, y };
}

const signalCrossings = new Map([
  [137320725, [[6222356686, 6222356687], [6222356685, 5780529931], [4022852829, 4022852781], [6222356688]]],
  [137333115, [[13009110057, 13009110056], [6222356692, 6222356691], [4021063603, 4022928455], [6222356694, 6222356695]]],
  [137492737, [[13009110060, 13009110059], [6139611139, 5780529962], [13009110062, 13009110061], [13009110063]]],
]);

// These short ways carry legal turn movements across the median or between
// split approach nodes. They are movements inside the parent road.
const internalTurns = new Set([399559948, 399559949, 1383403543, 1383403544, 1016851854]);
export const isSouthStripTurn = edge => internalTurns.has(edge.way.id);

// These are channelized openings and merges on the Strip. Keep the asphalt
// between them the width of the through carriageways and legal turn paths.
const medianOpeningNodes = new Set([5681949512, 5681949513, 4022854266, 4022928037, 4022928040, 5509252050, 5509252039]);
export function isSouthStripMedianOpening(legs) {
  return legs.some(leg => leg.entries.some(({ node }) => medianOpeningNodes.has(node)));
}
export function isSouthStripMedianOpeningLane(edge) {
  return edge.way.name === 'South Las Vegas Boulevard' || edge.way.id === 596463688;
}
export function isMandalayLaneFan(nodes) {
  return nodes.includes(9515639255);
}

const valetEntranceLanes = new Map([
  [29710112, 2], // Luxor entry from Las Vegas Boulevard
  [1419276035, 2], [1120041273, 2], [1419276037, 2], // Luxor porte-cochère
]);
export function southStripLaneCount(way) {
  return valetEntranceLanes.get(way.id);
}

export function isSouthStripMedian(area) {
  return area.k === 'park' && area.pts.every(([x, z]) => x > 135 && x < 159 && inSouthStrip(x, z));
}

// Surveyed curb widths are unavailable. These are mapped crossing center points
// in the local OSM snapshot, checked against the Google and Apple map views.
export function alignSouthStripCrossing(leg, members, crossings, offset) {
  const anchor = members.find(id => signalCrossings.has(id));
  if (anchor === undefined) return false;
  const [ax, az] = leg.a;
  const axis = Math.abs(ax) > Math.abs(az) ? [Math.sign(ax), 0] : [0, Math.sign(az)];
  const arm = axis[1] < 0 ? 0 : axis[1] > 0 ? 1 : axis[0] < 0 ? 2 : 3;
  const points = signalCrossings.get(anchor)[arm].map(id => crossings.get(id));
  if (points.some(point => !point)) return false;
  const [a, b] = points;
  let normal = axis;
  if (b) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    const sign = dz * axis[0] - dx * axis[1] > 0 ? 1 : -1;
    normal = [sign * dz / length, -sign * dx / length];
  }
  const x = b ? (a.x + b.x) / 2 : a.x, z = b ? (a.z + b.z) / 2 : a.z;
  leg.a = normal;
  leg.perp = [-normal[1], normal[0]];
  leg.d = (x - leg.ctr[0]) * normal[0] + (z - leg.ctr[1]) * normal[1] - offset;
  return true;
}

// Trace the outer corners from the ends of the lane rims at each arm.
export function junctionOutline(mouths, center) {
  const arms = mouths.map(({dir, pts}) => {
    const side = p => (p[1] - center[1]) * dir[0] - (p[0] - center[0]) * dir[1];
    const ends = pts.slice().sort((a, b) => side(a) - side(b));
    return { dir, low: ends[0], high: ends.at(-1) };
  });
  arms.sort((a, b) => Math.atan2(a.dir[1], a.dir[0]) - Math.atan2(b.dir[1], b.dir[0]));
  const ring = [];
  for (let i = 0; i < arms.length; i++) {
    const { dir: a, low, high } = arms[i];
    const { dir: b, low: next } = arms[(i + 1) % arms.length];
    ring.push(low, high);
    const cross = a[0] * b[1] - a[1] * b[0];
    if (cross < 0.3) continue;
    const dx = next[0] - high[0], dz = next[1] - high[1];
    const d = (dx * b[1] - dz * b[0]) / cross;
    const e = (dx * a[1] - dz * a[0]) / cross;
    if (d >= -0.1 || e <= 0.1 || d < -45 || e > 45) continue;
    const corner = [high[0] + a[0] * d, high[1] + a[1] * d];
    for (let k = 1; k < 12; k++) {
      const t = k / 12, u = 1 - t;
      ring.push([
        u * u * high[0] + 2 * u * t * corner[0] + t * t * next[0],
        u * u * high[1] + 2 * u * t * corner[1] + t * t * next[1],
      ]);
    }
  }
  return ring;
}
