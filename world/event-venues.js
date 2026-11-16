import { Soup, WHITE, clean } from './hero-kit.js';
import { addShape, material, mapped, model, named, own, put } from './landmark-forms.js';
import { letterRun, signMaterial, signMesh } from './architectural-signs.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';

const THREE = window.THREE;
const TAU = Math.PI * 2;
const SIDES = 144;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = THREE.MathUtils.clamp;
const frontNormal = a => [Math.sin(a), 0, Math.cos(a)];

function site(out, ring, bearing) {
  const heading = bearing * Math.PI / 180;
  const nx = Math.sin(heading), nz = -Math.cos(heading);
  const projections = ring.map(([x, z]) => [x * nz - z * nx, x * nx + z * nz]);
  const u = projections.map(p => p[0]), v = projections.map(p => p[1]);
  const mx = (Math.min(...u) + Math.max(...u)) / 2, mz = (Math.min(...v) + Math.max(...v)) / 2;
  out.position.set(mx * nz + mz * nx, 0, -mx * nx + mz * nz);
  out.rotation.y = Math.atan2(nx, nz);
  const local = ([x, z]) => [x * nz - z * nx - mx, x * nx + z * nz - mz];
  return { plan: ring.map(local), local };
}

// Cast rays from the mapped center so the upper wall follows the curved outline.
function perimeter(ring, angle) {
  const x = Math.sin(angle), z = Math.cos(angle);
  let distance = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [px, pz] = ring[i], [qx, qz] = ring[(i + 1) % ring.length];
    const dx = qx - px, dz = qz - pz, det = dx * z - dz * x;
    if (Math.abs(det) < 1e-6) continue;
    const u = (pz * x - px * z) / det;
    if (u < 0 || u > 1) continue;
    const d = (px + dx * u) * x + (pz + dz * u) * z;
    if (d > 0) distance = Math.min(d, distance);
  }
  return [x * distance, z * distance];
}

function exterior(ring, height, base, spread) {
  const samples = new Map();
  return (angle, y, extra = 0) => {
    if (!samples.has(angle)) samples.set(angle, perimeter(ring, angle));
    const [x, z] = samples.get(angle), scale = base + spread * Math.min(y / height, 1);
    return [x * scale + extra * Math.sin(angle), y, z * scale + extra * Math.cos(angle)];
  };
}

function face(soup, points, toward, color = WHITE) {
  const [a, b, c] = points.map(p => new THREE.Vector3(...p));
  const n = b.sub(a).cross(c.sub(a)).normalize(), dir = new THREE.Vector3(...toward);
  const flip = n.dot(dir) < 0;
  if (flip) n.negate();
  const ids = points.map(([x, y, z], i) => soup.vert(x, y, z, n.toArray(), i, color, [y, 0, 0, 0]));
  for (let i = 1; i + 1 < ids.length; i++) soup.idx.push(ids[0], ids[i + Number(flip)], ids[i + Number(!flip)]);
}

function strip(soup, wallPoint, a, b, bottomA, bottomB, topA, topB, inset = 0, color = WHITE) {
  face(soup, [wallPoint(a, bottomA, inset), wallPoint(b, bottomB, inset),
    wallPoint(b, topB, inset), wallPoint(a, topA, inset)], frontNormal((a + b) / 2), color);
}

