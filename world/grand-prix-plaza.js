/** The permanent pit building with a race-week display of its immediate circuit. */
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { Soup, SANS, WHITE, centroid, clean, inset, offset, sign, spill } from './hero-kit.js';
import { along, faces, material, model, named, own, parapet, put } from './landmark-forms.js';

const THREE = window.THREE;
const stone = (color, roof = color) => material(color, roof, { flood: '#d1ddff', floodK: 0.31 });
const light = (color, glow, glowK) => sheen(color, { glow, glowK, refl: 0.07 });

// Two mapped ends of the long trackside edge. s runs toward Turn 1;
// t runs from the garage doors across the race straight to the main stand.
function frameOf(footprint) {
  const near = (x, z) => footprint.pts.reduce((a, b) =>
    Math.hypot(a[0] - x, a[1] - z) <= Math.hypot(b[0] - x, b[1] - z) ? a : b);
  const [x, z] = near(1053, 838), [u, v] = near(1252, 611);
  const length = Math.hypot(u - x, v - z), ax = (u - x) / length, az = (v - z) / length;
  const at = (s, t) => [x + s * ax - t * az, z + s * az + t * ax];
  const box = (soup, s, t, y, w, h, d) => {
    const [X, Z] = at(s, t);
    soup.box(X, y, Z, w, h, d, ax, az, WHITE, [y + h, 0, 0, y]);
  };
  return { x, z, ax, az, nx: -az, nz: ax, length, at, box };
}

function section(soup, ring, top, height, overhang) {
  const lip = offset(ring, overhang);
  soup.walls(lip, top - height, top);
  soup.skirt(lip, top, ring, top);
}

function roofLogo(out, f) {
  // Model the display as three opaque LED canopy pieces. The installation's
  // published 481 ft length fixes the longitudinal scale, independent of the roof angle.
  const outer = new THREE.Shape();
  outer.moveTo(0, 1);
  outer.bezierCurveTo(0.028, 0.75, 0.116, 0.33, 0.202, 0.185);
  outer.bezierCurveTo(0.251, 0.101, 0.317, 0.082, 0.405, 0.082);
  outer.lineTo(0.827, 0.082); outer.lineTo(0.750, 0.315); outer.lineTo(0.407, 0.315);
  outer.bezierCurveTo(0.330, 0.315, 0.284, 0.352, 0.244, 0.462);
  outer.bezierCurveTo(0.197, 0.577, 0.150, 0.785, 0.125, 1); outer.closePath();
  const inner = new THREE.Shape();
  inner.moveTo(0.172, 1);
  inner.bezierCurveTo(0.206, 0.778, 0.256, 0.584, 0.316, 0.512);
  inner.bezierCurveTo(0.351, 0.470, 0.390, 0.451, 0.446, 0.451);
  inner.lineTo(0.697, 0.451); inner.lineTo(0.622, 0.678); inner.lineTo(0.443, 0.678);
  inner.bezierCurveTo(0.391, 0.678, 0.352, 0.710, 0.332, 0.768);
  inner.lineTo(0.297, 1); inner.closePath();
  const shapes = [outer.getPoints(10), inner.getPoints(10), [[0.874, 0.082], [1, 0.082], [0.696, 1], [0.573, 1]]
    .map(([x, y]) => new THREE.Vector2(x, y))];
  const backing = new Soup(), screen = new Soup(), bracing = new Soup();
  for (const shape of shapes) {
    const ring = clean(shape.map(({ x, y }) => f.at(14.5 + 146.61 * x, -27.1 + y * 24.3)));
    backing.prism(offset(ring, 0.59), 15.85, 17.78);
    screen.prism(ring, 17.69, 18.04);
  }
  for (const s of [29, 50, 75, 106, 136, 150]) f.box(bracing, s, -18.0, 14.17, 1.4, 2.87, 1.2);
  put(out, backing, stone('#542b3c', '#6d3545'), 'Inset housings of the F1 roof display');
  put(out, screen, light('#cf302e', '#ff2218', 1.61), 'Red F1 roof canopy');
  put(out, bracing, stone('#594f65'), 'Roof LED display supports');
}

