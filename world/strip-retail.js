import { Soup, bounds, spill } from './hero-kit.js';
import { addShape, material, model, put } from './landmark-forms.js';
import { letterRun, signMaterial, signMesh } from './architectural-signs.js';
import { displayMaterial } from './strip-displays.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';

const THREE = window.THREE;
const SANS = '800 "Helvetica Neue", Arial, sans-serif';
const SERIF = '600 Georgia, serif';
const DARK = '#27333d';
const GLASS = '#54757c';
const WHITE = '#f3e8d9';

// Fronts run along the Strip in local metres. Every segment stops at a mapped driveway or plaza.
function box(soup, x, z, width, y, height, depth, color) {
  soup.box(x, y, z, width, height, depth, 0, 1, new THREE.Color(color));
}

function finishes(out, parts) {
  put(out, parts.walls, material('#f3f0ec', '#abb0b0', { vertexColors: true, self: 0.23 }), 'Metal and masonry storefronts');
  put(out, parts.glass, storeGlass(), 'Show windows and doors');
  put(out, parts.steel, material('#ffffff', '#cfccbd', { vertexColors: true, self: 0.27 }), 'Canopies, frames and mullions');
  put(out, parts.light, material('#ffffff', '#ffffff', { vertexColors: true, self: 0.92 }), 'Window lighting');
}

function storeGlass() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true, color: '#ccdfe6', metalness: 0.28, roughness: 0.39,
    emissive: '#6a8793', emissiveIntensity: 0.11,
  });
}

function frontageRings(data, north, south) {
  return data.buildings.filter(b => {
    if (b.h > 24) return false;
    const { x0, x1, z0, z1 } = bounds(b.pts);
    return x0 > 171.5 && x0 < 201 && x1 < 277 && z0 > north && z1 < south;
  }).map(b => b.pts);
}

function faceX(rings, z, width, nominal) {
  const start = z - width / 2, end = z + width / 2;
  let x = nominal;
  // Keep the glazing ahead of the lowest mapped frontage over this shop's full width.
  for (const ring of rings) {
    for (const [i, [ax, az]] of ring.entries()) {
      const [bx, bz] = ring[(i + 1) % ring.length];
      if (az >= start && az <= end) x = Math.min(x, ax - 0.32);
      if (az === bz) continue;
      for (const cut of [start, end]) {
        const t = (cut - az) / (bz - az);
        if (t >= 0 && t <= 1) x = Math.min(x, ax + (bx - ax) * t - 0.32);
      }
    }
  }
  return x;
}

