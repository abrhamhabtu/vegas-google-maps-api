/** Excalibur's two hotel wings, paired castle keeps and pedestrian gate. */
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { hash } from '../landmarks/vendor/map/geom.js';
import { MODE, SERIF, Soup, WHITE, area, centroid, clean, facade, makeWaterMaterial, offset, sign, spill, turret, turretKit } from './hero-kit.js';

const THREE = window.THREE;

// The blue roofs sit above the two Strip-facing towers. The red central spires
// and their gold flanking spires repeat in the south court.
const CONES = [
  [-36, 1855, 'blue', 36.5, 16.9], [-9, 1882, 'blue', 36.5, 16.9],
  [-67, 1865, 'red', 41.4, 11.4], [-18, 1914, 'red', 35.5, 9.4],
  [-68, 1892, 'gold', 42.6, 15.4], [-51, 1894, 'red', 49.3, 20.2],
  [-26, 1894, 'gold', 42.6, 15.2], [-146, 1943, 'red', 34.2, 10.4],
  [-136, 1963, 'red', 41.5, 17.4], [-149, 1974, 'blue', 27.2, 13.7],
  [-126, 1997, 'blue', 27.2, 14.8], [-117, 1980, 'gold', 36.4, 14.3],
  [-96, 1964, 'gold', 40.5, 14.3], [-97, 1993, 'red', 39.7, 11.3],
];

function square(x, z, w, d, ax = 1, az = 0) {
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([s, t]) =>
    [x + (ax * s - az * t) / 2, z + (az * s + ax * t) / 2]);
}

function wing(out, parts, building, base, isNorth) {
  const ring = clean(building.pts), h = building.h;
  parts.hotel.walls(ring, base - 0.3, h, WHITE, [h, isNorth ? 3 : 41, 0, base]);
  parts.parapet.prism(offset(ring, 0.22), h - 0.6, h + 0.04);
  parts.parapet.battlements(ring, h + 0.02, WHITE, [h + 1.75, 0, 0, h - 2], {
    pitch: 2.9, w: 1.45, h: 1.03, t: 0.76, rail: 0.68,
  });
  // Corner blocks have squared eaves and hipped blue caps.
  const corners = isNorth ? [[-170.8, 1852, 13, 13], [-75, 1841.2, 11, 14], [-165.6, 1946, 11, 13]]
    : [[10.5, 2003.3, 14, 13], [9.6, 1923.4, 10.5, 14], [-87.5, 2010.2, 11, 13]];
  for (const [x, z, w, d] of corners) {
    parts.parapet.box(x, base, z, w * 0.88, h - base + 0.7, d * 0.88);
    const eave = square(x, z, w, d), shoulder = square(x, z, w * 0.83, d * 0.84);
    const ridge = square(x, z, w * 0.36, d * 0.49);
    parts.parapet.skirt(shoulder, h - 5.6, eave, h - 1.05);
    parts.parapet.walls(eave, h - 1.07, h + 0.8);
    parts.blue.skirt(eave, h + 0.8, ridge, h + 6.4);
    parts.blue.cap(ridge, h + 6.4);
  }
  const [x, z] = isNorth ? [-153, 1841] : [-60, 2013.5];
  for (let k = 0; k < 4; k++) {
    parts.parapet.box(x + k * 10.6, h + 0.1, z, 6.9, 1.25, 4.4);
  }
  out.add(spill(x, base + 0.42, z, 17, '#fff2d6', 0.18));
}

