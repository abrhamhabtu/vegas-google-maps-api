import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { arrowMarking, dashRuns, zebraBars } from './road-visuals.mjs';
import { finishCaesarsDrivePavement } from './caesars-drive-roads.mjs';
import { finishCosmoDrivePavement } from './cosmo-drive-roads.mjs';
import { finishAriaDrivePavement } from './aria-drive-roads.mjs';
import { finishWynnEncoreDrivePavement } from './wynn-encore-drive-roads.mjs';
import { finishVenetianPalazzoDrivePavement } from './venetian-palazzo-drive-roads.mjs';

// W Bellagio Drive, Bellagio Roundabout & Porte-Cochere Forecourt,
// Underground Valet/Underpass Portals, Landscaped Hillside & Pedestrian Bridge.
// Local coordinates in metres: x east, y up, z south.

export const BELLAGIO_DRIVE_BOUNDS = [-86.0, 426.0, 122.0, 608.0];

// All surface Bellagio Drive, roundabout, porte-cochere & Cosmopolitan driveway ways that
// OSM/solveRoadElevations wrongly lifted into floating decks. In real life the entire surface
// Bellagio front drive (roundabout, porte-cochere, forks and Strip approach) sits smoothly at
// ground level (y = 0) while the two tunnel branches dive beneath it.
export const BELLAGIO_GROUND_WAYS = new Set([
  14293119, 25718280, 25718284, 25718286, 311030162, 311030164, 311030165, 311030166,
  374989475, 668997704, 789033146, 789702331,
  789702807, 789702808, 789702809, 789702810, 789702811, 789702812, 789702813,
  1014282285, 1030067966, 1035078204, 1035080512, 1035080513,
  1041357122, 1043465694, 1050182643, 1234768417, 1419075073, 1436542129, 218654263,
]);

// Claim the 4 duplicate OSM building footprints along the Bellagio-Cosmopolitan pedestrian bridge
// so generic buildBuildings never extrudes a dark-blue shell right through our bespoke skybridge.
export function claimBellagioBridgeBuildings(data, ownedSet) {
  for (const b of data.buildings) {
    if (b.name) continue;
    const pts = b.pts;
    if (!pts?.length) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    // Bridge span building (h ~ 7) and the three square pavilion buildings (h ~ 5)
    if (b.h <= 9 && minX >= -56 && maxX <= 106 && minZ >= 546 && maxZ <= 620) {
      ownedSet.add(b);
    }
  }
}

// Underground passage & ramp ways passing beneath W Bellagio Dr / hillside.
const BELLAGIO_UNDERPASS_WAYS = new Set([374989476, 1002539039, 1002539038, 1002539040]);
const BELLAGIO_RAMP_DOWN_WAYS = new Map([
  [25718279, [0, -4.2]],  // South tunnel approach -> Portal #2 at (3.9, 546.3)
  [789702330, [0, -4.2]], // Middle tunnel approach -> Portal #1 at (-9.1, 532.6)
  [374989477, [-4.2, 0]], // West exit emerging past W Bellagio Dr toward Cosmopolitan garage
]);

// Footways replaced by our bespoke Bellagio-Cosmopolitan pedestrian bridge (plus bogus sidewalk bridges).
const BELLAGIO_REPLACED_WALKS = new Set([
  25724477, 116614678, 116952973,
  1419075080, 1419075081, 1419075082,
  1436769052, 1436769053, 1436769054, 1436769055, 1436769056,
]);

export function isBellagioSkybridgeWalk(walk) {
  return BELLAGIO_REPLACED_WALKS.has(walk.id);
}

// Override way elevations for lanegraph.js so AVs follow smooth ground-level Bellagio Drive,
// roundabout and porte-cochere while underground ramps stay separated vertically (> LEVEL_GAP = 3 m).
export function bellagioWayHeights(way) {
  if (BELLAGIO_GROUND_WAYS.has(way.id)) {
    return way.pts.map(() => 0);
  }
  if (BELLAGIO_UNDERPASS_WAYS.has(way.id)) {
    return way.pts.map(() => -4.2);
  }
  const ramp = BELLAGIO_RAMP_DOWN_WAYS.get(way.id);
  if (ramp) {
    const [y0, y1] = ramp;
    const n = way.pts.length;
    if (n <= 1) return [y0];
    const cum = [0];
    for (let i = 1; i < n; i++) {
      cum.push(cum[i - 1] + Math.hypot(way.pts[i][0] - way.pts[i - 1][0], way.pts[i][1] - way.pts[i - 1][1]));
    }
    const total = cum[n - 1] || 1;
    return cum.map(d => {
      const t = d / total;
      const ease = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * ease;
    });
  }
  return null;
}

export function isBellagioFlattenedBridge(way) {
  return BELLAGIO_GROUND_WAYS.has(way.id) || BELLAGIO_UNDERPASS_WAYS.has(way.id) || BELLAGIO_RAMP_DOWN_WAYS.has(way.id);
}

// ───────────────────────── Clipper & Polyline Helpers ─────────────────────────

const MM = 1000;
const pt = (x, z) => ({ X: Math.round(x * MM), Y: Math.round(z * MM) });
const { ctUnion, ctIntersection, ctDifference } = clipper.ClipType;
const { ptSubject, ptClip } = clipper.PolyType;
const { pftNonZero } = clipper.PolyFillType;

function toClipRing(ring) {
  const out = ring.map(([x, z]) => pt(x, z));
  if (clipper.Clipper.Area(out) < 0) out.reverse();
  return out;
}

function fromClipRing(path) {
  return path.map(({ X, Y }) => [X / MM, Y / MM]);
}

function clipOp(op, subject, cutters = []) {
  if (!subject.length) return [];
  const out = new clipper.PolyTree();
  const kernel = new clipper.Clipper();
  kernel.AddPaths(subject, ptSubject, true);
  if (cutters.length) kernel.AddPaths(cutters, ptClip, true);
  kernel.Execute(op, out, pftNonZero, pftNonZero);
  return clipper.JS.PolyTreeToExPolygons(out);
}

function exToPaths(polys) {
  return polys.flatMap(({ outer, holes }) => [outer, ...holes]);
}

function offsetPaths(paths, delta, joinType = clipper.JoinType.jtRound) {
  if (!paths.length) return [];
  const out = new clipper.Paths();
  const co = new clipper.ClipperOffset(2.0, 12.0);
  co.AddPaths(paths, joinType, clipper.EndType.etClosedPolygon);
  co.Execute(out, delta * MM);
  return out;
}

function roundCorners(paths, radius) {
  return offsetPaths(offsetPaths(paths, -radius), radius);
}

function smoothPoly(pts, stepsPerSeg = 6) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 1; k <= stepsPerSeg; k++) {
      const t = k / stepsPerSeg, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const z = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, z]);
    }
  }
  return out;
}

function polyCum(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return cum;
}

function samplePoly(pts, cum, d) {
  const len = cum[cum.length - 1];
  const s = Math.max(0, Math.min(len, d));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < s) i++;
  const span = cum[i + 1] - cum[i] || 1;
  const t = (s - cum[i]) / span;
  const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
  const seg = Math.hypot(dx, dz) || 1;
  return {
    x: pts[i][0] + dx * t,
    z: pts[i][1] + dz * t,
    hx: dx / seg,
    hz: dz / seg,
  };
}

function offsetPoly(pts, offsetFn) {
  const cum = polyCum(pts);
  const len = cum[cum.length - 1] || 1;
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const seg = Math.hypot(dx, dz) || 1;
    const nx = -dz / seg, nz = dx / seg; // right normal in (x east, z south)
    const off = typeof offsetFn === 'function' ? offsetFn(cum[i] / len, cum[i]) : offsetFn;
    out.push([pts[i][0] + nx * off, pts[i][1] + nz * off]);
  }
  return out;
}

function stripBetween(leftPts, rightPts) {
  return [...leftPts, ...rightPts.slice().reverse()];
}

function ribbonRing(pts, halfW) {
  if (pts.length < 2) return [];
  return stripBetween(offsetPoly(pts, -halfW), offsetPoly(pts, halfW));
}

