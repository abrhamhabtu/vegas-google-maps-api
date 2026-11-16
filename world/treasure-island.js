/** Treasure Island's mapped three-wing tower and Strip-side Sirens' Cove. */
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { displayMaterial, displayRibbon } from './strip-displays.js';
import { SERIF, SANS, Soup, WHITE, centroid, clean, inset, obb, offset, sign, spill } from './hero-kit.js';
import { addShape, along, faces, mapped, material, model, named, own, parapet, put, standalonePodium } from './landmark-forms.js';

const THREE = window.THREE;
const stone = (color, roof = color, floodK = 0.33) => material(color, roof, { flood: '#ffd9c4', floodK });
const warm = (color, glow, glowK) => sheen(color, { refl: 0.13, glow, glowK });

function trimDeck(soup, ring, y, depth, overhang) {
  const rim = offset(ring, overhang);
  soup.walls(rim, y - depth, y);
  soup.skirt(rim, y, ring, y);
  soup.skirt(ring, y - depth, rim, y - depth - 0.012);
}

function tower(out, footprint, options, base) {
  const ring = own(footprint, options), top = footprint.h, spring = top - 13.3;
  const stucco = new Soup(), glass = new Soup(), ribs = new Soup(), rails = new Soup(), trim = new Soup(), lit = new Soup(), roof = new Soup();
  stucco.walls(ring, base, top - 0.65, WHITE, [top, 0, 0, base]);
  const panels = sheen('#63667b', {
    refl: 0.25, spec: 0.59, glow: '#777894', glowK: 0.32,
  });
  for (const f of faces(ring, 0.9)) {
    const { length } = f;
    if (length < 9.5) {
      // The blunt tips have proud, quoined caps instead of scaled room bays.
      if (length > 4.0) {
        const m = length * 0.5;
        along(ribs, f, m - 0.69, m + 0.69, base, top - base - 0.8, 0.78, 0.36);
        for (let y = base + 2; y < spring; y += 8.6) along(trim, f, m - 1.02, m + 1.02, y, 2.2, 1.15, 0.52);
      }
      continue;
    }
    const edge = Math.min(1.85, length * 0.12);
    const n = Math.max(1, Math.round((length - edge * 2) / 6.3)), pitch = (length - edge * 2) / n;
    for (let k = 0; k <= n; k++) {
      const x = edge + k * pitch;
      along(ribs, f, x - 0.41, x + 0.41, base + 0.78, spring - base - 0.64, 0.52, 0.32);
      along(lit, f, x - 0.28, x + 0.28, base + 0.75, spring - base - 1.17, 0.12, 0.615);
      if (k === n) break;
      const end = x + pitch;
      along(glass, f, x + 0.67, end - 0.67, base + 1.1, spring - base - 1.46, 0.12, 0.115);
      const left = x + pitch * 0.17, right = end - pitch * 0.17, y = spring + 1.05;
      // Large blue window recess with a stone hood, visible above the illuminated shoulder.
      along(trim, f, left - 0.48, right + 0.48, y, 8.0, 0.39, 0.14);
      along(glass, f, left, right, y + 0.45, 6.7, 0.1, 0.39);
      along(stucco, f, left - 0.55, right + 0.55, y + 7.58, 0.48, 0.63, 0.39);
    }
    for (let y = base + 9.65; y < spring - 3.0; y += 9.65) {
      along(rails, f, 0.0, length, y, 0.51, 0.71, 0.34);
    }
  }
  trimDeck(trim, ring, spring + 0.60, 1.0, 0.73);
  trimDeck(trim, ring, top + 0.12, 0.94, 0.82);
  trimDeck(lit, ring, spring - 0.07, 0.29, 0.86);
  trimDeck(lit, ring, top - 0.57, 0.31, 0.96);
  roof.cap(offset(ring, 0.61), top - 0.22);
  for (const f of faces(ring, 5.7).filter(f => f.length < 11)) {
    const mid = f.length * 0.5;
    along(roof, f, mid - 3.1, mid + 3.1, top - 0.23, 1.55, 5.8, -1.4);
    along(trim, f, mid - 3.6, mid + 3.6, top + 1.15, 0.36, 6.6, -1.4);
  }
  for (const [text, near] of [['TREASURE', [270, -922]], ['ISLAND', [274, -967]]]) {
    const f = faces(ring, 17).filter(f => f.nx > 0.3)
      .sort((a, b) => midDistance(a, near) - midDistance(b, near))[0];
    if (!f) continue;
    const m = f.length * 0.5;
    out.add(sign(text, Math.min(35, f.length * 0.9), 5.3,
      f.x + f.ax * m + f.nx * 0.73, top - 2.6, f.z + f.az * m + f.nz * 0.73, f.nx, f.nz,
      { font: `700 142px ${SERIF}`, color: '#fff1dc' }));
  }
  put(out, stucco, stone('#b37c6c', '#846668', 0.69), 'Coral tower and crown');
  put(out, glass, panels, 'Inset slate window bays');
  put(out, rails, stone('#b08270', '#a7857e', 0.50), 'Coral floor bands');
  put(out, ribs, stone('#e0bdb1', '#a99ca2', 0.71), 'Cream pilasters');
  put(out, trim, stone('#ead4c8', '#c5b9be', 0.48), 'Roof cornices and crown window surrounds');
  put(out, lit, warm('#d5b9ad', '#ffdec9', 0.96), 'Uplit pilaster edges and cornice lines');
  put(out, roof, stone('#aca7ad', '#95949e', 0.05), 'Three-wing roof and end caps');
}

