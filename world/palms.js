import { MODE, Soup, bounds, clean, facade, inset, makeWaterMaterial, obb, offset, spill } from './hero-kit.js';
import { addShape, along, faces, mapped, material, model, named, own, parapet, put, standalonePodium } from './landmark-forms.js';
import { letterRun, signMaterial, signMesh } from './architectural-signs.js';
import { displayMaterial } from './strip-displays.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { palmGeometry } from '../landmarks/vendor/map/trees.js';

const THREE = window.THREE;
const PALE = '#d7d3c9';
const NORTH = [0, -1], SOUTH = [0, 1];

function facadeSign(group, ring, direction, title, y, width, height, color = '#fff4db') {
  const face = faces(ring, width * 0.77).sort((a, b) =>
    (b.nx - a.nx) * direction[0] + (b.nz - a.nz) * direction[1] + (b.length - a.length) * 0.004)[0];
  if (!face) return;
  const { x, z, ax, az, nx, nz, length } = face;
  const w = Math.min(length * 0.93, width), s = length / 2;
  const ink = signMaterial(title, w / height, (ctx, w, h) => {
    letterRun(ctx, title, w / 2, h / 2, w * 0.97, h * 0.80, color, '500 "Helvetica Neue", Arial, sans-serif', 7);
  }, '#bcc5c6');
  group.add(signMesh(ink, w, height, x + s * ax + nx * 0.5, y, z + s * az + nz * 0.5, nx, nz));
}

function ivoryCrown(group, ring, roofHeight) {
  const { x0, x1, z0, z1 } = bounds(ring);
  const crown = new Soup();
  const gap = 6, start = x0 + gap, end = x1 - gap;
  const colors = ['#62e5df', '#6ba3ff', '#b38dff', '#ff79c0', '#ffd27d'];
  const structural = sheen('#a3afb4', { refl: 0.45, spec: 0.85 });
  const leds = colors.map(color => new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const point = (f, z) => new THREE.Vector3(THREE.MathUtils.lerp(start, end, f),
    roofHeight + 0.8 + 7.1 * Math.sin(f * Math.PI), z);
  // Open curved frame above Ghostbar, with two rails across the roof rather than a solid gable.
  for (const z of [z0 + 1.7, z1 - 3.2]) {
    const rail = new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => point(i / 16, z)));
    addShape(group, new THREE.TubeGeometry(rail, 32, 0.46, 7, false), structural, 'Ivory rooftop arch frame', 0, 0, 0);
    for (let i = 1; i < 16; i++) {
      const p = rail.getPoint(i / 16);
      crown.box(p.x, roofHeight + 0.05, p.z, 0.17, p.y - roofHeight - 0.2, 0.2);
    }
    const lightZ = z < (z0 + z1) / 2 ? z - 0.41 : z + 0.41;
    for (const [i, led] of leds.entries()) {
      const segment = new THREE.CatmullRomCurve3(Array.from({ length: 6 }, (_, j) =>
        point((i + 0.028 + j * 0.188) / leds.length, lightZ)));
      addShape(group, new THREE.TubeGeometry(segment, 9, 0.17, 6, false), led,
        'Continuous Ivory roof light', 0, 0, 0);
    }
  }
  put(group, crown, structural, 'Braced arch supports');
}

