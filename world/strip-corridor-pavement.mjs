import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { STRIP_PAVEMENT } from './strip-streets.mjs';
import { SOUTH_STRIP_BOUNDS } from './south-strip-roads.mjs';

// Full Center & North Las Vegas Strip Corridor CSG Pavement Finisher
// Covers z from -3080 (The STRAT / Sahara) south to 1980 (joining SOUTH_STRIP_BOUNDS seamlessly),
// hugging the exact Strip centerline ±235 m east/west.
// Local coordinates in metres: x east, y up, z south.

const Z_NORTH = -3080;
const Z_SOUTH = SOUTH_STRIP_BOUNDS[1]; // 1980 — joins finishSouthStripPavement with 0.00 m seam
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
  'Circus Circus Drive',
  'Bellagio Drive',
  'Paris Drive',
  'Center Strip Drive',
  'Via del Nord',
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

function emit(soup, polys, y, minimumArea = 0) {
  const toRing = path => path.map(({ X, Y }) => [X / MM, Y / MM]);
  const minScaled = minimumArea * MM * MM;
  for (const { outer, holes } of polys) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minScaled) continue;
    soup.polygon(toRing(outer), y, holes.map(toRing));
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
    medianPlanting, frontagePlanting, curb, paint, paintDim, paintYellow, reviewedAisles, parkingBase } = layers;
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
  const drivable = drivePaths.length
    ? toPaths(clipOp(ctUnion, [...streetPaths, ...drivePaths]))
    : streetPaths;
  if (!drivable.length && !inputs.get(sidewalk).get(block).length) return;

  const drives = drivePaths.length ? clipOp(ctDifference, drivePaths, streetPaths) : [];
  const aisleRaw = raw(aisle);
  const parking = aisleRaw.length ? clipOp(ctDifference, aisleRaw, drivable) : [];
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
  const mediansClear = medRaw.length ? clipOp(ctDifference, medRaw, drivable) : [];
  const medianPaths = toPaths(mediansClear);
  add(concreteMedians, mediansClear, 0.11, 0.65);

  const walkRaw = raw(sidewalk);
  const walkClear = walkRaw.length ? clipOp(ctDifference, walkRaw, [...drivable, ...medianPaths, ...parkingPaths]) : [];
  add(sidewalk, walkClear, 0.11, 0.65);

  const frontRaw = raw(frontagePlanting);
  if (frontRaw.length) add(frontagePlanting, clipOp(ctDifference, frontRaw, [...drivable, ...parkingPaths]), 0.065, 1.0);
  const plantRaw = raw(medianPlanting);
  if (plantRaw.length && medianPaths.length) add(medianPlanting, clipOp(ctIntersection, plantRaw, medianPaths), 0.122, 0.75);
  const curbRaw = raw(curb);
  if (curbRaw.length) add(curb, clipOp(ctDifference, curbRaw, drivable), 0.17, 0.15);

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
  for (const layer of Object.values(layers)) {
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
