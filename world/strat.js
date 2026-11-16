/** The STRAT, on its mapped tower pad. Heights are metres above the Strip. */
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { theme } from '../landmarks/vendor/core/theme.js';
import { MODE, Soup, SANS, WHITE, area, centroid, clean, facade, inset, offset, sign, spill } from './hero-kit.js';
import { addShape, along, faces, mapped, material, model, named, own, parapet, put, standalonePodium } from './landmark-forms.js';

const THREE = window.THREE;
const TAU = 2 * Math.PI, FRONT = Math.PI / 3;
const HEIGHT = 1149 * 0.3048;
const UP = new THREE.Vector3(0, 1, 0);
const polar = (radius, y, angle) => new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
const ellipse = (radius, segments = 48) => Array.from({ length: segments }, (_, i) => {
  const a = i * TAU / segments;
  return [Math.cos(a) * radius, Math.sin(a) * radius];
});
const DECKS = new Map([['big shot', 284], ['x-scream', 265], ['top of the world', 268], ['skyjump', 264]]);
export function stratDeckAltitude({ n, x, z }) {
  return Math.hypot(x - 1713, z + 3470) < 40 ? DECKS.get(n.toLowerCase()) : undefined;
}

function skin(group, profile, mat, name, segments = 72) {
  const geometry = new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(r, y)), segments);
  return addShape(group, geometry, mat, name, 0, 0, 0);
}

function bars(group) {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const axis = new THREE.Vector3();
  return (p, q, radius, mat) => {
    const mesh = new THREE.Mesh(geometry, mat);
    const length = axis.subVectors(q, p).length();
    mesh.position.lerpVectors(p, q, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, axis.normalize());
    mesh.scale.set(radius, length, radius);
    group.add(mesh);
  };
}

function box(group, name, mat, dimensions, pos, turn = 0) {
  const mesh = addShape(group, new THREE.BoxGeometry(...dimensions), mat, name, pos.x, pos.y, pos.z);
  mesh.rotation.y = turn;
  return mesh;
}

// y, radial offset, tangential half-width, radial thickness. The three
// concrete legs pull into the central shaft, then part again below the head.
const FEET = [
  [0.36, 21.1, 3.95, 7.15], [14, 20.7, 4.15, 6.9], [36, 19.1, 4.45, 7.3],
  [61, 17.0, 4.7, 7.6], [79, 14.8, 4.75, 8.1], [96, 12.1, 4.45, 7.6],
  [111, 8.1, 3.6, 4.6],
];
const SHOULDERS = [
  [206, 8.0, 3.65, 4.8], [216, 10.3, 4.25, 5.7],
  [226, 11.9, 4.5, 5.9], [235.4, 12.95, 4.35, 6.3],
  [238.1, 12.65, 4.2, 6.2], [242, 10.35, 3.8, 4.45],
];
const SECTION = [
  [-0.79, 0.5], [0.79, 0.5], [1, 0.24], [0.76, -0.5], [-0.76, -0.5], [-1, 0.24],
];
// Radius in the valley and at each of the three lobes. The separate
// supports disappear into this continuous fluted waist at either end.
const SHAFT = [
  [0.2, 6.1, 6.8], [25, 6.1, 6.85], [58, 6.25, 7.0], [78, 6.9, 8.4],
  [91, 7.65, 11.45], [105, 8.35, 14.4], [121, 8.48, 13.6], [145, 8.34, 12.3],
  [168, 8.33, 11.96], [190, 8.48, 12.48], [207, 8.7, 13.25], [216, 7.78, 11.15],
  [223, 6.95, 8.55], [237, 6.75, 7.4], [243.2, 7.05, 7.6],
];

function concreteLeg(soup, angle, profile) {
  const side = polar(1, 0, angle - Math.PI / 2);
  const rings = profile.map(([y, r, w, d]) => SECTION.map(([s, t]) =>
    polar(r + t * d, y, angle).addScaledVector(side, s * w)));
  const span = new THREE.Vector3(), rise = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let j = 0; j < SECTION.length; j++) {
    const k = (j + 1) % SECTION.length;
    const aux = [HEIGHT, 0, [0.43, 1.0, 0.38, 0.44, 0.38, 1.0][j], 0];
    let previous;
    for (let i = 0; i < rings.length; i++) {
      const p = rings[i][j], q = rings[i][k];
      rise.subVectors(rings[Math.min(i + 1, rings.length - 1)][j], rings[Math.max(0, i - 1)][j]);
      span.subVectors(q, p);
      normal.crossVectors(rise, span).normalize();
      const n = normal.toArray(), a = soup.vert(p.x, p.y, p.z, n, 0, WHITE, aux);
      const b = soup.vert(q.x, q.y, q.z, n, 1, WHITE, aux);
      if (previous) soup.idx.push(previous[0], b, previous[1], previous[0], a, b);
      previous = [a, b];
    }
  }
}