function pitBuilding(out, data, footprint, options, f) {
  const ring = own(footprint, options);
  const shell = new Soup(), garage = new Soup(), jamb = new Soup(), rails = new Soup(), finish = new Soup();
  const glass = new Soup(), mullions = new Soup(), deckLights = new Soup(), terrace = new Soup(), roofBits = new Soup();
  shell.walls(ring, 0.11, 14.18);
  for (const [y, thick, lip] of [[0.54, 0.41, 0.27], [5.02, 0.72, 1.33], [9.61, 0.64, 1.28], [14.26, 0.75, 1.12]]) {
    section(finish, ring, y, thick, lip);
    if (y > 3) section(deckLights, ring, y - 0.36, 0.09, lip + 0.038);
  }
  terrace.cap(ring, 14.26);
  parapet(finish, ring, 14.18, 0.62, 0.25);
  const usable = f.length - 17, bays = 35, pitch = usable / bays;
  for (let i = 0; i < bays; i++) {
    const s = 8.5 + (i + 0.5) * pitch;
    f.box(garage, s, 0.12, 0.43, pitch - 1.06, 3.89, 0.24);
    f.box(jamb, s - pitch * 0.5, 0.21, 0.38, 0.41, 4.00, 0.56);
    for (const h of [0.82, 1.73, 2.69, 3.55]) f.box(rails, s, 0.28, h, pitch - 1.03, 0.065, 0.065);
    if (i % 2 === 0) f.box(deckLights, s, 0.36, 4.02, 2.32, 0.28, 0.09);
    for (const y of [5.16, 9.71]) {
      f.box(glass, s, 0.087, y, pitch - 0.42, 3.82, 0.25);
      for (const j of [-1, 0, 1]) f.box(mullions, s + pitch * j / 3, 0.23, y - 0.04, 0.13, 3.98, 0.17);
      f.box(rails, s, 1.15, y + 0.73, pitch + 0.13, 0.15, 0.16);
    }
  }
  // Follow the separately mapped stair and raised service outlines at the
  // building's ends. They don't extend into the track or city lane graph.
  for (const part of data.buildings) {
    if (!part.part || !part.pts.every(([x, z]) => x > 1000 && x < 1256 && z > 567 && z < 840)) continue;
    const [x, z] = centroid(part.pts);
    const s = (x - f.x) * f.ax + (z - f.z) * f.az, t = (x - f.x) * f.nx + (z - f.z) * f.nz;
    if (s < -20 || s > f.length + 9 || t < -63 || t > 4) continue;
    const outline = own(part, options);
    if (part.h < 10.5) {
      roofBits.prism(outline, 0.13, part.h - 0.03);
      section(finish, outline, part.h + 0.16, 0.31, 0.18);
    } else if (s < 52 || s > f.length - 55) {
      const inside = inset(outline, 0.45) ?? outline;
      roofBits.prism(inside, 13.99, Math.max(14.7, part.h + 0.48));
    }
  }
  for (const [s, length] of [[189, 25], [227, 33], [265, 29], [291, 10]]) {
    f.box(roofBits, s, -17.25, 14.32, length, 1.91, 14.2);
    f.box(finish, s, -17.25, 16.20, length + 0.55, 0.37, 15.05);
    f.box(glass, s, -9.72, 14.75, length * 0.89, 0.88, 0.13);
  }
  // Vertical trapezoid display at the southwest arrival/elevator core.
  const [X, Z] = f.at(5.46, -11.1), [x, z] = f.at(5.12, -11.1);
  const entryScreen = new Soup();
  f.box(roofBits, 6.86, -11.1, 4.25, 2.57, 9.08, 16.04);
  const front = { x: X, z: Z, ax: f.nx, az: f.nz, nx: -f.ax, nz: -f.az, length: 15.2 };
  along(entryScreen, front, -7.36, 7.37, 7.02, 4.40, 0.12, 0.11);
  out.add(sign('GRAND PRIX PLAZA', 14.92, 2.22, x, 12.56, z, -f.ax, -f.az,
    { font: `800 124px ${SANS}`, color: '#fff1ef' }));
  const [mx, mz] = f.at(f.length - 59, 0.31);
  out.add(sign('F1 • GRAND PRIX PLAZA', 30, 1.43, mx, 13.02, mz, f.nx, f.nz,
    { font: `800 115px ${SANS}`, color: '#ffeceb' }));
  put(out, shell, stone('#c6c9d0', '#9ca6bc'), 'Three-storey pit building envelope');
  put(out, garage, sheen('#424851', { glow: '#6b6381', glowK: 0.14, refl: 0.21 }), 'Individual pit garage doors');
  put(out, jamb, stone('#d2cbd3'), 'Concrete garage jambs');
  put(out, rails, stone('#9fa9bc'), 'Pit garage door seams and terrace rails');
  put(out, finish, stone('#d6d9e2', '#a6b0c4'), 'Pale projecting pit club terraces');
  put(out, glass, sheen('#52617a', { glow: '#a8aed3', glowK: 0.23, refl: 0.25 }), 'Pit club glass walls');
  put(out, mullions, stone('#acb6cd'), 'Pit club glazing frames');
  put(out, deckLights, light('#ceccdf', '#d8dcff', 0.86), 'White-violet pit lane lighting');
  put(out, terrace, stone('#a4a9ba', '#959dba'), 'Concrete Paddock Club roof');
  put(out, roofBits, stone('#9ba6ba', '#a4abc0'), 'Rooftop events and entry stairs');
  put(out, entryScreen, light('#9b3b47', '#ff525c', 0.94), 'Grand Prix Plaza entry display');
  roofLogo(out, f);
}

