/** North Strip resort architecture in the same local metres as the city and lane graph. */
import { theme } from '../landmarks/vendor/core/theme.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { roadMask } from '../landmarks/vendor/map/lanegraph.js';
import { litColor } from '../landmarks/vendor/map/materials.js';
import { palmGeometry } from '../landmarks/vendor/map/trees.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { glowPoints, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import {
  MODE, SANS, SERIF, Soup, WHITE, centroid, clean, facade, inset, makeWaterMaterial,
  obb, offset, sign, spill,
} from './hero-kit.js';

const THREE = window.THREE;
const SCRIPT = '"Snell Roundhand", "Apple Chancery", "Segoe Script", Georgia, cursive';
const TAU = Math.PI * 2;
const stone = (color, options = {}) => facade(MODE.stone, { color, roof: color, ...options });

function finish(out, batches) {
  for (const [soup, material, name] of batches) {
    const mesh = soup.mesh(material, name);
    if (mesh) out.add(mesh);
  }
}

function oval(x, z, radiusX, radiusZ, angle = 0, count = 32) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return Array.from({ length: count }, (_, i) => {
    const a = Math.cos(i / count * TAU) * radiusX, b = Math.sin(i / count * TAU) * radiusZ;
    return [x + a * cos - b * sin, z + a * sin + b * cos];
  });
}

function curve(points) {
  return new THREE.SplineCurve(points.map(([x, z]) => new THREE.Vector2(x, z)));
}

function sampleCurve(path) {
  return path.getSpacedPoints(Math.ceil(path.getLength() / 2.5)).map(p => [p.x, p.y]);
}

function frame(path, t, side = 1) {
  const p = path.getPointAt(t), tangent = path.getTangentAt(t);
  return { x: p.x, z: p.y, ax: tangent.x, az: tangent.y, nx: -tangent.y * side, nz: tangent.x * side };
}

/** One continuous UV run over the curved curtain wall, used for lettering and display panels. */
function wallStrip(soup, path, side, from, to, bottom, top, standOff) {
  const count = Math.max(1, Math.ceil(path.getLength() * (to - from) / 2.5));
  const aux = [top, 0, 0, bottom];
  for (let i = 0; i <= count; i++) {
    const t = i / count, f = frame(path, from + t * (to - from), side);
    const x = f.x + f.nx * standOff, z = f.z + f.nz * standOff;
    const u = side === 1 ? t : 1 - t;
    const first = soup.vert(x, bottom, z, [f.nx, 0, f.nz], u, WHITE, aux);
    soup.vert(x, top, z, [f.nx, 0, f.nz], u, WHITE, aux);
    soup.uv[soup.uv.length - 1] = 1;
    if (i) soup.idx.push(first - 2, first, first + 1, first - 2, first + 1, first - 1);
  }
}

function artwork(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function curvedLettering(out, path, side, from, to, bottom, top, text, font, color, standOff = 0.55) {
  const label = artwork(1024, 192, (ctx, width, height) => {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2, width - 32);
  });
  const panel = new Soup();
  wallStrip(panel, path, side, from, to, bottom, top, standOff);
  out.add(panel.mesh(new THREE.MeshBasicMaterial({
    map: label, side: THREE.DoubleSide, transparent: true, alphaTest: 0.08, depthWrite: false,
  }), text));
}

function mediaPanel(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uArt: { value: texture }, uNight: theme.uniforms.uNight, uTime: theme.uniforms.uTime,
    },
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uArt;
      uniform float uNight, uTime;
      varying vec2 vUv;
      void main() {
        vec3 art = texture2D(uArt, vUv).rgb;
        vec2 grid = vUv * vec2(480.0, 540.0);
        vec2 fw = fwidth(grid);
        float diode = 1.0 - smoothstep(0.29, 0.53, length(fract(grid) - 0.5));
        float pitch = mix(diode, 0.81, clamp(max(fw.x, fw.y), 0.0, 1.0));
        float sweep = 0.92 + 0.08 * cos(vUv.y * 4.5 - uTime * 0.34);
        vec3 color = art * mix(0.83, 1.26 * sweep, uNight) * (0.89 + 0.12 * pitch);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

function resortsWorldArtwork() {
  return artwork(512, 640, (ctx, w, h) => {
    const backdrop = ctx.createLinearGradient(0, 0, w, h);
    backdrop.addColorStop(0, '#3b3639');
    backdrop.addColorStop(1, '#28262c');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, w, h);
    // The red, swept Resorts World emblem wraps around a dark center.
    ctx.translate(w / 2, h / 2);
    ctx.scale(1.35, 1.35);
    ctx.fillStyle = '#ac3d2b';
    ctx.beginPath();
    ctx.moveTo(-126, 33);
    ctx.bezierCurveTo(-113, 0, -67, -10, -30, 30);
    ctx.bezierCurveTo(-7, 55, 11, 95, 33, 84);
    ctx.bezierCurveTo(56, 75, 44, 24, 72, 6);
    ctx.bezierCurveTo(86, -4, 90, 27, 79, 54);
    ctx.bezierCurveTo(116, 38, 143, -4, 127, -41);
    ctx.bezierCurveTo(108, -89, 53, -115, -8, -116);
    ctx.bezierCurveTo(-88, -117, -136, -70, -144, -18);
    ctx.bezierCurveTo(-154, 34, -112, 79, -62, 93);
    ctx.bezierCurveTo(-98, 68, -129, 51, -126, 33);
    ctx.closePath();
    ctx.moveTo(-69, -63);
    ctx.bezierCurveTo(-89, -49, -61, -44, -40, -44);
    ctx.bezierCurveTo(-15, -43, 1, -56, 17, -75);
    ctx.bezierCurveTo(-13, -88, -46, -80, -69, -63);
    ctx.closePath();
    ctx.fill('evenodd');
  });
}

function roofFace(soup, points, color = WHITE) {
  const [a, b, c] = points;
  const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const ac = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const normal = ab.cross(ac).normalize();
  if (normal.y < 0) normal.negate();
  const n = normal.toArray(), aux = [Math.max(...points.map(p => p[1])), 0, 0, 0];
  const [i, j, k, l] = points.map(p => soup.vert(p[0], p[1], p[2], n, 0, color, aux));
  soup.idx.push(i, j, k);
  if (l !== undefined) soup.idx.push(i, k, l);
}