function storefront(out, parts, s) {
  const { x = 185, z, w, h = 12, depth = 18, name, color = '#d8d2ba', frame = DARK,
    ink = '#f9f5ef', font = SANS, windowColor = GLASS, levels = 2, side = -1, background } = s;
  const { walls, glass, steel, light } = parts;
  box(walls, x - side * depth / 2, z, w, 0, h, depth, color);
  const bayCount = Math.max(2, Math.round(w / 2.55)), pitch = w / bayCount;
  const columns = Array.from({ length: bayCount + 1 }, (_, i) => z + (i - bayCount / 2) * pitch);
  const windowHeight = Math.min(4.45, h * 0.58), fascia = windowHeight + 1.02;
  box(glass, x + side * 0.16, z, w - 0.35, 0.46, windowHeight - 0.46, 0.15, windowColor);
  box(steel, x + side * 0.31, z, w + 0.12, 0.15, 0.42, 0.34, frame);
  box(steel, x + side * 0.55, z, w + 0.26, windowHeight, 0.42, 1.15, frame);
  box(light, x + side * 0.95, z, w - 0.54, windowHeight + 0.04, 0.077, 0.063, '#ffe0af');
  box(steel, x + side * 0.13, z, w + 0.23, h - 0.24, 0.30, 0.38, frame);
  const doorBay = Math.floor(bayCount * 0.55);
  for (const [i, at] of columns.entries()) {
    box(steel, x + side * 0.28, at, i === 0 || i === bayCount ? 0.32 : 0.11,
      0.45, windowHeight - 0.31, 0.24, frame);
    if (i >= bayCount) continue;
    // One framed door, with display vitrines on the adjoining bays.
    if (i === doorBay) {
      box(steel, x + side * 0.24, at + pitch * 0.5, pitch * 0.84, 2.85, 0.085, 0.16, frame);
      box(steel, x + side * 0.29, at + pitch * 0.5, 0.10, 0.46, 2.4, 0.20, frame);
      for (const d of [-0.14, 0.14]) box(steel, x + side * 0.41, at + pitch * 0.5 + d, 0.083, 1.01, 0.31, 0.10, '#c6bba8');
    } else {
      box(light, x + side * 0.24, at + pitch * 0.5, pitch * 0.62, windowHeight * 0.88, 0.085, 0.05, s.displayLight || '#ead0a0');
      box(steel, x + side * 0.25, at + pitch * 0.47, pitch * 0.57, 0.58, 0.43, 0.14, '#9c9c8b');
    }
  }
  if (levels === 2) {
    const upper = fascia + 0.9, top = h - 0.32;
    box(glass, x + side * 0.13, z, w - 0.62, upper, top - upper, 0.19, windowColor);
    for (const at of columns) box(steel, x + side * 0.19, at, 0.15, upper, top - upper, 0.29, frame);
  }
  if (!name) return;
  const signWidth = Math.min(w - 0.72, s.signWidth ?? w * 0.81), signHeight = Math.min(2.25, (h - windowHeight) * 0.45);
  const sign = signMaterial(name, signWidth / signHeight, (ctx, w, h) => {
    if (background) {
      ctx.fillStyle = background;
      ctx.beginPath(); ctx.roundRect(0, 0, w, h, h * 0.07); ctx.fill();
    }
    letterRun(ctx, name, w / 2, h / 2, w * 0.96, h * 0.67, ink, font, s.tracking ?? 2);
  }, s.dayTint || '#d7d5ce');
  out.add(signMesh(sign, signWidth, signHeight, x + side * 0.44, s.signY ?? fascia, z, side, 0));
}

function lightbox(out, engine, name, x, y, z, w, h, playlist, duration) {
  const screen = displayMaterial(out, engine, name, w / h, playlist, { duration });
  out.add(signMesh(screen, w, h, x, y, z, -1, 0));
}

function rooftopInNOut(out, parts) {
  const { steel, light } = parts;
  const diner = model('In-N-Out upper dining deck');
  // The public restaurant sits one level above the tenant fronts, with the arrow above the parapet.
  const base = new Soup(), glazing = new Soup(), parapet = new Soup(), lamps = new Soup();
  box(base, 202, 1096.7, 32.0, 12.62, 0.94, 26, '#ece1d2');
  box(glazing, 204, 1097.0, 26.6, 13.56, 4.38, 21, '#57707c');
  box(parapet, 204, 1097.0, 29.0, 17.94, 0.95, 23.1, '#f0eadf');
  box(lamps, 192.31, 1097.0, 27.0, 17.85, 0.21, 0.14, '#ed4f3d');
  box(steel, 189.1, 1096.8, 28.0, 13.56, 0.92, 0.15, '#d7d9cf');
  for (let z = 1084; z <= 1110; z += 2.8) box(light, 193.09, z, 0.14, 13.62, 4.38, 0.14, '#d4c5ac');
  put(diner, base, material('#ffffff', '#d0cbc2', { vertexColors: true }), 'In-N-Out terrace slab');
  put(diner, glazing, storeGlass(), 'In-N-Out window wall');
  put(diner, parapet, material('#ffffff', '#dcd4c8', { vertexColors: true, self: 0.36 }), 'Diner eaves');
  put(diner, lamps, material('#ffffff', '#ffffff', { vertexColors: true, self: 0.90 }), 'In-N-Out red roof trim');
  const logo = signMaterial('In-N-Out Burger rooftop arrow', 3.55, (ctx, w, h) => {
    ctx.fillStyle = '#fed83c';
    ctx.beginPath();
    ctx.moveTo(w * 0.02, h * 0.78); ctx.lineTo(w * 0.82, h * 0.36);
    ctx.lineTo(w * 0.91, h * 0.37); ctx.lineTo(w * 0.83, h * 0.17);
    ctx.lineTo(w * 0.997, h * 0.28); ctx.lineTo(w * 0.948, h * 0.77);
    ctx.lineTo(w * 0.905, h * 0.53); ctx.lineTo(w * 0.03, h * 0.94);
    ctx.closePath(); ctx.fill();
    letterRun(ctx, 'IN-N-OUT BURGER', w * 0.44, h * 0.48, w * 0.86, h * 0.44, '#f45340', SANS, 2);
  });
  diner.add(signMesh(logo, 16.0, 4.5, 192.0, 20.6, 1098.1, -1, 0));
  out.add(diner);
}