const midDistance = ({ x, z, ax, az, length }, target) =>
  Math.hypot(x + ax * length * 0.5 - target[0], z + az * length * 0.5 - target[1]);

function cove(out, data, options, basin) {
  const water = new Soup(), shore = new Soup(), walkway = new Soup(), rails = new Soup();
  water.cap(basin, 0.17);
  const cap = offset(basin, 0.31);
  shore.walls(cap, 0.04, 0.65);
  shore.skirt(cap, 0.65, basin, 0.65);
  const crossing = data.walks.find(w => w.id === 34009342);
  if (crossing) {
    const [a, b] = [crossing.pts[0], crossing.pts.at(-1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), ax = dx / length, az = dz / length;
    walkway.box((a[0] + b[0]) / 2, 0.62, (a[1] + b[1]) / 2, length, 0.46, 5.95, ax, az);
    for (const side of [-1, 1]) {
      const x = a[0] - az * 2.8 * side, z = a[1] + ax * 2.8 * side;
      rails.box(x + dx / 2, 1.96, z + dz / 2, length, 0.16, 0.15, ax, az);
      for (let s = 1; s < length; s += 3.2) rails.box(x + ax * s, 1.08, z + az * s, 0.16, 0.91, 0.16);
    }
  }
  put(out, water, sheen('#245279', { live: 'water', refl: 0.26, spec: 0.8, glow: '#3462b9', glowK: 0.19 }), 'Mapped Sirens’ Cove lagoon');
  put(out, shore, stone('#99908a'), 'Lagoon coping');
  put(out, walkway, stone('#ad8367', '#c3a287', 0.20), 'Boardwalk between the two ships');
  put(out, rails, stone('#795750'), 'Boardwalk railings');

  const hulls = new Soup(), carved = new Soup(), decks = new Soup(), lamps = new Soup(), timber = new Soup();
  for (const footprint of data.buildings.filter(b => b.b === 'ship' && b.pts.every(([x, z]) => x > 340 && x < 406 && z > -960 && z < -886))) {
    const ring = own(footprint, options), mid = centroid(ring), { ax, az, w } = obb(ring), y = footprint.h - 0.62;
    const red = mid[0] > 370;
    const underwater = inset(ring, 0.88) ?? ring;
    hulls.skirt(underwater, 0.16, ring, y, new THREE.Color(red ? '#955351' : '#7d5d4a'));
    decks.prism(ring, y - 0.1, y + 0.25);
    parapet(carved, ring, y + 0.20, 0.92, 0.19);
    trimDeck(lamps, ring, y + 0.32, 0.13, 0.28);
    for (const f of faces(ring, 3.8)) {
      for (let s = 1.2; s < f.length - 0.65; s += 2.05) along(carved, f, s, s + 0.32, y - 1.1, 0.74, 0.48, 0);
    }
    for (const [j, s] of [-0.29, -0.015, 0.27].entries()) {
      const x = mid[0] + s * w * ax, z = mid[1] + s * w * az, h = y + [10.1, 14.2, 10.9][j];
      timber.box(x, y, z, 0.52, h - y, 0.52, ax, az);
      for (const floor of [h - 4.7, h - 7.25]) {
        timber.box(x, floor, z, 0.35, 0.25, floor === h - 4.7 ? 4.65 : 5.85, ax, az);
        lamps.box(x, floor + 0.13, z, 0.22, 0.13, floor === h - 4.7 ? 4.65 : 5.85, ax, az);
      }
      addShape(out, new THREE.CylinderGeometry(1.18, 0.74, 0.86, 8), stone('#61525b'), 'Crow’s nest', x, h - 2.9, z);
      addShape(out, new THREE.CylinderGeometry(1.19, 1.13, 0.12, 8), warm('#bfb6bd', '#dce8ff', 0.62), 'Crow’s nest edge', x, h - 2.44, z);
    }
  }
  put(out, hulls, stone('#c6a49d'), 'Two flared pirate ship hulls');
  put(out, decks, stone('#796357', '#a08975'), 'Open timber decks');
  put(out, carved, stone('#62545e', '#967b78'), 'Ships’ bulwarks and gun ports');
  put(out, timber, stone('#a39c9a', '#a39c9a'), 'Masts and yards');
  put(out, lamps, warm('#c6bac4', '#cbdcff', 0.89), 'Cool ship lighting');
}

function frontage(out, data, engine) {
  const stores = new Soup(), roof = new Soup(), trim = new Soup(), light = new Soup(), signFrame = new Soup();
  for (const [x, z] of [[397, -978], [370, -959]]) {
    const b = mapped(data, x, z, 7, 9);
    if (!b) continue;
    const ring = clean(b.pts);
    parapet(trim, ring, b.h + 0.08, 0.61, 0.2);
    const insetRoof = inset(ring, 1.65);
    if (insetRoof) roof.prism(insetRoof, b.h - 0.12, b.h + 0.25);
    for (const f of faces(ring, 6.5).filter(f => f.nx > 0.19)) {
      const n = Math.max(1, Math.round(f.length / 4.8)), pitch = f.length / n;
      for (let i = 0; i < n; i++) {
        along(stores, f, i * pitch + 0.39, (i + 1) * pitch - 0.39, 0.96, 4.5, 0.20, 0.14);
        along(light, f, i * pitch + 0.42, (i + 1) * pitch - 0.42, 5.71, 0.12, 0.27, 0.21);
      }
    }
  }
  // Cylindrical LED screen on the spring-mountain corner of the mapped shop.
  const hx = 412, hz = -998.3, arc = (r, a) => [hx + Math.cos(a) * r, hz + Math.sin(a) * r];
  const sweep = Array.from({ length: 37 }, (_, i) => -1.35 + i * 2.83 / 36);
  const cabinet = clean([...sweep.map(a => arc(11.81, a)), ...sweep.toReversed().map(a => arc(9.72, a))]);
  signFrame.prism(cabinet, 8.07, 23.55);
  const base = clean([...sweep.map(a => arc(11.57, a)), ...sweep.toReversed().map(a => arc(8.89, a))]);
  stores.prism(base, 2.0, 8.07);
  trimDeck(signFrame, cabinet, 23.56, 0.26, 0.088);
  put(out, signFrame, stone('#292e35', '#535359'), 'Treasure Island curved display housing and coping');
  const display = model('Treasure Island CVS corner display');
  const art = displayMaterial(display, engine, display.name, 2.28,
    ['pit-lights', 'shows', 'desert-miles', 'waymo', 'neon-market', 'zoox'], { duration: 9.1 });
  displayRibbon(display, art, sweep.toReversed().map(a => arc(11.90, a)), 8.42, 23.22);
  out.add(display);
  put(out, roof, stone('#aca0a8', '#bdb7b8', 0.1), 'Stepped waterfront roofs');
  put(out, trim, stone('#d1ae9b', '#afa6ae', 0.45), 'Waterfront parapets');
  put(out, stores, warm('#6d605d', '#eac391', 0.47), 'Lagoon storefronts');
  put(out, light, warm('#d5b79f', '#ffca94', 0.75), 'Lagoon storefront light strips');

  // Strip pylon, set back from the south end of the lagoon and the crosswalk.
  const pylon = new Soup(), panel = new Soup(), pylonLights = new Soup();
  const [x, z] = [342.3, -855.9], ax = -0.52, az = 0.854, nx = az, nz = -ax;
  for (const s of [-4.1, 4.1]) pylon.box(x + ax * s, 0.21, z + az * s, 2.45, 16.5, 2.47, ax, az);
  pylon.box(x, 10.3, z, 15.8, 8.3, 2.8, ax, az);
  pylon.box(x, 24, z, 12.6, 12.1, 2.3, ax, az);
  for (const side of [-1, 1]) {
    panel.box(x + side * 1.37 * nx, 11.35, z + side * 1.37 * nz, 14.7, 6.23, 0.15, ax, az);
    panel.box(x + side * 1.27 * nx, 25.18, z + side * 1.27 * nz, 10.4, 9.91, 0.25, ax, az);
    out.add(sign('ti', 10.25, 11.7, x + nx * side * 1.48, 31.5, z + nz * side * 1.48, nx * side, nz * side,
      { font: `italic 900 225px ${SANS}`, color: '#9cddff', maxWidth: 0.84 }));
  }
  for (const y of [20.1, 21.56, 23.08]) pylonLights.box(x, y, z, 17.4 - (y - 20.1) * 1.11, 0.47, 2.82, ax, az);
  put(out, pylon, stone('#74627a', '#8c7b87', 0.42), 'Treasure Island pylon structure');
  put(out, panel, warm('#c29046', '#ffe172', 1.1), 'Yellow marquee panels');
  put(out, pylonLights, warm('#c5977e', '#ffaa7f', 0.9), 'Pylon neon trim');
  out.add(spill(x, 0.39, z, 30, '#ffc991', 0.26));
}

function casinoRoofs(out, y) {
  const decks = new Soup(), trim = new Soup(), penthouses = new Soup();
  // The low casino roofs below all three wings sit inside the podium outline.
  const islands = [
    [[282, -877], [288, -861], [315, -866], [333, -875], [321, -890], [291, -899]],
    [[310, -912], [327, -907], [338, -923], [329, -935], [316, -934], [308, -925]],
    [[289, -983], [302, -971], [325, -984], [319, -1005], [303, -1007]],
    [[158, -917], [217, -917], [228, -905], [158, -911]],
  ];
  for (const [i, points] of islands.entries()) {
    const ring = clean(points), h = y + [3.4, 1.35, 1.83, 1.8][i];
    decks.prism(ring, y - 0.06, h);
    parapet(trim, ring, h, 0.63, 0.22);
  }
  penthouses.box(315.6, y + 1.2, -923.8, 10.7, 1.82, 5.95, 0.88, 0.475);
  penthouses.box(306, y + 1.77, -989, 9.2, 2.25, 8.65, 0.9, 0.436);
  penthouses.box(299, y + 3.38, -874.5, 6.16, 1.9, 4.5, 0.923, 0.385);
  put(out, decks, stone('#9b8f97', '#aaa5b3', 0.23), 'Stepped casino roof terraces');
  put(out, trim, stone('#b39d9d', '#b2a9b1', 0.47), 'Tiered casino parapets');
  put(out, penthouses, stone('#a09ba6', '#aca6af', 0.21), 'Hotel service housings');
}

export function buildTreasureIsland(data, options, engine) {
  const out = model('Treasure Island');
  const podium = named(data, 'Treasure Island Hotel and Casino');
  const found = mapped(data, 243, -944, 112, 12);
  if (found) tower(out, found, options, podium?.h ?? 14);
  standalonePodium(out, podium, options, stone('#ad897d', '#9a929e'));
  if (podium) casinoRoofs(out, podium.h);
  const lagoon = data.areas.find(a => a.k === 'water' && a.pts.every(([x, z]) => x > 339 && x < 414 && z > -973 && z < -886));
  if (lagoon) cove(out, data, options, clean(lagoon.pts));
  for (const [x, z, h] of [[397, -978, 7], [370, -959, 7]]) {
    standalonePodium(out, mapped(data, x, z, h, 9), options, stone('#a58075', '#9c8e93'));
  }
  frontage(out, data, engine);
  out.add(spill(310, (podium?.h ?? 14) + 0.055, -935, 82, '#ebc6d4', 0.23));
  return out;
}
