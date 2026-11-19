import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { arrowMarking, dashRuns, zebraBars } from './road-visuals.mjs';

// W Bellagio Drive, Underground Valet/Underpass Portals, Landscaped Hillside & Pedestrian Bridge.
// Local coordinates in metres: x east, y up, z south.

export const BELLAGIO_DRIVE_BOUNDS = [-54.0, 466.0, 121.8, 606.5];

// Ways that were wrongly elevated to +7.2 m in OSM (W Bellagio Dr is ground-level; the ramps dive under it).
const BELLAGIO_GROUND_WAYS = new Set([789702811, 25718284, 1050182643]);
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

// Override way elevations for lanegraph.js so AVs follow smooth ground-level W Bellagio Dr
// while underground ramps stay separated vertically (> LEVEL_GAP = 3 m).
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
  return BELLAGIO_GROUND_WAYS.has(way.id);
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

function emitPolygons(layer, polys, y, minArea = 0.02) {
  for (const { outer, holes } of polys) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minArea * MM * MM) continue;
    const ring = fromClipRing(outer);
    const [x, z] = ring[0];
    layer.at(x, z).polygon(ring, y, holes.map(fromClipRing));
  }
}

function emitCurbFaces(curbFaces, paths, y0 = 0, y1 = 0.17) {
  for (const path of paths) {
    const ring = fromClipRing(path);
    const n = ring.length;
    if (n < 3) continue;
    const soup = curbFaces.at(ring[0][0], ring[0][1]);
    for (let i = 0; i < n; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % n];
      if (Math.hypot(bx - ax, bz - az) < 0.02) continue;
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
function onlyTextPolys(cx, cz, hx, hz, scale = 0.62) {
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
function buildChevronGore(edgeA, edgeB, stripeSpacing = 2.6, halfW = 0.09) {
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

function clearLayerInPoly(layer, bounds, clipSection) {
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
        if (mx > west && mx < east && mz > north && mz < south) continue;
        keep.push(idx[i], idx[i + 1], idx[i + 2]);
        continue;
      }
      const ring = [pt(x0, z0), pt(x1, z1), pt(x2, z2)];
      const area = clipper.Clipper.Area(ring);
      if (Math.abs(area) < 1) continue;
      if (area < 0) ring.reverse();
      if (minX < west || maxX > east || minZ < north || maxZ > south) {
        outside.push([clipOp(ctDifference, [ring], clipSection), y]);
      } else {
        const diff = clipOp(ctDifference, [ring], clipSection);
        if (diff.length) outside.push([diff, y]);
      }
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

// ───────────────────────── Main Bellagio Drive Builder ─────────────────────────

export function finishBellagioDrivePavement(layers) {
  const { major, asphalt, service, slipPavement, sidewalk, concreteMedians, medians,
    medianPaving, medianPlanting, frontagePlanting, curb, curbFaces, paint, paintDim, paintYellow } = layers;

  // Precise polygon covering W Bellagio Drive, tunnel portals, and forks while staying strictly
  // west of South Las Vegas Blvd (x <= 121.8) and south-west of Bellagio Fountains Lake!
  const clipPoly = [
    [-53.0, 496.0],
    [-12.0, 466.0],
    [7.0, 488.0],
    [35.0, 521.0],
    [60.0, 536.0],
    [101.0, 538.5],
    [114.5, 535.5],
    [121.8, 540.0],
    [121.8, 606.0],
    [15.0, 604.0],
    [-18.0, 580.0],
    [-53.0, 542.0],
  ];
  const clipSection = [toClipRing(clipPoly)];

  for (const layer of [major, asphalt, service, slipPavement, sidewalk, concreteMedians, medians,
    medianPaving, medianPlanting, frontagePlanting, curb, curbFaces, paint, paintDim, paintYellow]) {
    if (layer) clearLayerInPoly(layer, BELLAGIO_DRIVE_BOUNDS, clipSection);
  }

  // ── 1. SMOOTH CARRIAGEWAY CENTERLINES ──
  // A) Eastbound W Bellagio Dr main stem (from Bellagio porte-cochere down to 5-lane section & 3 left-turn lanes)
  const ebMainCenter = smoothPoly([
    [-51.0, 506.5],
    [-41.3, 514.1],
    [-31.1, 522.9],
    [-13.5, 542.2],
    [-10.4, 546.1],
    [1.4, 557.5],
    [6.7, 561.3],
    [15.3, 567.5],
    [32.6, 574.9],
    [53.8, 581.5],
    [65.0, 581.2],
    [92.9, 579.8],
    [111.3, 578.3],
    [122.0, 577.1],
  ], 5);
  const ebMainCum = polyCum(ebMainCenter);
  const ebMainLen = ebMainCum[ebMainCum.length - 1];

  // Width profile along ebMainCenter: 3 lanes (9.9m) at porte-cochere -> 4 lanes (13.2m) across underpass ->
  // 5 lanes (16.5m) at x=25..58 -> 3 left-turn lanes (9.9m) at x=65..122 (south side splits to 2 right-turn lanes!)
  const ebLeftOff = (t, s) => {
    const p = samplePoly(ebMainCenter, ebMainCum, s);
    if (p.x < -12) return -4.95;
    if (p.x < 12) return -4.95 - 1.65 * Math.max(0, Math.min(1, (p.x + 12) / 24));
    if (p.x < 58) return -6.6;
    return -5.0;
  };
  const ebRightOff = (t, s) => {
    const p = samplePoly(ebMainCenter, ebMainCum, s);
    if (p.x < -12) return 4.95;
    if (p.x < 12) return 4.95 + 1.65 * Math.max(0, Math.min(1, (p.x + 12) / 24));
    if (p.x < 56) return 6.6 + 3.2 * Math.max(0, Math.min(1, (p.x - 12) / 36));
    return 5.0;
  };
  const ebMainRing = toClipRing(stripBetween(offsetPoly(ebMainCenter, ebLeftOff), offsetPoly(ebMainCenter, ebRightOff)));

  // B) Eastbound 2 Right-Turn ONLY lanes (311030165) flaring gently SE toward SB LV Blvd
  const ebRightTurnCenter = smoothPoly([
    [48.0, 584.5],
    [60.0, 587.6],
    [77.4, 590.0],
    [92.0, 590.1],
    [105.4, 590.4],
    [113.5, 593.0],
    [122.0, 599.2],
  ], 5);
  const ebRightTurnCum = polyCum(ebRightTurnCenter);
  const ebRightTurnRing = toClipRing(ribbonRing(ebRightTurnCenter, 3.4));

  // C) Westbound W Bellagio Dr (3 lanes entering from LV Blvd -> 4-5 lanes merging with slip -> lake & tunnel forks)
  const wbMainCenter = smoothPoly([
    [122.0, 558.8],
    [112.0, 557.8],
    [82.0, 554.4],
    [63.1, 549.6],
    [52.3, 544.4],
    [45.5, 539.5],
    [39.2, 534.1],
  ], 5);
  const wbMainCum = polyCum(wbMainCenter);
  const wbMainRing = toClipRing(stripBetween(
    offsetPoly(wbMainCenter, (t) => -5.1 - 1.6 * Math.min(1, t * 1.4)),
    offsetPoly(wbMainCenter, (t) => 5.1 + 1.2 * Math.max(0, (t - 0.35) / 0.65))
  ));

  // D) SB Las Vegas Blvd Right-Turn Slip into WB Bellagio Dr (hugging Bellagio Lake south wall)
  const wbSlipCenter = smoothPoly([
    [122.0, 539.5],
    [114.5, 544.0],
    [104.5, 546.5],
    [91.3, 547.8],
    [78.0, 548.5],
    [63.1, 549.6],
  ], 5);
  const wbSlipCum = polyCum(wbSlipCenter);
  const wbSlipRing = toClipRing(ribbonRing(wbSlipCenter, 3.3));

  // E) Lakeside Upper Bellagio Drive (14293119, 2 lanes hugging Bellagio Fountains Lake)
  const lakeDriveCenter = smoothPoly([
    [43.0, 536.8],
    [34.0, 529.8],
    [25.5, 521.2],
    [11.7, 505.5],
    [2.7, 493.7],
    [-5.2, 479.5],
    [-11.0, 464.0],
  ], 5);
  const lakeDriveCum = polyCum(lakeDriveCenter);
  const lakeDriveRing = toClipRing(ribbonRing(lakeDriveCenter, 3.4));

  // F) Underground Tunnel Approach #1 (middle branch -> Concrete Portal #1 at (-7.5, 532.3))
  const tunnel1Center = smoothPoly([
    [43.0, 536.0],
    [31.5, 532.0],
    [23.0, 530.0],
    [14.0, 529.6],
    [3.0, 530.6],
    [-7.5, 532.3],
  ], 5);
  const tunnel1Cum = polyCum(tunnel1Center);
  const tunnel1Ring = toClipRing(ribbonRing(tunnel1Center, 2.8));

  // G) Underground Tunnel Approach #2 (south branch -> Concrete Portal #2 at (4.5, 546.1) under W Bellagio Dr)
  const tunnel2Center = smoothPoly([
    [54.0, 545.2],
    [40.6, 543.4],
    [31.5, 542.6],
    [22.5, 542.4],
    [14.8, 543.2],
    [4.5, 546.1],
  ], 5);
  const tunnel2Cum = polyCum(tunnel2Center);
  const tunnel2Ring = toClipRing(ribbonRing(tunnel2Center, 2.8));

  // H) Cosmopolitan North Driveway (1014282285 -> 668997704) + Median Crossover (789033146)
  const cosmoDriveCenter = smoothPoly([
    [19.5, 599.0],
    [25.5, 596.2],
    [39.2, 590.7],
    [53.8, 581.5],
  ], 4);
  const cosmoDriveRing = toClipRing(ribbonRing(cosmoDriveCenter, 3.5));

  const crossoverCenter = smoothPoly([
    [53.8, 581.5],
    [58.5, 565.5],
    [63.1, 549.6],
  ], 4);
  const crossoverRing = toClipRing(ribbonRing(crossoverCenter, 3.4));

  // Union & smoothly fillet all drivable asphalt
  const rawAsphalt = exToPaths(clipOp(ctUnion, [
    ebMainRing, ebRightTurnRing, wbMainRing, wbSlipRing,
    lakeDriveRing, tunnel1Ring, tunnel2Ring, cosmoDriveRing, crossoverRing,
  ]));
  const smoothAsphalt = offsetPaths(offsetPaths(rawAsphalt, 2.0), -2.0);

  // ── 2. LANDSCAPED ISLANDS, SPLITTER NOSES & HILLSIDE BERM (EXACT APPLE MAPS GEOMETRY) ──
  // a) Concrete splitter nose separating EB 3 left-turn lanes from EB 2 right-turn lanes (x = 100..118)
  const ebSplitter = roundCorners([toClipRing([
    [101.5, 583.4],
    [117.5, 582.5],
    [118.0, 588.6],
    [102.0, 586.6],
  ])], 1.35);

  // b) Main Center Median Island between EB & WB Bellagio Drive (east of crossover, x = 64..116)
  const eastCenterMedian = roundCorners([toClipRing([
    [65.5, 557.8],
    [115.5, 564.8],
    [116.0, 572.5],
    [62.5, 576.0],
  ])], 2.6);

  // c) Lush Green Teardrop Median Island (west of crossover, between Tunnel #2 & W Bellagio Dr)
  const westTeardropIsland = roundCorners([toClipRing([
    [14.5, 550.8],
    [48.5, 548.8],
    [52.5, 562.5],
    [46.5, 571.2],
    [22.0, 564.5],
  ])], 3.2);

  // d) Lush Green Teardrop Island between Tunnel Portal #1 and Tunnel Portal #2 (exact Apple Maps Image 2!)
  const tunnelForkIsland = roundCorners([toClipRing([
    [-2.5, 535.5],
    [23.5, 533.8],
    [29.5, 537.5],
    [21.0, 539.8],
    [0.5, 541.5],
  ])], 1.8);

  // e) Lush Green Hillside Berm between Lakeside Bellagio Drive, Tunnel Portal #1, and upper W Bellagio Dr
  const northHillsideBerm = roundCorners([toClipRing([
    [-42.0, 502.5],
    [-11.5, 474.0],
    [16.5, 518.0],
    [21.5, 526.2],
    [-8.5, 529.2],
    [-22.0, 523.5],
  ])], 2.8);

  const allConcreteIslands = [...ebSplitter, ...eastCenterMedian];
  const allGreenIslands = [...westTeardropIsland, ...tunnelForkIsland, ...northHillsideBerm];
  const allIslands = [...allConcreteIslands, ...allGreenIslands];

  // Keep drivable asphalt strictly clear of islands & inside clip polygon
  const drivableEx = clipOp(ctIntersection, exToPaths(clipOp(ctDifference, smoothAsphalt, allIslands)), clipSection);
  const drivablePaths = exToPaths(drivableEx);
  emitPolygons(major, drivableEx, 0, 0.05);

  // Emit raised concrete bases for all islands + lush green planting inset inside green islands & main median
  const allIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, allIslands)), clipSection);
  const allIslandPaths = exToPaths(allIslandsEx);
  emitPolygons(concreteMedians, allIslandsEx, 0.11, 0.25);

  const greenPlantingRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(allGreenIslands, -0.35),
    ...offsetPaths(eastCenterMedian, -1.1),
  ]));
  const greenPlantingEx = clipOp(ctIntersection, greenPlantingRaw, allIslandPaths);
  emitPolygons(medianPlanting, greenPlantingEx, 0.124, 0.4);

  // Clean outer sidewalks hugging the Bellagio Lake promenade and Cosmopolitan edge (zero overlap with asphalt!)
  const outerWalkBand = offsetPaths(drivablePaths, 3.0);
  const outerWalkEx = clipOp(ctIntersection, exToPaths(clipOp(ctDifference, outerWalkBand, [...drivablePaths, ...allIslandPaths])), clipSection);
  emitPolygons(sidewalk, outerWalkEx, 0.11, 0.4);

  // Crisp 0.18 m raised curbs + vertical curb faces around every island & outer road edge
  const islandCurb = exToPaths(clipOp(ctDifference, allIslandPaths, offsetPaths(allIslandPaths, -0.18)));
  const outerCurb = exToPaths(clipOp(ctDifference, offsetPaths(drivablePaths, 0.18), [...drivablePaths, ...allIslandPaths]));
  const allCurbsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...islandCurb, ...outerCurb])), clipSection);
  emitPolygons(curb, allCurbsEx, 0.17, 0.05);
  emitCurbFaces(curbFaces, allIslandPaths, 0, 0.17);
  emitCurbFaces(curbFaces, outerCurb, 0, 0.17);

  // ── 3. RAZOR-SHARP APPLE MAPS / GOOGLE MAPS LANE PAINT ──
  const whitePolys = [];
  const dimPolys = [];
  const addRibbon = (target, pts, halfW) => {
    const r = ribbonRing(pts, halfW);
    if (r.length >= 3) target.push(toClipRing(r));
  };
  const addDashed = (target, pts, dashLen = 2.6, gapLen = 4.8, halfW = 0.072, phase = 0) => {
    const cum = polyCum(pts);
    const len = cum[cum.length - 1];
    for (const [d0, d1] of dashRuns(0.5, len - 0.5, dashLen, gapLen, phase)) {
      const piece = slicePoly(pts, cum, d0, d1);
      if (piece.length >= 2) addRibbon(target, piece, halfW);
    }
  };

  // 3a. Eastbound W Bellagio Dr lane dividers (3 lanes -> 4 lanes -> 5 lanes -> 3 Left-Turn ONLY lanes)
  // Upper section (x = -46 .. 55): dashed lane dividers
  const ebUpper = slicePoly(ebMainCenter, ebMainCum, 4, ebMainLen - 64);
  if (ebUpper.length >= 2) {
    for (const off of [-3.3, 0, 3.3]) {
      addDashed(whitePolys, offsetPoly(ebUpper, off), 2.5, 4.6, 0.072);
    }
  }
  // 3 Left-Turn ONLY lanes (x = 62 .. 117): dashed dividers + crisp solid edges + 2 rows of LEFT arrows + ONLY text!
  const ebLeftSeg = slicePoly(ebMainCenter, ebMainCum, ebMainLen - 60, ebMainLen - 5.2);
  if (ebLeftSeg.length >= 2) {
    addDashed(whitePolys, offsetPoly(ebLeftSeg, -1.65), 2.2, 3.8, 0.075);
    addDashed(whitePolys, offsetPoly(ebLeftSeg, 1.65), 2.2, 3.8, 0.075);
    addRibbon(whitePolys, offsetPoly(ebLeftSeg, -4.72), 0.08);
    addRibbon(whitePolys, offsetPoly(ebLeftSeg, 4.72), 0.08);

    const segCum = polyCum(ebLeftSeg);
    const segLen = segCum[segCum.length - 1];
    for (const laneOff of [-3.3, 0, 3.3]) {
      const pNear = samplePoly(ebLeftSeg, segCum, segLen - 5.5);
      const pOnly = samplePoly(ebLeftSeg, segCum, segLen - 15.0);
      const pFar = samplePoly(ebLeftSeg, segCum, segLen - 26.5);
      const nxN = -pNear.hz, nzN = pNear.hx;
      const nxO = -pOnly.hz, nzO = pOnly.hx;
      const nxF = -pFar.hz, nzF = pFar.hx;
      whitePolys.push(...arrowPolysWorld(pNear.x + nxN * laneOff, pNear.z + nzN * laneOff, pNear.hx, pNear.hz, ['left'], 3.1));
      whitePolys.push(...onlyTextPolys(pOnly.x + nxO * laneOff, pOnly.z + nzO * laneOff, pOnly.hx, pOnly.hz, 0.56));
      whitePolys.push(...arrowPolysWorld(pFar.x + nxF * laneOff, pFar.z + nzF * laneOff, pFar.hx, pFar.hz, ['left'], 3.1));
    }
    // Stop bar at LV Blvd crosswalk across all 3 left-turn lanes
    const pStop = samplePoly(ebLeftSeg, segCum, segLen - 0.6);
    const nxS = -pStop.hz, nzS = pStop.hx;
    addRibbon(whitePolys, [
      [pStop.x - nxS * 4.7, pStop.z - nzS * 4.7],
      [pStop.x + nxS * 4.7, pStop.z + nzS * 4.7],
    ], 0.24);
  }

  // 3b. Eastbound 2 Right-Turn ONLY lanes (311030165) + ONLY text + RIGHT arrows + chevron gore!
  const ebRtLen = ebRightTurnCum[ebRightTurnCum.length - 1];
  const ebRtSeg = slicePoly(ebRightTurnCenter, ebRightTurnCum, 10, ebRtLen - 6.0);
  if (ebRtSeg.length >= 2) {
    addDashed(whitePolys, ebRtSeg, 2.2, 3.8, 0.075);
    addRibbon(whitePolys, offsetPoly(ebRtSeg, -3.15), 0.08);
    addRibbon(whitePolys, offsetPoly(ebRtSeg, 3.15), 0.08);
    const rCum = polyCum(ebRtSeg);
    const rLen = rCum[rCum.length - 1];
    for (const laneOff of [-1.65, 1.65]) {
      const pNear = samplePoly(ebRtSeg, rCum, rLen - 5.2);
      const pOnly = samplePoly(ebRtSeg, rCum, rLen - 14.2);
      const pFar = samplePoly(ebRtSeg, rCum, rLen - 25.0);
      const nxN = -pNear.hz, nzN = pNear.hx;
      const nxO = -pOnly.hz, nzO = pOnly.hx;
      const nxF = -pFar.hz, nzF = pFar.hx;
      whitePolys.push(...arrowPolysWorld(pNear.x + nxN * laneOff, pNear.z + nzN * laneOff, pNear.hx, pNear.hz, ['right'], 3.1));
      whitePolys.push(...onlyTextPolys(pOnly.x + nxO * laneOff, pOnly.z + nzO * laneOff, pOnly.hx, pOnly.hz, 0.56));
      whitePolys.push(...arrowPolysWorld(pFar.x + nxF * laneOff, pFar.z + nzF * laneOff, pFar.hx, pFar.hz, ['right'], 3.1));
    }
  }

  // Chevron-hatched white painted gore separating EB 3 Left-Turn lanes & 2 Right-Turn lanes (matching bellagio_arrows.jpg!)
  whitePolys.push(...buildChevronGore(
    [[64.0, 585.4], [82.0, 585.0], [100.5, 583.6]],
    [[64.0, 585.4], [82.0, 586.8], [100.5, 586.8]],
    2.8, 0.085
  ));

  // 3c. Westbound W Bellagio Dr lane dividers + SB LV Blvd slip chevron gore!
  const wbLen = wbMainCum[wbMainCum.length - 1];
  const wbSeg = slicePoly(wbMainCenter, wbMainCum, 5.5, wbLen - 4.0);
  if (wbSeg.length >= 2) {
    addDashed(whitePolys, offsetPoly(wbSeg, -1.75), 2.5, 4.6, 0.075);
    addDashed(whitePolys, offsetPoly(wbSeg, 1.75), 2.5, 4.6, 0.075);
    addRibbon(whitePolys, offsetPoly(wbSeg, -4.85), 0.08);
    // Subtle westbound directional arrows (matching bellagio_arrows.jpg!)
    const wCum = polyCum(wbSeg);
    for (const d of [14, 34]) {
      const q = samplePoly(wbSeg, wCum, d);
      dimPolys.push(...arrowPolysWorld(q.x, q.z, q.hx, q.hz, ['through'], 3.1));
    }
  }

  // Chevron-hatched white gore between SB LV Blvd right-turn slip & WB Bellagio Dr (matching bellagio_arrows.jpg!)
  whitePolys.push(...buildChevronGore(
    [[74.0, 548.8], [94.0, 550.2], [116.5, 553.2]],
    [[74.0, 548.8], [94.0, 548.0], [116.5, 547.8]],
    2.6, 0.085
  ));

  // 3d. Crisp White V-Shaped Gore Lines at the Two Underground Tunnel Splits (matching Apple Maps Image 2!)
  // Fork #1: Lakeside Bellagio Dr vs Middle Tunnel Portal #1
  addRibbon(whitePolys, [[41.0, 535.6], [30.5, 530.4], [24.2, 527.0]], 0.085);
  addRibbon(whitePolys, [[41.0, 535.6], [30.5, 532.4], [23.8, 531.6]], 0.085);
  // Fork #2: Middle Tunnel Portal #1 vs South Tunnel Portal #2
  addRibbon(whitePolys, [[45.5, 540.0], [34.5, 537.5], [27.0, 535.0]], 0.085);
  addRibbon(whitePolys, [[45.5, 540.0], [34.5, 540.0], [26.5, 540.5]], 0.085);

  // Dashed lane divider along Lakeside Bellagio Drive (2 lanes)
  addDashed(whitePolys, lakeDriveCenter, 2.5, 4.6, 0.072);
  addRibbon(whitePolys, offsetPoly(lakeDriveCenter, 3.1), 0.078);
  addRibbon(whitePolys, offsetPoly(lakeDriveCenter, -3.1), 0.078);

  // Subtle arrows leading into Tunnel Portal #1 & Tunnel Portal #2 (matching Apple Maps Image 2!)
  for (const [pts, cum] of [[tunnel1Center, tunnel1Cum], [tunnel2Center, tunnel2Cum]]) {
    const len = cum[cum.length - 1];
    for (const d of [len * 0.45, len * 0.72]) {
      const q = samplePoly(pts, cum, d);
      dimPolys.push(...arrowPolysWorld(q.x, q.z, q.hx, q.hz, ['through'], 2.8));
    }
  }

  // 3e. Continental Zebra Crosswalks (LV Blvd east face + slip lane + Cosmopolitan north driveway!)
  const addZebra = (pA, pB, depth = 3.2) => {
    const dx = pB[0] - pA[0], dz = pB[1] - pA[1];
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    const nx = -uz, nz = ux;
    for (const [lo, hi] of zebraBars(0.35, len - 0.35)) {
      const a0 = [pA[0] + ux * lo - nx * (depth / 2), pA[1] + uz * lo - nz * (depth / 2)];
      const a1 = [pA[0] + ux * lo + nx * (depth / 2), pA[1] + uz * lo + nz * (depth / 2)];
      const b1 = [pA[0] + ux * hi + nx * (depth / 2), pA[1] + uz * hi + nz * (depth / 2)];
      const b0 = [pA[0] + ux * hi - nx * (depth / 2), pA[1] + uz * hi - nz * (depth / 2)];
      whitePolys.push(toClipRing([a0, a1, b1, b0]));
    }
  };
  // Crosswalk across WB Bellagio Dr at LV Blvd
  addZebra([119.5, 553.8], [119.0, 563.5], 3.1);
  // Crosswalk across EB 3 Left-Turn lanes at LV Blvd
  addZebra([119.2, 572.6], [119.0, 582.3], 3.1);
  // Crosswalk across SB LV Blvd Right-Turn Slip lane
  addZebra([115.2, 540.5], [118.4, 546.8], 2.9);
  // Crosswalk across Cosmopolitan North Driveway (Image 1 top center!)
  addZebra([46.5, 584.2], [53.2, 588.8], 2.8);

  // Clip all paint strictly inside drivable asphalt
  const whiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, whitePolys)), drivablePaths);
  const whitePaths = exToPaths(whiteEx);
  const dimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, dimPolys)), drivablePaths)), whitePaths);

  emitPolygons(paint, whiteEx, 0, 0.005);
  emitPolygons(paintDim, dimEx, 0, 0.005);
}