// A canvas texture can follow a curved screen or roof without bending the wordmark into individual panels.
function curvedSign(out, mat, sample, segments, rows = 1) {
  const position = [], uv = [], index = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      position.push(...sample(u, v));
      uv.push(u, v);
      if (i > 0 && row > 0) {
        const j = i * (rows + 1) + row, prev = j - rows - 1;
        index.push(prev - 1, j - 1, j, prev - 1, j, prev);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = mat.name;
  out.add(mesh);
}

function arenaMarquee(ctx, w, h) {
  letterRun(ctx, 'T··Mobile·', w * 0.306, h / 2, w * 0.574, h * 0.85, '#fff6f5', '700 Georgia, serif');
  letterRun(ctx, 'ARENA', w * 0.799, h / 2, w * 0.385, h * 0.77, '#fff6f5', undefined, 3);
}

function arenaScreen(ctx, w, h) {
  const backdrop = ctx.createLinearGradient(0, 0, w, h);
  backdrop.addColorStop(0, '#6d0643');
  backdrop.addColorStop(0.48, '#d51889');
  backdrop.addColorStop(1, '#8a084e');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 3 ? '#f647a936' : '#2d0d343d';
    ctx.fillRect(i * w / 26, 0, w * 0.014, h);
  }
  letterRun(ctx, 'LAS VEGAS', w / 2, h * 0.49, w * 0.88, h * 0.62, '#ffe5f7', '900 Arial, sans-serif', 2);
}

function arenaPlaza(out, rootFrame, wall, data, options) {
  const soffit = new Soup(), portal = new Soup(), curtain = new Soup(), stairs = new Soup(), fascia = new Soup();
  const [, , front] = wall(0, 16, 6.1);
  const nose = clean([[-63, front - 32], [62, front - 33], [62, front], [-63, front]]);
  soffit.prism(nose, 15.05, 16.7);
  fascia.box(-0.5, 15.13, front - 0.04, 125.5, 1.38, 0.45);
  for (const side of [-1, 1]) {
    face(fascia, [[side * 52, 4.36, front + 0.12], [side * 53.85, 4.36, front + 0.12],
      [side * 62.5, 15.23, front + 0.12], [side * 60.35, 15.23, front + 0.12]], [0, 0, 1]);
  }
  for (let i = -48; i <= 48; i += 6) portal.box(i, 4.44, front - 0.18, 0.24, 10.21, 0.42);
  for (const y of [7.2, 10.3]) portal.box(0, y, front - 0.11, 109, 0.17, 0.38);
  face(curtain, [[-53.9, 4.5, front - 0.61], [53.9, 4.5, front - 0.61],
    [62, 15.24, front - 0.61], [-62, 15.24, front - 0.61]], [0, 0, 1]);
  for (let i = 0; i < 8; i++) stairs.box(0, 0.15, front + 10.5 - 1.3 * i, 74, (i + 1) * 0.23, 1.32);
  for (let i = -42; i <= 42; i += 12) {
    stairs.box(i, 0.5, front - 0.1, 7.8, 3.82, 1.28);
    portal.box(i, 0.5, front + 0.65, 0.15, 3.64, 0.24);
  }
  put(out, stairs, material('#9b9391', '#aea6a3'), 'Toshiba Plaza steps and door bays');
  put(out, soffit, sheen('#837f87', { glow: '#b682e4', glowK: 0.18, baseGlow: 0.025 }), 'Cantilevered balcony canopy');
  put(out, fascia, sheen('#b8b2b6', { glow: '#e8cef9', glowK: 0.32 }), 'Toshiba Plaza angled fascia');
  put(out, portal, sheen('#575263', { glow: '#bf96f6', glowK: 0.28 }), 'Toshiba Plaza entrance mullions');
  put(out, curtain, sheen('#38404f', { refl: 0.36, glow: '#c276b8', glowK: 0.42, windows: 0.18 }), 'Toshiba Plaza glazing');

  const sculpture = data.pois.find(p => p.n === 'Bliss Dance');
  if (!sculpture || options?.standalone) return;
  const [x, z] = rootFrame.local([sculpture.x, sculpture.z]);
  const art = model('Bliss Dance');
  art.position.set(x, 0.18, z);
  const steel = sheen('#acb1b5', { refl: 0.49, spec: 0.82, glow: '#bda6f6', glowK: 0.35 });
  const limb = (a, b, taper, width) => {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), d = q.clone().sub(p);
    const mid = p.lerp(q, 0.5);
    const obj = addShape(art, new THREE.CylinderGeometry(taper, width, d.length(), 10), steel, 'Steel sculpture', ...mid.toArray());
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };
  for (const [a, b, taper, width] of [
    [[-1.78, 0.18, 0.7], [-1.24, 4.65, -0.35], 0.5, 0.29], [[-1.24, 4.65, -0.35], [-0.74, 7.4, 0.4], 0.7, 0.49],
    [[1.68, 0.28, -0.7], [0.95, 4.15, 0.43], 0.47, 0.27], [[0.95, 4.15, 0.43], [-0.03, 7.37, 0.4], 0.74, 0.48],
    [[-0.43, 7.12, 0.4], [0.11, 10.7, 0], 0.89, 0.98], [[-0.49, 10.15, 0], [-2.46, 12.32, -0.27], 0.31, 0.5],
    [[-2.46, 12.32, -0.27], [-2.18, 14.14, -0.23], 0.18, 0.31], [[0.83, 10.1, 0], [2.73, 10.77, 0.2], 0.24, 0.42],
    [[2.73, 10.77, 0.2], [3.71, 12.5, 0.1], 0.16, 0.24],
  ]) limb(a, b, taper, width);
  addShape(art, new THREE.SphereGeometry(0.74, 12, 10), steel, 'Head', 0.26, 11.52, -0.1);
  out.add(art);
}

