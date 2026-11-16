import { hoarding, towerCrane } from '../landmarks/vendor/landmarks/construction.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { MODE, Soup, clean, facade, obb, sign } from './hero-kit.js';
import { material, model, named, own, put } from './landmark-forms.js';

const THREE = window.THREE;
const BODY_BASE = 32;
const BODY_TOP = 165;

function guitarGlass(isReturn) {
  const canvas = document.createElement('canvas');
  canvas.width = isReturn ? 256 : 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width, canvas.height);
  const base = ctx.createLinearGradient(0.17, 0, 0.66, 1);
  base.addColorStop(0, isReturn ? '#28588c' : '#1b4195');
  base.addColorStop(0.48, isReturn ? '#297495' : '#155087');
  base.addColorStop(0.83, isReturn ? '#155570' : '#123a6a');
  base.addColorStop(1, '#0a294c');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1, 1);

  const accented = new Path2D();
  if (isReturn) {
    accented.rect(0, 0, 1, 1);
  } else {
    // Bright spandrels on the two cutaways and the oval behind the strings.
    accented.moveTo(0, 0.39);
    accented.bezierCurveTo(0.23, 0.43, 0.24, 0.65, 0.27, 0.77);
    accented.bezierCurveTo(0.29, 0.89, 0.35, 0.95, 0.49, 1);
    accented.lineTo(0, 1);
    accented.closePath();
    accented.moveTo(0.49, 0);
    accented.lineTo(1, 0);
    accented.lineTo(1, 0.58);
    accented.bezierCurveTo(0.83, 0.48, 0.74, 0.39, 0.68, 0.25);
    accented.bezierCurveTo(0.59, 0.13, 0.54, 0.07, 0.49, 0);
    accented.closePath();
    accented.moveTo(0.626, 0.62);
    accented.ellipse(0.497, 0.62, 0.129, 0.17, 0, 0, Math.PI * 2);
    accented.closePath();
    const teal = ctx.createLinearGradient(0, 0, 0.12, 1);
    teal.addColorStop(0, '#244d8e');
    teal.addColorStop(0.38, '#2e7ca6');
    teal.addColorStop(0.69, '#3d9fae');
    teal.addColorStop(1, '#176976');
    ctx.fillStyle = teal;
    ctx.fill(accented);
  }

  // The lower panes carry darker reflections, with the floor grid visible over them.
  const reflection = ctx.createLinearGradient(0, 0.77, 0, 1);
  reflection.addColorStop(0, '#05243b00');
  reflection.addColorStop(0.46, '#07192b77');
  reflection.addColorStop(1, '#091d30b0');
  ctx.fillStyle = reflection;
  ctx.fillRect(0, 0.77, 1, 0.23);
  const columns = isReturn ? 11 : 46;
  for (let i = 1; i < columns; i++) {
    ctx.fillStyle = i % 5 === 0 ? '#0c274b8c' : '#a9d5e234';
    ctx.fillRect(i / columns, 0, i % 5 === 0 ? 0.0016 : 0.0011, 1);
  }
  const story = 3.29 / (BODY_TOP - BODY_BASE);
  for (let y = 1 - story; y > 0; y -= story) {
    ctx.fillStyle = '#b9d7ef43';
    ctx.fillRect(0, y, 1, 0.0013);
  }
  ctx.save();
  ctx.clip(accented);
  for (let y = 1 - story; y > 0; y -= story) {
    ctx.fillStyle = isReturn ? '#b1d4e6ab' : '#bcd9eff0';
    ctx.fillRect(0, y, 1, 0.00185);
    ctx.fillStyle = '#19354988';
    ctx.fillRect(0, y + 0.00185, 1, 0.00085);
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function guitarBody(width) {
  const m = (width - 5.5) / 100, s = (x, y) => [x * m, y];
  const outline = new THREE.Shape();
  outline.moveTo(...s(-10, BODY_BASE));
  outline.bezierCurveTo(...s(-33, 32), ...s(-46, 41), ...s(-49, 59));
  outline.bezierCurveTo(...s(-52, 77), ...s(-47, 92), ...s(-39, 108));
  outline.bezierCurveTo(...s(-32, 122), ...s(-42, 128), ...s(-42, 143));
  outline.bezierCurveTo(...s(-43, 154), ...s(-39, 159), ...s(-34, 154));
  outline.bezierCurveTo(...s(-26, 146), ...s(-17, 142), ...s(-3, 143));
  outline.bezierCurveTo(...s(12, 144), ...s(24, 151), ...s(33, 160));
  outline.bezierCurveTo(...s(39, 168), ...s(45, 156), ...s(42, 147));
  outline.bezierCurveTo(...s(40, 137), ...s(31, 130), ...s(34, 122));
  outline.bezierCurveTo(...s(37, 111), ...s(49, 103), ...s(51, 82));
  outline.bezierCurveTo(...s(56, 55), ...s(44, 32), ...s(17, BODY_BASE));
  outline.closePath();
  return outline;
}

function buildCurtainWall(out, fit) {
  const shape = guitarBody(fit.w);
  const depth = fit.d - 6.5;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelSize: 2.35,
    bevelThickness: 3.15, bevelSegments: 4, curveSegments: 22 });
  const pos = geometry.attributes.position, uv = geometry.attributes.uv;
  const faceZ = depth / 2 + 3.15;
  const glass = sheen('#ffffff', { map: guitarGlass(false), refl: 0.17, spec: 0.5,
    glow: '#254c84', glowK: 0.15, baseGlow: 0.09 });
  const returns = sheen('#ffffff', { map: guitarGlass(true), refl: 0.29, spec: 0.68,
    glow: '#28527c', glowK: 0.11, baseGlow: 0.07 });
  glass.name = 'Cobalt and teal guitar glazing';
  returns.name = 'Glazed rounded returns';
  for (const { start, count, materialIndex } of geometry.groups) {
    for (let i = start; i < start + count; i++) {
      const u = materialIndex ? (pos.getZ(i) + 3.15) / (2 * faceZ) : 0.5 + pos.getX(i) / fit.w;
      uv.setXY(i, u, (pos.getY(i) - BODY_BASE) / (BODY_TOP - BODY_BASE));
    }
    const face = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geometry.attributes)) {
      face.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(start * attr.itemSize, (start + count) * attr.itemSize), attr.itemSize));
    }
    const mesh = new THREE.Mesh(face, materialIndex ? returns : glass);
    mesh.position.z = -depth / 2;
    out.add(mesh);
  }
  geometry.dispose();

  const seam = sheen('#abc4d7', { refl: 0.32, spec: 0.62, glow: '#8fa8cd', glowK: 0.1 });
  const profile = shape.getPoints(22).slice(0, -1);
  for (const z of [-faceZ - 0.12, faceZ + 0.12]) {
    const curve = new THREE.CatmullRomCurve3(profile.map(p => new THREE.Vector3(p.x, p.y, z)), true, 'centripetal');
    out.add(new THREE.Mesh(new THREE.TubeGeometry(curve, profile.length, 0.16, 5, true), seam));
  }
  return { faceZ, profile };
}

