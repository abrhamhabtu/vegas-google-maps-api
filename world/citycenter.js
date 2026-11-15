/** ARIA campus. Dimensions and placement use the mapped rings in local metres. */
import { MODE, Soup, SANS, centroid, clean, facade, inset, offset, sign, spill } from './hero-kit.js';
import { addShape, along, faces, mapped, material, model, named, own, parapet, put, standalonePodium, wordmark } from './landmark-forms.js';

const THREE = window.THREE;
const cool = { bay: 3.28, pilaster: '#b9d5e4', rate: 0.092 };
const modernType = { font: `400 146px ${SANS}`, color: '#f1f7fe' };

export function buildAria(data, options) {
  const out = model('ARIA Resort & Casino');
  const specs = [[-239, 1003, 183], [-185, 880, 163], [-136, 869, 100], [-215, 928, 65], [-300, 986, 65]];
  const glazing = new Soup(), silver = new Soup(), roof = new Soup(), service = new Soup(), light = new Soup();
  for (const [i, [x, z, h]] of specs.entries()) {
    const footprint = mapped(data, x, z, h);
    if (!footprint) continue;
    const ring = own(footprint, options), top = footprint.h;
    glazing.walls(ring, 12, top - 3.7, undefined, [top, 14 + i * 8, 1, 0]);
    silver.walls(offset(ring, 0.4), top - 3.8, top - 2.9);
    parapet(silver, ring, top - 2.4, 1.2, 0.24);
    roof.cap(ring, top - 2.58);
    const well = inset(ring, 1.2);
    if (well) service.prism(well, top - 2.6, top + (i < 2 ? 0.6 : -1.4));
    if (i > 1) continue;
    // Recessed service floors on the curved wings, below the thin white crown.
    for (const y of [35, 73, 112, top - 14]) {
      service.walls(offset(ring, 0.08), y, y + 0.9);
      silver.walls(offset(ring, 0.18), y + 0.9, y + 1.12);
    }
    for (const f of faces(ring, 9)) {
      if (f.length < 17 || Math.abs(f.az) > 0.88) continue;
      along(silver, f, f.length * 0.05, f.length * 0.12, 14, top - 18, 0.72, 0.25);
      along(silver, f, f.length * 0.88, f.length * 0.95, 14, top - 18, 0.72, 0.25);
    }
    light.walls(offset(ring, 0.42), top - 3.6, top - 3.3);
    for (const dir of [[-1, 0], [1, 0]]) wordmark(out, ring, dir, 'ARIA', 21, 6.0, top - 8, modernType);
  }
  put(out, glazing, facade(MODE.curtainWall, { ...cool, color: '#507d9a', glass: '#97b7cd', roof: '#546779', glow: '#b0d8ff', self: 0.035 }), 'ARIA opposing arcs and lower shoulders');
  put(out, silver, material('#a2b1b9', '#c3cdd3', { self: 0.13 }), 'ARIA silver crown and spandrels');
  put(out, light, material('#b2c9d6', '#b2c9d6', { flood: '#bbdbff', floodK: 0.75, self: 0.55 }), 'ARIA crown light');
  put(out, roof, material('#788a96', '#a6a7a5'), 'ARIA roof wells');
  put(out, service, material('#4a6173', '#a4acaf', { self: 0.13 }), 'ARIA recessed mechanical floors');

  const podium = named(data, 'Aria Resort & Casino');
  standalonePodium(out, podium, options, material('#bfb8b0', '#a8a8a3'));
  // The floating entrance blade leaves the valet lanes open underneath.
  const canopy = new Soup(), soffit = new Soup();
  const arrival = clean([[-176, 926], [-141, 916], [-111, 927], [-132, 938], [-169, 940]]);
  canopy.skirt(arrival, 9.4, offset(arrival, -0.6), 11.5);
  canopy.cap(offset(arrival, -0.6), 11.5);
  soffit.walls(arrival, 9.24, 9.6);
  put(out, canopy, material('#737f83', '#c8cccb', { self: 0.05 }), 'ARIA valet canopy');
  put(out, soffit, material('#dfc89e', '#eadaad', { flood: '#ffe5ae', self: 0.65 }), 'ARIA canopy light');
  out.add(spill(-157, 0.42, 934, 105, '#d7e4ff', 0.18));
  return out;
}