export function buildBlvd(data, _options, engine) {
  const out = model('BLVD Las Vegas');
  const parts = { walls: new Soup(), glass: new Soup(), steel: new Soup(), light: new Soup() };
  const rings = frontageRings(data, 1015, 1232), shopFaces = new Map(), terraces = new Soup();
  // North to south, organized around the three breaks in the retail frontage.
  for (const item of [
    { z: 1025.3, w: 16.8, h: 10.3, name: 'ABC STORES', color: '#c7bfb0', ink: '#fdfdf4', background: '#212a37', levels: 1 },
    { z: 1053.5, w: 20.1, h: 12.2, name: 'JD SPORTS', color: '#202227', background: '#15171c' },
    { z: 1081.5, w: 35.0, h: 14.3, name: 'H&M', color: '#ddd8cb', font: '800 "Brush Script MT", Georgia, serif', ink: '#ed4d40',
      signWidth: 9.3, signY: 9.76 },
    { z: 1107.3, w: 16.0, h: 12.6, name: 'BLVD', color: '#d2c8b7', windowColor: '#68909b', frame: '#636b68', signY: 7.2 },
    { z: 1131.8, w: 17.7, h: 13.2, name: 'lululemon', color: '#e0d4bf', ink: '#fff0e4', background: '#aa2836' },
    { z: 1158.3, w: 33.6, h: 15.8, name: 'adidas', color: '#242526', windowColor: '#526373', frame: '#34373d', signWidth: 13.4, signY: 8.8 },
    { z: 1182.2, w: 13.65, h: 12.8, name: 'PANDORA', color: '#eadace', ink: '#fff6f0', background: '#31343b', font: SERIF },
    { z: 1202.1, w: 26.1, h: 15.5, name: 'PUMA', color: '#353b42', background: '#a62327', signY: 8.1 },
    { z: 1222.7, w: 14.3, h: 12.8, name: 'ABERCROMBIE', color: '#c1b19a', background: '#4e4237', font: SERIF },
  ]) {
    const x = faceX(rings, item.z, item.w, 185);
    storefront(out, parts, { ...item, x });
    shopFaces.set(item.name, x);
    box(terraces, x + 0.49, item.z, item.w + 0.16, 4.44, 0.40, 2.35, '#dfd3be');
    box(terraces, x + 4.30, item.z, item.w, item.h - 0.32, 0.38, 10.5, '#d9caba');
    box(parts.steel, x - 0.93, item.z, item.w - 0.55, item.h + 0.05, 0.87, 0.095, '#778b88');
  }
  rooftopInNOut(out, parts);
  const stripes = new THREE.Mesh(
    new THREE.PlaneGeometry(9.1, 3.50),
    signMaterial('adidas stripes', 2.6, (ctx, w, h) => {
      ctx.fillStyle = '#f7f4ee';
      for (let i = 0; i < 3; i++) {
        const x = (i * 0.245 + 0.055) * w;
        const top = (0.58 - i * 0.25) * h;
        ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + w * 0.18, h);
        ctx.lineTo(x + w * 0.37, top); ctx.lineTo(x + w * 0.19, top); ctx.closePath(); ctx.fill();
      }
    }, '#ddded9'),
  );
  stripes.position.set(shopFaces.get('adidas') - 0.45, 11.1, 1168.5);
  stripes.rotation.y = -Math.PI / 2;
  stripes.name = 'adidas illuminated three stripes';
  out.add(stripes);
  put(out, terraces, material('#ffffff', '#c7c1ae', { vertexColors: true }), 'BLVD projecting terrace ledges');
  lightbox(out, engine, 'BLVD north video panel', shopFaces.get('JD SPORTS') - 0.43, 9.5, 1053.5, 12.20, 4.9,
    ['neon-market', 'pit-lights', 'desert-miles', 'waymo'], 9.6);
  lightbox(out, engine, 'BLVD south video panel', shopFaces.get('PUMA') - 0.43, 12.2, 1201.7, 17.9, 5.35,
    ['pit-lights', 'city-afterglow', 'late-checkout', 'shows'], 10.3);
  for (const [name, z] of [['ABC STORES', 1029], ['JD SPORTS', 1050], ['lululemon', 1126], ['PANDORA', 1179], ['PUMA', 1207]]) {
    const x = shopFaces.get(name) - 1.75;
    box(parts.steel, x, z, 2.4, 0.14, 0.50, 0.65, '#ad9f8d');
    box(parts.walls, x, z, 2.15, 0.64, 0.54, 0.52, '#4c6657');
  }
  finishes(out, parts);
  return out;
}

