/** Caesars Palace: stone orders, temple roofs and the Flamingo Road frontage. */
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { MODE, SERIF, Soup, WHITE, clean, centroid, facade, inset, obb, offset, sign, spill } from './hero-kit.js';
import { addShape, along, faces, material, model, named, own, parapet, put, standalonePodium } from './landmark-forms.js';

const THREE = window.THREE;
const stone = (color, floodK = 0.6, self = 0.04, roof = '#aaa6af') =>
  material(color, roof, { flood: '#ffe5c1', floodK, self });
const lamp = (color = '#ebe0cb', glowK = 0.83) => sheen(color, { glow: '#fff0d2', glowK, refl: 0.06 });
const at = (f, s, t = 0) => [f.x + f.ax * s + f.nx * t, f.z + f.az * s + f.nz * t];
const d = (x, z, a, b) => Math.hypot(x - a, z - b);

function belt(soup, ring, top, depth, projection) {
  const lip = offset(ring, projection);
  soup.walls(lip, top - depth, top);
  soup.skirt(lip, top, ring, top);
}

function pilaster(soup, f, s, w, y, h, depth, standoff) {
  const [x, z] = at(f, s, standoff);
  soup.box(x, y, z, w, h, depth, f.ax, f.az, WHITE, [y + h, 0, 0, y]);
}

// These are shaped dark glass panels inside projecting stone jambs. The
// bays, including the arches, have a silhouette in the export as well.
function panel(soup, f, s, y, width, height, rise = 0, distance = 0.11) {
  const r = width * 0.5, spring = y + height - rise;
  const outline = [[s - r, y], [s + r, y], [s + r, spring]];
  if (rise <= 0) outline.push([s - r, spring]);
  else for (let i = 1; i <= 8; i++) {
    const a = i * Math.PI / 8;
    outline.push([s + Math.cos(a) * r, spring + Math.sin(a) * rise]);
  }
  const v = outline.map(([u, h]) => {
    const [x, z] = at(f, u, distance);
    return soup.vert(x, h, z, [f.nx, 0, f.nz], u, WHITE, [y + height, 0, 0, y]);
  });
  for (let k = 1; k + 1 < v.length; k++) soup.idx.push(v[0], v[k], v[k + 1]);
}

function roofPanel(soup, points, desired) {
  const a = new THREE.Vector3(...points[0]), b = new THREE.Vector3(...points[1]), c = new THREE.Vector3(...points[2]);
  const n = b.sub(a).cross(c.sub(a)).normalize();
  const reverse = n.dot(new THREE.Vector3(...desired)) < 0;
  if (reverse) n.negate();
  const v = points.map(([x, y, z]) => soup.vert(x, y, z, n.toArray(), 0, WHITE, [y, 0, 0, 0]));
  for (let i = 1; i + 1 < v.length; i++) soup.idx.push(v[0], v[i + Number(reverse)], v[i + Number(!reverse)]);
}

function hippedRoof(soup, r, y, height) {
  const p = (s, t, h) => [r.cx + s * r.ax - t * r.az, y + h, r.cz + s * r.az + t * r.ax];
  const hw = r.w * 0.5, hd = r.d * 0.5, ridge = Math.max(0.1, hw - hd * 0.72);
  const a = p(-hw, -hd, 0), b = p(hw, -hd, 0), c = p(hw, hd, 0), e = p(-hw, hd, 0);
  const u = p(-ridge, 0, height), v = p(ridge, 0, height);
  for (const pts of [[a, b, v, u], [e, u, v, c], [a, u, e], [b, c, v]]) roofPanel(soup, pts, [0, 1, 0]);
}

