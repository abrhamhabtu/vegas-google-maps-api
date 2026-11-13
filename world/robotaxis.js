import { compactCar } from '../landmarks/vendor/cars/models.js';
import { ROBOTAXI_DIMENSIONS } from './robotaxi-dimensions.mjs';
import { badge, canopy, endGlazing, lamp, lowerBody, paint, part, roofPanel, rounded, sidePanel, trace, wheelDisc, wheelPair } from './robotaxi-geometry.js';

const THREE = window.THREE;
const SIDES = [-1, 1];
let sharedMaterials;
function materials() {
  return sharedMaterials ??= {
    rubber: paint('#15191d', { refl: 0.025, spec: 0.08 }),
    trim: paint('#20262b', { refl: 0.12, spec: 0.32 }),
    gloss: paint('#101b24', { refl: 0.38, spec: 0.85 }),
    glass: paint('#192631', { refl: 0.46, spec: 0.9 }),
    darkGlass: paint('#111922', { refl: 0.22, spec: 0.64 }),
    gap: paint('#2f3539', { refl: 0.08, spec: 0.15 }),
    metal: paint('#a7b0b6', { refl: 0.35, spec: 0.70 }),
    whiteLamp: lamp('#e0f0ff', '#f5faff', 0.46),
    redLamp: lamp('#9d1524', '#f41d34', 0.32),
    brakeLamp: lamp('#d61729', '#ff2544', 1.65),
    amberLamp: lamp('#a75a23', '#e78535', 0.17),
    cyanLamp: lamp('#31a7b0', '#55e5ea', 0.24),
    gold: paint('#d0ab73', { refl: 0.26, spec: 0.80 }),
    goldRim: paint('#bf9e66', { refl: 0.38, spec: 0.83 }),
    goldLip: paint('#dfbd84', { refl: 0.39, spec: 0.83 }),
    aloe: paint('#a9cdc5', { refl: 0.22, spec: 0.72 }),
    silver: paint('#d4dbdf', { refl: 0.23, spec: 0.85 }),
    alloy: paint('#636c76', { refl: 0.36, spec: 0.71 }),
  };
}

function vehicle(kind) {
  const size = ROBOTAXI_DIMENSIONS[kind], car = new THREE.Group(), body = new THREE.Group();
  const frontAxle = size.wheelbase / 2, front = size.nose - frontAxle;
  car.name = kind;
  car.add(body);
  return { size, car, body, frontAxle, front, rear: front - size.length };
}

function finish({ car, body, size }, kind, radius, wheels, brake) {
  car.userData = { wheels, body, kind, P: { r: radius }, size, brake };
  // Batch the static body and each rotating wheel by material. Brake lenses
  // stay on the body so the live controller can toggle them independently.
  compactCar(car);
  brake.visible = false;
  body.add(brake);
  return car;
}

function licensePlate(parent, x, y, text, front = false, width = 0.30) {
  const { trim, metal } = materials();
  const s = front ? 1 : -1;
  rounded(parent, trim, x, y, 0, 0.016, 0.161, width + 0.023, 0.007);
  rounded(parent, metal, x + s * 0.01, y, 0, 0.006, 0.132, width, 0.003);
  badge(parent, text, width * 0.8, 0.052, x + s * 0.015, y, 0, s * Math.PI / 2, '#192027');
}

function sideSeam(parent, points, shell, side, material = materials().gap, width = 0.004) {
  trace(parent, points.map(([x, y]) => shell(x, y, side, 0.007)), material, width);
}

function sideWordmark(parent, text, width, height, x, y, sign, shell, color) {
  const outer = Math.max(...[x - width * 0.5, x, x + width * 0.5].map(s => Math.abs(shell(s, y, sign)[2])));
  badge(parent, text, width, height, x, y, sign * (outer + 0.011), sign > 0 ? 0 : Math.PI, color);
}

function lightStrip(parent, points, light, radius = 0.012) {
  trace(parent, points, materials().gloss, radius * 2);
  trace(parent, points.map(([x, y, z]) => [x + Math.sign(x) * radius * 1.7, y + 0.003, z]), light, radius);
}