function pool(deck, ring, y) {
  deck.coping.cap(offset(ring, 1.05), y + 0.12);
  deck.water.cap(ring, y + 0.15);
}

function deckSoups() {
  return {
    paving: new Soup(), coping: new Soup(), water: new Soup(), planting: new Soup(),
    trim: new Soup(), shade: new Soup(), palms: [],
  };
}

function planter(deck, x, y, z, width, depth, angle = 0, palm = true) {
  const ring = oval(x, z, width / 2, depth / 2, angle, 20);
  deck.coping.prism(ring, y, y + 0.68);
  deck.planting.cap(inset(ring, 0.32) ?? ring, y + 0.71);
  if (palm) deck.palms.push([x, y + 0.68, z]);
}

function loungers(deck, x, y, z, angle, count, gap = 3.15) {
  const ax = Math.cos(angle), az = Math.sin(angle);
  for (let i = 0; i < count; i++) {
    const t = (i - (count - 1) / 2) * gap;
    deck.trim.box(x + ax * t, y, z + az * t, 1.05, 0.44, 2.6, ax, az);
  }
}

function umbrella(deck, x, y, z) {
  const edge = oval(x, z, 2.1, 2.1, Math.PI / 8, 8);
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    roofFace(i % 2 ? deck.coping : deck.shade, [[a[0], y + 2.15, a[1]], [b[0], y + 2.15, b[1]], [x, y + 3.05, z]]);
  }
  deck.trim.box(x, y, z, 0.12, 2.68, 0.12);
}

function finishDeck(out, deck, name, { stoneColor, waterColor, blueAtNight, fabric }) {
  finish(out, [
    [deck.paving, stone(stoneColor, { roofGlow: 0.18 }), name + ' terraces'],
    [deck.coping, stone('#e4ddd0', { self: 0.13, roofGlow: 0.22 }), name + ' coping'],
    [deck.water, makeWaterMaterial(waterColor, blueAtNight, '#a3e8ef'), name + ' pools'],
    [deck.planting, stone('#649661', { roofGlow: 0.13 }), name + ' planted beds'],
    [deck.trim, stone('#f4ebdb', { self: 0.15, roofGlow: 0.2 }), name + ' pool furniture'],
    [deck.shade, stone(fabric, { floodK: 0.25, self: 0.15, roofGlow: 0.18 }), name + ' shade canopies'],
  ]);
  if (!deck.palms.length) return;
  const palms = new THREE.InstancedMesh(palmGeometry(), litColor('#ffffff', { vertexColors: true }), deck.palms.length);
  const pose = new THREE.Object3D();
  deck.palms.forEach(([x, y, z], i) => {
    pose.position.set(x, y, z);
    pose.rotation.y = i * 2.4;
    pose.scale.setScalar(0.58 + (i % 4) * 0.08);
    pose.updateMatrix();
    palms.setMatrixAt(i, pose.matrix);
  });
  palms.name = name + ' palms';
  palms.computeBoundingSphere();
  out.add(palms);
}

function resortsWorldTowers(out, tower, base) {
  // Keep the two bowed wings and their tight elbow from the surveyed perimeter.
  const westFront = curve([[638.4, -2074.9], [672.6, -2087.5], [703.5, -2093.3], [738.3, -2092.3]]);
  const eastFront = curve([[738.3, -2092.3], [747.4, -2088], [755.1, -2070.1], [775.4, -2036.8],
    [794.7, -2013.2], [821.2, -1992], [841.5, -1980.4]]);
  const westBack = curve([[628.3, -2091.3], [676.5, -2109.2], [709.3, -2113], [739.7, -2111.1]]);
  const eastBack = curve([[739.7, -2111.1], [766.7, -2095.2], [778.8, -2071.1], [795.7, -2048.4],
    [815.9, -2023.8], [852.1, -2000.2]]);
  const ring = clean([
    ...sampleCurve(westFront).slice(0, -1), ...sampleCurve(eastFront),
    ...sampleCurve(eastBack).reverse().slice(0, -1), ...sampleCurve(westBack).reverse(),
  ]);
  const glass = new Soup(), red = new Soup(), roof = new Soup(), coping = new Soup(), screen = new Soup();
  const h = tower.h;
  glass.walls(ring, base - 0.4, h - 1.5, WHITE, [h, 11, 0, base]);
  roof.prism(offset(ring, 0.34), h - 1.5, h - 0.35);
  coping.walls(offset(ring, 0.43), h - 0.9, h + 0.63);
  coping.walls(inset(ring, 1.1) ?? ring, h - 0.4, h + 0.63);

  for (const [path, side, from, to] of [
    [westFront, 1, 0, 0.09], [westFront, 1, 0.93, 1], [eastFront, 1, 0, 0.045], [eastFront, 1, 0.943, 1],
    [westBack, -1, 0, 0.09], [westBack, -1, 0.48, 0.58], [westBack, -1, 0.94, 1],
    [eastBack, -1, 0, 0.065], [eastBack, -1, 0.41, 0.49], [eastBack, -1, 0.77, 0.85], [eastBack, -1, 0.94, 1],
  ]) wallStrip(red, path, side, from, to, base - 0.35, h - 0.7, 0.49);
  // The exposed end faces are solid coral, with a secondary tall display facing the Strip.
  wallStrip(red, curve([[628.3, -2091.3], [638.4, -2074.9]]), 1, 0, 1, base - 0.35, h - 0.7, 0.4);
  const stripEnd = curve([[841.5, -1980.4], [852.1, -2000.2]]);
  wallStrip(red, stripEnd, 1, 0, 1, base - 0.35, h - 0.7, 0.4);
  const sideScreen = new Soup();
  wallStrip(sideScreen, stripEnd, 1, 0.14, 0.86, h * 0.24, h * 0.88, 0.68);
  wallStrip(screen, westFront, 1, 0.095, 0.935, h * 0.215, h * 0.873, 0.75);

  const joint = oval(751.8, -2100.6, 11.1, 10.0, -0.34, 8);
  red.prism(joint, h - 3, h + 5.4);
  roof.cap(inset(joint, 0.8) ?? joint, h + 5.47);
  for (const [x, z, angle, w] of [[678, -2099.3, -0.23, 21], [788.6, -2055.5, 0.87, 19], [820.6, -2011.5, 0.57, 14]]) {
    red.box(x, h - 0.3, z, w, 3.4, 7, Math.cos(angle), Math.sin(angle));
    roof.box(x, h + 2.85, z, w - 0.7, 0.4, 6.45, Math.cos(angle), Math.sin(angle));
  }
  finish(out, [
    [glass, facade(MODE.curtainWall, { color: '#b67e58', glass: '#8d624e', pilaster: '#623f39',
      glow: '#b96c45', line: 0.065, self: 0.23, rate: 0.13, bay: 3.77 }), 'Resorts World copper curtain wall'],
    [red, stone('#ad454a', { flood: '#ffd0ba', floodK: 0.34, self: 0.31 }), 'Resorts World coral cores'],
    [roof, stone('#c8c6c2', { roof: '#dad9d1', roofGlow: 0.1 }), 'Resorts World roof and penthouses'],
    [coping, stone('#555a60', { self: 0.14 }), 'Resorts World graphite coping'],
    [screen, mediaPanel(resortsWorldArtwork()), 'Resorts World west-wing LED'],
    [sideScreen, mediaPanel(artwork(128, 640, (ctx, w, height) => {
      const gradient = ctx.createLinearGradient(0, 0, w, height);
      gradient.addColorStop(0, '#625080');
      gradient.addColorStop(1, '#302648');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, height);
    })), 'Resorts World Strip LED'],
  ]);
  curvedLettering(out, westFront, 1, 0.13, 0.73, h - 16, h - 4, 'Resorts World', `italic 600 152px ${SCRIPT}`, '#fff5e5');
  curvedLettering(out, eastFront, 1, 0.57, 0.90, h - 13.5, h - 3, 'CONRAD', `500 127px ${SERIF}`, '#f2dfc5');
  curvedLettering(out, westBack, -1, 0.14, 0.69, h - 15, h - 3.5, 'Hilton', `600 145px ${SERIF}`, '#f6e2c7');
  curvedLettering(out, eastBack, -1, 0.15, 0.86, h - 16, h - 3.6, 'RESORTS WORLD', `600 110px ${SANS}`, '#f8e8d9');
}

