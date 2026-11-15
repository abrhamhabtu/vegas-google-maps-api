/** Hotel envelopes from their mapped rings; storefront, sign, and roof details are drawn here. */
import { MODE, Soup, WHITE, SANS, SERIF, clean, facade, inset, offset, sign, spill } from './hero-kit.js';
import { addShape, along, faces, mapped, material, model, named, own, parapet, put, standalonePodium, wordmark } from './landmark-forms.js';

const THREE = window.THREE;
const serif = (color, weight = '600') => ({ font: `${weight} 110px ${SERIF}`, color });
const paler = { glass: '#556574', flood: '#ffe2b5', floodK: 0.49, rate: 0.1, pilasterK: 0.63 };
const stone = (color, roof = color, amount = 0.27) => material(color, roof, { flood: '#ffe4bd', floodK: amount, self: 0.07 });

export function buildPlanetHollywood(data, options) {
  const out = model('Planet Hollywood');
  const body = named(data, 'Planet Hollywood Resort and Casino');
  if (!body) return out;
  const glazing = new Soup(), walls = new Soup(), belts = new Soup(), parapets = new Soup(), roofs = new Soup(), metal = new Soup();
  const wings = [body, mapped(data, 249, 627, 80), mapped(data, 249, 744, 80)];
  wings.forEach((b, i) => {
    if (!b) return;
    const ring = own(b, options), h = b.h;
    glazing.walls(ring, 19.8, h - 4.4, WHITE, [h, 6 + i * 12, 1, 0]);
    for (const f of faces(ring, 3.5)) {
      const end = f.length, shell = i ? 2.25 : 3.3;
      const frame = Math.min(end * 0.28, shell);
      along(walls, f, 0, frame, 20, h - 24, 0.94, 0.12);
      along(walls, f, end - frame, end, 20, h - 24, 0.94, 0.12);
      if (end < 12) continue;
      const n = Math.max(2, Math.round((end - 2 * frame) / 6.8));
      for (let k = 1; k < n; k++) {
        const s = frame + k * (end - 2 * frame) / n;
        along(metal, f, s - 0.18, s + 0.18, 20, h - 24, 0.45, 0.18);
      }
    }
    for (const y of (i ? [33, 59] : [34, 61, 87])) {
      belts.walls(offset(ring, 0.28), y, y + 0.82);
    }
    parapets.walls(offset(ring, 0.22), h - 7.1, h - 4.7);
    parapet(parapets, ring, h - 4.6, 3.1, 0.38);
    roofs.cap(ring, h - 4.65);
  });
  const ring = clean(body.pts);
  for (const dir of [[-1, -0.3], [-1, 0.3], [1, 0]]) {
    wordmark(out, ring, dir, 'planet hollywood', 35, 4.4, body.h - 7.7, { font: `700 102px ${SANS}`, color: '#e4eafa' });
  }
  put(out, glazing, facade(MODE.curtainWall, {
    color: '#697f92', glass: '#899bb0', roof: '#adb0b1', glow: '#bb84d5', pilaster: '#b7bbbf', bay: 3.23, rate: 0.087, self: 0.055,
  }), 'Planet Hollywood rounded wing glazing');
  put(out, walls, stone('#d0c6b2', '#b9b2a3'), 'Planet Hollywood sandstone wing blades');
  put(out, belts, stone('#b6ac9b', '#c8c0af'), 'Planet Hollywood intermediate stringcourses');
  put(out, parapets, stone('#c2bba9', '#dad3be', 0.52), 'Planet Hollywood layered coronas');
  put(out, roofs, stone('#727980', '#9b9a93', 0.0), 'Planet Hollywood roof wells');
  put(out, metal, stone('#8c96a0', '#a3a6a8', 0.12), 'Planet Hollywood vertical glazing splits');
  standalonePodium(out, named(data, 'Miracle Mile Shops'), options, stone('#b99d91', '#b4a8a0'));

  const venue = new Soup(), signBand = new Soup(), display = new Soup();
  venue.prism(clean([[191, 648], [219, 631], [226, 645], [214, 658], [197, 670]]), 11.5, 23.3);
  signBand.walls(clean([[191, 648], [219, 631], [226, 645], [214, 658], [197, 670]]), 21.3, 24.3);
  const face = { x: 191, z: 648, ax: 0.48, az: 0.877, nx: -0.877, nz: 0.48 };
  along(display, face, 0.7, 16.4, 13.2, 6.6, 0.32, 0.18);
  put(out, venue, stone('#8c7f87', '#aaa3aa'), 'Planet Hollywood promenade marquee housing');
  put(out, display, material('#313d63', '#3f3d67', { flood: '#cda0ff', self: 0.58 }), 'Planet Hollywood media display');
  put(out, signBand, material('#7e5c81', '#aa97aa', { flood: '#f694ff', self: 0.43 }), 'Planet Hollywood marquee trim');
  out.add(sign('planet hollywood', 16, 2.5, 194.4, 21, 655.7, -0.877, 0.48, { font: `700 95px ${SANS}`, color: '#fff0fb' }));
  out.add(spill(201, 0.45, 711, 115, '#d77cff', 0.2));
  return out;
}

