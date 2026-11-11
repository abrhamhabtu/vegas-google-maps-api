/**
 * Hand-built models for the Flamingo Road corner ("Four Corners"): Bellagio, Caesars Palace,
 * Paris Las Vegas, its Eiffel Tower and Flamingo. Built with docs/landmark-rebuild-playbook.md against
 * Apple Maps night references. Towers are claimed in heroOwned; podiums stay with the city pipeline.
 */
import { hash } from '../landmarks/vendor/map/geom.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { halo, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { MODE, SERIF, Soup, WHITE, centroid, clean, facade, inset, keep, obb, offset, sign, spill } from './hero-kit.js';

const THREE = window.THREE;
const SCRIPT = '"Snell Roundhand", "Brush Script MT", Georgia, cursive';
const mesh = (geometry, material, x, y, z, ry = 0) => {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
};
const near = (b, x, z, r) => { const c = centroid(b.pts); return Math.hypot(c[0] - x, c[1] - z) < r; };

// ─────────────────────────────── polyline slicing ───────────────────────────────
function measure(line) {
  const s = [0];
  for (let i = 1; i < line.length; i++) s.push(s[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  return s;
}
function pointAt(line, s, t) {
  const L = s[s.length - 1] * t;
  for (let i = 1; i < line.length; i++) {
    if (s[i] >= L) {
      const k = (L - s[i - 1]) / ((s[i] - s[i - 1]) || 1);
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * k, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * k];
    }
  }
  return line[line.length - 1];
}
/** The stretch of a polyline between fractions t0 and t1 of its length, keeping interior vertices. */
function cut(line, t0, t1) {
  const s = measure(line), total = s[s.length - 1], out = [pointAt(line, s, t0)];
  for (let i = 1; i < line.length - 1; i++) if (s[i] > total * t0 + 0.3 && s[i] < total * t1 - 0.3) out.push(line[i]);
  out.push(pointAt(line, s, t1));
  return out;
}

function cornice(soup, ring, y, projection = 0.52, height = 0.7) {
  const rim = offset(ring, projection);
  soup.walls(rim, y - height, y, WHITE, [y, 0, 0, y - height]);
  soup.skirt(rim, y, ring, y);
}

// Each entry is the height and arch treatment of an architectural order.
function arcadeStack(walls, trim, ring, base, tiers, seed, projection) {
  for (const [top, arch] of tiers) {
    if (top <= base) continue;
    walls.walls(ring, base, top, WHITE, [top, seed, arch ? 1 : 0, base]);
    cornice(trim, ring, top, projection);
    base = top;
  }
}

function roofProfile(soup, ring, eave, rise, setback) {
  const inner = inset(ring, setback);
  if (!inner) {
    soup.cap(ring, eave);
    return;
  }
  soup.skirt(ring, eave, inner, eave + rise);
  soup.cap(inner, eave + rise);
}

function ellipse(x, z, rx, rz, n = 36) {
  return Array.from({ length: n }, (_, i) => {
    const a = i * Math.PI * 2 / n;
    return [x + rx * Math.cos(a), z + rz * Math.sin(a)];
  });
}

// ─────────────────────────────────── Bellagio ───────────────────────────────────
// The OSM outline of "Bellagio Las Vegas" is the hotel's Y plan: two wings bowing out toward the
// lake and one running west, meeting at a hub with the rotunda bay on its lake face. Each wing is
// given as its two long edges, hub first, in the outline's own coordinates.
const WINGS = [
  [[[-187, 334], [-175, 280], [-165, 257], [-153, 230]], [[-160, 338], [-150, 289], [-141, 268], [-129, 241]]],
  [[[-187, 361], [-175, 417], [-165, 440], [-153, 466]], [[-161, 358], [-150, 407], [-144, 421], [-141, 429], [-129, 455]]],
  [[[-187, 334], [-268, 335], [-289, 335]], [[-187, 361], [-268, 362], [-290, 362]]],
];
// Apple's Bellagio: the wings run at full height, split into three tall tiers by lit cornice bands,
// with arched bays in each tier. Only the last stretch of each wing drops a little as an end pavilion.
const TIP = 0.86;
const ROTUNDA = [-162.5, 348, 10.5];

function buildBellagio(data) {
  const main = data.buildings.find(b => /^bellagio las vegas$/i.test(b.name ?? ''));
  if (!main) return null;
  const out = new THREE.Group();
  out.name = 'Bellagio';
  for (const b of data.buildings) if (b.part && b.h > 100 && (near(b, ROTUNDA[0], ROTUNDA[1], 8) || near(b, -253, 588, 10))) heroOwned.add(b);

  const walls = new Soup(), roofs = new Soup(), rail = new Soup(), pavilions = new Soup();
  const tower = (ring, h, seed) => {
    arcadeStack(walls, rail, ring, 0, [[30, false], [h - 25, false], [h, true]], seed, 0.63);
    roofProfile(roofs, ring, h + 0.05, 2.2, 2.2);
  };
  WINGS.forEach(([L, R], w) => {
    const seed = hash(w * 31 + 7) * 40;
    const body = clean([...cut(L, 0, TIP), ...cut(R, 0, TIP).reverse()]);
    const tip = clean([...cut(L, TIP, 1), ...cut(R, TIP, 1).reverse()]);
    tower(body, 116, seed);
    tower(tip, 102, seed + 3);
  });
  // The central bay reads as part of the wings and ends in a low cupola.
  const hub = clean([[-187, 334], [-160, 338], [-161, 358], [-187, 361]]);
  tower(hub, 118, 5);
  const [rx, rz, rr] = ROTUNDA;
  const drum = ellipse(rx, rz, rr, rr);
  tower(drum, 119, 9);
  const tholos = ellipse(rx, rz, 6.4, 6.4);
  arcadeStack(pavilions, rail, tholos, 119, [[127, true]], 3, 0.33);

  // the Spa Tower: one plain slab in the same three-tier dress
  const spa = data.buildings.find(b => /^bellagio spa tower$/i.test(b.name ?? ''));
  if (spa) tower(clean(spa.pts), 120, 13);

  // The independent restaurant bays follow the surveyed lakeshore outlines.
  for (const b of data.buildings) {
    const [x, z] = centroid(b.pts);
    if (b.name || b.part || b.b === 'roof' || b.h !== 18.8 || x < -86 || x > -51 || z < 279 || z > 391) continue;
    heroOwned.add(b);
    const ring = clean(b.pts);
    arcadeStack(pavilions, rail, ring, 0, [[6.1, true], [b.h, true]], hash(x) * 30, 0.36);
    roofProfile(roofs, ring, b.h + 0.05, 1.6, 1.55);
  }

  const stone = facade(MODE.arcade, { color: '#e8d9c8', glass: '#426083', flood: '#ffe0c6', floodK: 0.92, bay: 8.0, pilasterW: 0.43, rate: 0.015 });
  const blue = sheen('#526d9c', { refl: 0.12, spec: 0.45, glow: '#5376b1', glowK: 0.27, baseGlow: 0.04 });
  const balustrade = facade(MODE.stone, { color: '#e9e1d7', roof: '#9faec5', flood: '#ffe8d4', floodK: 0.78, self: 0.13 });
  const shore = facade(MODE.arcade, { color: '#ded5c5', glass: '#516b81', flood: '#ffdfb8', floodK: 0.75, bay: 4.9, pilasterW: 0.35, rate: 0.14 });
  for (const m of [walls.mesh(stone, 'Bellagio giant-order arcades'), roofs.mesh(blue, 'Bellagio slate roofs'),
    rail.mesh(balustrade, 'Bellagio layered cornices'), pavilions.mesh(shore, 'Bellagio lakeside pavilions')]) if (m) out.add(m);
  const conservatory = buildConservatory(data);
  if (conservatory) out.add(conservatory);

  // copper-blue dome, lantern and finial over the rotunda
  const deco = new THREE.Group();
  const gold = sheen('#d9b766', { refl: 0.4, spec: 1.2, glow: '#ffe09a', glowK: 1.0, baseGlow: 0.1 });
  deco.add(mesh(new THREE.SphereGeometry(6.55, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.68, 1), blue, rx, 127, rz));
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    deco.add(mesh(new THREE.BoxGeometry(0.52, 5.5, 0.63), balustrade, rx + Math.cos(a) * 6.43, 123.9, rz + Math.sin(a) * 6.43, -a));
  }
  deco.add(mesh(new THREE.CylinderGeometry(1.35, 1.6, 2.6, 12), balustrade, rx, 132.4, rz));
  deco.add(mesh(new THREE.ConeGeometry(1.7, 2.0, 12), blue, rx, 134.7, rz));
  deco.add(mesh(new THREE.CylinderGeometry(0.1, 0.24, 2.4, 6), gold, rx, 136.5, rz));
  // urns along the hub parapet
  for (let k = 0; k < 4; k++) deco.add(mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 8), balustrade, -185 + k * 7.5, 119.8, 336));
  out.add(bakeStatic(deco, keep));
  out.add(sign('BELLAGIO', 13.4, 2.8, rx + rr + 0.6, 115.5, rz, 1, 0, { font: `500 110px ${SERIF}`, color: '#fff2d8' }));

  out.add(spill(-190, 0.45, 350, 260, '#ffd9a8', 0.26));
  const wash = halo(220, '#ffe0b0', 0.12);
  wash.position.set(-175, 70, 348);
  out.add(wash);
  const crown = halo(28, '#fff0cc', 0.15);
  crown.position.set(rx, 125, rz);
  out.add(crown);
  return out;
}

