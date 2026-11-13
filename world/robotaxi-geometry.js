import { RoundedBoxGeometry } from '../landmarks/vendor/three/RoundedBoxGeometry.js';
import { sheen, textPanel } from '../landmarks/vendor/landmarks/sheen.js';

const THREE = window.THREE;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = t => Math.max(0, Math.min(1, t));
const even = (n, from = 0, to = 1) => Array.from({ length: n + 1 }, (_, i) => lerp(from, to, i / n));

// A monotone cubic through measured/profile stations keeps a nose or roof from
// bulging past its outer dimensions between control points.
function profile(rows) {
  const slopes = rows.slice(1).map((b, i) => rows[i].slice(1).map((a, j) => (b[j + 1] - a) / (b[0] - rows[i][0])));
  const tangents = rows.map((_, i) => {
    if (i === 0 || i === rows.length - 1) return slopes[i === 0 ? 0 : i - 1];
    return slopes[i - 1].map((a, j) => {
      const b = slopes[i][j];
      return a * b > 0 ? 2 * a * b / (a + b) : 0;
    });
  });
  return x => {
    const end = rows.findIndex(([s]) => s >= x);
    const i = end < 0 ? rows.length - 2 : Math.max(0, end - 1);
    const [a, b] = [rows[i], rows[i + 1]], length = b[0] - a[0];
    const t = clamp((x - a[0]) / length), u = 1 - t;
    return a.slice(1).map((v, j) => lerp(v, b[j + 1], t * t * (3 - 2 * t)) +
      length * (tangents[i][j] * t * u * u - tangents[i + 1][j] * t * t * u));
  };
}

function stations(rows, step = 0.075, extra = []) {
  const from = rows[0][0], to = rows.at(-1)[0];
  return [...new Set([...rows.map(([x]) => x), ...even(Math.ceil((to - from) / step), from, to), ...extra])]
    .filter(x => x >= from && x <= to).sort((a, b) => a - b)
    .filter((x, i, all) => !i || x - all[i - 1] > 1e-5);
}

function roundEnds(xs, radius, blend = Math.max(0.13, radius * 3), rake = () => 0) {
  const rear = xs[0], front = xs.at(-1);
  return (x, across, y) => {
    const a = clamp(1 - (x - rear) / blend), b = clamp(1 - (front - x) / blend);
    return x + radius * (a * a - b * b) * Math.abs(across) ** 3 + rake(x, y);
  };
}

function surface(parent, material, xs, across, point) {
  const pos = [], index = [], n = across.length;
  for (const x of xs) for (const t of across) pos.push(...point(x, t));
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < n; j++) {
    const a = (i - 1) * n + j - 1, b = a + 1, c = a + n, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}

export function paint(color, options = {}) {
  return sheen(color, { refl: 0.21, spec: 0.65, ...options });
}

export function lamp(color, glow, baseGlow = 0.34) {
  return sheen(color, { glow, baseGlow, glowK: 0.65, refl: 0.14, spec: 0.85 });
}

export function part(parent, geometry, mat, x, y, z) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export function rounded(parent, mat, x, y, z, length, height, width, radius = 0.04) {
  const segments = Math.max(length, height, width) > 0.28 ? 2 : 1;
  return part(parent, new RoundedBoxGeometry(length, height, width, segments, radius), mat, x, y, z);
}

export function trace(parent, points, mat, radius = 0.008, steps = points.length * 3) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return part(parent, new THREE.TubeGeometry(curve, steps, radius, 5, false), mat, 0, 0, 0);
}

export function badge(parent, text, w, h, x, y, z, yaw, color = '#f4f6f5') {
  const mesh = textPanel(text, w, h, { font: '600 118px Arial', color });
  mesh.position.set(x, y, z);
  mesh.rotation.y = yaw;
  parent.add(mesh);
  return mesh;
}

// Section fields are x, sill height and half-width, shoulder height and half-width.
export function lowerBody(parent, rows, material, wells, {
  crown = 0.04, belly = 0.018, shoulderRoll = 0.022, endRound = 0.065, endBlend, rake,
  endMaterial = material, liner,
} = {}) {
  const at = profile(rows);
  const arch = (x, floor) => {
    for (const { x: axle, radius, opening } of wells) {
      const dx = Math.abs(x - axle);
      if (dx <= opening) return Math.max(floor, radius + Math.sqrt(opening * opening - dx * dx));
      if (dx <= opening + 0.018) return lerp(radius, floor, (dx - opening) / 0.018);
    }
    return floor;
  };
  const archStations = ({ x, opening }) => [x - opening - 0.018, ...even(20, Math.PI, 0).map(a => x + opening * Math.cos(a)), x + opening + 0.018];
  const arcStations = wells.flatMap(archStations);
  const xs = stations(rows, 0.08, arcStations);
  const xAt = roundEnds(xs, endRound, endBlend, rake);
  const widthAt = (x, y) => {
    const [low, sill, high, shoulder] = at(x);
    const t = clamp((y - low) / Math.max(0.01, high - low));
    if (t > 0.80) return shoulder + shoulderRoll * Math.sqrt(Math.max(0, 1 - ((t - 0.80) / 0.20) ** 2));
    const round = t / 0.80;
    return lerp(sill, shoulder + shoulderRoll, Math.sin(round * Math.PI / 2)) + belly * Math.sin(round * Math.PI) ** 2;
  };
  const side = (x, y, sign = 1, outset = 0) => [xAt(x, 1, y), y, (widthAt(x, y) + outset) * sign];
  const top = (x, across, lift = 0) => {
    const [, , shoulder, w] = at(x);
    const y = shoulder + crown * (1 - across * across);
    return [xAt(x, across, y), y + lift, w * across];
  };
  const endAt = (dir, y, z, outset = 0) => {
    const x = dir > 0 ? xs.at(-1) : xs[0];
    return [xAt(x, z / widthAt(x, y), y) + dir * outset, y, z];
  };
  for (const sign of [-1, 1]) {
    surface(parent, material, xs, [0, 0.125, 0.25, 0.375, 0.50, 0.625, 0.75, 0.875, 0.95, 0.99, 1], (x, t) => {
      const [low, , high] = at(x);
      return side(x, lerp(Math.min(high - 0.001, arch(x, low)), high, t), sign);
    });
    if (liner) for (const well of wells) {
      surface(parent, liner, archStations(well), [0, 1], (x, t) => {
        const [low, , high] = at(x), y = Math.min(high - 0.001, arch(x, low));
        return [xAt(x, 1, y), y - 0.002, sign * (widthAt(x, y) - t * 0.105)];
      });
    }
  }
  surface(parent, material, xs, even(14, -1, 1), top);
  for (const x of [xs[0], xs.at(-1)]) {
    const [low, , high, w] = at(x);
    surface(parent, endMaterial, even(16, -1, 1), even(9), (a, t) => {
      const y = lerp(low, high + crown * (1 - a * a), t);
      const half = t === 1 ? w : widthAt(x, y);
      return [xAt(x, a, y), y, half * a];
    });
  }
  return { side, top, endAt };
}