export function buildVdara(data, options) {
  const out = model('Vdara Hotel & Spa');
  const glass = [new Soup(), new Soup(), new Soup()], ribbon = new Soup(), crown = new Soup(), roof = new Soup();
  const arcs = [[-333, 735, 165], [-317, 748, 174], [-295, 761, 140]];
  const paints = [
    { color: '#466581', glass: '#99aec0' },
    { color: '#5e88a0', glass: '#abbfce' },
    { color: '#355976', glass: '#8ca2ba' },
  ];
  arcs.forEach(([x, z, h], i) => {
    const b = mapped(data, x, z, h);
    if (!b) return;
    const ring = own(b, options);
    glass[i].walls(ring, 4, b.h - 2.3, undefined, [b.h, i * 22, 1, 0]);
    // These are real horizontal opaque spandrels, not a screen-space reflection.
    const line = offset(ring, 0.095);
    for (let y = 13.7 + i * 0.76; y < b.h - 3.8; y += 3.45) ribbon.walls(line, y, y + (i === 1 ? 0.44 : 0.33));
    parapet(crown, ring, b.h - 1.9, 1.25, 0.24);
    roof.cap(ring, b.h - 2.0);
    const core = inset(ring, 1.05);
    if (core) crown.prism(core, b.h - 2.1, b.h - 1.1);
    if (i === 1) {
      // The curved walls have short surveyed segments; the sign spans several bays.
      out.add(sign('Vdara', 28, 5.4, -320, b.h - 6.8, 749.91, 0.04, 1, modernType));
      out.add(sign('Vdara', 28, 5.4, -322, b.h - 6.8, 736.23, 0, -1, modernType));
    }
  });
  paints.forEach((paint, i) => put(out, glass[i], facade(MODE.curtainWall, {
    ...cool, ...paint, bay: 3.45, glow: '#aacee2', self: 0.055,
  }), `Vdara offset arc ${i + 1}`));
  put(out, ribbon, material('#afc2cb', '#bdc7cb', { self: 0.18 }), 'Vdara etched glass spandrels');
  put(out, crown, material('#839da8', '#bac4c9', { self: 0.1 }), 'Vdara silver roof edges');
  put(out, roof, material('#737f86', '#a1afb7'), 'Vdara roof wells');
  const base = mapped(data, -293, 749, 24, 4);
  standalonePodium(out, base ?? named(data, out.name), options, material('#aab6bb', '#acaead'));
  out.add(spill(-273, 0.4, 753, 75, '#aacee9', 0.18));
  return out;
}

export function buildVeer(data, options) {
  const out = model('Veer Towers');
  for (const [side, direction] of [['West', 1], ['East', -1]]) {
    const b = named(data, `Veer Towers ${side}`);
    if (!b) continue;
    const ring = own(b, options), [x, z] = centroid(ring), h = b.h;
    const g = model(`Veer ${side}`), frame = new Soup(), glass = new Soup(), fins = new Soup(), plant = new Soup();
    glass.prism(ring, 0, h - 2.6, undefined, [h, direction * 8, 1, 0]);
    for (const [i, f] of faces(ring, 9).entries()) {
      const n = Math.round(f.length / 2.1);
      for (let k = 1; k < n; k++) {
        const s = k * f.length / n, top = h - 3.0;
        const y0 = 2.5 + 3 * ((k + i) % 3);
        const width = k % 5 < 2 ? 0.64 : 0.24;
        along(fins, f, s - width / 2, s + width / 2, y0, top - y0, 0.58, 0.32);
      }
    }
    parapet(frame, ring, h - 2.8, 2, 0.25);
    for (const y of [32, 65, 98]) frame.walls(offset(ring, 0.11), y, y + 0.55);
    plant.box(x, h - 2.9, z, 14, 2.4, 19, 0.94, 0.34);
    put(g, glass, facade(MODE.curtainWall, { ...cool, color: '#a38b52', glass: '#76878c', glow: '#f1c878', self: 0.065 }), 'Veer warm grey glazing');
    put(g, fins, material('#c2a53d', '#ceb663', { flood: '#ffe49a', self: 0.26 }), 'Veer staggered gold fins');
    put(g, frame, material('#8b8c7a', '#bebdb2'), 'Veer roof screen and slab edges');
    put(g, plant, material('#9d9e95', '#bdbdb2'), 'Veer plant');
    // Shear the complete tower from the surveyed base. Floors stay level as the tower leans.
    g.matrix.set(1, direction * 0.083, 0, 0, 0, 1, 0, 0, 0, direction * 0.028, 1, 0, 0, 0, 0, 1);
    g.matrixAutoUpdate = false;
    out.add(g);
  }
  return out;
}