// ───────────────────────── 3D Architecture: Tunnel Portals, Hillside & Pedestrian Bridge ─────────────────────────

export function buildBellagioArchitecture() {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.name = 'Bellagio Drive Architecture';

  const matConcrete = new THREE.MeshStandardMaterial({ color: 0xb9b4ab, roughness: 0.88, metalness: 0.04 });
  const matConcreteDark = new THREE.MeshStandardMaterial({ color: 0x7b7872, roughness: 0.92, metalness: 0.04 });
  const matTunnelVoid = new THREE.MeshBasicMaterial({ color: 0x161922 });
  const matGrass = new THREE.MeshStandardMaterial({ color: 0x8cc86b, roughness: 0.92, metalness: 0.0 });
  const matStone = new THREE.MeshStandardMaterial({ color: 0xdfd2be, roughness: 0.78, metalness: 0.04 });
  const matTerracotta = new THREE.MeshStandardMaterial({ color: 0xd4845e, roughness: 0.68, metalness: 0.06 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x565d68, roughness: 0.45, metalness: 0.55 });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x8eb8d6, roughness: 0.16, metalness: 0.25, transparent: true, opacity: 0.58,
  });

  // 1. TWO ARCHITECTURAL CONCRETE TUNNEL PORTALS (matching Apple Maps Image 2!)
  const buildPortal = (x, z, headingRad, width = 6.2, height = 3.2) => {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = -headingRad; // local +X points INTO the tunnel

    // Dark recessed tunnel interior opening
    const voidBox = new THREE.Mesh(new THREE.BoxGeometry(4.5, height - 0.15, width - 0.6), matTunnelVoid);
    voidBox.position.set(2.2, (height - 0.15) / 2, 0);
    p.add(voidBox);

    // Concrete portal headwall lintel + side jambs
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, width + 1.4), matConcrete);
    lintel.position.set(0.15, height + 0.25, 0);
    p.add(lintel);

    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.1, height + 0.65, 0.7), matConcrete);
      jamb.position.set(0.15, (height + 0.65) / 2, side * (width / 2 + 0.35));
      p.add(jamb);

      // Sloped concrete wingwall flaring outward along the cut bank
      const wing = new THREE.Mesh(new THREE.BoxGeometry(4.8, height * 0.62, 0.45), matConcreteDark);
      wing.position.set(-2.3, height * 0.31, side * (width / 2 + 0.55));
      wing.rotation.y = side * -0.14;
      p.add(wing);
    }

    // Lush green sloped grass cap over the concrete headwall
    const cap = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.55, width + 2.8), matGrass);
    cap.position.set(2.9, height + 0.85, 0);
    p.add(cap);

    return p;
  };

  // Portal #1: Bellagio underground valet/bus tunnel at (-8.5, 532.4), heading west
  group.add(buildPortal(-8.5, 532.4, Math.PI - 0.15, 6.2, 3.1));
  // Portal #2: Underpass going beneath W Bellagio Dr at (4.5, 546.1), heading southwest
  group.add(buildPortal(4.5, 546.1, Math.PI - 0.58, 6.2, 2.9));

  // Softly sculpted lush green landscaped hillside mounds behind/over the portals (Apple Maps Image 2!)
  const addBerm = (x, z, rx, rz, h) => {
    const geo = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const mesh = new THREE.Mesh(geo, matGrass);
    mesh.scale.set(rx, h, rz);
    mesh.position.set(x, 0.08, z);
    group.add(mesh);
  };
  addBerm(-8.0, 514.0, 15.0, 11.0, 2.8);
  addBerm(7.5, 522.0, 10.5, 6.5, 2.1);
  addBerm(12.5, 537.5, 11.0, 4.2, 1.45);
  addBerm(32.0, 558.5, 14.0, 7.5, 1.3);

  // 2. BESPOKE BELLAGIO–COSMOPOLITAN PEDESTRIAN SKYBRIDGE (matching Apple Maps Image 1!)
  // Spans (-52.9, 551.4) -> (32.9, 611.5) -> (97.3, 611.8) at y = 6.8 m with warm terracotta roofs & pavilions!
  const deckY = 6.8;
  const addBridgeSpan = (p0, p1, width = 4.6) => {
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const span = new THREE.Group();
    span.position.set((p0[0] + p1[0]) / 2, deckY, (p0[1] + p1[1]) / 2);
    span.rotation.y = -angle;

    // Warm sandstone deck slab & underside soffit
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.72, width), matStone);
    span.add(deck);

    // Sleek glass curtain walls & steel mullions on both sides
    for (const side of [-1, 1]) {
      const glassWall = new THREE.Mesh(new THREE.BoxGeometry(len - 0.6, 2.4, 0.14), matGlass);
      glassWall.position.set(0, 1.55, side * (width / 2 - 0.12));
      span.add(glassWall);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.22), matSteel);
      rail.position.set(0, 2.82, side * (width / 2 - 0.1));
      span.add(rail);
    }

    // Warm terracotta/coral pitched roof along the full span
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

  // Iconic square terracotta hipped-roof elevator/escalator pavilions (placed strictly off asphalt!)
  const addPavilion = (x, z, rotY = 0) => {
    const pav = new THREE.Group();
    pav.position.set(x, 0, z);
    pav.rotation.y = rotY;

    // Sandstone elevator/support tower shaft
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(6.8, deckY + 3.2, 6.8), matStone);
    shaft.position.y = (deckY + 3.2) / 2;
    pav.add(shaft);

    // Dark recessed upper windows
    const band = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.1, 7.0), matGlass);
    band.position.y = deckY + 1.55;
    pav.add(band);

    // Iconic pyramidal/hipped terracotta roof
    const hip = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.6, 4), matTerracotta);
    hip.position.y = deckY + 4.45;
    hip.rotation.y = Math.PI / 4;
    pav.add(hip);

    group.add(pav);
  };

  // Two pavilions matching Apple Maps Image 1 (west Bellagio side & Cosmopolitan corner, both clear of roads!)
  addPavilion(-34.0, 564.6, -Math.atan2(b1[1] - b0[1], b1[0] - b0[0]));
  addPavilion(32.9, 611.5, 0);
  addPavilion(97.3, 611.8, 0);

  return group;
}
