import { MODE, Soup, facade, clean, centroid, inset, offset, sign } from './hero-kit.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';

const THREE = window.THREE;
export const named = (data, name) => data.buildings.find(b => b.name === name);
export const mapped = (data, x, z, height, radius = 5) => data.buildings.find(b => {
  if (Math.abs(b.h - height) > 0.6) return false;
  const c = centroid(b.pts);
  return Math.hypot(c[0] - x, c[1] - z) < radius;
});

export function model(name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

export function put(group, soup, material, name) {
  const mesh = soup.mesh(material, name);
  if (mesh) group.add(mesh);
  return mesh;
}

export function material(color, roof = color, options = {}) {
  return facade(MODE.stone, { color, roof, ...options });
}

export function parapet(soup, ring, top, height, lip) {
  soup.walls(offset(ring, lip), top - 0.3, top + height);
  soup.walls(inset(ring, 0.48) || ring, top - 0.25, top + height);
  // Lip around the roof well, without capping over the whole well.
  const inner = inset(ring, 0.48) || ring, outer = offset(ring, lip);
  const color = new THREE.Color(1, 1, 1), n = [0, 1, 0], a = [top + height, 0, 0, 0];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const p = [outer[i], outer[j], inner[j], inner[i]].map(([x, z]) => soup.vert(x, top + height, z, n, 0, color, a));
    soup.idx.push(p[0], p[2], p[1], p[0], p[3], p[2]);
  }
}

export function faces(ring, minLength = 0) {
  return ring.flatMap(([x, z], i) => {
    const [qx, qz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(qx - x, qz - z);
    return length < Math.max(0.01, minLength) ? [] : [{ x, z, length,
      ax: (qx - x) / length, az: (qz - z) / length, nx: (qz - z) / length, nz: (x - qx) / length }];
  });
}

export function along(soup, face, start, end, y, height, depth, shift = 0) {
  const { x, z, ax, az, nx, nz } = face, s = (start + end) * 0.5;
  soup.box(x + s * ax + shift * nx, y, z + s * az + shift * nz, end - start, height, depth, ax, az);
}

export function wordmark(group, ring, direction, text, width, height, y, style) {
  const f = faces(ring, Math.min(width * 0.8, 18))
    .sort((a, b) => (b.nx - a.nx) * direction[0] + (b.nz - a.nz) * direction[1] + 0.002 * (b.length - a.length))[0];
  if (!f) return;
  const s = f.length / 2;
  group.add(sign(text, Math.min(width, f.length * 0.94), height,
    f.x + f.ax * s + f.nx * 0.95, y, f.z + f.az * s + f.nz * 0.95, f.nx, f.nz, style));
}

/** In the city the shared podium mesh retains its lane clearance cutouts. */
export function standalonePodium(group, footprint, options, wall, roof = wall) {
  if (!options?.standalone || !footprint) return;
  const shell = new Soup(), cap = new Soup(), ring = clean(footprint.pts);
  shell.walls(ring, footprint.mh ?? 0, footprint.h);
  cap.cap(ring, footprint.h);
  put(group, shell, wall, 'Mapped podium walls');
  put(group, cap, roof, 'Mapped podium roof');
}

export function own(building, options) {
  if (!options?.standalone) heroOwned.add(building);
  return clean(building.pts);
}

export function addShape(group, geometry, material, name, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}
