/**
 * Hand-built models for Wynn Las Vegas, Encore and Treasure Island, matched to Apple Maps night
 * references (docs/landmark-rebuild-playbook.md). Towers and bespoke resort villas/pavilions are
 * claimed in heroOwned; road-cut main podiums stay with the generic extruder so valet tunnels survive.
 */
import { hash, ringArea } from '../landmarks/vendor/map/geom.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { theme } from '../landmarks/vendor/core/theme.js';
import { halo, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { MODE, Soup, WHITE, centroid, clean, facade, inset, makeWaterMaterial, obb, offset, sign, spill } from './hero-kit.js';

const THREE = window.THREE;
const SCRIPT = '"Snell Roundhand", "Apple Chancery", "Brush Script MT", "Segoe Script", cursive';

/** Regular counter-clockwise polygon ring for cylinders, rotundas and domes. */
function disk(cx, cz, r, n = 24, stretchX = 1, stretchZ = 1, rot = 0) {
  const pts = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let k = 0; k < n; k++) {
    const a = -k / n * Math.PI * 2;
    const lx = Math.cos(a) * r * stretchX, lz = Math.sin(a) * r * stretchZ;
    pts.push([cx + lx * c - lz * s, cz + lx * s + lz * c]);
  }
  return ringArea(pts) > 0 ? pts : pts.reverse();
}

/** Oriented rectangle ring (counter-clockwise) given center, width, depth and unit axis (ax, az). */
function rectRing(cx, cz, w, d, ax = 1, az = 0) {
  const px = -az, pz = ax, hw = w / 2, hd = d / 2;
  const ring = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([s, t]) => [cx + ax * s + px * t, cz + az * s + pz * t]);
  return ringArea(ring) > 0 ? ring : ring.reverse();
}

/** Add a stepped slate-blue-grey podium pavilion with arched base, cornice and flat slate roof. */
function addSlatePavilion(arcadeSoup, slateSoup, trimSoup, ring, y0, y1, archTop = y1 - 2.2, seed = 11) {
  const r0 = clean(ring);
  if (archTop > y0 + 1.5) {
    arcadeSoup.walls(r0, y0, archTop, WHITE, [archTop, seed, 1, y0]);
    slateSoup.walls(r0, archTop, y1, WHITE, [y1, seed, 0, archTop]);
  } else {
    slateSoup.walls(r0, y0, y1, WHITE, [y1, seed, 0, y0]);
  }
  const rim = offset(r0, 0.32);
  trimSoup.walls(rim, y1 - 0.55, y1 + 0.25, WHITE, [y1 + 0.25, seed, 0, y1 - 0.55]);
  slateSoup.cap(r0, y1 + 0.2, WHITE, [y1 + 0.2, seed, 0, y1]);
}

/** A script wordmark bent along a facade polyline, read from outside, with a soft warm amber halo. */
function ribbonSign(text, chain, f0, f1, y0, y1, out, o = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 320;
  const x = canvas.getContext('2d');
  const gold = o.color ?? '#ffda78';
  const core = o.core ?? '#fff3c4';
  x.font = o.font ?? `italic 700 220px ${SCRIPT}`;
  x.textBaseline = 'alphabetic';
  const raw = Math.max(1, x.measureText(text).width), w = 580, k = w / raw, base = 208;

  // Soft elliptical warm amber-chocolate glow behind the script letters that fades to 0 inside canvas bounds
  x.save();
  x.translate(430, 160);
  x.scale(2.85, 1.0);
  const gr = x.createRadialGradient(0, 0, 8, 0, 0, 142);
  gr.addColorStop(0.0, 'rgba(255, 182, 84, 0.44)');
  gr.addColorStop(0.45, 'rgba(215, 132, 56, 0.22)');
  gr.addColorStop(0.78, 'rgba(130, 72, 30, 0.06)');
  gr.addColorStop(1.0, 'rgba(80, 42, 18, 0.0)');
  x.fillStyle = gr;
  x.beginPath();
  x.arc(0, 0, 142, 0, Math.PI * 2);
  x.fill();
  x.restore();

  const drawSignature = (strokeCol, fillCol, blur, lw) => {
    x.save();
    x.fillStyle = fillCol;
    x.strokeStyle = strokeCol;
    x.shadowColor = 'rgba(255, 192, 88, 0.96)';
    x.shadowBlur = blur;
    x.save();
    x.translate(46, base);
    x.scale(k, Math.min(1.3, Math.max(0.95, k)));
    x.lineWidth = lw;
    x.lineJoin = 'round';
    x.fillText(text, 0, 0);
    x.strokeText(text, 0, 0);
    x.restore();
    const tx = 46 + w - 10;
    x.lineCap = 'round';
    x.lineWidth = lw * 2.35;
    x.beginPath();
    x.moveTo(tx - 30, base - 8);
    x.bezierCurveTo(tx + 60, base - 4, tx + 185, base - 22, tx + 305, base - 35);
    x.stroke();
    if (o.dot) {
      x.beginPath();
      x.arc(tx + 348, base - 41, 10, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  };

  drawSignature(gold, gold, 28, 3.8);
  drawSignature(core, core, 10, 1.8);

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
  const N = 28, pos = [], uv = [], idx = [];
  for (let k = 0; k <= N; k++) {
    const t = f0 + (f1 - f0) * k / N, p = at(t * total);
    const u = out > 0 ? 1 - k / N : k / N;
    for (const [y, v] of [[y0, 0], [y1, 1]]) { pos.push(p.x + p.nx * 0.72, y, p.z + p.nz * 0.72); uv.push(u, v); }
    if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.005, depthWrite: false, side: THREE.DoubleSide, fog: true }));
  m.userData.keep = true;
  m.name = `${text} wordmark`;
  return m;
}