function resortsWorldGrounds(out, podium, onRoad) {
  const y = podium.h, deck = deckSoups();
  const wings = new Soup(), coral = new Soup(), arcade = new Soup(), balcony = new Soup();
  const terrace = clean([[615, -2013], [645, -2060], [681, -2080], [727, -2087], [747, -2075],
    [772, -2031], [804, -1994], [823, -1962], [800, -1923], [752, -1919],
    [715, -1933], [703, -1928], [673, -1934], [657, -1959], [629, -1965]]);
  deck.paving.prism(terrace, y - 0.1, y + 0.7);
  const terraceY = y + 0.7;
  const mainPool = clean([[697, -2023], [708, -2035], [727, -2035], [743, -2027],
    [755, -2014], [763, -2000], [763, -1987], [752, -1984], [742, -1997],
    [734, -2008], [723, -2016], [709, -2014], [701, -2016]]);
  pool(deck, sampleCurve(curve([...mainPool, mainPool[0]])).slice(0, -1), terraceY);
  pool(deck, oval(680, -2000, 15.8, 13.4, 0.3), terraceY);
  const infinity = oval(691, -1948, 22.2, 19, -0.2);
  balcony.walls(infinity, terraceY - 0.6, terraceY + 2.95, WHITE, [terraceY + 3, 14, 0, terraceY]);
  deck.coping.prism(offset(infinity, 0.4), terraceY + 2.73, terraceY + 3.22);
  pool(deck, oval(691, -1948, 17.3, 14.9, -0.2), terraceY + 3.22);
  pool(deck, oval(787, -1954, 21, 6.1, -1.05), terraceY);
  pool(deck, oval(732, -2048, 11.9, 10.1), terraceY);
  pool(deck, oval(727, -1775, 12, 17, 0.11), y);
  pool(deck, oval(728, -1752, 7.5, 3.6, -0.2), y);

  for (const [x, z, w, d, angle] of [
    [656, -2031, 21, 11, -0.26], [682, -2050, 23, 12, 0.08], [707, -2055, 15, 7, 0.3],
    [710, -1990, 18, 8, 0.51], [726, -1987, 20, 7, 0.44], [750, -1968, 22, 8, -0.67],
    [683, -1971, 13, 5.7, 0.07], [777, -1929, 17, 6.4, 0.03], [789, -1983, 16, 7.8, -0.84],
  ]) planter(deck, x, terraceY, z, w, d, angle);
  for (const [x, z, angle, count] of [[666, -1981, -0.15, 8], [700, -2032, -0.65, 5], [776, -1975, -1.0, 6],
    [714, -1952, 1.1, 5], [736, -1946, 0.28, 7], [740, -1772, 1.57, 7]]) {
    const floor = z > -1800 ? y : terraceY;
    loungers(deck, x, floor, z, angle, count);
    for (const t of [-1, 1]) umbrella(deck, x + Math.cos(angle) * 6 * t, floor, z + Math.sin(angle) * 6 * t);
  }

  // Pale pool rotundas, a stepped retail wing and the separate Zouk roof block.
  for (const [x, z, rx, rz, h] of [[661, -2041, 17, 13, 5.5], [754, -2024, 13, 12, 5.3],
    [770, -1992, 15, 13, 5.1], [744, -1937, 12, 9.5, 4.2]]) {
    const ring = oval(x, z, rx, rz);
    balcony.walls(ring, terraceY - 0.25, terraceY + h, WHITE, [terraceY + h, x, 0, terraceY]);
    deck.coping.prism(offset(ring, 0.82), terraceY + h - 0.7, terraceY + h + 0.55);
    wings.prism(inset(ring, 2.6) ?? ring, terraceY + h + 0.5, terraceY + h + 1.35);
  }
  wings.prism(clean([[810, -1973], [853, -1983], [878, -2013], [899, -2029], [905, -2039],
    [902, -2045], [862, -2014], [839, -1996], [811, -1945]]), y - 0.2, y + 5.3);
  wings.prism(clean([[750, -1879], [812, -1879], [811, -1837], [822, -1810], [819, -1795],
    [744, -1795], [747, -1837]]), y - 0.3, y + 6.4);
  arcade.box(771, y - 0.3, -1771, 61, 8.6, 44, 1, 0, WHITE, [y + 8.3, 2, 0, y]);
  wings.box(771, y + 7.5, -1771, 62, 0.95, 44.9);
  out.add(sign('ZOUK', 30, 7.8, 771, y + 5.4, -1748.7, 0, 1,
    { font: `800 151px ${SANS}`, color: '#edd5f1' }));
  for (const [x, z, w, h, angle] of [[810, -1822, 11, 15, 1.57], [818, -1888, 15, 17.5, -1.08],
    [853, -1955, 15, 17, -1.08], [626, -1947, 11, 12.5, 0.45]]) {
    coral.box(x, 6.8, z, w, h - 6.8, 1.1, Math.cos(angle), Math.sin(angle));
  }
  if (!onRoad(965, -2027, 4.5)) {
    coral.box(965, 0.22, -2027, 8.2, 31, 2.9, 0.89, 0.456);
    for (const side of [-1, 1]) {
      out.add(sign('RESORTS WORLD', 7.15, 3.6, 965 - 0.73 * side, 28.1, -2027 + 1.39 * side,
        -0.456 * side, 0.89 * side, { font: `700 99px ${SANS}`, color: '#f9e7dc', background: '#6c2940' }));
    }
  }
  finishDeck(out, deck, 'Resorts World', {
    stoneColor: '#d3c5ae', waterColor: '#63b8cc', blueAtNight: '#247ba3', fabric: '#ac5057',
  });
  finish(out, [
    [wings, stone('#ded4c1', { floodK: 0.35, self: 0.12 }), 'Resorts World terrace pavilions'],
    [balcony, facade(MODE.arcade, { color: '#ded3bf', glass: '#48505a', flood: '#ffe6c1',
      floodK: 0.43, bay: 4.8, pilasterW: 0.31 }), 'Resorts World pool balcony glazing'],
    [coral, stone('#a54b51', { flood: '#ffaaa3', floodK: 0.32, self: 0.23 }), 'Resorts World podium trim and marquee'],
    [arcade, facade(MODE.arcade, { color: '#605564', glass: '#332b3d', roof: '#514756', flood: '#ec7fba',
      floodK: 0.26, bay: 4.2 }), 'Zouk nightclub'],
  ]);
  out.add(spill(700, terraceY + 0.2, -1999, 19, '#6fdad3', 0.24));
  out.add(spill(965, 0.44, -2027, 20, '#ff919f', 0.15));
}

