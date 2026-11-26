import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { STRIP_PAVEMENT } from './strip-streets.mjs';
import { SOUTH_STRIP_BOUNDS } from './south-strip-roads.mjs';

// Follow the boulevard from the STRAT to the separately reviewed South Strip.
const Z_NORTH = Math.floor(STRIP_PAVEMENT.path.at(-1)[1]);
const Z_SOUTH = SOUTH_STRIP_BOUNDS[1];
const HALF_WIDTH = 145;
const STRIP_STEP_Z = 220;
const BLOCK_W = 160;

// Interpolate Strip centerline x at a given z along STRIP_PAVEMENT.path (sorted south-to-north).
function stripCenterX(z) {
  const pts = STRIP_PAVEMENT.path;
  if (z >= pts[0][1]) return pts[0][0];
  if (z <= pts[pts.length - 1][1]) return pts[pts.length - 1][0];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    if (z <= z0 && z >= z1) {
      const t = (z - z0) / (z1 - z0 || 1);
      return x0 + (x1 - x0) * t;
    }
  }
  return pts[0][0];
}

// Check if a point (x, z) lies inside the Center+North Strip review corridor.
export function inStripCorridor(x, z, margin = 0) {
  if (z < Z_NORTH - margin || z > Z_SOUTH + margin) return false;
  const cx = stripCenterX(Math.max(Z_NORTH, Math.min(Z_SOUTH, z)));
  return Math.abs(x - cx) <= HALF_WIDTH + margin;
}

const STRIP_CORRIDOR_NAMES = new Set([
  'South Las Vegas Boulevard',
  'Las Vegas Boulevard South',
  'East Tropicana Avenue',
  'West Tropicana Avenue',
  'East Harmon Avenue',
  'West Harmon Avenue',
  'East Flamingo Road',
  'West Flamingo Road',
  'Sands Avenue',
  'Spring Mountain Road',
  'East Sahara Avenue',
  'West Sahara Avenue',
  'Fashion Show Drive',
  'Resorts World Drive',
  'Resorts World Avenue',
  'Circus Circus Drive',
  'Bellagio Drive',
  'Paris Drive',
  'Center Strip Drive',
  'Via del Nord',
  'Aria Place',
  'MGM Road',
  'Bruno Mars Drive',
  'Caesars Palace Drive',
  'Mystère Dreams Avenue',
  'Wynn Main Gate Drive',
  'Genting Boulevard',
  'Encore Resort Boulevard',
  'Convention Center Drive',
  'Elvis Presley Boulevard',
  'Avenue Fontainebleau',
  'Sky Las Vegas Drive',
  'Bob Stupak Avenue',
  'South Main Street',
  'East Saint Louis Avenue',
]);

// Enables seamless lane tapers (no jagged step-jogs) and smooth bend rounding on Strip roads.
export function isStripCorridorRoad(way) {
  if (way.br || way.tn) return false;
  if (way.hw.startsWith('motorway') || way.hw.startsWith('trunk')) return false;
  if (way.name && STRIP_CORRIDOR_NAMES.has(way.name)) {
    return way.pts.some(([x, z]) => inStripCorridor(x, z, 30));
  }
  return false;
}

// Suppresses orphan median shards inside the Flamingo Rd x S Las Vegas Blvd intersection box.
export function inFlamingoJunctionCore(x, z) {
  return x >= 115 && x <= 168 && z >= 156 && z <= 198;
}

// ───────────────────────── Clipper CSG Helpers ─────────────────────────

const MM = 1000;
const pt = (x, z) => ({ X: Math.round(x * MM), Y: Math.round(z * MM) });
const { ctUnion, ctIntersection, ctDifference } = clipper.ClipType;
const { ptSubject, ptClip } = clipper.PolyType;
const { pftNonZero } = clipper.PolyFillType;

function clipOp(op, subject, cutters = []) {
  if (!subject.length) return [];
  const out = new clipper.PolyTree();
  const kernel = new clipper.Clipper();
  kernel.AddPaths(subject, ptSubject, true);
  if (cutters.length) kernel.AddPaths(cutters, ptClip, true);
  kernel.Execute(op, out, pftNonZero, pftNonZero);
  return clipper.JS.PolyTreeToExPolygons(out);
}

