/** The adjacent Italian resorts retain separate landmarks and mapped envelopes. */
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { MODE, SERIF, Soup, WHITE, centroid, clean, facade, inset, offset, spill } from './hero-kit.js';
import { addShape, along, faces, mapped, material, model, named, own, parapet, put, standalonePodium, wordmark } from './landmark-forms.js';

const THREE = window.THREE;
const gold = '#ffe2b0', ivory = '#e8d7bc', roofColor = '#aaa7a5';
const stone = (color, { roof = roofColor, flood = 0.36, self = 0.06 } = {}) =>
  material(color, roof, { flood: gold, floodK: flood, self });
const glow = (color, glowK) => sheen(color, { glow: gold, glowK, refl: 0.07 });
const serif = { font: `700 155px ${SERIF}`, color: '#fff0d5' };
const at = (f, s, shift = 0) => [f.x + f.ax * s + f.nx * shift, f.z + f.az * s + f.nz * shift];

function molding(soup, ring, y, tall, depth) {
  const lip = offset(ring, depth);
  soup.walls(lip, y - tall, y);
  soup.skirt(lip, y, ring, y);
}

// Reset the cadence on each wall. On the short return a pair of bays
// is centered just as deliberately as the long ranks along the Strip.
function bayFace(soup, f, y0, y1, bay, arched, seed, shift = 0, margin = 0.1, count = null) {
  const usable = f.length - 2 * margin;
  if (usable < 0.75 || y1 - y0 < 0.2) return;
  const [x, z] = at(f, margin, shift), [X, Z] = at(f, f.length - margin, shift);
  const normal = [f.nx, 0, f.nz], aux = [y1, seed, Number(arched), y0];
  const u = (count ?? Math.max(1, Math.round(usable / bay))) * bay;
  const a = soup.vert(x, y0, z, normal, 0, WHITE, aux);
  const b = soup.vert(X, y0, Z, normal, u, WHITE, aux);
  const c = soup.vert(X, y1, Z, normal, u, WHITE, aux);
  const d = soup.vert(x, y1, z, normal, 0, WHITE, aux);
  soup.idx.push(a, c, b, a, d, c);
}

const venetian = {
  wall: '#ddc5a5', glass: '#546576', base: 15.92, bay: 3.55, pilaster: 0.51, crown: 16.2,
  belts: [[29, 0.64, 0.42], [69, 0.38, 0.25], [112, 0.52, 0.33]], light: 0.64,
};
const venezia = {
  ...venetian, wall: '#cfb59a', glass: '#5e6e79', bay: 4.0, crown: 12.8, light: 0.51,
  belts: [[23, 0.86, 0.52], [48, 0.46, 0.31], [72, 0.55, 0.38]],
};
const palazzo = {
  wall: '#c5a685', glass: '#3e505e', base: 23.9, bay: 6.05, pilaster: 0.82, crown: 24.1,
  belts: [[68.8, 1.42, 0.70], [86.7, 2.63, 1.0], [90.9, 0.75, 0.55], [163.3, 0.74, 0.46]],
  light: 0.92,
};