function slicePoly(pts, cum, s0, s1) {
  const len = cum[cum.length - 1];
  const a = Math.max(0, Math.min(len, s0));
  const b = Math.max(a, Math.min(len, s1));
  if (b - a < 0.05) return [];
  const p0 = samplePoly(pts, cum, a);
  const out = [[p0.x, p0.z]];
  for (let i = 1; i < pts.length - 1; i++) {
    if (cum[i] > a + 0.02 && cum[i] < b - 0.02) out.push(pts[i]);
  }
  const p1 = samplePoly(pts, cum, b);
  out.push([p1.x, p1.z]);
  return out;
}

function circleRing(cx, cz, r, steps = 48) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
}

function emitPolygons(layer, polys, y, minArea = 0.02) {
  for (const { outer, holes } of polys) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minArea * MM * MM) continue;
    const ring = fromClipRing(outer);
    const [x, z] = ring[0];
    layer.at(x, z).polygon(ring, y, holes.map(fromClipRing));
  }
}

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function nearBoundary(mx, mz, boundaryRing, eps = 0.28) {
  for (let i = 0; i < boundaryRing.length; i++) {
    const [ax, az] = boundaryRing[i];
    const [bx, bz] = boundaryRing[(i + 1) % boundaryRing.length];
    if (distToSeg(mx, mz, ax, az, bx, bz) <= eps) return true;
  }
  return false;
}

function emitCurbFaces(curbFaces, paths, y0 = 0, y1 = 0.17, skipBoundary = null) {
  for (const path of paths) {
    const ring = fromClipRing(path);
    const n = ring.length;
    if (n < 3) continue;
    const soup = curbFaces.at(ring[0][0], ring[0][1]);
    for (let i = 0; i < n; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % n];
      if (Math.hypot(bx - ax, bz - az) < 0.02) continue;
      if (skipBoundary && nearBoundary((ax + bx) * 0.5, (az + bz) * 0.5, skipBoundary)) continue;
      const v0 = soup.vert(ax, y0, az);
      const v1 = soup.vert(bx, y0, bz);
      const v2 = soup.vert(bx, y1, bz);
      const v3 = soup.vert(ax, y1, az);
      soup.idx.push(v0, v1, v2, v0, v2, v3, v0, v2, v1, v0, v3, v2);
    }
  }
}

function arrowPolysWorld(cx, cz, hx, hz, movements, laneW = 3.2) {
  const nx = -hz, nz = hx;
  return arrowMarking(movements, laneW).map(poly =>
    toClipRing(poly.map(([u, v]) => [cx + nx * u + hx * v, cz + nz * u + hz * v]))
  );
}

// Crisp vector polygon strokes for pavement "ONLY" text (oriented facing oncoming driver).
function onlyTextPolys(cx, cz, hx, hz, scale = 0.58) {
  const strokes = {
    O: [[[-0.32, 0.78], [0.32, 0.78], [0.32, -0.78], [-0.32, -0.78], [-0.32, 0.78]]],
    N: [[[-0.32, -0.78], [-0.32, 0.78], [0.32, -0.78], [0.32, 0.78]]],
    L: [[[-0.30, 0.78], [-0.30, -0.78], [0.32, -0.78]]],
    Y: [[[-0.34, 0.78], [0, 0.05], [0.34, 0.78]], [[0, 0.05], [0, -0.78]]],
  };
  const nx = -hz, nz = hx;
  const letters = ['O', 'N', 'L', 'Y'];
  const spacing = 0.92 * scale;
  const startU = -((letters.length - 1) * spacing) / 2;
  const polys = [];
  for (let i = 0; i < letters.length; i++) {
    const uOff = startU + i * spacing;
    for (const line of strokes[letters[i]]) {
      const worldPts = line.map(([u, v]) => {
        const uu = uOff + u * scale;
        const vv = v * scale * 1.15;
        return [cx + nx * uu + hx * vv, cz + nz * uu + hz * vv];
      });
      const r = ribbonRing(worldPts, 0.095 * scale);
      if (r.length >= 3) polys.push(toClipRing(r));
    }
  }
  return polys;
}

// Build chevron-hatched painted gore triangle between two diverging edge polylines.
function buildChevronGore(edgeA, edgeB, stripeSpacing = 2.6, halfW = 0.085) {
  const polys = [];
  const addLine = pts => {
    const r = ribbonRing(pts, halfW);
    if (r.length >= 3) polys.push(toClipRing(r));
  };
  addLine(edgeA);
  addLine(edgeB);
  const cumA = polyCum(edgeA), cumB = polyCum(edgeB);
  const lenA = cumA[cumA.length - 1], lenB = cumB[cumB.length - 1];
  const steps = Math.max(2, Math.floor(Math.min(lenA, lenB) / stripeSpacing));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const pA = samplePoly(edgeA, cumA, t * lenA);
    const pB = samplePoly(edgeB, cumB, t * lenB);
    const tipT = Math.min(1, t + 0.09);
    const mA = samplePoly(edgeA, cumA, tipT * lenA);
    const mB = samplePoly(edgeB, cumB, tipT * lenB);
    const mid = [(mA.x + mB.x) * 0.5, (mA.z + mB.z) * 0.5];
    if (Math.hypot(pA.x - pB.x, pA.z - pB.z) < 0.7) continue;
    addLine([[pA.x, pA.z], mid, [pB.x, pB.z]]);
  }
  return polys;
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function clearLayerInPoly(layer, bounds, clipSection, clipPoly) {
  const [west, north, east, south] = bounds;
  const size = layer.size || 1400;
  for (const [key, soup] of layer.m.entries()) {
    const comma = key.indexOf(',');
    if (comma > 0) {
      const cx = Number(key.slice(0, comma)) * size;
      const cz = Number(key.slice(comma + 1)) * size;
      if (cx + size + 500 < west || cx - 500 > east || cz + size + 500 < north || cz - 500 > south) continue;
    }
    const { pos, idx } = soup;
    const keep = [];
    const outside = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const x0 = pos[a], x1 = pos[b], x2 = pos[c];
      const z0 = pos[a + 2], z1 = pos[b + 2], z2 = pos[c + 2];
      const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
      const minZ = Math.min(z0, z1, z2), maxZ = Math.max(z0, z1, z2);
      if (maxX <= west || minX >= east || maxZ <= north || minZ >= south) {
        keep.push(idx[i], idx[i + 1], idx[i + 2]);
        continue;
      }
      const y = pos[a + 1];
      const flat = Math.abs(y - pos[b + 1]) < 1e-4 && Math.abs(y - pos[c + 1]) < 1e-4;
      if (!flat) {
        const mx = (x0 + x1 + x2) / 3, mz = (z0 + z1 + z2) / 3;
        if (pointInRing(mx, mz, clipPoly)) continue;
        keep.push(idx[i], idx[i + 1], idx[i + 2]);
        continue;
      }
      const ring = [pt(x0, z0), pt(x1, z1), pt(x2, z2)];
      const area = clipper.Clipper.Area(ring);
      if (Math.abs(area) < 1) continue;
      if (area < 0) ring.reverse();
      const diff = clipOp(ctDifference, [ring], clipSection);
      if (diff.length) outside.push([diff, y]);
    }
    soup.idx = keep;
    for (const [polys, y] of outside) {
      for (const { outer, holes } of polys) {
        if (Math.abs(clipper.Clipper.Area(outer)) < 1) continue;
        soup.polygon(fromClipRing(outer), y, holes.map(fromClipRing));
      }
    }
  }
}

// ───────────────────────── Shared Geometry Constants (used by pavement + 3D + tests) ─────────────────────────