function cybercab() {
  // Side silhouette and light placement from the Tesla Cybercab Rider Guide.
  const v = vehicle('tesla');
  const { car, body, front, rear, frontAxle: a } = v;
  const { gold, goldRim, goldLip, trim, gap, glass, gloss, darkGlass, whiteLamp, redLamp, amberLamp, brakeLamp, rubber } = materials();
  const rFront = 0.374, rRear = 0.404;
  const lower = lowerBody(body, [
    [rear + 0.018, 0.245, 0.737, 0.920, 0.762],
    [-2.105, 0.223, 0.777, 0.931, 0.815],
    [-1.72, 0.181, 0.809, 0.956, 0.852],
    [-1.36, 0.162, 0.806, 0.966, 0.855],
    [-0.89, 0.157, 0.791, 0.978, 0.838],
    [-0.24, 0.150, 0.773, 0.962, 0.833],
    [0.50, 0.150, 0.776, 0.923, 0.837],
    [1.02, 0.153, 0.795, 0.909, 0.849],
    [1.36, 0.167, 0.804, 0.859, 0.843],
    [1.63, 0.178, 0.780, 0.788, 0.828],
    [1.83, 0.215, 0.756, 0.708, 0.789],
    [1.97, 0.253, 0.697, 0.635, 0.754],
    [front - 0.017, 0.283, 0.649, 0.608, 0.714],
  ], gold, [{ x: -a, radius: rRear, opening: 0.428 }, { x: a, radius: rFront, opening: 0.399 }],
  { crown: 0.026, belly: 0.012, endRound: 0.073, liner: trim });
  const cab = canopy(body, [
    [rear + 0.025, 0.918, 0.766, 0.926, 0.706, 0.022],
    [-1.87, 0.941, 0.778, 1.025, 0.662, 0.032],
    [-1.43, 0.956, 0.775, 1.135, 0.601, 0.042],
    [-0.95, 0.968, 0.769, 1.247, 0.565, 0.047],
    [-0.49, 0.957, 0.763, 1.322, 0.533, 0.052],
    [-0.08, 0.934, 0.762, 1.354, 0.518, 0.054],
    [0.25, 0.926, 0.759, 1.328, 0.518, 0.053],
    [0.54, 0.914, 0.748, 1.244, 0.547, 0.052],
    [0.80, 0.903, 0.728, 1.121, 0.587, 0.044],
    [1.03, 0.894, 0.692, 0.971, 0.630, 0.032],
    [1.14, 0.892, 0.660, 0.896, 0.618, 0.019],
  ], gold);
  roofPanel(body, [[-0.28, 0.25], [-0.24, 0.94], [0.30, 0.96], [0.82, 0.97], [1.09, 0.98], [1.122, 0.91]], cab.top, glass);
  rounded(body, trim, 0, 0.205, 0, 3.25, 0.125, 1.33, 0.047);
  for (const s of SIDES) {
    const window = [
      [-1.50, 1.071, 1.081], [-1.38, 1.043, 1.113], [-1.04, 1.025, 1.199], [-0.53, 1.012, 1.286],
      [0.02, 0.990, 1.330], [0.33, 0.978, 1.281], [0.60, 0.967, 1.183], [0.84, 0.953, 1.050], [0.985, 0.941, 0.949],
    ];
    sidePanel(body, window, cab.side, s, glass);
    sideSeam(body, [[-0.39, 1.317], [-0.47, 1.202], [-0.55, 1.015]], cab.side, s, darkGlass, 0.010);
    sideSeam(body, [[-0.55, 0.968], [-0.62, 0.750], [-0.79, 0.485], [-0.91, 0.274]], lower.side, s);
    sideSeam(body, [[1.02, 0.902], [0.96, 0.788], [0.87, 0.555], [0.81, 0.265]], lower.side, s);
    sidePanel(body, [[-0.93, 0.161, 0.276], [-0.6, 0.152, 0.269], [0.6, 0.154, 0.253], [0.94, 0.156, 0.251]], lower.side, s, trim);
    rounded(body, gap, ...lower.side(-0.56, 0.945, s, 0.008), 0.048, 0.022, 0.018, 0.009);
    rounded(body, gloss, ...lower.side(1.005, 0.840, s, 0.012), 0.094, 0.048, 0.026, 0.014);
    rounded(body, amberLamp, ...lower.side(1.835, 0.386, s, 0.009), 0.021, 0.087, 0.013, 0.005);
  }
  const nose = Array.from({ length: 13 }, (_, i) => {
    const t = i / 6 - 1;
    return [front - 0.007 - 0.172 * t ** 6, 0.594 + 0.077 * t ** 4, t * 0.784];
  });
  lightStrip(body, nose, whiteLamp, 0.010);
  rounded(body, trim, front - 0.047, 0.291, 0, 0.093, 0.152, 1.415, 0.044);
  rounded(body, gloss, front - 0.001, 0.323, 0, 0.017, 0.075, 1.231, 0.015);
  for (const y of [0.300, 0.326, 0.351]) rounded(body, gap, front + 0.007, y, 0, 0.008, 0.006, 1.15, 0.002);
  licensePlate(body, front - 0.012, 0.454, 'CYBERCAB', true, 0.25);
  rounded(body, trim, rear + 0.06, 0.281, 0, 0.127, 0.23, 1.53, 0.063);
  const tail = [[rear + 0.050, 0.881, -0.783], [rear + 0.009, 0.896, -0.657], [rear + 0.002, 0.898, 0],
    [rear + 0.009, 0.896, 0.657], [rear + 0.050, 0.881, 0.783]];
  lightStrip(body, tail, redLamp, 0.010);
  rounded(body, gloss, rear - 0.006, 0.856, 0, 0.017, 0.030, 0.084, 0.008);
  licensePlate(body, rear + 0.005, 0.53, 'CYBERCAB');

  const dish = (wheel, r, z) => {
    const rim = new THREE.LatheGeometry([[0, -0.012], [r * 0.49, -0.018], [r * 0.69, -0.009],
      [r * 0.79, 0.018], [r * 0.83, 0.024], [r * 0.85, 0.014], [r * 0.865, -0.004]]
      .map(([radius, depth]) => new THREE.Vector2(radius, depth)), 40).rotateX(Math.PI / 2);
    part(wheel, rim, goldRim, 0, 0, z);
    wheelDisc(wheel, goldLip, z + 0.003, r * 0.10, 0.014);
    part(wheel, new THREE.TorusGeometry(r * 0.823, 0.009, 6, 36), goldLip, 0, 0, z + 0.017);
  };
  const wheels = [...wheelPair(car, a, rFront, 0.216, 1.492, rubber, dish), ...wheelPair(car, -a, rRear, 0.242, 1.475, rubber, dish)];
  const brake = new THREE.Group();
  trace(brake, tail.map(([x, y, z]) => [x - 0.020, y + 0.004, z]), brakeLamp, 0.012);
  return finish(v, 'robotaxi', rFront, wheels, brake);
}