function pointedGate(out, parts, a, b) {
  const [x, z] = [(a.x + b.x) / 2, (a.z + b.z) / 2];
  const len = Math.hypot(b.x - a.x, b.z - a.z), ax = (b.x - a.x) / len, az = (b.z - a.z) / len;
  const nx = az, nz = -ax;
  const frame = new THREE.Group();
  frame.name = 'Excalibur pointed gate';
  frame.position.set(x, 0, z);
  frame.rotation.y = Math.atan2(nx, nz);
  const half = len / 2 - 2.65, opening = 7.6, spring = 7.3, peak = 12.1, top = 16.7;
  const arch = new THREE.Shape();
  arch.moveTo(-half, 0.1);
  arch.lineTo(-opening, 0.1);
  arch.lineTo(-opening, spring);
  arch.quadraticCurveTo(-opening * 0.92, peak - 1.35, 0, peak);
  arch.quadraticCurveTo(opening * 0.92, peak - 1.35, opening, spring);
  arch.lineTo(opening, 0.1);
  arch.lineTo(half, 0.1);
  arch.lineTo(half, top);
  arch.lineTo(-half, top);
  arch.closePath();
  const wall = new THREE.ExtrudeGeometry(arch, { depth: 3.6, bevelEnabled: false, curveSegments: 18 }).translate(0, 0, -1.8);
  frame.add(new THREE.Mesh(wall, sheen('#ded2be', { glow: '#ffe8ce', glowK: 0.36 })));
  const molding = new THREE.CurvePath();
  const v = (u, y) => new THREE.Vector3(u, y, 1.94);
  molding.add(new THREE.LineCurve3(v(-opening, 0.2), v(-opening, spring)));
  molding.add(new THREE.QuadraticBezierCurve3(v(-opening, spring), v(-opening * 0.92, peak - 1.35), v(0, peak)));
  molding.add(new THREE.QuadraticBezierCurve3(v(0, peak), v(opening * 0.92, peak - 1.35), v(opening, spring)));
  molding.add(new THREE.LineCurve3(v(opening, spring), v(opening, 0.2)));
  frame.add(new THREE.Mesh(new THREE.TubeGeometry(molding, 48, 0.43, 6, false),
    sheen('#c3ac85', { glow: '#ffd69b', glowK: 0.4 })));
  out.add(bakeStatic(frame));
  parts.parapet.battlements(square(x, z, half * 2 + 0.3, 4, ax, az), top - 0.05, WHITE, [top + 1.5, 7, 0, 0],
    { pitch: 2.8, w: 1.55, h: 1.11, rail: 0.62, t: 0.61 });
  out.add(sign('EXCALIBUR', 18.3, 4.0, x + nx * 2.04, 14.1, z + nz * 2.04, nx, nz, {
    color: '#ffe4a2', background: '#75313a', font: `700 134px ${SERIF}`,
  }));
}

function streetGate(parts, deco, data, kit) {
  const towers = data.buildings.filter(b => {
    if (b.h !== 5 || b.pts.length < 12) return false;
    const [x, z] = centroid(b.pts);
    return x > 40 && x < 63 && z > 1781 && z < 1805;
  });
  if (towers.length !== 4) return;
  for (const b of towers) {
    heroOwned.add(b);
    const [x, z] = centroid(b.pts);
    turret(deco, kit, x, z, 1.83, 0, 7.15, kit.roofs.red, { tall: 2.05 });
  }
  const eave = square(51.92, 1793.3, 8.8, 13.1, Math.SQRT1_2, Math.SQRT1_2);
  const ridge = square(51.92, 1793.3, 3.4, 7.5, Math.SQRT1_2, Math.SQRT1_2);
  parts.parapet.prism(eave, 9.65, 10.05);
  parts.blue.skirt(eave, 10.05, ridge, 13.7);
  parts.blue.cap(ridge, 13.7);
}