// Precise clip polygon covering the entire Bellagio front drive (north roundabout,
// porte-cochere forecourt, hillside forks, tunnel approaches, garage exit & Strip junction),
// staying strictly west of South Las Vegas Blvd (x <= 121.8), west/south of Bellagio Fountains Lake,
// and east of the Bellagio podium & Self Parking Garage wall.
export const BELLAGIO_CLIP_POLY = [
  [-85.0, 456.0],
  [-74.0, 437.0],
  [-56.0, 427.5],
  [-34.0, 426.5],
  [-21.0, 432.0],
  [-12.5, 444.0],
  [-6.8, 460.0],
  [1.2, 480.0],
  [12.5, 500.0],
  [29.5, 520.0],
  [44.5, 533.0],
  [60.0, 541.5],
  [85.0, 543.2],
  [101.0, 541.8],
  [111.5, 533.2],
  [121.8, 531.5],
  [121.8, 607.5],
  [104.0, 604.5],
  [58.0, 597.5],
  [36.0, 599.5],
  [16.0, 606.5],
  [8.0, 601.5],
  [14.0, 588.5],
  [-15.5, 588.5],
  [-22.5, 581.0],
  [-24.0, 562.0],
  [-54.5, 546.5],
  [-54.5, 531.0],
  [-53.0, 530.5],
  [-53.0, 515.0],
  [-79.0, 512.0],
  [-85.0, 494.0],
];

// Landscaped island & median polygons (traced to <0.4 m against Google Satellite & Road layer).
export const BELLAGIO_ISLAND_SPECS = {
  // Iconic oval roundabout garden & fountain court in front of Bellagio porte-cochere
  roundaboutGarden: [
    [-50.4, 455.0],
    [-48.0, 446.5],
    [-43.2, 442.0],
    [-36.5, 440.8],
    [-29.2, 442.0],
    [-22.5, 447.5],
    [-18.0, 457.0],
    [-13.5, 471.0],
    [-9.0, 486.0],
    [-11.5, 496.5],
    [-19.5, 506.0],
    [-28.5, 511.5],
    [-36.5, 510.5],
    [-44.5, 503.5],
    [-48.8, 492.0],
    [-50.0, 475.0],
  ],
  // Slender curbed separator island between NW outer taxi curve & inner arrival lanes
  taxiSeparator: [
    [-58.5, 441.8],
    [-66.5, 447.5],
    [-70.5, 455.2],
    [-68.6, 456.0],
    [-64.5, 449.2],
    [-57.0, 443.4],
  ],
  // Landscaped hillside berm between turn-back loop, Lakeside Drive, Tunnel #1 & EB W Bellagio Dr
  northHillsideBerm: [
    [-26.0, 523.5],
    [-10.5, 507.5],
    [-7.5, 496.0],
    [0.5, 500.5],
    [10.5, 513.5],
    [19.5, 524.0],
    [16.0, 526.2],
    [4.0, 526.8],
    [-11.0, 529.8],
    [-18.5, 529.5],
  ],
  // Narrow landscaped teardrop between Tunnel #1 and Tunnel #2
  tunnelForkIsland: [
    [-2.5, 535.4],
    [13.5, 532.8],
    [24.5, 533.8],
    [29.5, 536.8],
    [23.0, 539.2],
    [11.5, 539.8],
    [0.5, 541.5],
  ],
  // Lush green teardrop island between Tunnel #2, Return-to-Bellagio crossover & EB W Bellagio Dr
  westTeardropIsland: [
    [13.5, 549.2],
    [32.0, 546.8],
    [48.5, 549.0],
    [54.2, 557.5],
    [49.0, 570.8],
    [35.5, 567.2],
    [21.5, 560.2],
  ],
  // East center median between WB Bellagio Dr, Return-to-Bellagio crossover & EB 3-Left lanes
  eastCenterMedian: [
    [64.5, 557.2],
    [86.0, 559.8],
    [109.5, 562.2],
    [112.2, 565.5],
    [112.0, 570.5],
    [108.5, 572.4],
    [85.0, 573.8],
    [60.8, 574.0],
  ],
  // Concrete splitter / pedestrian refuge island between EB 3-Left and EB 2-Right lanes
  ebSplitter: [
    [104.5, 583.6],
    [116.8, 583.0],
    [117.2, 588.6],
    [105.0, 586.8],
  ],
  // Concrete pedestrian refuge island between SB LV Blvd right-turn slip & WB Bellagio Dr
  wbSlipIsland: [
    [104.5, 549.8],
    [113.8, 548.1],
    [114.0, 551.8],
  ],
};

// ───────────────────────── Main Bellagio Drive Builder ─────────────────────────