function buildConservatory(data) {
  const b = data.buildings.find(b => /^bellagio conservatory/i.test(b.name ?? ''));
  if (!b) return null;
  const ring = clean(b.pts);
  const walls = new Soup(), roof = new Soup(), trim = new Soup();
  const eave = b.h - 4.2;
  arcadeStack(walls, trim, ring, b.mh ?? 0, [[eave, true]], 5, 0.34);
  roofProfile(roof, ring, eave, 4.15, 2.25);
  const { cx, cz, w, d, ax, az } = obb(ring);
  for (let s = -w * 0.35; s < w * 0.38; s += 4.3) {
    trim.box(cx + ax * s, b.h - 0.17, cz + az * s, d * 0.76, 0.28, 0.24, -az, ax);
  }
  const group = new THREE.Group();
  group.name = 'Bellagio Conservatory';
  const cream = facade(MODE.arcade, { color: '#ded3c2', glass: '#497580', flood: '#ffdbba', floodK: 0.69, bay: 4.3, pilasterW: 0.3, rate: 0.2 });
  const glass = sheen('#749ca6', { refl: 0.39, spec: 0.64, glow: '#71a9b6', glowK: 0.43 });
  const frame = facade(MODE.stone, { color: '#c4c2ab', roof: '#bbc1b5', floodK: 0.44 });
  group.add(walls.mesh(cream, 'Conservatory arcade'), roof.mesh(glass, 'Conservatory glass'), trim.mesh(frame, 'Conservatory roof ribs'));
  heroOwned.add(b);
  return group;
}

