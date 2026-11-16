import { Soup, clean, spill } from './hero-kit.js';
import { letterRun, signMaterial, signMesh } from './architectural-signs.js';
import { displayMaterial, displayRibbon } from './strip-displays.js';
import { addShape, material, model, put } from './landmark-forms.js';
import { crownSignature } from './wynn-ti.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';

const THREE = window.THREE;
const circle = (r, n = 64, first = -Math.PI / 2) => Array.from({ length: n + 1 }, (_, i) => {
  const a = first + i / n * Math.PI * 2;
  return [Math.sin(a) * r, Math.cos(a) * r];
});

export function buildFashionShow(_data, options, engine) {
  const out = model('The Cloud at Fashion Show');
  out.position.set(555.7, 0, -1247.8);
  out.rotation.y = -0.465;
  const silver = sheen('#a8b2b5', { refl: 0.47, spec: 1.06, glow: '#a5c1d1', glowK: 0.17 });
  const skin = sheen('#8a979f', { refl: 0.36, spec: 0.88 });
  const lens = new THREE.SphereGeometry(1, 64, 20).scale(21.5, 3.07, 72).rotateX(-0.151);
  addShape(out, lens, silver, 'Tilted silver canopy', 0, 40.8, 0);
  const seam = new THREE.TorusGeometry(1, 0.009, 5, 96).rotateX(Math.PI / 2)
    .scale(21.29, 23.4, 71.2).rotateX(-0.151);
  addShape(out, seam, skin, 'Rolled perimeter seam', 0, 39.48, 0);
  const shafts = new Soup(), collars = new Soup(), portals = new Soup();
  for (const [i, z] of [32.8, -31.85].entries()) {
    const r = i === 0 ? 5.35 : 4.82, cap = 40.2 + z * 0.152;
    const low = i === 0 ? 7.65 : 6.85, high = i === 0 ? 30.5 : 27.6;
    const ring = clean(circle(r).slice(0, -1).map(([x, k]) => [x, k + z]));
    shafts.prism(ring, 0.28, cap);
    for (let y = high + 0.39; y < cap - 0.38; y += 1.92) {
      collars.walls(clean(circle(r + 0.08, 44).slice(0, -1).map(([x, k]) => [x, k + z])), y, y + 0.34);
    }
    const columnDisplay = model(i === 0 ? 'Fashion Show south column' : 'Fashion Show north column');
    const art = displayMaterial(columnDisplay, engine, columnDisplay.name, Math.PI * r / (high - low),
      i === 0 ? ['fashion', 'city-afterglow', 'waymo'] : ['fashion', 'desert-miles', 'shows'], { repeats: 2, duration: 9.4 });
    // Center a complete creative on the east face that looks onto the Strip.
    displayRibbon(columnDisplay, art, circle(r + 0.11, 64, 0).map(([x, k]) => [x, k + z]), low, high);
    out.add(columnDisplay);
    portals.box(0, cap - 1.09, z, r * 2.38, 0.71, r * 2.19);
  }
  put(out, shafts, silver, 'Two broad silver pylons');
  put(out, collars, sheen('#475a61', { refl: 0.36, spec: 0.74 }), 'Stacked steel collars');
  for (const z of [-3.8, 3.8]) portals.box(2.6, 42.3, z, 0.24, 6.7, 0.24);
  put(out, portals, material('#899599', '#9ca5a8'), 'Canopy saddles and sign mounts');
  const wordmark = signMaterial('Fashion Show canopy lettering', 1.8, (ctx, w, h) => {
    for (const [i, word] of ['FASHION', 'SHOW'].entries()) {
      letterRun(ctx, word, w / 2, h * (0.34 + i * 0.32), w * 0.94, h * 0.24, '#eef2ec');
    }
  });
  out.add(signMesh(wordmark, 11.5, 6.39, 2.76, 48.2, 0, 1, 0));
  out.add(signMesh(wordmark, 11.5, 6.39, 2.44, 48.2, 0, -1, 0));
  return out;
}