function buildResortsWorld(data, onRoad) {
  const out = new THREE.Group();
  out.name = 'Resorts World Las Vegas';
  const buildings = data.buildings.filter(b => /^resorts world las vegas$/i.test(b.name ?? ''));
  const tower = buildings.find(b => b.h > 150);
  const podium = buildings.find(b => b.h < 25);
  if (!tower || !podium) return out;
  heroOwned.add(tower);
  resortsWorldTowers(out, tower, podium.h);
  resortsWorldGrounds(out, podium, onRoad);
  return out;
}

function circusHotel(out, towers, base) {
  const walls = new Soup(), cores = new Soup(), roof = new Soup(), stripe = new Soup();
  towers.forEach((tower, i) => {
    const ring = clean(tower.pts), h = tower.h, fit = obb(ring);
    const westTower = /^circus circus las vegas west tower$/i.test(tower.name ?? '');
    heroOwned.add(tower);
    walls.walls(ring, base - 0.35, h - 1.35, WHITE, [h, i * 9 + 5, 0, base]);
    roof.prism(offset(ring, 0.44), h - 1.45, h + 0.35);
    cores.walls(offset(ring, 0.45), base + 0.15, base + 2.6);
    roof.box(fit.cx, h + 0.2, fit.cz, westTower ? 19 : 13, westTower ? 3.5 : 2.6, 8.5, fit.ax, fit.az);

    for (let j = 0; j < ring.length; j++) {
      const a = ring[j], b = ring[(j + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 2) continue;
      const ax = dx / length, az = dz / length, nx = az, nz = -ax;
      const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
      if (length <= 26) {
        // Blank stucco end walls carry the thin rose stripe visible from the Strip.
        cores.box(x + nx * 0.1, base - 0.1, z + nz * 0.1, length - 0.15, h - base - 1.15, 0.68, ax, az);
        if (h > 60) stripe.box(x + nx * 0.54, base + 3.3, z + nz * 0.54, 1.25, h - base - 5.3, 0.26, ax, az);
      } else {
        for (const t of [0.015, 0.985]) {
          const px = a[0] + t * dx + nx * 0.27, pz = a[1] + t * dz + nz * 0.27;
          cores.box(px, base, pz, 2.1, h - base, 0.88, ax, az);
        }
        if (westTower) {
          cores.box(x + nx * 0.13, base, z + nz * 0.13, 17.3, h - base + 0.3, 0.8, ax, az);
          for (const [text, y] of [['CIRCUS', h - 13], ['CIRCUS', h - 20]]) {
            out.add(sign(text, 15.5, 7, x + nx * 0.66, y, z + nz * 0.66, nx, nz,
              { font: `800 135px ${SERIF}`, color: '#b9617a' }));
          }
        }
      }
    }
  });
  finish(out, [
    [walls, facade(MODE.arcade, { color: '#e1d9cb', glass: '#555158', flood: '#ffead5', bay: 3.92,
      pilasterW: 0.39, floodK: 0.52, rate: 0.13 }), 'Circus Circus recessed vertical bays'],
    [cores, stone('#e4dcd1', { flood: '#fff0db', floodK: 0.44, self: 0.14 }), 'Circus Circus stucco ends and piers'],
    [roof, stone('#c9b7a6', { roof: '#d4c2ae', roofGlow: 0.17 }), 'Circus Circus pale roofs'],
    [stripe, stone('#ae5d78', { self: 0.15 }), 'Circus Circus rose trim'],
  ]);
}

/** Hipped ends roll down from the glazed ridge into the surrounding smaller vaults. */
function barrelVault(shell, ribs, x, z, ax, az, length, width, spring, rise) {
  const sections = [[-0.5, 0.68, 0.22], [-0.43, 0.91, 0.73], [-0.28, 1, 1],
    [0, 1, 1], [0.28, 1, 1], [0.43, 0.91, 0.73], [0.5, 0.68, 0.22]];
  const sides = 18;
  const at = ([along, breadth, height], angle, lift = 0) => {
    const across = Math.sin(angle) * width * breadth / 2;
    return [x + ax * along * length - az * across, spring + Math.cos(angle) * rise * height + lift,
      z + az * along * length + ax * across];
  };
  for (let j = 1; j < sections.length; j++) {
    const prev = sections[j - 1], next = sections[j];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides - 0.5) * Math.PI, b = ((i + 1) / sides - 0.5) * Math.PI;
      roofFace(shell, [at(prev, a), at(next, a), at(next, b), at(prev, b)]);
      if (i % 3 === 0) roofFace(ribs, [at(prev, a, 0.10), at(next, a, 0.10), at(next, a + 0.013, 0.10), at(prev, a + 0.013, 0.10)]);
    }
  }
  for (const section of [sections[0], sections[sections.length - 1]]) {
    const [along] = section, bottom = [x + ax * along * length, spring, z + az * along * length];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides - 0.5) * Math.PI, b = ((i + 1) / sides - 0.5) * Math.PI;
      roofFace(shell, [at(section, a), at(section, b), bottom]);
    }
  }
}