// ──────────────────────────────── Caesars Palace ────────────────────────────────
const CAESARS = [
  [/^palace tower$/i, 'gable'],
  [/^augustus tower$/i, 'gable'],
  [/^octavius tower$/i, 'gable'],
  [/^forum tower$/i, 'gable'],
  [/^julius tower$/i, 'flat'],
  [/^julius tower extension$/i, 'flat'],
  [/^nobu hotel at caesars palace$/i, 'gable'],
];
function buildCaesars(data) {
  const out = new THREE.Group();
  out.name = 'Caesars Palace';
  const walls = new Soup(), roofs = new Soup(), flats = new Soup(), ends = new Soup(), rail = new Soup();
  const signs = [], theatre = new Soup(), theatreRoof = new Soup();
  CAESARS.forEach(([re, roof], i) => {
    const b = data.buildings.find(x => re.test(x.name ?? '') && !x.part);
    if (!b) return;
    heroOwned.add(b);
    const ring = clean(b.pts), h = b.h, seed = hash(i * 23 + 11) * 40;
    const plinth = Math.min(17, h * 0.23);
    arcadeStack(walls, rail, ring, 0, [
      [plinth, true], [plinth + 5.1, false], [h - 11, false], [h - 8.3, false], [h, true],
    ], seed, 0.74);
    cornice(rail, ring, h + 0.8, 0.34, 0.8);
    flats.cap(ring, h + 0.05);
    if (roof === 'gable') {
      // The long roof has two pedimented wings and a raised center terrace.
      const r = obb(ring), shrink = Math.min(4.5, r.d * 0.14);
      const g = { ...r, w: r.w - shrink * 2, d: r.d - shrink * 2 };
      if (g.w > 76) {
        const endWidth = g.w * 0.23, move = (g.w - endWidth) / 2;
        for (const side of [-1, 1]) {
          const end = { ...g, cx: g.cx + side * move * g.ax, cz: g.cz + side * move * g.az, w: endWidth };
          roofs.gable(end, h + 1.15, Math.min(5.5, end.d * 0.22), WHITE, [h + 7, seed, 0, 0], ends, [h + 7, seed, 0, h]);
        }
        const mid = { ...g, w: g.w - endWidth * 2, d: g.d * 0.83 };
        rail.box(mid.cx, h, mid.cz, mid.w, 2.3, mid.d, mid.ax, mid.az);
        roofs.gable(mid, h + 2.3, Math.min(4.7, mid.d * 0.2), WHITE, [h + 7, seed, 0, 0], ends, [h + 7, seed, 0, h]);
        signs.push({ r, h });
      } else {
        roofs.gable(g, h + 0.9, Math.min(4.7, g.d * 0.21), WHITE, [h + 7, seed, 0, 0], ends, [h + 7, seed, 0, h]);
      }
    }
  });
  if (!walls.idx.length) return null;
  const campus = data.buildings.find(b => /^caesars palace hotel and casino$/i.test(b.name ?? ''));
  // The theatre's curved exterior is part of the mapped casino perimeter.
  const first = campus?.pts.findIndex(([x, z]) => Math.hypot(x + 15.4, z + 150) < 1);
  if (first >= 0) {
    const shell = clean([...campus.pts.slice(first), campus.pts[0]]);
    const y = campus.h;
    arcadeStack(theatre, rail, shell, y - 0.15, [[y + 5, true], [y + 12, true], [y + 19, false]], 21, 0.45);
    roofProfile(theatreRoof, shell, y + 19.05, 1.65, 2.9);
    const [x, z] = centroid(shell);
    out.add(sign('THE COLOSSEUM', 18.4, 2.8, 7.1, y + 15.3, -184, 1, 0,
      { font: `600 100px ${SERIF}`, color: '#fff0cb' }));
    out.add(spill(x + 24, 0.45, z, 57, '#ffe7b4', 0.22));
  }
  const marble = facade(MODE.arcade, { color: '#f2e6d8', glass: '#3c5275', flood: '#ffe3bc', floodK: 1.19, bay: 4.9, pilasterW: 0.34, rate: 0.025 });
  const pediment = facade(MODE.stone, { color: '#f0e7d8', roof: '#acb6c3', flood: '#fff0d6', floodK: 0.77, self: 0.12 });
  const terracotta = sheen('#a9807e', { refl: 0.12, spec: 0.36, glow: '#be9694', glowK: 0.23, baseGlow: 0.05 });
  const leads = facade(MODE.stone, { color: '#a1a7b1', roof: '#788297' });
  const edging = facade(MODE.stone, { color: '#f4eadd', roof: '#aeb6c3', flood: '#fff1d6', floodK: 0.91, self: 0.13 });
  const arenaStone = facade(MODE.arcade, { color: '#e9dcca', glass: '#415776', flood: '#ffdfbd', floodK: 0.98, bay: 5.5, pilasterW: 0.43, rate: 0.06 });
  for (const m of [walls.mesh(marble, 'Caesars towers'), roofs.mesh(terracotta, 'Caesars roofs'), ends.mesh(pediment, 'Caesars pediments'),
    flats.mesh(leads, 'Caesars flat roofs'), rail.mesh(edging, 'Caesars cornices'), theatre.mesh(arenaStone, 'Colosseum arcade'),
    theatreRoof.mesh(leads, 'Colosseum roof')]) if (m) out.add(m);

  // wordmarks on the long faces of the two biggest towers, facing the Strip side
  const style = { font: `500 110px ${SERIF}`, color: '#fff4dc', background: '#3a2f2a' };
  for (const { r, h } of signs.slice(0, 2)) {
    const nx = -r.az, nz = r.ax, toward = nx * 0.8 + nz * 0.6 > 0 ? 1 : -1; // the long face toward the Strip and Bellagio
    const x = r.cx + nx * toward * (r.d / 2 + 0.7), z = r.cz + nz * toward * (r.d / 2 + 0.7);
    out.add(sign('CAESARS PALACE', Math.min(46, r.w * 0.45), 4.4, x, h - 5.5, z, nx * toward, nz * toward, style));
  }
  out.add(spill(-150, 0.45, 20, 260, '#fff0d4', 0.24));
  const wash = halo(260, '#fff2da', 0.1);
  wash.position.set(-150, 60, 30);
  out.add(wash);
  const pools = buildCaesarsPools(data);
  if (pools) out.add(pools);
  return out;
}