function tower(out, b, options, spec, kind) {
  if (!b) return null;
  const ring = own(b, options), top = b.h, crown = top - spec.crown;
  const wall = new Soup(), windows = new Soup(), attic = new Soup(), shafts = new Soup(), cornice = new Soup();
  const rim = new Soup(), roof = new Soup(), uplight = new Soup();
  wall.walls(ring, spec.base, top - 0.62, WHITE, [top, 0, 0, spec.base]);
  for (const [i, f] of faces(ring, 3.5).entries()) {
    const margin = Math.min(f.length * 0.13, kind === 'palazzo' ? 1.13 : 0.59);
    const count = Math.max(1, Math.round((f.length - margin * 2) / spec.bay));
    const bay = (f.length - margin * 2) / count;
    bayFace(windows, f, spec.base + 0.12, crown - 0.3, spec.bay, false, 3 + i, 0.095, margin, count);
    bayFace(attic, f, crown + 0.3, top - 3.45, spec.bay, kind !== 'palazzo', 19 + i, 0.105, margin, count);
    for (let j = 0; j <= count; j++) {
      const s = margin + j * bay, end = j === 0 || j === count;
      const r = end ? Math.min(0.85, margin) : spec.pilaster * 0.5;
      along(shafts, f, s - r, s + r, spec.base, crown - spec.base - 0.04, end ? 1.45 : 0.92, 0.42);
      along(shafts, f, s - r, s + r, crown + 0.65, spec.crown - 3.32, 0.79, 0.27);
      if (end || f.nx < 0.36) {
        for (const y of kind === 'palazzo' ? [spec.base + 0.29, 90.96, crown + 0.4] : [spec.base + 0.26, crown + 0.45]) {
          along(uplight, f, s - r * 0.58, s + r * 0.58, y, 2.15, 0.12, end ? 1.18 : 0.94);
        }
      }
    }
  }
  for (const [y, height, lip] of spec.belts) molding(cornice, ring, y, height, lip);
  molding(cornice, ring, crown + 0.62, 1.47, 0.83);
  molding(cornice, ring, top - 2.4, 1.05, 0.88);
  molding(rim, ring, top - 2.68, 0.17, 0.96);
  molding(rim, ring, crown + 0.02, 0.16, 0.86);
  parapet(cornice, ring, top - 2.4, 1.82, 0.64);
  roof.cap(ring, top - 2.48);
  const plant = inset(ring, 3.2);
  if (plant) {
    roof.prism(plant, top - 2.5, top - 1.36);
    const profile = inset(plant, 3.5);
    if (profile) roof.prism(profile, top - 1.4, top);
  }
  const panel = (arched, floodK) => facade(MODE.arcade, {
    color: spec.wall, glass: spec.glass, bay: spec.bay, pilasterW: arched ? 0.27 : 0.23, flood: gold,
    floodK, rate: arched ? 0.06 : 0.095, roof: roofColor,
  });
  put(out, wall, stone(spec.wall), b.name + ' masonry envelope');
  put(out, windows, panel(false, spec.light * 0.65), b.name + ' aligned room bays');
  put(out, attic, panel(kind !== 'palazzo', spec.light), b.name + ' crown window arcade');
  put(out, shafts, stone(ivory, { flood: spec.light, self: spec.light * 0.24 }), b.name + ' projecting pilasters');
  put(out, cornice, stone(ivory, { flood: 0.52 }), b.name + ' shadow cornices');
  put(out, rim, glow('#cbb48c', 0.67), b.name + ' crown lighting');
  put(out, uplight, glow('#cbb78f', 0.69), b.name + ' pilaster uplights');
  put(out, roof, stone('#aeaaa4', { flood: 0.04 }), b.name + ' parapet wells');
  return ring;
}

function palazzoSign(out) {
  const face = new Soup(), insetFace = new Soup(), cap = new Soup(), seams = new Soup();
  // The north wing's wide end faces Spring Mountain Road.
  const [x, z] = [620.75, -944.2], ax = 1, az = 0, nx = az, nz = -ax;
  face.box(x, 24.0, z, 19.2, 147.6, 9.0, ax, az);
  const xo = x + nx * 4.60, zo = z + nz * 4.60;
  insetFace.box(xo, 91.6, zo, 14.3, 75.3, 0.36, ax, az, WHITE, [167, 0, 0, 92]);
  for (const s of [-8.15, 8.15]) {
    face.box(x + s * ax + nx * 4.26, 24.0, z + s * az + nz * 4.26, 1.10, 147.9, 1.42, ax, az);
    seams.box(xo + s * ax + nx * 0.66, 28, zo + s * az + nz * 0.66, 0.16, 58.8, 0.13, ax, az);
  }
  for (const [y, h] of [[68.6, 1.15], [84.6, 2.54], [90, 0.89], [170.9, 0.87]])
    cap.box(xo - nx * 1.99, y, zo - nz * 1.99, 20.3, h, 5.3, ax, az);
  const lettering = document.createElement('canvas');
  lettering.width = 256;
  lettering.height = 1536;
  const ink = lettering.getContext('2d');
  ink.font = `700 194px ${SERIF}`;
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.fillStyle = '#fff1d6';
  for (const [i, glyph] of [...'PALAZZO'].entries()) ink.fillText(glyph, 128, (i + 0.5) * lettering.height / 7);
  const texture = new THREE.CanvasTexture(lettering);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const letters = addShape(out, new THREE.PlaneGeometry(12.8, 63),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.08, depthWrite: false }),
    'Vertical PALAZZO lettering', xo + nx * 0.30, 131.2, zo + nz * 0.30);
  letters.rotation.y = Math.atan2(nx, nz);
  put(out, face, stone('#c8aa84', { flood: 0.74 }), 'Palazzo stone sign blade');
  put(out, insetFace, stone('#c4a680', { flood: 0.74, self: 0.24 }), 'Vertical sign recess');
  put(out, cap, stone(ivory, { flood: 0.67 }), 'Stone blade belt courses');
  put(out, seams, glow('#c8a47b', 0.78), 'Sign blade uplight channels');
}