function templeRoof(roof, trim, insetFace, r, y, rise) {
  trim.box(r.cx, y - 0.87, r.cz, r.w + 1.05, 0.9, r.d + 1.2, r.ax, r.az);
  roof.gable(r, y, rise, WHITE, [y + rise, 0, 0, y], trim, [y + rise, 0, 0, y]);
  const p = (s, h, reach, side) => [
    r.cx - r.az * s + r.ax * side * (r.w * 0.5 + reach), h,
    r.cz + r.ax * s + r.az * side * (r.w * 0.5 + reach),
  ];
  for (const side of [-1, 1]) {
    const desired = [r.ax * side, 0, r.az * side], run = r.d * 0.5;
    roofPanel(insetFace, [p(-run + 1.05, y + 0.46, 0.064, side),
      p(0, y + rise * 0.74, 0.064, side), p(run - 1.05, y + 0.46, 0.064, side)], desired);
    for (const end of [-1, 1]) roofPanel(trim, [
      p(run * end, y - 0.08, 0.18, side), p(0, y + rise + 0.21, 0.18, side),
      p(0, y + rise - 0.41, 0.18, side), p((run - 0.4) * end, y - 0.08, 0.18, side),
    ], desired);
  }
}

function towerRoofs(group, ring, h, tower, signed, roofs, details, pediments, pedestal) {
  const r = obb(ring);
  const signFace = signed ? faces(ring, 29).filter(f => f.nz > 0.85)
    .sort((a, b) => b.z + b.az * b.length / 2 - a.z - a.az * a.length / 2)[0] : null;
  const facing = signFace || r;
  const direction = facing.ax < 0 ? -1 : 1;
  const ax = facing.ax * direction, az = facing.az * direction;
  const nx = -az, nz = ax;
  const plan = ring.map(([x, z]) => [(x - r.cx) * ax + (z - r.cz) * az, (x - r.cx) * nx + (z - r.cz) * nz]);
  const limits = plan.map(([u]) => u), left = Math.min(...limits), right = Math.max(...limits);
  const span = right - left;
  const point = (u, v) => [r.cx + ax * u + nx * v, r.cz + az * u + nz * v];

  // Each roof span fits inside its own bay on both sides of the stepped or skewed plan.
  const bayDepth = (lo, hi) => {
    const stations = [lo, hi];
    for (const u of limits) if (u > lo && u < hi) stations.push(Math.max(lo, u - 0.006), Math.min(hi, u + 0.006));
    let back = -Infinity, front = Infinity;
    for (const u of stations) {
      const hits = [];
      for (let j = 0; j < plan.length; j++) {
        const [a, p] = plan[j], [b, q] = plan[(j + 1) % plan.length];
        if ((a <= u && u < b) || (b <= u && u < a)) hits.push(p + (q - p) * (u - a) / (b - a));
      }
      if (hits.length >= 2) {
        back = Math.max(back, Math.min(...hits));
        front = Math.min(front, Math.max(...hits));
      }
    }
    return [back + 0.9, front - 0.9];
  };
  const middle = signFace
    ? (signFace.x + signFace.ax * signFace.length / 2 - r.cx) * ax + (signFace.z + signFace.az * signFace.length / 2 - r.cz) * az
    : (left + right) / 2;
  const widths = (tower === 'palace' ? [0.243, 0.274, 0.233] : [0.208, 0.265, 0.203]).map(p => p * span);
  const ends = [left + span * 0.165, middle, right - span * 0.165];
  const bays = ends.map((u, i) => [u - widths[i] / 2, u + widths[i] / 2]);

  for (const [i, [lo, hi]] of bays.entries()) {
    const [back, front] = bayDepth(lo, hi), u = ends[i];
    const [cx, cz] = point(u, (back + front) / 2);
    const signedBay = i === 1 && signFace;
    const base = h + (signedBay ? 2.85 : 0.82), depth = front - back;
    pedestal.box(cx, h - 1.1, cz, widths[i] + 0.5, base - h + 1.07, depth + 0.62, ax, az);
    templeRoof(roofs, details, pediments, { cx, cz, ax: nx, az: nz, w: depth, d: widths[i] }, base, i === 1 ? 5.1 : 4.28);
    if (signedBay) {
      // The fascia and the sign share the central pavilion's face and ridge.
      const [x, z] = point(u, front + 0.33);
      group.add(sign('CAESARS PALACE', widths[i] * 0.93, 4.95, x, h + 0.76, z, nx, nz,
        { font: `900 181px ${SERIF}`, color: '#ed4944' }));
    }
  }

  for (let i = 0; i < bays.length - 1; i++) {
    const lo = bays[i][1] + 0.6, hi = bays[i + 1][0] - 0.6;
    const [back, front] = bayDepth(lo, hi), depth = front - back - 2.6;
    const [cx, cz] = point((lo + hi) / 2, (back + front) / 2);
    hippedRoof(roofs, { cx, cz, ax, az, w: hi - lo, d: depth }, h - 1.04, 2.82);
  }
}