export function buildTMobile(data, options) {
  const out = model('T-Mobile Arena');
  const ground = mapped(data, -327, 1493, 16);
  if (!ground) return out;
  const frame = site(out, own(ground, options), 71), { plan } = frame;
  const bowl = new Soup(), glass = new Soup(), metal = new Soup(), joint = new Soup(), roof = new Soup(), roofwork = new Soup();
  const top = 40.9;
  const wall = exterior(plan, top, 0.875, 0.12);
  const rims = Array.from({ length: SIDES }, (_, i) => {
    const [x, , z] = wall(i * TAU / SIDES, top);
    return [x, z];
  });
  const screenA = -0.56, screenB = 0.59;
  const tone = ['#c9b9a1', '#d9b597', '#c7cacd', '#c1a58e', '#e1b998', '#abb2ba'].map(c => new THREE.Color(c));
  const courses = a => [1.0, 8.1, 14.7, 21.8, 28.3, 34.1, top].map((y, i) =>
    i === 0 || i === 6 ? y : y + 1.3 * Math.sin(1.6 * a + i * 0.22) + 0.46 * Math.sin(3.2 * a - i * 0.58));
  for (let i = 0; i < SIDES; i++) {
    const a = i * TAU / SIDES, b = (i + 1) * TAU / SIDES;
    const middle = (a + b) / 2, front = Math.cos(middle) > 0.825;
    strip(bowl, wall, a, b, 0, 0, top, top, -1.06);
    if (front) {
      strip(glass, wall, a, b, 4, 4, top - 0.45, top - 0.45, 0.11);
      for (const y of [11.1, 16.65, 21.7, 27.8, 33.25, 39.85]) strip(joint, wall, a, b, y, y, y + 0.27, y + 0.27, 0.27);
      if (i % 2 === 0) strip(joint, wall, a, a + 0.0047, 4, 4, top, top, 0.27);
    } else {
      const lo = courses(a), hi = courses(b);
      for (let j = 0; j < lo.length - 1; j++) {
        const visor = j === 2 || j === 4;
        const reach = visor ? 0.68 : 0.12;
        strip(metal, wall, a, b, lo[j] + 0.19, hi[j] + 0.19, lo[j + 1], hi[j + 1], reach, tone[j]);
        const slit = visor && Math.sin(middle * 2 - j) > -0.12;
        strip(slit ? glass : joint, wall, a, b, lo[j] - (slit ? 0.67 : 0.12), hi[j] - (slit ? 0.67 : 0.12),
          lo[j] + 0.2, hi[j] + 0.2, reach + 0.14);
        for (const m of [0.2, 0.4, 0.6, 0.8]) {
          const l = mix(lo[j], lo[j + 1], m), h = mix(hi[j], hi[j + 1], m);
          strip(joint, wall, a, b, l, h, l + 0.05, h + 0.05, reach + 0.025);
        }
      }
    }
    strip(joint, wall, a, b, top - 0.63, top - 0.63, top + 0.14, top + 0.14, 0.34);
  }
  const roofline = clean(rims);
  roof.cap(roofline, top - 0.08);
  roof.prism(clean(rims.map(([x, z]) => [x * 0.845, z * 0.855])), top - 0.08, top + 1.58);
  for (const z of [-37.5, 31]) {
    roofwork.box(-16, top + 1.56, z, 45, 1.37, 7.2);
    for (let x = -33; x < 7; x += 6.4) roof.box(x, top + 2.92, z, 4.0, 0.22, 4.6);
  }
  for (let i = -7; i <= 7; i++) roofwork.box(i * 8.64, top + 1.59, 0, 0.13, 0.043, 113 - Math.abs(i) * 4.1);

  put(out, bowl, material('#3e3c41', '#76777a'), 'T-Mobile Arena bowl and plinth');
  put(out, glass, sheen('#435062', { refl: 0.52, spec: 0.9, glow: '#ffcd91', glowK: 0.20, windows: 0.21 }), 'Outward-sloping event concourse');
  put(out, metal, material('#96816d', '#aaa19a', { self: 0.15 }), 'Weathered bronze and silver cladding courses');
  put(out, joint, material('#4f482f', '#676460', { self: 0.11 }), 'Metal reveals, glazing bars and fascia');
  put(out, roof, material('#a6a6a6', '#acadad', { self: 0.18 }), 'Low silver roof deck');
  put(out, roofwork, material('#8f9296', '#92949a'), 'Roof seams and mechanical housings');

  const led = signMaterial('Toshiba Plaza video mesh', 6.45, arenaScreen, '#877281');
  curvedSign(out, led, (u, v) => {
    const a = mix(mix(screenA + 0.1, screenA, v), mix(screenB - 0.21, screenB, v), u);
    return wall(a, mix(23.75, 38.95, v), 0.95);
  }, 44, 8);
  const marquee = signMaterial('T-Mobile Arena crown lettering', 10.4, arenaMarquee, '#d7d8df');
  const bearing = -0.24;
  const [x, , z] = wall(bearing, top, 0.35);
  const posts = new Soup();
  for (const u of [-21, 0, 21]) posts.box(x + Math.cos(bearing) * u, top - 0.2,
    z - Math.sin(bearing) * u, 0.23, 1.95, 0.36, Math.cos(bearing), -Math.sin(bearing));
  put(out, posts, material('#777576'), 'Marquee mounting frame');
  out.add(signMesh(marquee, 57.2, 5.5, x, top + 2.8, z, Math.sin(bearing), Math.cos(bearing)));
  arenaPlaza(out, frame, wall, data, options);
  return out;
}