export function buildFlamingo(data, options) {
  const out = model('Flamingo Las Vegas');
  const campus = named(data, out.name);
  if (!campus) return out;
  const windows = new Soup(), main = new Soup(), fin = new Soup(), edge = new Soup(), roofs = new Soup();
  const targets = [[257, 18, 83], [266, -89, 83], [240, -41, 87.2]];
  targets.forEach(([x, z, h], i) => {
    const b = mapped(data, x, z, h, 4);
    if (!b) return;
    const r = own(b, options), H = b.h - 1.1;
    if (i === 2) {
      main.prism(r, campus.h, H);
      return;
    }
    windows.walls(r, campus.h - 0.2, H - 2.7, WHITE, [H, i * 17, 0, campus.h - 0.2]);
    for (const f of faces(r, 5)) {
      const L = f.length, w = Math.min(3.5, L * 0.22);
      along(main, f, 0, w, campus.h, H - campus.h - 2.25, 1.18, 0.55);
      along(main, f, L - w, L, campus.h, H - campus.h - 2.25, 1.18, 0.55);
      const count = Math.floor((L - 2 * w) / 12);
      for (let j = 1; j <= count; j++) {
        const s = w + (L - 2 * w) * j / (count + 1);
        const slab = j % 4 === 0 ? 1.15 : 0.39;
        along(fin, f, s - slab, s + slab, campus.h + 0.1, H - campus.h - 3.1, slab * 0.75 + 0.3, 0.14);
      }
    }
    parapet(edge, r, H - 2.1, 2.4, 0.75);
    roofs.cap(r, H - 2.18);
    const well = inset(r, 1);
    if (well) roofs.prism(well, H - 2.3, H - 1.65);
  });
  put(out, windows, facade(MODE.flamingo, {
    color: '#d1c6cc', glass: '#788bc5', glow: '#fa65b6', floodK: 0.84, bay: 11.3,
  }), 'Flamingo periwinkle and rose curtain wall');
  put(out, main, stone('#cec4b7', '#dcd4c9', 0.37), 'Flamingo broad cream end piers');
  put(out, fin, stone('#beb7b6', '#ddd6ce', 0.2), 'Flamingo champagne vertical mullions');
  put(out, edge, stone('#d1c8ba', '#dcd2c4', 0.27), 'Flamingo inset roof rims');
  put(out, roofs, stone('#b1aba0', '#bdb3a9', 0), 'Flamingo stepped roof wells');
  const script = { font: 'italic 700 127px "Snell Roundhand", "Brush Script MT", Georgia, serif', color: '#ffd0e7' };
  out.add(sign('Flamingo', 29, 5.0, 214.4, 76.6, 8, -1, 0, script));
  out.add(sign('Flamingo', 29, 5.0, 285, 76.4, 71.7, 0, 1, script));

  standalonePodium(out, campus, options, stone('#c4b5ad', '#c2b9bc'));
  const plinth = new Soup(), awnings = new Soup(), lights = new Soup();
  const frontage = mapped(data, 189, -50, 14, 5);
  if (frontage) {
    const r = own(frontage, options);
    // Nearly the entire frontage was also in the main podium at the same height.
    // Retain its 42 m² sliver into the courtyard without drawing a second roof.
    plinth.prism(clean([[217.2, -35.2], [217.3, -17.7], [216.1, 7.7], [216, -43.3]]), 0, frontage.h);
    for (const f of faces(r, 9).filter(f => f.nx < -0.55)) {
      along(plinth, f, 0.4, f.length - 0.4, 11.6, 2.68, 0.85, 0.31);
      along(lights, f, 0.7, f.length - 0.7, 11.76, 0.45, 0.22, 0.86);
      const n = Math.max(1, Math.floor(f.length / 12));
      for (let k = 0; k < n; k++) {
        const s = (k + 0.5) * f.length / n, w = f.length / n * 0.72;
        along(awnings, f, s - w / 2, s + w / 2, 4.0, 0.54, 1.9, 0.7);
      }
    }
  }
  put(out, plinth, stone('#bcb3b6', '#cec4c8'), 'Flamingo casino cornice');
  put(out, awnings, material('#a57b91', '#d8a7b6', { flood: '#ff77b4', self: 0.32 }), 'Flamingo Strip awnings');
  put(out, lights, material('#d277a2', '#f1bfcc', { flood: '#ff75bb', floodK: 0.7, self: 0.62 }), 'Flamingo pink frontage trim');
  out.add(spill(211, 0.44, 17, 108, '#ff79c6', 0.26));
  return out;
}