function landmarkTower(out, data, options, label, builder, signed = false) {
  const b = named(data, label);
  if (!b) return;
  const group = model(label), ring = own(b, options), h = b.h;
  const scale = builder === 'palace' ? 1.12 : 1;
  const base = 15.35 * scale, plinth = 31.2 * scale, shoulder = h - 20.2 * scale, attic = h - 14.7 * scale;
  const building = new Soup(), glass = new Soup(), doorways = new Soup(), ribs = new Soup(), details = new Soup();
  const bright = new Soup(), roofs = new Soup(), roofsMetal = new Soup(), pedestal = new Soup(), pediments = new Soup();
  // Offset only the narrow cladding, preserving the shared recessed casino
  // podium and the mapped valet clearances beneath it.
  const shell = offset(ring, 0.125);
  for (const [lo, hi] of [[0.16, base], [base, plinth], [plinth, shoulder], [shoulder, attic], [attic, h - 1.2]])
    building.walls(shell, lo, hi, WHITE, [hi, 0, 0, lo]);

  for (const [i, f] of faces(shell, 1.8).entries()) {
    const slim = f.length < 8.8;
    const margin = slim ? f.length * 0.16 : Math.min(1.68, f.length * 0.11);
    const n = slim ? 1 : Math.max(1, Math.round((f.length - 2 * margin) / (4.6 * scale)));
    const pitch = (f.length - 2 * margin) / n;
    for (let j = 0; j < n; j++) {
      const s = margin + (j + 0.5) * pitch;
      if (!slim) {
        panel(j % 6 === 1 && f.nz > 0.2 ? doorways : glass, f, s, 1.15, pitch * 0.72, 6.47, 1.78);
        panel(glass, f, s, 8.34, pitch * 0.65, base - 9.14, 1.15);
      }
      panel(glass, f, s, base + 1.45, pitch * 0.61, (plinth - base) * 0.39);
      panel(glass, f, s, base + (plinth - base) * 0.57, pitch * 0.61, (plinth - base) * 0.33);
      // Blank short returns, tall straight recesses, and a genuinely separate crown arcade.
      if (!slim) panel(glass, f, s, plinth + 0.68, pitch * 0.73, shoulder - plinth - 1.72, pitch * 0.29);
      panel(glass, f, s, shoulder + 1.1, pitch * 0.65, attic - shoulder - 2.08);
      if (!slim) panel(glass, f, s, attic + 0.9, pitch * 0.70, h - attic - 3.45, pitch * 0.35);
    }
    for (let j = 0; j <= n; j++) {
      const s = margin + j * pitch, end = j === 0 || j === n;
      const w = Math.min(pitch * 0.35, end ? 1.16 : 0.96);
      pilaster(ribs, f, s, w, plinth + 0.04, shoulder - plinth - 0.20, end ? 1.31 : 0.89, end ? 0.37 : 0.30);
      if (slim || j % 2 === 0) pilaster(ribs, f, s, w * 0.90, attic - 0.01, h - attic - 1.26, 0.68, 0.31);
      for (const [y, capHeight] of [[plinth, 0.93], [shoulder - 0.87, 0.83], [h - 2.15, 0.56]]) {
        if (y > h - 3 && !slim && j % 2 !== 0) continue;
        pilaster(details, f, s, w * 1.42, y, capHeight, 1.2, 0.40);
      }
      if (end || i % 3 !== 1) pilaster(bright, f, s, w * 0.73, plinth + 0.12, 0.29, 0.17, end ? 1.06 : 0.76);
    }
  }

  for (const [y, width, reach] of [
    [base, 0.91, 0.62], [plinth, 1.12, 0.90], [shoulder, 1.43, 1.02],
    [attic, 1.32, 1.23], [h - 1.07, 1.53, 1.09],
  ]) {
    belt(details, ring, y, width, reach);
    belt(bright, ring, y - width + 0.31, 0.17, reach + 0.072);
  }
  roofsMetal.cap(ring, h - 1.05);
  towerRoofs(group, ring, h, builder, signed, roofs, details, pediments, pedestal);

  put(group, building, stone('#ded4c5', 0.99, 0.07), label + ' dressed stone');
  put(group, glass, sheen('#4b5771', { glow: '#4d6389', glowK: 0.18, refl: 0.19, spec: 0.43 }), label + ' recessed slate windows');
  put(group, doorways, lamp('#8d805d', 0.56), label + ' softly lit arched doors');
  put(group, ribs, stone('#f2e6d7', 1.22, 0.15), label + ' projecting stone pilasters');
  put(group, details, stone('#f3e8d7', 1.03, 0.16), label + ' lintels, temple faces and cornices');
  put(group, bright, lamp(), label + ' cornice lighting');
  put(group, pedestal, stone('#e2d3c5', 0.77, 0.10), label + ' roof pavilion plinths');
  put(group, roofs, sheen('#93777c', { glow: '#8e7688', glowK: 0.18, refl: 0.13, spec: 0.35 }), label + ' terracotta pavilion roofs');
  put(group, pediments, stone('#c5b2ae', 0.72, 0.08), label + ' recessed tympana');
  put(group, roofsMetal, stone('#a19ca6', 0.16), label + ' interstitial roof decks');
  out.add(group);
}

