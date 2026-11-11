/**
 * Hand-built models for the Tropicana corner: MGM Grand, Excalibur and New York-New York.
 * These three own their tower footprints (see heroOwned in buildings.js) so the generic
 * extruder leaves them alone; podiums and garages stay with the shared city pipeline.
 * This file is the worked example for docs/landmark-rebuild-playbook.md.
 */
import { convexHull, hash } from '../landmarks/vendor/map/geom.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { halo, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { MODE, SANS, Soup, WHITE, area, bounds, centroid, clean, facade, inset, keep, offset, sign, spill, turret, turretKit } from './hero-kit.js';

const THREE = window.THREE;

// ───────────────────────────────── MGM Grand ─────────────────────────────────
function buildMGM(data) {
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
  const glass = new Soup(), trim = new Soup(), gilt = new Soup(), steps = new Soup();
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
    gilt.walls(offset(r, 0.3), b.h - 0.9, b.h + 0.25);
  });

  const emerald = facade(MODE.glass, { color: '#14a468', glow: '#46f09c', self: 0.2, roof: '#1c3f4c' });
  const darkTrim = facade(MODE.stone, { color: '#0f4a3c', roof: '#213d4b', self: 0.1 });
  const gold = sheen('#d9b55c', { refl: 0.3, spec: 1.2, glow: '#ffd874', glowK: 1.05, baseGlow: 0.08 });
  const stone = facade(MODE.stone, { color: '#f3e6c6', roof: '#ead9ae', flood: '#ffdf9e', floodK: 0.8, roofGlow: 0.4 });
  for (const m of [glass.mesh(emerald, 'MGM curtain wall'), trim.mesh(darkTrim, 'MGM parapets'), gilt.mesh(gold, 'MGM gilding'), steps.mesh(stone, 'MGM lion rotunda')]) if (m) out.add(m);

  // illuminated wordmarks high on each free wing end
  const font = `800 150px ${SANS}`, style = { font, color: '#ffe27a', background: '#0b3f31' };
  const y = main.h - 5.2;
  out.add(sign('MGM GRAND', nx1 - nx0 - 1.5, 5.4, cx, y, bb.z0 - 0.45, 0, -1, style));
  out.add(sign('MGM GRAND', nx1 - nx0 - 1.5, 5.4, cx, y, bb.z1 + 0.45, 0, 1, style));
  out.add(sign('MGM GRAND', ez1 - ez0 - 1.5, 5.4, bb.x1 + 0.45, y, cz, 1, 0, style));
  const west = towers.filter(b => b !== main).sort((p, q) => bounds(p.pts).x0 - bounds(q.pts).x0)[0];
  if (west) {
    const wb = bounds(west.pts);
    out.add(sign('MGM GRAND', wb.z1 - wb.z0 - 1.5, 5.0, wb.x0 - 0.45, west.h - 5, (wb.z0 + wb.z1) / 2, -1, 0, style));
  }
  out.add(spill(cx, 0.45, cz, 330, '#2fe08a', 0.3));
  out.add(spill(cx, 8.35, cz, 118, '#7dffc0', 0.34));
  if (rotunda.length) {
    const rc = centroid(rotunda[0].pts);
    out.add(spill(rc[0], 0.5, rc[1], 120, '#ffd690', 0.34));
  }
  const aura = halo(300, '#35e890', 0.14);
  aura.position.set(cx, main.h * 0.55, cz);
  out.add(aura);
  return out;
}

