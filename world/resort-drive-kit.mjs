import clipper from '../landmarks/vendor/clipper/clipper.mjs';
import { arrowMarking, dashRuns, zebraBars } from './road-visuals.mjs';

// Shared Clipper, polyline, curb, median, and lane-marking kit for resort valet drives.
// Local coordinates in metres: x east, y up, z south.

export const MM = 1000;
export const pt = (x, z) => ({ X: Math.round(x * MM), Y: Math.round(z * MM) });
export const { ctUnion, ctIntersection, ctDifference } = clipper.ClipType;
export const { ptSubject, ptClip } = clipper.PolyType;
export const { pftNonZero } = clipper.PolyFillType;

export function toClipRing(ring) {
  const out = ring.map(([x, z]) => pt(x, z));
  if (clipper.Clipper.Area(out) < 0) out.reverse();
  return out;
}

export function fromClipRing(path) {
  return path.map(({ X, Y }) => [X / MM, Y / MM]);
}

export function clipOp(op, subject, cutters = []) {
  if (!subject.length) return [];
  const out = new clipper.PolyTree();
  const kernel = new clipper.Clipper();
  kernel.AddPaths(subject, ptSubject, true);
  if (cutters.length) kernel.AddPaths(cutters, ptClip, true);
  kernel.Execute(op, out, pftNonZero, pftNonZero);
  return clipper.JS.PolyTreeToExPolygons(out);
}

export function exToPaths(polys) {
  return polys.flatMap(({ outer, holes }) => [outer, ...holes]);
}

export function offsetPaths(paths, delta, joinType = clipper.JoinType.jtRound) {
  if (!paths.length) return [];
  const out = new clipper.Paths();
  const co = new clipper.ClipperOffset(2.0, 12.0);
  co.AddPaths(paths, joinType, clipper.EndType.etClosedPolygon);
  co.Execute(out, delta * MM);
  return out;
}

export function roundCorners(paths, radius) {
  return offsetPaths(offsetPaths(paths, -radius), radius);
}

export function circleRing(cx, cz, r, steps = 72) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
}

export function ellipseRing(cx, cz, rx, rz, steps = 64, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const lx = Math.cos(a) * rx, lz = Math.sin(a) * rz;
    out.push([cx + lx * c - lz * s, cz + lx * s + lz * c]);
  }
  return out;
}

export function smoothPoly(pts, stepsPerSeg = 5) {
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

export function polyCum(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return cum;
}

export function samplePoly(pts, cum, d) {
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

export function offsetPoly(pts, offsetFn) {
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

export function ribbonRing(pts, halfW) {
  if (pts.length < 2) return [];
  return [...offsetPoly(pts, -halfW), ...offsetPoly(pts, halfW).reverse()];
}

export function slicePoly(pts, cum, s0, s1) {
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

export function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function nearBoundary(mx, mz, ring, eps = 0.28) {
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    if (distToSeg(mx, mz, ax, az, bx, bz) <= eps) return true;
  }
  return false;
}

export function emitPolygons(layer, polys, y, minArea = 0.02) {
  for (const { outer, holes } of polys) {
    if (Math.abs(clipper.Clipper.Area(outer)) < minArea * MM * MM) continue;
    const ring = fromClipRing(outer);
    const [x, z] = ring[0];
    layer.at(x, z).polygon(ring, y, holes.map(fromClipRing));
  }
}

export function emitCurbFaces(curbFaces, paths, y0 = 0, y1 = 0.17, skipBoundary = null) {
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

export function arrowPolysWorld(cx, cz, hx, hz, movements, laneW = 3.0) {
  const nx = -hz, nz = hx;
  return arrowMarking(movements, laneW).map(poly =>
    toClipRing(poly.map(([u, v]) => [cx + nx * u + hx * v, cz + nz * u + hz * v]))
  );
}

export function addRibbon(target, pts, halfW) {
  const r = ribbonRing(pts, halfW);
  if (r.length >= 3) target.push(toClipRing(r));
}

export function addDashed(target, pts, dashLen = 2.4, gapLen = 4.2, halfW = 0.072, phase = 0) {
  const cum = polyCum(pts);
  const len = cum[cum.length - 1];
  for (const [d0, d1] of dashRuns(0.5, len - 0.5, dashLen, gapLen, phase)) {
    const piece = slicePoly(pts, cum, d0, d1);
    if (piece.length >= 2) addRibbon(target, piece, halfW);
  }
}

export function addZebra(target, pA, pB, depth = 3.0) {
  const dx = pB[0] - pA[0], dz = pB[1] - pA[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const nx = -uz, nz = ux;
  for (const [lo, hi] of zebraBars(0.35, len - 0.35)) {
    const a0 = [pA[0] + ux * lo - nx * (depth / 2), pA[1] + uz * lo - nz * (depth / 2)];
    const a1 = [pA[0] + ux * lo + nx * (depth / 2), pA[1] + uz * lo + nz * (depth / 2)];
    const b1 = [pA[0] + ux * hi + nx * (depth / 2), pA[1] + uz * hi + nz * (depth / 2)];
    const b0 = [pA[0] + ux * hi - nx * (depth / 2), pA[1] + uz * hi - nz * (depth / 2)];
    target.push(toClipRing([a0, a1, b1, b0]));
  }
}

function segIntersects(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  if ((d1 > 0 && d2 > 0) || (d1 < 0 && d2 < 0)) return false;
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  if ((d3 > 0 && d4 > 0) || (d3 < 0 && d4 < 0)) return false;
  return (d1 !== 0 || d2 !== 0 || d3 !== 0 || d4 !== 0);
}

function triCrossesRing(x0, z0, x1, z1, x2, z2, ring) {
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    if (segIntersects(x0, z0, x1, z1, ax, az, bx, bz)) return true;
    if (segIntersects(x1, z1, x2, z2, ax, az, bx, bz)) return true;
    if (segIntersects(x2, z2, x0, z0, ax, az, bx, bz)) return true;
  }
  return false;
}

// Fast triangle-level layer clearer: skips triangles outside bbox, drops strictly interior
// triangles in O(1) without calling Clipper, and only clips triangles crossing the boundary.
export function clearLayersInPoly(layers, bounds, clipSection, clipPoly) {
  const [west, north, east, south] = bounds;
  const targets = [
    layers.major, layers.asphalt, layers.service, layers.slipPavement, layers.sidewalk,
    layers.concreteMedians, layers.medians, layers.medianPaving, layers.medianPlanting,
    layers.frontagePlanting, layers.curb, layers.curbFaces, layers.paint, layers.paintDim, layers.paintYellow,
  ];
  for (const layer of targets) {
    if (!layer || !layer.m) continue;
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
        const i0 = pointInRing(x0, z0, clipPoly);
        const i1 = pointInRing(x1, z1, clipPoly);
        const i2 = pointInRing(x2, z2, clipPoly);
        if (!i0 && !i1 && !i2 && !triCrossesRing(x0, z0, x1, z1, x2, z2, clipPoly)) {
          keep.push(idx[i], idx[i + 1], idx[i + 2]);
          continue;
        }
        if (i0 && i1 && i2 && !triCrossesRing(x0, z0, x1, z1, x2, z2, clipPoly)) {
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
}

export function boundsOfPoly(poly, pad = 2.0) {
  let w = Infinity, n = Infinity, e = -Infinity, s = -Infinity;
  for (const [x, z] of poly) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (z < n) n = z;
    if (z > s) s = z;
  }
  return [w - pad, n - pad, e + pad, s + pad];
}
