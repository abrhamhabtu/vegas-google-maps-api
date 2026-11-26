import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { arrowMarking, dashRuns, zebraBars } from './road-visuals.mjs';
import { clearLayersInPoly } from './resort-drive-kit.mjs';

// Caesars Palace Front Valet Rotary, Porte-Cochere Motor Court, South Valet Boulevard,
// Front VIP Staging Lot, and North Colosseum Loop Junction (west of S Las Vegas Blvd).
// Local coordinates in metres: x east, y up, z south.
// Stays strictly west of S Las Vegas Blvd's southbound curb & Strip crosswalks (x <= 124.5)
// so Carbon's Strip carriageway and Strip-side crosswalks remain completely untouched.

export const CAESARS_DRIVE_BOUNDS = [-4.0, -152.0, 125.0, 48.0];

export const CAESARS_CLIP_POLY = [
  [-2.5, -10.0],
  [5.5, -24.0],
  [24.0, -38.0],
  [52.0, -49.0],
  [57.5, -106.0],
  [52.0, -135.0],
  [54.0, -150.0],
  [76.0, -150.0],
  [84.0, -137.0],
  [124.5, -137.0],
  [124.5, -104.0],
  [122.0, -96.0],
  [122.0, -20.0],
  [86.0, -20.0],
  [73.0, -33.0],
  [58.5, -12.0],
  [57.5, 22.0],
  [52.0, 43.0],
  [36.0, 45.0],
  [22.0, 44.0],
  [5.0, 38.0],
  [-2.5, 22.0],
];

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

function ellipseRing(cx, cz, rx, rz, steps = 64) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]);
  }
  return out;
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
  return { x: pts[i][0] + dx * t, z: pts[i][1] + dz * t, hx: dx / seg, hz: dz / seg };
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
    const nx = -dz / seg, nz = dx / seg;
    const off = typeof offsetFn === 'function' ? offsetFn(cum[i] / len, cum[i]) : offsetFn;
    out.push([pts[i][0] + nx * off, pts[i][1] + nz * off]);
  }
  return out;
}

function ribbonRing(pts, halfW) {
  if (pts.length < 2) return [];
  return [...offsetPoly(pts, -halfW), ...offsetPoly(pts, halfW).reverse()];
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

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function nearBoundary(mx, mz, ring, eps = 0.28) {
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    if (distToSeg(mx, mz, ax, az, bx, bz) <= eps) return true;
  }
  return false;
}

function emitPolygons(layer, polys, y, minArea = 0.02) {
  for (const { outer, holes } of polys) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minArea * MM * MM) continue;
    const ring = fromClipRing(outer);
    const [x, z] = ring[0];
    layer.at(x, z).polygon(ring, y, holes.map(fromClipRing));
  }
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