function italianTower(out, b, options, spec) {
  if (!b) return;
  const ring = own(b, options), top = b.h;
  const walls = new Soup(), pilasters = new Soup(), belts = new Soup(), grand = new Soup(), crown = new Soup(), roof = new Soup();
  const start = top - spec.crownH;
  walls.walls(ring, spec.base, start, WHITE, [start, 21 + top, 0, spec.base]);
  const profile = spec.belts;
  for (const f of faces(ring, 3.7)) {
    const width = Math.min(f.length * 0.38, spec.pier);
    along(pilasters, f, 0, width, spec.base, start - spec.base, 1.2, 0.27);
    along(pilasters, f, f.length - width, f.length, spec.base, start - spec.base, 1.2, 0.27);
    if (f.length < 8) continue;
    const divisions = Math.max(1, Math.round(f.length / spec.section));
    for (let k = 1; k < divisions; k++) {
      const s = k * f.length / divisions;
      along(pilasters, f, s - 0.57, s + 0.57, spec.base + 4.8, start - spec.base - 5, 0.8, 0.32);
    }
  }
  for (const [i, y] of profile.entries()) {
    belts.walls(offset(ring, i % 2 === 0 ? 0.52 : 0.3), y, y + (i % 2 === 0 ? 0.82 : 0.55));
  }
  belts.walls(offset(ring, 0.68), start - 0.7, start + 0.55);
  grand.walls(ring, start, top - 3.1, WHITE, [top - 2.0, 35, 0, start]);
  crown.walls(offset(ring, 0.48), top - 4.2, top - 3.0);
  parapet(crown, ring, top - 2.8, 2.3, 0.64);
  roof.cap(ring, top - 2.9);
  const roofCore = inset(ring, 1.3);
  if (roofCore) roof.prism(roofCore, top - 3.0, top - 1.55);
  if (spec.mark) wordmark(out, ring, [-1, 0], spec.mark, spec.markWidth, 4.4, top - 6.5, serif(spec.letter));
  put(out, walls, facade(MODE.palazzo, {
    ...paler, color: spec.wall, glass: spec.glass ?? paler.glass, bay: spec.bay, roof: spec.roof, pilaster: spec.trim,
  }), b.name + ' paired window bays');
  put(out, pilasters, stone(spec.trim, spec.roof, 0.4), b.name + ' corner pilasters');
  put(out, belts, stone(spec.trim, spec.roof, 0.52), b.name + ' horizontal cornices');
  put(out, grand, facade(MODE.palazzo, {
    ...paler, color: spec.wall, bay: spec.grand, tier: 125, tier0: start, roof: spec.roof, pilaster: spec.trim, glass: spec.glass ?? paler.glass,
  }), b.name + ' upper arcade');
  put(out, crown, stone(spec.trim, spec.roof, 0.4), b.name + ' cap and balustrade');
  put(out, roof, stone(spec.wall, spec.roof, 0.0), b.name + ' recessed roof');
}