function strip(soup, a, b, left, right, y, endLeft = left, endRight = right) {
  const attrs = [y, 0, 0, 0];
  const p = (q, t) => soup.vert(q.x + q.nx * t, y, q.z + q.nz * t, [0, 1, 0], 0, WHITE, attrs);
  const v = [p(a, left), p(a, right), p(b, endRight), p(b, endLeft)];
  soup.idx.push(v[0], v[1], v[2], v[0], v[2], v[3]);
}

function curveFrames(points) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.ceil(curve.getLength() / 1.72);
  return curve.getSpacedPoints(n).map(({ x, z }, i) => {
    const t = curve.getTangentAt(i / n);
    return { x, z, nx: -t.z, nz: t.x };
  });
}

function raceTrack(out, f) {
  const { at, box, length } = f;
  const paved = new Soup(), apron = new Soup(), curbsRed = new Soup(), curbsWhite = new Soup(), marking = new Soup();
  const grid = new Soup(), wall = new Soup(), frames = new Soup(), lights = new Soup();
  // Turns drawn from the FIA's circuit plan, tied to the mapped pit edge,
  // Rochelle/Koval corners and the two parking outlines. Local visual mesh only.
  const points = [
    [1027, 897.2], [1034, 887.5], at(-25, 33.2), at(0, 32.5), at(length * 0.5, 32.5), at(length - 11, 32.5),
    [1288, 616], [1295, 589], [1291, 564], [1276, 547], [1256, 541], [1234, 545], [1213, 560],
    [1181, 582], [1143, 617], [1113, 642], [1090, 653], [1064, 661], [1040, 665], [1016, 656],
    [994, 639], [978, 616], [972, 591], [970.6, 572.6], [966.3, 558.1], [961.2, 549.7],
  ];
  const loop = curveFrames(points);
  // The two ends taper to the parcel edge without repainting Harmon or Koval.
  const rowWidth = i => Math.min(7.85, 0.6 + i * 0.76, 0.57 + (loop.length - 1 - i) * 0.65);
  for (let i = 1; i < loop.length; i++) {
    const a = loop[i - 1], b = loop[i], nearEnds = i < 16 || i > loop.length - 42;
    const wa = rowWidth(i - 1), wb = rowWidth(i);
    const bend = nearEnds || (a.x >= 1206 && a.z < 613);
    const side = bend ? (a.x > 1190 || i < 16 ? -1 : 1) : 0;
    const curbA = wa * 0.116, curbB = wb * 0.116, shoulderA = wa * 0.312, shoulderB = wb * 0.312;
    const s = (a.x - f.x) * f.ax + (a.z - f.z) * f.az, t = (a.x - f.x) * f.nx + (a.z - f.z) * f.nz;
    const pitMouth = t > 20 && t < 44 && ((s > -24 && s < 6) || (s > length - 28 && s < length - 7));
    if (!pitMouth) strip(apron, a, b, -wa - shoulderA, -wa - (side === -1 ? curbA : 0), 0.214,
      -wb - shoulderB, -wb - (side === -1 ? curbB : 0));
    strip(apron, a, b, wa + (side === 1 ? curbA : 0), wa + shoulderA, 0.214,
      wb + (side === 1 ? curbB : 0), wb + shoulderB);
    strip(paved, a, b, -wa, wa, 0.214, -wb, wb);
    if (Math.min(wa, wb) > 6.7) {
      if (!pitMouth) strip(marking, a, b, -wa + 0.07, -wa + 0.23, 0.223, -wb + 0.07, -wb + 0.23);
      strip(marking, a, b, wa - 0.23, wa - 0.07, 0.223, wb - 0.23, wb - 0.07);
    }
    if (bend && !(pitMouth && side === -1)) {
      const colors = Math.floor(i / 2) % 2 ? curbsRed : curbsWhite;
      const edgeA = side * wa, edgeB = side * wb;
      strip(colors, a, b, edgeA - (side < 0 ? curbA : 0), edgeA + (side > 0 ? curbA : 0), 0.214,
        edgeB - (side < 0 ? curbB : 0), edgeB + (side > 0 ? curbB : 0));
    }
  }
  const pit = [[-24, 25.04, 25.3], [-17, 21.4, 25.03], [-7, 14.5, 24.82], [5, 6.8, 22.05],
    [19, 2.2, 19.51], [length - 45, 2.2, 19.51], [length - 32, 5.75, 21.96],
    [length - 20, 13.5, 24.84], [length - 10, 24.41, 24.83]];
  const row = s => {
    const [x, z] = at(s, 0);
    return { x, z, nx: f.nx, nz: f.nz };
  };
  for (let i = 1; i < pit.length; i++) {
    const [s, lo, hi] = pit[i - 1], [S, LO, HI] = pit[i];
    strip(paved, row(s), row(S), lo, hi, 0.212, LO, HI);
  }
  for (const [side, start, end] of [[19.7, 21, length - 46], [41.25, 10, length - 12]]) {
    const mid = (start + end) * 0.5, len = end - start;
    box(wall, mid, side, 0.19, len, 1.28, 0.53);
    box(frames, mid, side, 2.69, len - 2, 0.12, 0.095);
    for (let s = start + 1; s < end; s += 4.2) box(frames, s, side, 1.46, 0.12, 1.3, 0.125);
    box(lights, mid, side - 0.27, 0.64, len - 4, 0.11, 0.08);
  }
  const s0 = length * 0.43;
  for (let j = 0; j < 17; j++) for (let i = 0; i < 2; i++) {
    const s = s0 - j * 7.34 - i * 4.21, t = 28.28 + i * 7.1;
    box(grid, s + 0.85, t, 0.220, 0.175, 0.012, 2.61);
    for (const edge of [-1, 1]) box(grid, s - 0.17, t + edge * 1.22, 0.220, 2.08, 0.012, 0.17);
  }
  for (let i = 0; i < 28; i++) for (let j = 0; j < 2; j++) {
    if ((i + j) % 2 === 1) continue;
    box(grid, s0 + 16 + j * 0.54, 24.93 + (i + 0.5) * 0.542, 0.220, 0.54, 0.012, 0.545);
  }
  const gantry = s0 + 18.45;
  for (const side of [22.88, 42.18]) box(frames, gantry, side, 0.14, 0.49, 6.85, 0.62);
  box(frames, gantry, 32.5, 6.71, 1.1, 1.27, 19.9);
  box(lights, gantry - 0.68, 32.5, 7.09, 0.54, 0.52, 15.8);
  const [x, z] = at(gantry - 1.02, 32.5);
  out.add(sign('LAS VEGAS GRAND PRIX', 15.65, 0.96, x, 7.47, z, -f.ax, -f.az,
    { font: `800 125px ${SANS}`, color: '#ef301e' }));
  put(out, paved, stone('#353d4a', '#252e3b'), 'Race straight and Turns 1 to 4');
  put(out, apron, stone('#40717a', '#3e646c'), 'Circuit run-off and apron');
  put(out, curbsRed, stone('#ae3944', '#bd4145'), 'Crimson curb stripes');
  put(out, curbsWhite, stone('#d4d7dd', '#e0e2e5'), 'White curb stripes');
  const paint = stone('#c4c9cf', '#dce0e5');
  paint.polygonOffset = true;
  paint.polygonOffsetFactor = -1;
  paint.polygonOffsetUnits = -4;
  put(out, marking, paint, 'Track edge lines');
  put(out, grid, paint, 'Starting grid and checkered line');
  put(out, wall, stone('#899bb0', '#a3acc4'), 'Pit wall and straight-side barrier');
  put(out, frames, stone('#4a5263'), 'Catch fence posts and light gantry');
  put(out, lights, light('#b4c2d0', '#d7ebff', 0.96), 'Pit wall lights and start gantry');
}