function buildCaesarsPools(data) {
  const water = new Soup(), coping = new Soup();
  const poolNames = /^(venus|temple|neptune|apollo|bacchus|fortuna|jupiter) pool$/i;
  let temple;
  for (const body of data.areas) {
    if (body.k !== 'water' || !poolNames.test(body.name ?? '')) continue;
    const c = centroid(body.pts);
    if (c[0] < -350 || c[0] > -165 || c[1] < -100 || c[1] > 80) continue;
    const ring = clean(body.pts);
    water.cap(ring, 0.24);
    cornice(coping, ring, 0.36, 0.62, 0.28);
    if (body.name === 'Temple Pool') temple = c;
  }
  if (!water.idx.length) return null;
  const group = new THREE.Group();
  group.name = 'Caesars pool court';
  const stone = facade(MODE.stone, { color: '#d7cbba', roof: '#d7cbba', flood: '#ffe6b9', floodK: 0.66 });
  const blue = sheen('#3b7ca7', { refl: 0.17, spec: 0.52, glow: '#315fa7', glowK: 0.37 });
  group.add(water.mesh(blue, 'Caesars pools'), coping.mesh(stone, 'Pool coping'));
  if (temple) {
    const [x, z] = temple;
    const cap = new Soup(), columns = new Soup(), r = 5;
    cap.prism(ellipse(x, z, r, r, 24), 0, 0.74);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      columns.prism(ellipse(x + 3.85 * Math.cos(a), z + 3.85 * Math.sin(a), 0.44, 0.44, 8), 0.74, 7.55);
    }
    cap.prism(ellipse(x, z, r, r, 24), 7.45, 8.2);
    group.add(cap.mesh(stone, 'Temple pool pavilion'), columns.mesh(stone, 'Pavilion columns'),
      mesh(new THREE.SphereGeometry(4.65, 22, 10, 0, 2 * Math.PI, 0, Math.PI / 2).scale(1, 0.57, 1), blue, x, 8.2, z));
  }
  return group;
}