// ───────────────────────────────── Excalibur ─────────────────────────────────
function buildExcalibur(data) {
  const main = data.buildings.filter(b => /^excalibur hotel & casino$/i.test(b.name ?? '')).sort((a, b) => area(b.pts) - area(a.pts))[0];
  if (!main) return null;
  const out = new THREE.Group();
  out.name = 'Excalibur';
  const parts = data.buildings.filter(b => {
    if (b === main || b.h < 15 || area(b.pts) > 6000) return false;
    const c = centroid(b.pts);
    return c[0] > -215 && c[0] < 40 && c[1] > 1805 && c[1] < 2060;
  });
  const kit = turretKit(), order = [kit.roofs.red, kit.roofs.blue, kit.roofs.red, kit.roofs.gold, kit.roofs.blue];
  const stucco = new Soup(), keepWalls = new Soup(), slate = new Soup();
  const deco = new THREE.Group();
  const rounds = [];
  let pick = 0;
  parts.forEach((b, i) => {
    heroOwned.add(b);
    const ring = clean(b.pts), a = area(ring), c = centroid(ring), seed = hash(i * 13 + 5) * 40;
    if (b.h >= 60 && a > 2000) {
      // the two L-shaped hotel towers
      stucco.walls(ring, 0, b.h, WHITE, [b.h + 1, seed, 0, 0]);
      stucco.cap(ring, b.h, WHITE, [b.h, seed, 0, 0]);
      keepWalls.battlements(ring, b.h, WHITE, [b.h + 2.3, seed, 0, b.h - 40], { pitch: 3.4, w: 1.9, h: 1.6, t: 1.0, rail: 0.9 });
      // a blue-slate mansard band just under the battlements
      slate.walls(offset(ring, 0.4), b.h - 3.2, b.h - 0.6);
      // corbelled bartizans on the outer corners, the towers' signature silhouette
      const corners = [];
      for (const p of convexHull(ring.map(q => [q[0], q[1]]))) if (corners.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 17)) corners.push(p);
      corners.forEach((p, k) => {
        const dx = c[0] - p[0], dz = c[1] - p[1], L = Math.hypot(dx, dz) || 1;
        turret(deco, kit, p[0] + dx / L * 1.2, p[1] + dz / L * 1.2, 4.4, b.h - 15, b.h + 5.5, k % 2 ? kit.roofs.red : kit.roofs.blue, { corbel: true, tall: 3.0 });
      });
    } else if (ring.length >= 12 && a < 270 || a < 40) {
      rounds.push({ c, r: Math.max(1.9, Math.min(7.6, Math.sqrt(a / Math.PI))), h: b.h });
    } else {
      // keeps and curtain walls between the turrets
      keepWalls.walls(ring, 0, b.h, WHITE, [b.h, seed, 0, 0]);
      keepWalls.cap(ring, b.h, WHITE, [b.h, seed, 0, 0]);
      keepWalls.battlements(ring, b.h, WHITE, [b.h + 2, seed, 0, 0], { pitch: 2.6, w: 1.4, h: 1.3, t: 0.8, rail: 0.7 });
    }
  });
  // stacked rings share an axis: only the highest drum carries the cone
  rounds.sort((p, q) => q.h - p.h);
  for (const t of rounds) {
    const capped = rounds.some(o => o !== t && o.h > t.h && Math.hypot(o.c[0] - t.c[0], o.c[1] - t.c[1]) < 4);
    const roof = capped ? null : t.h > 44 ? kit.roofs.red : t.r < 2.6 ? order[(pick++ * 2 + 1) % order.length] : order[pick++ % order.length];
    turret(deco, kit, t.c[0], t.c[1], t.r, 0, t.h, roof, { tall: t.h > 44 ? 3.5 : 3.1 });
  }
  // gatehouse across the entrance drive, between the two inner gate turrets
  const gateA = rounds.find(t => Math.hypot(t.c[0] + 22, t.c[1] - 1844) < 6), gateB = rounds.find(t => Math.hypot(t.c[0] - 2, t.c[1] - 1868) < 6);
  if (gateA && gateB) {
    const mx = (gateA.c[0] + gateB.c[0]) / 2, mz = (gateA.c[1] + gateB.c[1]) / 2;
    const dx = gateB.c[0] - gateA.c[0], dz = gateB.c[1] - gateA.c[1], L = Math.hypot(dx, dz), ax = dx / L, az = dz / L;
    const nx = az, nz = -ax; // toward the Strip corner
    keepWalls.box(mx, 9, mz, L - 6, 6.5, 3.2, ax, az, WHITE, [15.5, 3, 0, 0]);
    for (const s of [-1, 1]) keepWalls.box(mx + ax * s * (L / 2 - 5), 0, mz + az * s * (L / 2 - 5), 4, 9, 3.2, ax, az, WHITE, [9, 3, 0, 0]);
    for (let k = 0; k < 9; k++) keepWalls.box(mx + ax * (k - 4) * (L - 8) / 9, 15.5, mz + az * (k - 4) * (L - 8) / 9, 1.5, 1.4, 3.2, ax, az, WHITE, [17, 3, 0, 0]);
    const banner = sign('EXCALIBUR', L - 9, 4.4, mx + nx * 1.75, 12.3, mz + nz * 1.75, nx, nz, { font: '700 150px Georgia, "Times New Roman", serif', color: '#ffe388', background: '#8f1820' });
    out.add(banner);
  }
  const wall = facade(MODE.stucco, { color: '#ebe9e6', flood: '#ffdfb4', floodK: 0.5, self: 0.04, roof: '#59647e' });
  const keepMat = facade(MODE.stone, { color: '#f4f0e7', flood: '#ffdcae', floodK: 0.9, self: 0.06, roof: '#66708a' });
  const slateMat = sheen('#3d5fae', { spec: 0.5, glow: '#4f7cf0', glowK: 0.3, baseGlow: 0.04 });
  for (const m of [stucco.mesh(wall, 'Excalibur towers'), keepWalls.mesh(keepMat, 'Excalibur keeps'), slate.mesh(slateMat, 'Excalibur slate')]) if (m) out.add(m);
  out.add(bakeStatic(deco, keep));
  const bc = centroid(main.pts);
  out.add(spill(bc[0] + 10, 0.45, bc[1] - 15, 250, '#ffd9a6', 0.3));
  out.add(spill(bc[0] + 10, 14.4, bc[1] - 15, 105, '#ffe2bc', 0.32));
  return out;
}