function grandstand(out, f) {
  const lower = new Soup(), rows = new Soup(), fascia = new Soup(), columns = new Soup(), caps = new Soup(), leds = new Soup();
  const { at, box, length } = f, usable = length - 34, mid = length * 0.5, n = 16, pitch = usable / n;
  box(lower, mid, 56.1, 0.14, usable, 2.7, 27.6);
  box(lower, mid, 69.46, 0.19, usable + 1.46, 15.1, 0.78);
  box(fascia, mid, 70.0, 13.24, usable + 1.95, 2.06, 1.42);
  for (let i = 0; i < n; i++) {
    const s = 17 + (i + 0.5) * pitch;
    for (let j = 0; j < 13; j++) {
      box(rows, s, 43.01 + j * 1.477, 2.79 + j * 0.81, pitch - 0.62, 0.74, 1.49);
      box(leds, s, 42.57 + j * 1.477, 3.42 + j * 0.81, pitch - 0.73, 0.09, 0.083);
    }
    box(fascia, s, 69.99, 1.17, pitch - 0.82, 11.77, 0.83);
    box(columns, s + pitch * 0.50, 70.22, 0.20, 0.95, 14.95, 1.02);
    box(columns, s - pitch * 0.50, 60.73, 2.46, 0.28, 13.64, 0.45);
    box(leds, s + pitch * 0.50, 62.1, 13.97, 0.16, 0.19, 7.87);
  }
  box(caps, mid, 63.91, 15.94, usable + 2.2, 0.69, 15.33);
  box(caps, mid, 67.36, 16.55, usable - 4.02, 0.45, 7.82);
  box(leds, mid, 56.4, 15.90, usable + 0.26, 0.13, 0.115);
  for (const s of [34, 71, 140, 199, 245, 272]) {
    const [x, z] = at(s, 61.2);
    out.add(spill(x, 2.98, z, 22, '#fc555a', 0.1));
  }
  put(out, lower, stone('#505568', '#656777'), 'Grandstand raised concourse');
  put(out, rows, stone('#7c424a', '#87474f'), 'Thirteen stepped grandstand rows');
  put(out, fascia, light('#70333e', '#f22b39', 0.49), 'Red main grandstand back and eaves');
  put(out, columns, stone('#8a8390', '#828193'), 'Frame between grandstand bays');
  put(out, caps, stone('#8490ab', '#a3acc0'), 'Cool metal grandstand roof');
  put(out, leds, light('#ac6572', '#fa4954', 0.78), 'Grandstand step lamps');
}

export function buildGrandPrixPlaza(data, options) {
  const out = model('Grand Prix Plaza'), building = named(data, 'Grand Prix Plaza');
  if (!building) return out;
  const f = frameOf(building);
  pitBuilding(out, data, building, options, f);
  raceTrack(out, f);
  grandstand(out, f);
  return out;
}