function toPaths(polys) {
  return polys.flatMap(({ outer, holes }) => [outer, ...holes]);
}

function offsetPaths(paths, deltaMeters) {
  if (!paths.length) return [];
  const out = new clipper.Paths();
  const co = new clipper.ClipperOffset(2.0, 12.0);
  co.AddPaths(paths, clipper.JoinType.jtRound, clipper.EndType.etClosedPolygon);
  co.Execute(out, deltaMeters * MM);
  return out;
}

// Detect polygons containing sharp acute tips (< ~65 deg, e.g. diagonal gore wedges)
// and blunt those tips into smooth circular noses via morphological round-opening,
// while leaving clean right-angled / already-smooth polygons and block-boundary seams untouched.
function onBlockBound(p, bounds, eps = 5) {
  if (!bounds) return false;
  const [x0, z0, x1, z1] = bounds;
  return Math.abs(p.X - Math.round(x0 * MM)) <= eps ||
    Math.abs(p.X - Math.round(x1 * MM)) <= eps ||
    Math.abs(p.Y - Math.round(z0 * MM)) <= eps ||
    Math.abs(p.Y - Math.round(z1 * MM)) <= eps;
}

function extendAcrossBlockBounds(paths, bounds, padMeters) {
  if (!paths.length || !bounds) return paths;
  const X0 = Math.round(bounds[0] * MM), Z0 = Math.round(bounds[1] * MM);
  const X1 = Math.round(bounds[2] * MM), Z1 = Math.round(bounds[3] * MM);
  const pad = Math.round(padMeters * MM);
  const eps = 5;
  const ghosts = [];
  let hitNW = false, hitNE = false, hitSE = false, hitSW = false;
  const addRect = (rx0, rz0, rx1, rz1) => {
    if (rx1 <= rx0 || rz1 <= rz0) return;
    ghosts.push([
      { X: rx0, Y: rz0 },
      { X: rx1, Y: rz0 },
      { X: rx1, Y: rz1 },
      { X: rx0, Y: rz1 },
    ]);
  };
  for (const ring of paths) {
    const n = ring.length;
    if (n < 3) continue;
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      const onW = Math.abs(a.X - X0) <= eps, onE = Math.abs(a.X - X1) <= eps;
      const onN = Math.abs(a.Y - Z0) <= eps, onS = Math.abs(a.Y - Z1) <= eps;
      if (onW && onN) hitNW = true;
      if (onE && onN) hitNE = true;
      if (onE && onS) hitSE = true;
      if (onW && onS) hitSW = true;
      if (onW && Math.abs(b.X - X0) <= eps) addRect(X0 - pad, Math.min(a.Y, b.Y), X0 + 2, Math.max(a.Y, b.Y));
      if (onE && Math.abs(b.X - X1) <= eps) addRect(X1 - 2, Math.min(a.Y, b.Y), X1 + pad, Math.max(a.Y, b.Y));
      if (onN && Math.abs(b.Y - Z0) <= eps) addRect(Math.min(a.X, b.X), Z0 - pad, Math.max(a.X, b.X), Z0 + 2);
      if (onS && Math.abs(b.Y - Z1) <= eps) addRect(Math.min(a.X, b.X), Z1 - 2, Math.max(a.X, b.X), Z1 + pad);
    }
  }
  if (hitNW) addRect(X0 - pad, Z0 - pad, X0 + 2, Z0 + 2);
  if (hitNE) addRect(X1 - 2, Z0 - pad, X1 + pad, Z0 + 2);
  if (hitSE) addRect(X1 - 2, Z1 - 2, X1 + pad, Z1 + pad);
  if (hitSW) addRect(X0 - pad, Z1 - 2, X0 + 2, Z1 + pad);
  return ghosts.length ? toPaths(clipOp(ctUnion, [...paths, ...ghosts])) : paths;
}