function ring(x, y, z, h, w) {
  return Array.from({ length: 33 }, (_, i) => {
    const a = i / 32 * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
    return [x, y + h * Math.sign(s) * Math.abs(s) ** 0.55, z + w * Math.sign(c) * Math.abs(c) ** 0.55];
  });
}

function zoox() {
  // Las Vegas service pod. The glazed ends and sliding doors are symmetric.
  const v = vehicle('zoox');
  const { car, body, front, frontAxle: a } = v;
  const { aloe, rubber, trim, gap, gloss, glass, darkGlass, metal, whiteLamp, redLamp, brakeLamp, amberLamp, cyanLamp } = materials();
  const r = 0.346, opening = 0.378, end = front - 0.027;
  const mirrored = rows => [...rows.slice(1).reverse().map(([x, ...rest]) => [-x, ...rest]), ...rows];
  const lower = lowerBody(body, mirrored([
    [0, 0.20, 0.690, 0.995, 0.756], [0.76, 0.207, 0.696, 0.989, 0.765],
    [1.12, 0.213, 0.690, 0.966, 0.754], [1.43, 0.225, 0.660, 0.937, 0.722],
    [1.64, 0.248, 0.604, 0.902, 0.678], [end, 0.274, 0.539, 0.857, 0.619],
  ]), aloe, [{ x: -a, radius: r, opening }, { x: a, radius: r, opening }],
  { crown: 0.015, shoulderRoll: 0.016, endRound: 0.035, endMaterial: trim, liner: trim });
  const cab = canopy(body, mirrored([
    [0, 0.978, 0.745, 1.747, 0.693, 0.129], [0.76, 0.975, 0.752, 1.737, 0.696, 0.132],
    [1.10, 0.953, 0.744, 1.703, 0.688, 0.146], [1.38, 0.931, 0.705, 1.665, 0.649, 0.143],
    [1.56, 0.906, 0.675, 1.617, 0.617, 0.128], [1.70, 0.878, 0.620, 1.529, 0.558, 0.111],
  ]), aloe, 0.051);
  rounded(body, trim, 0, 0.244, 0, 2.91, 0.137, 1.14, 0.062);
  roofPanel(body, [[-1.21, 0.22], [-1.05, 0.73], [1.05, 0.73], [1.21, 0.22]], cab.top, darkGlass, 0.005);
  const doorSkin = (x, y, s, outset = 0) => {
    const t = Math.max(0, Math.min(1, (y - 0.34) / 1.35));
    const lo = Math.abs(lower.side(x, 0.51)[2]), hi = Math.abs(cab.side(x, 1.69)[2]);
    return [x, y, s * (lo + (hi - lo) * t + 0.051 * Math.sin(Math.PI * t) + outset)];
  };
  const brake = new THREE.Group();
  for (const s of SIDES) {
    const doors = mirrored([
      [0, 0.340, 1.687], [0.69, 0.344, 1.675], [0.814, 0.365, 1.638], [0.865, 0.410, 1.558],
    ]);
    sidePanel(body, doors, doorSkin, s, glass, 0.009, 15);
    for (const sign of SIDES) {
      const panes = [[0.967, 1.013, 1.536], [1.10, 1.010, 1.621], [1.31, 1.008, 1.586], [1.50, 1.026, 1.481], [1.56, 1.079, 1.404]]
        .map(([x, lo, hi]) => [x * sign, lo, hi]).sort((p, q) => p[0] - q[0]);
      sidePanel(body, panes, cab.side, s, darkGlass);
      sideSeam(body, [[sign * 0.908, 0.334], [sign * 0.901, 0.583], [sign * 0.884, 0.977]], lower.side, s, gap, 0.0045);
      const fender = Array.from({ length: 19 }, (_, i) => {
        const angle = Math.PI * i / 18;
        return [sign * a + Math.cos(angle) * opening, r + Math.sin(angle) * opening, s * 0.800];
      });
      trace(body, fender, trim, 0.022, 30);
    }
    sideSeam(body, [[0, 0.351], [0, 0.625], [0, 1], [0, 1.335], [0, 1.687]], doorSkin, s, trim, 0.009);
    rounded(body, trim, ...doorSkin(-0.092, 0.688, s, 0.017), 0.114, 0.025, 0.013, 0.005);
    sideWordmark(body, 'Z O O X', 0.27, 0.060, s * -0.564, 0.60, s, doorSkin, '#d3e4df');
  }
  for (const dir of SIDES) {
    rounded(body, trim, dir * (front - 0.037), 0.539, 0, 0.07, 0.521, 1.195, 0.038);
    endGlazing(body, cab, dir, glass);
    const visor = [-0.88, -0.48, 0, 0.48, 0.88];
    trace(body, visor.map(a => cab.end(dir, a, 0.913, 0.012)), gloss, 0.015);
    trace(body, visor.map(a => cab.end(dir, a, 0.895, 0.018)), cyanLamp, 0.0045);
    rounded(body, darkGlass, dir * (front - 0.013), 0.619, 0, 0.033, 0.105, 0.57, 0.017);
    badge(body, 'Z O O X', 0.172, 0.038, dir * (front + 0.01), 0.681, dir * 0.15, dir * Math.PI / 2, '#e8a276');
    licensePlate(body, dir * (front - 0.015), 0.406, 'ZOOX', dir > 0, 0.245);
    for (const s of SIDES) {
      const z = s * 0.458, head = dir > 0 ? whiteLamp : redLamp;
      rounded(body, trim, dir * (front - 0.017), 0.659, z, 0.041, 0.169, 0.156, 0.019);
      trace(body, ring(dir * (front + 0.006), 0.659, z, 0.058, 0.054), head, 0.011, 42);
      rounded(body, amberLamp, dir * (front - 0.005), 0.497, s * 0.48, 0.012, 0.031, 0.038, 0.005);
      if (dir < 0) trace(brake, ring(-front - 0.011, 0.659, z, 0.058, 0.054), brakeLamp, 0.012, 42);

      const px = dir * 1.492, pz = s * 0.763;
      rounded(body, trim, px, 1.685, pz, 0.306, 0.163, 0.221, 0.073);
      rounded(body, darkGlass, px + dir * 0.089, 1.678, pz + s * 0.061, 0.144, 0.083, 0.101, 0.029);
      part(body, new THREE.CylinderGeometry(0.070, 0.083, 0.046, 24), trim, px, 1.778, pz);
      part(body, new THREE.CylinderGeometry(0.060, 0.064, 0.137, 28), darkGlass, px, 1.865, pz);
      part(body, new THREE.CylinderGeometry(0.061, 0.061, 0.018, 28), trim, px, 1.940, pz);
      rounded(body, cyanLamp, px + dir * 0.105, 1.754, pz, 0.051, 0.009, 0.065, 0.004);
    }
    rounded(body, trim, dir * 0.57, 1.885, 0, 0.116, 0.046, 0.12, 0.019);
  }
  const face = (wheel, radius, z) => {
    wheelDisc(wheel, trim, z - 0.003, radius * 0.863, 0.034);
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI * (i + 0.50) / 2;
      const spoke = rounded(wheel, metal, Math.cos(angle) * radius * 0.42, Math.sin(angle) * radius * 0.42, z + 0.014,
        radius * 0.71, radius * 0.20, 0.024, 0.011);
      spoke.rotation.z = angle;
    }
    wheelDisc(wheel, trim, z + 0.028, radius * 0.172, 0.022);
    wheelDisc(wheel, metal, z + 0.041, radius * 0.105, 0.009);
  };
  const wheels = SIDES.flatMap(dir => wheelPair(car, dir * a, r, 0.206, 1.485, rubber, face));
  return finish(v, 'zoox', r, wheels, brake);
}

