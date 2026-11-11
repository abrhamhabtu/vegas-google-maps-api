/**
 * Hand-built models for the Flamingo Road corner ("Four Corners"): Bellagio, Caesars Palace,
 * Paris Las Vegas and its Eiffel Tower. Built with docs/landmark-rebuild-playbook.md against
 * Apple Maps night references. Towers are claimed in heroOwned; podiums stay with the city pipeline.
 */
import { hash } from '../landmarks/vendor/map/geom.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { halo, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { theme } from '../landmarks/vendor/core/theme.js';
import { MODE, SERIF, Soup, WHITE, area, centroid, clean, facade, inset, keep, obb, offset, sign, spill } from './hero-kit.js';

const THREE = window.THREE;
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
const BANDS = [22, 60, 98];
const TIP = 0.9;
const ROTUNDA = [-162.5, 348, 10.5];

function buildBellagio(data) {
  const main = data.buildings.find(b => /^bellagio las vegas$/i.test(b.name ?? ''));
  if (!main) return null;
  const out = new THREE.Group();
  out.name = 'Bellagio';
  for (const b of data.buildings) if (b.part && b.h > 100 && (near(b, ROTUNDA[0], ROTUNDA[1], 8) || near(b, -253, 588, 10))) heroOwned.add(b);

  const walls = new Soup(), roofs = new Soup(), rail = new Soup();
  const top = (ring, h, seed, y0 = 0) => {
    walls.walls(ring, y0, h, WHITE, [h, seed, 0, 0]);
    roofs.cap(ring, h);
    rail.walls(offset(ring, 0.25), h, h + 1.1, WHITE, [h + 1.1, seed, 0, 0]);
  };
  const bands = (ring, h) => {
    for (const y of BANDS) if (y < h - 4) rail.walls(offset(ring, 0.5), y - 0.5, y + 0.7, WHITE, [y + 0.7, 1, 0, y - 6]);
  };
  WINGS.forEach(([L, R], w) => {
    const seed = hash(w * 31 + 7) * 40;
    const body = clean([...cut(L, 0, TIP), ...cut(R, 0, TIP).reverse()]);
    const tip = offset(clean([...cut(L, TIP, 1), ...cut(R, TIP, 1).reverse()]), 0.8);
    top(body, 116, seed);
    top(tip, 106, seed + 3);
    bands(body, 116);
    bands(tip, 106);
  });
  // the hub rises a little above the wings; the rotunda bay runs full height in front of it
  const hub = clean([[-187, 334], [-160, 338], [-161, 358], [-187, 361]]);
  top(hub, 122, 5);
  bands(hub, 122);
  const [rx, rz, rr] = ROTUNDA, drum = [];
  for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; drum.push([rx + Math.cos(a) * rr, rz + Math.sin(a) * rr]); }
  top(clean(drum), 123, 9);
  bands(clean(drum), 123);
  // a short colonnaded drum above the bay carries the dome
  const tholos = clean(drum.map(([x, z]) => [rx + (x - rx) * 0.62, rz + (z - rz) * 0.62]));
  walls.walls(tholos, 123, 130, WHITE, [130, 3, 1, 123]);
  rail.walls(offset(tholos, 0.35), 129.4, 130.6, WHITE, [130.6, 3, 0, 0]);

  // the Spa Tower: one plain slab in the same three-tier dress
  const spa = data.buildings.find(b => /^bellagio spa tower$/i.test(b.name ?? ''));
  if (spa) {
    const ring = clean(spa.pts);
    top(ring, 120, 13);
    bands(ring, 120);
  }

  const stone = facade(MODE.palazzo, { color: '#ecd9bd', flood: '#ffd9a4', floodK: 1.1, self: 0.05, glow: '#fff1d2', line: 0.6, bay: 5.4, rate: 0, tier: 38, tier0: 22 });
  const blue = sheen('#3f5ea6', { refl: 0.18, spec: 0.6, glow: '#4a6fd0', glowK: 0.3, baseGlow: 0.03 });
  const balustrade = facade(MODE.stone, { color: '#f6eedd', flood: '#fff0d4', floodK: 1.3, self: 0.25 });
  for (const m of [walls.mesh(stone, 'Bellagio facade'), roofs.mesh(blue, 'Bellagio roofs'), rail.mesh(balustrade, 'Bellagio balustrades')]) if (m) out.add(m);

  // copper-blue dome, lantern and finial over the rotunda
  const deco = new THREE.Group();
  const gold = sheen('#d9b766', { refl: 0.4, spec: 1.2, glow: '#ffe09a', glowK: 1.0, baseGlow: 0.1 });
  deco.add(mesh(new THREE.SphereGeometry(rr * 0.64, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.2, 1), blue, rx, 130.6, rz));
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    deco.add(mesh(new THREE.BoxGeometry(0.6, 6.4, 0.9), balustrade, rx + Math.cos(a) * rr * 0.6, 126.4, rz + Math.sin(a) * rr * 0.6, -a));
  }
  deco.add(mesh(new THREE.CylinderGeometry(1.6, 1.8, 3.6, 12), balustrade, rx, 140.5, rz));
  deco.add(mesh(new THREE.ConeGeometry(2.0, 3.2, 12), blue, rx, 143.9, rz));
  deco.add(mesh(new THREE.CylinderGeometry(0.1, 0.3, 3, 6), gold, rx, 146.8, rz));
  // urns along the hub parapet
  for (let k = 0; k < 4; k++) deco.add(mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 8), balustrade, -185 + k * 7.5, 124.2, 336));
  out.add(bakeStatic(deco, keep));
  out.add(sign('BELLAGIO', 14, 3.2, rx + rr + 0.6, 119.5, rz, 1, 0, { font: `500 110px ${SERIF}`, color: '#fff2d8', background: '#2b2a33' }));

  out.add(spill(-190, 0.45, 350, 260, '#ffd9a8', 0.26));
  const wash = halo(220, '#ffe0b0', 0.12);
  wash.position.set(-175, 70, 348);
  out.add(wash);
  const crown = halo(46, '#fff0cc', 0.3);
  crown.position.set(rx, 140, rz);
  out.add(crown);
  return out;
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
  const signs = [];
  CAESARS.forEach(([re, roof], i) => {
    const b = data.buildings.find(x => re.test(x.name ?? '') && !x.part);
    if (!b) return;
    heroOwned.add(b);
    const ring = clean(b.pts), h = b.h, seed = hash(i * 23 + 11) * 40;
    walls.walls(ring, 0, h, WHITE, [h, seed, i > 3 ? 1 : 0, 0]);
    rail.walls(offset(ring, 0.3), h, h + 1.4, WHITE, [h + 1.4, seed, 0, 0]);
    // a lit band under the attic storey and another over the podium line
    for (const y of [h - 9, 15]) if (y > 12 && y < h - 6) rail.walls(offset(ring, 0.45), y - 0.45, y + 0.6, WHITE, [y + 0.6, seed, 0, y - 4]);
    flats.cap(ring, h + 0.05);
    if (roof === 'gable') {
      // a terracotta gable roof sitting inside the parapet, white pediments at each end
      const r = obb(ring), shrink = Math.min(4.5, r.d * 0.14);
      const g = { ...r, w: r.w - shrink * 2, d: r.d - shrink * 2 };
      roofs.gable(g, h + 1.2, Math.min(7, g.d * 0.28), WHITE, [h + 8, seed, 0, 0], ends, [h, seed, 0, 0]);
      if (r.w > 90) signs.push({ b, r, h });
    }
  });
  if (!walls.idx.length) return null;
  const marble = facade(MODE.palazzo, { color: '#f6ecda', flood: '#ffe6bf', floodK: 1.55, self: 0.07, glow: '#fff4dc', line: 1.0, bay: 3.9, rate: 0.035 });
  const pediment = facade(MODE.palazzo, { color: '#f6f1e6', flood: '#fff0d6', floodK: 0.6, self: 0.3, glow: '#fff4dc', line: 0.9 });
  const terracotta = sheen('#b65a52', { refl: 0.12, spec: 0.5, glow: '#e36b5c', glowK: 0.42, baseGlow: 0.04 });
  const leads = facade(MODE.stone, { color: '#8f7f78', roof: '#6d5250' });
  const cornice = facade(MODE.stone, { color: '#fbf6ea', flood: '#fff3dc', floodK: 1.4, self: 0.3 });
  for (const m of [walls.mesh(marble, 'Caesars towers'), roofs.mesh(terracotta, 'Caesars roofs'), ends.mesh(pediment, 'Caesars pediments'),
    flats.mesh(leads, 'Caesars flat roofs'), rail.mesh(cornice, 'Caesars cornices')]) if (m) out.add(m);

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
  return out;
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
  walls.walls(ring, 0, h, WHITE, [h, 17, 0, 0]);
  rail.walls(offset(ring, 0.3), h - 0.2, h + 1.2, WHITE, [h + 1.2, 17, 0, 0]);
  // mansard: steep slate skirt, flat leads on top
  const inner = inset(ring, 3.2);
  if (inner) { slate.skirt(ring, h + 1.2, inner, h + 8.5); slate.cap(inner, h + 8.5); } else slate.cap(ring, h + 1.2);

  const deco = new THREE.Group();
  const blue = sheen('#4a69b4', { refl: 0.2, spec: 0.7, glow: '#5a7fe0', glowK: 0.36, baseGlow: 0.03 });
  const gold = sheen('#dcb764', { refl: 0.45, spec: 1.3, glow: '#ffe19a', glowK: 1.05, baseGlow: 0.1 });
  const dormerLit = sheen('#2c3442', { glow: '#ffd796', glowK: 1.2, baseGlow: 0.02 });
  // dormers march along every mansard edge
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n = Math.floor(L / 4.6), ax = (q[0] - p[0]) / L, az = (q[1] - p[1]) / L;
    for (let k = 0; k < n; k++) {
      const s = (k + 0.5) * L / n, x = p[0] + ax * s + az * 1.1, z = p[1] + az * s - ax * 1.1;
      deco.add(mesh(new THREE.BoxGeometry(1.5, 2.2, 1.2), dormerLit, x, h + 3.6, z, -Math.atan2(az, ax)));
    }
  }
  // pavilions: one at the tip of each wing and one over the crossing, each under a steep slate roof
  const pav = (x, z, w, d, ang, y0, y1, rise) => {
    const px = -Math.sin(ang), pz = Math.cos(ang), ax = Math.cos(ang), az = Math.sin(ang);
    const r = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([s, t]) => [x + ax * s + px * t, z + az * s + pz * t]);
    const cr = clean(r);
    walls.walls(offset(cr, 0.4), y0, y1, WHITE, [y1, hash(x) * 40, 0, y0 - 30]);
    rail.walls(offset(cr, 0.7), y1, y1 + 1.1, WHITE, [y1 + 1.1, 3, 0, 0]);
    const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.7071 * 1.02, rise, 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d));
    deco.add(mesh(roof, blue, x, y1 + 1.1 + rise / 2, z, -ang));
    deco.add(mesh(new THREE.CylinderGeometry(0.1, 0.3, 4.5, 6), gold, x, y1 + 1.1 + rise + 2, z));
    return r;
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
    pav(x, z, t.L + 0.6, 16, t.ang, h - 14, h + 5, 13);
  }
  if (tips.length) {
    const ang = tips[0].ang;
    pav(c[0], c[1], 21, 21, ang, h - 10, h + 10, 19);
    deco.add(mesh(new THREE.CylinderGeometry(1.4, 1.8, 4, 8), gold, c[0], h + 11.1 + 19 + 1.5, c[1]));
    // the wordmark on the wing tip that faces the Strip and the Bellagio fountains
    const west = tips.slice().sort((p, q) => p.m[0] - q.m[0])[0];
    const dx = west.m[0] - c[0], dz = west.m[1] - c[1], D = Math.hypot(dx, dz);
    out.add(sign('PARIS', 14, 4.6, west.m[0] + dx / D * 1.2, h - 3.5, west.m[1] + dz / D * 1.2, dx / D, dz / D,
      { font: `600 120px ${SERIF}`, color: '#ffe9b6', background: '#2a2c3a' }));
  }
  const stone = facade(MODE.palazzo, { color: '#eee0c4', flood: '#ffdcaa', floodK: 1.05, self: 0.05, glow: '#ffeccc', line: 1.0, bay: 3.8, rate: 0.06 });
  const trim = facade(MODE.stone, { color: '#f6ecd8', flood: '#ffe8c2', floodK: 1.2, self: 0.22 });
  for (const m of [walls.mesh(stone, 'Paris facade'), slate.mesh(blue, 'Paris mansard'), rail.mesh(trim, 'Paris cornices')]) if (m) out.add(m);
  out.add(bakeStatic(deco, keep));
  out.add(spill(c[0], 0.45, c[1], 200, '#ffd9a2', 0.26));
  const wash = halo(200, '#ffdcaa', 0.1);
  wash.position.set(c[0], 60, c[1]);
  out.add(wash);
  return out;
}

