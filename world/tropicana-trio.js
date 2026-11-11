/**
 * Hand-built models for the Tropicana corner: MGM Grand, Excalibur and New York-New York.
 * These three own their tower footprints (see heroOwned in buildings.js) so the generic
 * extruder leaves them alone; podiums and garages stay with the shared city pipeline.
 * This file is the worked example for docs/landmark-rebuild-playbook.md.
 */
import { hash } from '../landmarks/vendor/map/geom.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { halo, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { MODE, SANS, Soup, WHITE, area, bounds, centroid, clean, facade, inset, keep, obb, offset, sign, spill } from './hero-kit.js';

import { buildExcalibur } from './excalibur.js';
import { addBrooklynBridge, addLiberty, addMgmLion, addNynyPavilions } from './tropicana-fronts.js';

const THREE = window.THREE;

// ───────────────────────────────── MGM Grand ─────────────────────────────────
function buildMGM(data, graph) {
  const out = new THREE.Group();
  out.name = 'MGM Grand';
  const towers = [], rotunda = [];
  for (const b of data.buildings) {
    if (!b.part) continue;
    const c = centroid(b.pts);
    if (c[0] > 225 && c[0] < 600 && c[1] > 1410 && c[1] < 1665 && b.h >= 50) towers.push(b);
    else if (b.col === '#018438' && b.h < 30 && area(b.pts) < 4000 && Math.hypot(c[0] - 252, c[1] - 1631) < 12) rotunda.push(b);
  }
  if (!towers.length) return null;
  const glass = new Soup(), trim = new Soup(), gilt = new Soup(), steps = new Soup(), cornice = new Soup();
  const main = towers.slice().sort((a, b) => area(b.pts) - area(a.pts))[0];
  towers.forEach((b, i) => {
    heroOwned.add(b);
    const ring = clean(b.pts), h = b.h, seed = hash(i * 17 + 3) * 40;
    glass.walls(ring, 0, h, WHITE, [h, seed, 0, 0]);
    // dark parapet with a gilded cap line: the crisp edge the tower shows against the sky
    trim.prism(offset(ring, 0.35), h - 0.2, h + 1.5, WHITE, [h + 1.5, seed, 0, h]);
    gilt.walls(offset(ring, 0.5), h + 1.5, h + 1.95);
  });
  // penthouse spines and rooftop plant along the two axes of the cross
  const ring = clean(main.pts), bb = bounds(ring), h = main.h + 1.5;
  const tipN = ring.filter(p => p[1] < bb.z0 + 10), tipE = ring.filter(p => p[0] > bb.x1 - 10);
  const nx0 = Math.min(...tipN.map(p => p[0])), nx1 = Math.max(...tipN.map(p => p[0]));
  const ez0 = Math.min(...tipE.map(p => p[1])), ez1 = Math.max(...tipE.map(p => p[1]));
  const cx = (nx0 + nx1) / 2, cz = (ez0 + ez1) / 2;
  const spineNS = [nx1 - nx0 - 9, bb.z1 - bb.z0 - 18], spineEW = [bb.x1 - bb.x0 - 18, ez1 - ez0 - 9];
  const a = [h + 5, 7, 0, h];
  glass.box(cx, h, (bb.z0 + bb.z1) / 2, spineNS[0], 4.6, spineNS[1], 1, 0, WHITE, a);
  glass.box((bb.x0 + bb.x1) / 2, h, cz, spineEW[0], 4.6, spineEW[1], 1, 0, WHITE, a);
  trim.box(cx, h + 4.6, (bb.z0 + bb.z1) / 2, spineNS[0] + 0.8, 0.7, spineNS[1] + 0.8);
  trim.box((bb.x0 + bb.x1) / 2, h + 4.6, cz, spineEW[0] + 0.8, 0.7, spineEW[1] + 0.8);
  trim.box(cx, h + 5.3, cz, 16, 4.2, 16);
  gilt.walls(offset([[cx - 8, cz - 8], [cx + 8, cz - 8], [cx + 8, cz + 8], [cx - 8, cz + 8]], 0.3), h + 8.9, h + 9.5);
  for (let k = 0; k < 9; k++) {
    const along = hash(k * 5 + 1), ns = k % 2 === 0;
    const px = ns ? cx + (hash(k) - 0.5) * 5 : bb.x0 + 16 + along * (bb.x1 - bb.x0 - 32);
    const pz = ns ? bb.z0 + 16 + along * (bb.z1 - bb.z0 - 32) : cz + (hash(k) - 0.5) * 5;
    if (Math.hypot(px - cx, pz - cz) < 16) continue;
    trim.box(px, h + 5.3, pz, 3.5 + hash(k * 3) * 3, 1.4 + hash(k * 7) * 1.2, 3 + hash(k * 11) * 3);
  }
  // the stepped lion rotunda on the Strip corner, picked out in warm stone and gilded cornices
  rotunda.sort((p, q) => p.h - q.h);
  rotunda.forEach((b, i) => {
    heroOwned.add(b);
    const r = clean(b.pts), y0 = i ? rotunda[i - 1].h - 0.4 : 9;
    steps.prism(r, y0, b.h, WHITE, [b.h, i, 0, y0]);
    cornice.walls(offset(r, 0.21), b.h - 0.48, b.h + 0.06);
  });

  const emerald = facade(MODE.glass, { color: '#168052', glow: '#26c575', self: 0.075, roof: '#1c3f4c', rate: 0.058 });
  const darkTrim = facade(MODE.stone, { color: '#0f4a3c', roof: '#213d4b', self: 0.1 });
  const gold = sheen('#d9b55c', { refl: 0.3, spec: 1.2, glow: '#ffd874', glowK: 1.05, baseGlow: 0.08 });
  const stone = facade(MODE.stone, { color: '#d8c8aa', roof: '#9a947e', flood: '#ffdf9e', floodK: 0.52, roofGlow: 0.1 });
  for (const m of [glass.mesh(emerald, 'MGM curtain wall'), trim.mesh(darkTrim, 'MGM parapets'),
    gilt.mesh(gold, 'MGM gilding'), steps.mesh(stone, 'MGM entrance rotunda'), cornice.mesh(stone, 'MGM rotunda cornices')]) if (m) out.add(m);

  // illuminated wordmarks high on each free wing end
  const font = `900 164px ${SANS}`, style = { font, color: '#ffdc70' };
  const y = main.h - 5.2;
  out.add(sign('MGM GRAND', nx1 - nx0 - 1.5, 5.4, cx, y, bb.z0 - 0.45, 0, -1, style));
  out.add(sign('MGM GRAND', nx1 - nx0 - 1.5, 5.4, cx, y, bb.z1 + 0.45, 0, 1, style));
  out.add(sign('MGM GRAND', ez1 - ez0 - 1.5, 5.4, bb.x1 + 0.45, y, cz, 1, 0, style));
  const west = towers.filter(b => b !== main).sort((p, q) => bounds(p.pts).x0 - bounds(q.pts).x0)[0];
  if (west) {
    const wb = bounds(west.pts);
    out.add(sign('MGM GRAND', wb.z1 - wb.z0 - 1.5, 5.0, wb.x0 - 0.45, west.h - 5, (wb.z0 + wb.z1) / 2, -1, 0, style));
  }
  // Broad south and north elevations carry the main gold crown lettering.
  for (const [x, z, nz] of [[513, 1549, 1], [511, 1526.75, -1]]) {
    out.add(sign('MGM GRAND', 29, 6.25, x, main.h - 2.95, z + nz * 0.88, 0, nz, style));
  }
  out.add(spill(cx, 0.45, cz, 260, '#36cd82', 0.17));
  out.add(spill(cx, 8.35, cz, 105, '#5deaa1', 0.2));
  if (rotunda.length) {
    const rc = centroid(rotunda[0].pts);
    out.add(spill(rc[0], 0.5, rc[1], 120, '#ffd690', 0.34));
  }
  const aura = halo(242, '#35e890', 0.085);
  aura.position.set(cx, main.h * 0.55, cz);
  out.add(aura);
  addMgmLion(out, data, graph);
  return out;
}