// ───────────────────────────── New York-New York ─────────────────────────────
// centre x, centre z, height → masonry colour, crown, glazing variant
const SKYLINE = [
  [-58, 1598, 161, '#cdc2ab', 'esb', 1],
  [2, 1482, 154.4, '#b7c0c9', 'chrysler', 1],
  [1, 1482, 122.4, '#b7c0c9', 'none', 1],
  [-16, 1520, 128.8, '#a9644b', 'pyramid', 0],
  [-29, 1558, 128.8, '#d8ccb2', 'steps', 0],
  [-49, 1572, 112.8, '#6d8780', 'mansard', 0],
  [-2, 1500, 103.2, '#c8b08a', 'tank', 0],
  [9, 1462, 90.4, '#5a6672', 'flat', 1],
  [-64, 1619, 90.4, '#b3694c', 'tank', 0],
  [-27, 1546, 112.8, '#e4dac8', 'pyramid', 0],
  [-24, 1533, 112.8, '#bfae90', 'flat', 0],
  [-12, 1539, 74.4, '#94664f', 'tank', 0],
];
const FALLBACK = ['#d4c6ac', '#a9644b', '#7f948f', '#c8b08a', '#8d99a6'];
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
    steel: sheen('#d6dde6', { refl: 0.8, spec: 1.5, glow: '#e9f2ff', glowK: 0.75, baseGlow: 0.1 }),
    copper: sheen('#4f9a84', { refl: 0.3, spec: 0.8, glow: '#74dcbc', glowK: 0.5, baseGlow: 0.06 }),
    slate: sheen('#3c4654', { refl: 0.15, glow: '#8fb0e0', glowK: 0.12 }),
    wood: sheen('#6e4b32', { glow: '#ffb070', glowK: 0.12 }),
    white: new THREE.MeshBasicMaterial({ color: '#f2f7ff', fog: true }),
    amber: new THREE.MeshBasicMaterial({ color: '#ffd878', fog: true }),
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
    const col = tint.clone(), seed = hash(i * 29 + 7) * 40, aux = [h, seed, variant, 0];
    // three-stage massing: shaft, shoulder, cap
    const s1 = a > 200 ? inset(ring, 1.7) : null, s2 = s1 ? inset(ring, 3.5) : null;
    const y1 = s1 ? h * 0.8 : h, y2 = s2 ? h * 0.92 : h;
    walls.prism(ring, 0, y1, col, aux);
    if (s1) walls.prism(s1, y1, y2, col, aux);
    if (s2) walls.prism(s2, y2, h, col, aux);
    const top = s2 ?? s1 ?? ring, tc = centroid(top);
    let best = 0, angle = 0;
    for (let k = 0; k < top.length; k++) {
      const p = top[k], q = top[(k + 1) % top.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L > best) { best = L; angle = Math.atan2(q[1] - p[1], q[0] - p[0]); }
    }
    const w = Math.max(7, Math.min(20, Math.sqrt(area(top)) * 0.86));
    const g = new THREE.Group();
    g.position.set(tc[0], h, tc[1]);
    g.rotation.y = -angle;
    if (crown === 'esb') {
      add(g, new THREE.BoxGeometry(w, 6.5, w), mats.limestone, 3.25);
      add(g, new THREE.BoxGeometry(w * 0.72, 5.5, w * 0.72), mats.limestone, 9.25);
      add(g, new THREE.BoxGeometry(w * 0.5, 4.5, w * 0.5), mats.gold, 14.25);
      add(g, new THREE.CylinderGeometry(2.4, 3.9, 16, 16), mats.steel, 24.5);
      for (const ry of [18.5, 22.5, 26.5, 30.5]) add(g, new THREE.CylinderGeometry(3.3, 3.3, 0.8, 16), mats.amber, ry);
      add(g, new THREE.CylinderGeometry(0.18, 1.2, 22, 10), mats.steel, 43.5);
      add(g, new THREE.SphereGeometry(0.85, 10, 8), mats.beacon, 55);
      const glow = halo(26, '#ff5a48', 0.75);
      glow.position.set(tc[0], h + 55, tc[1]);
      out.add(glow);
      const wash = halo(90, '#ffe3a8', 0.2);
      wash.position.set(tc[0], h + 14, tc[1]);
      out.add(wash);
    } else if (crown === 'chrysler') {
      for (let tier = 0; tier < 7; tier++) {
        const f = 1 - tier * 0.125, tw = w * 1.1 * f, y = tier * 2.9 + 1.6;
        add(g, new THREE.BoxGeometry(tw, 3.2, tw), mats.steel, y);
        add(g, new THREE.CylinderGeometry(tw * 0.43, tw * 0.43, tw + 0.3, 14).rotateZ(Math.PI / 2), mats.white, y + 0.3);
        add(g, new THREE.CylinderGeometry(tw * 0.43, tw * 0.43, tw + 0.3, 14).rotateX(Math.PI / 2), mats.white, y + 0.3);
      }
      add(g, new THREE.ConeGeometry(1.3, 22, 12), mats.steel, 7 * 2.9 + 11);
      const wash = halo(70, '#e6f1ff', 0.26);
      wash.position.set(tc[0], h + 12, tc[1]);
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
  const masonry = facade(MODE.masonry, { vertexColors: true, flood: '#ffe6bd', floodK: 0.62, self: 0.05, roof: '#4a505c' });
  const m = walls.mesh(masonry, 'NYNY skyline');
  if (m) out.add(m);
  out.add(bakeStatic(crowns, keep));
  out.add(spill(-20, 0.45, 1545, 230, '#ffd49a', 0.3));
  out.add(spill(-25, 8.35, 1545, 95, '#ffe0b0', 0.3));
  return out;
}

export function buildTropicanaTrio(data) {
  const group = new THREE.Group();
  group.name = 'Tropicana corner resorts';
  for (const build of [buildMGM, buildExcalibur, buildNYNY]) {
    const model = build(data);
    if (model) group.add(model);
  }
  return group;
}