function sectionAt(plan, x) {
  const hits = [];
  for (let i = 0; i < plan.length; i++) {
    const [a, v] = plan[i], [b, w] = plan[(i + 1) % plan.length];
    if ((a <= x && x < b) || (b <= x && x < a)) hits.push(mix(v, w, (x - a) / (b - a)));
  }
  return [Math.min(...hits), Math.max(...hits)];
}

function membrane(out, shape, base, rise) {
  const foil = new Soup(), seams = new Soup(), curb = new Soup();
  curb.walls(clean(shape), base - 0.74, base);
  const xs = shape.map(([x]) => x), min = Math.min(...xs) + 0.025, max = Math.max(...xs) - 0.025;
  const mid = (min + max) * 0.5, half = (max - min) * 0.5;
  const bays = Math.round((max - min) / 5.5), lengthSteps = 28;
  const section = (s, lift) => {
    const x = mix(min, max, s), [from, to] = sectionAt(shape, x);
    const cross = Math.sqrt(Math.max(0, 1 - ((x - mid) / half) ** 2));
    return Array.from({ length: lengthSteps + 1 }, (_, j) => {
      const v = j / lengthSteps, arch = Math.sin(v * Math.PI) ** 0.63;
      return [x, base + (rise * cross + lift * Math.sqrt(cross)) * arch, mix(from, to, v)];
    });
  };
  const join = (soup, a, b) => {
    for (let j = 0; j < lengthSteps; j++) face(soup, [a[j], b[j], b[j + 1], a[j + 1]], [0, 1, 0]);
  };
  let prior = section(0, 0);
  for (let i = 0; i < bays; i++) {
    for (let j = 1; j <= 5; j++) {
      const fraction = j / 5;
      const next = section((i + fraction) / bays, Math.sin(fraction * Math.PI) * 0.82);
      join(foil, prior, next);
      prior = next;
    }
    if (i < bays - 1) join(seams, section((i + 0.975) / bays, 0.10), section((i + 1.025) / bays, 0.10));
  }
  put(out, foil, sheen('#b9c5ce', { refl: 0.21, spec: 0.69, glow: '#bee0ff', glowK: 0.16 }), 'Parallel ETFE roof cushions');
  put(out, seams, material('#82949f', '#99a7ad', { self: 0.13 }), 'ETFE restraint seams');
  put(out, curb, material('#899098', '#747b84'), 'ETFE perimeter flashing');
}

