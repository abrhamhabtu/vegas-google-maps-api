import { MODE, Soup, facade, offset } from './hero-kit.js';
import { along, faces, mapped, material, model, own, put } from './landmark-forms.js';
import { paintPark, signMaterial, signMesh } from './architectural-signs.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';

export function buildParkMgm(data, options) {
  const out = model('Park MGM');
  const hotel = mapped(data, -147, 1286, 110);
  if (!hotel) return out;
  const ring = own(hotel, options), h = hotel.h;
  const guest = new Soup(), cornice = new Soup(), panels = new Soup();
  const stone = new Soup(), trim = new Soup(), lights = new Soup();
  guest.walls(ring, 0, h - 6.5, undefined, [h, 27, 1, 0]);
  cornice.prism(offset(ring, 0.42), h - 6.52, h + 0.24);
  const outside = offset(ring, 0.5);
  trim.skirt(outside, h + 0.24, ring, h + 0.35);
  trim.walls(outside, h - 6.7, h - 6.29);
  trim.walls(outside, h + 0.02, h + 0.38);
  for (const floor of [16.6, 48.5]) stone.walls(offset(ring, 0.27), floor, floor + 0.56);
  const walls = faces(ring, 2.2);
  for (const f of walls) {
    if (Math.abs(f.nx) < 0.65 && f.length < 21) {
      along(panels, f, 0.08, f.length - 0.08, 14.5, h - 13.9, 0.42, 0.12);
      continue;
    }
    if (f.length < 18) continue;
    for (const at of [1.1, f.length - 1.1]) {
      along(stone, f, at - 0.29, at + 0.29, 14.6, h - 21.2, 0.51, 0.13);
    }
  }

  const logo = signMaterial('Park MGM crown lettering', 5.54, paintPark, '#bdab88');
  const wings = walls.filter(f => f.length > 33 && f.nx > 0.65);
  for (const f of wings) {
    const s = f.length * 0.5;
    out.add(signMesh(logo, 28.8, 5.2, f.x + f.ax * s + 0.48 * f.nx, h - 3.37,
      f.z + f.az * s + 0.48 * f.nz, f.nx, f.nz));
    along(lights, f, 1.25, f.length - 1.25, h - 6.29, 0.09, 0.11, 0.51);
  }

  put(out, guest, facade(MODE.masonry, {
    color: '#cec5b6', glass: '#515d68', bay: 3.36, pilaster: '#e0d6c6', glow: '#f6cf95', rate: 0.13, self: 0.055,
  }), 'Park MGM pale hotel wings');
  put(out, cornice, material('#38423b', '#777c75', { self: 0.095 }), 'Park MGM charcoal-green crown');
  put(out, panels, material('#545c55', '#777c75'), 'Park MGM dark end piers');
  put(out, stone, material('#b3aea1', '#c0b9ad', { flood: '#f6dbad', floodK: 0.27 }), 'Park MGM stone bands');
  put(out, trim, material('#787e72'), 'Park MGM crown coping');
  put(out, lights, sheen('#ab905e', { glow: '#ffcf80', glowK: 0.42 }), 'Park MGM amber crown light');
  return out;
}