// ─────────────────────────────────── Paris ───────────────────────────────────
function buildParis(data) {
  const b = data.buildings.find(x => /^le boulevard at paris$/i.test(x.name ?? ''));
  if (!b) return null;
  heroOwned.add(b);
  const out = new THREE.Group();
  out.name = 'Paris Las Vegas';
  const ring = clean(b.pts), h = b.h, c = centroid(ring);
  const walls = new Soup(), slate = new Soup(), rail = new Soup();
  arcadeStack(walls, rail, ring, 0, [[34, false], [h - 12, false], [h, true]], 17, 0.62);
  cornice(rail, ring, h + 1.2, 0.38, 1.1);
  roofProfile(slate, ring, h + 1.2, 6.8, 2.75);

  const deco = new THREE.Group();
  const blue = sheen('#486593', { refl: 0.13, spec: 0.45, glow: '#4d75b8', glowK: 0.3, baseGlow: 0.04 });
  const gold = sheen('#dcb764', { refl: 0.45, spec: 1.3, glow: '#ffe19a', glowK: 1.05, baseGlow: 0.1 });
  const dormerLit = sheen('#31425b', { glow: '#b9c5da', glowK: 0.24, baseGlow: 0.02 });
  // dormers march along every mansard edge
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n = Math.floor(L / 6.4), ax = (q[0] - p[0]) / L, az = (q[1] - p[1]) / L;
    for (let k = 0; k < n; k++) {
      const s = (k + 0.5) * L / n, x = p[0] + ax * s - az * 0.35, z = p[1] + az * s + ax * 0.35;
      const rot = -Math.atan2(az, ax);
      deco.add(mesh(new THREE.BoxGeometry(1.65, 2.35, 1.4), dormerLit, x, h + 3.0, z, rot));
      deco.add(mesh(new THREE.ConeGeometry(1.18, 0.96, 4).rotateY(Math.PI / 4), blue, x, h + 4.5, z, rot));
    }
  }
  // pavilions: one at the tip of each wing and one over the crossing, each under a steep slate roof
  const pav = (x, z, w, d, ang, y0, y1, rise) => {
    const px = -Math.sin(ang), pz = Math.cos(ang), ax = Math.cos(ang), az = Math.sin(ang);
    const r = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([s, t]) => [x + ax * s + px * t, z + az * s + pz * t]);
    const cr = clean(r);
    arcadeStack(walls, rail, offset(cr, 0.38), y0, [[y1, true]], hash(x) * 40, 0.44);
    cornice(rail, cr, y1 + 0.85, 0.48, 0.85);
    roofProfile(slate, cr, y1 + 0.85, rise, Math.min(w, d) * 0.21);
    deco.add(mesh(new THREE.CylinderGeometry(0.09, 0.19, 2.4, 6), gold, x, y1 + 0.85 + rise + 1.1, z));
  };
  const tips = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], dist = Math.hypot(m[0] - c[0], m[1] - c[1]);
    if (dist > 45 && L > 14 && L < 26) tips.push({ m, L, ang: Math.atan2(q[1] - p[1], q[0] - p[0]) });
  }
  for (const t of tips) {
    const dx = c[0] - t.m[0], dz = c[1] - t.m[1], D = Math.hypot(dx, dz);
    const x = t.m[0] + dx / D * 8, z = t.m[1] + dz / D * 8;
    pav(x, z, t.L + 0.6, 18, t.ang, h - 11, h + 8, 8.2);
  }
  if (tips.length) {
    const ang = tips[0].ang;
    pav(c[0], c[1], 25, 25, ang, h - 8, h + 8.6, 10.0);
    // the wordmark on the wing tip that faces the Strip and the Bellagio fountains
    const west = tips.slice().sort((p, q) => p.m[0] - q.m[0])[0];
    const dx = west.m[0] - c[0], dz = west.m[1] - c[1], D = Math.hypot(dx, dz);
    out.add(sign('PARIS', 14, 4.6, west.m[0] + dx / D * 1.2, h - 3.5, west.m[1] + dz / D * 1.2, dx / D, dz / D,
      { font: `600 120px ${SERIF}`, color: '#ffe9b6', background: '#2a2c3a' }));
  }
  const stone = facade(MODE.arcade, { color: '#e9dace', glass: '#3e5476', flood: '#ffddc3', floodK: 1.12, bay: 4.9, pilasterW: 0.37, rate: 0.022 });
  const trim = facade(MODE.stone, { color: '#eee2d4', flood: '#ffe8ca', floodK: 0.86, self: 0.13 });
  for (const m of [walls.mesh(stone, 'Paris facade'), slate.mesh(blue, 'Paris mansard'), rail.mesh(trim, 'Paris cornices')]) if (m) out.add(m);
  out.add(bakeStatic(deco, keep));
  out.add(spill(c[0], 0.45, c[1], 200, '#ffd9a2', 0.26));
  const wash = halo(200, '#ffdcaa', 0.1);
  wash.position.set(c[0], 60, c[1]);
  out.add(wash);
  const arc = buildParisArc(data);
  if (arc) out.add(arc);
  return out;
}