function stadiumMark(ctx, w, h) {
  letterRun(ctx, 'allegiant stadium', w / 2, h * 0.62, w * 0.975, h * 0.64, '#f3f5f4', '900 Arial, sans-serif');
  const x = w * 0.281, y = h * 0.41;
  for (let i = 0; i < 11; i++) {
    const a = mix(-2.71, -0.43, i / 10);
    ctx.fillStyle = i % 2 ? '#ffbd36' : '#ff8b31';
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a - 0.08) * h * 0.17, y + Math.sin(a - 0.08) * h * 0.13);
    ctx.lineTo(x + Math.cos(a) * h * 0.48, y + Math.sin(a) * h * 0.42);
    ctx.lineTo(x + Math.cos(a + 0.08) * h * 0.19, y + Math.sin(a + 0.08) * h * 0.13);
    ctx.fill();
  }
}

function northEntry(out, wall) {
  const plaza = new Soup(), risers = new Soup(), glazing = new Soup(), structure = new Soup(), recess = new Soup();
  const [, , front] = wall(0, 16, 0);
  const glassZ = front - 8.4;
  recess.box(0, 0.4, front - 43, 103, 14.0, 31);
  recess.box(0, 14.3, front - 38, 94, 39.4, 0.75);
  structure.box(0, 13.8, glassZ - 1.5, 26, 1.24, 9.4);
  plaza.box(0, 0.08, front + 7.6, 89.5, 0.21, 27.4);
  plaza.box(0, 0.07, front - 8.1, 104, 1.65, 16.8);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) risers.box(side * 26, 0.12, front + 15.3 - i * 1.43, 18.5, (i + 1) * 0.29, 1.47);
    for (let i = 0; i < 4; i++) structure.box(side * (20.1 + i * 4.95), 3.58, front - 4.5, 0.16, 1.05, 6.4);
  }
  for (let x = -13.5; x < 15; x += 5.4) glazing.box(x, 0.3, front - 4.2, 4.86, 3.35, 0.23);
  for (let i = -12; i <= 12; i++) {
    const a = i * 0.019, b = a + 0.019;
    strip(structure, wall, a, b, 11.5, 11.5, 15.84, 15.84, 1.05);
  }
  const welcome = signMaterial('North Entry welcome lettering', 13, (ctx, w, h) =>
    letterRun(ctx, 'WELCOME TO ALLEGIANT STADIUM', w / 2, h / 2, w - 30, h * 0.77, '#ecedef'), '#a9a9a9');
  out.add(signMesh(welcome, 41.6, 3.2, 0, 13.7, front + 3.1, 0, 1));
  put(out, plaza, material('#999692', '#a7a49e'), 'North Entry plaza');
  put(out, risers, material('#bdb8aa', '#c0bbb0'), 'North Entry stair flights');
  put(out, glazing, sheen('#39444b', { glow: '#e7c991', glowK: 0.18 }), 'North Entry door glazing');
  put(out, structure, material('#52585b', '#7e827f', { self: 0.14 }), 'North Entry rails and header');
  put(out, recess, material('#131c26', '#394550', { self: 0.16 }), 'Interior Lanai terrace and backdrop');

  const steel = sheen('#858c91', { refl: 0.44, spec: 0.9, glow: '#ffe4ac', glowK: 0.18 });
  const profile = [[2.55, 0], [2.8, 3.4], [3.0, 10.2], [3.24, 15.8], [4.52, 21.8], [4.39, 22.35], [3.95, 20.94]]
    .map(p => new THREE.Vector2(...p));
  addShape(out, new THREE.LatheGeometry(profile, 28), steel, 'Al Davis Memorial Torch', 0, 15, glassZ);
  const ribbons = new Soup();
  const tint = ['#c16436', '#f5a34d', '#fbd497'].map(c => new THREE.Color(c));
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6, x = Math.sin(a), z = Math.cos(a), y = 35.6;
    face(ribbons, [[x * 3.6, y, glassZ + z * 3.6], [x + z * 0.74, y + 6 + i % 3, glassZ + z - x * 0.74],
      [x * 2.16 - z * 0.46, y + 6.3 + i % 2, glassZ + z * 2.16 + x * 0.46],
      [x * 3.93 - z * 0.8, y + 1.86, glassZ + z * 3.93 + x * 0.8]], [x, 0, z], tint[i % 3]);
  }
  put(out, ribbons, material('#ffb96e', '#ffd58a', { self: 0.58 }), 'Torch flame sculpture');
}