function buildIvory(group, footprint, options, engine) {
  const ring = own(footprint, options), top = footprint.h - 7.9;
  const wall = new Soup(), glass = new Soup(), ribs = new Soup(), roof = new Soup();
  wall.walls(ring, 0, top);
  const hotelGlass = offset(ring, 0.06);
  for (const face of faces(hotelGlass, 4.6)) {
    const n = Math.max(1, Math.round(face.length / 3.05)), pitch = face.length / n;
    for (let i = 0; i < n; i++) {
      const s = i * pitch;
      along(glass, face, s + pitch * 0.16, s + pitch * 0.85, 14.2, top - 21.8, 0.095, 0.1);
      along(ribs, face, s + pitch * 0.06, s + pitch * 0.16, 13.8, top - 16.6, 0.35, 0.1);
    }
  }
  const ledge = offset(ring, 0.35);
  for (const y of [11.6, 18.4, 96.1, 108.2, top - 6.9, top - 0.7]) ribs.walls(ledge, y, y + 0.85);
  glass.walls(offset(ring, 0.23), top - 6.05, top - 0.75);
  roof.cap(ring, top);
  parapet(ribs, ring, top, 0.64, 0.28);
  const core = inset(ring, 3.4);
  if (core) roof.prism(core, top, top + 1.8);
  put(group, wall, material('#c4c4bb', '#aeb3b6', { self: 0.22, flood: '#d4e4ff', floodK: 0.11 }), 'Ivory Tower pale concrete');
  put(group, ribs, material('#e3ded0', '#d6d4ca', { self: 0.29 }), 'Ivory Tower piers and Ghostbar rim');
  put(group, glass, facade(MODE.ribbon, {
    color: '#67859a', glass: '#506378', glow: '#f5dcb2', bay: 3.12, rate: 0.15, self: 0.09,
  }), 'Ivory Tower recessed hotel windows');
  put(group, roof, material('#828e93', '#89949b'), 'Ghostbar roof terrace');
  ivoryCrown(group, ring, top);
  for (const d of [NORTH, SOUTH]) facadeSign(group, ring, d, 'PALMS', top - 3.7, 22, 4.9);

  // The Tall Wall faces east toward the Strip. Its mapped tower end is chamfered.
  const { x1, z0, z1 } = bounds(ring);
  const z = (z0 + z1) / 2, low = 23.3, high = 105.6, width = 14.6;
  const frame = new Soup();
  frame.box(x1 - 0.35, low - 0.3, z, width + 0.38, high - low + 0.6, 1.45, 0, 1);
  put(group, frame, material('#20262b'), 'Ivory Tall Wall cabinet');
  const art = displayMaterial(group, engine, 'Ivory Tall Wall', width / (high - low),
    ['ghostbar', 'neon-dive', 'waymo'], { duration: 11.1 });
  group.add(signMesh(art, width, high - low, x1 + 0.40, (high + low) / 2, z, 1, 0));
}

function buildFantasy(group, footprint, options) {
  const ring = own(footprint, options), top = footprint.h;
  const glass = new Soup(), lines = new Soup(), cap = new Soup(), skyVillas = new Soup(), fins = new Soup();
  glass.walls(ring, 0, top - 4.1, undefined, [top, 12, 1, 0]);
  const line = offset(ring, 0.13);
  for (let y = 16.4; y < top - 5.5; y += 3.21) lines.walls(line, y, y + 0.20);
  for (const face of faces(ring, 7)) {
    const n = Math.floor(face.length / 8.7);
    for (let i = 1; i <= n; i++) {
      const s = face.length * i / (n + 1);
      along(fins, face, s - 0.115, s + 0.115, 14.6, top - 22, 0.55, 0.21);
    }
  }
  const roof = offset(ring, 1.15);
  cap.prism(roof, top - 4.2, top - 2.85);
  parapet(cap, roof, top - 2.85, 0.78, 0.2);
  const penthouse = inset(ring, 1.7);
  if (penthouse) skyVillas.prism(penthouse, top - 19, top - 2.42);
  cap.box(-1802, top - 2.40, 250, 49, 1.6, 11, 0.993, -0.118);
  cap.box(-1799, top - 0.8, 250, 27, 0.8, 8, 0.993, -0.118);
  put(group, glass, facade(MODE.curtainWall, {
    color: '#397289', glass: '#72aac1', bay: 3.21, pilaster: '#6fadc0', glow: '#c2e7f6', rate: 0.12, self: 0.13,
  }), 'Fantasy Tower bowed blue glazing');
  put(group, skyVillas, material('#486778', '#465666', { self: 0.15 }), 'Fantasy Tower penthouse core');
  put(group, lines, material('#869da5', '#899fa7', { self: 0.16 }), 'Fantasy Tower spandrels');
  put(group, fins, material('#759faa', '#c5d5d9', { self: 0.23 }), 'Fantasy Tower vertical fins');
  put(group, cap, material('#607882', '#98a9ae', { self: 0.30 }), 'Fantasy Tower cantilevered crown');
  for (const d of [NORTH, SOUTH]) facadeSign(group, ring, d, 'PALMS', top - 7.0, 24, 5.0, '#effff2');
}