function grounds(out, data, options, footprint, kind) {
  if (!footprint) return;
  const ring = clean(footprint.pts), h = footprint.h;
  standalonePodium(out, footprint, options, stone(kind === 'palazzo' ? '#b7a08a' : '#cdb59b'));
  const trim = new Soup(), arcades = new Soup(), mechanical = new Soup(), groundWater = new Soup(), basins = new Soup();
  parapet(trim, ring, h + 0.08, kind === 'palazzo' ? 1.05 : 0.62, 0.21);
  if (kind === 'palazzo') {
    for (const [i, f] of faces(ring, 6.3).entries()) {
      if (f.nx > -0.32 || f.x > 520) continue;
      bayFace(arcades, f, 6.3, h - 2.0, 5.3, true, i + 5, 0.28, 0.31);
      along(trim, f, 0.2, f.length - 0.2, h - 2.1, 0.65, 0.91, 0.43);
    }
    for (const area of data.areas) {
      if (area.k !== 'water' || !area.pts.every(([x, z]) => x > 479 && x < 593 && z > -960 && z < -783)) continue;
      const pool = clean(area.pts), edge = offset(pool, 0.48);
      groundWater.cap(pool, h + 0.5);
      basins.walls(edge, h + 0.1, h + 0.68);
      basins.skirt(edge, h + 0.68, pool, h + 0.68);
    }
    // Pavilion roofs sit behind the Spring Mountain and Strip frontages.
    for (const [x, z, width, depth] of [[494, -967, 10, 12], [501, -944, 14, 12], [483, -905, 12, 13]]) {
      mechanical.box(x, h - 0.08, z, width, 1.54, depth, 0.483, -0.876);
    }
  }
  put(out, trim, stone('#d8c5ad'), footprint.name + ' podium cornices');
  put(out, arcades, facade(MODE.arcade, { color: '#cbb497', glass: '#625d56', bay: 5.3, floodK: 0.83, rate: 0.16,
    roof: roofColor }), 'Palazzo street arcades');
  put(out, mechanical, stone('#a6a298', { flood: 0.03 }), 'Palazzo terrace pavilions');
  put(out, basins, stone('#bcaf9e'), 'Rooftop pool surrounds');
  put(out, groundWater, sheen('#3c9199', { live: 'water', glow: '#62ccdb', glowK: 0.39 }), 'Palazzo mapped pools');
}

function outlineArch(soup, f, x, spring, radius, width, shift, pointed = false) {
  const normal = [f.nx, 0, f.nz], aux = [spring, 0, 0, 0];
  let last;
  for (let i = 0; i <= 12; i++) {
    const angle = Math.PI - i * Math.PI / 12, unit = Math.cos(angle);
    const height = pointed ? Math.pow(Math.max(0, 1 - Math.abs(unit)), 0.68) * 1.25 : Math.sin(angle);
    const vertices = [radius, radius + width].map(r => {
      const [X, Z] = at(f, x + r * unit, shift);
      return soup.vert(X, spring + r * height, Z, normal, 0, WHITE, aux);
    });
    if (last) soup.idx.push(last[0], vertices[1], vertices[0], last[0], last[1], vertices[1]);
    last = vertices;
  }
}