export function finishBellagioDrivePavement(layers) {
  const { major, asphalt, service, slipPavement, sidewalk, concreteMedians, medians,
    medianPaving, medianPlanting, frontagePlanting, curb, curbFaces, paint, paintDim, paintYellow } = layers;

  const clipSection = [toClipRing(BELLAGIO_CLIP_POLY)];

  for (const layer of [major, asphalt, service, slipPavement, sidewalk, concreteMedians, medians,
    medianPaving, medianPlanting, frontagePlanting, curb, curbFaces, paint, paintDim, paintYellow]) {
    if (layer) clearLayerInPoly(layer, BELLAGIO_DRIVE_BOUNDS, clipSection, BELLAGIO_CLIP_POLY);
  }

  // ── 1. SMOOTH CARRIAGEWAY CENTERLINES (extended past clip edges so open road mouths never get end-cap curbs) ──

  // A) Eastbound W Bellagio Dr main stem: porte-cochere exit -> 3 lanes -> 4 lanes -> 5 lanes -> 3 Left-Turn ONLY lanes
  const ebMainCenter = smoothPoly([
    [-55.0, 504.0],
    [-49.0, 508.1],
    [-41.0, 514.5],
    [-31.1, 522.9],
    [-13.5, 542.2],
    [-10.4, 546.1],
    [1.4, 557.5],
    [6.7, 561.3],
    [15.3, 567.5],
    [32.7, 574.7],
    [53.8, 581.2],
    [59.5, 580.3],
    [76.0, 579.8],
    [93.7, 579.4],
    [111.3, 578.2],
    [116.8, 577.8],
    [125.5, 577.0],
  ], 5);
  const ebMainCum = polyCum(ebMainCenter);
  const ebMainLen = ebMainCum[ebMainCum.length - 1];

  // Width profile along ebMainCenter matching OSM/AV lanes & Google Satellite:
  // 3 lanes (9.9 m) from porte-cochere to x=-12 -> 4 lanes (13.2 m) across underpass ->
  // 5 lanes (16.5 m) at x=25..58 -> 3 Left-Turn ONLY lanes (10.0 m) at x=62..125
  const ebLeftOff = (_t, s) => {
    const p = samplePoly(ebMainCenter, ebMainCum, s);
    if (p.x < -12) return -5.0;
    if (p.x < 12) return -5.0 - 1.65 * Math.max(0, Math.min(1, (p.x + 12) / 24));
    if (p.x < 54) return -6.65 - 1.6 * Math.max(0, Math.min(1, (p.x - 12) / 36));
    if (p.x < 64) return -8.25 + 3.2 * Math.max(0, Math.min(1, (p.x - 54) / 10));
    return -5.05;
  };
  const ebRightOff = (_t, s) => {
    const p = samplePoly(ebMainCenter, ebMainCum, s);
    if (p.x < -12) return 5.35;
    if (p.x < 12) return 5.35 + 1.3 * Math.max(0, Math.min(1, (p.x + 12) / 24));
    if (p.x < 54) return 6.65 + 1.65 * Math.max(0, Math.min(1, (p.x - 12) / 36));
    if (p.x < 64) return 8.3 - 3.25 * Math.max(0, Math.min(1, (p.x - 54) / 10));
    return 5.05;
  };
  const ebMainRing = toClipRing(stripBetween(offsetPoly(ebMainCenter, ebLeftOff), offsetPoly(ebMainCenter, ebRightOff)));

  // B) Eastbound 2 Right-Turn ONLY lanes (311030165) flaring gently SE toward SB LV Blvd
  const ebRightTurnCenter = smoothPoly([
    [48.0, 584.4],
    [59.5, 586.8],
    [72.0, 589.1],
    [84.0, 589.6],
    [96.0, 589.8],
    [106.0, 590.3],
    [113.5, 592.9],
    [119.8, 597.7],
    [126.0, 604.5],
  ], 5);
  const ebRightTurnCum = polyCum(ebRightTurnCenter);
  const ebRightTurnRing = toClipRing(ribbonRing(ebRightTurnCenter, 3.5));

  // C) Westbound W Bellagio Dr (3 lanes entering from LV Blvd -> 5 lanes merging with slip -> lake & tunnel forks)
  const wbMainCenter = smoothPoly([
    [125.5, 558.2],
    [115.0, 557.3],
    [93.0, 555.4],
    [74.0, 552.8],
    [63.1, 549.6],
    [52.3, 544.4],
    [46.0, 539.8],
    [39.2, 534.1],
  ], 5);
  const wbMainCum = polyCum(wbMainCenter);
  const wbMainRing = toClipRing(stripBetween(
    offsetPoly(wbMainCenter, t => -5.1 - 2.6 * Math.max(0, Math.min(1, (t - 0.35) / 0.55))),
    offsetPoly(wbMainCenter, t => 5.1 + 2.4 * Math.max(0, Math.min(1, (t - 0.25) / 0.65)))
  ));

  // D) SB Las Vegas Blvd Right-Turn Slip into WB Bellagio Dr (hugging Bellagio Lake south plaza corner)
  const wbSlipCenter = smoothPoly([
    [125.0, 533.0],
    [118.5, 540.0],
    [113.5, 543.8],
    [104.5, 546.6],
    [91.5, 548.1],
    [77.5, 548.8],
    [63.1, 549.6],
  ], 5);
  const wbSlipRing = toClipRing(stripBetween(
    offsetPoly(wbSlipCenter, t => -2.9 - 0.7 * Math.min(1, t * 2.2)),
    offsetPoly(wbSlipCenter, t => 2.9 + 0.7 * Math.min(1, t * 2.2))
  ));

  // E) Lakeside Upper Bellagio Drive + Full North Roundabout Loop (14293119 -> porte-cochere)
  const lakeRoundaboutCenter = smoothPoly([
    [43.0, 536.8],
    [34.0, 529.8],
    [25.5, 521.2],
    [15.0, 509.5],
    [5.8, 497.5],
    [-2.5, 484.5],
    [-8.5, 470.5],
    [-13.0, 456.2],
    [-16.8, 447.5],
    [-21.8, 441.0],
    [-28.5, 436.8],
    [-36.5, 435.5],
    [-44.5, 437.2],
    [-51.8, 441.5],
    [-57.5, 447.5],
    [-61.4, 454.2],
    [-62.6, 461.5],
    [-62.5, 482.5],
    [-60.5, 491.5],
    [-53.5, 503.0],
    [-47.0, 509.5],
  ], 5);
  const lakeRoundaboutCum = polyCum(lakeRoundaboutCenter);
  const lakeRoundaboutRing = toClipRing(stripBetween(
    offsetPoly(lakeRoundaboutCenter, (_t, s) => {
      const p = samplePoly(lakeRoundaboutCenter, lakeRoundaboutCum, s);
      if (p.z > 454 && p.x > -20) return -3.5; // Lakeside straight climb (left = inner hillside)
      if (p.z < 454 && p.x < -15) return -4.6; // North roundabout arc (inner curb at garden)
      return -5.8;                             // Porte-cochere approach
    }),
    offsetPoly(lakeRoundaboutCenter, (_t, s) => {
      const p = samplePoly(lakeRoundaboutCenter, lakeRoundaboutCum, s);
      if (p.z > 454 && p.x > -20) return 3.5;  // Lakeside straight climb (right = lake wall)
      if (p.z < 454 && p.x < -15) return 5.0;  // North roundabout arc (outer curb)
      return 5.8;                              // Porte-cochere approach
    })
  ));

  // E2) Outer NW Taxi / VIP Staging Curve (311030164 -> 789702812 -> 789702813)
  const outerValetCenter = smoothPoly([
    [-40.0, 434.8],
    [-51.0, 435.0],
    [-61.0, 437.8],
    [-69.8, 443.8],
    [-75.2, 451.8],
    [-76.8, 460.5],
    [-76.8, 473.0],
    [-75.8, 483.5],
    [-72.0, 494.0],
    [-64.5, 501.8],
    [-54.5, 506.2],
    [-47.0, 510.5],
  ], 5);
  const outerValetRing = toClipRing(ribbonRing(outerValetCenter, 3.4));

  // E3) Broad continuous Bellagio Porte-Cochere Motor Court / Valet Forecourt (unifies all 3 arrival lanes)
  const porteCochereForecourt = roundCorners([toClipRing([
    [-81.2, 454.5],
    [-50.6, 454.5],
    [-50.4, 484.0],
    [-49.5, 495.5],
    [-44.0, 505.5],
    [-52.0, 513.0],
    [-64.5, 509.5],
    [-75.5, 501.0],
    [-81.2, 489.0],
  ])], 2.4);

  // E4) Roundabout Turn-Back Loop (311030162: EB W Bellagio Dr curving NE around garden into hillside portal)
  const turnBackCenter = smoothPoly([
    [-31.1, 522.9],
    [-23.0, 519.4],
    [-17.5, 515.2],
    [-14.6, 510.2],
    [-13.0, 503.2],
  ], 5);
  const turnBackRing = toClipRing(ribbonRing(turnBackCenter, 2.65));

  // E5) Bellagio Self-Parking Garage Exit Driveway (374989475 -> EB W Bellagio Dr)
  const garageExitCenter = smoothPoly([
    [-56.5, 537.2],
    [-45.0, 538.4],
    [-32.0, 539.7],
    [-21.0, 540.9],
    [-12.5, 542.5],
  ], 4);
  const garageExitRing = toClipRing(ribbonRing(garageExitCenter, 3.35));

  // F) Underground Tunnel Approach #1 (middle branch -> Concrete Portal #1 at (-8.5, 532.6))
  const tunnel1Center = smoothPoly([
    [39.2, 534.1],
    [30.4, 531.3],
    [24.0, 529.8],
    [16.5, 529.0],
    [6.5, 529.7],
    [-2.0, 531.3],
    [-8.5, 532.6],
  ], 5);
  const tunnel1Cum = polyCum(tunnel1Center);
  const tunnel1Ring = toClipRing(ribbonRing(tunnel1Center, 2.7));

  // G) Underground Tunnel Approach #2 (south branch -> Concrete Portal #2 at (5.5, 545.8) under W Bellagio Dr)
  const tunnel2Center = smoothPoly([
    [52.3, 544.4],
    [40.6, 543.4],
    [32.0, 542.6],
    [22.8, 542.2],
    [15.2, 543.0],
    [9.0, 544.4],
    [4.8, 546.1],
  ], 5);
  const tunnel2Cum = polyCum(tunnel2Center);
  const tunnel2Ring = toClipRing(ribbonRing(tunnel2Center, 2.7));

  // H) Cosmopolitan North Driveway (1035078204 -> 1014282285 -> 668997704) + Median Crossover (789033146)
  const cosmoDriveCenter = smoothPoly([
    [8.0, 604.2],
    [19.8, 598.9],
    [26.5, 596.0],
    [39.2, 590.7],
    [53.8, 581.8],
  ], 5);
  const cosmoDriveRing = toClipRing(ribbonRing(cosmoDriveCenter, 3.45));

  const crossoverCenter = smoothPoly([
    [53.8, 581.5],
    [58.5, 565.5],
    [63.1, 549.6],
  ], 4);
  const crossoverRing = toClipRing(ribbonRing(crossoverCenter, 3.1));

  // I) Southwest Garage Ramp (25718280) aligned exactly to OSM way for a zero-step blend at clip seam
  const swRampCenter = smoothPoly([
    [-34.8, 598.9],
    [-27.3, 594.8],
    [-20.9, 589.6],
    [-13.2, 581.8],
    [-3.7, 575.2],
    [4.5, 571.7],
    [15.3, 567.5],
  ], 4);
  const swRampRing = toClipRing(ribbonRing(swRampCenter, 2.15));

  // J) Continuous Strip intersection mouth apron across x = 112.5..125 (zero beige gaps between
  // east center median nose, refuge islands, and S Las Vegas Blvd asphalt!)
  const stripMouthApron = toClipRing([
    [113.5, 543.0],
    [125.0, 535.0],
    [125.0, 605.5],
    [117.5, 599.5],
    [113.5, 592.5],
    [112.2, 572.0],
    [112.2, 561.0],
    [113.5, 550.5],
  ]);

  // Union & smoothly fillet all drivable asphalt (unclipped first so open mouths stay wide open!)
  const rawAsphalt = exToPaths(clipOp(ctUnion, [
    ebMainRing, ebRightTurnRing, wbMainRing, wbSlipRing,
    lakeRoundaboutRing, outerValetRing, ...porteCochereForecourt,
    turnBackRing, garageExitRing, tunnel1Ring, tunnel2Ring,
    cosmoDriveRing, crossoverRing, swRampRing, stripMouthApron,
  ]));
  const smoothAsphalt = offsetPaths(offsetPaths(rawAsphalt, 1.8), -1.8);

  // ── 2. LANDSCAPED ISLANDS, SPLITTER NOSES, ROUNDABOUT GARDEN & HILLSIDE BERM ──
  const roundaboutGarden = roundCorners([toClipRing(BELLAGIO_ISLAND_SPECS.roundaboutGarden)], 3.2);
  const taxiSeparator = roundCorners([toClipRing(BELLAGIO_ISLAND_SPECS.taxiSeparator)], 0.65);
  const northHillsideBerm = roundCorners([toClipRing(BELLAGIO_ISLAND_SPECS.northHillsideBerm)], 2.2);
  const tunnelForkIsland = roundCorners([toClipRing(BELLAGIO_ISLAND_SPECS.tunnelForkIsland)], 1.6);
  const westTeardropIsland = roundCorners([toClipRing(BELLAGIO_ISLAND_SPECS.westTeardropIsland)], 3.0);
  const eastCenterMedian = roundCorners([toClipRing(BELLAGIO_ISLAND_SPECS.eastCenterMedian)], 2.6);
  const ebSplitter = roundCorners([toClipRing(BELLAGIO_ISLAND_SPECS.ebSplitter)], 1.2);
  const wbSlipIsland = roundCorners([toClipRing(BELLAGIO_ISLAND_SPECS.wbSlipIsland)], 0.8);

  const allConcreteIslands = [...ebSplitter, ...wbSlipIsland, ...eastCenterMedian];
  const allGreenIslands = [...roundaboutGarden, ...taxiSeparator, ...northHillsideBerm, ...tunnelForkIsland, ...westTeardropIsland];
  const allIslands = [...allConcreteIslands, ...allGreenIslands];

  // Unclipped drivable asphalt minus islands — used to carve outer walks & curbs WITHOUT closing road mouths
  const drivableUnclipped = exToPaths(clipOp(ctDifference, smoothAsphalt, allIslands));
  const drivableEx = clipOp(ctIntersection, drivableUnclipped, clipSection);
  const drivablePaths = exToPaths(drivableEx);
  emitPolygons(major, drivableEx, 0, 0.05);

  // Emit raised concrete bases for all islands + lush green planting inset inside landscaped islands & east median
  const allIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, allIslands)), clipSection);
  const allIslandPaths = exToPaths(allIslandsEx);
  emitPolygons(concreteMedians, allIslandsEx, 0.11, 0.2);

  // Keep east nose of eastCenterMedian (x > 101.5) as decorative concrete planter apron (matching satellite!)
  const eastMedianPlantedClip = [toClipRing([[58, 554], [102.0, 554], [102.0, 578], [58, 578]])];
  const eastMedianGreen = exToPaths(clipOp(ctIntersection, offsetPaths(eastCenterMedian, -0.95), eastMedianPlantedClip));
  // Inset central stone fountain plaza inside roundaboutGarden around (-37.8, 471.5)
  const fountainPlazaCut = [toClipRing(circleRing(-37.8, 471.5, 7.2, 40))];
  const gardenGreen = exToPaths(clipOp(ctDifference, offsetPaths(roundaboutGarden, -0.45), fountainPlazaCut));

  const greenPlantingRaw = exToPaths(clipOp(ctUnion, [
    ...gardenGreen,
    ...offsetPaths(taxiSeparator, -0.22),
    ...offsetPaths(northHillsideBerm, -0.35),
    ...offsetPaths(tunnelForkIsland, -0.35),
    ...offsetPaths(westTeardropIsland, -0.35),
    ...eastMedianGreen,
  ]));
  const greenPlantingEx = clipOp(ctIntersection, greenPlantingRaw, allIslandPaths);
  emitPolygons(medianPlanting, greenPlantingEx, 0.124, 0.35);

  // Clean outer sidewalks hugging road edges (computed from UNCLIPPED drivable asphalt so open road mouths stay clear!)
  const outerWalkBand = offsetPaths(drivableUnclipped, 2.4);
  const outerWalkEx = clipOp(ctIntersection, exToPaths(clipOp(ctDifference, outerWalkBand, [...drivableUnclipped, ...allIslandPaths])), clipSection);
  emitPolygons(sidewalk, outerWalkEx, 0.11, 0.35);

  // Crisp 0.18 m raised curbs + vertical curb faces around every island & true outer road edges (never across clip seam!)
  const islandCurb = exToPaths(clipOp(ctDifference, allIslandPaths, offsetPaths(allIslandPaths, -0.18)));
  const outerCurbUnclipped = exToPaths(clipOp(ctDifference, offsetPaths(drivableUnclipped, 0.18), [...drivableUnclipped, ...allIslandPaths]));
  const allCurbsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...islandCurb, ...outerCurbUnclipped])), clipSection);
  emitPolygons(curb, allCurbsEx, 0.17, 0.05);
  emitCurbFaces(curbFaces, allIslandPaths, 0, 0.17, BELLAGIO_CLIP_POLY);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, outerCurbUnclipped, clipSection)), 0, 0.17, BELLAGIO_CLIP_POLY);

  // ── 3. RAZOR-SHARP GOOGLE MAPS / APPLE MAPS LANE PAINT (aligned to AV lane graph & satellite) ──
  const laneWhitePolys = [];
  const goreWhitePolys = [];
  const dimPolys = [];
  const addRibbon = (target, pts, halfW) => {
    const r = ribbonRing(pts, halfW);
    if (r.length >= 3) target.push(toClipRing(r));
  };
  const addDashed = (target, pts, dashLen = 2.5, gapLen = 4.5, halfW = 0.072, phase = 0) => {
    const cum = polyCum(pts);
    const len = cum[cum.length - 1];
    for (const [d0, d1] of dashRuns(0.5, len - 0.5, dashLen, gapLen, phase)) {
      const piece = slicePoly(pts, cum, d0, d1);
      if (piece.length >= 2) addRibbon(target, piece, halfW);
    }
  };

  // 3a. Eastbound W Bellagio Dr lane dividers
  // 3-lane upper section (x = -46 .. -10): dashed lane dividers at ±1.65 m (3 lanes x 3.3 m)
  const eb3Seg = slicePoly(ebMainCenter, ebMainCum, 8, 56);
  if (eb3Seg.length >= 2) {
    addDashed(laneWhitePolys, offsetPoly(eb3Seg, -1.65), 2.4, 4.4, 0.072);
    addDashed(laneWhitePolys, offsetPoly(eb3Seg, 1.65), 2.4, 4.4, 0.072);
    addRibbon(laneWhitePolys, offsetPoly(eb3Seg, -4.72), 0.078);
    addRibbon(laneWhitePolys, offsetPoly(eb3Seg, 4.92), 0.078);
  }
  // 4-to-5-lane middle section (x = -8 .. 54): dashed dividers at -3.3, 0, +3.3 (+ outer 5th lane flare)
  const ebMidSeg = slicePoly(ebMainCenter, ebMainCum, 58, ebMainLen - 70);
  if (ebMidSeg.length >= 2) {
    for (const off of [-3.3, 0, 3.3]) {
      addDashed(laneWhitePolys, offsetPoly(ebMidSeg, off), 2.5, 4.6, 0.072);
    }
    addRibbon(laneWhitePolys, offsetPoly(ebMidSeg, -6.35), 0.078);
  }

  // 3b. EB 3 Left-Turn ONLY lanes (x = 62 .. 113): dashed dividers + solid edges + stop bar + 2 rows LEFT arrows + ONLY
  const ebLeftSeg = slicePoly(ebMainCenter, ebMainCum, ebMainLen - 64, ebMainLen - 12.2);
  if (ebLeftSeg.length >= 2) {
    addDashed(laneWhitePolys, offsetPoly(ebLeftSeg, -1.65), 2.2, 3.8, 0.075);
    addDashed(laneWhitePolys, offsetPoly(ebLeftSeg, 1.65), 2.2, 3.8, 0.075);
    addRibbon(laneWhitePolys, offsetPoly(ebLeftSeg, -4.8), 0.08);
    addRibbon(laneWhitePolys, offsetPoly(ebLeftSeg, 4.8), 0.08);

    const segCum = polyCum(ebLeftSeg);
    const segLen = segCum[segCum.length - 1];
    for (const laneOff of [-3.3, 0, 3.3]) {
      const pNear = samplePoly(ebLeftSeg, segCum, segLen - 8.2);
      const pOnly = samplePoly(ebLeftSeg, segCum, segLen - 17.5);
      const pFar = samplePoly(ebLeftSeg, segCum, segLen - 27.5);
      const nxN = -pNear.hz, nzN = pNear.hx;
      const nxO = -pOnly.hz, nzO = pOnly.hx;
      const nxF = -pFar.hz, nzF = pFar.hx;
      laneWhitePolys.push(...arrowPolysWorld(pNear.x + nxN * laneOff, pNear.z + nzN * laneOff, pNear.hx, pNear.hz, ['left'], 3.1));
      laneWhitePolys.push(...onlyTextPolys(pOnly.x + nxO * laneOff, pOnly.z + nzO * laneOff, pOnly.hx, pOnly.hz, 0.56));
      laneWhitePolys.push(...arrowPolysWorld(pFar.x + nxF * laneOff, pFar.z + nzF * laneOff, pFar.hx, pFar.hz, ['left'], 3.1));
    }
    // Crisp stop bar strictly west of the LV Blvd zebra crosswalk (x ~ 112.5)
    const pStop = samplePoly(ebLeftSeg, segCum, segLen - 0.6);
    const nxS = -pStop.hz, nzS = pStop.hx;
    addRibbon(laneWhitePolys, [
      [pStop.x - nxS * 4.8, pStop.z - nzS * 4.8],
      [pStop.x + nxS * 4.8, pStop.z + nzS * 4.8],
    ], 0.24);
  }

  // 3c. EB 2 Right-Turn ONLY lanes (311030165) + ONLY text + RIGHT arrows + chevron gore
  const ebRtLen = ebRightTurnCum[ebRightTurnCum.length - 1];
  const ebRtSeg = slicePoly(ebRightTurnCenter, ebRightTurnCum, 14, ebRtLen - 13.5);
  if (ebRtSeg.length >= 2) {
    addDashed(laneWhitePolys, ebRtSeg, 2.2, 3.8, 0.075);
    addRibbon(laneWhitePolys, offsetPoly(ebRtSeg, -3.25), 0.08);
    addRibbon(laneWhitePolys, offsetPoly(ebRtSeg, 3.25), 0.08);
    const rCum = polyCum(ebRtSeg);
    const rLen = rCum[rCum.length - 1];
    for (const laneOff of [-1.65, 1.65]) {
      const pNear = samplePoly(ebRtSeg, rCum, rLen - 6.8);
      const pOnly = samplePoly(ebRtSeg, rCum, rLen - 16.0);
      const pFar = samplePoly(ebRtSeg, rCum, rLen - 25.8);
      const nxN = -pNear.hz, nzN = pNear.hx;
      const nxO = -pOnly.hz, nzO = pOnly.hx;
      const nxF = -pFar.hz, nzF = pFar.hx;
      laneWhitePolys.push(...arrowPolysWorld(pNear.x + nxN * laneOff, pNear.z + nzN * laneOff, pNear.hx, pNear.hz, ['right'], 3.1));
      laneWhitePolys.push(...onlyTextPolys(pOnly.x + nxO * laneOff, pOnly.z + nzO * laneOff, pOnly.hx, pOnly.hz, 0.56));
      laneWhitePolys.push(...arrowPolysWorld(pFar.x + nxF * laneOff, pFar.z + nzF * laneOff, pFar.hx, pFar.hz, ['right'], 3.1));
    }
  }

  // Chevron-hatched white gore separating EB 3 Left-Turn lanes & 2 Right-Turn lanes (west of concrete splitter!)
  goreWhitePolys.push(...buildChevronGore(
    [[72.0, 585.4], [88.0, 584.7], [104.0, 583.6]],
    [[72.0, 585.4], [88.0, 586.5], [104.0, 586.8]],
    2.6, 0.085
  ));

  // 3d. Westbound W Bellagio Dr lane dividers + SB LV Blvd slip chevron gore (stops strictly SE of Fork #2 gore!)
  const wbLen = wbMainCum[wbMainCum.length - 1];
  const wbSeg = slicePoly(wbMainCenter, wbMainCum, 13.0, wbLen - 11.5);
  if (wbSeg.length >= 2) {
    addDashed(laneWhitePolys, offsetPoly(wbSeg, -1.65), 2.5, 4.6, 0.075);
    addDashed(laneWhitePolys, offsetPoly(wbSeg, 1.65), 2.5, 4.6, 0.075);
    addRibbon(laneWhitePolys, offsetPoly(wbSeg, -4.85), 0.08);
    const wCum = polyCum(wbSeg);
    for (const d of [14, 34]) {
      const q = samplePoly(wbSeg, wCum, d);
      dimPolys.push(...arrowPolysWorld(q.x, q.z, q.hx, q.hz, ['through'], 3.1));
    }
  }

  // Chevron-hatched white gore between SB LV Blvd right-turn slip & WB Bellagio Dr (west of wbSlipIsland!)
  goreWhitePolys.push(...buildChevronGore(
    [[74.0, 550.2], [89.0, 549.5], [104.0, 548.6]],
    [[74.0, 550.2], [89.0, 551.0], [104.0, 551.6]],
    2.5, 0.085
  ));

  // 3e. Non-intersecting V-shaped white gore noses at the two underground tunnel splits!
  // Fork #1: Lakeside Bellagio Dr vs Middle Tunnel Portal #1 (strictly north of z = 531)
  addRibbon(goreWhitePolys, [[34.5, 530.8], [26.8, 524.8], [21.5, 519.2]], 0.085);
  addRibbon(goreWhitePolys, [[34.5, 530.8], [27.5, 528.2], [21.5, 526.8]], 0.085);
  // Fork #2: Middle Tunnel Portal #1 vs South Tunnel Portal #2 (strictly south of z = 534.5)
  addRibbon(goreWhitePolys, [[44.2, 540.5], [36.5, 536.2], [30.2, 534.5]], 0.085);
  addRibbon(goreWhitePolys, [[44.2, 540.5], [36.5, 540.2], [30.2, 539.8]], 0.085);

  // Gore exclusion masks: lane lines & edge paint MUST stop at gore edges and NEVER cross through any gore!
  const goreMasks = [
    toClipRing([[34.8, 531.0], [26.8, 524.8], [20.5, 518.2], [17.5, 524.8], [21.2, 526.8], [27.5, 528.2]]),
    toClipRing([[44.6, 540.6], [36.5, 536.2], [29.6, 534.3], [27.5, 537.2], [29.6, 539.9], [36.5, 540.3]]),
    toClipRing([[71.8, 585.4], [88.0, 584.7], [104.5, 583.5], [104.5, 586.9], [88.0, 586.5]]),
    toClipRing([[73.8, 550.2], [89.0, 549.5], [104.5, 548.5], [104.5, 551.7], [89.0, 551.0]]),
  ];

  // 3f. Lakeside Bellagio Drive & North Roundabout Loop lane markings (starts cleanly NW of Fork #1 gore!)
  const lakeLen = lakeRoundaboutCum[lakeRoundaboutCum.length - 1];
  const lakePaintSeg = slicePoly(lakeRoundaboutCenter, lakeRoundaboutCum, 18.0, lakeLen - 46.0);
  if (lakePaintSeg.length >= 2) {
    addDashed(laneWhitePolys, lakePaintSeg, 2.5, 4.5, 0.072);
    addRibbon(laneWhitePolys, offsetPoly(lakePaintSeg, 3.2), 0.075);
    addRibbon(laneWhitePolys, offsetPoly(lakePaintSeg, -3.2), 0.075);
    const lCum = polyCum(lakePaintSeg);
    for (const frac of [0.22, 0.55, 0.82]) {
      const q = samplePoly(lakePaintSeg, lCum, lCum[lCum.length - 1] * frac);
      dimPolys.push(...arrowPolysWorld(q.x, q.z, q.hx, q.hz, ['through'], 2.9));
    }
  }
  // Subtle lane dividers guiding the 3 valet / arrival aisles through Bellagio porte-cochere
  addDashed(dimPolys, [[-59.0, 456.0], [-58.8, 484.0], [-56.0, 495.5]], 2.0, 3.6, 0.065);
  addDashed(dimPolys, [[-68.8, 458.0], [-68.6, 484.0], [-65.0, 496.5]], 2.0, 3.6, 0.065);

  // Subtle arrows leading into Tunnel Portal #1 & Tunnel Portal #2
  for (const [pts, cum] of [[tunnel1Center, tunnel1Cum], [tunnel2Center, tunnel2Cum]]) {
    const len = cum[cum.length - 1];
    for (const d of [len * 0.42, len * 0.72]) {
      const q = samplePoly(pts, cum, d);
      dimPolys.push(...arrowPolysWorld(q.x, q.z, q.hx, q.hz, ['through'], 2.7));
    }
  }

  // 3g. Continental Zebra Crosswalks (aligned to Google Satellite!)
  const addZebra = (pA, pB, depth = 3.1) => {
    const dx = pB[0] - pA[0], dz = pB[1] - pA[1];
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    const nx = -uz, nz = ux;
    for (const [lo, hi] of zebraBars(0.35, len - 0.35)) {
      const a0 = [pA[0] + ux * lo - nx * (depth / 2), pA[1] + uz * lo - nz * (depth / 2)];
      const a1 = [pA[0] + ux * lo + nx * (depth / 2), pA[1] + uz * lo + nz * (depth / 2)];
      const b1 = [pA[0] + ux * hi + nx * (depth / 2), pA[1] + uz * hi + nz * (depth / 2)];
      const b0 = [pA[0] + ux * hi - nx * (depth / 2), pA[1] + uz * hi - nz * (depth / 2)];
      laneWhitePolys.push(toClipRing([a0, a1, b1, b0]));
    }
  };
  // Crosswalk across WB Bellagio Dr at LV Blvd (x ~ 115.8)
  addZebra([115.8, 552.0], [115.5, 562.2], 3.1);
  // Crosswalk across EB 3 Left-Turn lanes at LV Blvd (x ~ 115.8)
  addZebra([115.8, 572.8], [115.6, 582.8], 3.1);
  // Crosswalk across SB LV Blvd Right-Turn Slip lane
  addZebra([112.4, 540.6], [115.5, 546.8], 2.8);
  // Crosswalk across EB 2 Right-Turn lanes (between concrete refuge island & south curb)
  addZebra([113.8, 588.8], [118.2, 595.6], 2.8);
  // Crosswalk across Cosmopolitan North Driveway (exact satellite position!)
  addZebra([29.5, 590.8], [34.2, 596.6], 2.8);
  // Crosswalk across Bellagio Self-Parking Garage Exit Driveway (exact satellite position!)
  addZebra([-38.2, 535.2], [-37.4, 542.6], 2.8);

  // Subtract gore interiors from all lane paint, then union with gore strokes and clip strictly inside drivable asphalt
  const cleanLaneWhite = exToPaths(clipOp(ctDifference, exToPaths(clipOp(ctUnion, laneWhitePolys)), goreMasks));
  const whiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...cleanLaneWhite, ...goreWhitePolys])), drivablePaths);
  const whitePaths = exToPaths(whiteEx);
  const cleanDim = exToPaths(clipOp(ctDifference, exToPaths(clipOp(ctUnion, dimPolys)), goreMasks));
  const dimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, cleanDim, drivablePaths)), whitePaths);

  emitPolygons(paint, whiteEx, 0, 0.005);
  emitPolygons(paintDim, dimEx, 0, 0.005);

  // Dispatch additional Neon-owned resort drive finishers without editing Carbon-owned roads.js
  finishCaesarsDrivePavement(layers);
  finishCosmoDrivePavement(layers);
  finishAriaDrivePavement(layers);
  finishWynnEncoreDrivePavement(layers);
  finishVenetianPalazzoDrivePavement(layers);
}

