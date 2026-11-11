/** Sculptures and pedestrian frontage at the Tropicana intersection. */
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { roadMask } from '../landmarks/vendor/map/lanegraph.js';
import { MODE, SERIF, Soup, WHITE, centroid, clean, facade, makeWaterMaterial, sign, spill } from './hero-kit.js';

const THREE = window.THREE;

function put(group, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function ellipsoid(group, material, x, y, z, w, h, d) {
  const mesh = put(group, new THREE.SphereGeometry(1, 22, 14), material, x, y, z);
  mesh.scale.set(w, h, d);
  return mesh;
}

function taperedRod(group, material, start, end, r0, r1 = r0, sides = 10) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), axis = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, axis.length(), sides), material);
  mesh.position.copy(a).addScaledVector(axis, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  group.add(mesh);
}

function cable(group, material, points, radius, segments = 48) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  put(group, new THREE.TubeGeometry(path, segments, radius, 6, false), material, 0, 0, 0);
  return path;
}

export function addMgmLion(out, data, graph) {
  const site = data.pois.find(p => p.n === 'Leo the Lion');
  if (!site) return;
  const { x, z } = site;
  const group = new THREE.Group();
  group.name = 'Leo the Lion and pedestal';
  group.position.set(x, 0, z);
  group.rotation.y = -Math.PI * 0.31;
  const bronze = sheen('#a4783e', { refl: 0.18, spec: 1.04, glow: '#ffca7e', glowK: 0.34 });
  const mane = sheen('#79522e', { refl: 0.15, spec: 0.95, glow: '#f3af62', glowK: 0.32 });
  const details = sheen('#4d351e', { spec: 0.4, glow: '#d19d54', glowK: 0.16 });
  const gold = sheen('#c2a078', { spec: 0.8, glow: '#ffc687', glowK: 0.6 });
  const base = sheen('#847265', { glow: '#e8b16e', glowK: 0.3 });
  const cap = sheen('#26463c', { spec: 0.4, glow: '#377855', glowK: 0.19 });
  const pedestal = [
    [0.65, 7.2, 7.75, 1.3, base], [2.45, 6.2, 6.8, 2.3, base],
    [5.25, 5.7, 6.24, 3.32, gold], [7.26, 6.1, 5.74, 0.74, cap],
  ];
  for (const [y, top, bottom, h, material] of pedestal) {
    const m = put(group, new THREE.CylinderGeometry(top, bottom, h, 16), material, 0, y, 0);
    m.scale.z = 0.87;
  }
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * 2 * Math.PI;
    taperedRod(group, gold, [6.15 * Math.sin(a), 3.63, 5.35 * Math.cos(a)],
      [5.78 * Math.sin(a), 6.86, 5.02 * Math.cos(a)], 0.12, 0.15, 5);
  }
  // The statue is seated with a high mane and heavy forelegs. Its 45-foot height starts at the pedestal.
  ellipsoid(group, bronze, 0, 10.2, -2.1, 4.02, 2.86, 4.84);
  ellipsoid(group, bronze, 0, 12.82, 0.32, 3.14, 4.56, 3.18);
  ellipsoid(group, mane, 0, 15.88, 1.58, 3.86, 4.19, 3.43);
  ellipsoid(group, bronze, 0, 18.22, 2.88, 2.68, 2.59, 2.75);
  for (const side of [-1, 1]) {
    const hip = ellipsoid(group, bronze, side * 2.4, 10.24, -2.9, 1.88, 2.45, 3.35);
    hip.rotation.z = side * 0.12;
    ellipsoid(group, bronze, side * 1.95, 8.66, 3.95, 1.34, 1.02, 2.0);
    taperedRod(group, bronze, [side * 1.96, 9.02, 3.44], [side * 2.16, 14.4, 2.02], 0.93, 1.32);
    ellipsoid(group, bronze, side * 2.04, 20.07, 2.83, 0.81, 0.85, 0.64);
    ellipsoid(group, details, side * 2.05, 20.2, 3.16, 0.46, 0.44, 0.15);
    ellipsoid(group, bronze, side * 1.01, 17.47, 4.91, 1.26, 0.91, 1.17);
    ellipsoid(group, details, side * 1.08, 18.78, 5.06, 0.42, 0.22, 0.19);
    const brow = ellipsoid(group, bronze, side * 1.12, 19.12, 4.97, 0.88, 0.28, 0.43);
    brow.rotation.z = side * 0.24;
    for (let k = 0; k < 5; k++) {
      const lock = ellipsoid(group, k % 2 ? bronze : mane, side * (2.23 + k * 0.22),
        17.92 - k * 0.87, 2.64 - k * 0.07, 0.82, 1.54, 1.58);
      lock.rotation.z = side * (0.42 + k * 0.08);
    }
    for (const toe of [-1, 0, 1]) {
      ellipsoid(group, bronze, side * 1.95 + toe * 0.67, 8.54, 5.12, 0.43, 0.59, 0.74);
    }
  }
  ellipsoid(group, details, 0, 16.93, 5.12, 1.22, 0.23, 0.68);
  ellipsoid(group, bronze, 0, 16.58, 4.96, 1.44, 0.62, 0.98);
  ellipsoid(group, details, 0, 18.13, 5.81, 0.74, 0.37, 0.44);
  cable(group, bronze, [[-1.6, 9.7, -5.6], [-3.6, 8.16, -4.8], [-4.44, 8.04, -2.8], [-4.2, 8.2, -0.9]], 0.34, 24);
  ellipsoid(group, mane, -4.17, 8.25, -0.77, 0.49, 0.41, 0.79);
  out.add(bakeStatic(group));

  // The relief screens and twin poster recesses sit on the Hakkasan frontage behind the plinth.
  const screens = new Soup(), trim = new Soup(), display = new Soup();
  const ax = 0.71, az = 0.704, nx = -az, nz = ax;
  const onRoad = graph ? roadMask(graph) : () => false;
  for (const s of [-1, 1]) {
    const cx = x + 10.4 + ax * s * 8.1, cz = z - 9.5 + az * s * 8.1;
    if (onRoad(cx, cz, 2.2)) continue;
    screens.box(cx, 2.3, cz, 5.9, 16.6, 1.46, ax, az);
    display.box(cx + nx * 0.77, 4.75, cz + nz * 0.77, 4.7, 8.2, 0.09, ax, az);
    for (const u of [-2.63, 2.63]) trim.box(cx + ax * u + nx * 0.81, 2.3,
      cz + az * u + nz * 0.81, 0.27, 16.7, 0.24, ax, az);
    out.add(sign('HAKKASAN', 4.93, 1.6, cx + nx * 0.88, 14.35, cz + nz * 0.88, nx, nz,
      { font: `600 106px ${SERIF}`, color: '#ffe2b1' }));
  }
  for (const [soup, material, name] of [
    [screens, facade(MODE.stone, { color: '#7d776d', roof: '#a29073', floodK: 0.6 }), 'Hakkasan entrance screens'],
    [trim, gold, 'Hakkasan metal surrounds'],
    [display, sheen('#254f68', { spec: 0.42, glow: '#5bb1d2', glowK: 0.77 }), 'Hakkasan poster lighting'],
  ]) {
    const mesh = soup.mesh(material, name);
    if (mesh) out.add(mesh);
  }
  out.add(spill(x, 0.49, z, 42, '#ffd596', 0.32));
}