function arrowPolysWorld(cx, cz, hx, hz, movements, laneW = 3.0) {
  const nx = -hz, nz = hx;
  return arrowMarking(movements, laneW).map(poly =>
    toClipRing(poly.map(([u, v]) => [cx + nx * u + hx * v, cz + nz * u + hz * v]))
  );
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

// ───────────────────────── Main Caesars Palace Drive Builder ─────────────────────────

export function finishCaesarsDrivePavement(layers) {
  const { major, asphalt, service, slipPavement, sidewalk, concreteMedians, medians,
    medianPaving, medianPlanting, frontagePlanting, curb, curbFaces, paint, paintDim, paintYellow } = layers;

  const clipSection = [toClipRing(CAESARS_CLIP_POLY)];
  clearLayersInPoly(layers, CAESARS_DRIVE_BOUNDS, clipSection, CAESARS_CLIP_POLY);

  // 1. UNIFIED CAESARS PALACE OVAL ROTARY & PORTE-COCHERE MOTOR COURT (traced to Google Satellite + Road)
  const rotaryCourt = roundCorners([toClipRing([
    [13.5, -24.5],
    [6.0, -14.5],
    [1.6, -2.5],
    [1.2, 11.0],
    [3.5, 24.0],
    [10.5, 34.5],
    [21.0, 39.2],
    [33.5, 39.0],
    [44.5, 34.0],
    [51.2, 24.5],
    [53.5, 13.0],
    [53.2, 1.0],
    [51.8, -8.5],
    [40.0, -14.0],
    [26.0, -20.0],
  ])], 3.5);

  // Inbound approach sweeping SW from Caesars Palace Drive / Colosseum Junction
  const inboundCenter = smoothPoly([
    [66.2, -133.5],
    [68.4, -118.0],
    [69.4, -105.0],
    [68.6, -86.0],
    [66.2, -64.0],
    [62.5, -48.0],
    [54.5, -39.5],
    [41.0, -33.5],
    [27.5, -26.5],
    [16.0, -18.5],
    [9.5, -9.0],
  ], 5);
  const inboundCum = polyCum(inboundCenter);
  const inboundRing = toClipRing(ribbonRing(inboundCenter, 5.2));

  // Inner approach branch (1232959271) curving directly into the north arc of the rotary
  const innerApproachCenter = smoothPoly([
    [68.0, -47.0],
    [56.5, -36.0],
    [44.0, -29.0],
    [30.5, -21.5],
    [18.5, -10.0],
  ], 4);
  const innerApproachRing = toClipRing(ribbonRing(innerApproachCenter, 4.2));

  // Outbound exit (1135648878 -> 1135648876 -> 964588228) rising NE & north to Caesars Palace Drive
  const outboundCenter = smoothPoly([
    [48.0, 4.0],
    [50.0, -8.5],
    [55.5, -20.0],
    [65.5, -32.0],
    [74.5, -45.5],
    [78.5, -60.0],
    [79.4, -84.0],
    [79.5, -108.0],
    [79.8, -120.5],
    [85.5, -120.2],
  ], 5);
  const outboundCum = polyCum(outboundCenter);
  const outboundRing = toClipRing(ribbonRing(outboundCenter, 4.1));

  // North Colosseum Loop Junction & Caesars Palace Drive approaches (strictly west of Strip x <= 124.5)
  // Extended 5 m past clip edges so every open mouth (east to Strip, NW to Colosseum) stays curb-free!
  const cpDriveWB = smoothPoly([
    [130.0, -130.6],
    [104.0, -130.5],
    [86.0, -130.2],
    [78.5, -133.1],
    [72.0, -141.5],
    [64.5, -154.5],
  ], 4);
  const cpDriveWBRing = toClipRing(ribbonRing(cpDriveWB, 4.5));

  const cpDriveEB = smoothPoly([
    [52.5, -154.5],
    [60.0, -142.5],
    [67.5, -131.5],
    [77.0, -122.0],
    [88.0, -119.8],
    [108.0, -120.1],
    [130.0, -120.0],
  ], 4);
  const cpDriveEBRing = toClipRing(ribbonRing(cpDriveEB, 4.3));

  // Sweeping SB slip ramp toward Las Vegas Blvd (374989499)
  const cpSlipCenter = smoothPoly([
    [94.0, -119.8],
    [106.0, -118.8],
    [116.5, -114.2],
    [125.0, -107.2],
    [129.5, -101.0],
  ], 4);
  const cpSlipRing = toClipRing(ribbonRing(cpSlipCenter, 3.8));

  // Smooth central junction box bridging WB, EB, Colosseum, and N-S boulevard (eliminates jagged OSM triangles!)
  const northJctApron = roundCorners([toClipRing([
    [62.0, -137.0],
    [86.0, -135.0],
    [88.5, -115.5],
    [64.5, -115.0],
  ])], 3.0);

  // South valet / limo staging spur (921294388 / 921294389 — extended cleanly past clip for curb-free mouth)
  const southSpurCenter = smoothPoly([
    [35.0, 31.5],
    [41.5, 38.0],
    [48.5, 44.0],
    [56.0, 47.0],
  ], 4);
  const southSpurRing = toClipRing(ribbonRing(southSpurCenter, 4.2));

  // East VIP staging lot entry mouth (x = 74 .. 93 at z = -46.7)
  const lotConnCenter = [
    [74.0, -46.8],
    [93.5, -46.6],
  ];
  const lotConnRing = toClipRing(ribbonRing(lotConnCenter, 3.5));

  // Continuous throat apron bridging inbound, inner approach & outbound around the teardrop median
  const throatFill = toClipRing([
    [34.0, -32.0],
    [62.0, -44.0],
    [74.0, -46.0],
    [66.0, -31.0],
    [52.0, -14.0],
    [36.0, -14.0],
  ]);

  const rawAsphalt = exToPaths(clipOp(ctUnion, [
    ...rotaryCourt, inboundRing, innerApproachRing, outboundRing,
    cpDriveWBRing, cpDriveEBRing, cpSlipRing, ...northJctApron,
    southSpurRing, lotConnRing, throatFill,
  ]));
  const smoothAsphalt = offsetPaths(offsetPaths(rawAsphalt, 1.8), -1.8);

  // 2. FOUNTAIN ISLAND & LANDSCAPED MEDIANS (exact satellite positions!)
  // Oval Caesars entrance fountain court (centered tightly on the satellite/OSM oval fountain)
  const fountainIsland = [toClipRing(ellipseRing(30.6, 10.6, 8.3, 14.3, 64))];
  // Sleek wedge-shaped planted teardrop median between inbound & outbound crosswalks (matched to satellite)
  const neckTeardrop = roundCorners([toClipRing([
    [38.5, -19.2],
    [46.8, -24.5],
    [49.6, -21.2],
    [43.4, -14.2],
    [38.6, -16.4],
  ])], 1.6);
  // North-south landscaped boulevard median between SB inbound & NB outbound (z = -101 .. -59)
  const nsMedian = roundCorners([toClipRing([
    [71.8, -101.5],
    [75.4, -101.5],
    [75.4, -58.5],
    [71.8, -58.5],
  ])], 1.5);
  // East-west Caesars Palace Drive center median between WB & EB (x = 91 .. 121, z = -126.2 .. -124.0)
  const cpEwMedian = roundCorners([toClipRing([
    [91.0, -126.2],
    [120.8, -126.2],
    [120.8, -123.9],
    [91.0, -123.9],
  ])], 0.95);
  // Landscaped island north of the VIP staging lot & south of the EB slip ramp (matched to satellite!)
  const northLotIsland = roundCorners([toClipRing([
    [87.5, -112.0],
    [106.0, -113.2],
    [116.5, -106.5],
    [119.5, -96.5],
    [87.5, -96.5],
  ])], 2.4);

  const allIslands = [...fountainIsland, ...neckTeardrop, ...nsMedian, ...cpEwMedian];
  const drivableUnclipped = exToPaths(clipOp(ctDifference, smoothAsphalt, allIslands));
  const drivableEx = clipOp(ctIntersection, drivableUnclipped, clipSection);
  const drivablePaths = exToPaths(drivableEx);
  emitPolygons(major, drivableEx, 0, 0.05);

  // Clean paved Front VIP / Valet Staging Lot (x = 89.2 .. 119.5, z = -93.5 .. -23.0) on `service`
  // (ORDER.road = 40 > aisle ORDER.road - 1 = 39), replacing the disconnected hollow dark OSM loop 573747499!
  const vipLotRaw = roundCorners([toClipRing([
    [89.4, -93.5],
    [119.4, -93.5],
    [119.4, -23.0],
    [89.4, -23.0],
  ])], 2.6);
  const vipLotOnly = clipOp(ctIntersection, exToPaths(clipOp(ctDifference, vipLotRaw, drivableUnclipped)), clipSection);
  const vipLotPaths = exToPaths(vipLotOnly);
  emitPolygons(service, vipLotOnly, 0, 0.2);

  // Landscaped planter strips bordering the VIP staging lot on the west (x = 83.6..88.8) & north (northLotIsland)
  const westLotPlanterN = roundCorners([toClipRing([
    [83.8, -93.2],
    [88.6, -93.2],
    [88.6, -51.0],
    [83.8, -51.0],
  ])], 1.2);
  const westLotPlanterS = roundCorners([toClipRing([
    [83.8, -42.5],
    [88.6, -42.5],
    [88.6, -24.5],
    [83.8, -24.5],
  ])], 1.2);

  const allPavedUnclipped = exToPaths(clipOp(ctUnion, [...drivableUnclipped, ...vipLotRaw]));

  // Raised concrete island bases + lush green planting inside teardrop, N-S median, E-W median & lot planters
  const extraIslands = [...northLotIsland, ...westLotPlanterN, ...westLotPlanterS];
  const allIslandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...allIslands, ...extraIslands])), clipSection);
  const allIslandPaths = exToPaths(allIslandsEx);
  emitPolygons(concreteMedians, allIslandsEx, 0.11, 0.2);

  const greenRaw = exToPaths(clipOp(ctUnion, [
    ...offsetPaths(neckTeardrop, -0.45),
    ...offsetPaths(nsMedian, -0.42),
    ...offsetPaths(cpEwMedian, -0.35),
    ...offsetPaths(northLotIsland, -0.65),
    ...offsetPaths(westLotPlanterN, -0.45),
    ...offsetPaths(westLotPlanterS, -0.45),
  ]));
  const greenEx = clipOp(ctIntersection, greenRaw, allIslandPaths);
  emitPolygons(medianPlanting, greenEx, 0.124, 0.3);

  // Outer sidewalks computed from UNCLIPPED pavement so open Strip/Colosseum/south mouths stay 100% curb-free!
  const outerWalkBand = offsetPaths(allPavedUnclipped, 2.4);
  const outerWalkEx = clipOp(ctIntersection, exToPaths(clipOp(ctDifference, outerWalkBand, [...allPavedUnclipped, ...allIslandPaths])), clipSection);
  emitPolygons(sidewalk, outerWalkEx, 0.11, 0.35);

  const islandCurb = exToPaths(clipOp(ctDifference, allIslandPaths, offsetPaths(allIslandPaths, -0.18)));
  const outerCurbUnclipped = exToPaths(clipOp(ctDifference, offsetPaths(allPavedUnclipped, 0.18), [...allPavedUnclipped, ...allIslandPaths]));
  const allCurbsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...islandCurb, ...outerCurbUnclipped])), clipSection);
  emitPolygons(curb, allCurbsEx, 0.17, 0.05);
  emitCurbFaces(curbFaces, allIslandPaths, 0, 0.17, CAESARS_CLIP_POLY);
  emitCurbFaces(curbFaces, exToPaths(clipOp(ctIntersection, outerCurbUnclipped, clipSection)), 0, 0.17, CAESARS_CLIP_POLY);

  // Subtle painted parking bay guides inside the clean VIP staging lot (matching satellite layout)
  const lotPaint = [];
  for (let z = -88; z <= -28; z += 6.0) {
    lotPaint.push(toClipRing([[90.5, z - 0.07], [95.5, z - 0.07], [95.5, z + 0.07], [90.5, z + 0.07]]));
    lotPaint.push(toClipRing([[113.0, z - 0.07], [118.2, z - 0.07], [118.2, z + 0.07], [113.0, z + 0.07]]));
  }
  const lotPaintEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, lotPaint)), vipLotPaths);
  emitPolygons(paintDim, lotPaintEx, 0, 0.005);

  // 3. CRISP LANE MARKINGS & CONTINENTAL ZEBRA CROSSWALKS
  const whitePolys = [];
  const dimPolys = [];
  const addRibbon = (target, pts, halfW) => {
    const r = ribbonRing(pts, halfW);
    if (r.length >= 3) target.push(toClipRing(r));
  };
  const addDashed = (target, pts, dashLen = 2.4, gapLen = 4.2, halfW = 0.072) => {
    const cum = polyCum(pts);
    const len = cum[cum.length - 1];
    for (const [d0, d1] of dashRuns(0.5, len - 0.5, dashLen, gapLen, 0)) {
      const piece = slicePoly(pts, cum, d0, d1);
      if (piece.length >= 2) addRibbon(target, piece, halfW);
    }
  };

  // Concentric oval dashed divider around Caesars fountain rotary (separating inner rotary & porte-cochere lanes)
  const ovalDivider = ellipseRing(30.6, 10.6, 14.4, 20.5, 72);
  ovalDivider.push(ovalDivider[0]);
  addDashed(whitePolys, ovalDivider, 2.2, 3.8, 0.07);
  // Subtle counter-clockwise flow arrows around rotary
  for (const [ax, az, hx, hz] of [
    [8.2, 10.5, 0, 1],
    [31.5, 33.0, 1, 0],
    [48.5, 11.0, 0, -1],
    [30.5, -10.5, -0.95, 0.3],
  ]) {
    dimPolys.push(...arrowPolysWorld(ax, az, hx, hz, ['through'], 2.9));
  }

  // Inbound & outbound boulevard lane dividers (stopping cleanly outside crosswalks!)
  const inNorth = slicePoly(inboundCenter, inboundCum, 32.0, 74.0);
  if (inNorth.length >= 2) addDashed(whitePolys, inNorth, 2.4, 4.4, 0.072);
  const inSouth = slicePoly(inboundCenter, inboundCum, 86.0, inboundCum.at(-1) - 10.0);
  if (inSouth.length >= 2) addDashed(whitePolys, inSouth, 2.4, 4.4, 0.072);

  const outNorth = slicePoly(outboundCenter, outboundCum, 66.0, 108.0);
  if (outNorth.length >= 2) addDashed(whitePolys, outNorth, 2.4, 4.4, 0.072);
  const outSouth = slicePoly(outboundCenter, outboundCum, 18.0, 54.0);
  if (outSouth.length >= 2) addDashed(whitePolys, outSouth, 2.4, 4.4, 0.072);

  // North Caesars Palace Drive E-W lane dividers & directional arrows
  addDashed(whitePolys, [[90.0, -130.5], [123.5, -130.5]], 2.4, 4.0, 0.072);
  addDashed(whitePolys, [[90.0, -120.0], [123.5, -120.0]], 2.4, 4.0, 0.072);
  dimPolys.push(...arrowPolysWorld(105.0, -132.4, -1, 0, ['through'], 2.9));
  dimPolys.push(...arrowPolysWorld(105.0, -128.4, -1, 0, ['left'], 2.9));
  dimPolys.push(...arrowPolysWorld(102.0, -121.6, 1, 0, ['left'], 2.9));
  dimPolys.push(...arrowPolysWorld(116.0, -114.2, 0.82, 0.57, ['right'], 2.9));

  // Subtle directional arrows on inbound & outbound lanes
  dimPolys.push(...arrowPolysWorld(66.5, -76.0, -0.08, 0.99, ['through'], 2.9));
  dimPolys.push(...arrowPolysWorld(79.2, -76.0, 0.04, -0.99, ['through'], 2.9));

  // 5 Continental Zebra Crosswalks (matched to Google Satellite!)
  const addZebra = (pA, pB, depth = 3.0) => {
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
  // 1) Crosswalk across inbound approach neck (aligned to Google Satellite zebra bars)
  addZebra([29.8, -32.2], [38.8, -22.5], 2.9);
  // 2) Crosswalk across outbound exit neck
  addZebra([45.8, -18.5], [53.0, -10.8], 2.9);
  // 3) Crosswalk across Caesars Valet Boulevard at z = -54.5
  addZebra([60.2, -54.5], [82.8, -54.5], 3.0);
  // 4) Crosswalk across north Colosseum NW leg (aligned to Google Satellite)
  addZebra([66.0, -138.8], [73.8, -133.2], 2.8);
  // 5) Crosswalk across Caesars Palace Drive EB / slip throat (x = 110.5)
  addZebra([111.5, -124.2], [108.5, -114.8], 2.8);

  const whiteEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, whitePolys)), drivablePaths);
  const whitePaths = exToPaths(whiteEx);
  const dimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, dimPolys)), drivablePaths)), whitePaths);

  emitPolygons(paint, whiteEx, 0, 0.005);
  emitPolygons(paintDim, dimEx, 0, 0.005);
}