function smallerTowers(out, data, options) {
  const walls = new Soup(), trim = new Soup(), glasses = new Soup(), tops = new Soup();
  const pavilions = new Soup(), roofs = new Soup();
  for (const name of ['Forum Tower', 'Julius Tower', 'Julius Tower Extension', 'Nobu Hotel at Caesars Palace']) {
    const b = named(data, name);
    if (!b) continue;
    const ring = own(b, options), top = b.h, crown = top - 1.6;
    const extension = name === 'Julius Tower Extension';
    walls.walls(ring, 13.94, crown, WHITE, [crown, 0, 0, 14]);
    for (const f of faces(ring, 2.6)) {
      const count = Math.max(1, Math.round(f.length / 4.9)), pitch = f.length / count;
      const windowWidth = pitch * (extension ? 0.81 : 0.72);
      for (let j = 0; j < count; j++) {
        const bay = (j + 0.5) * pitch;
        panel(glasses, f, bay, 15.3, windowWidth, crown - 17.1);
        if (f.length > 5.5) pilaster(trim, f, j * pitch + 0.16, 0.26, 14.8, crown - 15.6, 0.52, 0.19);
      }
    }
    for (let y = 17.75; y < crown - 1.0; y += (extension ? 3.75 : 4.05)) belt(trim, ring, y, 0.45, 0.25);
    belt(trim, ring, crown + 0.13, 0.88, 0.45);
    tops.cap(ring, crown + 0.05);
    parapet(trim, ring, crown + 0.12, 0.94, 0.19);

    if (name === 'Forum Tower') {
      // Each pavilion fits inside its own wing, leaving the bend of the mapped
      // Colosseum Tower open between them.
      for (const [cx, cz, w, d, angle] of [[-104.2, -132.2, 25.5, 16.8, 62.6], [-65.7, -107.3, 25.5, 14.2, 1.4]]) {
        const azimuth = THREE.MathUtils.degToRad(angle);
        const ax = Math.cos(azimuth), az = Math.sin(azimuth);
        pavilions.box(cx, crown + 0.035, cz, w, 0.91, d, ax, az);
        hippedRoof(roofs, { cx, cz, w, d, ax, az }, crown + 0.94, 1.05);
      }
    } else if (name === 'Nobu Hotel at Caesars Palace') {
      // Nobu's rectangular roof sits behind the coping on all four sides.
      const r = obb(ring);
      hippedRoof(roofs, { ...r, w: r.w - 5, d: r.d - 5 }, crown + 0.07, 1.05);
    }
  }
  put(out, walls, stone('#d4c8bc', 0.81), 'Julius, Colosseum and Nobu stone wings');
  put(out, trim, stone('#e8dcc9', 0.88, 0.12), 'Low tower stone piers, floor courses and parapets');
  put(out, glasses, sheen('#4d596c', { glow: '#59677b', glowK: 0.13, refl: 0.18 }), 'Low tower recessed windows');
  put(out, pavilions, stone('#d6c8b9', 0.31, 0.06), 'Colosseum Tower rooftop pavilions');
  put(out, roofs, sheen('#a58b83', { glow: '#816c71', glowK: 0.15 }), 'Inset Colosseum and Nobu tile roofs');
  put(out, tops, stone('#b2aca6', 0.13, 0, '#a9a1a1'), 'Low tower roof decks');
}

