/** The LINQ High Roller: the tension rim turns, and the 28 pods stay level. */
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { SANS, Soup, clean, inset, sign, spill } from './hero-kit.js';
import { addShape, along, faces, mapped, material, model, own, parapet, put } from './landmark-forms.js';

const THREE = window.THREE;
const TAU = Math.PI * 2, CABINS = 28, HUB = 86.35, RIM = 71.5, OUTER = 167.64 - HUB - 3.01;
const STEP = TAU / CABINS, MINUTES_30 = 1800;
const UP = new THREE.Vector3(0, 1, 0);
const pt = (r, a, z = 0) => new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z);

function beam(root, geometry, mat, from, to, radius) {
  const p = from.clone(), delta = to.clone().sub(p);
  const m = new THREE.Mesh(geometry, mat);
  m.position.copy(p).lerp(to, 0.5);
  m.scale.set(radius, delta.length(), radius);
  m.quaternion.setFromUnitVectors(UP, delta.normalize());
  root.add(m);
  return m;
}

function lathe(root, mat, profile, label, segments = 24) {
  return addShape(root, new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(r, y)), segments), mat, label, 0, 0, 0);
}

function cabin(rose, materials) {
  const out = model(rose ? 'Rose cabins' : 'Blue cabins');
  const accent = rose ? materials.rose : materials.blue;
  lathe(out, materials.glass, [[-1.67, 2.42], [-1.20, 2.69], [-0.55, 2.94], [0.20, 3.02], [1.13, 2.82], [1.58, 2.57]], 'Wraparound cabin windows');
  lathe(out, accent, [[1.43, 2.61], [1.59, 2.62], [2.10, 2.18], [2.55, 1.62], [2.85, 0.88], [3.01, 0]], 'Upper cabin shell');
  lathe(out, accent, [[-3.00, 0], [-2.83, 0.92], [-2.53, 1.55], [-2.12, 2.14], [-1.67, 2.52]], 'Lower cabin shell');
  const tubes = new THREE.CylinderGeometry(1, 1, 1, 8);
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10, u = Math.cos(a), v = Math.sin(a);
    const profile = [[-1.55, 2.52], [-0.47, 2.99], [0.58, 3.014], [1.50, 2.69]];
    for (let j = 1; j < profile.length; j++) {
      const [y0, r0] = profile[j - 1], [y1, r1] = profile[j];
      beam(out, tubes, accent, new THREE.Vector3(u * r0, y0, v * r0), new THREE.Vector3(u * r1, y1, v * r1), 0.068);
    }
  }
  const trim = new THREE.TorusGeometry(2.56, 0.10, 8, 28).rotateX(Math.PI / 2);
  for (const y of [-1.61, 1.54]) addShape(out, trim, accent, 'Capsule window ring', 0, y, 0);
  for (const side of [-1, 1]) {
    addShape(out, new THREE.BoxGeometry(0.5, 0.09, 0.18), materials.floor, 'Door threshold light', 0, -1.57, side * 2.51);
  }
  return bakeStatic(out).children;
}

