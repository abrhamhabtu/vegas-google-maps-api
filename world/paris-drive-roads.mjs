import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { arrowMarking, zebraBars } from './road-visuals.mjs';

// Paris Drive & L'Arc de Triomphe Rotary (from South Las Vegas Blvd east curb to East Paris Drive).
// Local coordinates in metres: x east, y up, z south.
export const PARIS_ROTARY = {
  cx: 265.39,
  cz: 516.89,
  innerR: 21.3,   // Circular concrete plaza around L'Arc de Triomphe (piers max r = 17.71 m)
  outerR: 31.2,   // 3 concentric lanes x 3.3 m = 9.9 m (clears overhead porte-cochere canopy)
  laneW: 3.3,
};

// Clip boundary starting flush at the east edge of Northbound South Las Vegas Blvd (x = 162.4)
// and staying clear of the south Miracle Mile service road (z > 554.5).
export const PARIS_DRIVE_BOUNDS = [162.4, 481.5, 326.0, 554.5];

const PARIS_WAY_LANES = new Map([
  [1016480468, 2], // Eastbound Paris Drive (west half — OSM mistakenly tagged 3)
  [1046878892, 2], // Eastbound Paris Drive (east half — OSM mistakenly tagged 4)
  [114697075, 3],  // Westbound Paris Drive (3 lanes approaching LV Blvd: L | T+R | R)
  [1419075070, 3], // Arc rotary west arc
  [1419075071, 3], // Arc rotary southwest arc
  [1419075072, 3], // Arc rotary southeast arc
  [111367827, 3],  // Arc rotary east-north-northwest arc
  [218654265, 2],  // Southeast exit from rotary toward East Paris Drive
  [218654264, 2],  // Southeast entry into rotary from East Paris Drive
]);

const PARIS_WAY_TURNS = new Map([
  [114697075, 'left|through;right|right'],
]);

export function parisDriveLaneCount(way) {
  return PARIS_WAY_LANES.get(way.id);
}

export function parisDriveTurns(way) {
  return PARIS_WAY_TURNS.get(way.id);
}

export function isParisDriveWay(way) {
  return PARIS_WAY_LANES.has(way.id) || way.id === 1013049942;
}

// ───────────────────────── Clipper Geometry Helpers ─────────────────────────

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

function circleRing(cx, cz, r, steps = 96) {
  const ring = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return ring;
}

function stadiumRing(x0, x1, zMid, halfW, arcSteps = 20) {
  const r = halfW;
  const lx = x0 + r;
  const rx = x1 - r;
  const ring = [];
  for (let i = 0; i <= arcSteps; i++) {
    const a = -Math.PI / 2 + (i / arcSteps) * Math.PI;
    ring.push([rx + Math.cos(a) * r, zMid + Math.sin(a) * r]);
  }
  for (let i = 0; i <= arcSteps; i++) {
    const a = Math.PI / 2 + (i / arcSteps) * Math.PI;
    ring.push([lx + Math.cos(a) * r, zMid + Math.sin(a) * r]);
  }
  return ring;
}

function ribbonRing(pts, halfW) {
  const n = pts.length;
  if (n < 2) return [];
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;
    left.push([pts[i][0] + nx * halfW, pts[i][1] + nz * halfW]);
    right.push([pts[i][0] - nx * halfW, pts[i][1] - nz * halfW]);
  }
  return [...left, ...right.reverse()];
}

function quadBezier(p0, p1, p2, steps = 20) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
  return pts;
}

function arcPts(cx, cz, r, a0, a1, steps = 64) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
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
      soup.idx.push(v0, v1, v2, v0, v2, v3);
      soup.idx.push(v0, v2, v1, v0, v3, v2);
    }
  }
}