function buildParisArc(data) {
  const crown = data.buildings.find(b => /^arc de triomphe$/i.test(b.name ?? ''));
  if (!crown) return null;
  const [cx, cz] = centroid(crown.pts);
  const piers = data.buildings.filter(b => b !== crown && !b.name && b.h === crown.h && near(b, cx, cz, 15));
  if (piers.length !== 2) return null;
  const { ax, az, w, d } = obb([...crown.pts, ...piers.flatMap(b => b.pts)]);
  const h = crown.h, opening = obb(crown.pts).d / 2 - 0.6;
  const spring = crown.mh - opening;
  const arch = new THREE.Shape();
  arch.moveTo(-w / 2, 0);
  arch.lineTo(-w / 2, h - 4.2);
  arch.lineTo(w / 2, h - 4.2);
  arch.lineTo(w / 2, 0);
  arch.lineTo(opening, 0);
  arch.lineTo(opening, spring);
  arch.absarc(0, spring, opening, 0, Math.PI, false);
  arch.lineTo(-opening, 0);
  arch.closePath();
  const group = new THREE.Group();
  group.name = 'Paris Arc de Triomphe';
  group.position.set(cx, 0, cz);
  group.rotation.y = -Math.atan2(az, ax);
  const stone = sheen('#e1d2ba', { glow: '#ffe5bc', glowK: 0.38 });
  const trim = sheen('#e9dec9', { glow: '#fff0cf', glowK: 0.61 });
  const dark = sheen('#a79077', { glow: '#ffce9d', glowK: 0.24 });
  const archBody = new THREE.ExtrudeGeometry(arch, { depth: d, bevelEnabled: false, curveSegments: 18 });
  group.add(mesh(archBody, stone, 0, 0, -d / 2));
  for (const [y, width, height, depth] of [
    [h - 4.0, w + 1.25, 0.95, d + 0.95], [h - 2.1, w - 0.35, 3.5, d - 0.3], [h, w + 0.75, 0.8, d + 0.72],
  ]) group.add(mesh(new THREE.BoxGeometry(width, height, depth), trim, 0, y, 0));
  for (const side of [-1, 1]) {
    const halfPier = (w / 2 + opening) / 2;
    const curve = new THREE.EllipseCurve(0, spring, opening + 0.44, opening + 0.44, 0, Math.PI);
    const rim = curve.getPoints(22).map(p => new THREE.Vector3(p.x, p.y, side * (d / 2 + 0.07)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim), 24, 0.39, 5), trim));
    for (const x of [-halfPier, halfPier]) {
      group.add(mesh(new THREE.BoxGeometry(3.8, 6.4, 0.45), dark, x, 7.7, side * d / 2));
      group.add(mesh(new THREE.BoxGeometry(3.0, 5.5, 0.46), trim, x, 7.7, side * (d / 2 + 0.22)));
    }
  }
  for (const b of [crown, ...piers]) heroOwned.add(b);
  return bakeStatic(group, keep);
}