function wynnMarquee(engine) {
  const out = model('Wynn Las Vegas street marquee');
  out.position.set(626, 0, -1172);
  out.rotation.y = -0.68;
  const bronze = new Soup(), housings = new Soup(), trim = new Soup();
  const w = 24.8, z = 2.52, lo = 16.35, hi = 50.1;
  const bowed = (k, reach, dir) => Array.from({ length: 21 }, (_, i) => {
    const p = i / 20;
    return [(p - 0.5) * k, dir * (reach + Math.sin(p * Math.PI) * 0.78)];
  });
  const ring = clean([...bowed(w, z, 1), ...bowed(w, z, -1).reverse()]);
  housings.prism(ring, lo - 0.5, hi + 0.67);
  bronze.prism(ring, 0.35, lo + 0.06);
  for (let y = 2; y < lo; y += 0.61) trim.walls(ring.map(([x, z]) => [x * 1.008, z * 1.018]), y, y + 0.085);
  put(out, bronze, sheen('#6d4b32', { refl: 0.33, glow: '#ffe3ad', glowK: 0.14 }), 'Wynn bronze pedestal');
  put(out, housings, sheen('#513831', { refl: 0.29, spec: 0.57 }), 'Wynn upright LED housing');
  put(out, trim, material('#a5784d', '#a78158'), 'Wynn horizontal bronze flutes');
  const ad = displayMaterial(out, engine, 'Wynn two-sided LED', (w - 0.56) / (hi - lo),
    ['delilah', 'second-set', 'wynn', 'late-checkout'], { duration: 11 });
  const script = crownSignature('Wynn'); script.name = 'Wynn gold signature';
  for (const side of [1, -1]) {
    const line = bowed(w - 0.55, z + 0.13, side);
    displayRibbon(out, ad, side > 0 ? line : line.reverse(), lo, hi);
    out.add(signMesh(script, 15.1, 7.2, 0, 10.95, side * 3.51, 0, side));
  }
  return out;
}

function encoreMarquee(engine) {
  const out = model('Encore northbound street marquee');
  out.position.set(851.4, 0, -1672.4);
  out.rotation.y = -0.66;
  const posts = new Soup(), cabinet = new Soup();
  for (const x of [-5.65, 5.65]) posts.box(x, 0.24, 0.02, 1.53, 8.2, 2.84);
  cabinet.box(0, 7.8, 0, 20.19, 31.43, 2.72);
  const bronze = sheen('#503b33', { refl: 0.28, glow: '#e5b67a', glowK: 0.22 });
  put(out, posts, bronze, 'Encore bronze twin legs');
  put(out, cabinet, sheen('#423838'), 'Encore portrait display cabinet');
  const oval = new THREE.CylinderGeometry(1, 1, 1.42, 64).scale(13.48, 1, 5.95).rotateX(Math.PI / 2);
  addShape(out, oval, bronze, 'Encore oval crown', 0, 43.8, 0);
  const crest = signMaterial('Encore oval crown weave', 2.27, (ctx, w, h) => {
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.495, h * 0.485, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#5e483f'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a78a755c'; ctx.lineWidth = 2.3;
    for (let x = -h; x < w + h; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke();
    }
  });
  const label = crownSignature('Encore'); label.name = 'Encore gold script';
  const art = displayMaterial(out, engine, 'Encore portrait display', 0.64,
    ['delilah', 'city-afterglow', 'encore', 'wynn'], { duration: 10.3 });
  for (const s of [-1, 1]) {
    out.add(signMesh(art, 19.65, 30.85, 0, 23.5, s * 1.39, 0, s));
    out.add(signMesh(crest, 26.7, 11.74, 0, 43.8, s * 0.88, 0, s));
    const script = signMesh(label, 22.9, 7.3, 0, 44.0, s * 1.03, 0, s);
    script.renderOrder = 1;
    out.add(script);
  }
  return out;
}

export function buildWynnMarquees(_data, options, engine) {
  const out = model('Wynn and Encore marquees');
  out.add(wynnMarquee(engine), encoreMarquee(engine));
  if (!options?.standalone) out.add(spill(624, 0.45, -1167, 44, '#f2be85', 0.19));
  return out;
}