function concreteWaist(soup) {
  const sides = 60;
  const rings = SHAFT.map(([y, valley, crest]) => Array.from({ length: sides }, (_, i) => {
    const a = i * TAU / sides;
    const lobe = (1 + Math.cos(3 * a)) * 0.5;
    return polar(THREE.MathUtils.lerp(valley, crest, lobe), y, a);
  }));
  const tangent = new THREE.Vector3(), rise = new THREE.Vector3(), normal = new THREE.Vector3();
  rings.forEach((ring, j) => ring.forEach((p, i) => {
    tangent.subVectors(ring[(i + 1) % sides], ring[(i + sides - 1) % sides]);
    rise.subVectors(rings[Math.min(j + 1, rings.length - 1)][i], rings[Math.max(j - 1, 0)][i]);
    normal.crossVectors(tangent, rise).normalize();
    const phase = (i % (sides / 3)) / (sides / 3);
    const v = soup.vert(p.x, p.y, p.z, normal.toArray(), phase, WHITE, [HEIGHT, 0, 1, 1]);
    if (j > 0) {
      const q = i === 0 ? v + sides - 1 : v - 1;
      soup.idx.push(q - sides, v - sides, v, q - sides, v, q);
    }
  }));
}

const BOWL = [[241.6, 12.45], [243.6, 13.75], [247, 16.37], [251.8, 19.86], [256.3, 23.07], [259.25, 25.05]];
function radiusAt(profile, y) {
  const i = profile.findIndex(([height]) => height >= y);
  if (i <= 0) return profile[i === 0 ? 0 : profile.length - 1][1];
  const [a, r] = profile[i - 1], [b, s] = profile[i];
  return THREE.MathUtils.lerp(r, s, (y - a) / (b - a));
}

function baseDrum(group, props, radius, stone, champagne, structure, beam) {
  const cobalt = sheen('#255493', { refl: 0.25, spec: 0.78, glow: '#287bea', glowK: 0.63, baseGlow: 0.022 });
  const bronze = sheen('#9b8063', { refl: 0.18, glow: '#e7ac73', glowK: 0.25 });
  const glass = [[2.05, radius - 0.92], [5.75, radius - 1.23], [9.15, radius - 1.98], [12.6, radius - 3.02]];
  skin(group, [[0.06, radius - 1.9], [0.06, radius - 0.3], [0.7, radius - 0.3], [1.35, radius - 0.8]], stone, 'Round foundation plinth', 40);
  skin(group, glass, cobalt, 'Tapered cobalt entry rotunda', 40);
  skin(group, [[1.22, radius - 1.7], [1.22, radius - 0.72], [1.69, radius - 0.43], [2.38, radius - 0.58], [2.7, radius - 1.02]],
    bronze, 'Deep bronze rotunda sill', 40);
  skin(group, [[11.97, radius - 2.88], [12.34, radius - 2.20], [13.14, radius - 2.11], [13.55, radius - 2.17]],
    bronze, 'Bronze terrace fascia', 40);
  skin(group, [[13.41, radius - 2.15], [13.76, radius - 2.2], [13.76, 0]],
    structure, 'Tower-base terrace roof', 40);
  for (const y of [4.35, 6.69, 8.99, 11.23]) {
    const r = radiusAt(glass, y);
    skin(group, [[y - 0.13, r + 0.10], [y - 0.13, r + 0.23], [y + 0.13, r + 0.16]],
      champagne, 'Rotunda window transom', 40);
  }
  for (let i = 0; i < 20; i++) {
    const a = i * TAU / 20;
    for (let j = 1; j < glass.length; j++) {
      const [y, r] = glass[j - 1], [end, s] = glass[j];
      beam(polar(r + 0.07, y, a), polar(s + 0.07, end, a), 0.25, structure);
    }
  }
  const mount = polar(radius * 0.79, 23.15, FRONT);
  box(props, 'STRAT media marquee frame', structure, [21.3, 7.7, 0.85], mount, FRONT);
  box(props, 'Cyan media marquee', sheen('#44778d', { glow: '#67d8ff', glowK: 0.72, baseGlow: 0.08 }),
    [19.85, 6.4, 0.18], mount.clone().add(polar(0.5, 0, FRONT)), FRONT);
  for (const side of [-1, 1]) {
    const leg = polar(20.1, 23.15, FRONT + side * Math.PI / 3);
    const edge = mount.clone().add(polar(side * 9.4, 0, FRONT + Math.PI / 2));
    beam(leg, edge, 0.22, structure);
    beam(polar(radius * 0.79 - 0.58, 13.5, FRONT).add(polar(side * 5.7, 0, FRONT + Math.PI / 2)),
      edge.clone().addScaledVector(UP, -2.5), 0.19, structure);
  }
  const word = polar(radius * 0.79 + 0.48, 30.0, FRONT);
  group.add(sign('THE STRAT', 20.4, 5.75, word.x, word.y, word.z, Math.sin(FRONT), Math.cos(FRONT),
    { font: `700 141px ${SANS}`, color: '#e5f0ff' }));
  for (let i = 0; i < 3; i++) {
    const a = TAU * i / 3;
    const p = polar(radius - 2.8, 0.61, a);
    box(props, 'Recessed concrete uplight', champagne, [0.82, 0.37, 0.7], p, a);
  }
}