// ───────────────────────────────── Eiffel Tower ─────────────────────────────────
// The truss uses solid, slender members so its openings stay readable during a camera move.
function buildEiffel(data) {
  const f = data.buildings.find(b => /^eiffel tower$/i.test(b.name ?? ''));
  if (!f) return null;
  const r = obb(clean(f.pts)), H = f.h;
  const B = Math.max(24, Math.min(30, r.d / 2));
  const yTop = H * 0.9, y1 = H * 0.19, y2 = H * 0.38;
  const hwO = y => 1.5 + (B - 1.5) * Math.pow(Math.max(0, 1 - y / yTop), 2.3);
  const hwI = y => y >= y2 ? 0 : B * 0.58 * Math.pow(1 - y / y2, 1.3);
  const grp = new THREE.Group();
  grp.name = 'Eiffel Tower';
  const deco = new THREE.Group();
  const iron = sheen('#a5937c', { refl: 0.12, spec: 0.54, glow: '#ffe9cc', glowK: 0.84, baseGlow: 0.045 });
  const deck = sheen('#9d8b76', { refl: 0.15, spec: 0.48, glow: '#ffd7a3', glowK: 0.48, baseGlow: 0.04 });
  const lamp = sheen('#eee0cb', { glow: '#ffefd4', glowK: 0.96, baseGlow: 0.13 });
  const member = new THREE.BoxGeometry(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  function beam(a, b, width, material) {
    const delta = b.clone().sub(a), length = delta.length();
    if (length < 0.04) return;
    const part = new THREE.Mesh(member, material);
    part.position.copy(a).lerp(b, 0.5);
    part.quaternion.setFromUnitVectors(up, delta.divideScalar(length));
    part.scale.set(width, length, width);
    deco.add(part);
  }
  function frame(ringAt, bottom, top, count, width) {
    let prev = ringAt(bottom);
    for (let level = 1; level <= count; level++) {
      const next = ringAt(bottom + (top - bottom) * level / count);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        beam(prev[i], next[i], width * 1.9, iron);
        beam(prev[i], next[j], width, iron);
        beam(prev[j], next[i], width, iron);
        beam(next[i], next[j], width * 1.22, deck);
      }
      prev = next;
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = y => {
      const a = hwI(y), b = hwO(y);
      return [[a, a], [b, a], [b, b], [a, b]].map(([x, z]) => new THREE.Vector3(sx * x, y, sz * z));
    };
    frame(leg, 0, y1, 5, 0.46);
    frame(leg, y1, y2, 5, 0.39);
  }
  const shaft = y => {
    const w = hwO(y);
    return [[-w, -w], [w, -w], [w, w], [-w, w]].map(([x, z]) => new THREE.Vector3(x, y, z));
  };
  frame(shaft, y2, yTop, 13, 0.33);
  // The first deck stays open in the middle, like the real lattice below it.
  const w1 = hwO(y1) + 1.6;
  for (const [x, z, bw, bd] of [[0, w1 - 2.6, w1 * 2, 5.2], [0, -w1 + 2.6, w1 * 2, 5.2], [w1 - 2.6, 0, 5.2, w1 * 2 - 10.4], [-w1 + 2.6, 0, 5.2, w1 * 2 - 10.4]]) {
    deco.add(mesh(new THREE.BoxGeometry(bw, 3.6, bd), deck, x, y1, z));
    deco.add(mesh(new THREE.BoxGeometry(bw + 0.4, 0.5, bd + 0.4), lamp, x, y1 + 2.0, z));
  }
  const w2 = hwO(y2) + 1.2;
  deco.add(mesh(new THREE.BoxGeometry(w2 * 2, 3, w2 * 2), deck, 0, y2, 0));
  deco.add(mesh(new THREE.BoxGeometry(w2 * 2 + 0.4, 0.5, w2 * 2 + 0.4), lamp, 0, y2 + 1.7, 0));
  deco.add(mesh(new THREE.BoxGeometry(6.4, 5, 6.4), deck, 0, H * 0.86, 0));
  deco.add(mesh(new THREE.BoxGeometry(7, 0.5, 7), lamp, 0, H * 0.86 + 2.7, 0));
  deco.add(mesh(new THREE.CylinderGeometry(0.35, 1.3, H - yTop + 4, 8), deck, 0, yTop + (H - yTop) / 2, 0));
  const beacon = new THREE.MeshBasicMaterial({ color: '#fff4d0', fog: true });
  deco.add(mesh(new THREE.SphereGeometry(1.2, 10, 8), beacon, 0, H + 2.2, 0));
  // arches between the legs under the first platform
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const th = k / 16 * Math.PI, y = 5 + (y1 - 9) * Math.sin(th), s = -Math.cos(th) * hwI(5) * 0.98;
      const t = (hwI(y) + hwO(y)) / 2 * 0.98;
      pts.push(ax ? new THREE.Vector3(ax * t, y, s) : new THREE.Vector3(s, y, az * t));
    }
    deco.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.75, 6), deck));
  }
  grp.add(bakeStatic(deco, keep));
  member.dispose();
  grp.position.set(r.cx, 0, r.cz);
  grp.rotation.y = -Math.atan2(r.az, r.ax);
  const out = new THREE.Group();
  out.name = 'Eiffel Tower';
  out.add(grp);
  out.add(spill(r.cx, 0.45, r.cz, 110, '#ffcf7a', 0.3));
  const glowMid = halo(105, '#ffe7bf', 0.09);
  glowMid.position.set(r.cx, 60, r.cz);
  out.add(glowMid);
  const tip = halo(14, '#fff2c8', 0.8);
  tip.position.set(r.cx, H + 2.2, r.cz);
  out.add(tip);
  return out;
}