function populateCabins(wheel, materials) {
  const batches = [], matrix = new THREE.Matrix4(), finishes = new Map();
  const instanceFinish = source => {
    if (finishes.has(source)) return finishes.get(source);
    const finish = source.clone();
    finish.uniforms = source.uniforms;
    finish.vertexShader = source.vertexShader.replace(
      'vec4 wp = modelMatrix * vec4(position, 1.0);',
      'vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);',
    );
    finishes.set(source, finish);
    return finish;
  };
  for (const rose of [false, true]) {
    const ids = Array.from({ length: CABINS }, (_, i) => i).filter(i => rose === (i >= 7 && i <= 18));
    for (const source of cabin(rose, materials)) {
      const group = new THREE.InstancedMesh(source.geometry, instanceFinish(source.material), ids.length);
      group.name = rose ? 'Rose capsule detail' : 'Blue capsule detail';
      group.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.boundingSphere = new THREE.Sphere(new THREE.Vector3(), OUTER + 5);
      batches.push([group, ids]);
      wheel.add(group);
    }
  }
  const centers = Array.from({ length: CABINS }, () => new THREE.Vector3());
  return angle => {
    centers.forEach((p, i) => p.set(OUTER * Math.cos(i * STEP + angle), OUTER * Math.sin(i * STEP + angle), 0));
    for (const [mesh, ids] of batches) {
      ids.forEach((i, j) => mesh.setMatrixAt(j, matrix.makeTranslation(centers[i].x, centers[i].y, 0)));
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}

function boardingStation(out, data, options, { x, z }) {
  const station = mapped(data, 561, -127, 7, 12);
  const shell = new Soup(), shadow = new Soup(), trims = new Soup(), glazing = new Soup(), rails = new Soup();
  if (station) {
    const ring = own(station, options);
    shell.prism(ring, 0.14, station.h);
    parapet(trims, ring, station.h, 0.8, 0.23);
    const set = inset(ring, 1.04);
    if (set) shell.prism(set, station.h - 0.04, station.h + 3.7);
    for (const f of faces(ring, 3.65).filter(f => f.nx > -0.6)) {
      const count = Math.max(2, Math.round(f.length / 2.85)), pitch = f.length / count;
      for (let i = 0; i < count; i++) {
        along(glazing, f, (i + 0.13) * pitch, (i + 0.88) * pitch, 2.05, 3.71, 0.21, 0.11);
      }
    }
  }
  // The rail runs between the two boarding decks. Keep the circle and the
  // vertical cabin envelope clear; part of the floor rises with the rim.
  for (const side of [-1, 1]) {
    const X = x + side * 5.4;
    shadow.box(X, 0.32, z + 0.8, 46.2, 6.5, 4.7, 0, 1);
    for (const [y, width, depth] of [[6.82, 48.7, 4.65], [7.9, 46.6, 3.7], [10.7, 39.8, 3.58]]) {
      trims.box(X, y, z + 0.8, width, 0.60, depth, 0, 1);
    }
    for (let i = 0; i < 14; i++) {
      const Z = z + (i - 6.5) * 3.06;
      shell.box(X + side * 1.46, 7.14, Z, 0.51, 3.51, 0.62);
      rails.box(X - side * 1.77, 8.51, Z, 0.18, 1.30, 0.15);
    }
    rails.box(X - side * 1.77, 9.77, z, 0.15, 0.16, 45.4);
  }
  const stationShade = material('#c4b4b2', '#9da7b9', { flood: '#edd4d7', floodK: 0.52 });
  put(out, shell, stationShade, 'Wheel House and platform piers');
  put(out, shadow, material('#817289', '#8f829a', { flood: '#dd90c7', floodK: 0.52 }), 'Boarding deck structure');
  put(out, trims, material('#aea3b2', '#8694ac', { flood: '#b7a4ed', floodK: 0.59 }), 'Stepped boarding platform decks');
  put(out, glazing, sheen('#586780', { glow: '#dabde9', glowK: 0.23 }), 'Wheel House glazed bays');
  put(out, rails, sheen('#8a95b1', { glow: '#8478d3', glowK: 0.38 }), 'Boarding deck rails');
  out.add(sign('HIGH ROLLER', 16.7, 2.24, x - 19, 9.06, z + 20.5, 0, 1,
    { font: `800 130px ${SANS}`, color: '#e0e4fc' }));
  out.add(spill(x - 3, 0.44, z, 39, '#9586ff', 0.14));
}

export function buildHighRoller(data, options, engine) {
  const out = model('High Roller at The LINQ');
  const poi = data.pois.find(p => /^high roller$/i.test(p.n));
  if (!poi) return out;
  const mat = {
    hoop: sheen('#c8d3e0', { refl: 0.18, spec: 0.62, glow: '#777bbb', glowK: 0.30 }),
    steel: sheen('#c4ccdc', { refl: 0.13, spec: 0.53, glow: '#7386bf', glowK: 0.27 }),
    cable: sheen('#acb9d8', { refl: 0.16, glow: '#7784d4', glowK: 0.31 }),
    lamp: sheen('#78bcd4', { glow: '#48e7ff', glowK: 1.78, baseGlow: 0.055 }),
    hub: sheen('#95a5c2', { refl: 0.16, spec: 0.49, glow: '#636aff', glowK: 0.86 }),
    glass: sheen('#404963', { refl: 0.31, spec: 0.87, glow: '#5d6295', glowK: 0.16 }),
    rose: sheen('#baa3bf', { refl: 0.18, spec: 0.60, glow: '#dc69ba', glowK: 0.59 }),
    blue: sheen('#a2b4d5', { refl: 0.18, spec: 0.60, glow: '#668cfa', glowK: 0.53 }),
    floor: sheen('#a8b4ce', { glow: '#e4eeff', glowK: 0.95 }),
  };
  const unit = new THREE.CylinderGeometry(1, 1, 1, 8), tapered = new THREE.CylinderGeometry(0.76, 1, 1, 14);
  const wheel = model('High Roller wheel assembly'), rotor = model('Rotating rim, 112 cables and brackets'), fixed = model('Four inclined supports and east brace');
  wheel.position.set(poi.x, HUB, poi.z);
  wheel.rotation.y = Math.PI / 2;
  addShape(rotor, new THREE.TorusGeometry(RIM, 1.0, 12, 240), mat.hoop, 'Single structural rim', 0, 0, 0);
  for (const side of [-1, 1]) {
    addShape(rotor, new THREE.TorusGeometry(RIM - 0.6, 0.185, 6, 240), mat.lamp, 'Cyan inner LED strip', 0, 0, side * 0.91);
    addShape(fixed, new THREE.CylinderGeometry(3.42, 3.42, 1.43, 20).rotateX(Math.PI / 2), mat.steel,
      'Main spindle bearing cover', 0, 0, side * 17.08);
  }
  addShape(rotor, new THREE.CylinderGeometry(2.22, 2.22, 32.8, 20).rotateX(Math.PI / 2), mat.hub, 'Lit main hub', 0, 0, 0);
  for (let i = 0; i < CABINS; i++) {
    const a = i * STEP;
    for (const side of [-1, 1]) {
      const yokeBase = pt(RIM + 0.72, a + side * STEP * 0.24, side * 0.63);
      const yokeHead = pt(OUTER - 2.18, a, side * 1.1);
      const support = i >= 7 && i <= 18 ? mat.rose : mat.blue;
      beam(rotor, tapered, support, yokeBase, yokeHead, 0.46);
      const anchor = pt(RIM - 0.69, a + side * 0.033, side * 0.49);
      const socket = new THREE.BoxGeometry(0.99, 1.3, 0.49);
      const shoe = addShape(rotor, socket, mat.steel, 'Cable saddle', anchor.x, anchor.y, anchor.z);
      shoe.rotation.z = a - Math.PI / 2;
      for (const lead of [-1, 1]) {
        // Four alternating depth anchors per cabin station. The slender
        // cables have a small width allowance so they also read from the map.
        const hub = pt(2.68, a + lead * 0.93, side * 15.29);
        const rim = pt(RIM - 0.79, a + lead * STEP * 0.24, side * 0.38);
        beam(rotor, unit, mat.cable, hub, rim, 0.067);
      }
    }
    const p = pt(OUTER - 2.05, a);
    addShape(rotor, new THREE.SphereGeometry(0.32, 8, 6), mat.floor, 'Cabin bearing light', p.x, p.y, p.z + 0.88);
  }
  const plinths = new Soup(), foot = (x, z, width) => plinths.box(x, -HUB + 0.05, z, width, 1.56, width);
  for (const depth of [-1, 1]) {
    const p = new THREE.Vector3(0, -2.86, depth * 16.1);
    for (const side of [-1, 1]) {
      const q = new THREE.Vector3(side * 24.85, -HUB + 1.43, depth * 10.4);
      beam(fixed, tapered, mat.steel, q, p, 1.83);
      foot(q.x, q.z, 4.54);
    }
  }
  // Real brace is on the east side, above the live LINQ Lane, with the foot
  // on the far parking parcel. Leave the roadway below the tube open.
  const braceFoot = new THREE.Vector3(-4.2, -HUB + 1.48, 59.6);
  beam(fixed, tapered, mat.steel, braceFoot, new THREE.Vector3(0, -1.3, 17.07), 1.49);
  foot(braceFoot.x, braceFoot.z, 5.8);
  put(fixed, plinths, material('#a7b1c2', '#a7b1c2', { flood: '#abbeea', floodK: 0.4 }), 'Concrete leg plinths');
  const rotation = bakeStatic(rotor);
  wheel.add(bakeStatic(fixed), rotation);
  const updateCabins = populateCabins(wheel, mat);
  updateCabins(0);
  out.add(wheel);
  boardingStation(out, data, options, poi);
  engine?.animate(wheel, ({ t }) => {
    const angle = -(t * TAU / MINUTES_30) % TAU;
    rotation.rotation.z = angle;
    updateCabins(angle);
  }, new THREE.Sphere(new THREE.Vector3(poi.x, HUB, poi.z), HUB + 14));
  return out;
}
