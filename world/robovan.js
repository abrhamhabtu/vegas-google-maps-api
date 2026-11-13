import { lamp, paint, profile, surface, wheelDisc, wheelPair } from './robotaxi-geometry.js';

const SIDES = [-1, 1];
const CORNER = Math.PI / 2;
const HALF_TURN = 5 * CORNER;
const span = (from, to, steps) => Array.from({ length: steps + 1 }, (_, i) => from + (to - from) * i / steps);
const mix = (a, b, t) => a + (b - a) * t;

// Side, corner and end patches share this rounded rectangle at every height.
// Closing the outline at the roof gives the paint a continuous shoulder.
function perimeter(angle, { rear, front, half, cornerLength, cornerWidth }) {
  const wrapped = (angle + 3 * HALF_TURN) % (2 * HALF_TURN) - HALF_TURN;
  const station = Math.abs(wrapped) / CORNER;
  const side = wrapped < 0 ? -1 : 1;
  const part = Math.floor(station);
  const t = station - part;
  const sin = Math.sin(t * CORNER), cos = Math.cos(t * CORNER);
  switch (part) {
    case 0: return [front, side * (half - cornerWidth) * t];
    case 1: return [front - cornerLength * (1 - cos), side * (half - cornerWidth * (1 - sin))];
    case 2: return [mix(front - cornerLength, rear + cornerLength, t), side * half];
    case 3: return [rear + cornerLength * (1 - sin), side * (half - cornerWidth * (1 - cos))];
    default: return [rear, side * (half - cornerWidth) * (5 - station)];
  }
}