// Trace the sloped skin in angle/height space: a straight chord between
// two points on the bowl would cut through the glass and break the diamonds.
function surfaceStrip(soup, profile, a, b, y0, y1, width, depth = 0.19) {
  const lerp = THREE.MathUtils.lerp;
  const steps = Math.max(2, Math.ceil(Math.abs(b - a) / 0.035), Math.ceil((y1 - y0) / 0.8));
  let prev;
  for (let i = 0; i <= steps; i++) {
    const y = lerp(y0, y1, i / steps), angle = lerp(a, b, i / steps);
    const r = radiusAt(profile, y);
    const slope = (radiusAt(profile, y + 0.06) - radiusAt(profile, y - 0.06)) / 0.12;
    const grade = Math.hypot(1, slope), dx = (b - a) * r, dy = (y1 - y0) * grade;
    const w = width * 0.5 / (Math.hypot(dx, dy) || 1);
    const vertices = [1, -1].map(side => {
      const h = y - side * dx * w / grade, phi = angle + side * dy * w / r;
      const p = polar(radiusAt(profile, h) + depth, h, phi);
      const vertex = soup.vert(p.x, p.y, p.z, [Math.sin(phi) / grade, -slope / grade, Math.cos(phi) / grade],
        i / steps, WHITE, [0, 0, 0, 0]);
      soup.uv[2 * vertex + 1] = (side + 1) / 2;
      return vertex;
    });
    if (prev) soup.idx.push(prev[0], vertices[1], prev[1], prev[0], vertices[0], vertices[1]);
    prev = vertices;
  }
}