function adventuredome(out, building, base) {
  const shell = new Soup(), ribs = new Soup(), drums = new Soup();
  const spring = Math.max(building.h, base) - 0.2;
  const ring = clean(building.pts);
  drums.walls(ring, building.h - 0.4, spring + 0.25);
  barrelVault(shell, ribs, 715, -2425, 0.458, -0.889, 151, 100, spring, 32);
  barrelVault(shell, ribs, 757, -2420, 0.891, 0.454, 102, 59, spring + 0.2, 26);
  barrelVault(shell, ribs, 701, -2469, 0.883, 0.469, 86, 60, spring + 0.15, 24);
  barrelVault(shell, ribs, 704, -2387, 0.78, 0.626, 81, 59, spring, 18.5);
  const lobby = oval(769, -2419, 26.5, 24, -0.2);
  drums.prism(lobby, base - 0.4, base + 13.6);
  shell.skirt(lobby, base + 13.6, inset(lobby, 10) ?? lobby, base + 19.8);
  shell.cap(inset(lobby, 10) ?? lobby, base + 19.8);
  finish(out, [
    [shell, stone('#ae5879', { roof: '#ad6482', flood: '#ec8aaa', self: 0.24, roofGlow: 0.25 }), 'Adventuredome hipped pink vaults'],
    [ribs, stone('#804158', { roof: '#7b405d', self: 0.12 }), 'Adventuredome glazing joints'],
    [drums, stone('#9d506c', { flood: '#ed8eaa', floodK: 0.32, self: 0.21 }), 'Adventuredome entrance and fascia'],
  ]);
  out.add(spill(740, 0.42, -2375, 51, '#e997b3', 0.17));
}

function circusTent(out, footprint, base) {
  const { cx, cz, ax, az, w, d } = obb(clean(footprint.pts));
  const angle = Math.atan2(az, ax), spring = base + 4.4;
  const red = new Soup(), cream = new Soup(), drum = new Soup(), trim = new Soup();
  const sectors = 40;
  const tiers = [[1, 0], [0.79, 2.1], [0.54, 6.3], [0.29, 11.3], [0.12, 14.1]];
  const rings = tiers.map(([radius, rise]) => ({
    y: spring + rise,
    ring: oval(cx + (1 - radius) * 1.8, cz - (1 - radius) * 2.1, w * radius * 0.515, d * radius * 0.515, angle, sectors),
  }));
  const lights = [], amber = new THREE.Color('#ffd28b');
  for (let i = 0; i < sectors; i++) {
    const j = (i + 1) % sectors;
    for (let t = 1; t < rings.length; t++) {
      const prev = rings[t - 1], next = rings[t];
      const [a, b, c, e] = [prev.ring[i], prev.ring[j], next.ring[j], next.ring[i]];
      roofFace(i % 2 ? cream : red, [[a[0], prev.y, a[1]], [b[0], prev.y, b[1]], [c[0], next.y, c[1]], [e[0], next.y, e[1]]]);
    }
    const [x, z] = rings[0].ring[i];
    lights.push({ x, z, y: spring - 0.54, color: amber, size: 1.12 });
  }
  const eave = rings[0].ring, top = rings[rings.length - 1];
  drum.walls(eave, base - 5.4, spring);
  trim.prism(offset(eave, 0.45), spring - 1.0, spring + 0.2);
  red.prism(top.ring, top.y - 0.1, top.y + 1.45);
  cream.cap(inset(top.ring, 0.38) ?? top.ring, top.y + 1.49);
  finish(out, [
    [red, stone('#bd5770', { roof: '#c96780', self: 0.23, roofGlow: 0.26 }), 'Circus Circus rose tent stripes'],
    [cream, stone('#f5e8d8', { roof: '#f0e4d8', self: 0.11, roofGlow: 0.22 }), 'Circus Circus cream tent stripes'],
    [drum, facade(MODE.arcade, { color: '#edcf9f', roof: '#d2bc9f', flood: '#ffcb79', floodK: 0.6, bay: 4.6,
      glass: '#715249', pilasterW: 0.34 }), 'Circus Circus casino drum'],
    [trim, stone('#d9a25d', { flood: '#ffc66e', floodK: 0.54, self: 0.37 }), 'Circus Circus tent marquee rim'],
  ]);
  out.add(glowPoints(lights, 'night', 1.3, 0.75));
  const face = Math.sign(az) || 1, nx = az * face, nz = -ax * face;
  const signOffset = d * 0.515 + 0.6;
  out.add(sign('CIRCUS CIRCUS', 26, 5.4, cx + nx * signOffset, spring - 2.4, cz + nz * signOffset, nx, nz,
    { font: `900 128px ${SERIF}`, color: '#ffe2a0', background: '#9c3455' }));
}