function hasAcuteCorner(ring, maxCos = 0.42, bounds = null) {
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const prev = ring[(i + n - 1) % n], cur = ring[i], next = ring[(i + 1) % n];
    if (onBlockBound(cur, bounds)) continue;
    const ax = prev.X - cur.X, ay = prev.Y - cur.Y, la = Math.hypot(ax, ay);
    const bx = next.X - cur.X, by = next.Y - cur.Y, lb = Math.hypot(bx, by);
    if (la < 200 || lb < 200) continue;
    const cos = (ax * bx + ay * by) / (la * lb);
    if (cos > maxCos) return true;
  }
  return false;
}

function roundAcutePolys(polys, radiusMeters = 0.65, bounds = null) {
  const out = [];
  for (const poly of polys) {
    if (!hasAcuteCorner(poly.outer, 0.42, bounds)) {
      out.push(poly);
      continue;
    }
    let rounded = null;
    for (const r of [radiusMeters, 0.24, 0.10]) {
      const base = bounds ? extendAcrossBlockBounds([poly.outer, ...poly.holes], bounds, r + 0.35) : [poly.outer, ...poly.holes];
      const eroded = offsetPaths(base, -r);
      if (!eroded.length) continue;
      const opened = offsetPaths(eroded, r);
      if (!opened.length) continue;
      const clipped = clipOp(ctIntersection, opened, [poly.outer]);
      if (clipped.length) {
        rounded = clipped;
        break;
      }
    }
    if (rounded) out.push(...rounded);
    else out.push(poly);
  }
  return out;
}

function emit(soup, polys, y, minimumArea = 0) {
  const toRing = path => path.map(({ X, Y }) => [X / MM, Y / MM]);
  const minScaled = minimumArea * MM * MM;
  for (const { outer, holes } of polys) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minScaled) continue;
    soup.polygon(toRing(outer), y, holes.map(toRing));
  }
}

function edgeOnBlockBound(a, b, bounds, eps = 6) {
  if (!bounds) return false;
  const X0 = Math.round(bounds[0] * MM), Z0 = Math.round(bounds[1] * MM);
  const X1 = Math.round(bounds[2] * MM), Z1 = Math.round(bounds[3] * MM);
  return (Math.abs(a.X - X0) <= eps && Math.abs(b.X - X0) <= eps) ||
    (Math.abs(a.X - X1) <= eps && Math.abs(b.X - X1) <= eps) ||
    (Math.abs(a.Y - Z0) <= eps && Math.abs(b.Y - Z0) <= eps) ||
    (Math.abs(a.Y - Z1) <= eps && Math.abs(b.Y - Z1) <= eps);
}

function emitCurbFaces(curbFaces, polys, y0 = 0, y1 = 0.17, minimumArea = 0.15, bounds = null) {
  if (!curbFaces) return;
  const minScaled = minimumArea * MM * MM;
  for (const { outer, holes } of polys) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minScaled) continue;
    for (const path of [outer, ...holes]) {
      const n = path.length;
      if (n < 3) continue;
      const soup = curbFaces.at(path[0].X / MM, path[0].Y / MM);
      for (let i = 0; i < n; i++) {
        const a = path[i], b = path[(i + 1) % n];
        if (edgeOnBlockBound(a, b, bounds)) continue;
        const ax = a.X / MM, az = a.Y / MM, bx = b.X / MM, bz = b.Y / MM;
        if (Math.hypot(bx - ax, bz - az) < 0.02) continue;
        const v0 = soup.vert(ax, y0, az);
        const v1 = soup.vert(bx, y0, bz);
        const v2 = soup.vert(bx, y1, bz);
        const v3 = soup.vert(ax, y1, az);
        soup.idx.push(v0, v1, v2, v0, v2, v3);
      }
    }
  }
}

