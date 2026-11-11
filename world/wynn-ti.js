/**
 * Hand-built models for Wynn Las Vegas, Encore and Treasure Island, matched to Apple Maps night
 * references (docs/landmark-rebuild-playbook.md). Towers are claimed in heroOwned; podiums, the
 * Lake of Dreams and TI's pirate lagoon stay with the older pipeline.
 */
import { hash } from '../landmarks/vendor/map/geom.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { halo, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { MODE, Soup, WHITE, centroid, clean, facade, obb, offset, sign, spill } from './hero-kit.js';

const THREE = window.THREE;
const SCRIPT = '"Snell Roundhand", "Apple Chancery", "Brush Script MT", "Segoe Script", cursive';

/** A script wordmark bent along a facade polyline, read from outside. */
function ribbonSign(text, chain, f0, f1, y0, y1, out, o = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 320;
  const x = canvas.getContext('2d');
  const gold = o.color ?? '#ffd477';
  x.font = o.font ?? `italic 700 220px ${SCRIPT}`;
  x.textBaseline = 'alphabetic';
  const raw = Math.max(1, x.measureText(text).width), w = 600, k = w / raw, base = 210;
  // soft warm bloom behind the letters, then the letters themselves glowing
  const gr = x.createRadialGradient(300, 150, 10, 300, 150, 360);
  gr.addColorStop(0, 'rgba(255,185,90,0.34)'); gr.addColorStop(0.55, 'rgba(255,170,80,0.1)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 1024, 320);
  x.fillStyle = x.strokeStyle = gold;
  x.shadowColor = 'rgba(255,196,110,0.95)'; x.shadowBlur = 26;
  x.save(); x.translate(36, base); x.scale(k, Math.min(1.3, Math.max(0.95, k)));
  x.lineWidth = 2.5; x.lineJoin = 'round'; x.fillText(text, 0, 0); x.strokeText(text, 0, 0); x.restore();
  // the signature tail: a long, slightly rising stroke out of the last letter, Wynn's ends in a dot
  const tx = 36 + w - 8;
  x.lineCap = 'round'; x.lineWidth = 8;
  x.beginPath(); x.moveTo(tx - 30, base - 8); x.bezierCurveTo(tx + 60, base - 4, tx + 180, base - 22, tx + 300, base - 34); x.stroke();
  if (o.dot) { x.beginPath(); x.arc(tx + 345, base - 40, 9, 0, Math.PI * 2); x.fill(); }
  x.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // arc-length samples of the chain between f0 and f1
  const len = [0];
  for (let i = 1; i < chain.length; i++) len.push(len[i - 1] + Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]));
  const total = len[len.length - 1], at = s => {
    for (let i = 1; i < chain.length; i++) if (len[i] >= s) {
      const k = (s - len[i - 1]) / ((len[i] - len[i - 1]) || 1), p = chain[i - 1], q = chain[i];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      return { x: p[0] + (q[0] - p[0]) * k, z: p[1] + (q[1] - p[1]) * k, nx: (q[1] - p[1]) / L * out, nz: -(q[0] - p[0]) / L * out };
    }
    return null;
  };
  const N = 24, pos = [], uv = [], idx = [];
  for (let k = 0; k <= N; k++) {
    const t = f0 + (f1 - f0) * k / N, p = at(t * total);
    const u = out > 0 ? 1 - k / N : k / N; // reading direction runs against the ring order on an outward face
    for (const [y, v] of [[y0, 0], [y1, 1]]) { pos.push(p.x + p.nx * 0.7, y, p.z + p.nz * 0.7); uv.push(u, v); }
    if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.01, depthWrite: false, side: THREE.DoubleSide, fog: true }));
  m.userData.keep = true;
  m.name = `${text} wordmark`;
  return m;
}