function hardRockGuitar(out, x) {
  const wall = model('Hard Rock Cafe neon guitar');
  wall.position.set(x, 5.4, 1331.5);
  wall.rotation.y = -Math.PI / 2;
  const guitar = model('Angled guitar sign');
  guitar.rotation.z = -0.195;
  const profile = new THREE.Shape();
  profile.moveTo(0, 0); profile.bezierCurveTo(-6.2, -0.2, -6.0, 6.1, -3.1, 7.6);
  profile.bezierCurveTo(-1.0, 8.25, -2.25, 9.1, -2.38, 10.0);
  profile.quadraticCurveTo(-2.6, 10.9, -0.59, 10.0); profile.lineTo(-0.56, 19.5);
  profile.lineTo(-0.97, 20.1); profile.lineTo(-0.95, 22.08); profile.lineTo(0.81, 22.55);
  profile.lineTo(1.27, 20.17); profile.lineTo(0.57, 19.48); profile.lineTo(0.54, 10.0);
  profile.bezierCurveTo(2.6, 11.65, 3.05, 10.86, 2.35, 9.25);
  profile.bezierCurveTo(1.85, 8.25, 3.6, 7.5, 4.35, 5.62);
  profile.bezierCurveTo(6.05, 1.45, 2.4, -0.46, 0, 0); profile.closePath();
  addShape(guitar, new THREE.ExtrudeGeometry(profile, { depth: 0.44, bevelSegments: 2, steps: 1, bevelThickness: 0.13, bevelSize: 0.14 }),
    sheen('#742536', { refl: 0.6, spec: 1, glow: '#f76245', glowK: 0.25 }), 'Guitar sign body', 0, 0, 0);
  const outline = profile.getPoints(12).slice(0, -1).map(({ x, y }) => new THREE.Vector3(x, y, 0.58));
  addShape(guitar, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 140, 0.13, 5, true),
    material('#ffbd69', '#fc9c6b', { self: 0.98 }), 'Amber guitar neon outline', 0, 0, 0);
  const details = new THREE.Group();
  for (const x of [-0.27, 0, 0.27]) {
    addShape(details, new THREE.BoxGeometry(0.045, 15.08, 0.08), material('#fff2d0', '#fff3da', { self: 0.85 }),
      'Illuminated strings', x, 11.98, 0.59);
  }
  guitar.add(details);
  const emblem = signMaterial('Hard Rock Cafe guitar medallion', 1, (ctx, w, h) => {
    ctx.fillStyle = '#381d35'; ctx.strokeStyle = '#ffd182'; ctx.lineWidth = w * 0.041;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    letterRun(ctx, 'Hard Rock', w / 2, h * 0.47, w * 0.83, h * 0.19, '#ffde9a', SERIF);
    letterRun(ctx, 'CAFE', w / 2, h * 0.64, w * 0.49, h * 0.10, '#fff2dc', SANS, 4);
  });
  guitar.add(signMesh(emblem, 6.0, 6.0, 0, 4.92, 0.71, 0, 1));
  wall.add(guitar);
  out.add(wall);
}