function planters(group, locations, y = 0.36) {
  const pots = new Soup();
  const palms = new THREE.InstancedMesh(palmGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), locations.length);
  const tree = new THREE.Object3D();
  for (const [i, [x, z]] of locations.entries()) {
    pots.box(x, y - 0.08, z, 2.4, 0.48, 2.4);
    tree.position.set(x, y + 0.36, z);
    tree.rotation.y = 1.4 * i;
    tree.scale.setScalar(0.72 + 0.14 * (i % 3));
    tree.updateMatrix();
    palms.setMatrixAt(i, tree.matrix);
  }
  palms.name = 'Palms in courtyard planters';
  palms.computeBoundingSphere();
  group.add(palms);
  put(group, pots, material('#ab9c82'), 'Court planter boxes');
}

function eastPool(group, data) {
  const basins = new Soup(), coping = new Soup(), deck = new Soup(), shade = new Soup();
  const plaza = data.areas.find(a => a.k === 'plaza' && a.pts.some(([x, z]) => x > -1748 && x < -1642 && z > 157 && z < 210));
  if (!plaza) return;
  deck.cap(clean(plaza.pts), 0.23);
  for (const a of data.areas.filter(a => a.k === 'water' &&
    a.pts.every(([x, z]) => x > -1744 && x < -1659 && z > 169 && z < 213))) {
    const r = clean(a.pts);
    coping.prism(offset(r, 0.55), 0.22, 0.44);
    basins.cap(r, 0.48);
  }
  const chairs = new Soup(), frames = new Soup();
  for (let i = 0; i < 8; i++) {
    const x = -1721 + i * 7.2;
    chairs.box(x, 0.35, 216.2, 1.22, 0.42, 2.35);
    chairs.box(x + 1.8, 0.35, 216.2, 1.22, 0.42, 2.35);
    shade.box(x + 0.9, 2.52, 222.4, 4.8, 0.20, 4.1);
    for (const s of [-1.95, 1.95]) frames.box(x + 0.9 + s, 0.31, 224, 0.16, 2.4, 0.18);
  }
  put(group, deck, material('#e7dbc4', '#e5dbc9'), 'Resort pool limestone terrace');
  put(group, coping, material('#ebe2ce'), 'Pool coping');
  put(group, basins, makeWaterMaterial('#45c1ca', '#056c91', '#9bdacf'), 'Two Palms Resort pools');
  put(group, chairs, material('#e6ddd0', '#eadace'), 'Pool loungers');
  put(group, shade, material('#e1c9a5'), 'Poolside cabanas');
  put(group, frames, material('#a59783'), 'Pergola frames');
  planters(group, [[-1742, 196], [-1733, 208], [-1700, 197], [-1659, 183], [-1650, 204]]);
}