const venetian = { wall: '#e0c7a7', trim: '#eadbc1', roof: '#aeb4ad', base: 15.8, bay: 5.4, grand: 7.3, pier: 2.15, section: 17,
  crownH: 14, belts: [23.5, 53.5, 87.7, 117.9], mark: 'THE VENETIAN', letter: '#f0d5a5', markWidth: 47 };

export function buildVenetian(data, options) {
  const out = model('The Venetian');
  italianTower(out, named(data, 'Venetian Tower'), options, venetian);
  italianTower(out, named(data, 'Venezia Tower'), options, {
    ...venetian, wall: '#cdb595', trim: '#e6d5b9', roof: '#ac9d86', belts: [23, 48, 71], crownH: 10.5, mark: '',
  });
  standalonePodium(out, named(data, 'The Venetian Las Vegas'), options, stone('#d3b8a0', '#c6b9a8'));
  out.add(spill(379, 0.45, -562, 125, '#ffdca9', 0.2));
  return out;
}

export function buildPalazzo(data, options) {
  const out = model('The Palazzo');
  italianTower(out, named(data, 'Palazzo Tower'), options, {
    wall: '#c6a482', trim: '#e3ccb0', roof: '#b1a99e', glass: '#646a72', base: 23.5, bay: 6.2, grand: 8.7, pier: 2.6, section: 19.5,
    crownH: 18.5, belts: [34, 67, 97.9, 128.9, 152.7], mark: 'THE PALAZZO', markWidth: 37, letter: '#ffeece',
  });
  standalonePodium(out, named(data, out.name), options, stone('#baa28e', '#c9bbad'));
  const frame = new Soup(), clerestory = new Soup();
  const pavilion = clean([[426, -774], [441, -786], [464, -775], [457, -755], [432, -751]]);
  clerestory.prism(pavilion, 12, 19, WHITE, [19, 19, 0, 0]);
  parapet(frame, pavilion, 19.0, 1.12, 0.3);
  put(out, clerestory, facade(MODE.palazzo, { ...paler, color: '#bfa58f', roof: '#9a948b', bay: 3.6 }), 'Palazzo lower arrival pavilion');
  put(out, frame, stone('#decaad', '#dac8af', 0.42), 'Palazzo arrival crown');
  out.add(spill(443, 0.44, -790, 124, '#ffd391', 0.18));
  return out;
}

function ellipse(x, z, rx, rz, count = 32) {
  return Array.from({ length: count }, (_, i) => {
    const a = i * Math.PI * 2 / count;
    return [x + Math.cos(a) * rx, z + Math.sin(a) * rz];
  });
}