function cocaCola(out) {
  const glass = sheen('#249675', { refl: 0.80, spec: 1.30, glow: '#51e6ad', glowK: 0.44 });
  const y = 0.6, x = 179.5, z = 1403.1;
  const outline = [[0, 0], [3.22, 0], [3.65, 1.15], [3.52, 3.1], [3.1, 7.4], [2.95, 10.8], [3.72, 14.5],
    [3.88, 16.05], [3.7, 17.66], [2.72, 19.3], [1.73, 21.25], [1.38, 22.72], [1.4, 25.1], [0, 25.15]];
  addShape(out, new THREE.LatheGeometry(outline.map(([r, h]) => new THREE.Vector2(r, h)), 40), glass,
    'Coca-Cola contoured glass bottle', x, y, z);
  const ribs = material('#6ca99a', '#79a6a5', { self: 0.37 });
  for (let n = 0; n < 24; n++) {
    const a = n / 24 * Math.PI * 2;
    const flute = outline.slice(2, 11).map(([r, h]) => new THREE.Vector3((r + 0.018) * Math.cos(a), h, (r + 0.018) * Math.sin(a)));
    addShape(out, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flute), 23, 0.042, 3, false), ribs,
      'Vertical glass bottle rib', x, y, z);
  }
  addShape(out, new THREE.CylinderGeometry(1.53, 1.54, 0.66, 30), material('#b9bfbe', '#c5c6bc'),
    'Bottle cap', x, y + 25.24, z);
  const label = signMaterial('Coca-Cola script', 3.26, (ctx, w, h) => {
    letterRun(ctx, 'Coca-Cola', w / 2, h / 2, w * 0.94, h * 0.73, '#fff2e2', '700 "Brush Script MT", Georgia, serif');
  });
  out.add(signMesh(label, 6.8, 2.10, x - 4.01, y + 15.66, z, -1, 0));
}

function candy(out, parts, x) {
  box(parts.walls, x, 1432, 13.2, 6.2, 14.0, 1.8, '#e3ac28');
  box(parts.steel, x - 1.1, 1432, 13.85, 20.2, 0.42, 1.6, '#eccc6a');
  box(parts.steel, x - 1.1, 1432, 13.85, 6.08, 0.42, 1.6, '#eccc6a');
  const logo = signMaterial('M&M’s World candy package', 1.18, (ctx, w, h) => {
    letterRun(ctx, "m&m’s", w / 2, h * 0.44, w * 0.92, h * 0.37, '#3e261b', '900 Georgia, serif');
    letterRun(ctx, 'WORLD', w / 2, h * 0.70, w * 0.79, h * 0.14, '#3e261b', SANS, 6);
  });
  out.add(signMesh(logo, 12.8, 10.85, x - 0.98, 14.15, 1432, -1, 0));
  const geometry = new THREE.SphereGeometry(0.68, 12, 8).scale(0.43, 1, 1);
  for (const [i, c] of ['#d8682f', '#2864c6', '#c63934', '#4a9344', '#e2c043'].entries()) {
    addShape(out, geometry, sheen(c, { refl: 0.5, glow: c, glowK: 0.39 }),
      'Raised candy medallion', x - 1.26, 8.7 + (i % 2) * 0.47, 1427.1 + i * 2.4);
  }
}