function colosseum(out, campus) {
  const start = campus.pts.findIndex(([x, z]) => d(x, z, -15.4, -150) < 1.1);
  if (start < 0) return;
  const curve = clean([...campus.pts.slice(start), campus.pts[0]]), y = campus.h;
  const tiers = new Soup(), ledges = new Soup(), upper = new Soup(), roof = new Soup();
  const niches = new Soup(), doors = new Soup(), columns = new Soup();
  const lowerRing = offset(curve, 0.14);
  tiers.walls(lowerRing, y - 0.09, y + 10.2, WHITE, [y + 10, 0, 0, y]);
  const insetRing = inset(curve, 1.07) ?? curve;
  upper.walls(insetRing, y + 10.17, y + 18.9, WHITE, [y + 19, 0, 0, y + 10]);
  for (const [h, width, lip] of [[y + 1.64, 0.56, 0.79], [y + 7.6, 0.89, 0.96], [y + 10.5, 1.51, 1.20],
    [y + 18.27, 1.24, 0.67], [y + 19.24, 0.56, 0.91]]) belt(ledges, h < y + 15 ? curve : insetRing, h, width, lip);
  roof.cap(insetRing, y + 18.81);
  parapet(roof, insetRing, y + 18.82, 1.03, 0.42);
  // Dress the public-facing arc with repeated arched recesses and an attached
  // order of limestone piers. The podium renderer keeps the driveway openings.
  for (const f of faces(lowerRing, 3.2).filter(f => f.nx > 0.08)) {
    const count = Math.max(1, Math.round(f.length / 5.4)), pitch = f.length / count;
    for (let i = 0; i < count; i++) {
      const s = (i + 0.5) * pitch, width = Math.min(pitch * 0.61, 3.75);
      panel(niches, f, s, y + 2.03, width + 0.46, 5.13, 1.43, 0.16);
      panel(doors, f, s, y + 2.12, width, 4.83, 1.29, 0.19);
      const side = Math.min(0.48, pitch * 0.10);
      for (const distance of [-width / 2 - side * 0.78, width / 2 + side * 0.78]) {
        pilaster(columns, f, s + distance, side, y + 1.67, 5.92, 0.65, 0.23);
        pilaster(ledges, f, s + distance, side + 0.27, y + 7.2, 0.37, 0.75, 0.22);
      }
    }
  }
  put(out, tiers, stone('#d9cab4', 0.72, 0.12), 'Colosseum rounded limestone tiers');
  put(out, upper, stone('#cbb493', 0.72, 0.09), 'Colosseum warm upper drum');
  put(out, columns, stone('#e6d8bd', 0.95, 0.12), 'Colosseum arc of stone piers');
  put(out, ledges, stone('#eee2cf', 0.99, 0.13), 'Colosseum cornices and pier capitals');
  put(out, roof, stone('#ab9f94', 0.1, 0, '#b4aba3'), 'Colosseum terrace roof');
  put(out, niches, stone('#a9927f', 0.47), 'Colosseum arch surrounds');
  put(out, doors, sheen('#625e68', { glow: '#7b5949', glowK: 0.25 }), 'Colosseum recessed lower arches');
  out.add(sign('THE COLOSSEUM', 19.1, 3.15, 7.4, y + 14.4, -184.5, 1, 0,
    { font: `700 125px ${SERIF}`, color: '#fff4dc' }));
}