// Section fields are x, glass sill height and half-width, roof edge height and
// half-width, and roof crown. Glass and paint share this surface.
export function canopy(parent, rows, material, endRound = 0.038, rake) {
  const at = profile(rows), xs = stations(rows);
  const xAt = roundEnds(xs, endRound, undefined, rake);
  const sideWidth = (x, y) => {
    const [low, base, high, eave] = at(x);
    const t = clamp((y - low) / Math.max(0.001, high - low));
    return lerp(base, eave, t) + 0.016 * Math.sin(Math.PI * t);
  };
  const side = (x, y, sign = 1, outset = 0) => {
    return [xAt(x, 1, y), y, (sideWidth(x, y) + outset) * sign];
  };
  const top = (x, a, lift = 0) => {
    const [, , edge, half, crown] = at(x);
    const y = edge + crown * (1 - a * a);
    return [xAt(x, a, y), y + lift, half * a];
  };
  for (const sign of [-1, 1]) {
    surface(parent, material, xs, even(8), (x, t) => {
      const [low, , high] = at(x);
      return side(x, lerp(low, high, t), sign);
    });
  }
  surface(parent, material, xs, even(16, -1, 1), top);
  const end = (dir, a, t, outset = 0) => {
    const x = dir > 0 ? xs.at(-1) : xs[0];
    const [low, , high, , crown] = at(x);
    const y = lerp(low, high + crown * (1 - a * a), t);
    return [xAt(x, a, y) + dir * outset, y, a * sideWidth(x, y)];
  };
  const endAt = (dir, y, z, outset = 0) => {
    const x = dir > 0 ? xs.at(-1) : xs[0];
    return [xAt(x, z / sideWidth(x, y), y) + dir * outset, y, z];
  };
  for (const dir of [-1, 1]) surface(parent, material, even(18, -1, 1), even(9), (a, t) => end(dir, a, t));
  return { side, top, end, endAt };
}

export function sidePanel(parent, rows, skin, sign, material, outset = 0.006, heightSteps = 9) {
  const at = profile(rows);
  return surface(parent, material, stations(rows, 0.05), even(heightSteps), (x, t) => {
    const [low, high] = at(x);
    return skin(x, lerp(low, high, t), sign, outset);
  });
}

export function endGlazing(parent, cab, dir, material) {
  return surface(parent, material, even(24, -1, 1), even(16), (a, t) => {
    const round = 0.91 + 0.058 * Math.sin(Math.PI * t) ** 0.4;
    return cab.end(dir, a * round, lerp(0.022, 0.96, t), 0.007);
  });
}

export function roofPanel(parent, rows, skin, material, lift = 0.006) {
  const at = profile(rows);
  return surface(parent, material, stations(rows, 0.04), even(16, -1, 1), (x, t) => skin(x, t * at(x)[0], lift));
}

export function wheelPair(car, axle, radius, width, track, tyre, face) {
  const pivots = [];
  const points = [[0.69, -0.49], [0.88, -0.51], [0.95, -0.44], [0.99, -0.31], [1, -0.16],
    [1, 0.16], [0.99, 0.31], [0.95, 0.44], [0.88, 0.51], [0.69, 0.49], [0.69, -0.49]];
  const rubber = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r * radius, z * width)), 36).rotateX(Math.PI / 2);
  for (const sign of [-1, 1]) {
    const pivot = new THREE.Group(), spin = new THREE.Group();
    pivot.position.set(axle, radius, sign * track / 2);
    spin.rotation.y = sign < 0 ? Math.PI : 0;
    part(spin, rubber, tyre, 0, 0, 0);
    face(spin, radius, width * 0.51);
    pivot.add(spin);
    pivot.userData = { front: axle > 0, spin, side: sign, radius };
    car.add(pivot);
    pivots.push(pivot);
  }
  return pivots;
}

export function wheelDisc(parent, mat, z, radius, thickness = 0.018) {
  const geometry = new THREE.CylinderGeometry(radius, radius, thickness, 36).rotateX(Math.PI / 2);
  return part(parent, geometry, mat, 0, 0, z);
}