// ───────────────────────── 3D Architecture: Roundabout Fountain, Portals, Hillside & Skybridge ─────────────────────────

// Tree coordinates strictly inset inside Bellagio's landscaped islands & roundabout garden (zero on asphalt!)
export const BELLAGIO_TREE_COORDS = [
  // East center median (west of decorative east planter nose)
  [69.5, 565.5, 1.0], [78.5, 566.2, 1.05], [88.0, 566.8, 0.98], [97.0, 567.2, 1.0],
  // West teardrop island south of Portal #2
  [27.0, 556.5, 1.0], [35.5, 554.8, 1.12], [44.0, 558.5, 1.0], [36.0, 562.2, 0.95], [44.5, 565.5, 0.95],
  // Island between Portal #1 and Portal #2
  [5.5, 537.8, 0.92], [13.5, 536.6, 1.0], [21.0, 536.8, 0.88],
  // North hillside berm behind Portal #1
  [-11.0, 517.0, 1.1], [-4.5, 511.5, 1.15], [3.5, 516.5, 1.05], [-3.0, 522.0, 1.0], [8.5, 522.0, 0.95],
  // Roundabout garden north grove & south parterre (strictly clear of central fountain at (-39, 471.5))
  [-38.0, 450.5, 1.2], [-30.0, 453.5, 1.15], [-43.0, 457.0, 1.05], [-25.0, 461.0, 1.1],
  [-21.5, 472.5, 1.05], [-23.0, 485.0, 1.1], [-31.0, 496.0, 1.15], [-40.5, 495.5, 1.05], [-24.5, 500.0, 0.95],
];