function circusMarquee(out, onRoad) {
  const site = [[1054, -2254], [1050, -2242], [1062, -2260]].find(([x, z]) => !onRoad(x, z, 2.5));
  if (!site) return;
  const [x, z] = site, signGroup = new THREE.Group();
  signGroup.position.set(x, 0.28, z);
  signGroup.rotation.y = -0.39;
  const yellow = sheen('#dbad5d', { glow: '#ffb850', glowK: 0.72, baseGlow: 0.06 });
  const cream = sheen('#f4dfbf', { glow: '#ffcf98', glowK: 0.46 });
  const rose = sheen('#ba3c59', { glow: '#ff5572', glowK: 0.67 });
  const ink = sheen('#374653');
  const add = (geometry, material, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    signGroup.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(2.2, 24, 1.55), yellow, [0, 12, 0]);
  add(new THREE.BoxGeometry(18.2, 7.3, 1.7), rose, [0, 20.5, 0]);
  add(new THREE.SphereGeometry(3.3, 16, 12), cream, [0, 27, 0]);
  add(new THREE.ConeGeometry(2.95, 6.4, 16), rose, [0.45, 31.8, 0]).rotation.z = -0.19;
  add(new THREE.SphereGeometry(0.6, 10, 8), yellow, [1, 34.9, 0]);
  const glow = [], gold = new THREE.Color('#ffd575');
  for (const side of [-1, 1]) {
    signGroup.add(sign('CIRCUS CIRCUS', 16.3, 6, 0, 20.6, side * 0.89, 0, side,
      { font: `900 117px ${SERIF}`, color: '#ffe8a1' }));
    add(new THREE.SphereGeometry(0.74, 12, 8), rose, [0, 26.9, side * 3.05]);
    for (const dx of [-1.03, 1.03]) add(new THREE.SphereGeometry(0.30, 10, 6), ink, [dx, 27.9, side * 2.98]);
    for (let i = 0; i < 10; i++) for (const y of [17.3, 23.7]) {
      glow.push({ x: -8.4 + i * 1.86, y, z: side * 0.92, color: gold, size: 0.68 });
    }
  }
  signGroup.add(glowPoints(glow, 'night', 1.2, 0.85));
  out.add(bakeStatic(signGroup, object => object.userData.keep === true));
  out.add(spill(x, 0.44, z, 18, '#ffc070', 0.21));
}

function buildCircusCircus(data, onRoad) {
  const out = new THREE.Group();
  out.name = 'Circus Circus and Adventuredome';
  const podium = data.buildings.find(b => /^circus circus las vegas$/i.test(b.name ?? ''));
  if (!podium) return out;
  const towers = data.buildings.filter(b => {
    if (!b.part || b.h < 45) return false;
    if (/^circus circus las vegas .*tower$/i.test(b.name ?? '')) return true;
    const [x, z] = centroid(b.pts);
    return !b.name && b.h < 55 && x > 860 && x < 929 && z > -2382 && z < -2330;
  });
  circusHotel(out, towers, podium.h);
  const dome = data.buildings.find(b => /^the adventuredome$/i.test(b.name ?? ''));
  if (dome) adventuredome(out, dome, podium.h);
  const tent = data.buildings.find(b => {
    if (b.b !== 'retail' || !b.part || b.pts.length < 20) return false;
    const [x, z] = centroid(b.pts);
    return Math.hypot(x - 991, z + 2301) < 12;
  });
  if (tent) circusTent(out, tent, podium.h);
  circusMarquee(out, onRoad);
  const pools = new Soup();
  for (const area of data.areas) {
    if (area.k !== 'water') continue;
    const [x, z] = centroid(area.pts);
    if (x > 775 && x < 870 && z > -2574 && z < -2490) pools.cap(clean(area.pts), 0.34);
  }
  finish(out, [[pools, makeWaterMaterial('#60b6ce', '#2f759a', '#a5dbe9'), 'Circus Circus pool courts']]);
  return out;
}

function fontainebleauTower(out, tower, base) {
  const south = curve([[1298.3, -2486.2], [1303.6, -2434.7], [1311, -2413],
    [1322, -2400], [1338, -2389], [1359, -2383.4], [1379, -2384], [1394, -2390],
    [1408, -2400], [1454.3, -2431.3]]);
  const back = curve([[1298.3, -2486.2], [1326, -2469], [1330, -2433],
    [1363, -2411], [1387, -2415], [1440, -2451], [1454.3, -2431.3]]);
  // The re-entrant back wall has straight returns. Only the broad front face is radiused.
  const ring = clean([...sampleCurve(south), ...back.points.slice(1, -1).reverse().map(p => [p.x, p.y])]);
  const glass = new Soup(), crown = new Soup(), metal = new Soup(), trim = new Soup();
  const h = tower.h;
  glass.walls(ring, base - 0.35, h - 1.4, WHITE, [h, 28, 1, base]);
  crown.walls(offset(ring, 0.34), h - 13.3, h - 0.4);
  metal.prism(offset(ring, 0.46), h - 1.5, h + 0.35);
  metal.walls(offset(ring, 0.59), h + 0.21, h + 0.88);
  metal.walls(inset(ring, 1.02) ?? ring, h + 0.24, h + 0.88);
  const roofEquipment = [
    [1354, -2397, 14, 11, 4.4, 0.92, 0.391], [1370, -2396, 12, 12, 3.9, 0.96, -0.28],
    [1414, -2417, 28, 9, 2.85, 0.82, -0.572], [1317, -2431, 21, 7.5, 3.15, 0.16, 0.987],
  ];
  for (const [x, z, w, d, rise, ax, az] of roofEquipment) {
    crown.box(x, h + 0.25, z, w, rise, d, ax, az);
    metal.box(x, h + rise + 0.15, z, w + 0.5, 0.3, d + 0.52, ax, az);
  }
  for (const t of [0.012, 0.31, 0.69, 0.978]) {
    wallStrip(trim, south, 1, t, t + 0.007, base + 2.5, h - 13.5, 0.62);
  }
  wallStrip(trim, south, 1, 0.015, 0.985, h - 13.3, h - 12.75, 0.73);
  finish(out, [
    [glass, facade(MODE.curtainWall, { color: '#557ca9', glass: '#396899', pilaster: '#a9c3dc',
      glow: '#6299d5', self: 0.23, line: 0.22, rate: 0.105, bay: 3.55 }), 'Fontainebleau blue curtain wall'],
    [crown, stone('#355678', { roof: '#697987', flood: '#9cbce7', floodK: 0.23, self: 0.28 }), 'Fontainebleau crown and service housings'],
    [metal, stone('#8f9ba4', { roof: '#b3bec8', roofGlow: 0.12 }), 'Fontainebleau silver coping'],
    [trim, sheen('#a1bacd', { refl: 0.26, spec: 0.75, glow: '#a8d0ff', glowK: 0.42 }), 'Fontainebleau tower accents'],
  ]);
  curvedLettering(out, south, 1, 0.37, 0.80, h - 12.8, h - 1.85,
    'FONTAINEBLEAU', `500 127px ${SERIF}`, '#f1f4fd', 0.8);
  // A straight nameplate follows the long diagonal rear wing.
  const northeast = curve([[1387, -2415], [1440, -2451]]);
  curvedLettering(out, northeast, -1, 0.03, 0.95, h - 12.8, h - 1.85,
    'FONTAINEBLEAU', `500 127px ${SERIF}`, '#f1f4fd', 0.81);
}