// ─────────────────────────────── Wynn and Encore Crescent Towers ───────────────────────────────
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
/** A sloped coping band between two concentric rings following a height function. */
function slopedBand(soup, outer, inner, y) {
  const n = Math.min(outer.length, inner.length);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, p = outer[i], q = outer[j], P = inner[i], Q = inner[j];
    const v0 = soup.vert(p[0], y(p), p[1], [0, 1, 0], 0, WHITE, [y(p), 0, 0, 0]);
    const v1 = soup.vert(q[0], y(q), q[1], [0, 1, 0], 0, WHITE, [y(q), 0, 0, 0]);
    const v2 = soup.vert(Q[0], y(Q), Q[1], [0, 1, 0], 0, WHITE, [y(Q), 0, 0, 0]);
    const v3 = soup.vert(P[0], y(P), P[1], [0, 1, 0], 0, WHITE, [y(P), 0, 0, 0]);
    soup.idx.push(v0, v2, v1, v0, v3, v2);
  }
}

function crescent(data, re, name, o) {
  const b = data.buildings.find(x => re.test(x.name ?? '') && x.h > 150);
  if (!b) return null;
  heroOwned.add(b);
  const out = new THREE.Group();
  out.name = name;
  const ring0 = clean(b.pts), h = b.h, r = obb(ring0), seed = hash(h) * 40;
  const s = p => (p[0] - r.cx) * r.ax + (p[1] - r.cz) * r.az;
  let i0 = 0, i1 = 0;
  ring0.forEach((p, i) => { if (s(p) < s(ring0[i0])) i0 = i; if (s(p) > s(ring0[i1])) i1 = i; });
  const chainOf = (rg, a, z) => { const c = []; for (let i = a; ; i = (i + 1) % rg.length) { c.push(rg[i]); if (i === z) break; } return c; };
  const A0 = chainOf(ring0, i0, i1), B0 = chainOf(ring0, i1, i0);
  const ring = ring0, A = A0, B = B0;
  const facing = c => { let x = 0, z = 0; for (let i = 1; i < c.length; i++) { x += c[i][1] - c[i - 1][1]; z -= c[i][0] - c[i - 1][0]; } return -x + z; };
  const [concave, convex] = facing(A) > facing(B) ? [A, B] : [B, A];
  const front = Math.sign((concave[Math.floor(concave.length / 2)][0] - r.cx) * -r.az + (concave[Math.floor(concave.length / 2)][1] - r.cz) * r.ax) || 1;
  // Raked roofline: highest over the logo end of the concave face, falling toward the right end
  const sHigh = s(concave[concave.length - 1]), sLow = s(concave[0]);
  const topAt = p => h - o.drop * Math.min(1, Math.max(0, (s(p) - sHigh) / (sLow - sHigh)));
  const linesTop = h - o.crown;

  const walls = new Soup(), gilt = new Soup(), roof = new Soup(), coping = new Soup(), dark = new Soup();
  slopedWalls(walls, ring, () => 0, topAt, [h, seed, 0, 0]);
  slopedCap(roof, ring, p => topAt(p) + 0.35);

  // Continuous sleek dark cocoa-taupe raked parapet coping rim framing the recessed dark chocolate roof deck
  const rimOut = offset(ring, 0.42);
  const rimIn = offset(ring, -2.1);
  slopedWalls(coping, rimOut, p => topAt(p) - 0.9, p => topAt(p) + 1.85, [h + 2, 2, 0, 0]);
  slopedWalls(coping, rimIn, p => topAt(p) + 0.35, p => topAt(p) + 1.85, [h + 2, 2, 0, 0]);
  slopedBand(coping, rimOut, rimIn, p => topAt(p) + 1.85);

  // Each face ends in a dark chocolate-bronze bookend pier with an illuminated vertical gold strip just inside it
  for (const [face, side] of [[concave, front], [convex, -front]]) {
    const ox = -r.az * side, oz = r.ax * side;
    for (const end of [0, 1]) {
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
      const finTop = topAt(c0) + 1.82;
      dark.box(c0[0] + tx * 0.7 + nx * 1.15, 0, c0[1] + tz * 0.7 + nz * 1.15, 2.8, finTop, 3.2, tx, tz, WHITE, [finTop, 1, 0, 0]);
      gilt.box(c0[0] + tx * 3.8 + nx * 0.42, 4, c0[1] + tz * 3.8 + nz * 0.42, 2.2, linesTop - 4, 0.55, tx, tz);
    }
  }

  const glass = facade(MODE.ribbon, { color: o.glass, glow: '#ffcf6e', floodK: 1.38, self: 0.05, bay: o.floor, crown: o.crown, roof: '#2b1b14' });
  const gold = sheen('#d8ae5c', { refl: 0.55, spec: 1.35, glow: '#ffd67c', glowK: 1.35, baseGlow: 0.16 });
  const lid = facade(MODE.stone, { color: '#2e1e17', roof: '#241711', self: 0.06 });
  const parapetMat = facade(MODE.stone, { color: '#5c4d4d', roof: '#4e4142', flood: '#ffdfa8', floodK: 0.28, self: 0.1 });
  const bronze = facade(MODE.stone, { color: '#3b241b', roof: '#4a352c', flood: '#ffd28a', floodK: 0.22, self: 0.08 });
  for (const m of [
    walls.mesh(glass, `${name} glass`),
    gilt.mesh(gold, `${name} gilding`),
    roof.mesh(lid, `${name} roof`),
    coping.mesh(parapetMat, `${name} coping`),
    dark.mesh(bronze, `${name} fins`),
  ]) if (m) out.add(m);

  // Wordmarks sit high on the left of each face, in the tall wedge of the dark chocolate crown
  const ringSign = (c, outSign) => {
    const span = c.filter((p, i) => i >= c.length * 0.5);
    const top = Math.min(...span.map(topAt)) - 3.5, bottom = Math.max(linesTop + 2.5, top - 26.5);
    return ribbonSign(o.mark, c, 0.50, 0.90, bottom, top, outSign, { dot: o.dot });
  };
  out.add(ringSign(concave, 1), ringSign(convex, 1));
  const c = centroid(ring);
  out.add(spill(c[0], 0.45, c[1], 220, '#ffc972', 0.2));
  return out;
}