function canalFrontage(out, data, podium, options) {
  const water = new Soup(), coping = new Soup(), colonnades = new Soup(), panels = new Soup(), frieze = new Soup(), tiles = new Soup();
  const arcadeRoof = new Soup(), terrace = new Soup();
  const basins = data.areas.filter(a => a.k === 'water' && (
    a.pts.every(([x, z]) => x >= 315 && x < 388 && z > -730 && z < -615) ||
    a.pts.every(([x, z]) => x > 276 && x < 315 && z > -611 && z < -586)));
  for (const basin of basins) {
    const ring = clean(basin.pts), lip = offset(ring, 0.36);
    water.cap(ring, 0.16);
    coping.walls(lip, 0.13, 0.52);
    coping.skirt(lip, 0.52, ring, 0.52);
  }
  if (podium) {
    const mall = data.areas.find(a => a.name === 'Grand Canal Shoppes' && a.pts.every(([x, z]) => x > 356 && x < 410 && z > -705 && z < -625));
    const canalWall = (mall ?? podium).pts.filter(([x, z]) => x > 362 && x < 368 && z > -699 && z < -630)
      .sort((a, b) => b[1] - a[1]);
    const [f] = canalWall.length < 2 ? [] : faces([canalWall[0], canalWall.at(-1)], 40);
    if (f) {
      if (mall) {
        const outline = clean(mall.pts);
        arcadeRoof.prism(outline, podium.h - 0.05, 24.63);
        parapet(colonnades, outline, 24.61, 0.85, 0.27);
        const inner = inset(outline, 4.5);
        if (inner) terrace.prism(inner, 24.53, 25.56);
      }
      const count = 14, pitch = f.length / count;
      along(frieze, f, 0, f.length, 15.4, 9.37, 2.1, 0);
      along(frieze, f, -0.36, f.length + 0.36, 8.78, 0.58, 2.47, 0.5);
      along(frieze, f, -0.46, f.length + 0.46, 24.48, 0.66, 2.74, 0.4);
      for (const [i, y] of [0.54, 9.36].entries()) {
        bayFace(panels, f, y, i === 0 ? 8.91 : 15.24, pitch, true, 7 + i, 0.49, 0, count);
        for (let j = 0; j < count; j++) {
          const s = (j + 0.5) * pitch, r = pitch * 0.34, sh = i === 0 ? 5.76 : 12.42;
          along(colonnades, f, s - r - 0.21, s - r + 0.24, y, sh - y + 0.09, 0.82, 0.85);
          along(colonnades, f, s + r - 0.24, s + r + 0.21, y, sh - y + 0.09, 0.82, 0.85);
          outlineArch(colonnades, f, s, sh, r, 0.29, 1.34, i === 1);
        }
      }
      for (let j = 0.8; j < f.length - 0.6; j += 1.52) {
        along(colonnades, f, j - 0.37, j + 0.39, 25.08, 0.90, 1.0, 1.05);
        for (let k = 0; k < 4; k++) {
          const y = 16.57 + k * 1.99, s = j + (k % 2 ? 0.76 : 0);
          if (s + 0.68 >= f.length) continue;
          const vertices = [[s - 0.68, y], [s, y - 0.86], [s + 0.68, y], [s, y + 0.86]].map(([u, H]) => {
            const [x, z] = at(f, u, 1.065);
            return tiles.vert(x, H, z, [f.nx, 0, f.nz], 0, WHITE, [25, 0, 0, 16]);
          });
          tiles.idx.push(vertices[0], vertices[2], vertices[1], vertices[0], vertices[3], vertices[2]);
        }
      }
    }
  }
  put(out, water, sheen('#418396', { live: 'water', glow: '#4f9fb2', glowK: 0.28, spec: 0.77 }), 'Mapped Grand Canal');
  put(out, coping, stone('#c2bfb2'), 'Canal retaining walls');
  put(out, arcadeRoof, stone('#c4aaa0', { roof: '#b1aca5' }), 'Canal arcade pavilion shell');
  put(out, terrace, stone('#b3a69a', { flood: 0.10 }), 'Canal arcade roof terrace');
  put(out, panels, facade(MODE.arcade, { color: '#d3bfa4', glass: '#5f5754', bay: 4.7, floodK: 1.28, rate: 0.11 }),
    'Doge’s Palace arcade recesses');
  put(out, colonnades, stone('#ead8bb', { flood: 0.87 }), 'Doge’s Palace paired columns and traceries');
  put(out, frieze, stone('#d1aaa0', { flood: 0.54 }), 'Rose marble curtain and upper ledge');
  put(out, tiles, stone('#e4cec0', { flood: 0.53 }), 'Doge’s Palace diamond pattern');
  const landing = mapped(data, 310, -583, 5, 7);
  if (landing) {
    standalonePodium(out, landing, options, stone('#d4b89b'));
    const cornice = new Soup();
    molding(cornice, clean(landing.pts), 5.25, 0.66, 0.24);
    put(out, cornice, stone(ivory), 'Canal bridge stair landing');
  }
}