export function buildBellagioArchitecture() {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.name = 'Bellagio Drive Architecture';

  const matConcrete = new THREE.MeshStandardMaterial({ color: 0xbcb7ae, roughness: 0.86, metalness: 0.04 });
  const matConcreteDark = new THREE.MeshStandardMaterial({ color: 0x7a7772, roughness: 0.92, metalness: 0.04 });
  const matTunnelVoid = new THREE.MeshBasicMaterial({ color: 0x11151d });
  const matGrass = new THREE.MeshStandardMaterial({ color: 0x6ea655, roughness: 0.94, metalness: 0.0 });
  const matTrunk = new THREE.MeshStandardMaterial({ color: 0x7c5f48, roughness: 0.92 });
  const matCanopy = new THREE.MeshStandardMaterial({ color: 0x5d9647, roughness: 0.86 });
  const matStone = new THREE.MeshStandardMaterial({ color: 0xdfd2be, roughness: 0.78, metalness: 0.04 });
  const matWater = new THREE.MeshStandardMaterial({ color: 0x3b96b8, roughness: 0.22, metalness: 0.15 });
  const matBronze = new THREE.MeshStandardMaterial({ color: 0x6e624b, roughness: 0.45, metalness: 0.45 });
  const matTerracotta = new THREE.MeshStandardMaterial({ color: 0xd4845e, roughness: 0.66, metalness: 0.06 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x565d68, roughness: 0.45, metalness: 0.55 });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x8eb8d6, roughness: 0.16, metalness: 0.25, transparent: true, opacity: 0.58,
  });

  // 1. INTEGRATED CONCRETE TUNNEL PORTALS (tucked strictly clear of EB W Bellagio Dr!)
  const buildPortal = (x, z, headingRad, width = 5.4, height = 2.55, backDepth = 3.2) => {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = -headingRad; // local +X points INTO the underground tunnel

    // Dark recessed tunnel interior opening
    const voidBox = new THREE.Mesh(new THREE.BoxGeometry(backDepth, height - 0.12, width - 0.5), matTunnelVoid);
    voidBox.position.set(backDepth * 0.5, (height - 0.12) / 2, 0);
    p.add(voidBox);

    // Clean concrete portal headwall lintel + side jambs
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, width + 0.9), matConcrete);
    lintel.position.set(0.15, height + 0.1, 0);
    p.add(lintel);

    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.85, height + 0.34, 0.52), matConcrete);
      jamb.position.set(0.15, (height + 0.34) / 2, side * (width / 2 + 0.24));
      p.add(jamb);

      // Tapered concrete retaining wingwall hugging the cut bank
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, height * 0.48, 0.34), matConcreteDark);
      wing.position.set(-1.7, height * 0.24, side * (width / 2 + 0.38));
      wing.rotation.y = side * -0.09;
      p.add(wing);
    }

    // Sloped landscaped earth cap rising behind the headwall (bounded to backDepth so it never clips EB asphalt!)
    const bank = new THREE.Mesh(new THREE.BoxGeometry(backDepth + 0.4, 0.36, width + 1.1), matGrass);
    bank.position.set(backDepth * 0.5 + 0.15, height + 0.28, 0);
    bank.rotation.z = -0.10;
    p.add(bank);

    return p;
  };

  // Portal #1: Bellagio underground valet/bus tunnel at (-8.5, 532.6)
  group.add(buildPortal(-8.5, 532.6, Math.PI - 0.18, 5.4, 2.6, 3.8));
  // Portal #2: Underpass diving beneath W Bellagio Dr at (6.0, 545.6) (short backDepth keeps it clear of EB lanes!)
  group.add(buildPortal(6.0, 545.6, Math.PI - 0.34, 5.4, 2.45, 2.4));
  // Portal #3: Roundabout turn-back loop underpass portal tucked into the hillside at (-13.0, 503.0)
  group.add(buildPortal(-13.0, 503.0, -Math.PI / 2 - 0.14, 5.0, 2.4, 2.6));

  // 2. SCULPTED LOW-PROFILE LANDSCAPED EMBANKMENTS (strictly inset inside finished island curbs!)
  const addTurfSlope = (ring, yBase, yTop) => {
    const shape = new THREE.Shape();
    ring.forEach(([px, pz], idx) => {
      if (idx === 0) shape.moveTo(px, -pz);
      else shape.lineTo(px, -pz);
    });
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: yTop - yBase, bevelEnabled: true, bevelThickness: 0.38, bevelSize: 0.55, bevelSegments: 3,
    });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, matGrass);
    mesh.position.y = yBase;
    group.add(mesh);
  };

  // North hillside berm behind Portal #1
  addTurfSlope([
    [-21.0, 522.0], [-10.0, 509.5], [-6.0, 501.0], [0.5, 504.5],
    [9.5, 515.0], [14.5, 523.5], [3.0, 525.2], [-12.0, 527.5],
  ], 0.12, 1.35);
  // Landscaped island between Portal #1 and Portal #2
  addTurfSlope([
    [-0.5, 536.2], [13.5, 534.2], [23.0, 535.2], [25.5, 537.0], [21.5, 538.2], [11.5, 538.8], [1.5, 540.2],
  ], 0.12, 0.82);
  // Landscaped teardrop island south of Portal #2
  addTurfSlope([
    [16.5, 550.8], [32.0, 548.8], [46.5, 550.8], [51.0, 558.0], [46.8, 568.5], [35.5, 565.2], [23.5, 559.2],
  ], 0.12, 0.78);

  // 3. ICONIC BELLAGIO ROUNDABOUT ARRIVAL FOUNTAIN & GARDEN COURT AT (-37.8, 471.5)
  const fountain = new THREE.Group();
  fountain.position.set(-37.8, 0.12, 471.5);
  const fPlaza = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.0, 0.14, 32), matStone);
  fPlaza.position.y = 0.07;
  const fRim = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 0.68, 32), matStone);
  fRim.position.y = 0.42;
  // Bright turquoise fountain basin water sitting cleanly on top of the basin floor inside a stone lip
  const fWater = new THREE.Mesh(new THREE.CylinderGeometry(4.15, 4.15, 0.12, 32), matWater);
  fWater.position.y = 0.78;
  const fCoping = new THREE.Mesh(new THREE.TorusGeometry(4.38, 0.24, 10, 36), matStone);
  fCoping.rotation.x = Math.PI / 2;
  fCoping.position.y = 0.82;
  const fPedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.4, 1.45, 20), matStone);
  fPedestal.position.y = 1.15;
  const fBowl = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 0.85, 0.5, 20), matBronze);
  fBowl.position.y = 2.02;
  const fFinial = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.05, 16), matBronze);
  fFinial.position.y = 2.68;
  fountain.add(fPlaza, fRim, fWater, fCoping, fPedestal, fBowl, fFinial);
  group.add(fountain);

  // East center median nose decorative circular planter court at (106.5, 567.2)
  const eastPlanter = new THREE.Group();
  eastPlanter.position.set(106.5, 0.12, 567.2);
  const epRim = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.7, 0.55, 24), matStone);
  epRim.position.y = 0.28;
  const epTurf = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.45, 24), matGrass);
  epTurf.position.y = 0.34;
  eastPlanter.add(epRim, epTurf);
  group.add(eastPlanter);

  // 4. STYLIZED ROUNDED TREES STRICTLY ON LANDSCAPED ISLANDS & ROUNDABOUT GARDEN (zero on asphalt!)
  for (const [tx, tz, sc] of BELLAGIO_TREE_COORDS) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * sc, 0.34 * sc, 2.8 * sc, 7), matTrunk);
    trunk.position.set(tx, 1.4 * sc + 0.4, tz);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.15 * sc, 12, 10), matCanopy);
    crown.scale.set(1, 1.25, 1);
    crown.position.set(tx, 4.0 * sc + 0.4, tz);
    group.add(crown);
  }

  // 5. BESPOKE BELLAGIO–COSMOPOLITAN PEDESTRIAN SKYBRIDGE (replaces OSM duplicate buildings cleanly!)
  const deckY = 6.8;
  const addBridgeSpan = (p0, p1, width = 4.6) => {
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const span = new THREE.Group();
    span.position.set((p0[0] + p1[0]) / 2, deckY, (p0[1] + p1[1]) / 2);
    span.rotation.y = -angle;

    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.72, width), matStone);
    span.add(deck);

    for (const side of [-1, 1]) {
      const glassWall = new THREE.Mesh(new THREE.BoxGeometry(len - 0.6, 2.4, 0.14), matGlass);
      glassWall.position.set(0, 1.55, side * (width / 2 - 0.12));
      span.add(glassWall);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.22), matSteel);
      rail.position.set(0, 2.82, side * (width / 2 - 0.1));
      span.add(rail);
    }

    const roofL = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.28, width * 0.62), matTerracotta);
    roofL.position.set(0, 3.25, -width * 0.26);
    roofL.rotation.x = 0.28;
    span.add(roofL);

    const roofR = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.28, width * 0.62), matTerracotta);
    roofR.position.set(0, 3.25, width * 0.26);
    roofR.rotation.x = -0.28;
    span.add(roofR);

    group.add(span);
  };

  const b0 = [-52.9, 551.4];
  const b1 = [32.9, 611.5];
  const b2 = [97.3, 611.8];
  addBridgeSpan(b0, b1, 4.6);
  addBridgeSpan(b1, b2, 4.4);

  // Iconic square terracotta hipped-roof pavilions at exact OSM coordinates (strictly clear of asphalt!)
  const addPavilion = (x, z, rotY = 0) => {
    const pav = new THREE.Group();
    pav.position.set(x, 0, z);
    pav.rotation.y = rotY;

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(7.2, deckY + 3.2, 7.2), matStone);
    shaft.position.y = (deckY + 3.2) / 2;
    pav.add(shaft);

    const band = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2.1, 7.4), matGlass);
    band.position.y = deckY + 1.55;
    pav.add(band);

    const hip = new THREE.Mesh(new THREE.ConeGeometry(5.9, 2.7, 4), matTerracotta);
    hip.position.y = deckY + 4.5;
    hip.rotation.y = Math.PI / 4;
    pav.add(hip);

    group.add(pav);
  };

  const spanAngle = -Math.atan2(b1[1] - b0[1], b1[0] - b0[0]);
  addPavilion(-27.5, 570.0, spanAngle);
  addPavilion(2.0, 590.5, spanAngle);
  addPavilion(32.8, 610.5, 0);
  addPavilion(97.3, 611.8, 0);

  return group;
}