// ───────────────────────────────── Eiffel Tower ─────────────────────────────────
// Half-scale tower: four splayed legs that merge at the second platform, an open lattice drawn
// procedurally (X bracing, ties, corner members) and dithered away to a lace at distance.
const LATTICE_VERT = `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec4 aux;
  varying vec3 vN; varying vec2 vUv; varying float vY, vW;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vUv = uv; vY = position.y; vW = aux.x;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const LATTICE_FRAG = `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uDay, uGlow, uSunDir, uSunTint, uAmbientTint;
  uniform float uNight, uSun, uAmbient;
  varying vec3 vN; varying vec2 vUv; varying float vY, vW;
  float bayer(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    float a = mod(q.x + q.y * 2.0, 4.0), b = mod(q.x, 2.0) * 2.0 + mod(q.y, 2.0);
    return (a * 4.0 + b + 0.5) / 16.0;
  }
  void main() {
    float P = 3.4;
    vec2 g = vec2(vUv.x / P, vY / P);
    float fw = max(fwidth(g.x), fwidth(g.y));
    float d1 = abs(fract(g.x + g.y + 0.5) - 0.5), d2 = abs(fract(g.x - g.y + 0.5) - 0.5);
    float bar = 1.0 - smoothstep(0.06, 0.06 + fw, min(d1, d2));
    float tie = 1.0 - smoothstep(0.05, 0.05 + fw, abs(fract(g.y * 0.5 + 0.5) - 0.5));
    float ew = fwidth(vUv.x);
    float edge = 1.0 - smoothstep(0.85, 0.85 + ew, min(vUv.x, vW - vUv.x));
    float a = max(max(bar, tie), edge);
    a = mix(a, max(0.42, edge * 0.9), smoothstep(0.18, 0.6, fw));
    if (a < bayer(gl_FragCoord.xy)) discard;
    vec3 n = normalize(vN);
    float key = abs(dot(n, uSunDir));
    vec3 c = uDay * (uAmbient * uAmbientTint * 0.9 + uSun * key * uSunTint * 0.8) * mix(1.0, 0.25, uNight);
    vec3 e = uGlow * uNight * (0.62 + 0.4 * edge) * (0.85 + 0.15 * smoothstep(0.0, 60.0, vY));
    gl_FragColor = vec4(c + e, 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }`;
function lattice() {
  const u = theme.uniforms;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uDay: { value: new THREE.Color('#9b8461') }, uGlow: { value: new THREE.Color('#ffd88f') },
      uSunDir: u.uSunDir, uSun: u.uSun, uAmbient: u.uAmbient, uSunTint: u.uSunTint, uAmbientTint: u.uAmbientTint, uNight: u.uNight,
    },
    vertexShader: LATTICE_VERT, fragmentShader: LATTICE_FRAG, fog: true, side: THREE.DoubleSide,
  });
}
function buildEiffel(data) {
  const f = data.buildings.find(b => /^eiffel tower$/i.test(b.name ?? ''));
  if (!f) return null;
  const r = obb(clean(f.pts)), H = 165;
  const B = Math.max(24, Math.min(30, r.d / 2)); // half the base, leg outer corner to centre
  const yTop = H * 0.9, y1 = H * 0.19, y2 = H * 0.38;
  const hwO = y => 1.5 + (B - 1.5) * Math.pow(Math.max(0, 1 - y / yTop), 2.3);
  const hwI = y => y >= y2 ? 0 : B * 0.58 * Math.pow(1 - y / y2, 1.3);
  const soup = new Soup();
  const face = (P, Q, nrm, y0, ya) => {
    // P(y), Q(y): the two face edges as functions of height; a vertical strip of quads
    const steps = Math.max(2, Math.round((ya - y0) / 6));
    for (let k = 0; k < steps; k++) {
      const ya0 = y0 + (ya - y0) * k / steps, ya1 = y0 + (ya - y0) * (k + 1) / steps;
      const p0 = P(ya0), q0 = Q(ya0), p1 = P(ya1), q1 = Q(ya1);
      const w0 = Math.hypot(q0[0] - p0[0], q0[1] - p0[1]), w1 = Math.hypot(q1[0] - p1[0], q1[1] - p1[1]);
      const v0 = soup.vert(p0[0], ya0, p0[1], nrm, 0, WHITE, [w0, 0, 0, 0]), v1 = soup.vert(q0[0], ya0, q0[1], nrm, w0, WHITE, [w0, 0, 0, 0]);
      const v2 = soup.vert(q1[0], ya1, q1[1], nrm, w1, WHITE, [w1, 0, 0, 0]), v3 = soup.vert(p1[0], ya1, p1[1], nrm, 0, WHITE, [w1, 0, 0, 0]);
      soup.idx.push(v0, v1, v2, v0, v2, v3);
    }
  };
  // legs: square sections [hwI, hwO] on both axes, one per quadrant, faces on all four sides
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    face(y => [sx * hwO(y), sz * hwI(y)], y => [sx * hwO(y), sz * hwO(y)], [sx, 0, 0], 0, y2);
    face(y => [sx * hwI(y), sz * hwO(y)], y => [sx * hwO(y), sz * hwO(y)], [0, 0, sz], 0, y2);
    face(y => [sx * hwI(y), sz * hwI(y)], y => [sx * hwI(y), sz * hwO(y)], [-sx, 0, 0], 0, y2);
    face(y => [sx * hwI(y), sz * hwI(y)], y => [sx * hwO(y), sz * hwI(y)], [0, 0, -sz], 0, y2);
  }
  // the single shaft above the second platform
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const P = y => ax ? [ax * hwO(y), -hwO(y)] : [-hwO(y), az * hwO(y)];
    const Q = y => ax ? [ax * hwO(y), hwO(y)] : [hwO(y), az * hwO(y)];
    face(P, Q, [ax, 0, az], y2, yTop);
  }
  const grp = new THREE.Group();
  grp.name = 'Eiffel Tower';
  const body = soup.mesh(lattice(), 'Eiffel lattice');
  if (body) grp.add(body);
  const deco = new THREE.Group();
  const deck = sheen('#8c7655', { refl: 0.2, spec: 0.6, glow: '#ffcf78', glowK: 0.9, baseGlow: 0.05 });
  const lamp = sheen('#fff1c8', { glow: '#ffe7a8', glowK: 1.6, baseGlow: 0.3 });
  // first platform: an open square frame; second: a solid deck; then the top cabin
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
  grp.position.set(r.cx, 0, r.cz);
  grp.rotation.y = -Math.atan2(r.az, r.ax);
  const out = new THREE.Group();
  out.name = 'Eiffel Tower';
  out.add(grp);
  out.add(spill(r.cx, 0.45, r.cz, 110, '#ffcf7a', 0.3));
  const glowMid = halo(150, '#ffc86a', 0.14);
  glowMid.position.set(r.cx, 60, r.cz);
  out.add(glowMid);
  const tip = halo(14, '#fff2c8', 0.8);
  tip.position.set(r.cx, H + 2.2, r.cz);
  out.add(tip);
  return out;
}

export function buildFourCorners(data) {
  const group = new THREE.Group();
  group.name = 'Four Corners resorts';
  for (const build of [buildBellagio, buildCaesars, buildParis, buildEiffel]) {
    const model = build(data);
    if (model) group.add(model);
  }
  return group;
}
export const FOUR_CORNERS_HEIGHTS = [[-170, 348, 155]];