// ───────────────────────────── New York-New York ─────────────────────────────
// centre x, centre z, height → masonry colour, crown, glazing variant
const SKYLINE = [
  [-58, 1598, 161, '#c0b8a5', 'esb', 1],
  [2, 1482, 154.4, '#c4bdac', 'chrysler', 1],
  [1, 1482, 122.4, '#a59a88', 'none', 0],
  [-16, 1520, 128.8, '#a9644b', 'pyramid', 0],
  [-29, 1558, 128.8, '#d8ccb2', 'steps', 0],
  [-49, 1572, 112.8, '#6d8780', 'mansard', 0],
  [-2, 1500, 103.2, '#c8b08a', 'tank', 0],
  [9, 1462, 90.4, '#58626c', 'flat', 2],
  [-64, 1619, 90.4, '#3a5756', 'flat', 2],
  [-27, 1546, 112.8, '#e4dac8', 'pyramid', 0],
  [-24, 1533, 112.8, '#bfae90', 'flat', 0],
  [-12, 1539, 74.4, '#94664f', 'tank', 0],
];
const FALLBACK = ['#d4c6ac', '#a9644b', '#7f948f', '#c8b08a', '#8d99a6'];

function empireCrown(g, w, mats, add) {
  add(g, new THREE.BoxGeometry(w * 0.95, 3.6, w * 0.95), mats.limestone, 1.8);
  add(g, new THREE.BoxGeometry(w * 0.72, 2.9, w * 0.72), mats.limestone, 5.05);
  add(g, new THREE.BoxGeometry(w * 0.53, 2.2, w * 0.53), mats.limestone, 7.6);
  add(g, new THREE.CylinderGeometry(1.85, 3.0, 10.6, 12), mats.steel, 13.9);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const fin = add(g, new THREE.BoxGeometry(0.29, 10.35, 0.32), mats.limestone, 13.8,
      2.45 * Math.sin(a), 2.45 * Math.cos(a));
    fin.rotation.y = a;
    fin.rotateX(-0.105);
  }
  for (const [y, r] of [[8.7, 3.13], [18.95, 2.1]]) {
    add(g, new THREE.CylinderGeometry(r, r, 0.41, 16), mats.gold, y);
  }
  add(g, new THREE.CylinderGeometry(0.08, 0.61, 4.6, 8), mats.steel, 21.5);
  add(g, new THREE.SphereGeometry(0.29, 10, 8), mats.beacon, 23.6);
}