function robe(group, material) {
  const profile = [
    [0, 3.35, 1.86], [1.25, 3.15, 2.03], [3.7, 2.8, 1.91], [6.55, 2.54, 1.76],
    [9.75, 2.13, 1.58], [12.2, 2.51, 1.6], [14.25, 2.8, 1.38], [15.2, 1.18, 1.03],
  ];
  const segments = 48, positions = [], faces = [];
  profile.forEach(([y, w, d], i) => {
    for (let k = 0; k < segments; k++) {
      const a = k / segments * Math.PI * 2;
      const fold = 1 + Math.cos(a * 9 + y * 0.22) * 0.09 + Math.sin(a * 5 - y * 0.41) * 0.035;
      const x = w * Math.cos(a) * fold + 0.37 * Math.sin(y * 0.28);
      positions.push(x, 21.2 + y, d * Math.sin(a) * fold);
      if (i === 0) continue;
      const a0 = (i - 1) * segments + k, a1 = (i - 1) * segments + (k + 1) % segments;
      faces.push(a0, a0 + segments, a1, a1, a0 + segments, a1 + segments);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  put(group, geometry, material, 0, 0, 0);
}

export function addLiberty(out, data) {
  const site = data.pois.find(p => p.n === 'Statue of Liberty');
  if (!site) return;
  const group = new THREE.Group();
  group.name = 'New York-New York Statue of Liberty';
  group.position.set(site.x, 0, site.z);
  group.rotation.y = 1.05;
  const stone = sheen('#b4a18a', { spec: 0.18, glow: '#ffd2a0', glowK: 0.28 });
  const dark = sheen('#867c6d', { glow: '#e9b57d', glowK: 0.22 });
  const copper = sheen('#5d987e', { refl: 0.13, spec: 0.5, glow: '#8adbb2', glowK: 0.42 });
  const patina = sheen('#436f60', { spec: 0.38, glow: '#58a881', glowK: 0.32 });
  const gold = sheen('#d4a84d', { spec: 0.62, glow: '#ffe186', glowK: 0.76 });
  for (const [w, h, d, y, m] of [
    [14.2, 1.5, 13.4, 0.75, dark], [12.9, 2.2, 12.2, 2.6, stone],
    [11.4, 3.15, 10.45, 5.25, stone], [9.45, 9.3, 9.02, 11.2, stone],
    [10.12, 0.95, 9.7, 16.23, dark], [7.72, 3.7, 7.1, 18.47, stone], [8.43, 0.95, 7.9, 20.69, dark],
  ]) put(group, new THREE.BoxGeometry(w, h, d), m, 0, y, 0);
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      put(group, new THREE.BoxGeometry(0.39, 3.5, 0.11), dark, i * 2.4, 13.4, side * 4.53);
    }
  }
  robe(group, copper);
  cable(group, patina, [[-2.3, 35.25, 0.82], [-1.37, 33.5, 1.68], [0.8, 31.4, 1.71], [2.32, 30.18, 1.06]], 0.25, 22);
  taperedRod(group, copper, [-2.0, 34.95, 0.24], [-3.42, 37.77, 0.31], 0.88, 0.64);
  taperedRod(group, copper, [-3.42, 37.76, 0.31], [-4.16, 41.78, 0.74], 0.64, 0.45);
  ellipsoid(group, copper, -4.17, 41.81, 0.76, 0.59, 0.73, 0.58);
  taperedRod(group, copper, [2.32, 34.78, 0.22], [2.9, 31.88, 0.68], 0.81, 0.61);
  taperedRod(group, copper, [2.9, 31.88, 0.68], [2.12, 33.02, 1.74], 0.61, 0.43);
  const tablet = put(group, new THREE.BoxGeometry(1.95, 3.6, 0.41), patina, 2.52, 33.67, 1.51);
  tablet.rotation.set(0.2, -0.36, -0.27);
  ellipsoid(group, copper, -0.08, 37.53, 0.12, 1.21, 1.67, 1.23);
  ellipsoid(group, patina, -0.12, 37.74, -0.48, 1.31, 1.59, 0.88);
  ellipsoid(group, copper, -0.08, 37.48, 1.19, 0.25, 0.43, 0.32);
  put(group, new THREE.CylinderGeometry(1.33, 1.27, 0.53, 24), patina, 0, 38.48, 0.12);
  for (let i = 0; i < 7; i++) {
    const angle = (i - 3) * 0.38;
    const x = Math.sin(angle) * 1.18, y = 38.64 + Math.cos(angle) * 0.4;
    taperedRod(group, copper, [x, y, 0.04], [x + Math.sin(angle) * 1.55, y + Math.cos(angle) * 1.93, 0], 0.25, 0.012, 5);
  }
  taperedRod(group, copper, [-4.17, 41.75, 0.74], [-4.17, 43.1, 0.74], 0.28, 0.67);
  ellipsoid(group, gold, -4.15, 43.94, 0.74, 0.63, 0.97, 0.54);
  out.add(bakeStatic(group));
  const water = new Soup();
  for (const a of data.areas) {
    if (a.k !== 'water') continue;
    const [x, z] = centroid(a.pts);
    if (Math.hypot(x - site.x, z - site.z) < 17) water.cap(clean(a.pts), 0.31);
  }
  const pool = water.mesh(makeWaterMaterial('#469cae', '#2d708c', '#93c7cc'), 'Liberty plaza basin');
  if (pool) out.add(pool);
  out.add(spill(site.x, 0.44, site.z, 28, '#c2edcf', 0.24));
}

export function addBrooklynBridge(out, data) {
  const walk = data.walks.find(w => w.name === 'Brooklyn Bridge');
  if (!walk || walk.pts.length < 2) return;
  const [x0, z0] = walk.pts[0], [x1, z1] = walk.pts[walk.pts.length - 1];
  const length = Math.hypot(x1 - x0, z1 - z0), half = length / 2;
  const group = new THREE.Group();
  group.name = 'Brooklyn Bridge replica';
  group.position.set((x0 + x1) / 2, walk.y?.[0] ?? 6.8, (z0 + z1) / 2);
  group.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  const stone = sheen('#b9a890', { spec: 0.18, glow: '#ffe0b3', glowK: 0.35 });
  const iron = sheen('#716e65', { spec: 0.43, glow: '#d4b885', glowK: 0.26 });
  const lamp = sheen('#dacfb9', { glow: '#ffe2ab', glowK: 0.88 });
  put(group, new THREE.BoxGeometry(length, 1.12, 7.25), stone, 0, -0.55, 0);
  for (const side of [-1, 1]) {
    put(group, new THREE.BoxGeometry(length, 0.56, 0.37), stone, 0, 0.31, side * 3.45);
  }
  const pierAt = half * 0.54;
  for (const x of [-pierAt, pierAt]) {
    for (const z of [-3.15, 0, 3.15]) {
      put(group, new THREE.BoxGeometry(3.0, 14.5, 1.04), stone, x, 2.25, z);
      put(group, new THREE.BoxGeometry(3.34, 0.78, 1.32), stone, x, 9.46, z);
    }
    for (const side of [-1, 1]) {
      const arch = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        arch.push([x, 5.05 + (1 - Math.abs(t * 2 - 1) ** 1.75) * 3.15, side * (0.38 + t * 2.38)]);
      }
      cable(group, stone, arch, 0.33, 20);
    }
    put(group, new THREE.BoxGeometry(3.38, 1.24, 7.74), stone, x, 9.13, 0);
  }
  for (const side of [-1, 1]) {
    const z = side * 3.5;
    const path = cable(group, iron, [[-half, 0.74, z], [-pierAt, 9.95, z],
      [0, 2.5, z], [pierAt, 9.95, z], [half, 0.74, z]], 0.12);
    for (let i = 1; i < 29; i++) {
      const p = path.getPoint(i / 29);
      taperedRod(group, iron, [p.x, 0.56, z], [p.x, p.y, z], 0.047, 0.047, 5);
    }
    for (let i = -3; i <= 3; i++) {
      const x = i * half / 3.5;
      taperedRod(group, iron, [x, 0.48, z], [x, 2.05, z], 0.07, 0.07, 6);
      ellipsoid(group, lamp, x, 2.02, z, 0.19, 0.32, 0.19);
    }
  }
  out.add(bakeStatic(group));
}