function restaurantGlow() {
  return new THREE.ShaderMaterial({
    uniforms: { uNight: theme.uniforms.uNight, uTint: { value: new THREE.Color('#ffd3a8') } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `
      uniform vec3 uTint;
      uniform float uNight;
      varying vec2 vUv;
      void main() {
        float soft = sin(vUv.y * 3.141593);
        float falloff = smoothstep(0.0, 0.22, vUv.x) * pow(1.0 - vUv.x, 2.3);
        gl_FragColor = vec4(uTint, falloff * soft * soft * uNight * 0.76);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function skyPod(group, beam, structure) {
  const lowerGlass = sheen('#3c5376', { refl: 0.26, spec: 0.64, glow: '#6684b4', glowK: 0.30 });
  const collar = sheen('#c2c2c5', { refl: 0.11, glow: '#d8e0fb', glowK: 0.34 });
  const restaurant = sheen('#504a4c', { refl: 0.21, glow: '#af7854', glowK: 0.19 });
  const observation = sheen('#3d4f66', { refl: 0.25, spec: 0.57, glow: '#587aa2', glowK: 0.12 });
  const ring = sheen('#42566b', { refl: 0.14, glow: '#647eaa', glowK: 0.21 });
  const mullion = sheen('#a39c98', { refl: 0.1, glow: '#dad0c9', glowK: 0.27 });
  const bright = sheen('#d8dfe7', { refl: 0.10, glow: '#f3f7ff', glowK: 1.24, baseGlow: 0.075 });
  skin(group, [[237.25, 0], [237.25, 10.42], [238.6, 11.63], [241.62, 12.47]], collar, 'Concrete bowl collar');
  skin(group, BOWL, lowerGlass, 'SkyPod sloped glazing');
  skin(group, [[258.58, 24.44], [259.1, 25.29], [259.7, 26.03], [260.76, 26.03], [261.08, 25.63]],
    ring, 'Sloped lower SkyPod coping');
  skin(group, [[260.92, 25.41], [261.31, 25.73], [262.13, 25.73], [262.58, 25.54],
    [263.68, 25.15], [263.68, 24.32]], structure, 'Layered outer observation rim');
  const dining = [[262.48, 24.45], [263.05, 24.35], [268.62, 20.5]];
  const upper = [[269.23, 20.45], [274.30, 17.64]];
  skin(group, dining, restaurant, 'Inclined restaurant windows');
  skin(group, [[268.55, 20.51], [268.55, 20.97], [269.17, 21.1], [269.34, 20.56]], ring, 'Intermediate deck belt');
  skin(group, upper, observation, 'Recessed upper observation glazing');
  skin(group, [[274.04, 17.63], [274.47, 20.23], [275.34, 20.28], [275.85, 19.61], [275.99, 0]],
    ring, 'Broad graphite roof disk');
  skin(group, [[275.92, 9.11], [279.88, 8.94], [280.26, 9.04], [280.26, 8.42], [279.12, 8.35]],
    structure, 'Octagonal roof enclosure', 8);
  skin(group, [[277.7, 0], [277.7, 7.9]], ring, 'Recessed roof enclosure floor', 8);

  const ribs = new Soup(), panes = new Soup(), lights = new Soup();
  const bands = [243.25, 246.92, 250.55, 254.43, 257.2, 259.05];
  for (const y of bands) {
    const r = radiusAt(BOWL, y);
    skin(group, [[y - 0.105, r + 0.10], [y + 0.105, r + 0.246]], mullion, 'Bowl glazing transom');
  }
  const pitch = TAU / 28;
  for (let i = 0; i < 28; i++) {
    const a = i * pitch;
    surfaceStrip(ribs, BOWL, a, a, 245.6, 259.14, 0.30);
    const r = radiusAt(dining, 263.16);
    beam(polar(r + 0.17, 263.16, a), polar(20.78, 268.77, a), 0.30, mullion);
    beam(polar(20.61, 269.2, a), polar(17.88, 274.37, a), 0.40, structure);
    if (i % 4 !== 2) {
      const mid = a + pitch * 0.5;
      // Light is concentrated behind the glass rather than along the coping.
      surfaceStrip(panes, dining, mid, mid, 263.39, i % 3 === 0 ? 267.78 : 267.04, 4.0, 0.10);
    }
  }
  put(group, ribs, mullion, 'SkyPod glazing mullions');
  put(group, panes, restaurantGlow(), 'Warm restaurant window pools');

  const lattice = [242.0, 244.55, 247.1, 249.65], bay = TAU / 24;
  for (let i = 1; i < lattice.length; i++) {
    for (let j = 0; j < 24; j++) {
      const a = (j + (i - 1) * 0.5) * bay;
      for (const direction of [-1, 1]) surfaceStrip(lights, BOWL, a, a + bay * 0.5 * direction,
        lattice[i - 1], lattice[i], 0.39, 0.42);
    }
  }
  put(group, lights, bright, 'Continuous white diamond lattice');
}

function mastAndRides(group, beam, structure, champagne) {
  const iron = sheen('#cad2dc', { refl: 0.08, glow: '#fc694e', glowK: 0.23 });
  const red = sheen('#9c4147', { refl: 0.05, glow: '#ff153d', glowK: 0.98, baseGlow: 0.07 });
  const green = sheen('#4f754c', { refl: 0.13, glow: '#80ca62', glowK: 0.54 });
  const track = sheen('#415458', { refl: 0.13, glow: '#70abc0', glowK: 0.32 });
  const beacon = new THREE.MeshBasicMaterial({ color: '#ff5057', fog: true });

  // The main square Big Shot frame begins at 280 m; the narrower aerial
  // sections above it bring measured total height to 1,149 ft.
  const levels = [[280, 3.22], [284.3, 3.2], [288.6, 3.2], [292.9, 3.2], [297.2, 3.2], [301.5, 3.2],
    [305.8, 3.2], [310.1, 3.15], [314.4, 3.1], [318.7, 2.9], [323, 2.4], [327.3, 1.9], [331.6, 1.5],
    [335.9, 1.22], [340.2, 0.95], [344.1, 0.55], [348.1, 0.38]];
  const corners = levels.map(([y, w]) => Array.from({ length: 4 }, (_, i) => polar(w / Math.SQRT2, y, FRONT + i * TAU / 4)));
  corners.forEach((ring, i) => ring.forEach((p, j) => {
    const k = (j + 1) % 4;
    const lit = i < 11 ? red : iron;
    beam(p, ring[k], 0.135, lit);
    if (i === corners.length - 1) return;
    const next = corners[i + 1];
    beam(p, next[j], i < 10 ? 0.182 : 0.126, lit);
    beam(p, next[k], 0.091, i % 3 === 2 ? iron : lit);
    if (i < 10) beam(ring[k], next[j], 0.091, lit);
  }));
  beam(polar(0, 280.1, 0), polar(0, 319.4, 0), 0.80, red);
  beam(polar(0, 341.5, 0), polar(0, HEIGHT - 0.28, 0), 0.20, iron);
  addShape(group, new THREE.SphereGeometry(0.28, 8, 5), beacon, 'Top aviation light', 0, HEIGHT - 0.28, 0);
  for (let i = 0; i < 4; i++) {
    const a = FRONT + i * Math.PI / 2;
    box(group, 'Big Shot seats and carriage', champagne, [2.45, 1.05, 1.15], polar(2.25, 283.6, a), a);
  }

  const rideBearing = -2.76; // from the mapped X-Scream POI at the northwest deck
  const pivot = polar(18.5, 265.0, rideBearing), tip = polar(37.4, 262.0, rideBearing);
  for (const s of [-1, 1]) {
    const shift = polar(s * 1.12, 0, rideBearing + Math.PI / 2);
    beam(pivot.clone().add(shift), tip.clone().add(shift), 0.28, track);
  }
  for (let i = 0; i < 9; i++) {
    const pos = pivot.clone().lerp(tip, i / 8);
    box(group, 'X-Scream rail crossmember', track, [2.65, 0.36, 0.37], pos, rideBearing);
  }
  box(group, 'X-Scream car', green, [2, 1.05, 3.55], pivot.clone().lerp(tip, 0.72).addScaledVector(UP, 0.73), rideBearing);
  box(group, 'SkyJump platform', structure, [3.6, 0.57, 6.0], polar(26.4, 263.25, Math.PI * 1.09), Math.PI * 1.09);

  // Reference-era Insanity boom, held in a display pose above the Strip.
  const a = FRONT + 0.42, hub = polar(37.2, 264.4, a);
  const brace = sheen('#254b42', { refl: 0.14, glow: '#4b9472', glowK: 0.28 });
  const violet = sheen('#786583', { glow: '#b47ac3', glowK: 0.45 });
  const lamp = sheen('#d3e4ef', { glow: '#e9f3ff', glowK: 1.1, baseGlow: 0.12 });
  const arch = new THREE.QuadraticBezierCurve3(polar(22.9, 261.6, a), polar(21.5, 282.1, a), polar(31.7, 270.8, a));
  const archPts = arch.getPoints(12);
  for (let i = 1; i < archPts.length; i++) beam(archPts[i - 1], archPts[i], 0.58, brace);
  for (let i = 0; i < 6; i++) {
    const p = arch.getPoint(0.15 + i * 0.142).add(polar(0.53, 0, a - Math.PI / 2));
    addShape(group, new THREE.SphereGeometry(0.37, 8, 6), lamp, 'Insanity brace lamp', p.x, p.y, p.z);
  }
  beam(archPts[archPts.length - 1], hub, 0.56, green);
  addShape(group, new THREE.CylinderGeometry(1.42, 1.42, 0.66, 12), violet, 'Insanity hub', hub.x, hub.y, hub.z);
  for (let n = 0; n < 5; n++) {
    const arm = a + n * TAU / 5;
    const bend = hub.clone().add(polar(3.2, -1.4, arm));
    const seat = hub.clone().add(polar(6.6, -6.0, arm));
    beam(hub, bend, 0.33, green);
    beam(bend, seat, 0.27, green);
    box(group, 'Insanity seat bracket', green, [1.36, 1.2, 1.55], seat, arm);
    box(group, 'Insanity seat back', violet, [1.0, 0.82, 0.42], seat.clone().add(polar(0.63, 0.16, arm)), arm);
  }
}

function resortWings(group, data, options) {
  const campus = named(data, 'The Strat');
  const stone = material('#c6c1b8', '#a0a1a8', { flood: '#ddd9f0', floodK: 0.14 });
  standalonePodium(group, campus, options, stone);
  const garage = mapped(data, 1562, -3523, 29.6);
  if (garage) {
    standalonePodium(group, garage, options, material('#a9a6a5', '#8d9099'));
    const rim = new Soup(), r = clean(garage.pts);
    parapet(rim, r, garage.h, 0.69, 0.14);
    put(group, rim, stone, 'Parking wing roof rim');
  }
  const hotel = mapped(data, 1643, -3505, 77.6);
  if (!hotel) return;
  const ring = own(hotel, options);
  const wall = new Soup(), trim = new Soup(), roof = new Soup(), piers = new Soup();
  const podiumTop = campus?.h ?? 14;
  wall.walls(ring, podiumTop - 0.1, hotel.h, WHITE, [hotel.h, 17, 0, podiumTop]);
  roof.cap(ring, hotel.h);
  parapet(trim, ring, hotel.h, 1.2, 0.32);
  for (const y of [16.2, 32.9, 56.8, hotel.h - 3.6]) trim.walls(offset(ring, 0.2), y, y + 0.48);
  for (const f of faces(ring, 6)) {
    along(piers, f, 0, 1.08, podiumTop, hotel.h - podiumTop, 0.70, 0.075);
    along(piers, f, f.length - 1.08, f.length, podiumTop, hotel.h - podiumTop, 0.7, 0.075);
  }
  const rooftop = inset(ring, 1.15);
  if (rooftop) {
    for (const f of faces(rooftop, 14).filter(f => f.nz > 0.34).slice(0, 5)) {
      along(roof, f, f.length * 0.31, f.length * 0.55, hotel.h, 2.5, 4.7, -3.6);
    }
  }
  put(group, wall, facade(MODE.palazzo, { color: '#bab5b0', roof: '#959ba3', glass: '#667b91',
    flood: '#d2caed', floodK: 0.21, bay: 4.65, rate: 0.069, self: 0.045 }), 'The STRAT bent hotel block');
  put(group, trim, stone, 'Hotel floor belts and parapets');
  put(group, piers, material('#c6c5c3', '#a8a8ae', { flood: '#a7b3db', floodK: 0.19 }), 'Hotel stone end piers');
  put(group, roof, material('#888d95', '#a4a6a8'), 'Hotel roof and service housings');
}

export function buildStrat(data, options) {
  const out = model('The STRAT');
  resortWings(out, data, options);
  const footprint = data.buildings.find(b => /^(stratosphere|the strat) tower$/i.test(b.name ?? ''));
  if (!footprint) return out;
  const [x, z] = centroid(footprint.pts);
  const radius = Math.sqrt(area(footprint.pts) / Math.PI);
  const tower = model('Stratosphere observation tower');
  const props = model('Observation decks and tower hardware');
  const beam = bars(props);
  const concrete = facade(MODE.towerConcrete, { color: '#c2cdd9', roof: '#a3aab8', flood: '#eaf3ff', floodK: 0.88, self: 0.16 });
  const stone = sheen('#a9b5c6', { refl: 0.1, glow: '#d7e5fc', glowK: 0.27 });
  const structure = sheen('#5a6a82', { refl: 0.18, spec: 0.52, glow: '#7d9bc7', glowK: 0.19 });
  const champagne = sheen('#a99c89', { refl: 0.12, spec: 0.8, glow: '#eacfaf', glowK: 0.32 });

  const shaft = new Soup();
  concreteWaist(shaft);
  for (const a of [0, TAU / 3, 2 * TAU / 3]) {
    concreteLeg(shaft, a, FEET);
    concreteLeg(shaft, a, SHOULDERS);
  }
  put(tower, shaft, concrete, 'Three swept concrete supports');
  baseDrum(tower, props, radius, stone, champagne, structure, beam);
  skyPod(tower, beam, structure);
  mastAndRides(props, beam, structure, champagne);
  // The unprojected studio gets these exact meshes and their metre dimensions.
  tower.add(bakeStatic(props));
  tower.position.set(x, 0, z);
  out.add(tower);
  out.add(spill(x, 0.37, z, 72, '#99c5ff', 0.15));
  return out;
}