// Clip out all legacy triangles inside clipSection from a Chunked layer.
function clearLayerInSection(layer, bounds, clipSection) {
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
        // Drop vertical curb faces inside the Paris Drive clip box.
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

// Transform arrowMarking polygons into world (x, z) given center and forward heading (hx, hz).
function arrowPolysWorld(cx, cz, hx, hz, movements, laneW = 3.3) {
  const nx = -hz, nz = hx;
  return arrowMarking(movements, laneW).map(poly =>
    toClipRing(poly.map(([u, v]) => [cx + nx * u + hx * v, cz + nz * u + hz * v]))
  );
}

// Crisp vector polygon strokes for pavement "STOP" text.
function stopTextPolys(cx, cz, hx, hz, scale = 0.72) {
  // Letters defined in local [u (right), v (forward)] inside [-0.45..0.45, -0.75..0.75]
  const strokes = {
    S: [
      [[0.38, 0.72], [-0.38, 0.72], [-0.38, 0.04], [0.38, 0.04], [0.38, -0.72], [-0.38, -0.72]],
    ],
    T: [
      [[-0.42, 0.72], [0.42, 0.72]],
      [[0, 0.72], [0, -0.72]],
    ],
    O: [
      [[-0.36, 0.72], [0.36, 0.72], [0.36, -0.72], [-0.36, -0.72], [-0.36, 0.72]],
    ],
    P: [
      [[-0.36, -0.72], [-0.36, 0.72], [0.36, 0.72], [0.36, 0.04], [-0.36, 0.04]],
    ],
  };
  const nx = -hz, nz = hx;
  const letters = ['S', 'T', 'O', 'P'];
  const spacing = 1.08 * scale;
  const startU = -((letters.length - 1) * spacing) / 2;
  const polys = [];
  for (let i = 0; i < letters.length; i++) {
    const uOff = startU + i * spacing;
    for (const line of strokes[letters[i]]) {
      const worldPts = line.map(([u, v]) => {
        const uu = uOff + u * scale;
        const vv = v * scale;
        return [cx + nx * uu + hx * vv, cz + nz * uu + hz * vv];
      });
      const r = ribbonRing(worldPts, 0.11 * scale);
      if (r.length >= 3) polys.push(toClipRing(r));
    }
  }
  return polys;
}

// ───────────────────────── Main Paris Drive Builder ─────────────────────────

export function finishParisDrivePavement(layers) {
  const { major, asphalt, service, slipPavement, sidewalk, concreteMedians, medians,
    medianPaving, medianPlanting, frontagePlanting, curb, curbFaces, paint, paintDim, paintYellow } = layers;

  const [west, north, east, south] = PARIS_DRIVE_BOUNDS;
  const clipSection = [toClipRing([[west, north], [east, north], [east, south], [west, south]])];

  for (const layer of [major, asphalt, service, slipPavement, sidewalk, concreteMedians, medians,
    medianPaving, medianPlanting, frontagePlanting, curb, curbFaces, paint, paintDim, paintYellow]) {
    if (layer) clearLayerInSection(layer, PARIS_DRIVE_BOUNDS, clipSection);
  }

  const { cx, cz, innerR, outerR } = PARIS_ROTARY;

  // 1. DRIVABLE ASPHALT GEOMETRY
  const wbZ0 = 504.4, wbZ1 = 514.4; // Westbound 3 lanes (10.0 m)
  const ebZ0 = 522.4, ebZ1 = 529.0; // Eastbound 2 lanes (6.6 m)

  // Rotary outer disk (31.2 m) minus circular Arc plaza (21.3 m)
  const rotaryOuter = toClipRing(circleRing(cx, cz, outerR, 128));
  const arcPlaza = toClipRing(circleRing(cx, cz, innerR, 128));

  // Westbound straight carriageway + smooth north & south flares into LV Blvd and rotary
  const wbStraight = toClipRing([
    [west, wbZ0 - 5.2],
    [168.5, wbZ0 - 1.4],
    [175.0, wbZ0],
    [244.0, wbZ0],
    [252.0, wbZ0 - 3.5],
    [252.0, wbZ1 + 3.0],
    [172.0, wbZ1],
    [west, wbZ1 + 1.0],
  ]);

  // Eastbound straight carriageway + smooth flare into LV Blvd and curve into SW rotary
  const ebStraight = toClipRing([
    [west, ebZ0 - 1.0],
    [242.0, ebZ0],
    [248.0, ebZ1 + 4.0],
    [234.0, ebZ1],
    [174.0, ebZ1],
    [167.5, ebZ1 + 1.8],
    [west, ebZ1 + 5.2],
  ]);

  // Clean U-turn / median crossover gap at x = 191.8
  const medianCut = toClipRing([
    [188.0, wbZ1 - 0.5],
    [195.8, wbZ1 - 0.5],
    [195.8, ebZ0 + 0.5],
    [188.0, ebZ0 + 0.5],
  ]);

  // Throat connecting WB & EB into the west side of the rotary cleanly
  const westThroat = toClipRing([
    [229.5, wbZ0 - 0.8],
    [250.0, 495.5],
    [250.0, 539.5],
    [229.5, ebZ1 + 0.8],
  ]);

  // Southeast exit leg (218654265): sweeping smoothly from south rim of rotary to East Paris Dr
  const seExitPts = [
    ...quadBezier([253.0, 542.5], [268.0, 548.0], [292.0, 547.8], 24),
    [312.0, 547.6],
    [east, 547.5],
  ];
  const seExit = toClipRing(ribbonRing(seExitPts, 3.4));

  // Southeast entry leg (218654264): sweeping smoothly from East Paris Dr up into east rim of rotary
  const seEntryPts = [
    [east, 547.5],
    [312.0, 547.6],
    ...quadBezier([308.0, 547.6], [296.5, 542.5], [291.6, 523.7], 24),
  ];
  const seEntry = toClipRing(ribbonRing(seEntryPts, 3.4));

  // Smooth corner fillets at LV Blvd, rotary mouths, and SE merge
  const rawAsphaltUnion = exToPaths(clipOp(ctUnion, [
    rotaryOuter, wbStraight, ebStraight, medianCut, westThroat, seExit, seEntry,
  ]));
  // Gently round sharp exterior junctions while preserving exact edges
  const smoothedAsphalt = offsetPaths(offsetPaths(rawAsphaltUnion, 2.2), -2.2);

  // Subtract the circular Arc de Triomphe center plaza and the two Paris Dr concrete median islands
  const westMedian = toClipRing(stadiumRing(168.4, 188.0, 518.4, 3.4, 24));
  const eastMedian = toClipRing(stadiumRing(195.8, 232.8, 518.4, 3.4, 24));

  // Southeast splitter island (clean rounded concrete triangle between rotary, seExit, seEntry)
  const seSplitterRaw = [toClipRing([
    [275.5, 544.0],
    [289.2, 544.2],
    [293.0, 538.5],
    [286.8, 536.2],
  ])];
  const seSplitter = roundCorners(seSplitterRaw, 1.4);

  const allIslands = [arcPlaza, westMedian, eastMedian, ...seSplitter];
  const drivableEx = clipOp(ctIntersection, exToPaths(clipOp(ctDifference, smoothedAsphalt, allIslands)), clipSection);
  const drivablePaths = exToPaths(drivableEx);

  // Emit crisp slate asphalt on `major` so it matches South Las Vegas Blvd seamlessly
  emitPolygons(major, drivableEx, 0, 0.05);

  // 2. RAISED CONCRETE ISLANDS, SIDEWALKS & CURBS (ZERO OVERLAP WITH ASPHALT)
  const islandsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, allIslands)), clipSection);
  const islandPaths = exToPaths(islandsEx);
  emitPolygons(concreteMedians, islandsEx, 0.11, 0.2);

  // Clean outer sidewalk apron hugging the north, south, and curved porte-cochere perimeter
  const outerWalkBand = offsetPaths(drivablePaths, 2.8);
  const outerWalkEx = clipOp(ctIntersection, exToPaths(clipOp(ctDifference, outerWalkBand, [...drivablePaths, ...islandPaths])), clipSection);
  emitPolygons(sidewalk, outerWalkEx, 0.11, 0.4);

  // Crisp 0.18 m raised curbs + vertical curb risers around every island AND along the outer asphalt edge
  const islandCurbRing = exToPaths(clipOp(ctDifference, islandPaths, offsetPaths(islandPaths, -0.18)));
  const outerCurbRing = exToPaths(clipOp(ctDifference, offsetPaths(drivablePaths, 0.18), [...drivablePaths, ...islandPaths]));
  const allCurbsEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, [...islandCurbRing, ...outerCurbRing])), clipSection);
  emitPolygons(curb, allCurbsEx, 0.17, 0.05);
  emitCurbFaces(curbFaces, islandPaths, 0, 0.17);
  emitCurbFaces(curbFaces, outerCurbRing, 0, 0.17);

  // 3. RAZOR-SHARP APPLE MAPS / GOOGLE MAPS LANE MARKINGS (CLIPPED STRICTLY INSIDE DRIVABLE ASPHALT)
  const whitePolys = [];
  const dimPolys = [];
  const yellowPolys = [];

  const addRibbon = (target, pts, halfW) => {
    const r = ribbonRing(pts, halfW);
    if (r.length >= 3) target.push(toClipRing(r));
  };

  // 3a. Concentric 3-lane rotary rings around L'Arc de Triomphe
  // Inner edge line (hugging circular Arc plaza curb)
  addRibbon(whitePolys, arcPts(cx, cz, innerR + 0.35, 0, Math.PI * 2, 128), 0.075);
  // Concentric lane divider 1 (between inner lane 0 & middle lane 1) — continuous 360°
  addRibbon(whitePolys, arcPts(cx, cz, innerR + 3.3, 0, Math.PI * 2, 128), 0.075);
  // Concentric lane divider 2 (between middle lane 1 & outer lane 2) — continuous 360°
  addRibbon(whitePolys, arcPts(cx, cz, innerR + 6.6, 0, Math.PI * 2, 128), 0.075);
  // Outer edge line along the porte-cochere / north-east rim (from SE entry to WB exit)
  addRibbon(whitePolys, arcPts(cx, cz, outerR - 0.35, -Math.PI * 0.87, Math.PI * 0.07, 80), 0.075);
  // Outer edge line along the southwest rim (between EB entry and SE exit)
  addRibbon(whitePolys, arcPts(cx, cz, outerR - 0.35, Math.PI * 0.56, Math.PI * 0.86, 36), 0.075);

  // Subtle counter-clockwise directional flow arrows around the rotary (middle lane, r = 26.25 m)
  // Note: in (x east, z south), counter-clockwise visually from above is DECREASING angle a!
  // Tangent for decreasing angle: hx = sin(a), hz = -cos(a)
  for (const deg of [-90, -15, 60, 180]) {
    const a = (deg * Math.PI) / 180;
    const r = innerR + 4.95;
    const ax = cx + Math.cos(a) * r;
    const az = cz + Math.sin(a) * r;
    const hx = Math.sin(a), hz = -Math.cos(a);
    dimPolys.push(...arrowPolysWorld(ax, az, hx, hz, ['through'], 3.0));
  }

  // 3b. Westbound Paris Drive (3 lanes, z = 504.4 .. 514.4, heading west hx = -1, hz = 0)
  const wbStopX = 167.5;
  const wbDiv1Z = 511.08; // Between lane 0 (left) and lane 1 (through+right)
  const wbDiv2Z = 507.72; // Between lane 1 (through+right) and lane 2 (right)
  // Solid lane dividers from stop bar smoothly into rotary
  addRibbon(whitePolys, [[wbStopX + 0.4, wbDiv1Z], [235.5, wbDiv1Z], [239.0, 511.8]], 0.075);
  addRibbon(whitePolys, [[wbStopX + 0.4, wbDiv2Z], [236.0, wbDiv2Z], [240.5, 507.0]], 0.075);
  // Edge lines (north curb & median side)
  addRibbon(whitePolys, [[wbStopX + 0.4, wbZ0 + 0.32], [238.5, wbZ0 + 0.32]], 0.075);
  addRibbon(whitePolys, [[169.5, wbZ1 - 0.32], [187.5, wbZ1 - 0.32]], 0.075);
  addRibbon(whitePolys, [[196.2, wbZ1 - 0.32], [232.0, wbZ1 - 0.32]], 0.075);

  // Westbound stop bar
  addRibbon(whitePolys, [[wbStopX, wbZ0 + 0.3], [wbStopX, wbZ1 - 0.3]], 0.24);

  // Westbound continental zebra crosswalk (at x = 163.5 .. 166.7)
  for (const [zLo, zHi] of zebraBars(wbZ0 + 0.35, wbZ1 - 0.35)) {
    whitePolys.push(toClipRing([[163.5, zLo], [166.7, zLo], [166.7, zHi], [163.5, zHi]]));
  }

  // Westbound turn arrows matching Apple Maps reference (Lane 0: Left, Lane 1: Through/Right, Lane 2: Right)
  // Row 1 (close to LV Blvd crosswalk)
  whitePolys.push(...arrowPolysWorld(174.2, 512.74, -1, 0, ['left'], 3.2));
  dimPolys.push(...arrowPolysWorld(171.6, 509.40, -1, 0, ['through'], 3.2));
  whitePolys.push(...arrowPolysWorld(178.5, 509.40, -1, 0, ['right'], 3.2));
  whitePolys.push(...arrowPolysWorld(174.2, 506.06, -1, 0, ['right'], 3.2));
  // Row 2 (mid-block, east of median gap)
  whitePolys.push(...arrowPolysWorld(204.0, 512.74, -1, 0, ['left'], 3.2));
  whitePolys.push(...arrowPolysWorld(204.0, 509.40, -1, 0, ['right'], 3.2));
  whitePolys.push(...arrowPolysWorld(204.0, 506.06, -1, 0, ['right'], 3.2));

  // 3c. Eastbound Paris Drive (2 lanes, z = 522.4 .. 529.0, heading east hx = 1, hz = 0)
  const ebDivZ = 525.70;
  // Smooth continuous divider curving into the SW rotary concentric divider
  addRibbon(whitePolys, [
    [167.8, ebDivZ],
    [229.0, ebDivZ],
    ...quadBezier([229.0, ebDivZ], [235.5, ebDivZ + 0.5], [239.2, 527.8], 12),
  ], 0.075);
  // Edge lines
  addRibbon(whitePolys, [[169.5, ebZ0 + 0.32], [187.5, ebZ0 + 0.32]], 0.075);
  addRibbon(whitePolys, [[196.2, ebZ0 + 0.32], [232.0, ebZ0 + 0.32]], 0.075);
  addRibbon(whitePolys, [[168.0, ebZ1 - 0.32], [234.0, ebZ1 - 0.32]], 0.075);

  // Eastbound continental zebra crosswalk (aligned with WB crosswalk at x = 163.5 .. 166.7)
  for (const [zLo, zHi] of zebraBars(ebZ0 + 0.35, ebZ1 - 0.35)) {
    whitePolys.push(toClipRing([[163.5, zLo], [166.7, zLo], [166.7, zHi], [163.5, zHi]]));
  }

  // Eastbound subtle flow arrows
  for (const ax of [181.0, 212.0]) {
    dimPolys.push(...arrowPolysWorld(ax, 524.05, 1, 0, ['through'], 3.1));
    dimPolys.push(...arrowPolysWorld(ax, 527.35, 1, 0, ['through'], 3.1));
  }

  // 3d. Southeast Exit & Entry Legs + STOP marking (matching Apple Maps bottom-left)
  addRibbon(whitePolys, seExitPts.slice(0, 25), 0.072);
  addRibbon(whitePolys, seEntryPts.slice(2), 0.072);
  // Double yellow centerline on two-way East Paris Drive east of merge (x = 313 .. east)
  addRibbon(yellowPolys, [[313.0, 547.42], [east, 547.37]], 0.068);
  addRibbon(yellowPolys, [[313.0, 547.68], [east, 547.63]], 0.068);

  // Crisp STOP bar + "STOP" text on the SE entry throat before entering the rotary
  addRibbon(whitePolys, [[292.0, 535.2], [298.5, 533.8]], 0.22);
  whitePolys.push(...stopTextPolys(296.0, 537.5, -0.35, -0.94, 0.78));

  // Clip all paint strictly inside drivable asphalt (and inside clipSection)
  const yellowEx = clipOp(ctIntersection, exToPaths(clipOp(ctUnion, yellowPolys)), drivablePaths);
  const yellowPaths = exToPaths(yellowEx);
  const whiteEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, whitePolys)), drivablePaths)), yellowPaths);
  const whitePaths = exToPaths(whiteEx);
  const dimEx = clipOp(ctDifference, exToPaths(clipOp(ctIntersection, exToPaths(clipOp(ctUnion, dimPolys)), drivablePaths)), [...whitePaths, ...yellowPaths]);

  emitPolygons(paintYellow, yellowEx, 0, 0.005);
  emitPolygons(paint, whiteEx, 0, 0.005);
  emitPolygons(paintDim, dimEx, 0, 0.005);
}