// ─────────────────────────────── Wynn and Encore ───────────────────────────────
/** Walls whose base and top follow functions of plan position (a raked roofline). */
function slopedWalls(soup, ring, y0, y1, a) {
  let u = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
    if (L < 0.05) continue;
    const n = [dz / L, 0, -dx / L];
    const v0 = soup.vert(p[0], y0(p), p[1], n, u, WHITE, a), v1 = soup.vert(q[0], y0(q), q[1], n, u + L, WHITE, a);
    const v2 = soup.vert(q[0], y1(q), q[1], n, u + L, WHITE, a), v3 = soup.vert(p[0], y1(p), p[1], n, u, WHITE, a);
    soup.idx.push(v0, v2, v1, v0, v3, v2);
    u += L;
  }
}
/** A roof cap following a height function. */
function slopedCap(soup, ring, y) {
  const tris = THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p[0], p[1])), []);
  const base = soup.pos.length / 3;
  for (const p of ring) soup.vert(p[0], y(p), p[1], [0, 1, 0], 0, WHITE, [y(p), 0, 0, 0]);
  for (const t of tris) soup.idx.push(base + t[0], base + t[2], base + t[1]);
}
function crescent(data, re, name, o) {
  const b = data.buildings.find(x => re.test(x.name ?? '') && x.h > 150);
  if (!b) return null;
  heroOwned.add(b);
  const out = new THREE.Group();
  out.name = name;
  const ring0 = clean(b.pts), h = b.h, r = obb(ring0), seed = hash(h) * 40;
  const s = p => (p[0] - r.cx) * r.ax + (p[1] - r.cz) * r.az, t = p => -(p[0] - r.cx) * r.az + (p[1] - r.cz) * r.ax;
  let i0 = 0, i1 = 0;
  ring0.forEach((p, i) => { if (s(p) < s(ring0[i0])) i0 = i; if (s(p) > s(ring0[i1])) i1 = i; });
  const chainOf = (rg, a, z) => { const c = []; for (let i = a; ; i = (i + 1) % rg.length) { c.push(rg[i]); if (i === z) break; } return c; };
  // the crescent bows one way; the face on the far side of the bow is the concave one
  const mean = c => c.reduce((k, p) => k + t(p), 0) / c.length;
  const A0 = chainOf(ring0, i0, i1), B0 = chainOf(ring0, i1, i0);
  const ends = (t(ring0[i0]) + t(ring0[i1])) / 2, bow = Math.sign(mean(A0) + mean(B0) - 2 * ends) || 1;
  const ring = ring0, A = A0, B = B0;
  // the front face is the one looking toward the Strip (south-west); the OSM outlines are too
  // irregular to tell concave from convex by their bulge alone
  const facing = c => { let x = 0, z = 0; for (let i = 1; i < c.length; i++) { x += c[i][1] - c[i - 1][1]; z -= c[i][0] - c[i - 1][0]; } return -x + z; };
  const [concave, convex] = facing(A) > facing(B) ? [A, B] : [B, A];
  const front = Math.sign((concave[Math.floor(concave.length / 2)][0] - r.cx) * -r.az + (concave[Math.floor(concave.length / 2)][1] - r.cz) * r.ax) || 1;
  // the roofline is raked: highest over the logo end of the concave face, falling toward the other
  // end, while the floor lines stop level at h - crown
  const sHigh = s(concave[concave.length - 1]), sLow = s(concave[0]);
  const topAt = p => h - o.drop * Math.min(1, Math.max(0, (s(p) - sHigh) / (sLow - sHigh)));
  const linesTop = h - o.crown;

  const walls = new Soup(), gilt = new Soup(), roof = new Soup(), dark = new Soup();
  slopedWalls(walls, ring, () => 0, topAt, [h, seed, 0, 0]);
  slopedCap(roof, ring, p => topAt(p) + 0.6);
  const rim = offset(ring, 0.3);
  slopedWalls(dark, rim, p => topAt(p) - 0.2, p => topAt(p) + 1.6, [h + 2, 1, 0, 0]);
  // each face ends in a dark bookend fin, slightly proud and taller than the roof, with a wide
  // gold strip just inside it running up to where the floor lines stop
  for (const [face, side] of [[concave, front], [convex, -front]]) {
    const ox = -r.az * side, oz = r.ax * side; // outward across the slab, toward this face
    for (const end of [0, 1]) {
      // the face corner at this end: the end-region vertex furthest out on this face's side
      const ext = end ? Math.max(...face.map(s)) : Math.min(...face.map(s));
      const region = face.map((p, i) => i).filter(i => Math.abs(s(face[i]) - ext) < 9);
      const ci = region.reduce((m, i) => (face[i][0] * ox + face[i][1] * oz) > (face[m][0] * ox + face[m][1] * oz) ? i : m, region[0]);
      const c0 = face[ci];
      const inward = end ? -1 : 1;
      let q = null;
      for (const p of face) if (Math.hypot(p[0] - c0[0], p[1] - c0[1]) > 6 && (s(p) - s(c0)) * inward > 0 && (!q || Math.abs(s(p) - s(c0)) < Math.abs(s(q) - s(c0)))) q = p;
      if (!q) continue;
      const L = Math.hypot(q[0] - c0[0], q[1] - c0[1]), tx = (q[0] - c0[0]) / L, tz = (q[1] - c0[1]) / L;
      let nx = tz, nz = -tx;
      if (nx * ox + nz * oz < 0) { nx = -nx; nz = -nz; }
      const finTop = topAt(c0) + 3.2;
      dark.box(c0[0] + tx * 0.6 + nx * 1.6, 0, c0[1] + tz * 0.6 + nz * 1.6, 2.6, finTop, 4.4, tx, tz, WHITE, [finTop, 1, 0, 0]);
      if (side === front) gilt.box(c0[0] + tx * 4.4 + nx * 0.45, 3, c0[1] + tz * 4.4 + nz * 0.45, 3.4, linesTop - 4, 0.5, tx, tz);
    }
  }
  const glass = facade(MODE.ribbon, { color: o.glass, glow: '#ffcb6a', floodK: 1.3, self: 0.03, bay: o.floor, crown: o.crown, roof: '#2a2420' });
  const gold = sheen('#c9a35a', { refl: 0.5, spec: 1.3, glow: '#ffd27a', glowK: 1.1, baseGlow: 0.1 });
  const lid = facade(MODE.stone, { color: '#3a332c', roof: '#2a2522' });
  const bronze = facade(MODE.stone, { color: '#2b2019', roof: '#3a3330', self: 0.02 });
  for (const m of [walls.mesh(glass, `${name} glass`), gilt.mesh(gold, `${name} gilding`), roof.mesh(lid, `${name} roof`), dark.mesh(bronze, `${name} fins`)]) if (m) out.add(m);
  // wordmarks sit high on the left of each face, in the crown band
  const ringSign = (c, outSign) => {
    const span = c.filter((p, i) => i >= c.length * 0.5);
    const top = Math.min(...span.map(topAt)) - 4, bottom = Math.max(linesTop + 3, top - 26);
    return ribbonSign(o.mark, c, 0.5, 0.9, bottom, top, outSign, { dot: o.dot });
  };
  out.add(ringSign(concave, 1), ringSign(convex, 1));
  const c = centroid(ring);
  out.add(spill(c[0], 0.45, c[1], 210, '#ffc870', 0.18));
  return out;
}