function ojai() {
  const v = vehicle('waymo');
  const { car, body, front, rear, frontAxle: a } = v;
  const { silver, alloy, metal, rubber, trim, gap, glass, darkGlass, gloss, whiteLamp, redLamp, brakeLamp, amberLamp } = materials();
  const r = 0.412, tailSill = 1.120, endRound = 0.233;
  // The silver Ojai has a convex painted bumper, then a short black hood.
  // Pull the bottom of both ends in and lean the rear hatch forward at the roof.
  const rake = (x, y) => {
    const nose = Math.max(0, 1 - (front - x) / 0.52);
    const tail = Math.max(0, 1 - (x - rear) / 0.52);
    const chin = Math.max(0, (0.43 - y) / 0.2), brow = Math.max(0, (y - 0.54) / 0.42);
    const roof = Math.max(0, (y - tailSill) / 0.60);
    return nose * nose * (0.018 - 0.058 * chin * chin - 0.039 * brow * brow) +
      tail * tail * (0.037 * chin * chin + 0.105 * roof * roof);
  };
  const lower = lowerBody(body, [
    [rear + 0.022, 0.255, 0.747, tailSill, 0.785], [-2.31, 0.223, 0.841, 1.103, 0.859],
    [-2.08, 0.188, 0.876, 1.083, 0.928], [-1.68, 0.160, 0.887, 1.072, 0.959],
    [-1.39, 0.158, 0.868, 1.102, 0.950], [-1.12, 0.151, 0.859, 1.176, 0.936],
    [-0.28, 0.150, 0.864, 1.173, 0.928], [0.57, 0.151, 0.865, 1.171, 0.937],
    [1.15, 0.163, 0.880, 1.158, 0.948], [1.61, 0.169, 0.891, 1.105, 0.957],
    [1.91, 0.180, 0.877, 1.022, 0.944], [2.13, 0.196, 0.843, 0.942, 0.917],
    [2.29, 0.213, 0.811, 0.897, 0.874], [front - 0.014, 0.241, 0.767, 0.869, 0.824],
  ], silver, [{ x: -a, radius: r, opening: 0.455 }, { x: a, radius: r, opening: 0.478 }],
  { crown: 0.043, belly: 0.016, shoulderRoll: 0.024, endRound, endBlend: 0.54, rake, liner: trim });
  const cab = canopy(body, [
    [rear + 0.022, tailSill, 0.785, 1.613, 0.695, 0.105], [-2.31, 1.097, 0.840, 1.706, 0.745, 0.089],
    [-2.08, 1.076, 0.900, 1.767, 0.777, 0.082], [-1.68, 1.063, 0.925, 1.788, 0.793, 0.079],
    [-1.39, 1.093, 0.922, 1.790, 0.792, 0.078], [-1.12, 1.166, 0.913, 1.790, 0.787, 0.079],
    [-0.28, 1.162, 0.913, 1.789, 0.789, 0.085], [0.35, 1.158, 0.911, 1.784, 0.772, 0.084],
    [0.68, 1.151, 0.910, 1.753, 0.748, 0.083], [0.86, 1.146, 0.902, 1.664, 0.736, 0.078],
    [1.10, 1.136, 0.885, 1.474, 0.735, 0.070], [1.32, 1.124, 0.875, 1.303, 0.730, 0.052],
    [1.55, 1.104, 0.852, 1.143, 0.721, 0.035], [1.65, 1.083, 0.830, 1.090, 0.711, 0.030],
  ], silver, endRound, rake);
  rounded(body, trim, -0.05, 0.208, 0, 3.86, 0.125, 1.42, 0.043);

  roofPanel(body, [[0.709, 0.79], [0.768, 0.984], [0.9, 1], [1.24, 1], [1.56, 1], [1.645, 0.98]], cab.top, glass);
  roofPanel(body, [[-2.11, 0.24], [-1.96, 0.634], [-0.38, 0.646], [0.15, 0.42]], cab.top, darkGlass, 0.006);
  for (const s of SIDES) {
    const windows = [[-1.83, 1.206, 1.628], [-1.76, 1.114, 1.715], [-1.60, 1.102, 1.737],
      [-1.36, 1.136, 1.741], [-1.11, 1.196, 1.746], [-0.61, 1.192, 1.746],
      [0.12, 1.191, 1.740], [0.55, 1.184, 1.710], [0.69, 1.178, 1.675],
      [0.83, 1.177, 1.603], [1.06, 1.169, 1.447], [1.27, 1.160, 1.289], [1.48, 1.147, 1.160]];
    sidePanel(body, windows, cab.side, s, darkGlass);
    sidePanel(body, [[0.77, 1.635, 1.704], [0.86, 1.574, 1.664], [1.10, 1.411, 1.474],
      [1.32, 1.252, 1.303], [1.55, 1.111, 1.143], [1.645, 1.086, 1.093]], cab.side, s, gloss, 0.010, 7);
    for (const [x, y, top] of [[-1.02, 1.197, 1.743], [-0.25, 1.194, 1.743], [0.70, 1.184, 1.676]]) {
      sideSeam(body, [[x + 0.05, y], [x, (y + top) / 2], [x - 0.045, top]], cab.side, s, trim, 0.007);
    }

    // Sliding door joins sit below the glass and above the low sculpted sill.
    sideSeam(body, [[-1.42, 0.325], [-1.36, 0.612], [-1.37, 0.878], [-1.42, 1.097]], lower.side, s, gap, 0.0028);
    sideSeam(body, [[-0.19, 0.173], [-0.21, 0.443], [-0.20, 0.793], [-0.22, 1.162]], lower.side, s, gap, 0.003);
    sideSeam(body, [[1.03, 0.173], [1.071, 0.48], [1.04, 0.84], [0.91, 1.163]], lower.side, s, gap, 0.003);
    for (const x of [-0.37, -0.035]) rounded(body, trim, ...lower.side(x, 1.094, s, 0.011), 0.216, 0.047, 0.022, 0.012);
    sidePanel(body, [[-1.10, 0.183, 0.215], [-0.87, 0.174, 0.232], [0.75, 0.174, 0.233], [1.05, 0.187, 0.218]],
      lower.side, s, silver, 0.009, 4);
    sideWordmark(body, 'W A Y M O', 0.92, 0.158, 0.48, 0.859, s, lower.side, '#ffffff');

    rounded(body, trim, 1.613, 1.033, s * 0.913, 0.509, 0.242, 0.168, 0.074);
    rounded(body, gloss, 1.628, 1.035, s * 0.986, 0.432, 0.181, 0.027, 0.036);
    for (const x of [1.482, 1.760]) {
      rounded(body, darkGlass, x, 1.037, s * 0.998, 0.100, 0.093, 0.015, 0.009);
      part(body, new THREE.SphereGeometry(0.029, 14, 9), glass, x, 1.037, s * 1.008).scale.set(1, 1, 0.22);
    }
    const mirrorArm = rounded(body, trim, 0.801, 1.150, s * 0.936, 0.126, 0.114, 0.13, 0.03);
    mirrorArm.rotation.z = -0.25;
    rounded(body, silver, 0.794, 1.230, s * 0.945, 0.227, 0.116, 0.133, 0.040);
    rounded(body, gloss, 0.680, 1.232, s * 0.945, 0.019, 0.080, 0.105, 0.009);
    const marker = rounded(body, amberLamp, ...lower.side(2.093, 0.510, s, 0.012), 0.029, 0.115, 0.013, 0.006);
    marker.rotation.z = -0.28;

    rounded(body, trim, -2.197, 1.486, s * 0.847, 0.303, 0.292, 0.207, 0.067);
    rounded(body, gloss, -2.220, 1.486, s * 0.944, 0.226, 0.214, 0.023, 0.021);
    rounded(body, darkGlass, -2.342, 1.500, s * 0.866, 0.022, 0.210, 0.140, 0.013);
    const rearMarker = rounded(body, redLamp, ...lower.side(-2.135, 0.550, s, 0.011), 0.027, 0.106, 0.014, 0.006);
    rearMarker.rotation.z = 0.32;
  }

  // The front sensor bar is tucked into the roof with the short lidar on top.
  rounded(body, silver, 0.61, 1.857, 0, 0.470, 0.120, 1.525, 0.056);
  rounded(body, trim, 0.758, 1.867, 0, 0.422, 0.163, 1.520, 0.070);
  rounded(body, gloss, 0.935, 1.870, 0, 0.103, 0.137, 1.452, 0.043);
  for (const z of [-0.604, -0.407, 0.407, 0.604]) {
    rounded(body, darkGlass, 0.983, 1.873, z, 0.020, 0.081, 0.125, 0.009);
    part(body, new THREE.SphereGeometry(0.029, 14, 10), glass, 0.994, 1.874, z).scale.set(0.37, 1, 1);
  }
  badge(body, 'W A Y M O', 0.40, 0.068, 0.991, 1.873, 0, Math.PI / 2);
  part(body, new THREE.CylinderGeometry(0.118, 0.136, 0.034, 32), trim, 0.535, 1.916, 0);
  part(body, new THREE.CylinderGeometry(0.114, 0.118, 0.092, 32), darkGlass, 0.535, 1.970, 0);
  part(body, new THREE.CylinderGeometry(0.115, 0.116, 0.011, 32), trim, 0.535, 2.014, 0);

  roofPanel(body, [[1.58, 0.77], [1.66, 0.90], [1.81, 0.958], [2.10, 0.960], [2.29, 0.921], [front - 0.015, 0.848]],
    lower.top, gloss, 0.008);
  const hoodAt = (x, across, sign, lift) => lower.top(x, across * sign, lift);
  for (const s of SIDES) {
    sidePanel(body, [[1.917, 0.560, 0.835], [1.985, 0.492, 0.894], [2.151, 0.480, 0.887],
      [2.258, 0.506, 0.829], [2.285, 0.563, 0.751]], hoodAt, s, trim, 0.016, 7);
    sidePanel(body, [[1.964, 0.569, 0.826], [2.016, 0.526, 0.858], [2.170, 0.523, 0.831], [2.235, 0.562, 0.778]],
      hoodAt, s, glass, 0.024, 7);
    // Individual headlamp elements and a narrow curved daytime running light.
    for (const u of [0.598, 0.684, 0.77]) {
      trace(body, [[2.052, u - 0.013], [2.103, u], [2.139, u - 0.009]]
        .map(([x, z]) => hoodAt(x, z, s, 0.032)), whiteLamp, 0.012, 8);
    }
    trace(body, [[1.983, 0.842], [2.036, 0.853], [2.139, 0.839], [2.222, 0.792], [2.25, 0.722], [2.252, 0.585]]
      .map(([x, u]) => hoodAt(x, u, s, 0.033)), whiteLamp, 0.008, 20);
    trace(body, [[1.621, -0.11], [1.595, 0.25], [1.587, 0.58], [1.609, 0.77]]
      .map(([x, u]) => cab.top(x, u * s, 0.014)), trim, 0.010, 10);
  }
  const frontAt = (z, y, _s, outset = 0) => lower.endAt(1, y, z, outset);
  const rearAt = (z, y, _s, outset = 0) => (y < tailSill ? lower : cab).endAt(-1, y, z, outset);
  const mirrorRows = rows => [...rows.slice(1).reverse().map(([z, lo, hi]) => [-z, lo, hi]), ...rows];
  sidePanel(body, mirrorRows([[0, 0.278, 0.409], [0.25, 0.280, 0.407], [0.49, 0.291, 0.405], [0.613, 0.310, 0.389],
    [0.648, 0.335, 0.364]]), frontAt, 1, trim, 0.007, 7);
  sidePanel(body, mirrorRows([[0, 0.296, 0.389], [0.45, 0.304, 0.385], [0.585, 0.320, 0.373], [0.619, 0.339, 0.354]]),
    frontAt, 1, darkGlass, 0.011, 5);
  for (const z of [-0.49, -0.33, -0.17, 0.17, 0.33, 0.49]) {
    trace(body, [0.303, 0.341, 0.385].map(y => frontAt(z, y, 1, 0.017)), gloss, 0.009, 5);
  }
  const nosePod = rounded(body, trim, ...frontAt(0, 0.623, 1, 0.003), 0.083, 0.264, 0.143, 0.038);
  nosePod.rotation.z = 0.12;
  rounded(body, gloss, ...frontAt(0, 0.651, 1, 0.042), 0.020, 0.151, 0.091, 0.010);
  rounded(body, darkGlass, ...frontAt(0, 0.706, 1, 0.046), 0.019, 0.063, 0.091, 0.009);
  licensePlate(body, frontAt(0, 0.441, 1, 0.015)[0], 0.441, 'WAYMO', true, 0.245);

  // The Ojai has a tall, rounded black tailgate with two inset red strips.
  sidePanel(body, mirrorRows([[0, 0.740, 1.675], [0.33, 0.750, 1.655], [0.54, 0.778, 1.619],
    [0.634, 0.839, 1.578], [0.684, 0.930, 1.531], [0.698, 1.028, 1.465]]), rearAt, 1, gloss, 0.016, 20);
  const rearWindow = mirrorRows([[0, 1.247, 1.655], [0.34, 1.246, 1.635], [0.54, 1.244, 1.596],
    [0.625, 1.241, 1.547], [0.671, 1.240, 1.471]]);
  sidePanel(body, rearWindow, rearAt, 1, darkGlass, 0.020, 10);
  badge(body, 'W A Y M O', 0.47, 0.104, rearAt(0, 1.496, 1, 0.024)[0], 1.496, 0, -Math.PI / 2);
  badge(body, 'Ojai', 0.155, 0.052, rearAt(-0.51, 1.030, 1, 0.032)[0], 1.030, -0.51, -Math.PI / 2);
  licensePlate(body, rearAt(0, 0.549, 1, 0.010)[0], 0.549, 'WAYMO', false, 0.274);
  sidePanel(body, mirrorRows([[0, 0.350, 0.381], [0.42, 0.352, 0.379], [0.627, 0.357, 0.376], [0.673, 0.364, 0.369]]),
    rearAt, 1, trim, 0.008, 3);
  const brake = new THREE.Group();
  for (const s of SIDES) {
    const strip = [[0.155, 1.235], [0.322, 1.232], [0.51, 1.220], [0.639, 1.201]];
    trace(body, strip.map(([z, y]) => rearAt(s * z, y, 1, 0.024)), redLamp, 0.013, 16);
    trace(brake, strip.map(([z, y]) => rearAt(s * z, y, 1, 0.031)), brakeLamp, 0.013, 16);
  }
  const face = (wheel, radius, z) => {
    wheelDisc(wheel, trim, z, radius * 0.857, 0.030);
    part(wheel, new THREE.TorusGeometry(radius * 0.795, 0.009, 6, 36), gap, 0, 0, z + 0.013);
    for (let i = 0; i < 4; i++) {
      const angle = (i + 0.5) * Math.PI / 2;
      const vane = rounded(wheel, gap, Math.cos(angle) * radius * 0.508, Math.sin(angle) * radius * 0.508, z + 0.017,
        radius * 0.524, radius * 0.453, 0.025, 0.011);
      vane.rotation.z = angle;
      const edge = rounded(wheel, alloy, Math.cos(angle) * radius * 0.677, Math.sin(angle) * radius * 0.677, z + 0.029,
        radius * 0.129, radius * 0.343, 0.010, 0.004);
      edge.rotation.z = angle;
    }
    const cap = rounded(wheel, trim, 0, 0, z + 0.022, radius * 0.355, radius * 0.355, 0.044, 0.025);
    cap.rotation.z = Math.PI / 4;
    wheelDisc(wheel, metal, z + 0.044, radius * 0.065, 0.006);
  };
  const wheels = SIDES.flatMap(dir => wheelPair(car, dir * a, r, 0.238, 1.630, rubber, face));
  return finish(v, 'waymo', r, wheels, brake);
}

export function buildRobotaxiModel(kind) {
  if (kind === 'tesla') return cybercab();
  if (kind === 'zoox') return zoox();
  if (kind === 'waymo') return ojai();
}