function clearVerticalFaces(layer, layout) {
  if (!layer) return;
  const { strips, gBounds } = layout;
  const [gWest, gNorth, gEast, gSouth] = gBounds;
  const size = layer.size || 1400;
  for (const [key, soup] of layer.m.entries()) {
    const comma = key.indexOf(',');
    if (comma > 0) {
      const cx = Number(key.slice(0, comma)) * size;
      const cz = Number(key.slice(comma + 1)) * size;
      if (cx + size + 500 < gWest || cx - 500 > gEast || cz + size + 500 < gNorth || cz - 500 > gSouth) continue;
    }
    const { pos, idx } = soup;
    const keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const mx = (pos[a] + pos[b] + pos[c]) / 3;
      const mz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
      if (mx <= gWest || mx >= gEast || mz <= gNorth || mz >= gSouth) {
        keep.push(idx[i], idx[i + 1], idx[i + 2]);
        continue;
      }
      const s = Math.max(0, Math.min(strips.length - 1, Math.floor((mz - gNorth) / STRIP_STEP_Z)));
      const st = strips[s];
      if (mx > st.west && mx < st.east && mz > st.z0 && mz < st.z1) continue;
      keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    soup.idx = keep;
  }
}

function rectPath([x0, z0, x1, z1]) {
  return [[pt(x0, z0), pt(x1, z0), pt(x1, z1), pt(x0, z1)]];
}

// Build contiguous horizontal z-strips following the Strip centerline from Z_NORTH to Z_SOUTH.
function buildCorridorLayout() {
  const strips = [];
  const blocks = [];
  let gMinX = Infinity, gMaxX = -Infinity;
  for (let z0 = Z_NORTH; z0 < Z_SOUTH; z0 += STRIP_STEP_Z) {
    const z1 = Math.min(z0 + STRIP_STEP_Z, Z_SOUTH);
    const xA = stripCenterX(z0), xB = stripCenterX(z1), xM = stripCenterX((z0 + z1) * 0.5);
    const west = Math.floor(Math.min(xA, xB, xM) - HALF_WIDTH);
    const east = Math.ceil(Math.max(xA, xB, xM) + HALF_WIDTH);
    if (west < gMinX) gMinX = west;
    if (east > gMaxX) gMaxX = east;
    const stripBlocks = [];
    for (let x0 = west; x0 < east; x0 += BLOCK_W) {
      const x1 = Math.min(x0 + BLOCK_W, east);
      const bounds = [x0, z0, x1, z1];
      const block = { bounds, section: rectPath(bounds) };
      blocks.push(block);
      stripBlocks.push(block);
    }
    strips.push({ west, east, z0, z1, blocks: stripBlocks });
  }
  const allStripRects = strips.flatMap(s => rectPath([s.west, s.z0, s.east, s.z1]));
  const corridorSection = toPaths(clipOp(ctUnion, allStripRects));
  return { strips, blocks, corridorSection, gBounds: [gMinX, Z_NORTH, gMaxX, Z_SOUTH] };
}