function bowTieArtwork() {
  return artwork(512, 224, (ctx, w, h) => {
    const back = ctx.createLinearGradient(0, 0, w, h);
    back.addColorStop(0, '#101e35');
    back.addColorStop(0.55, '#203b61');
    back.addColorStop(1, '#14233d');
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h * 0.40);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#bcd9f4';
    ctx.beginPath();
    ctx.moveTo(-92, -37);
    ctx.quadraticCurveTo(-60, -37, 0, -12);
    ctx.quadraticCurveTo(60, -37, 92, -37);
    ctx.lineTo(92, 37);
    ctx.quadraticCurveTo(60, 37, 0, 12);
    ctx.quadraticCurveTo(-60, 37, -92, 37);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = `500 30px ${SERIF}`;
    ctx.fillStyle = '#ebf1fa';
    ctx.fillText('F O N T A I N E B L E A U', w / 2, h - 27, w - 24);
  });
}

function fontainebleauArrival(out, onRoad) {
  const shell = new Soup(), lights = new Soup(), columns = new Soup(), glass = new Soup();
  const cx = 1247, cz = -2411, ax = 0.465, az = -0.885, nx = -0.885, nz = -0.465;
  const span = 98;
  const beam = (along, depth, lift = 0) => {
    const wave = Math.cos(along / span * Math.PI);
    const cantilever = (12 + 14 * wave) * depth;
    return [cx + ax * along + nx * cantilever, 16.2 + wave * 1.9 + Math.sin(depth * Math.PI) * 1.5 + lift,
      cz + az * along + nz * cantilever];
  };
  // Closely spaced white ribs are the visible skin and leave the approach clear underneath.
  for (let along = -span / 2; along <= span / 2; along += 1.85) {
    for (let j = 0; j < 8; j++) {
      const a = j / 8, b = (j + 1) / 8;
      roofFace(shell, [beam(along - 0.59, a), beam(along + 0.59, a), beam(along + 0.59, b), beam(along - 0.59, b)]);
      roofFace(lights, [beam(along - 0.14, a, -0.13), beam(along + 0.14, a, -0.13),
        beam(along + 0.14, b, -0.13), beam(along - 0.14, b, -0.13)]);
    }
  }
  for (let i = -49; i < 49; i += 2) {
    roofFace(shell, [beam(i, 1), beam(i + 2, 1), beam(i + 2, 1, -1.1), beam(i, 1, -1.1)]);
  }
  for (const along of [-42, -23, 23, 42]) {
    const [x, y, z] = beam(along, 0.22);
    if (!onRoad(x, z, 1.9)) columns.prism(oval(x, z, 1.55, 1.55, 0, 16), 0.17, y);
  }
  const [sx, sy, sz] = beam(0, 1.015);
  shell.box(sx, sy - 4, sz, 53, 3.4, 1.1, ax, az);
  out.add(sign('FONTAINEBLEAU', 47, 4.3, sx + nx * 0.69, sy - 2.15, sz + nz * 0.69, nx, nz,
    { font: `600 119px ${SERIF}`, color: '#f1e4c8' }));

  // South entrance displays meet the lower façade above the drive openings.
  const southFace = curve([[1181, -2250.1], [1246, -2243.4], [1295, -2240.5]]);
  const led = new Soup();
  wallStrip(led, southFace, 1, 0.20, 0.91, 7.5, 15.9, 0.72);
  wallStrip(glass, southFace, 1, 0.06, 0.97, 6.9, 16, 0.34);
  finish(out, [
    [shell, stone('#e5e3dc', { roof: '#e7e7e1', flood: '#a2c6fd', self: 0.2, roofGlow: 0.24 }), 'Fontainebleau ribbed porte cochere'],
    [lights, sheen('#c2deff', { glow: '#6d9dfc', glowK: 1.3, baseGlow: 0.06 }), 'Fontainebleau blue canopy light'],
    [columns, stone('#c8ced5', { flood: '#a6c2ff', self: 0.13 }), 'Fontainebleau entrance supports'],
    [glass, stone('#273b55', { self: 0.17 }), 'Fontainebleau entrance glass frame'],
    [led, mediaPanel(bowTieArtwork()), 'Fontainebleau bowtie display'],
  ]);
  out.add(spill(1226, 0.44, -2403, 45, '#82acff', 0.32));
  out.add(spill(1245, 0.44, -2249, 27, '#a3c5ff', 0.23));
}