function buildGuitarPodium(out, { w, d }) {
  const base = new Soup(), trim = new Soup(), glazing = new Soup();
  base.box(0, 0.2, 0, w - 4.4, 14.4, d - 1.5);
  base.box(0, 14.6, 0, w - 7, 9.3, d - 3);
  base.box(0, 23.9, 0, w - 10, BODY_BASE - 23.9, d - 4.5);

  for (const side of [-1, 1]) {
    const z = side * (d - 1.5) / 2;
    glazing.box(0, 3.2, z, w - 12.5, 5.6, 0.32);
    glazing.box(0, 16.3, side * (d - 3) / 2, w - 15.0, 5.05, 0.3);
    for (let i = -5; i <= 5; i++) trim.box(i * (w - 13) / 12, 3.2, z + side * 0.22, 0.32, 5.6, 0.45);
    trim.box(0, 8.85, z, w - 4.46, 0.72, 0.46);
    trim.box(0, 23.5, side * (d - 3) / 2, w - 7, 0.42, 0.53);
  }
  put(out, base, material('#bdac96', '#c2b8aa', { flood: '#ffe2b9', self: 0.10 }), 'Precast guitar podium');
  put(out, trim, sheen('#a89c8d', { refl: 0.14, spec: 0.39 }), 'Podium slab edges and mullions');
  put(out, glazing, sheen('#243f4a', { refl: 0.24, spec: 0.42 }), 'Recessed podium glazing');
  out.add(sign('Hard Rock', 27.0, 4.3, 0, 11.45, (d - 1.1) / 2, 0, 1,
    { font: 'italic 600 130px Georgia', color: '#f6ebda' }));
}