export function buildRobovan({ size, car, body, front, rear, frontAxle }, brakeMaterial) {
  const { width, height } = size;
  const gold = paint('#d5bb8d', { refl: 0.23, spec: 0.77 });
  const glass = paint('#100f13', { refl: 0.18, spec: 0.66 });
  const skirt = paint('#242126', { refl: 0.10, spec: 0.24 });
  const ribs = paint('#373235', { refl: 0.17, spec: 0.43 });
  const doorEdge = paint('#ead6aa', { refl: 0.41, spec: 0.75 });
  const doorLight = lamp('#ded0b8', '#fff2d9', 0.12);
  const belt = paint('#bda177', { refl: 0.29, spec: 0.72 });
  const white = lamp('#ebf3ff', '#fff7e6', 0.53);
  const red = lamp('#99192d', '#ff364b', 0.42);
  const rubber = paint('#15171b', { refl: 0.025, spec: 0.10 });
  const floor = 0.104, sill = 0.418;

  // Heights and proportions from Tesla's design drawings. The nose slopes
  // back as it rises, while the rear bows out halfway up the body.
  const at = profile([
    [floor, rear + 0.28, front - 0.19, 0.914, 0.31, 0.26],
    [0.156, rear + 0.19, front - 0.10, 0.964, 0.36, 0.29],
    [0.252, rear + 0.115, front - 0.028, 0.991, 0.39, 0.32],
    [0.35, rear + 0.065, front - 0.010, 1.00, 0.40, 0.32],
    [sill, rear + 0.042, front - 0.055, 1.00, 0.40, 0.32],
    [0.78, rear + 0.005, front - 0.28, 0.996, 0.41, 0.32],
    [1.20, rear, front - 0.53, 0.989, 0.42, 0.32],
    [1.57, rear + 0.038, front - 0.77, 0.976, 0.43, 0.32],
    [1.87, rear + 0.135, front - 0.99, 0.955, 0.44, 0.31],
    [2.07, rear + 0.235, front - 1.16, 0.919, 0.44, 0.30],
    [2.20, rear + 0.365, front - 1.35, 0.864, 0.44, 0.28],
    [2.30, rear + 0.54, front - 1.57, 0.770, 0.43, 0.25],
    [2.363, rear + 0.76, front - 1.83, 0.604, 0.42, 0.21],
    [height, rear + 1.06, front - 2.15, 0.002, 0.29, 0.001],
  ]);
  const section = y => {
    const [back, nose, half, cornerLength, cornerWidth] = at(y);
    return { rear: back, front: nose, half: half * width / 2, cornerLength, cornerWidth };
  };
  const point = (y, angle) => {
    const [x, z] = perimeter(angle, section(y));
    return [x, y, z];
  };
  // Derive both tangents from the underlying shell so paint, doors and glass
  // reflect the same contour at their joins.
  const normal = (y, angle) => {
    const [x0, , z0] = point(y, angle - 0.001), [x1, , z1] = point(y, angle + 0.001);
    const low = Math.max(floor, y - 0.002), high = Math.min(height, y + 0.002);
    const [xb, , zb] = point(low, angle), [xt, , zt] = point(high, angle);
    const dx = x1 - x0, dz = z1 - z0, dy = high - low;
    const n = [dy * dz, (zt - zb) * dx - (xt - xb) * dz, -dy * dx];
    const length = Math.hypot(...n);
    return n.map(v => v / length);
  };
  const patch = (parent, material, levels, across, angleAt, offset = 0) => {
    const n = (y, t) => normal(y, angleAt(y, t));
    surface(parent, material, levels, across, (y, t) => {
      const angle = angleAt(y, t), p = point(y, angle);
      return offset ? p.map((v, i) => v + offset * n(y, t)[i]) : p;
    }, n);
  };
  const ring = span(0, 2 * HALF_TURN, 140);
  const shell = (material, from, to, steps, outset = 0) => patch(body, material, span(from, to, steps), ring, (_y, angle) => angle, outset);
  shell(skirt, floor, sill, 10);
  shell(gold, sill, 2.30, 30);
  shell(gold, 2.30, height, 22);
  for (const y of [0.177, 0.221, 0.265, 0.309, 0.353, 0.397]) shell(ribs, y - 0.007, y + 0.007, 1, 0.004);

  // Tall smoked panels flank the uninterrupted gold nose. They continue
  // around the corners and onto the roof with a narrow polished border.
  const glazing = profile([
    [sill, 0.66, 1.95], [1.53, 0.66, 1.95], [2.16, 0.65, 1.94],
    [2.30, 0.65, 1.97], [2.35, 0.65, 2.04], [height, 0.65, 2.14],
  ]);
  const frontGlass = (y, t) => {
    const [start, end] = glazing(y);
    return mix(start, end, t) * CORNER;
  };
  const rearGlass = profile([[sill, 1.10], [1.56, 1.13], [2.17, 1.15], [2.29, 1.27], [2.36, 1.56], [height, 1.95]]);
  const glassLevels = [...span(sill, 2.30, 30), ...span(2.30, height, 22).slice(1)];
  for (const side of SIDES) {
    const angle = (y, t) => side * frontGlass(y, t);
    patch(body, glass, glassLevels, span(0, 1, 23), angle, 0.009);
    patch(body, doorEdge, glassLevels, [0, 1], (y, t) => angle(y, 0.993 + t * 0.017), 0.012);
    const tailAngle = (y, t) => (5 + side * mix(rearGlass(y)[0], 0.43, t)) * CORNER;
    patch(body, glass, glassLevels, span(0, 1, 18), tailAngle, 0.009);
  }

  // Flush double sliding doors. Their opening tapers in toward the roof.
  const door = profile([
    [sill, -1.77, 1.59], [0.78, -1.61, 1.44], [1.42, -1.30, 1.15],
    [1.91, -1.07, 0.94], [2.04, -0.93, 0.80], [2.09, -0.70, 0.56],
    [2.10, -0.54, 0.42],
  ]);
  for (const side of SIDES) {
    const doorAngle = (y, t) => {
      const { rear, front, cornerLength } = section(y);
      const [lo, hi] = door(y), x = mix(lo, hi, t);
      const along = (front - cornerLength - x) / (front - rear - 2 * cornerLength);
      return side * (2 + along) * CORNER;
    };
    const levels = span(sill, 2.10, 34), across = span(0, 1, 12);
    patch(body, glass, levels, across, doorAngle, 0.010);
    patch(body, doorLight, levels, [0, 1], (y, t) => doorAngle(y, -0.010 + t * 0.016), 0.016);
    patch(body, doorLight, levels, [0, 1], (y, t) => doorAngle(y, 0.996 + t * 0.010), 0.016);
    patch(body, doorLight, [2.095, 2.108], across, doorAngle, 0.016);
    patch(body, skirt, levels, [0, 1], (y, t) => doorAngle(y, 0.496 + t * 0.006), 0.016);
  }

  const brake = new window.THREE.Group();
  for (const [i, y] of [1.265, 1.327, 1.389, 1.451, 1.513].entries()) {
    const band = i === 0 ? 0.019 : 0.012;
    shell(belt, y - band, y + band, 1, 0.020);
    const light = (parent, material, from, to, outset) =>
      patch(parent, material, [y - band, y + band], span(from, to, 48), (_y, angle) => angle, outset);
    const end = 2.045 * CORNER, start = frontGlass(y, 0);
    if (i === 0) light(body, white, -end, end, 0.028);
    else {
      light(body, white, start, end, 0.028);
      light(body, white, -end, -start, 0.028);
    }
    for (const [from, to] of [[2.92, 4.59], [5.41, 7.08]]) {
      light(body, red, from * CORNER, to * CORNER, 0.028);
      light(brake, brakeMaterial, from * CORNER, to * CORNER, 0.034);
    }
  }

  const radius = 0.408;
  const face = (wheel, r, z) => wheelDisc(wheel, skirt, z, r * 0.84);
  const wheels = SIDES.flatMap(side => wheelPair(car, side * frontAxle, radius, 0.255, 1.64, rubber, face));
  return { radius, wheels, brake };
}