function collectLayer(layer, layout, ringsFor) {
  const { strips, corridorSection, gBounds } = layout;
  const [gWest, gNorth, gEast, gSouth] = gBounds;
  const size = layer.size || 1400;
  for (const [key, soup] of layer.m.entries()) {
    const comma = key.indexOf(',');
    if (comma > 0) {
      const cx = Number(key.slice(0, comma)) * size;
      const cz = Number(key.slice(comma + 1)) * size;
      if (cx + size + 500 < gWest || cx - 500 > gEast || cz + size + 500 < gNorth || cz - 500 > gSouth) continue;
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
      const y = pos[a + 1];
      if (maxX <= gWest || minX >= gEast || maxZ <= gNorth || minZ >= gSouth ||
          Math.abs(y - pos[b + 1]) > 1e-5 || Math.abs(y - pos[c + 1]) > 1e-5) {
        keep.push(idx[i], idx[i + 1], idx[i + 2]);
        continue;
      }
      // Fast strip lookup by z index
      const s0 = Math.max(0, Math.floor((minZ - gNorth) / STRIP_STEP_Z));
      const s1 = Math.min(strips.length - 1, Math.floor((maxZ - gNorth) / STRIP_STEP_Z));
      let hitAny = false;
      let whollyInsideStrip = true;
      for (let s = s0; s <= s1; s++) {
        const st = strips[s];
        if (maxX > st.west && minX < st.east && maxZ > st.z0 && minZ < st.z1) {
          hitAny = true;
          if (minX < st.west || maxX > st.east) whollyInsideStrip = false;
        }
      }
      if (!hitAny) {
        keep.push(idx[i], idx[i + 1], idx[i + 2]);
        continue;
      }
      if (minZ < gNorth || maxZ > gSouth) whollyInsideStrip = false;
      const ring = [pt(x0, z0), pt(x1, z1), pt(x2, z2)];
      const area = clipper.Clipper.Area(ring);
      if (Math.abs(area) < 1) continue;
      if (area < 0) ring.reverse();
      if (!whollyInsideStrip) {
        const diff = clipOp(ctDifference, [ring], corridorSection);
        if (diff.length) outside.push([diff, y]);
      }
      for (let s = s0; s <= s1; s++) {
        const st = strips[s];
        if (maxX <= st.west || minX >= st.east) continue;
        for (const block of st.blocks) {
          const [bx0, bz0, bx1, bz1] = block.bounds;
          if (maxX <= bx0 || minX >= bx1 || maxZ <= bz0 || minZ >= bz1) continue;
          const rings = ringsFor.get(block);
          if (minX >= bx0 && maxX <= bx1 && minZ >= bz0 && maxZ <= bz1) rings.push(ring);
          else rings.push(...toPaths(clipOp(ctIntersection, [ring], block.section)));
        }
      }
    }
    soup.idx = keep;
    for (const [polys, y] of outside) emit(soup, polys, y);
  }
}

