import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { SOUTH_STRIP_BOUNDS } from './south-strip-roads.mjs';

// Integer millimetres keep coincident rims and paint cuts stable.
const [west, north, east, south] = SOUTH_STRIP_BOUNDS;
const mm = 1000;
const point = (x, z) => ({ X: Math.round(x * mm), Y: Math.round(z * mm) });
const { ctUnion, ctIntersection, ctDifference } = clipper.ClipType;
const { ptSubject, ptClip } = clipper.PolyType;
const { pftNonZero } = clipper.PolyFillType;

function clip(op, subject, cutters = []) {
  if (!subject.length) return [];
  const out = new clipper.PolyTree();
  const kernel = new clipper.Clipper();
  kernel.AddPaths(subject, ptSubject, true);
  if (cutters.length) kernel.AddPaths(cutters, ptClip, true);
  kernel.Execute(op, out, pftNonZero, pftNonZero);
  return clipper.JS.PolyTreeToExPolygons(out);
}

function paths(polygons) {
  return polygons.flatMap(({ outer, holes }) => [outer, ...holes]);
}

function emit(soup, polygons, y, minimumArea = 0) {
  const toRing = path => path.map(({ X, Y }) => [X / mm, Y / mm]);
  for (const { outer, holes } of polygons) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minimumArea * mm * mm) continue;
    soup.polygon(toRing(outer), y, holes.map(toRing));
  }
}

function closing(paths) {
  const offset = (rings, delta) => {
    const output = new clipper.Paths();
    const kernel = new clipper.ClipperOffset();
    kernel.AddPaths(rings, clipper.JoinType.jtRound, clipper.EndType.etClosedPolygon);
    kernel.Execute(output, delta);
    return output;
  };
  // Fill sub-centimetre cracks left where two tessellated lane seams touch.
  return offset(offset(paths, 4), -4);
}

// Collect only flat faces. Preserve the original geometry outside the review
// bounds, including the portion of a triangle that straddles an end of the section.
function collect(layer, blocks, section, ringsFor) {
  const size = layer.size || 1400;
  for (const [key, soup] of layer.m.entries()) {
    const comma = key.indexOf(',');
    if (comma > 0) {
      const cx = Number(key.slice(0, comma)) * size;
      const cz = Number(key.slice(comma + 1)) * size;
      if (cx + size + 500 < west || cx - 500 > east || cz + size + 500 < north || cz - 500 > south) continue;
    }
    const { pos, idx } = soup;
    const keep = [], outside = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const x0 = pos[a], x1 = pos[b], x2 = pos[c];
      const z0 = pos[a + 2], z1 = pos[b + 2], z2 = pos[c + 2];
      const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
      const minZ = Math.min(z0, z1, z2), maxZ = Math.max(z0, z1, z2);
      const y = pos[a + 1];
      if (maxX <= west || minX >= east || maxZ <= north || minZ >= south ||
          Math.abs(y - pos[b + 1]) > 1e-5 || Math.abs(y - pos[c + 1]) > 1e-5) {
        keep.push(idx[i], idx[i + 1], idx[i + 2]);
        continue;
      }
      const ring = [point(x0, z0), point(x1, z1), point(x2, z2)];
      const area = clipper.Clipper.Area(ring);
      if (Math.abs(area) < 1) continue;
      if (area < 0) ring.reverse();
      if (minX < west || maxX > east || minZ < north || maxZ > south) {
        outside.push([clip(ctDifference, [ring], section), y]);
      }
      for (const block of blocks) {
        const [x0, z0, x1, z1] = block.bounds;
        if (maxX <= x0 || minX >= x1 || maxZ <= z0 || minZ >= z1) continue;
        const rings = ringsFor.get(block);
        if (minX >= x0 && maxX <= x1 && minZ >= z0 && maxZ <= z1) rings.push(ring);
        else rings.push(...paths(clip(ctIntersection, [ring], block.section)));
      }
    }
    soup.idx = keep;
    for (const [polygons, y] of outside) emit(soup, polygons, y);
  }
}

function finishBlock(layers, block, inputs) {
  const { major, asphalt, service, aisle, slipPavement, sidewalk, concreteMedians, medians, medianPaving,
    medianPlanting, frontagePlanting, curb, paint, paintDim, paintYellow, reviewedAisles, parkingBase } = layers;
  const [x0, z0] = block.bounds;
  const take = (...sources) => clip(ctUnion, sources.flatMap(layer => inputs.get(layer).get(block)));
  const street = take(major, asphalt, slipPavement);
  const driveShapes = take(service);
  const paving = [...paths(street), ...paths(driveShapes)];
  const drivable = paths(clip(ctUnion, paving));
  const closed = paths(clip(ctIntersection, closing(drivable), block.section));
  const drives = clip(ctDifference, [...paths(driveShapes), ...closed], paths(street));
  const parking = clip(ctDifference, paths(take(aisle)), drivable);
  const lots = clip(ctDifference, paths(take(parkingBase)), [...drivable, ...paths(parking)]);
  const add = (layer, polygons, y = 0, minimumArea = 0) => {
    emit(layer.at(x0, z0), polygons, y, minimumArea);
  };
  add(major, street);
  add(service, drives);
  add(reviewedAisles, parking);
  add(parkingBase, lots);

  const mediansClear = clip(ctDifference, paths(take(concreteMedians, medians, medianPaving)), drivable);
  add(concreteMedians, mediansClear, 0.11, 0.45);
  add(sidewalk, clip(ctDifference, paths(take(sidewalk)), [...drivable, ...paths(mediansClear), ...paths(parking)]), 0.11, 0.45);
  add(frontagePlanting, clip(ctDifference, paths(take(frontagePlanting)), [...drivable, ...paths(parking)]), 0.065, 1.0);
  add(medianPlanting, clip(ctIntersection, paths(take(medianPlanting)), paths(mediansClear)), 0.122, 0.6);
  add(curb, clip(ctDifference, paths(take(curb)), drivable), 0.17, 0.12);
  const yellow = clip(ctIntersection, paths(take(paintYellow)), drivable);
  const white = clip(ctDifference, paths(clip(ctIntersection, paths(take(paint)), drivable)), paths(yellow));
  add(paintYellow, yellow);
  add(paint, white);
  const dim = paths(clip(ctIntersection, paths(take(paintDim)), drivable));
  add(paintDim, clip(ctDifference, dim, [...paths(white), ...paths(yellow)]));
}

export async function finishSouthStripPavement(layers, pause) {
  const rectangle = ([x0, z0, x1, z1]) => [[point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)]];
  const blocks = [];
  const blockSize = 135;
  for (let x = west; x < east; x += blockSize) {
    for (let z = north; z < south; z += blockSize) {
      const bounds = [x, z, Math.min(x + blockSize, east), Math.min(z + blockSize, south)];
      blocks.push({ bounds, section: rectangle(bounds) });
    }
  }
  const section = rectangle(SOUTH_STRIP_BOUNDS);
  const inputs = new Map();
  for (const layer of Object.values(layers)) {
    const rings = new Map(blocks.map(block => [block, []]));
    collect(layer, blocks, section, rings);
    inputs.set(layer, rings);
    if (pause) await pause();
  }
  let sliceStart = performance.now();
  for (const block of blocks) {
    finishBlock(layers, block, inputs);
    if (pause && performance.now() - sliceStart > 28) {
      await pause();
      sliceStart = performance.now();
    }
  }
}