export function buildCrystals(data, options) {
  const out = model('The Shops at Crystals');
  const footprint = named(data, out.name);
  if (!footprint) return out;
  standalonePodium(out, footprint, options, material('#919ca3', '#ced1ce'));
  const zinc = new Soup(), glazing = new Soup(), joints = new Soup();
  // The principal folded roof rises in separate, oblique ridges along the mapped mall.
  const folds = [
    { ring: [[-56, 893], [22, 883], [35, 907], [-20, 917]], tip: [-39, 902], height: 42 },
    { ring: [[-78, 906], [-32, 907], [-8, 932], [-49, 942], [-78, 931]], tip: [-34, 917], height: 48 },
    { ring: [[-39, 934], [20, 911], [72, 927], [54, 946], [1, 966]], tip: [17, 926], height: 49 },
    { ring: [[44, 949], [88, 938], [94, 958], [77, 979], [52, 978]], tip: [85, 953], height: 43 },
    { ring: [[49, 978], [87, 973], [94, 1007], [66, 1005]], tip: [71, 981], height: 41 },
  ];
  const gray = material('#bcc5c6', '#c9cecb', { self: 0.08 });
  const skylight = material('#42647d', '#5f7f98', { flood: '#bfd9ff', floodK: 0.45, self: 0.18 });
  const seam = material('#758991', '#9fadb2');
  for (const [i, { ring, tip, height }] of folds.entries()) {
    const outline = clean(ring);
    outline.forEach((a, j) => {
      const b = outline[(j + 1) % outline.length], target = (i + 2 * j) % 5 === 0 ? glazing : zinc;
      const A = new THREE.Vector3(a[0], footprint.h - 0.04, a[1]), B = new THREE.Vector3(b[0], footprint.h - 0.04, b[1]);
      const C = new THREE.Vector3(tip[0], height, tip[1]);
      const n = C.clone().sub(A).cross(B.clone().sub(A)).normalize().toArray();
      const color = new THREE.Color(1, 1, 1), aux = [height, i, 0, 0];
      target.idx.push(...[A, C, B].map(p => target.vert(p.x, p.y, p.z, n, 0, color, aux)));
      joints.box(a[0], footprint.h - 0.05, a[1], 0.38, 0.2, 0.38);
      if (j % 2 === 0) {
        addShape(out, new THREE.TubeGeometry(new THREE.LineCurve3(A, C), 1, 0.14, 5), seam, 'Folded roof seam', 0, 0, 0);
      }
    });
  }
  put(out, zinc, gray, 'Crystals folded zinc roof');
  put(out, glazing, skylight, 'Crystals skylight facets');
  put(out, joints, seam, 'Crystals roof joints');
  if (options?.standalone) out.add(sign('THE SHOPS AT CRYSTALS', 27, 3.6, 99, 25, 915, 1, 0, modernType));
  return out;
}

