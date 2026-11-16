import { Soup, clean, offset, spill } from './hero-kit.js';
import { addShape, faces, material, model, put } from './landmark-forms.js';
import { letterRun, signMaterial, signMesh } from './architectural-signs.js';
import { displayMaterial, displayRibbon } from './strip-displays.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';

const THREE = window.THREE;

function caesarsMarquee(engine) {
  const out = model('Caesars Palace Flamingo marquee');
  out.position.set(111.5, 0, 135.4);
  out.rotation.y = 0.40;
  const pier = new Soup(), casework = new Soup(), crown = new Soup(), pediment = new Soup(), cornice = new Soup();
  pier.box(0, 0.05, 0, 11.0, 8.3, 4.9);
  casework.box(0, 7.9, 0, 18.44, 46.28, 5.28);
  crown.box(0, 54.04, 0, 18.9, 3.35, 5.55);
  cornice.box(0, 57.15, 0, 18.90, 0.55, 6.0);
  cornice.gable({ cx: 0, cz: 0, ax: 0, az: 1, w: 6.0, d: 18.90 }, 57.61, 3.62, undefined, undefined, pediment);
  pier.box(0, 0.05, 0, 12.3, 0.59, 5.8);
  put(out, pier, material('#a49b8b', '#a99f91', { self: 0.14 }), 'Caesars limestone pedestal');
  put(out, casework, sheen('#453136', { refl: 0.24 }), 'Caesars screen cabinet');
  put(out, crown, material('#e4ddc8', '#ddd4c2', { self: 0.23 }), 'Caesars sign fascia');
  put(out, cornice, material('#eae0cb', '#b5ada1', { self: 0.2 }), 'Projecting temple cornice');
  put(out, pediment, material('#cbc1b0', '#d0c3ab', { self: 0.2 }), 'Caesars pediment');

  const caesarsPlaylist = ['caesars', 'second-set', 'waymo', 'late-checkout', 'shows'];
  const wide = displayMaterial(out, engine, 'Caesars display', 18.18 / 45.85, caesarsPlaylist, { duration: 9.4 });
  const narrow = displayMaterial(out, engine, 'Caesars return display', 5.08 / 45.85, caesarsPlaylist, { duration: 9.4 });
  const brand = signMaterial('Caesars Palace crown letters', 6.75, (ctx, w, h) =>
    letterRun(ctx, 'CAESARS PALACE', w / 2, h / 2, w * 0.95, h * 0.81, '#e03b37', '900 Georgia, serif', 1.12), '#ce9b95');
  const medallion = signMaterial('Caesars crown medallion', 1, (ctx, w, h) => {
    ctx.fillStyle = '#702630';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.49, 0, Math.PI * 2); ctx.fill();
    letterRun(ctx, 'B', w * 0.50, h * 0.49, w * 0.59, h * 0.61, '#eae0d0', '800 Georgia, serif');
  });
  for (const side of [-1, 1]) {
    out.add(signMesh(wide, 18.18, 45.85, 0, 31.0, 2.665 * side, 0, side));
    out.add(signMesh(narrow, 5.08, 45.85, 9.245 * side, 31.0, 0, side, 0));
    out.add(signMesh(brand, 17.55, 2.6, 0, 55.6, 3.17 * side, 0, side));
    addShape(out, new THREE.CylinderGeometry(3.22, 3.22, 0.58, 40).rotateX(Math.PI / 2),
      material('#553237', '#735052'), 'Round crown frame', 0, 60.77, side * 3.05);
    out.add(signMesh(medallion, 6.25, 6.25, 0, 60.77, side * 3.54, 0, side));
  }
  return out;
}

function horseshoeMarquee(engine) {
  const out = model('Horseshoe Las Vegas Flamingo marquee');
  out.position.set(188.4, 0, 197.0);
  out.rotation.y = -0.24;
  const plan = clean([[-9.24, 3.55], [9.24, 3.55], [-1.85, -6.8]]);
  const body = new Soup(), base = new Soup(), coping = new Soup();
  body.prism(plan, 17.15, 53.91);
  coping.prism(offset(plan, 0.17), 52.1, 54.86);
  base.box(-3.75, 0.15, -0.3, 2.4, 19.7, 3.33);
  base.box(3.35, 0.15, -0.3, 2.4, 19.7, 3.33);
  base.box(0, 1.0, -0.4, 10.4, 3.3, 6.4);
  put(out, body, sheen('#29262a', { refl: 0.16, spec: 0.48 }), 'Three-sided Horseshoe screen cabinet');
  put(out, coping, material('#362e32', '#39343a', { self: 0.12 }), 'Horseshoe crown band');
  put(out, base, material('#594637', '#6a5446', { self: 0.14 }), 'Horseshoe support piers');
  const brand = signMaterial('Horseshoe crown insignia', 6.2, (ctx, w, h) => {
    ctx.strokeStyle = '#ffe399';
    ctx.lineWidth = h * 0.13;
    ctx.beginPath();
    ctx.ellipse(w * 0.089, h * 0.45, h * 0.35, h * 0.42, 0.25, -0.60, Math.PI * 1.18);
    ctx.stroke();
    letterRun(ctx, 'HORSESHOE', w * 0.56, h / 2, w * 0.78, h * 0.62, '#f5e6b6', '600 Georgia, serif', 2.0);
  }, '#dcceb7');
  const art = displayMaterial(out, engine, 'Horseshoe advertising panels', 0.52,
    ['waymo', 'pit-lights', 'shows', 'neon-market', 'zoox'], { duration: 10 });
  for (const f of faces(plan)) {
    const path = [f.length - 0.10, 0.10].map(s => [f.x + f.ax * s + f.nx * 0.13, f.z + f.az * s + f.nz * 0.13]);
    displayRibbon(out, art, path, 17.65, 52.38);
    const s = f.length / 2;
    out.add(signMesh(brand, f.length - 0.54, 2.69, f.x + f.ax * s + f.nx * 0.46, 53.50,
      f.z + f.az * s + f.nz * 0.46, f.nx, f.nz));
  }
  return out;
}

export function buildFlamingoMarquees(_data, options, engine) {
  const out = model('Flamingo Road marquees');
  out.add(caesarsMarquee(engine), horseshoeMarquee(engine));
  if (!options?.standalone) out.add(spill(111.5, 0.37, 135.4, 31, '#ffba94', 0.13));
  return out;
}