export function addNynyPavilions(out) {
  const group = new THREE.Group();
  group.name = 'New York-New York Tropicana entrance pavilions';
  const cream = sheen('#c5b59c', { glow: '#ffe0ad', glowK: 0.44 });
  const warm = sheen('#9e775a', { glow: '#ffbf87', glowK: 0.28 });
  const lead = sheen('#606c69', { spec: 0.42, glow: '#bed9c4', glowK: 0.14 });
  const glass = sheen('#435258', { refl: 0.23, glow: '#e9b471', glowK: 0.25 });
  const drum = new Soup(), dome = new THREE.Group();
  dome.position.set(51.25, 8, 1670.1);
  group.add(dome);
  const ring = Array.from({ length: 20 }, (_, i) => {
    const a = i / 20 * 2 * Math.PI;
    return [Math.cos(a) * 8.21, Math.sin(a) * 8.21];
  });
  drum.walls(ring, 0, 10.5, WHITE, [18.5, 11, 1, 8]);
  const drumMesh = drum.mesh(facade(MODE.arcade, { color: '#c7bba6', glass: '#7c6b58', flood: '#ffdfa5',
    floodK: 0.97, bay: 3.3, pilasterW: 0.58, rate: 0.06 }), 'NYNY round colonnade');
  // Keep the Soup's world-space height inputs aligned with the elevated casino roof.
  dome.add(drumMesh);
  for (const [y, r, h] of [[0.35, 8.57, 0.75], [7.96, 8.53, 0.66], [10.15, 8.7, 1.13]]) {
    put(dome, new THREE.CylinderGeometry(r, r, h, 24), cream, 0, y, 0);
  }
  put(dome, new THREE.LatheGeometry([[8.28, 10.55], [7.98, 12.02], [7.1, 13.85], [5.82, 15.6],
    [4.0, 17.03], [2.15, 17.9], [1.18, 18.21]].map(([r, y]) => new THREE.Vector2(r, y)), 36), lead, 0, 0, 0);
  for (const [y, r] of [[12.04, 8.02], [15.6, 5.86], [18.19, 1.24]]) {
    put(dome, new THREE.TorusGeometry(r, 0.13, 6, 32).rotateX(Math.PI / 2), cream, 0, y, 0);
  }
  put(dome, new THREE.CylinderGeometry(0.25, 1.13, 1.71, 10), cream, 0, 18.95, 0);

  const hall = new THREE.Group();
  hall.position.set(80.2, 8, 1652.2);
  hall.rotation.y = Math.PI / 4;
  group.add(hall);
  put(hall, new THREE.BoxGeometry(29, 9.6, 9.4), warm, 0, 4.79, -1.2);
  put(hall, new THREE.BoxGeometry(30.2, 1.08, 10.18), cream, 0, 9.67, -1.14);
  put(hall, new THREE.BoxGeometry(27.2, 0.46, 8.8), lead, 0, 10.34, -1.29);
  for (const x of [-9.5, -3.2, 3.2, 9.5]) {
    put(hall, new THREE.BoxGeometry(0.69, 8.1, 0.79), cream, x, 4.31, 3.72);
  }
  for (const x of [-6.4, 0, 6.4]) {
    put(hall, new THREE.BoxGeometry(4.12, 5.05, 0.21), glass, x, 3.45, 3.58);
    const pediment = new THREE.Shape();
    pediment.moveTo(-2.43, 5.95);
    pediment.lineTo(0, 7.66);
    pediment.lineTo(2.43, 5.95);
    pediment.closePath();
    put(hall, new THREE.ExtrudeGeometry(pediment, { depth: 0.48, bevelEnabled: false }), cream, x, 0, 3.49);
  }
  for (const x of [-12.5, 12.5]) {
    put(hall, new THREE.BoxGeometry(5.3, 6.8, 6.0), warm, x, 10.3, 0.25);
    for (const y of [7.8, 9.2, 10.6, 12.0, 13.5]) {
      put(hall, new THREE.BoxGeometry(5.7, 0.38, 6.3), cream, x, y, 0.25);
    }
    put(hall, new THREE.CylinderGeometry(1.27, 3.64, 3.8, 4).rotateY(Math.PI / 4), lead, x, 15.59, 0.25);
  }
  out.add(bakeStatic(group));
}