function chryslerCrown(g, w, mats, add) {
  const shell = new Soup(), eaves = new Soup(), windows = new Soup();
  const scale = [1, 0.86, 0.71, 0.57, 0.44, 0.31, 0.18];
  const square = a => [[-a, -a], [a, -a], [a, a], [-a, a]];
  for (let tier = 0; tier < scale.length - 1; tier++) {
    const low = w * scale[tier] * 0.51, high = w * scale[tier + 1] * 0.51;
    const y = tier * 3.28, h = 3.35;
    shell.skirt(square(low), y, square(high), y + h);
    eaves.walls(square(low + 0.27), y - 0.02, y + 0.34);
    for (let face = 0; face < 4; face++) {
      const a = Math.PI / 2 * face, nx = Math.sin(a), nz = Math.cos(a);
      const count = Math.max(1, 5 - tier);
      const normal = new THREE.Vector3(nx * h, low - high, nz * h).normalize().toArray();
      const vert = (s, t) => {
        const d = THREE.MathUtils.lerp(low, high, t) + 0.075;
        return windows.vert(nx * d + nz * s, y + h * t, nz * d - nx * s,
          normal, 0, WHITE, [22, 0, 0, 0]);
      };
      for (let k = 0; k < count; k++) {
        const x = (k + 0.5 - count / 2) * low * 1.26 / count;
        const half = low * 0.37 / count;
        windows.idx.push(vert(x - half, 0.18), vert(x + half, 0.18), vert(x * 0.87, 0.82));
      }
    }
  }
  g.add(shell.mesh(mats.steel, 'Chrysler taper'), eaves.mesh(mats.steel, 'Chrysler roof ribs'),
    windows.mesh(mats.crownGlass, 'Chrysler triangular windows'));
  add(g, new THREE.CylinderGeometry(0.08, 0.69, 2.72, 8), mats.steel, 21.01);
  add(g, new THREE.SphereGeometry(0.2, 10, 8), mats.beacon, 22.35);
}

