import { MODE, Soup, clean, facade, inset, offset } from './hero-kit.js';
import { along, faces, mapped, material, model, named, own, parapet, put, standalonePodium } from './landmark-forms.js';
import { letterRun, signMaterial, signMesh } from './architectural-signs.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';

export function buildTrumpHotel(data, options) {
  const out = model('Trump International Hotel Las Vegas');
  const tower = mapped(data, 171, -1486, 195);
  if (!tower) return out;
  const plan = own(tower, options), top = tower.h, crown = top - 9.75, base = 12.8;
  const glass = new Soup(), sill = new Soup(), returns = new Soup(), coping = new Soup(), roof = new Soup();
  glass.walls(plan, base, crown, undefined, [top, 32, 1, base]);
  const lip = offset(plan, 0.11);
  for (let h = base + 1.45; h < crown - 0.25; h += 2.91) sill.walls(lip, h, h + 0.10);
  const wallFaces = faces(plan, 0.45);
  for (const f of wallFaces) {
    if (f.length >= 3.35) continue;
    along(returns, f, 0.02, f.length - 0.02, base, crown - base, 0.16, 0.06);
  }
  coping.walls(offset(plan, 0.19), crown - 0.20, top - 0.82);
  parapet(coping, plan, top - 0.84, 0.84, 0.19);
  roof.cap(plan, top - 1.02);
  const house = inset(plan, 4.8);
  if (house) roof.prism(house, top - 1.05, top - 0.15);
  put(out, glass, facade(MODE.goldGlass, {
    color: '#db9c38', glass: '#e5b558', roof: '#a1a0a1', glow: '#ffce77', bay: 2.91,
    pilaster: '#86704f', self: 0.21, rate: 0.10,
  }), 'Reflective gold curtain wall');
  put(out, returns, sheen('#705336', { refl: 0.34, spec: 0.55, glow: '#deb16b', glowK: 0.085 }), 'Recessed bronze vertical returns');
  put(out, sill, sheen('#a8956c', { refl: 0.29, spec: 0.6, glow: '#ffd292', glowK: 0.035 }), 'Fine horizontal curtain-wall rails');
  put(out, coping, material('#d7d9d6', '#c5c8c9', { self: 0.20 }), 'Silver crown panel band');
  put(out, roof, material('#737b82', '#8d9399'), 'Recessed service roof');

  const faceSign = (f, w, h, mat) => {
    const s = f.length / 2;
    out.add(signMesh(mat, w, h, f.x + f.ax * s + f.nx * 0.24, crown + 4.55,
      f.z + f.az * s + f.nz * 0.24, f.nx, f.nz));
  };
  const lettering = (text, name, aspect) => signMaterial(name, aspect, (ctx, w, h) => {
    letterRun(ctx, text, w / 2, h / 2, w * 0.96, h * 0.74, '#ffdc91', '700 Georgia, serif', 6.4);
  }, '#574c3a');
  const crownName = lettering('TRUMP', 'Trump crown lettering', 4.55), monogram = lettering('T', 'Trump end monogram', 1.25);
  for (const f of wallFaces.filter(f => f.length > 33 && Math.abs(f.nz) > 0.97)) faceSign(f, 34.15, 7.5, crownName);
  for (const f of wallFaces.filter(f => f.length > 9 && Math.abs(f.nx) > 0.97 && Math.abs(f.x - 171) > 40)) faceSign(f, 7.9, 6.32, monogram);

  const podium = named(data, 'Trump International Hotel Las Vegas');
  standalonePodium(out, podium, options, material('#b4b0a6', '#b7b2a4'));
  if (podium) {
    const cap = new Soup();
    cap.walls(offset(clean(podium.pts), 0.17), podium.h - 0.75, podium.h + 0.16);
    put(out, cap, material('#b6b2aa'), 'Stone podium coping');
  }
  return out;
}