function campanile(out, data, options) {
  const b = named(data, 'The Campanile');
  if (!b) return;
  const [x, z] = centroid(own(b, options)), ax = 0.991, az = -0.134, H = b.h;
  const square = size => clean([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) =>
    [x + (a * ax - b * az) * size / 2, z + (a * az + b * ax) * size / 2]));
  const brick = new Soup(), cream = new Soup(), apertures = new Soup(), green = new Soup(), gilded = new Soup();
  const shaft = square(13.4), cloister = square(12.6), base = 3.3;
  brick.prism(shaft, base, H - 31.8);
  cream.prism(square(15.6), 0.22, base);
  for (const f of faces(shaft)) {
    for (const s of [1.03, 6.7, 12.37]) along(brick, f, s - 0.23, s + 0.23, base, H - 36, 0.67, 0.32);
  }
  for (const [y, w, h] of [[H-33.45, 14.66, 1.12], [H-31.91, 15.24, 1.27], [H-20.76, 15.15, 1.35],
    [H-19.36, 15.8, 1.22], [H-15.32, 14.93, 0.94]]) cream.prism(square(w), y, y + h);
  cream.prism(square(13.15), H - 20.3, H - 14.35);
  for (const f of faces(cloister)) {
    const spring = H - 25.6, low = H - 30.67;
    bayFace(apertures, f, low, H - 20.88, 4.2, true, 2, 0, 0);
    for (const s of [0, 4.2, 8.4, 12.6]) along(cream, f, s - 0.38, s + 0.38, low, 8.76, 0.95, 0.35);
    for (const s of [2.1, 6.3, 10.5]) outlineArch(cream, f, s, spring, 1.69, 0.46, 0.71);
  }
  green.skirt(square(13.8), H - 14.38, square(1.43), H - 3.81);
  green.prism(square(1.6), H - 3.81, H - 3.45);
  gilded.box(x, H - 3.58, z, 0.81, 3.32, 0.58);
  gilded.box(x, H - 1.9, z, 2.38, 0.42, 0.32, ax, az);
  put(out, brick, stone('#9a5240', { flood: 0.54 }), 'Campanile brick shaft');
  put(out, cream, stone('#ebddc4', { flood: 0.84, self: 0.20 }), 'Campanile pale belfry');
  put(out, apertures, facade(MODE.arcade, { color: '#cdbc9e', glass: '#47423f', bay: 4.2, floodK: 0.68, rate: 0.14 }),
    'Campanile arched openings');
  put(out, green, stone('#577c70', { roof: '#66897f', flood: 0.15 }), 'Campanile copper spire');
  put(out, gilded, glow('#b99449', 0.24), 'Gilded Campanile finial');
}

export const isRialtoBridge = w => w.name === 'Rialto Bridge' && w.pts.length > 1;