export function buildCosmopolitan(data, options) {
  const out = model('The Cosmopolitan of Las Vegas');
  const glass = new Soup(), rails = new Soup(), slab = new Soup(), fins = new Soup(), crown = new Soup(), roof = new Soup();
  const campus = mapped(data, -89, 688, 16);
  const names = ['The Cosmopolitan Boulevard Tower', 'The Cosmopolitan Chelsea Tower', out.name];
  for (const [i, name] of names.entries()) {
    const b = named(data, name);
    if (!b) continue;
    const ring = own(b, options), top = b.h;
    glass.walls(ring, 15.8, top - 3.8, undefined, [top, i * 18 + 8, 1, 15.8]);
    const ff = faces(ring, 14);
    for (const [j, f] of ff.entries()) {
      // Each long exposed elevation has continuous balcony slabs and individual glass balustrades.
      const projection = f.length > 33 ? 1.18 : 0.74, n = Math.max(1, Math.round(f.length / 7.9));
      const width = f.length / n;
      for (let y = 22 + 0.15 * i; y < top - 8; y += 3.53) {
        along(slab, f, 0.08, f.length - 0.08, y, 0.25, projection + 0.11, projection * 0.45);
        for (let k = 0; k < n; k++) {
          const start = k * width + 0.23, end = (k + 1) * width - 0.23;
          if (end - start < 1) continue;
          along(rails, f, start + 0.05, end - 0.05, y + 0.25, 0.83, 0.11, projection - 0.02);
        }
      }
      for (let k = 0; k <= n; k += 2) {
        if ((k + j + i) % 3 === 2) continue;
        const s = Math.min(f.length - 0.65, k * width + 0.65);
        along(fins, f, s - 0.32, s + 0.32, 19, top - 24, 0.63, projection * 0.52);
      }
    }
    crown.walls(offset(ring, 0.2), top - 4.6, top - 2.0);
    parapet(crown, ring, top - 1.9, 1.2, 0.4);
    roof.cap(ring, top - 2);
    const inner = inset(ring, 1.7);
    if (inner) crown.prism(inner, top - 2, top + 1.0);
    if (i !== 1) {
      const dirs = i === 0 ? [[0, 1], [0, -1]] : [[1, 0]];
      for (const dir of dirs) wordmark(out, ring, dir, 'THE COSMOPOLITAN', i === 0 ? 52 : 29, 4.5, top - 6.1, {
        font: `600 104px ${SANS}`, color: '#f8f4ff',
      });
    }
  }
  const blue = facade(MODE.curtainWall, { ...cool, color: '#527991', glass: '#899bb2', glow: '#bacdfa', self: 0.052, bay: 3.53 });
  put(out, glass, blue, 'Cosmopolitan folded blue curtain walls');
  put(out, slab, material('#b1b8bf', '#c1c7c8', { self: 0.17 }), 'Cosmopolitan projecting balcony slabs');
  put(out, rails, material('#789baa', '#9eb0be', { self: 0.17 }), 'Cosmopolitan glass balcony rails');
  put(out, fins, material('#8297a4', '#9cb3c2', { self: 0.12 }), 'Cosmopolitan terrace dividers');
  put(out, crown, material('#545f6c', '#9ea9b4', { self: 0.15 }), 'Cosmopolitan dark crown screens');
  put(out, roof, material('#727c84', '#9ba4aa'), 'Cosmopolitan roof membranes');
  standalonePodium(out, campus, options, material('#637584', '#a9aaa3'));
  const storefront = new Soup(), fascia = new Soup();
  // Above the Strip arcade, a folded blue glass frontage leaves the sidewalk unobstructed.
  const panel = clean([[53, 704], [82, 690], [101, 699], [101, 743], [86, 755], [56, 751]]);
  storefront.walls(panel, 7.3, 16.1, undefined, [16.1, 41, 1, 7.3]);
  fascia.walls(offset(panel, 0.16), 15.4, 16.25);
  put(out, storefront, blue, 'Cosmopolitan Strip arcade glass');
  put(out, fascia, material('#b6b8bd', '#979fa7', { self: 0.3 }), 'Cosmopolitan promenade fascia');
  out.add(spill(57, 0.45, 726, 90, '#c6a5ff', 0.19));
  return out;
}