export function buildShowcase(data, _options, engine) {
  const out = model('Showcase Mall');
  const parts = { walls: new Soup(), glass: new Soup(), steel: new Soup(), light: new Soup() };
  const rings = frontageRings(data, 1264, 1548);
  const west = [
    { x: 176.4, z: 1282, w: 28, h: 14.2, name: 'TARGET', ink: '#fd6863', frame: '#333d47', color: '#cbc8c3', levels: 2, signY: 9.7 },
    { x: 177.25, z: 1302.9, w: 13.1, h: 9.0, name: 'Burlington', background: '#983244', levels: 1 },
    { x: 178, z: 1315.4, w: 11.3, h: 9.3, name: 'ROSS', background: '#20549b', color: '#d7d4ce', levels: 1 },
    { x: 180.0, z: 1329.8, w: 16.6, h: 18.8, color: '#3e3d43', frame: '#402b43', windowColor: '#667b8c', levels: 2 },
    { x: 180.0, z: 1344.1, w: 11.7, h: 18.8, name: 'ABC STORES', background: '#26333e', windowColor: '#55727d', levels: 2 },
    { x: 180.6, z: 1357.4, w: 12.7, h: 13.1, name: 'Denny’s', ink: '#ffdf73', background: '#b74333', color: '#b2a27f', levels: 1 },
    { x: 180.4, z: 1386.8, w: 18.4, h: 19.0, name: 'OUTBACK', font: SERIF, ink: '#fbdea6', background: '#773d30', signY: 13.9 },
    { x: 182.1, z: 1409.2, w: 24.7, h: 19.2, name: 'Coca-Cola Store', ink: '#fff2df', background: '#ad2b36',
      color: '#b4b1a4', signY: 5.5, signWidth: 13.0, levels: 2 },
    { x: 182, z: 1432.3, w: 19.0, h: 18.85, color: '#73625a', frame: '#695243' },
    { x: 182, z: 1450.3, w: 16.2, h: 18.8, name: 'SKECHERS', background: '#33466d', signY: 9.3 },
  ].map(s => ({ ...s, x: faceX(rings, s.z, s.w, s.x) }));
  west.forEach(s => storefront(out, parts, s));

  const guitarRoofSign = signMaterial('Hard Rock Cafe roof lettering', 5, (ctx, w, h) => {
    letterRun(ctx, 'Hard Rock Cafe', w / 2, h / 2, w * 0.96, h * 0.74, '#ffad83', SERIF);
  });
  out.add(signMesh(guitarRoofSign, 19.1, 3.82, west[4].x - 0.45, 19.9, 1347, -1, 0));
  hardRockGuitar(out, west[3].x - 1.3);
  cocaCola(out);
  candy(out, parts, west[8].x - 0.75);
  lightbox(out, engine, 'Showcase street video panel', west[5].x - 0.42, 10.12, 1356.6, 10.5, 4.28,
    ['second-set', 'neon-market', 'pit-lights', 'shows'], 10.1);
  out.add(spill(175.5, 0.47, 1338.4, 20, '#f99b74', 0.18));
  finishes(out, parts);
  return out;
}

export function buildWaldorfStorefronts() {
  const out = model('Whataburger and Parry’s at the Waldorf Astoria');
  const parts = { walls: new Soup(), glass: new Soup(), steel: new Soup(), light: new Soup() };
  storefront(out, parts, { x: 98, z: 1119.2, w: 26.3, side: 1, h: 11.8, depth: 8.5, name: 'WHATABURGER',
    color: '#cbb6a6', ink: '#ff762e', background: '#f1e9d4', signY: 8.8, frame: '#5c5148' });
  const canopy = new Soup();
  box(canopy, 98.7, 1119.2, 26.1, 4.73, 0.56, 2.05, '#d86a30');
  put(out, canopy, material('#ffffff', '#d7c9ad', { vertexColors: true, self: 0.30 }), 'Whataburger orange canopy');
  const pizza = signMaterial('Parry’s Pizzeria & Taphouse', 3.1, (ctx, w, h) => {
    ctx.fillStyle = '#232726'; ctx.fillRect(0, 0, w, h);
    letterRun(ctx, 'PARRY’S', w / 2, h * 0.40, w * 0.92, h * 0.44, '#fff2db', SERIF, 3);
    letterRun(ctx, 'PIZZERIA & TAPHOUSE', w / 2, h * 0.78, w * 0.93, h * 0.17, '#dba869', SANS, 1);
  });
  out.add(signMesh(pizza, 7.4, 2.39, 98.5, 5.9, 1126.2, 1, 0));
  finishes(out, parts);
  return out;
}