function arrival(group, engine) {
  const canopy = new Soup(), frame = new Soup(), soffit = new Soup();
  const ring = clean([[-1860, 156], [-1856, 146], [-1849, 140], [-1827, 139], [-1813, 147], [-1808, 158], [-1833, 165]]);
  canopy.prism(ring, 6.5, 7.6);
  soffit.walls(offset(ring, 0.12), 6.5, 6.74);
  for (const [x, z] of [[-1854, 156.9], [-1848, 142.8], [-1830, 141.4], [-1813, 151.6]]) {
    frame.box(x, 0.08, z, 0.86, 6.55, 0.92);
  }
  put(group, canopy, material('#9b7257', '#c1b6a4', { self: 0.20 }), 'Palms main porte-cochère');
  put(group, frame, material('#918272'), 'Arrival canopy piers');
  put(group, soffit, sheen('#d7c094', { glow: '#ffcc8b', glowK: 0.85, baseGlow: 0.1 }), 'Arrival canopy light');
  const plaque = signMaterial('PALMS casino entry', 8, (ctx, w, h) => {
    letterRun(ctx, 'PALMS', w / 2, h / 2, w * 0.92, h * 0.84, '#fff3de', '500 "Helvetica Neue", Arial, sans-serif', 9);
  });
  group.add(signMesh(plaque, 12.5, 1.56, -1838, 7.25, 140, -0.06, -1));
  group.add(spill(-1834, 0.38, 151, 25, '#ffca90', 0.25));

  const pylons = new Soup();
  pylons.box(-1740, 0.15, 125, 2, 16.1, 1.7);
  pylons.box(-1728, 0.15, 125, 2, 16.1, 1.7);
  pylons.box(-1734, 8.2, 125, 15.8, 8.3, 1.85);
  put(group, pylons, material('#32393d', '#61605c'), 'West Flamingo roadside marquee');
  const art = displayMaterial(group, engine, 'Palms roadside LED', 2.05, ['ghostbar', 'neon-dive', 'late-checkout'], { duration: 10.4 });
  for (const [z, normal] of [[124.04, -1], [125.96, 1]]) {
    group.add(signMesh(art, 15.25, 7.45, -1734, 12.35, z, 0, normal));
    group.add(signMesh(plaque, 13.85, 1.73, -1734, 17.18, z, 0, normal));
  }
}

export function buildPalmsCasino(data, options, engine) {
  const out = model('Palms Casino Resort');
  const ivory = mapped(data, -1767, 151, 126), fantasy = named(data, 'Palms Fantasy Tower');
  if (ivory) buildIvory(out, ivory, options, engine);
  if (fantasy) buildFantasy(out, fantasy, options);
  const podium = named(data, 'Palms');
  standalonePodium(out, podium, options, material('#ada492', '#a59d90'));
  if (podium) {
    const shell = new Soup(), coping = new Soup(), services = new Soup();
    const ring = clean(podium.pts);
    shell.cap(ring, podium.h + 0.06);
    coping.walls(offset(ring, 0.08), podium.h - 0.34, podium.h + 0.38);
    for (const [x, z, w, d, h] of [
      [-2161, 242, 38, 16, 1.65], [-2086, 247, 55, 20, 2.3],
      [-1944, 226, 24, 13, 1.8], [-1896, 243, 49, 25, 5.0],
      [-1691, 250, 62, 19, 2.7],
    ]) services.box(x, podium.h, z, w, h, d);
    put(out, shell, material('#a39f92', '#a39e91'), 'Palms casino podium roof');
    put(out, coping, material('#9e988a', '#a49f93', { self: 0.13 }), 'Palms casino podium coping');
    put(out, services, material('#9a9589', '#8d8980'), 'Theater and casino mechanical roofs');
  }
  eastPool(out, data);
  arrival(out, engine);
  return out;
}