export function buildAllegiant(data, options) {
  const out = model('Allegiant Stadium');
  const footprint = named(data, 'Allegiant Stadium'), glazing = mapped(data, -782, 2843, 69);
  if (!footprint || !glazing) return out;
  const { plan, local } = site(out, own(footprint, options), 25);
  const roofShape = own(glazing, options).map(local);
  const shell = new Soup(), entries = new Soup(), northGlass = new Soup(), sideGlass = new Soup();
  const metal = new Soup(), lit = new Soup(), mullions = new Soup(), deck = new Soup();
  const roofY = 61.4;
  const wall = exterior(plan, roofY, 0.865, 0.122);
  const ribbonKnots = [[0, 23, 52.7], [0.46, 21, 53.2], [0.66, 18, 52.8], [0.87, 15.8, 30],
    [1.20, 17.4, 29], [1.52, 19, 49.5], [1.85, 24.2, 52], [2.23, 21, 42], [2.59, 17.8, 27], [Math.PI, 14, 24]];
  const edges = a => {
    const angle = Math.acos(clamp(Math.cos(a), -1, 1));
    const j = Math.max(1, ribbonKnots.findIndex(([v]) => angle <= v));
    const [p, lo, hi] = ribbonKnots[j - 1], [q, L, H] = ribbonKnots[j];
    const t = (angle - p) / (q - p), s = t * t * (3 - 2 * t);
    return [mix(lo, L, s), mix(hi, H, s)];
  };
  const cover = [];
  for (let i = 0; i < SIDES; i++) {
    const a = i * TAU / SIDES, b = (i + 1) * TAU / SIDES, front = Math.cos((a + b) / 2) > 0.762;
    const [loA, hiA] = edges(a), [loB, hiB] = edges(b);
    strip(entries, wall, a, b, 0.1, 0.1, 8.15, 8.15);
    strip(shell, wall, a, b, 8.15, 8.15, loA, loB);
    strip(front ? northGlass : sideGlass, wall, a, b, loA, loB, hiA, hiB);
    strip(shell, wall, a, b, hiA, hiB, roofY, roofY);
    for (const [y1, y2] of [[loA, loB], [hiA, hiB]]) {
      strip(metal, wall, a, b, y1 - 0.34, y2 - 0.34, y1 + 0.38, y2 + 0.38, 0.34);
      strip(lit, wall, a, b, y1 - 0.01, y2 - 0.01, y1 + 0.14, y2 + 0.14, 0.53);
    }
    strip(metal, wall, a, b, 8.1, 8.1, 8.32, 8.32, 0.22);
    strip(metal, wall, a, b, roofY - 0.46, roofY - 0.46, roofY + 0.47, roofY + 0.47, 0.46);
    for (const level of [0.18, 0.38, 0.59, 0.80]) {
      const p = mix(loA, hiA, level), q = mix(loB, hiB, level);
      strip(mullions, wall, a, b, p, q, p + 0.16, q + 0.16, 0.2);
    }
    strip(mullions, wall, a, a + (i % 5 === 0 ? 0.0075 : 0.0033), loA, loA, hiA, hiA, 0.21);
    const [x, , z] = wall(a, roofY);
    cover.push([x, z]);
    if (i % 2 === 0) metal.box(x * 0.974, roofY - 0.02, z * 0.974, 0.36, 0.53, 1.03, Math.cos(a), -Math.sin(a));
  }
  deck.cap(clean(cover), roofY - 0.01);
  put(out, entries, sheen('#383c41', { refl: 0.29, glow: '#d4c19a', glowK: 0.26, windows: 0.24 }), 'Recessed concourse entrances');
  put(out, shell, sheen('#1b2128', { refl: 0.41, spec: 0.95, glow: '#5a7190', glowK: 0.06 }), 'Charcoal shell');
  put(out, sideGlass, sheen('#253242', { refl: 0.60, spec: 1.0, glow: '#7a8da2', glowK: 0.18 }), 'Smoked side glazing');
  put(out, northGlass, sheen('#31414d', { refl: 0.46, spec: 0.85, opacity: 0.57, glow: '#73839a', glowK: 0.10 }), 'Glazed North Lanai');
  put(out, metal, sheen('#939a9f', { refl: 0.23, spec: 0.67, glow: '#b0b9bd', glowK: 0.24 }), 'Satin silver ribbon and coping');
  put(out, lit, sheen('#b1aea6', { glow: '#fff4d5', glowK: 0.88, baseGlow: 0.08 }), 'Recessed ribbon lighting');
  put(out, mullions, material('#3e4549', '#4b5356', { self: 0.19 }), 'Curtain-wall mullions and rails');
  put(out, deck, material('#4b5056', '#53575c', { self: 0.20 }), 'Graphite roof apron');
  membrane(out, roofShape, roofY + 0.71, glazing.h - roofY - 0.71);

  const brand = signMaterial('Allegiant Stadium painted roof lettering', 9.4, stadiumMark, '#e6e6e2');
  for (const side of [-1, 1]) {
    const angle = side * Math.PI / 2;
    curvedSign(out, brand, (u, v) => {
      const [x, , z] = wall(angle + (u - 0.5) * 1.49, roofY);
      const s = mix(0.982, 0.818, v);
      return [x * s, roofY + 0.045, z * s];
    }, 48);
    curvedSign(out, brand, (u, v) => wall(angle + (u - 0.5) * 0.36, mix(9.7, 14.55, v), 0.61), 22);
  }
  northEntry(out, wall);
  return out;
}