function buildFlamingo(data) {
  const campus = data.buildings.find(b => /^flamingo las vegas$/i.test(b.name ?? ''));
  if (!campus) return null;
  const targets = [[257, 18], [266, -89], [240, -41]];
  const wings = targets.map(([x, z]) => data.buildings.find(b => !b.name && b.h >= 82 && b.h <= 89 && near(b, x, z, 4)));
  if (!wings[0]) return null;
  const group = new THREE.Group();
  group.name = 'Flamingo Las Vegas';
  const walls = new Soup(), band = new Soup(), roofs = new Soup();
  for (const wing of wings.filter(Boolean)) {
    const ring = clean(wing.pts);
    walls.walls(ring, 0, wing.h, WHITE, [wing.h, 0, 0, campus.h]);
    cornice(band, ring, campus.h + 1, 0.32, 0.76);
    cornice(band, ring, wing.h + 0.38, 0.38, 2.8);
    roofs.cap(ring, wing.h + 0.36);
    heroOwned.add(wing);
  }
  const pink = facade(MODE.flamingo, { color: '#bd9fb7', glass: '#43567e', glow: '#ff75c8', floodK: 1.12, bay: 10.7 });
  const trim = facade(MODE.stone, { color: '#a3a9be', roof: '#7e92b2', flood: '#e6aed8', floodK: 0.32, self: 0.12 });
  const slate = facade(MODE.stone, { color: '#7e90b1', roof: '#7790b2', flood: '#ad94cb', roofGlow: 0.49 });
  group.add(walls.mesh(pink, 'Flamingo pink-lit fins'), band.mesh(trim, 'Flamingo parapets'), roofs.mesh(slate, 'Flamingo cool roofs'));
  const style = { font: `italic 700 126px ${SCRIPT}`, color: '#ffc5e3' };
  group.add(sign('Flamingo', 28, 4.8, 215.25, wings[0].h - 6.2, 13, -1, 0, style));
  group.add(sign('Flamingo', 30, 4.8, 290, wings[0].h - 6.2, 70.65, 0, 1, style));
  group.add(spill(220, 0.45, 50, 63, '#ec91ce', 0.22));
  return group;
}

export function buildFourCorners(data) {
  const group = new THREE.Group();
  group.name = 'Four Corners resorts';
  for (const build of [buildBellagio, buildCaesars, buildParis, buildEiffel, buildFlamingo]) {
    const model = build(data);
    if (model) group.add(model);
  }
  return group;
}
export const FOUR_CORNERS_HEIGHTS = [[-170, 348, 155]];