export function buildHardRockHotel(data, options) {
  const out = model('Hard Rock · former Mirage');
  const tower = mapped(data, -58, -566, 102, 5);
  if (!tower) return out;
  const yPlan = own(tower, options), h = tower.h;
  const bronze = new Soup(), lintels = new Soup(), spine = new Soup(), cornice = new Soup(), roof = new Soup(), band = new Soup();
  const low = 15.6, crown = h - 13.2;
  bronze.walls(yPlan, low, crown, WHITE, [h, 28, 0, low]);
  // The retained hotel has long bronze panes tucked between stacked limestone lines.
  for (let y = low + 1.8; y < crown - 0.9; y += 3.32) band.walls(offset(yPlan, 0.17), y, y + 0.66);
  bronze.walls(yPlan, crown + 1.3, h - 2.9, WHITE, [h, 11, 0, crown]);
  lintels.walls(offset(yPlan, 0.48), crown, crown + 1.37);
  lintels.walls(offset(yPlan, 0.41), h - 3.45, h - 1.36);
  for (const f of faces(yPlan, 7.3)) {
    const L = f.length, w = Math.min(L * 0.32, 1.9);
    if (L < 12.5 || f.x < -150 || f.z < -609 || f.z > -499) {
      along(spine, f, 0.1, w, low, h - low - 1.5, 1.15, 0.44);
      along(spine, f, L - w, L - 0.1, low, h - low - 1.5, 1.15, 0.44);
    }
  }
  const core = clean([[-80, -566], [-69, -575], [-54, -571], [-46, -557], [-58, -546], [-75, -549]]);
  spine.prism(core, low, h + 0.9);
  parapet(cornice, yPlan, h - 1.6, 1.8, 0.53);
  roof.cap(yPlan, h - 1.83);
  put(out, bronze, facade(MODE.goldGlass, {
    color: '#b18b59', glass: '#816149', roof: '#bfb29a', glow: '#d9c19b', bay: 3.32, rate: 0.085, self: 0.17,
  }), 'Mirage retained Y-plan bronze elevations');
  put(out, band, stone('#c2b59d', '#c8bca9', 0.33), 'Mirage limestone ribbons');
  put(out, lintels, stone('#d3c6ad', '#e0d4bf', 0.38), 'Mirage upper lintels');
  put(out, spine, stone('#c9bca2', '#d5c7af', 0.34), 'Mirage junction and outer blades');
  put(out, cornice, stone('#cec1aa', '#d5c9b7', 0.32), 'Mirage wraparound parapet');
  put(out, roof, stone('#b9ae9b', '#c8bdad', 0), 'Mirage recessed hotel roof');

  // Kept behind the guitar site. Use separate volumes instead of extruding the
  // whole construction polygon, which also contains operating access roads.
  const podium = new Soup(), terrace = new Soup(), aprons = new Soup(), ribs = new Soup();
  const terraces = [
    [[-193, -612], [-126, -634], [-81, -610], [-76, -549], [-98, -523], [-179, -524]],
    [[-86, -585], [-25, -638], [4, -622], [31, -594], [24, -561], [10, -551], [19, -517], [36, -497], [27, -457], [-32, -439], [-87, -489]],
    [[-193, -526], [-148, -528], [-117, -513], [-106, -464], [-134, -446], [-191, -465]],
    [[-260, -625], [-196, -622], [-192, -550], [-228, -542], [-269, -561]],
  ];
  terraces.forEach((p, i) => {
    const r = clean(p), y = [15.55, 13.8, 10.8, 9.1][i];
    podium.prism(r, 1.3, y - 0.35);
    parapet(terrace, r, y - 0.35, 1.15, 0.26);
    aprons.cap(inset(r, 0.44) || r, y - 0.27);
  });
  put(out, podium, stone('#bbb09d', '#cac0ae'), 'Mirage stepped casino podium');
  put(out, terrace, stone('#cfc1a9', '#e2d3bd'), 'Mirage podium parapets');
  put(out, aprons, stone('#c3b5a1', '#cec0ae', 0), 'Mirage podium roof membranes');

  const x = -6.5, z = -549, ry = 9.8, rx = 15.4, rz = 13.0, y = 14;
  const baseRing = ellipse(x, z, rx + 0.46, rz + 0.46);
  const rotunda = new Soup();
  rotunda.prism(baseRing, y - 0.64, y + 0.48);
  put(out, rotunda, stone('#cbbba2', '#bba68e'), 'Mirage atrium base');
  const glass = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(rx, ry, rz);
  addShape(out, glass, material('#487283', '#6b94a0', { flood: '#a9d8e7', floodK: 0.4, self: 0.26 }), 'Mirage teal glass atrium', x, y + 0.13, z);
  const ribMat = stone('#d9c9b1', '#e0d1bb', 0.42), edge = stone('#48616a', '#536c76', 0.0);
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10;
    const points = Array.from({ length: 11 }, (_, j) => {
      const t = j * Math.PI / 20;
      return new THREE.Vector3(x + (rx + 0.12) * Math.cos(t) * Math.cos(a),
        y + Math.sin(t) * (ry + 0.45), z + (rz + 0.12) * Math.cos(t) * Math.sin(a));
    });
    addShape(out, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.33, 5), ribMat, 'Atrium radial rib', 0, 0, 0);
  }
  for (const t of [0.22, 0.44, 0.65, 0.86, 1.07]) {
    ribs.walls(ellipse(x, z, rx * Math.cos(t) + 0.05, rz * Math.cos(t) + 0.05), y + Math.sin(t) * ry, y + Math.sin(t) * ry + 0.11);
  }
  put(out, ribs, edge, 'Atrium glazing seams');
  out.add(spill(30, 0.45, -544, 100, '#ffdcad', 0.18));
  return out;
}