function finishBlock(layers, block, inputs) {
  const { major, asphalt, service, aisle, slipPavement, sidewalk, concreteMedians, medians, medianPaving,
    medianPlanting, medianApron, frontagePlanting, curb, paint, paintDim, paintYellow, reviewedAisles, parkingBase } = layers;
  const [x0, z0] = block.bounds;
  const raw = (...sources) => sources.flatMap(layer => inputs.get(layer).get(block));
  const take = (...sources) => {
    const r = raw(...sources);
    return r.length ? clipOp(ctUnion, r) : [];
  };

  const street = take(major, asphalt, slipPavement);
  const streetPaths = toPaths(street);
  const driveRaw = raw(service);
  const driveShapes = driveRaw.length ? clipOp(ctUnion, driveRaw) : [];
  const drivePaths = toPaths(driveShapes);
  const aisleRaw = raw(aisle);
  const drivable = drivePaths.length || aisleRaw.length
    ? toPaths(clipOp(ctUnion, [...streetPaths, ...drivePaths, ...aisleRaw]))
    : streetPaths;
  if (!drivable.length && !inputs.get(sidewalk).get(block).length) return;

  const drives = drivePaths.length ? clipOp(ctDifference, drivePaths, streetPaths) : [];
  const parking = aisleRaw.length ? clipOp(ctDifference, aisleRaw, [...streetPaths, ...drivePaths]) : [];
  const parkingPaths = toPaths(parking);
  const lotRaw = raw(parkingBase);
  const lots = lotRaw.length ? clipOp(ctDifference, lotRaw, [...drivable, ...parkingPaths]) : [];

  const add = (layer, polys, y = 0, minimumArea = 0) => {
    if (polys.length) emit(layer.at(x0, z0), polys, y, minimumArea);
  };
  add(major, street);
  add(service, drives);
  add(reviewedAisles, parking);
  add(parkingBase, lots);

  // Medians, sidewalks, landscaping, and curbs strictly subtracted from drivable asphalt
  // with crisp minimum-area thresholds to wipe out jagged shards and stub triangles.
  const medRaw = raw(concreteMedians, medians, medianPaving);
  const mediansRawClear = medRaw.length ? clipOp(ctDifference, medRaw, drivable) : [];
  const mediansClear = mediansRawClear.length ? roundAcutePolys(mediansRawClear, 0.65, block.bounds) : [];
  const medianPaths = toPaths(mediansClear);
  add(concreteMedians, mediansClear, 0.11, 0.28);

  const walkRaw = raw(sidewalk);
  const walkClear = walkRaw.length ? clipOp(ctDifference, walkRaw, [...drivable, ...medianPaths, ...parkingPaths]) : [];
  const walkPaths = toPaths(walkClear);
  add(sidewalk, walkClear, 0.11, 0.65);
  const aprons = raw(medianApron);
  if (aprons.length) add(major, clipOp(ctDifference, aprons, [...drivable, ...medianPaths, ...walkPaths]));

  const frontRaw = raw(frontagePlanting);
  if (frontRaw.length) add(frontagePlanting, clipOp(ctDifference, frontRaw, [...drivable, ...parkingPaths]), 0.065, 1.0);
  const plantRaw = raw(medians, medianPlanting);
  if (plantRaw.length && medianPaths.length) add(medianPlanting, clipOp(ctIntersection, plantRaw, medianPaths), 0.122, 0.75);
  const curbRaw = raw(curb);
  const medianExtended = medianPaths.length ? extendAcrossBlockBounds(medianPaths, block.bounds, 0.35) : [];
  const medianInterior = medianExtended.length ? offsetPaths(medianExtended, -0.15) : [];
  const islandRim = medianPaths.length
    ? toPaths(clipOp(ctDifference, medianPaths, medianInterior))
    : [];
  const raisedBase = [...medianPaths, ...walkPaths];
  if ((curbRaw.length || islandRim.length) && raisedBase.length) {
    const support = offsetPaths(raisedBase, 0.30);
    let curbTrimmed = curbRaw.length ? toPaths(clipOp(ctIntersection, curbRaw, support)) : [];
    // Never let raw edge curbs slice through the interior of a raised green median;
    // islandRim already provides the crisp uniform perimeter curb around every median.
    if (curbTrimmed.length && medianInterior.length) {
      curbTrimmed = toPaths(clipOp(ctDifference, curbTrimmed, medianInterior));
    }
    const curbAll = [...curbTrimmed, ...islandRim];
    if (curbAll.length) {
      const curbClear = clipOp(ctDifference, curbAll, drivable);
      add(curb, curbClear, 0.17, 0.15);
      emitCurbFaces(layers.curbFaces, curbClear, 0, 0.17, 0.15, block.bounds);
    }
  }

  // Crisp non-overlapping road markings clipped strictly inside drivable asphalt (yellow > white > dim).
  const yellowRaw = raw(paintYellow);
  const yellow = yellowRaw.length ? clipOp(ctIntersection, yellowRaw, drivable) : [];
  const yellowPaths = toPaths(yellow);
  const whiteRaw = raw(paint);
  const whiteIn = whiteRaw.length ? toPaths(clipOp(ctIntersection, whiteRaw, drivable)) : [];
  const white = whiteIn.length ? (yellowPaths.length ? clipOp(ctDifference, whiteIn, yellowPaths) : clipOp(ctUnion, whiteIn)) : [];
  const whitePaths = toPaths(white);
  add(paintYellow, yellow, 0, 0.005);
  add(paint, white, 0, 0.005);
  const dimRaw = raw(paintDim);
  if (dimRaw.length) {
    const dimIn = toPaths(clipOp(ctIntersection, dimRaw, drivable));
    if (dimIn.length) {
      const blockers = [...whitePaths, ...yellowPaths];
      add(paintDim, blockers.length ? clipOp(ctDifference, dimIn, blockers) : clipOp(ctUnion, dimIn), 0, 0.005);
    }
  }
}

export async function finishStripCorridorPavement(layers, pause) {
  const layout = buildCorridorLayout();
  const inputs = new Map();
  for (const [name, layer] of Object.entries(layers)) {
    if (name === 'curbFaces') {
      clearVerticalFaces(layer, layout);
      continue;
    }
    const rings = new Map(layout.blocks.map(block => [block, []]));
    collectLayer(layer, layout, rings);
    inputs.set(layer, rings);
    if (pause) await pause();
  }
  let sliceStart = performance.now();
  for (const block of layout.blocks) {
    finishBlock(layers, block, inputs);
    if (pause && performance.now() - sliceStart > 28) {
      await pause();
      sliceStart = performance.now();
    }
  }
}