export function buildExcalibur(data) {
  const podium = data.buildings.filter(b => /^excalibur hotel & casino$/i.test(b.name ?? ''))
    .sort((a, b) => area(b.pts) - area(a.pts))[0];
  if (!podium) return null;
  const out = new THREE.Group();
  out.name = 'Excalibur';
  const deco = new THREE.Group();
  deco.name = 'Excalibur roof and tower ornaments';
  const parts = { hotel: new Soup(), parapet: new Soup(), keeps: new Soup(), blue: new Soup(),
    red: new Soup(), pools: new Soup() };
  const kit = turretKit();
  kit.stone = facade(MODE.stone, { color: '#f0e9dc', flood: '#fff1dc', floodK: 0.69, self: 0.16 });
  kit.roofs.red = sheen('#ae302b', { spec: 0.55, glow: '#ff6635', glowK: 0.47 });
  kit.roofs.blue = sheen('#284989', { spec: 0.44, glow: '#527cce', glowK: 0.29 });
  kit.roofs.gold = sheen('#d1a24a', { spec: 0.7, glow: '#ffd574', glowK: 0.6 });
  const rounds = [];
  data.buildings.forEach((b, i) => {
    if (b === podium || b.h < 15 || area(b.pts) > 6000) return;
    const [x, z] = centroid(b.pts);
    if (x <= -215 || x >= 40 || z <= 1805 || z >= 2060) return;
    heroOwned.add(b);
    const ring = clean(b.pts), a = area(ring), seed = hash(i * 13 + 5) * 40;
    if (b.h >= 60 && a > 2000) {
      wing(out, parts, b, Math.min(11.4, podium.h), z < 1900);
    } else if ((ring.length >= 12 && a < 270) || a < 40) {
      rounds.push({ x, z, r: Math.max(1.9, Math.min(7.6, Math.sqrt(a / Math.PI))), h: b.h });
    } else {
      const canopy = a > 150 && a < 200 && b.h > 38 && ring.length === 4 && (z < 1875 || z > 1975);
      const top = canopy ? b.h - 7.3 : b.h;
      parts.keeps.walls(ring, Math.min(9.7, podium.h), top, WHITE, [top, seed, 1, Math.min(9.7, podium.h)]);
      if (canopy) {
        const peak = ring.map(([px, pz]) => [x + (px - x) * 0.075, z + (pz - z) * 0.075]);
        parts.red.skirt(offset(ring, 0.32), top, peak, b.h + 2.4);
      } else {
        parts.parapet.prism(offset(ring, 0.23), top - 0.72, top + 0.15);
        parts.parapet.battlements(ring, top, WHITE, [top + 1.5, seed, 0, 0], {
          pitch: 2.8, w: 1.45, h: 1.24, t: 0.7, rail: 0.65,
        });
      }
    }
  });
  for (const t of rounds) {
    const spec = CONES.find(([x, z]) => Math.hypot(t.x - x, t.z - z) < 3.6);
    const capped = rounds.some(o => o.h > t.h && Math.hypot(o.x - t.x, o.z - t.z) < 4);
    const roof = capped ? null : kit.roofs[spec?.[2] ?? 'red'];
    const top = spec?.[3] ?? t.h;
    const base = t.h >= 28 ? Math.min(10, podium.h) : 0;
    turret(deco, kit, t.x, t.z, t.r, base, top, roof, { tall: (spec?.[4] ?? t.r * 2.65) / t.r });
  }
  const gateA = rounds.find(t => Math.hypot(t.x + 22, t.z - 1844) < 4);
  const gateB = rounds.find(t => Math.hypot(t.x - 2, t.z - 1868) < 4);
  if (gateA && gateB) pointedGate(out, parts, gateA, gateB);
  streetGate(parts, deco, data, kit);

  for (const a of data.areas) {
    if (a.k !== 'water') continue;
    const [x, z] = centroid(a.pts);
    if (x > -283 && x < -185 && z > 1850 && z < 1970) parts.pools.cap(clean(a.pts), 0.35);
  }
  const stone = facade(MODE.stone, { color: '#e9dfcd', roof: '#c8bdab', flood: '#fff1d6', floodK: 0.62, self: 0.07 });
  for (const [soup, material, name] of [
    [parts.hotel, facade(MODE.stucco, { color: '#eee8dc', flood: '#fff0dd', floodK: 0.85, self: 0.075 }), 'Excalibur hotel wings'],
    [parts.parapet, stone, 'Excalibur stone corners and crenellations'],
    [parts.keeps, facade(MODE.arcade, { color: '#eadfcc', glass: '#554d48', flood: '#ffeccc', floodK: 0.86, bay: 5.9, pilasterW: 0.63, rate: 0.05 }), 'Excalibur pointed window bays'],
    [parts.blue, kit.roofs.blue, 'Excalibur blue hipped roofs'],
    [parts.red, kit.roofs.red, 'Excalibur red pavilion roofs'],
    [parts.pools, makeWaterMaterial('#64c1d3', '#2c779a', '#a0dae7'), 'Excalibur pool courtyards'],
  ]) {
    const mesh = soup.mesh(material, name);
    if (mesh) out.add(mesh);
  }
  out.add(bakeStatic(deco));
  out.add(spill(-22, 0.43, 1855, 107, '#fff0c9', 0.22), spill(-126, 0.43, 1982, 91, '#ffdcaa', 0.19));
  return out;
}