function eastEdge(profile, y) {
  let x = -Infinity;
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i], b = profile[(i + 1) % profile.length];
    if ((a.y > y) === (b.y > y)) continue;
    x = Math.max(x, THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y)));
  }
  return x;
}

export function buildGuitar(data, options, engine) {
  const out = model('Hard Rock Guitar Hotel');
  const footprint = named(data, 'Hard Rock Las Vegas Guitar Tower');
  if (!footprint) return out;
  const fit = obb(own(footprint, options));
  const direction = fit.ax < 0 ? -1 : 1, ax = fit.ax * direction, az = fit.az * direction;
  out.position.set(fit.cx, 0, fit.cz);
  out.rotation.y = Math.atan2(-az, ax);

  const { faceZ, profile } = buildCurtainWall(out, fit);
  buildGuitarPodium(out, fit);

  const steel = new Soup(), concrete = new Soup(), neck = new Soup(), strings = new Soup(), bridge = new Soup(), brass = new Soup();
  concrete.box(-0.78, 141.1, -1.25, 13.9, 27.9, 13.0);
  neck.box(-0.4, 141.1, 0, 12.25, 26.9, 2 * (faceZ + 0.07));
  for (const side of [-1, 1]) {
    const z = side * (faceZ + 0.48);
    bridge.box(-0.4, 54.2, z, 17.6, 1.62, 2.35);
    bridge.box(-0.4, 55.8, z, 16.1, 0.48, 1.82);
    for (let i = 0; i < 6; i++) strings.box((i - 2.5) * 1.86 - 0.4, 56.0, z, 0.48, 111.7 - i * 0.38, 0.82);
  }
  // Exposed steel and formwork at the reference-date neck and upper shoulders.
  for (const [i, x] of [-7.1, -3.65, 0, 3.6, 7.0].entries()) {
    for (const z of [-7.2, 6.4]) steel.box(x, 164.8, z, 0.44, 36.2 - i * 2.55, 0.49);
  }
  for (let y = 169.1; y <= 200.2; y += 4.43) {
    const width = y < 185 ? 14.5 : 14.5 - (y - 182) * 0.71;
    for (const z of [-7.2, 6.4]) steel.box((width - 14.5) * 0.5, y, z, width, 0.36, 0.38);
    steel.box(-6.87, y, -0.4, 0.48, 0.39, 13.6);
  }
  // Curved balcony slabs in the eastern cutaway step with the curtain wall.
  const guards = new Soup();
  for (let y = 124.2; y < 158; y += 3.29) {
    const x = eastEdge(profile, y);
    if (!Number.isFinite(x)) continue;
    const ring = clean(Array.from({ length: 20 }, (_, i) => {
      const t = i * Math.PI / 10;
      return [x - 0.9 + 4.9 * Math.cos(t), 7.6 * Math.sin(t)];
    }));
    concrete.prism(ring, y, y + 0.38);
    guards.walls(ring, y + 0.39, y + 1.23);
  }
  for (const y of [151.7, 168.55]) brass.box(-0.2, y, 7.1, 16.6, 0.69, 0.55);
  put(out, concrete, facade(MODE.stone, { color: '#85898b', roof: '#7b8386', self: 0.12 }), 'Exposed floor slabs and concrete core');
  put(out, steel, sheen('#7d8686', { refl: 0.47, spec: 0.79 }), 'Stepped exposed neck steel');
  put(out, neck, sheen('#1e3552', { refl: 0.23, spec: 0.52 }), 'Neck below the exposed steel');
  put(out, guards, sheen('#789cae', { refl: 0.46, spec: 0.56 }), 'Curved cutaway balcony guards');
  put(out, strings, sheen('#cbd7dd', { refl: 0.24, spec: 0.84, glow: '#a8b9ca', glowK: 0.13 }), 'Six silver strings');
  put(out, bridge, sheen('#d0c7af', { refl: 0.19, spec: 0.54 }), 'Raised guitar bridge');
  put(out, brass, sheen('#95754e'), 'Safety rails and formwork');

  if (!options?.standalone) out.add(hoarding(fit.w + 1.8, fit.d + 5.8));
  const crane = towerCrane(208, 51, Math.PI);
  crane.obj.position.set(-36, 0, -9.3);
  out.add(crane.obj);
  const assembled = bakeStatic(out, m => m.userData.crane === true || m.userData.keep === true);
  engine?.animate(assembled, ({ t }) => crane.update(t), new THREE.Sphere(new THREE.Vector3(fit.cx, 106, fit.cz), 128));
  return assembled;
}