export function buildPalmsPlace(data, options) {
  const out = model('Palms Place');
  const footprint = named(data, 'Palms Place');
  if (!footprint) return out;
  const ring = own(footprint, options), h = footprint.h;
  const shaft = inset(ring, 7.0) ?? ring;
  const west = faces(shaft, 23).filter(f => Math.abs(f.nx) > 0.86);
  const base = new Soup(), shell = new Soup(), floors = new Soup(), caps = new Soup();
  const balcony = new Soup(), rails = new Soup(), lowGlass = new Soup(), lobby = new Soup();
  base.prism(ring, 0, 17.85);
  shell.walls(shaft, 11, h - 2.85, undefined, [h, 7, 1, 0]);
  const lip = offset(shaft, 0.15);
  for (let y = 19.25; y < h - 6.5; y += 3.12) {
    floors.walls(lip, y, y + 0.18);
    for (const f of west) {
      const n = Math.max(1, Math.floor(f.length / 13));
      for (let i = 0; i < n; i++) {
        const left = (i + 0.13) * f.length / n, right = (i + 0.87) * f.length / n;
        along(balcony, f, left, right, y, 0.27, 1.35, 0.67);
        along(rails, f, left + 0.06, right - 0.06, y + 0.27, 0.82, 0.095, 1.30);
        along(floors, f, left, right, y + 1.09, 0.065, 0.12, 1.30);
      }
    }
  }
  for (const f of faces(shaft, 20)) {
    along(caps, f, 0.10, 0.52, 16, h - 17.7, 0.46);
    along(caps, f, f.length - 0.52, f.length - 0.10, 16, h - 17.7, 0.46);
  }
  const roof = offset(shaft, 0.4);
  caps.prism(roof, h - 3.1, h - 2.15);
  parapet(caps, roof, h - 2.15, 1.05, 0.16);
  const penthouse = obb(shaft);
  caps.box(penthouse.cx, h - 2.05, penthouse.cz - 8, penthouse.w * 0.55, 2.03,
    penthouse.d * 0.82, penthouse.ax, penthouse.az);
  const front = faces(ring, 30).sort((a, b) => a.nz - b.nz)[0];
  if (front) {
    along(lowGlass, front, 2.4, front.length - 2.4, 0.8, 6.7, 0.24, 0.15);
    along(lobby, front, 7, front.length - 7, 6.72, 0.67, 5.8, 2.45);
  }
  // Enclosed SkyTube meets the adjacent garage and casino roof at the east podium.
  lowGlass.box(-2129.6, 13.35, 200.5, 48.5, 3.7, 5.9);
  caps.box(-2129.6, 13.03, 200.5, 48.8, 0.42, 6.2);
  caps.box(-2129.6, 16.98, 200.5, 48.8, 0.55, 6.3);
  for (let x = -2152; x < -2105; x += 3) floors.box(x, 13.42, 200.5, 0.13, 3.56, 6.02);
  put(out, base, material('#b3aca2', '#a29b90'), 'Stone lobby and terrace podium');
  put(out, shell, facade(MODE.curtainWall, {
    color: '#3d7895', glass: '#82b6cf', bay: 3.12, glow: '#e3c8a8', rate: 0.075, pilaster: '#7da1b0', self: 0.11,
  }), 'Palms Place floor-to-ceiling blue glass');
  put(out, floors, material('#9db4be', '#bac7ca', { self: 0.14 }), 'Balcony caps and curtain wall rails');
  put(out, balcony, material('#778e9b', '#97adb8'), 'Palms Place balcony slabs');
  put(out, rails, material('#42687b', '#527a8b', { self: 0.08 }), 'Blue balcony guards');
  put(out, lowGlass, sheen('#4c7080', { refl: 0.79, spec: 1.0, glow: '#bfdcef', glowK: 0.57 }), 'Lobby glass and SkyTube');
  put(out, lobby, material('#b8aea0', '#e0dcd4'), 'Palms Place entry canopy');
  put(out, caps, material('#a4b5bc', '#959ea5', { self: 0.27 }), 'Penthouse and silver edge cladding');
  facadeSign(out, ring, NORTH, 'PALMS PLACE', 9.20, 27, 3.1);
  facadeSign(out, shaft, NORTH, 'PALMS PLACE', h - 5.9, 26, 4.1, '#e6f4ff');
  const pools = new Soup(), coping = new Soup();
  for (const a of data.areas.filter(a => a.k === 'water' &&
    a.pts.every(([x, z]) => x > -2196 && x < -2154 && z > 246 && z < 272))) {
    const pool = clean(a.pts);
    coping.prism(offset(pool, 0.4), 17.86, 18.15);
    pools.cap(pool, 18.19);
  }
  put(out, coping, material('#e3d8c8'), 'Palms Place pool coping');
  put(out, pools, makeWaterMaterial('#3caab8', '#096c8d', '#8fcac7'), 'Sixth-floor pool');
  return out;
}