// ─────────────────────────────── Treasure Island ───────────────────────────────
function buildTI(data) {
  const b = data.buildings.find(x => x.part && x.h > 100 && Math.hypot(centroid(x.pts)[0] - 243, centroid(x.pts)[1] + 944) < 25);
  if (!b) return null;
  heroOwned.add(b);
  const out = new THREE.Group();
  out.name = 'Treasure Island';
  const ring = clean(b.pts), h = b.h;
  const walls = new Soup(), rail = new Soup(), roof = new Soup();
  walls.walls(ring, 0, h, WHITE, [h, 21, 0, 0]);
  roof.cap(ring, h + 1.4);
  rail.walls(offset(ring, 0.35), h - 0.4, h + 1.4, WHITE, [h + 1.4, 3, 0, 0]);
  for (const y of [h - 8, 15]) rail.walls(offset(ring, 0.45), y - 0.45, y + 0.55, WHITE, [y + 0.55, 3, 0, y - 4]);
  const coral = facade(MODE.palazzo, {
    color: '#dc8a72', pilaster: '#fff4ea', pilasterK: 1.0, pilasterW: 0.3, flood: '#ffdcc8', floodK: 1.9, self: 0.08,
    glow: '#fff0e0', line: 0.5, bay: 3.9, rate: 0.03,
  });
  const cornice = facade(MODE.stone, { color: '#fbefe4', flood: '#fff0e0', floodK: 1.3, self: 0.3 });
  const lid = facade(MODE.stone, { color: '#b9b2bd', roof: '#8e8a9a' });
  for (const m of [walls.mesh(coral, 'TI tower'), rail.mesh(cornice, 'TI cornices'), roof.mesh(lid, 'TI roof')]) if (m) out.add(m);

  // "Treasure Island" in script letters standing on the roof edges of the V that faces the Strip
  const style = { font: `italic 700 190px ${SCRIPT}`, color: '#ff4a32' };
  for (const [text, a, z] of [['Treasure', [280, -907], [257, -933]], ['Island', [257, -951], [298, -989]]]) {
    const mx = (a[0] + z[0]) / 2, mz = (a[1] + z[1]) / 2, L = Math.hypot(z[0] - a[0], z[1] - a[1]);
    let nx = (z[1] - a[1]) / L, nz = -(z[0] - a[0]) / L;
    if (nx < 0) { nx = -nx; nz = -nz; }
    out.add(sign(text, Math.min(42, L * 0.95), 11, mx + nx * 0.6, h + 6.6, mz + nz * 0.6, nx, nz, style));
  }
  const c = centroid(ring);
  out.add(spill(c[0] + 30, 0.45, c[1], 170, '#ffb59a', 0.26));
  const wash = halo(150, '#ffc0a6', 0.1);
  wash.position.set(c[0], 50, c[1]);
  out.add(wash);
  return out;
}

export function buildWynnTI(data) {
  const group = new THREE.Group();
  group.name = 'Wynn, Encore and Treasure Island';
  for (const model of [
    crescent(data, /^wynn las vegas$/i, 'Wynn', { glass: '#33241c', floor: 7.0, crown: 46, drop: 28, mark: 'wynn', dot: true }),
    crescent(data, /^encore las vegas$/i, 'Encore', { glass: '#34241b', floor: 6.8, crown: 50, drop: 30, mark: 'Encore' }),
    buildTI(data),
  ]) if (model) group.add(model);
  return group;
}