// ───────────────────── Curved Street Marquee Pylon Sign ("Wynn.") ─────────────────────
/**
 * Matches the Apple Maps close-up reference (media_1794388102489_51fca1ed.jpg):
 * - Curved dark chocolate-brown pedestal at bottom
 * - Curved dark chocolate-brown outer bezel frame & raked rooftop crest fin
 * - Upper and lower luminous cool ice-blue/white curved LED screen panels
 * - Projecting middle curved dark chocolate-brown collar band with warm amber spotlight glow
 *   and the golden cursive "Wynn." signature across the front.
 */
function makeIceScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Cool luminous ice-blue/white LED screen panel with subtle darker edge vignette
  const bg = ctx.createLinearGradient(0, 0, 512, 0);
  bg.addColorStop(0.0, '#9cb5e2');
  bg.addColorStop(0.18, '#bed4f8');
  bg.addColorStop(0.5, '#dceaff');
  bg.addColorStop(0.82, '#bed4f8');
  bg.addColorStop(1.0, '#9cb5e2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  // Vertical soft shading
  const vg = ctx.createLinearGradient(0, 0, 0, 512);
  vg.addColorStop(0.0, 'rgba(110, 140, 195, 0.35)');
  vg.addColorStop(0.2, 'rgba(255, 255, 255, 0.08)');
  vg.addColorStop(0.8, 'rgba(255, 255, 255, 0.08)');
  vg.addColorStop(1.0, 'rgba(110, 140, 195, 0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, 512, 512);

  // Thin dark recessed inner bezel border
  ctx.strokeStyle = 'rgba(45, 35, 38, 0.65)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 502);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeMiddleCollarLogoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 320;
  const ctx = canvas.getContext('2d');

  // Rich dark chocolate-brown collar background
  const bg = ctx.createLinearGradient(0, 0, 1024, 0);
  bg.addColorStop(0.0, '#361f19');
  bg.addColorStop(0.22, '#4a2b22');
  bg.addColorStop(0.52, '#633928');
  bg.addColorStop(0.78, '#4a2b22');
  bg.addColorStop(1.0, '#361f19');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 320);

  // Warm amber-orange radial glow behind the "Wynn." script in the center of the chocolate band
  ctx.save();
  ctx.translate(485, 165);
  ctx.scale(2.5, 1.0);
  const rad = ctx.createRadialGradient(0, 0, 10, 0, 0, 150);
  rad.addColorStop(0.0, 'rgba(255, 176, 82, 0.68)');
  rad.addColorStop(0.48, 'rgba(215, 125, 52, 0.38)');
  rad.addColorStop(0.82, 'rgba(120, 62, 28, 0.12)');
  rad.addColorStop(1.0, 'rgba(60, 32, 18, 0)');
  ctx.fillStyle = rad;
  ctx.beginPath();
  ctx.arc(0, 0, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Subtle top & bottom dark trim lips on the collar
  ctx.fillStyle = '#2a1712';
  ctx.fillRect(0, 0, 1024, 10);
  ctx.fillRect(0, 310, 1024, 10);

  // Bright golden cursive "Wynn." signature matching the Apple Maps close-up
  ctx.save();
  ctx.font = `italic 700 205px ${SCRIPT}`;
  ctx.textBaseline = 'alphabetic';
  const base = 212;
  for (const [col, blur, lw] of [
    ['#ffbf55', 28, 6.0],
    ['#ffe478', 12, 3.5],
    ['#fff4b8', 4, 1.5],
  ]) {
    ctx.save();
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.shadowColor = 'rgba(255, 195, 78, 0.96)';
    ctx.shadowBlur = blur;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.fillText('Wynn', 135, base);
    ctx.strokeText('Wynn', 135, base);
    ctx.lineCap = 'round';
    ctx.lineWidth = lw * 2.1;
    ctx.beginPath();
    ctx.moveTo(590, base - 12);
    ctx.bezierCurveTo(665, base - 8, 760, base - 24, 845, base - 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(882, base - 37, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildWynnMarquee(cx = 626, cz = -1172) {
  const group = new THREE.Group();
  group.name = 'Wynn Street Marquee';
  // Oriented facing southwest toward Las Vegas Blvd & Apple Maps camera
  const ax = 0.74, az = 0.673; // width axis
  const nx = -az, nz = ax;     // outward normal (-0.673, 0.74)

  const bowedRing = (w, d, bow = 2.4, segs = 16, shiftT = 0) => {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const u = -0.5 + i / segs;
      const b = Math.cos(u * Math.PI) * bow;
      const s = u * w, t = d / 2 + b + shiftT;
      pts.push([cx + ax * s + nx * t, cz + az * s + nz * t]);
    }
    for (let i = segs; i >= 0; i--) {
      const u = -0.5 + i / segs;
      const b = Math.cos(u * Math.PI) * bow * 0.55;
      const s = u * w, t = -d / 2 + b + shiftT;
      pts.push([cx + ax * s + nx * t, cz + az * s + nz * t]);
    }
    return clean(pts);
  };

  const chocSoup = new Soup();
  const baseRing = bowedRing(17.5, 4.8, 1.9);
  const frameRing = bowedRing(22.6, 5.6, 2.5);
  const collarRing = bowedRing(24.4, 7.2, 2.85, 16, 0.25);

  // 1. Curved dark chocolate-brown pedestal base (y = 0..9.8m)
  chocSoup.prism(baseRing, 0, 9.8, WHITE, [9.8, 5, 0, 0]);

  // 2. Curved dark chocolate-brown main frame core & outer bezel (y = 9.5..35.8m)
  chocSoup.prism(frameRing, 9.5, 35.8, WHITE, [35.8, 5, 0, 9.5]);
  // Left & right vertical dark chocolate bezel piers proud of the ice-blue screens
  for (const s of [-10.6, 10.6]) {
    chocSoup.box(cx + ax * s + nx * 0.65, 9.5, cz + az * s + nz * 0.65, 1.8, 26.3, 6.2, ax, az, WHITE, [35.8, 5, 0, 9.5]);
  }

  // 3. Projecting middle dark chocolate-brown collar band (y = 18.6..25.6m)
  chocSoup.prism(collarRing, 18.6, 25.6, WHITE, [25.6, 5, 0, 18.6]);

  // 4. Stepped / raked dark chocolate-brown rooftop crest fin (y = 35.8..40.2m, rising toward the right/back)
  const crestRing = bowedRing(19.5, 3.6, 2.1, 14, -0.3);
  const sCoord = p => (p[0] - cx) * ax + (p[1] - cz) * az;
  const crestTop = p => 36.6 + 3.6 * Math.max(0, Math.min(1, (sCoord(p) + 9.5) / 19.0));
  slopedWalls(chocSoup, crestRing, () => 35.6, crestTop, [40.2, 5, 0, 35.6]);
  slopedCap(chocSoup, crestRing, crestTop);

  const chocMat = facade(MODE.stone, {
    color: '#3f251e', roof: '#2e1b15', flood: '#ffcf88', floodK: 0.38, self: 0.14, roofGlow: 0.08,
  });
  const chocMesh = chocSoup.mesh(chocMat, 'Wynn marquee chocolate frame');
  if (chocMesh) group.add(chocMesh);

  // Helper to build a curved textured ribbon surface on both front and back faces
  const addCurvedPanel = (w, y0, y1, bowFront, bowBack, tFront, tBack, mat, label) => {
    for (const faceSign of [1, -1]) {
      const N = 18, pos = [], uv = [], idx = [];
      const bow = faceSign > 0 ? bowFront : bowBack;
      const tOff = faceSign > 0 ? tFront : tBack;
      for (let k = 0; k <= N; k++) {
        const u = -0.5 + k / N;
        const b = Math.cos(u * Math.PI) * bow;
        const s = u * w, t = tOff + b;
        const px = cx + ax * s + nx * t, pz = cz + az * s + nz * t;
        const texU = faceSign > 0 ? k / N : 1 - k / N;
        pos.push(px, y0, pz, px, y1, pz);
        uv.push(texU, 0, texU, 1);
        if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, mat);
      m.userData.keep = true;
      m.name = label;
      group.add(m);
    }
  };

  // Upper (y = 25.8..34.4m) & Lower (y = 10.6..18.4m) luminous ice-blue/white curved screen panels
  const iceMat = new THREE.MeshBasicMaterial({ map: makeIceScreenTexture(), side: THREE.DoubleSide, fog: true });
  addCurvedPanel(19.6, 10.6, 18.4, 2.55, 1.38, 2.92, -2.92, iceMat, 'Wynn marquee lower ice screen');
  addCurvedPanel(19.6, 25.8, 34.4, 2.55, 1.38, 2.92, -2.92, iceMat, 'Wynn marquee upper ice screen');

  // Projecting middle chocolate collar face (y = 18.7..25.5m) with glowing golden "Wynn." script
  const collarMat = new THREE.MeshBasicMaterial({ map: makeMiddleCollarLogoTexture(), side: THREE.DoubleSide, fog: true });
  addCurvedPanel(23.8, 18.7, 25.5, 2.90, 1.55, 3.92, -3.42, collarMat, 'Wynn marquee middle logo band');

  group.add(spill(cx - 6, 0.45, cz + 6, 48, '#ffd488', 0.25));
  return group;
}

// ───────────────────── Wynn Golf Club Course & Water Hazards ─────────────────────
function makeGolfTurfMaterial() {
  const u = theme.uniforms;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uNight: u.uNight,
      uSun: u.uSun,
      uAmbient: u.uAmbient,
    },
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uNight, uSun, uAmbient;
      varying vec3 vW;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
                   mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 p = vW.xz * 0.015;
        float n1 = noise(p), n2 = noise(p * 2.6 + 7.3);
        float fairway = smoothstep(0.36, 0.66, n1 * 0.65 + n2 * 0.35);
        float mower = 0.5 + 0.5 * sin((vW.x * 0.85 + vW.z * 0.52) * 0.28);
        fairway *= 0.86 + 0.14 * mower;
        vec3 dayRough = vec3(0.22, 0.50, 0.28);
        vec3 dayFair  = vec3(0.32, 0.64, 0.37);
        vec3 nightRough = vec3(0.038, 0.20, 0.13);
        vec3 nightFair  = vec3(0.072, 0.30, 0.19);
        vec3 dayCol = mix(dayRough, dayFair, fairway) * (0.72 + 0.28 * (uAmbient + uSun * 0.6));
        vec3 nightCol = mix(nightRough, nightFair, fairway);
        vec3 c = mix(dayCol, nightCol, uNight);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }
    `,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
}

/** Chaikin corner-cutting subdivision so stream polylines curve organically. */
function smoothChain(pts, passes = 2) {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    const next = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i], b = cur[i + 1];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

/** Ribbon polygon along a polyline of [x, z] points with half-width r. */
function ribbonPoly(pts, r) {
  const sm = smoothChain(pts, 2);
  const left = [], right = [];
  for (let i = 0; i < sm.length; i++) {
    const a = sm[Math.max(0, i - 1)], b = sm[Math.min(sm.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    left.push([sm[i][0] + nx * r, sm[i][1] + nz * r]);
    right.push([sm[i][0] - nx * r, sm[i][1] - nz * r]);
  }
  return clean([...left, ...right.reverse()]);
}

/** Add lush conical pine & rounded canopy trees around the Wynn marquee, Lake of Dreams & E Wynn Main Gate. */
function addWynnPineGrove(pineSoup, trunkSoup) {
  const addPine = (x, z, h = 15, r = 4.2, y0 = 0) => {
    const tr = disk(x, z, Math.max(0.55, r * 0.18), 8);
    trunkSoup.prism(tr, y0, y0 + h * 0.26, WHITE, [y0 + h * 0.26, 1, 0, y0]);
    const b1 = disk(x, z, r, 10), m1 = disk(x, z, r * 0.62, 10);
    const b2 = disk(x, z, r * 0.78, 10), m2 = disk(x, z, r * 0.42, 10);
    const b3 = disk(x, z, r * 0.52, 10), tip = disk(x, z, 0.35, 10);
    pineSoup.cap(b1, y0 + h * 0.22);
    pineSoup.skirt(b1, y0 + h * 0.22, m1, y0 + h * 0.54);
    pineSoup.skirt(b2, y0 + h * 0.46, m2, y0 + h * 0.78);
    pineSoup.skirt(b3, y0 + h * 0.70, tip, y0 + h);
    pineSoup.cap(tip, y0 + h);
  };

  // Pine & cypress clusters around the Wynn marquee sign, Lake of Dreams berm, and E Wynn Main Gate rotary
  const trees = [
    // Around the Wynn street marquee & S Las Vegas Blvd edge
    [606, -1182, 15, 4.4], [611, -1168, 17, 4.6], [615, -1154, 16, 4.3], [608, -1142, 14, 4.0],
    [618, -1132, 16, 4.5], [622, -1192, 14, 4.0], [634, -1196, 15, 4.2],
    // Pine mountain berm between the marquee and Lake of Dreams
    [638, -1178, 18, 4.8], [641, -1164, 19, 5.0], [639, -1150, 18, 4.8],
    [642, -1136, 17, 4.6], [636, -1122, 16, 4.4], [648, -1112, 15, 4.2],
    // Inside the Meta Lab / E Wynn Main Gate garden island (between Urth Caffé arcade and drive)
    [722, -1272, 13, 4.2], [732, -1266, 14, 4.5], [744, -1260, 14, 4.4],
    [756, -1255, 13, 4.0], [716, -1282, 12, 3.8], [728, -1278, 13, 4.1],
    // Along the north-east lakeside edge
    [678, -1182, 14, 4.0], [696, -1122, 14, 4.0], [672, -1092, 15, 4.2],
  ];
  for (const [x, z, h, r] of trees) addPine(x, z, h, r, 0);
}

function buildWynnCampusAndGolf(data) {
  const out = new THREE.Group();
  out.name = 'Wynn & Encore Resort Campus';

  const arcadeWalls = new Soup();
  const slatePodium = new Soup();
  const stoneTrim = new Soup();
  const warmPortals = new Soup();
  const redAwnings = new Soup();
  const poolDeck = new Soup();
  const turquoiseWater = new Soup();
  const cobaltWater = new Soup();
  const golfTurf = new Soup();
  const pineFoliage = new Soup();
  const pineTrunks = new Soup();

  // Claim only smaller pavilion/villa footprints (maxArea < 12000) so the road-cut main podiums (#47, #209, #63) stay in buildings.js
  const claimAt = (cx, cz, tol = 28, maxH = 40, maxArea = 12000) => {
    const b = data.buildings.find(x =>
      !heroOwned.has(x) &&
      x.h <= maxH &&
      Math.abs(ringArea(x.pts)) < maxArea &&
      Math.hypot(centroid(x.pts)[0] - cx, centroid(x.pts)[1] - cz) < tol
    );
    if (b) heroOwned.add(b);
    return b;
  };

  // ── 1. Classical Arcaded Villa / Esplanade Wing along E WYNN MAIN GATE (Urth Caffé / Cipriani / OVO, #50) ──
  const b50 = claimAt(759, -1329, 30, 20, 15000);
  if (b50) {
    const r50 = clean(b50.pts);
    // Ground-floor glowing warm cream-gold arches (y = 0..8.8m) + cool slate-blue-grey upper walls & flat roof (y = 8.8..12.2m)
    arcadeWalls.walls(r50, 0, 8.8, WHITE, [8.8, 17, 1, 0]);
    slatePodium.walls(r50, 8.8, 11.8, WHITE, [11.8, 17, 0, 8.8]);
    stoneTrim.walls(offset(r50, 0.32), 8.5, 9.1, WHITE, [9.1, 17, 0, 8.5]);
    slatePodium.walls(offset(r50, 0.28), 11.4, 12.3, WHITE, [12.3, 17, 0, 11.4]);
    slatePodium.cap(r50, 11.8, WHITE, [11.8, 17, 0, 11.8]);
  }
  // Southwest rounded corner rotunda at Urth Caffé (691, -1301) — cool slate-blue-grey with glowing ground-floor portal
  const urthRot = disk(691, -1301, 11.2, 22);
  addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, urthRot, 0, 12.4, 8.8, 23);
  // Small burgundy-red curved awnings above the west-side ground-floor arches along S Las Vegas Blvd (Urth Caffé -> OVO)
  for (let k = 0; k < 5; k++) {
    const f = (k + 0.5) / 5;
    const ax = 685 + (702 - 685) * f, az = -1304 + (-1358 - -1304) * f;
    redAwnings.box(ax - 0.8, 5.8, az + 0.25, 4.2, 1.35, 1.8, 0.29, -0.95, WHITE, [7.15, k, 0, 5.8]);
  }
  // Northwest corner stepped volume at October's Very Own / Cipriani (705, -1361)
  const ovoRing = rectRing(705, -1361, 18, 14, 0.95, -0.31);
  addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, ovoRing, 0, 12.8, 8.8, 29);
  // E Wynn Main Gate arched portico entrance (760, -1274) & Wynn Main Entrance rotunda (738, -1245)
  const gatePortico = rectRing(760, -1274, 22, 9.5, 0.95, 0.30);
  addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, gatePortico, 0, 12.6, 9.2, 31);
  const mainEntRot = disk(738, -1245, 10.8, 20);
  addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, mainEntRot, 0, 14.8, 9.5, 37);

  // ── 2. Encore Beach Club Pavilion, Glowing Turquoise Pools & XS Nightclub Rotunda ──
  const b247 = claimAt(756, -1473, 30, 15);
  const b285 = claimAt(856, -1512, 30, 15);
  const b239 = claimAt(890, -1360, 25, 15);

  if (b247) addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, b247.pts, 0, 18.2, 14.2, 41);
  if (b285) addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, b285.pts, 0, 16.8, 13.5, 43);

  // Encore Beach Club circular street-front rotunda at (728, -1434) with cool slate-blue-grey cap
  const ebcRot = disk(728, -1434, 11.2, 22);
  addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, ebcRot, 0, 18.8, 14.5, 47);

  // Raised Encore Beach Club pool terrace & glowing turquoise pool at y = 14.2..14.8m (on top of Encore podium #209)
  const ebcDeck = disk(757, -1462, 34, 24, 0.72, 1.18, -0.32);
  poolDeck.prism(ebcDeck, 14.0, 14.65, WHITE, [14.65, 51, 0, 14.0]);
  slatePodium.walls(offset(ebcDeck, 0.5), 14.0, 15.2, WHITE, [15.2, 51, 0, 14.0]);
  // Terracotta accent skirt at street edge of Encore Beach Club
  redAwnings.walls(offset(ebcDeck, 0.65), 11.5, 13.8, WHITE, [13.8, 51, 0, 11.5]);
  const ebcPoolMain = disk(757, -1462, 22, 24, 0.58, 1.12, -0.32);
  turquoiseWater.cap(ebcPoolMain, 14.74, WHITE, [14.74, 51, 0, 14.74]);

  // XS Nightclub rotunda (#239 at 890, -1360) — cool slate-blue-grey tiered drum & dome matching Apple Maps
  const xsBase = b239 ? clean(b239.pts) : disk(890, -1360, 15.5, 24);
  arcadeWalls.walls(xsBase, 0, 16.2, WHITE, [16.2, 53, 1, 0]);
  const xsDrum = disk(890, -1360, 13.5, 24);
  const xsCrown = disk(890, -1360, 9.2, 24);
  slatePodium.walls(xsDrum, 14.0, 18.8, WHITE, [18.8, 53, 0, 14.0]);
  stoneTrim.walls(offset(xsDrum, 0.3), 18.3, 19.0, WHITE, [19.0, 53, 0, 18.3]);
  slatePodium.skirt(xsDrum, 18.9, xsCrown, 21.0, WHITE, [21.0, 53, 0, 18.9]);
  slatePodium.cap(xsCrown, 21.0, WHITE, [21.0, 53, 0, 18.9]);

  // ── 3. Stepped Cool Slate-Blue-Grey Upper Podium Volumes (Allegro, Wazuzu, Golden Goose, Awakening & Encore Theaters) ──
  const b49 = claimAt(866, -1252, 25, 30); // Awakening Theater
  if (b49) {
    const r49 = clean(b49.pts);
    slatePodium.prism(r49, 0, 22.0, WHITE, [22.0, 59, 0, 0]);
    const awDrum = disk(866, -1252, 18.5, 24);
    const awTop = disk(866, -1252, 11.0, 24);
    slatePodium.walls(awDrum, 21.5, 24.8, WHITE, [24.8, 59, 0, 21.5]);
    slatePodium.skirt(awDrum, 24.8, awTop, 26.8, WHITE, [26.8, 59, 0, 24.8]);
    slatePodium.cap(awTop, 26.8, WHITE, [26.8, 59, 0, 24.8]);
  }
  const b64 = claimAt(904, -1179, 25, 30); // Encore / Wynn Theater fly-loft
  if (b64) {
    const r64 = clean(b64.pts);
    slatePodium.prism(r64, 0, 20.5, WHITE, [20.5, 61, 0, 0]);
    const in64 = inset(r64, 3.5);
    if (in64) slatePodium.prism(in64, 20.5, 23.2, WHITE, [23.2, 61, 0, 20.5]);
  }
  // Stepped slate-blue-grey rooftop volumes matching Apple Maps (Golden Goose, Poker Room, Wazuzu, Allegro, Drugstore, OMEGA)
  for (const [bx, bz, bw, bd, by0, by1, sd] of [
    [790, -1424, 48, 30, 14.0, 19.2, 67], // Golden Goose / Encore-Wynn esplanade
    [784, -1390, 34, 22, 14.0, 18.4, 71], // Wazuzu / Casa Playa
    [776, -1208, 42, 26, 14.0, 19.2, 73], // Allegro atrium
    [742, -1172, 26, 18, 14.0, 17.8, 75], // The Drugstore / OMEGA rooftop volume
    [762, -1135, 30, 20, 14.0, 18.2, 76], // Overlook Lounge / Tiffany & Co. rooftop volume
  ]) {
    const rBox = rectRing(bx, bz, bw, bd, 0.94, 0.34);
    slatePodium.prism(rBox, by0, by1, WHITE, [by1, sd, 0, by0]);
  }

  // ── 4. Lake of Dreams Amphitheater, PISCES Bar & Seafare, SW Steakhouse, Mizumi & Strip Rotundas ──
  const b236 = claimAt(691, -1112, 18, 10, 3000);
  const b237 = claimAt(685, -1146, 18, 10, 3000);
  const b238 = claimAt(658, -1080, 18, 10, 3000);
  const b52 = claimAt(573, -1137, 25, 10, 3000);

  // Full Lake of Dreams heart/kidney-shaped cobalt lagoon covering the entire basin
  const lakeBasin = clean([
    [642, -1188], [662, -1186], [678, -1172], [689, -1152],
    [691, -1126], [684, -1104], [666, -1096], [648, -1104],
    [638, -1122], [634, -1148], [636, -1172],
  ]);
  stoneTrim.walls(offset(lakeBasin, 0.9), 0.1, 1.25, WHITE, [1.25, 3, 0, 0]);
  cobaltWater.cap(lakeBasin, 0.78, WHITE, [0.78, 3, 0, 0]);

  // Landscaped emerald-green ground berm around the Wynn. street marquee & Lake of Dreams
  const greenBerm = clean([
    [602, -1198], [644, -1202], [648, -1172], [645, -1142],
    [648, -1110], [628, -1104], [604, -1130], [598, -1168],
  ]);
  golfTurf.cap(greenBerm, 0.18, WHITE, [0.18, 1, 0, 0]);
  // Meta Lab / E Wynn Main Gate rotary lawn
  golfTurf.cap(disk(736, -1270, 24, 20, 1.2, 0.75, 0.3), 0.18, WHITE, [0.18, 1, 0, 0]);

  // PISCES Bar & Seafare semicircular lakeside rotunda (688, -1138) — cool slate-blue-grey with glowing warm portal & clerestory
  const piscesRot = disk(688, -1138, 12.2, 24);
  slatePodium.prism(piscesRot, 0, 14.8, WHITE, [14.8, 79, 0, 0]);
  stoneTrim.walls(offset(piscesRot, 0.28), 14.2, 15.0, WHITE, [15.0, 79, 0, 14.2]);
  // Glowing warm cream-gold portal window (y = 0.5..8.2m) and upper clerestory slot (y = 9.8..11.2m) facing the Lake of Dreams
  warmPortals.box(680.2, 0.5, -1142.5, 9.6, 7.8, 3.2, 0.48, -0.88, WHITE, [8.3, 79, 0, 0.5]);
  warmPortals.box(680.4, 9.8, -1142.4, 10.2, 1.4, 3.0, 0.48, -0.88, WHITE, [11.2, 79, 0, 9.8]);
  if (b237) addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, b237.pts, 0, 12.6, 8.5, 81);

  // SW Steakhouse curved terrace pavilion (#236 at 691, -1112) & rotunda (692, -1104)
  if (b236) addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, b236.pts, 0, 13.0, 8.8, 83);
  const swRot = disk(692, -1104, 10.8, 20);
  addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, swRot, 0, 14.4, 9.2, 85);
  warmPortals.box(684.5, 0.5, -1108.0, 8.5, 7.2, 2.8, 0.42, -0.91, WHITE, [7.7, 85, 0, 0.5]);

  // Mizumi lakeside pavilions (659, -1176 & #238 at 658, -1080)
  if (b238) addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, b238.pts, 0, 12.2, 8.2, 87);
  const mizumiPav = rectRing(659, -1176, 24, 14, 0.92, 0.38);
  addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, mizumiPav, 0, 12.8, 8.6, 89);

  // Strip-front circular retail rotundas (Wynn Fountain, Louis Vuitton, Rolex, Gucci) & berm (#52)
  for (const [rx, rz, rad, h, sd] of [
    [640, -1202, 10.8, 13.8, 91], // Wynn Fountain corner rotunda
    [676, -1034, 11.5, 15.2, 93], // Louis Vuitton / Gucci rotunda
    [610, -1056, 10.2, 13.8, 95], // Rolex rotunda
  ]) {
    const ring = disk(rx, rz, rad, 22);
    addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, ring, 0, h, h - 4.2, sd);
  }
  if (b52) slatePodium.prism(clean(b52.pts), 0, 8.2, WHITE, [8.2, 97, 0, 0]);

  // ── 5. East Villa Wing overlooking Wynn Golf Club (Red 8, Wing Lei, Zero Bond, Sartiano's) ──
  const b240 = claimAt(1002, -1132, 30, 18);
  const b286 = claimAt(902, -1112, 25, 15);
  const b287 = claimAt(856, -1075, 25, 15);
  const b298 = claimAt(868, -988, 25, 15);
  for (const b of [b240, b286, b287, b298]) {
    if (b) addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, b.pts, 0, Math.max(10.5, b.h + 2), 7.5, 101);
  }
  for (const [vx, vz, vw, vd, vy0, vy1, sd] of [
    [832, -1132, 24, 16, 14.0, 19.8, 103], // Red 8
    [852, -1108, 26, 17, 14.0, 20.2, 105], // Wing Lei
    [892, -1082, 30, 18, 16.0, 21.6, 107], // Zero Bond at Wynn Las Vegas
    [916, -1042, 32, 19, 16.0, 22.0, 109], // Sartiano's Italian Steakhouse
    [938, -1005, 28, 17, 16.0, 21.2, 111], // East garden villa wing
  ]) {
    const vRing = rectRing(vx, vz, vw, vd, 0.34, -0.94);
    addSlatePavilion(arcadeWalls, slatePodium, stoneTrim, vRing, vy0, vy1, vy1 - 2.4, sd);
  }

  // ── 6. Surveyed Water Bodies (Pools, Lake of Dreams & Golf Water Hazards) + Golf Turf ──
  for (const a of data.areas ?? []) {
    const c = centroid(a.pts);
    if (c[0] < 520 || c[0] > 1650 || c[1] < -1620 || c[1] > -820) continue;
    const r = clean(a.pts);
    if (r.length < 3) continue;

    if (a.k === 'golf' || (a.k === 'park' && c[0] > 880 && c[1] > -1520 && c[1] < -860)) {
      golfTurf.cap(r, 0.16, WHITE, [0.16, 1, 0, 0]);
    } else if (a.k === 'water') {
      const isEncoreBeachPool = c[0] > 725 && c[0] < 805 && c[1] > -1505 && c[1] < -1420;
      const isEncoreCourtyardPool = c[0] > 860 && c[0] < 955 && c[1] > -1425 && c[1] < -1290;
      const isLakeOfDreams = c[0] > 545 && c[0] < 720 && c[1] > -1220 && c[1] < -1045;
      if (isEncoreBeachPool || isEncoreCourtyardPool) {
        poolDeck.prism(offset(r, 1.4), 14.0, 14.62, WHITE, [14.62, 2, 0, 14.0]);
        turquoiseWater.cap(r, 14.72, WHITE, [14.72, 2, 0, 14.72]);
      } else if (isLakeOfDreams) {
        stoneTrim.walls(offset(r, 0.8), 0.1, 1.15, WHITE, [1.15, 3, 0, 0]);
        cobaltWater.cap(r, 0.78, WHITE, [0.78, 3, 0, 0]);
      } else if (c[0] >= 940) {
        cobaltWater.cap(r, 0.28, WHITE, [0.28, 4, 0, 0]);
      }
    }
  }

  // Wynn Sunset / European Resort Pools (872, -1108 & 888, -1056)
  for (const [px, pz, pw, pd] of [
    [872, -1108, 34, 15],
    [888, -1056, 30, 14],
  ]) {
    const pRing = rectRing(px, pz, pw, pd, 0.34, -0.94);
    poolDeck.prism(offset(pRing, 2.2), 0.1, 1.15, WHITE, [1.15, 2, 0, 0]);
    turquoiseWater.cap(pRing, 1.24, WHITE, [1.24, 2, 0, 0]);
  }

  // Smooth winding royal-blue golf course streams & ponds matching the Apple Maps aerial view
  const golfStreams = [
    [[1015, -1355], [1045, -1315], [1072, -1265], [1095, -1210], [1132, -1158], [1165, -1102]],
    [[1165, -1102], [1192, -1055], [1222, -1012], [1258, -975], [1295, -945]],
    [[1132, -1158], [1185, -1168], [1235, -1152], [1285, -1125], [1335, -1095]],
    [[1055, -1015], [1085, -1045], [1120, -1068], [1165, -1102]],
    [[985, -955], [1025, -982], [1055, -1015]],
  ];
  for (const chain of golfStreams) {
    cobaltWater.cap(ribbonPoly(chain, 4.6), 0.28, WHITE, [0.28, 4, 0, 0]);
  }
  cobaltWater.cap(disk(954, -966, 17, 22, 0.85, 1.35, 0.25), 0.28, WHITE, [0.28, 4, 0, 0]);

  // Add pine & cypress trees around the Wynn marquee sign, Lake of Dreams, and E Wynn Main Gate
  addWynnPineGrove(pineFoliage, pineTrunks);

  // ── Materials ──
  // Cool slate-blue-grey podium walls with warm cream-gold glowing arched windows (matches Apple Maps night view)
  const arcadeMat = facade(MODE.arcade, {
    color: '#919fb8', pilaster: '#a9b7cf', pilasterK: 0.45, pilasterW: 0.24,
    glass: '#ffdfa4', flood: '#ffe2ad', floodK: 1.15, self: 0.16,
    roof: '#6d7f9b', roofGlow: 0.18, bay: 6.2, rate: 0.92,
  });
  const slateMat = facade(MODE.stone, {
    color: '#7c8ea8', roof: '#6d7f9b', flood: '#b8cbe8', floodK: 0.38, self: 0.16, roofGlow: 0.22,
  });
  const stoneTrimMat = facade(MODE.stone, {
    color: '#abb8ce', roof: '#7c8ea8', flood: '#ffe4b4', floodK: 0.65, self: 0.18,
  });
  const warmPortalMat = sheen('#ffebb8', { refl: 0.2, spec: 0.8, glow: '#ffe29e', glowK: 1.55, baseGlow: 0.55 });
  const redAwningMat = facade(MODE.stone, {
    color: '#6e3438', roof: '#5c2a2e', flood: '#ffcf9e', floodK: 0.45, self: 0.08,
  });
  const poolDeckMat = facade(MODE.stone, {
    color: '#9aa8c0', roof: '#7f91ac', flood: '#d4e2f8', floodK: 0.35, self: 0.16, roofGlow: 0.18,
  });
  const pineMat = facade(MODE.stone, {
    color: '#196e55', roof: '#155e48', flood: '#2aa882', floodK: 0.22, self: 0.14, roofGlow: 0.12,
  });
  const trunkMat = facade(MODE.stone, { color: '#3b261d', roof: '#2d1c15', self: 0.05 });
  const aquaMat = makeWaterMaterial('#38c6ea', '#6ce0ff', '#b4f4ff');
  const cobaltMat = makeWaterMaterial('#1e6ca6', '#153c78', '#2a5ca4');
  const golfMat = makeGolfTurfMaterial();

  for (const m of [
    golfTurf.mesh(golfMat, 'Wynn Golf Club turf'),
    cobaltWater.mesh(cobaltMat, 'Wynn lakes and water hazards'),
    poolDeck.mesh(poolDeckMat, 'Wynn & Encore pool decks'),
    turquoiseWater.mesh(aquaMat, 'Wynn & Encore swimming pools'),
    slatePodium.mesh(slateMat, 'Wynn & Encore slate-blue podiums'),
    arcadeWalls.mesh(arcadeMat, 'Wynn & Encore arched podiums'),
    stoneTrim.mesh(stoneTrimMat, 'Wynn & Encore cornices'),
    warmPortals.mesh(warmPortalMat, 'Wynn lakeside glowing portals'),
    redAwnings.mesh(redAwningMat, 'Wynn street awnings'),
    pineTrunks.mesh(trunkMat, 'Wynn pine trunks'),
    pineFoliage.mesh(pineMat, 'Wynn pine grove'),
  ]) if (m) out.add(m);

  // Warm ground/plaza spills at key resort focal points
  out.add(
    spill(745, 0.45, -1295, 85, '#ffdfa6', 0.18), // Esplanade / Urth Caffé arcade
    spill(682, 0.45, -1138, 75, '#ffda98', 0.18), // PISCES / Lake of Dreams amphitheater
    spill(756, 14.8, -1462, 55, '#68e2ff', 0.18), // Encore Beach Club turquoise pool glow
    buildWynnMarquee(626, -1172),
  );
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
    crescent(data, /^wynn las vegas$/i, 'Wynn', { glass: '#3b2318', floor: 6.7, crown: 42, drop: 27, mark: 'Wynn', dot: true }),
    crescent(data, /^encore las vegas$/i, 'Encore', { glass: '#3b2318', floor: 6.6, crown: 44, drop: 28, mark: 'Encore' }),
    buildWynnCampusAndGolf(data),
    buildTI(data),
  ]) if (model) group.add(model);
  return group;
}