function podiumRoof(out, h) {
  const volume = new Soup(), coping = new Soup(), roof = new Soup(), windows = new Soup();
  // Low tiers on the casino roof sit inboard of the perimeter and the valet lanes.
  const decks = [
    { ring: [[-75, -26], [-36, -26], [-29, -14], [-29, 5], [-65, 5], [-75, -4]], lift: 2.45 },
    { ring: [[-70, -107], [-28, -107], [-21, -100], [-21, -85], [-70, -85]], lift: 3.5 },
    { ring: [[13, -127], [41, -127], [44, -119], [44, -99], [25, -95], [13, -104]], lift: 4.25 },
  ];
  for (const { ring: outline, lift } of decks) {
    const ring = clean(outline), top = h + lift;
    volume.walls(ring, h, top);
    roof.cap(ring, top);
    parapet(coping, ring, top, 0.58, 0.17);
    for (const f of faces(ring, 7.5).filter(f => f.nx > 0.3 || f.nz > 0.8)) {
      const count = Math.max(1, Math.floor(f.length / 5.1)), pitch = f.length / count;
      for (let k = 0; k < count; k++) panel(windows, f, (k + 0.5) * pitch, h + 0.46, Math.min(2.6, pitch * 0.61), lift - 1.1, 0.45);
    }
  }
  put(out, volume, stone('#ccbdac', 0.68, 0.06), 'Stepped casino roof tiers');
  put(out, coping, stone('#dfd0b9', 0.76, 0.09), 'Casino stone parapets');
  put(out, roof, stone('#b1aaa3', 0.13, 0, '#a89e92'), 'Casino roof membranes');
  put(out, windows, sheen('#756b64', { glow: '#bd9469', glowK: 0.24 }), 'Casino tier window recesses');
}

function arrival(out, data, options) {
  const base = named(data, 'Augustus Tower');
  const south = base && faces(clean(base.pts), 26).filter(f => f.nz > 0.78)
    .sort((a, b) => Math.abs(a.x + a.ax * a.length / 2 + 70.5) - Math.abs(b.x + b.ax * b.length / 2 + 70.5))[0];
  const portico = new Soup(), canopy = new Soup(), trim = new Soup(), tile = new Soup();
  if (south) {
    const center = south.length / 2, wide = Math.min(22.8, south.length * 0.61), [x, z] = at(south, center, 1.65);
    for (let j = 0; j < 6; j++) {
      const s = center + (j / 5 - 0.5) * (wide - 1.36);
      pilaster(portico, south, s, 0.94, 0.12, 6.3, 1.17, 2.66);
      pilaster(trim, south, s, 1.29, 0.14, 0.42, 1.36, 2.66);
      pilaster(trim, south, s, 1.34, 5.82, 0.66, 1.39, 2.66);
    }
    along(trim, south, center - wide * 0.52, center + wide * 0.52, 6.12, 1.12, 4.3, 1.69);
    templeRoof(tile, trim, portico, { cx: x, cz: z, ax: south.nx, az: south.nz, w: 4.64, d: wide }, 7.29, 2.84);
  }
  const arch = data.buildings.find(b => b.b === 'roof' && b.pts.length > 14 && d(...centroid(b.pts), 5, 10) < 10);
  if (arch) {
    // The city already fits the canopy to the valet model. Only dress its
    // roofline here; the standalone file gets the underside as well.
    const ring = clean(arch.pts), top = 8.12;
    if (options?.standalone) canopy.prism(ring, 6.2, top);
    belt(trim, ring, top + 0.22, 0.58, 0.41);
    const upper = inset(ring, 1.8);
    if (upper) canopy.prism(upper, top + 0.03, top + 0.89);
  }
  put(out, portico, stone('#dfd0c0', 1.10, 0.06), 'Flamingo Road portico columns');
  put(out, canopy, stone('#b9b0b8', 0.47), 'Curved valet canopy crown');
  put(out, trim, stone('#eee1d0', 1.10, 0.12), 'Flamingo portico and arrival entablature');
  put(out, tile, sheen('#9b7a82', { glow: '#bd8a88', glowK: 0.19 }), 'Portico pediment roof');

  const fountains = new Soup(), coping = new Soup();
  for (const area of data.areas) {
    if (area.k !== 'water') continue;
    const [x, z] = centroid(area.pts);
    if (d(x, z, 34, 10) > 6 && d(x, z, 91, 12) > 9) continue;
    const ring = clean(area.pts);
    fountains.cap(ring, 0.185);
    belt(coping, ring, 0.58, 0.40, 0.37);
  }
  put(out, fountains, sheen('#28548a', { glow: '#458ac6', glowK: 0.37, refl: 0.24 }), 'Mapped Caesars entrance fountains');
  put(out, coping, stone('#b3a7a4', 0.46), 'Fountain coping');
  out.add(spill(13, 0.41, 16, 63, '#ffdfb3', 0.17));
}