function rialto(out, data) {
  const walk = data.walks.find(isRialtoBridge);
  if (!walk) return;
  const [a, b] = [walk.pts[0], walk.pts.at(-1)];
  const dx = b[0] - a[0], dz = b[1] - a[1], span = Math.hypot(dx, dz);
  const f = { x: a[0], z: a[1], ax: dx / span, az: dz / span, nx: dz / span, nz: -dx / span, length: span };
  const shell = new Soup(), deck = new Soup(), rail = new Soup(), piers = new Soup();
  const firstY = walk.y?.[0] ?? 6.8, lastY = walk.y?.at(-1) ?? firstY;
  const top = t => firstY + (lastY - firstY) * t + 3.58 * Math.sin(Math.PI * t) ** 0.78;
  const arch = t => Math.max(5.7, 8.02 - 14.6 * (t - 0.5) ** 2);
  // End piers stay with the landings. A continuous arched underside carries
  // the steps over the existing valet/service lanes.
  for (let i = 0; i < 27; i++) {
    const t = i / 27, u = (i + 1) / 27, p = t * span, q = u * span;
    const y = top(t), Y = top(u), low = Math.min(y - 0.53, arch(t)), high = Math.min(Y - 0.53, arch(u));
    along(deck, f, p, q + 0.025, (y + Y) / 2 - 0.24, 0.30, 8.63);
    const underside = [];
    for (const side of [-1, 1]) {
      const normal = [side * f.nx, 0, side * f.nz], r = side * 4.24;
      const section = [[p, low], [q, high], [q, Y], [p, y]].map(([s, h]) => {
        const [x, z] = at(f, s, r);
        return shell.vert(x, h, z, normal, s, WHITE, [Y, 0, 0, 0]);
      });
      if (side > 0) shell.idx.push(section[0], section[2], section[1], section[0], section[3], section[2]);
      else shell.idx.push(section[0], section[1], section[2], section[0], section[2], section[3]);
      const [x0, z0] = at(f, p, r), [x1, z1] = at(f, q, r);
      const dr = high - low, len = Math.hypot(dr, q - p);
      const n = [dr / len * f.ax, -(q - p) / len, dr / len * f.az];
      underside.push(shell.vert(x0, low, z0, n, 0, WHITE, [1, 0, 0, 0]), shell.vert(x1, high, z1, n, 0, WHITE, [1, 0, 0, 0]));
      if (i % 2 === 0) along(rail, f, p + 0.45, p + 0.72, y, 1.42, 0.38, r);
      along(rail, f, p, q + 0.035, (y + Y) / 2 + 1.20, 0.29, 0.65, r);
    }
    shell.idx.push(underside[0], underside[1], underside[3], underside[0], underside[3], underside[2]);
  }
  for (const [end, height] of [[0, firstY], [span - 3.4, lastY]])
    along(piers, f, end, end + 3.4, 0.21, height - 0.42, 8.48);
  put(out, shell, stone('#d4c5ad', { flood: 0.50 }), 'Rialto arch and soffit');
  put(out, deck, stone('#e0cdb6'), 'Rialto pedestrian steps');
  put(out, rail, stone('#e8dac3', { flood: 0.66 }), 'Rialto balustrade');
  put(out, piers, stone('#bfaf9c'), 'Rialto bridge landings');
}

export function buildVenetian(data, options) {
  const out = model('The Venetian'), b = named(data, 'Venetian Tower');
  const ring = tower(out, b, options, venetian, 'venetian');
  if (ring) {
    wordmark(out, ring, [-1, 0], 'VENETIAN', 31, 4.15, b.h - 3.64, serif);
    wordmark(out, ring, [0.73, -0.68], 'VENETIAN', 29, 3.98, b.h - 3.73, serif);
  }
  tower(out, named(data, 'Venezia Tower'), options, venezia, 'venezia');
  const podium = named(data, 'The Venetian Las Vegas');
  grounds(out, data, options, podium, 'venetian');
  canalFrontage(out, data, podium, options);
  campanile(out, data, options);
  rialto(out, data);
  out.add(spill(351.5, 0.56, -649, 107, '#ffdbaf', 0.21));
  return out;
}

export function buildPalazzo(data, options) {
  const out = model('The Palazzo'), b = named(data, 'Palazzo Tower');
  if (tower(out, b, options, palazzo, 'palazzo')) palazzoSign(out);
  grounds(out, data, options, named(data, 'The Palazzo'), 'palazzo');
  const entry = new Soup(), glass = new Soup(), cornice = new Soup();
  const ring = clean([[431, -776], [444, -784], [461, -776], [457, -757], [435, -753]]);
  entry.prism(ring, 12.3, 18.65);
  for (const f of faces(ring, 6)) bayFace(glass, f, 12.7, 18.44, 4.4, true, 15, 0.17);
  parapet(cornice, ring, 18.66, 0.75, 0.42);
  put(out, entry, stone('#bda58a'), 'Palazzo arrival pavilion');
  put(out, glass, facade(MODE.arcade, { color: '#d4bfa8', glass: '#516377', bay: 4.4, floodK: 0.73, rate: 0.13 }),
    'Palazzo pavilion clerestory');
  put(out, cornice, stone(ivory, { flood: 0.53 }), 'Palazzo pavilion crown');
  out.add(spill(447, 0.46, -861, 89, '#ffe0ab', 0.24));
  return out;
}