function fontainebleauDeck(out, podium, garage) {
  const deck = deckSoups();
  const y = podium.h + 7.5;
  const terrace = clean([[1208, -2319], [1241, -2380], [1320, -2403], [1406, -2386],
    [1429, -2369], [1429, -2276], [1404, -2253], [1305, -2251], [1208, -2263], [1220, -2295]]);
  deck.paving.prism(terrace, podium.h - 0.15, y);
  const main = [[1294, -2349], [1312, -2344], [1324, -2337], [1345, -2351], [1360, -2348],
    [1365, -2337], [1357, -2326], [1342, -2322], [1342, -2313], [1357, -2308],
    [1363, -2298], [1353, -2290], [1335, -2296], [1324, -2306], [1316, -2305],
    [1298, -2295], [1285, -2301], [1288, -2315], [1307, -2321], [1306, -2327], [1290, -2336]];
  pool(deck, clean(sampleCurve(curve([...main, main[0]])).slice(0, -1)), y);
  for (const [x, z, a, b, angle] of [
    [1388, -2350, 20, 10.5, -0.23], [1400, -2307, 13.3, 8.2, -0.2],
    [1372, -2273, 15.5, 6.4, 0.07], [1233, -2329, 12.5, 9.3, -0.91],
    [1267, -2358, 14.4, 10.1, -0.18], [1278, -2288, 9.2, 6.1, 0.23],
  ]) pool(deck, oval(x, z, a, b, angle), y);
  for (const [x, z, w, d, a] of [
    [1249, -2311, 11, 6, -0.35], [1259, -2329, 11, 6, -0.25], [1289, -2321, 12, 6.1, 0.2],
    [1285, -2379, 14, 7, 0.23], [1363, -2364, 18, 6.2, 0.1], [1390, -2373, 15, 6.4, 0.1],
    [1407, -2332, 13, 6.5, 0.1], [1417, -2311, 11, 6, 1.52], [1392, -2286, 13, 5.9, 0.02],
    [1284, -2272, 14, 6, 0.1], [1348, -2274, 13, 5.8, -0.09],
  ]) planter(deck, x, y, z, w, d, a);
  for (const [x, z, angle, count] of [
    [1255, -2343, -0.46, 7], [1274, -2316, 1.57, 9], [1289, -2291, 0.12, 5],
    [1301, -2359, -0.12, 6], [1368, -2318, 1.12, 8], [1391, -2335, -0.14, 10],
    [1397, -2291, -0.16, 8], [1350, -2259, 0.02, 12],
  ]) {
    loungers(deck, x, y, z, angle, count);
    for (let i = -1; i <= 1; i++) umbrella(deck, x + 6.3 * i * Math.cos(angle) - 2.6 * Math.sin(angle), y,
      z + 6.3 * i * Math.sin(angle) + 2.6 * Math.cos(angle));
  }

  // Low white pavilion with flared petals over the pool bar.
  const barX = 1335, barZ = -2362;
  deck.coping.prism(oval(barX, barZ, 11.4, 6.0, 0.21), y, y + 1.3);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5 + 0.1) * TAU, ux = Math.cos(angle), uz = Math.sin(angle);
    deck.trim.box(barX + ux * 2.7, y, barZ + uz * 2.7, 0.65, 4.6, 0.65);
    const root = [barX + ux, y + 5.0, barZ + uz];
    const tip = [barX + ux * 16, y + 7.3, barZ + uz * 12.5];
    const left = [barX + ux * 9 - uz * 5.1, y + 5.85, barZ + uz * 7.6 + ux * 5.1];
    const right = [barX + ux * 9 + uz * 5.1, y + 5.85, barZ + uz * 7.6 - ux * 5.1];
    roofFace(deck.coping, [root, left, tip]);
    roofFace(deck.coping, [root, tip, right]);
  }
  const lounges = new Soup(), cladding = new Soup(), garageLouvers = new Soup();
  lounges.box(1260, podium.h - 0.25, -2284, 52, 16.4, 28, 0.996, 0.09, WHITE, [podium.h + 16.2, 7, 1, podium.h]);
  cladding.box(1260, podium.h + 15.3, -2284, 53.2, 1.25, 29.6, 0.996, 0.09);
  cladding.box(1401, y - 1, -2263, 45, 7.8, 17.5, 1, 0);
  if (garage) {
    const ring = clean(garage.pts);
    const edges = offset(ring, 0.34);
    for (let level = 7.2; level < garage.h; level += 4.25) {
      garageLouvers.walls(edges, level, level + 1.25);
    }
    cladding.walls(offset(ring, 0.37), garage.h - 1.2, garage.h + 0.7);
    cladding.cap(ring, garage.h + 0.10);
    for (const z of [-2315, -2390, -2467]) {
      cladding.box(1483, garage.h + 0.1, z, 30, 3.1, 9.2);
    }
  }
  finish(out, [
    [lounges, facade(MODE.curtainWall, { color: '#667e99', glass: '#496c8d', pilaster: '#b4c6d9',
      glow: '#688cbe', self: 0.18, line: 0.20 }), 'Fontainebleau pool level glass'],
    [cladding, stone('#d9dce0', { roof: '#dfded5', flood: '#b8d4ff', self: 0.16 }), 'Fontainebleau podium cladding'],
    [garageLouvers, stone('#a6b3bf', { self: 0.12 }), 'Fontainebleau garage aluminum louvers'],
  ]);
  finishDeck(out, deck, 'Fontainebleau Oasis', {
    stoneColor: '#d7d6cf', waterColor: '#47adc8', blueAtNight: '#2f8bc7', fabric: '#4d78a4',
  });
  out.add(spill(1322, y + 0.19, -2323, 34, '#89c7ff', 0.21));
}

function buildFontainebleau(data, onRoad) {
  const out = new THREE.Group();
  out.name = 'Fontainebleau Las Vegas';
  const podium = data.buildings.find(b => /^fontainebleau resort & casino$/i.test(b.name ?? ''));
  if (!podium) return out;
  const tower = data.buildings.find(b => {
    if (b.h < 195) return false;
    const [x, z] = centroid(b.pts);
    return Math.hypot(x - 1353, z + 2414) < 25;
  });
  if (!tower) return out;
  const garage = data.buildings.find(b => {
    if (b.b !== 'parking' || b.h < 32) return false;
    const [x, z] = centroid(b.pts);
    return Math.hypot(x - 1478, z + 2361) < 22;
  });
  heroOwned.add(tower);
  fontainebleauTower(out, tower, podium.h);
  fontainebleauDeck(out, podium, garage);
  fontainebleauArrival(out, onRoad);
  return out;
}

export function buildNorthStrip(data, graph) {
  const onRoad = roadMask(graph, true);
  const group = new THREE.Group();
  group.name = 'North Strip resorts';
  group.add(buildResortsWorld(data, onRoad), buildCircusCircus(data, onRoad), buildFontainebleau(data, onRoad));
  return group;
}