function buildNYNY(data) {
  const parts = data.buildings.filter(b => {
    if (!b.part || b.h < 70) return false;
    const c = centroid(b.pts);
    return c[0] > -95 && c[0] < 40 && c[1] > 1440 && c[1] < 1650;
  });
  if (!parts.length) return null;
  const out = new THREE.Group();
  out.name = 'New York-New York';
  const walls = new Soup(), crowns = new THREE.Group(), tint = new THREE.Color();
  const mats = {
    limestone: facade(MODE.stone, { color: '#e3d8c2', flood: '#fff0cf', floodK: 1.25, roof: '#b5aa94', roofGlow: 0.5 }),
    gold: sheen('#d8ad48', { refl: 0.5, spec: 1.2, glow: '#ffe08a', glowK: 0.95, baseGlow: 0.12 }),
    steel: sheen('#a9adb2', { refl: 0.51, spec: 1.12, glow: '#dce6ec', glowK: 0.24 }),
    crownGlass: sheen('#515764', { refl: 0.28, spec: 0.6, glow: '#e3ecf0', glowK: 0.62 }),
    copper: sheen('#4f9a84', { refl: 0.3, spec: 0.8, glow: '#74dcbc', glowK: 0.5, baseGlow: 0.06 }),
    slate: sheen('#3c4654', { refl: 0.15, glow: '#8fb0e0', glowK: 0.12 }),
    wood: sheen('#6e4b32', { glow: '#ffb070', glowK: 0.12 }),
    beacon: new THREE.MeshBasicMaterial({ color: '#ff3b30', fog: true }),
  };
  const add = (g, geometry, material, y, x = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  parts.forEach((b, i) => {
    heroOwned.add(b);
    const ring = clean(b.pts), a = area(ring), c = centroid(ring), h = b.h;
    if (a < 60) return; // the spire stub; the crown below replaces it
    const spec = SKYLINE.find(s => Math.abs(s[2] - h) < 0.5 && Math.hypot(s[0] - c[0], s[1] - c[1]) < 9);
    const [color, crown, variant] = spec ? spec.slice(3) : [FALLBACK[i % FALLBACK.length], 'flat', 0];
    tint.set(color);
    const col = tint.clone(), seed = hash(i * 29 + 7) * 40;
    const hRoof = crown === 'esb' ? h - 23.85 : crown === 'chrysler' ? h - 22.6 : h;
    const aux = [hRoof, seed, variant, 0];
    // The mapped top heights include the two signature spires.
    const s1 = a > 200 && crown !== 'none' ? inset(ring, crown === 'esb' ? 1.28 : 1.06) : null;
    const s2 = crown === 'esb' && s1 ? inset(ring, 2.88) : null;
    const y1 = s1 ? hRoof * (crown === 'esb' ? 0.76 : 0.89) : hRoof;
    const y2 = s2 ? hRoof * 0.925 : hRoof;
    const yBase = crown === 'chrysler' ? 117.4 : 7.8;
    walls.prism(ring, yBase, y1, col, aux);
    if (s1) walls.prism(s1, y1, y2, col, aux);
    if (s2) walls.prism(s2, y2, hRoof, col, aux);
    const top = s2 ?? s1 ?? ring, box = obb(top);
    const [x, z] = crown === 'esb' ? [-58.9, 1594.5] : [box.cx, box.cz];
    const w = Math.max(7, Math.min(crown === 'chrysler' ? 12.0 : 20, Math.sqrt(area(top)) * 0.86));
    const g = new THREE.Group();
    g.position.set(x, hRoof, z);
    g.rotation.y = -Math.atan2(box.az, box.ax);
    if (crown === 'esb') {
      empireCrown(g, w, mats, add);
      const wash = halo(35, '#f7e6b9', 0.19);
      wash.position.set(x, hRoof + 11, z);
      out.add(wash);
    } else if (crown === 'chrysler') {
      chryslerCrown(g, w, mats, add);
      const wash = halo(32, '#e6f1ff', 0.14);
      wash.position.set(x, hRoof + 7, z);
      out.add(wash);
    } else if (crown === 'pyramid') {
      add(g, new THREE.BoxGeometry(w * 1.02, 1.2, w * 1.02), mats.limestone, 0.6);
      add(g, new THREE.ConeGeometry(w * 0.7, w * 0.95, 4).rotateY(Math.PI / 4), mats.copper, 1.2 + w * 0.475);
      add(g, new THREE.CylinderGeometry(0.9, 1.4, 4.5, 8), mats.gold, 1.2 + w * 0.95 + 1.6);
    } else if (crown === 'steps') {
      for (let k = 0; k < 4; k++) add(g, new THREE.BoxGeometry(w * (1 - k * 0.2), 3.8, w * (1 - k * 0.2)), k === 3 ? mats.gold : mats.limestone, k * 3.8 + 1.9);
      add(g, new THREE.CylinderGeometry(0.15, 0.5, 9, 6), mats.steel, 4 * 3.8 + 4.5);
    } else if (crown === 'mansard') {
      add(g, new THREE.BoxGeometry(w * 1.04, 1.1, w * 1.04), mats.limestone, 0.55);
      add(g, new THREE.CylinderGeometry(w * 0.34, w * 0.7, 8.5, 4).rotateY(Math.PI / 4), mats.copper, 1.1 + 4.25);
      add(g, new THREE.BoxGeometry(w * 0.3, 2.4, w * 0.3), mats.gold, 1.1 + 8.5 + 1.2);
    } else if (crown !== 'none') {
      add(g, new THREE.BoxGeometry(w * 1.05, 1.0, w * 1.05), mats.limestone, 0.5);
      add(g, new THREE.BoxGeometry(w * 0.5, 2.6, w * 0.4), mats.slate, 2.3, w * 0.12, -w * 0.1);
      if (crown === 'tank') {
        // the rooftop water tank no Manhattan block goes without
        const tx = -w * 0.22, tz = w * 0.2;
        for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(g, new THREE.BoxGeometry(0.25, 3, 0.25), mats.slate, 2.5, tx + lx * 1.1, tz + lz * 1.1);
        add(g, new THREE.CylinderGeometry(1.7, 1.7, 3.4, 12), mats.wood, 5.7, tx, tz);
        add(g, new THREE.ConeGeometry(1.95, 1.5, 12), mats.slate, 8.15, tx, tz);
      }
    }
    crowns.add(g);
  });
  const masonry = facade(MODE.masonry, { vertexColors: true, flood: '#ffe2b1', floodK: 0.86, rate: 0.11, self: 0.052, roof: '#4a505c' });
  const m = walls.mesh(masonry, 'NYNY skyline');
  if (m) out.add(m);
  out.add(bakeStatic(crowns, keep));
  addLiberty(out, data);
  addBrooklynBridge(out, data);
  addNynyPavilions(out);
  out.add(spill(-20, 0.45, 1545, 230, '#ffd49a', 0.3));
  out.add(spill(-25, 8.35, 1545, 95, '#ffe0b0', 0.3));
  return out;
}

export function buildTropicanaTrio(data, graph) {
  const group = new THREE.Group();
  group.name = 'Tropicana corner resorts';
  for (const build of [buildMGM, buildExcalibur, buildNYNY]) {
    const model = build(data, graph);
    if (model) group.add(model);
  }
  return group;
}
