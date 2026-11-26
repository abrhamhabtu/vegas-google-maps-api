import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { SOUTH_STRIP_BOUNDS } from './south-strip-roads.mjs';

// Integer millimetres keep coincident rims and paint cuts stable.
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

function extendAcrossBlockBounds(ringPaths, bounds, padMeters) {
  if (!ringPaths.length || !bounds) return ringPaths;
  const X0 = Math.round(bounds[0] * mm), Z0 = Math.round(bounds[1] * mm);
  const X1 = Math.round(bounds[2] * mm), Z1 = Math.round(bounds[3] * mm);
  const pad = Math.round(padMeters * mm);
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
  for (const ring of ringPaths) {
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
  return ghosts.length ? paths(clip(ctUnion, [...ringPaths, ...ghosts])) : ringPaths;
}

function edgeOnBlockBound(a, b, bounds, eps = 6) {
  if (!bounds) return false;
  const X0 = Math.round(bounds[0] * mm), Z0 = Math.round(bounds[1] * mm);
  const X1 = Math.round(bounds[2] * mm), Z1 = Math.round(bounds[3] * mm);
  return (Math.abs(a.X - X0) <= eps && Math.abs(b.X - X0) <= eps) ||
    (Math.abs(a.X - X1) <= eps && Math.abs(b.X - X1) <= eps) ||
    (Math.abs(a.Y - Z0) <= eps && Math.abs(b.Y - Z0) <= eps) ||
    (Math.abs(a.Y - Z1) <= eps && Math.abs(b.Y - Z1) <= eps);
}

function emitCurbFaces(curbFaces, polygons, y0 = 0, y1 = 0.17, minimumArea = 0.12, bounds = null) {
  if (!curbFaces) return;
  const minScaled = minimumArea * mm * mm;
  for (const { outer, holes } of polygons) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minScaled) continue;
    for (const path of [outer, ...holes]) {
      const n = path.length;
      if (n < 3) continue;
      const soup = curbFaces.at(path[0].X / mm, path[0].Y / mm);
      for (let i = 0; i < n; i++) {
        const a = path[i], b = path[(i + 1) % n];
        if (edgeOnBlockBound(a, b, bounds)) continue;
        const ax = a.X / mm, az = a.Y / mm, bx = b.X / mm, bz = b.Y / mm;
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

function clearVerticalFaces(layer, bounds) {
  if (!layer) return;
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
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const mx = (pos[a] + pos[b] + pos[c]) / 3;
      const mz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
      if (mx > west && mx < east && mz > north && mz < south) continue;
      keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    soup.idx = keep;
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
function collect(layer, blocks, section, bounds, ringsFor) {
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
    medianPlanting, medianApron, frontagePlanting, curb, paint, paintDim, paintYellow, reviewedAisles, parkingBase, plaza, gravel } = layers;
  const [x0, z0] = block.bounds;
  const take = (...sources) => clip(ctUnion, sources.flatMap(layer => inputs.get(layer).get(block)));
  const street = take(major, asphalt, slipPavement);
  const driveShapes = take(service);
  const paving = [...paths(street), ...paths(driveShapes)];
  const parkingShapes = paths(take(aisle));
  const drivable = paths(clip(ctUnion, [...paving, ...parkingShapes]));
  const closed = paths(clip(ctIntersection, closing(paths(clip(ctUnion, paving))), block.section));
  const drives = clip(ctDifference, [...paths(driveShapes), ...closed], paths(street));
  const parking = clip(ctDifference, parkingShapes, paving);
  const lots = clip(ctDifference, paths(take(parkingBase)), [...drivable, ...paths(parking)]);
  const add = (layer, polygons, y = 0, minimumArea = 0) => {
    emit(layer.at(x0, z0), polygons, y, minimumArea);
  };
  add(major, street);
  add(service, drives);
  add(reviewedAisles, parking);
  add(parkingBase, lots);

  const plazaPaths = plaza ? paths(take(plaza)) : [];
  const gravelClear = gravel ? clip(ctDifference, paths(take(gravel)), [...drivable, ...plazaPaths]) : [];
  const gravelPaths = paths(gravelClear);
  const mediansClear = clip(ctDifference, paths(take(concreteMedians, medians, medianPaving)), [...drivable, ...plazaPaths, ...gravelPaths]);
  add(concreteMedians, mediansClear, 0.11, 0.45);
  if (gravel) add(gravel, gravelClear, 0.11, 0.45);
  const islands = [...paths(mediansClear), ...gravelPaths];
  const walks = clip(ctDifference, [...paths(take(sidewalk)), ...plazaPaths], [...drivable, ...islands]);
  add(sidewalk, walks, 0.11, 0.45);
  add(major, clip(ctDifference, paths(take(medianApron)), [...drivable, ...islands, ...paths(walks)]));
  add(frontagePlanting, clip(ctDifference, paths(take(frontagePlanting)), [...drivable, ...paths(parking)]), 0.065, 1.0);
  add(medianPlanting, clip(ctIntersection, paths(take(medians, medianPlanting)), islands), 0.122, 0.6);
  const curbRaw = paths(take(curb));
  const offset = (rings, delta) => {
    if (!rings.length) return [];
    const out = new clipper.Paths();
    const co = new clipper.ClipperOffset(2.0, 12.0);
    co.AddPaths(rings, clipper.JoinType.jtRound, clipper.EndType.etClosedPolygon);
    co.Execute(out, delta * mm);
    return out;
  };
  const islandExtended = islands.length ? extendAcrossBlockBounds(islands, block.bounds, 0.35) : [];
  const islandInterior = offset(islandExtended, -0.15);
  const islandRim = islands.length ? paths(clip(ctDifference, islands, islandInterior)) : [];
  const raisedBase = [...islands, ...paths(walks), ...plazaPaths];
  if ((curbRaw.length || islandRim.length) && raisedBase.length) {
    const support = offset(raisedBase, 0.30);
    let curbTrimmed = curbRaw.length ? paths(clip(ctIntersection, curbRaw, support)) : [];
    if (curbTrimmed.length && islandInterior.length) {
      curbTrimmed = paths(clip(ctDifference, curbTrimmed, islandInterior));
    }
    const curbAll = [...curbTrimmed, ...islandRim];
    if (curbAll.length) {
      const curbClear = clip(ctDifference, curbAll, drivable);
      add(curb, curbClear, 0.17, 0.12);
      emitCurbFaces(layers.curbFaces, curbClear, 0, 0.17, 0.12, block.bounds);
    }
  }
  const yellow = clip(ctIntersection, paths(take(paintYellow)), drivable);
  const white = clip(ctDifference, paths(clip(ctIntersection, paths(take(paint)), drivable)), paths(yellow));
  add(paintYellow, yellow);
  add(paint, white);
  const dim = paths(clip(ctIntersection, paths(take(paintDim)), drivable));
  add(paintDim, clip(ctDifference, dim, [...paths(white), ...paths(yellow)]));
}

export async function finishSouthStripPavement(layers, pause, bounds = SOUTH_STRIP_BOUNDS) {
  const [west, north, east, south] = bounds;
  const rectangle = ([x0, z0, x1, z1]) => [[point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)]];
  const blocks = [];
  const blockSize = 135;
  for (let x = west; x < east; x += blockSize) {
    for (let z = north; z < south; z += blockSize) {
      const bounds = [x, z, Math.min(x + blockSize, east), Math.min(z + blockSize, south)];
      blocks.push({ bounds, section: rectangle(bounds) });
    }
  }
  const section = rectangle(bounds);
  const inputs = new Map();
  for (const [name, layer] of Object.entries(layers)) {
    if (name === 'curbFaces') {
      clearVerticalFaces(layer, bounds);
      continue;
    }
    const rings = new Map(blocks.map(block => [block, []]));
    collect(layer, blocks, section, bounds, rings);
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