function tent(out, data, options) {
  const b = named(data, 'Absinthe');
  if (!b) return;
  const ring = own(b, options), [x, z] = centroid(ring), r = obb(ring);
  const side = new Soup(), rose = new Soup(), linen = new Soup();
  side.prism(ring, 0.07, b.h - 1.01);
  const p = (i, t, y) => {
    const a = i * Math.PI / 10, c = Math.cos(a) * r.w * 0.50 * t, s = Math.sin(a) * r.d * 0.50 * t;
    return [x + c * r.ax - s * r.az, y, z + c * r.az + s * r.ax];
  };
  for (let i = 0; i < 20; i++) {
    const strip = i % 2 ? rose : linen;
    roofPanel(strip, [p(i, 1.03, b.h - 1.02), p(i + 1, 1.03, b.h - 1.02), p(i + 1, 0.35, b.h + 1.64),
      p(i, 0.35, b.h + 1.64)], [0, 1, 0]);
    roofPanel(strip, [p(i, 0.35, b.h + 1.64), p(i + 1, 0.35, b.h + 1.64), [x, b.h + 3.82, z]], [0, 1, 0]);
  }
  put(out, side, stone('#aa6f74', 0.51), 'Absinthe tent walls');
  put(out, rose, sheen('#b2686b', { glow: '#b97184', glowK: 0.18 }), 'Pink Absinthe roof segments');
  put(out, linen, sheen('#e8dbd2', { glow: '#e9c7bd', glowK: 0.27 }), 'Ivory Absinthe roof segments');
}

const ellipse = (x, z, rx, rz, n) => Array.from({ length: n }, (_, i) => {
  const a = i * Math.PI * 2 / n;
  return [x + rx * Math.cos(a), z + rz * Math.sin(a)];
});

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
    belt(coping, ring, 0.36, 0.28, 0.62);
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
    group.add(cap.mesh(stone, 'Temple pool pavilion'), columns.mesh(stone, 'Pavilion columns'));
    addShape(group, new THREE.SphereGeometry(4.65, 22, 10, 0, 2 * Math.PI, 0, Math.PI / 2).scale(1, 0.57, 1),
      blue, "Temple pool pavilion dome", x, 8.2, z);
  }
  return group;
}

export function buildCaesars(data, options) {
  const out = model('Caesars Palace'), campus = named(data, 'Caesars Palace Hotel and Casino');
  if (!campus) return out;
  standalonePodium(out, campus, options, stone('#cbc3ba', 0.48, 0, '#a7a3aa'));
  landmarkTower(out, data, options, 'Augustus Tower', 'augustus', true);
  landmarkTower(out, data, options, 'Octavius Tower', 'octavius');
  landmarkTower(out, data, options, 'Palace Tower', 'palace');
  smallerTowers(out, data, options);
  podiumRoof(out, campus.h);
  colosseum(out, campus);
  arrival(out, data, options);
  tent(out, data, options);
  const pools = buildCaesarsPools(data);
  if (pools) out.add(pools);
  return out;
}
