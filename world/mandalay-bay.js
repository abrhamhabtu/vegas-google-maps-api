/** Mandalay Bay's three-wing hotel, W tower and beach. Ground-level drives use the city footprints. */
import { theme } from '../landmarks/vendor/core/theme.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { roadMask } from '../landmarks/vendor/map/lanegraph.js';
import { litColor } from '../landmarks/vendor/map/materials.js';
import { palmGeometry } from '../landmarks/vendor/map/trees.js';
import { MODE, SERIF, Soup, WHITE, centroid, clean, facade, inset, makeWaterMaterial, offset, sign, spill } from './hero-kit.js';

const THREE = window.THREE;

function facingEdges(ring, minimumLength) {
  return ring.flatMap(([x, z], i) => {
    const [qx, qz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(qx - x, qz - z);
    if (length < minimumLength) return [];
    const ax = (qx - x) / length, az = (qz - z) / length;
    return [{ x, z, length, ax, az, nx: az, nz: -ax }];
  });
}

function crownSign(out, edge, top, text, width, isW = false) {
  const { x, z, length, ax, az, nx, nz } = edge;
  const panel = sign(text, width, isW ? 10 : 8.4,
    x + ax * length / 2 + nx * 0.68, top - (isW ? 6.6 : 4.2),
    z + az * length / 2 + nz * 0.68, nx, nz, {
      font: isW ? '700 210px Arial, sans-serif' : `700 129px ${SERIF}`, color: '#ffffff',
    });
  const day = new THREE.Color(isW ? '#fff7e7' : '#8d672b');
  const night = new THREE.Color('#fff1c6');
  const sync = () => panel.material.color.lerpColors(day, night, theme.uniforms.uNight.value);
  theme.onChange(sync);
  sync();
  panel.name = isW ? 'W Las Vegas crown letter' : 'Mandalay Bay crown lettering';
  out.add(panel);
}

function mandalayTower(out, building, podiumHeight) {
  const ring = clean(building.pts);
  const h = building.h, crownBase = h - 8.3, glassBase = podiumHeight + 10.8;
  const glass = new Soup(), crown = new Soup(), piers = new Soup(), plinth = new Soup(), lights = new Soup();
  glass.walls(ring, glassBase - 0.2, crownBase, WHITE, [h, 38, 0, glassBase]);
  glass.walls(ring, podiumHeight - 0.2, glassBase, WHITE, [h, 78, 0, podiumHeight]);
  plinth.walls(offset(ring, 0.24), glassBase - 1.36, glassBase - 0.14);
  crown.prism(offset(ring, 0.36), crownBase, h);
  crown.walls(offset(ring, 0.53), h - 0.52, h + 0.38);
  crown.cap(inset(ring, 0.52) ?? ring, h + 0.03);

  const edges = facingEdges(ring, 54);
  for (const e of edges) {
    const { x, z, length, ax, az, nx, nz } = e;
    const count = Math.round(length / 8.25);
    for (let i = 0; i <= count; i++) {
      const s = 2.2 + (length - 4.4) * i / count;
      const px = x + ax * s, pz = z + az * s;
      plinth.box(px + nx * 0.19, podiumHeight - 0.2, pz + nz * 0.19,
        1.86, glassBase - podiumHeight + 0.2, 1.12, ax, az);
      piers.box(px + nx * 0.14, glassBase, pz + nz * 0.14,
        1.18, crownBase - glassBase - 10.1, 0.66, ax, az);
      lights.box(px + nx * 0.51, glassBase + 0.5, pz + nz * 0.51,
        0.51, crownBase - glassBase - 10.6, 0.12, ax, az);
      lights.box(px + nx * 0.8, podiumHeight + 0.4, pz + nz * 0.8,
        0.26, 3.2, 0.15, ax, az);
    }
    // Each of the three wings has one set of channel letters.
    if (nx > 0.85 || (nx < 0 && Math.abs(nz) > 0.65)) {
      crownSign(out, e, h, 'MANDALAY BAY', 53);
    }
  }
  // Narrow mechanical housings along each arm leave the continuous crown readable from above.
  for (const [x, z, w, d, ax, az] of [
    [-24.3, 2656, 33, 9.2, 0.012, 1], [-24, 2719, 13.4, 10.7, 1, 0],
    [20.2, 2744, 30, 8.2, 0.865, 0.502], [-67.8, 2747, 31, 8.2, 0.865, -0.502],
  ]) crown.box(x, h + 0.04, z, w, 1.84, d, ax, az);
  const crownMaterial = facade(MODE.stone, { flood: '#ffd9a2', floodK: 0.13, self: 0.018 });
  const copingDay = new THREE.Color('#cbc1b3'), copingNight = new THREE.Color('#4b4650');
  const roofDay = new THREE.Color('#bcb6ac'), roofNight = new THREE.Color('#373e4a');
  const sync = () => {
    const night = theme.uniforms.uNight.value;
    crownMaterial.uniforms.uColor.value.lerpColors(copingDay, copingNight, night);
    crownMaterial.uniforms.uRoof.value.lerpColors(roofDay, roofNight, night);
  };
  theme.onChange(sync);
  sync();
  for (const [soup, material, name] of [
    [glass, facade(MODE.goldGlass, { color: '#e0b360', glass: '#996731', self: 0.037, rate: 0.071, bay: 3.34 }), 'Mandalay Bay gold curtain wall'],
    [crown, crownMaterial, 'Mandalay Bay continuous crown'],
    [plinth, facade(MODE.stone, { color: '#bca88a', flood: '#ffb971', floodK: 1.15 }), 'Mandalay Bay stone colonnade'],
    [piers, sheen('#8b7961', { spec: 0.35, glow: '#da9956', glowK: 0.11 }), 'Mandalay Bay bronze pilasters'],
    [lights, sheen('#a89069', { glow: '#ffc475', glowK: 1.27 }), 'Mandalay Bay vertical amber lights'],
  ]) out.add(soup.mesh(material, name));
  out.add(spill(-22, 0.42, 2743, 149, '#ffbd79', 0.22));
}

function wTower(out, building) {
  const ring = clean(building.pts), h = building.h;
  const glass = new Soup(), roof = new Soup(), metal = new Soup();
  glass.walls(ring, 0, h - 0.45, WHITE, [h, 16, 1, 0]);
  roof.prism(offset(ring, 0.23), h - 0.46, h + 0.42);
  for (const [x, z, w, d] of [[-283, 2578, 6.7, 38], [-253, 2606, 24, 7.3], [-226, 2607, 9, 6.4]]) {
    roof.box(x, h + 0.42, z, w, 1.9, d);
  }
  for (const { x, z, length, ax, az, nx, nz } of facingEdges(ring, 48)) {
    for (const s of [1.4, length - 1.4]) {
      metal.box(x + ax * s + nx * 0.21, 13.5, z + az * s + nz * 0.21,
        0.56, h - 15.4, 0.42, ax, az);
    }
    if (nx > 0.8 || nz > 0.8 || nx < -0.8) {
      crownSign(out, { x, z, length, ax, az, nx, nz }, h, 'W', 13, true);
    }
  }
  out.add(
    glass.mesh(facade(MODE.goldGlass, { color: '#be9150', glass: '#664727', self: 0.09, rate: 0.105, bay: 3.37 }), 'W Las Vegas mirror glazing'),
    roof.mesh(facade(MODE.stone, { color: '#726b62', roof: '#a8a29b', self: 0.025 }), 'W Las Vegas roof and service cores'),
    metal.mesh(sheen('#9c7851', { spec: 0.6, glow: '#d69662', glowK: 0.48 }), 'W Las Vegas corner trim'),
  );
}

function curve(points, closed = false) {
  return new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed);
}

function ribbon(soup, path, width, height) {
  const segments = Math.ceil(path.getLength() / 1.9);
  const half = width / 2;
  let last;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = path.getPointAt(t), tangent = path.getTangentAt(t);
    const pair = [-half, half].map(d => soup.vert(p.x - tangent.z * d, height, p.z + tangent.x * d,
      [0, 1, 0], 0, WHITE, [height, 0, 0, 0]));
    if (last) soup.idx.push(last[0], pair[1], pair[0], last[0], last[1], pair[1]);
    last = pair;
  }
}

function addPalms(out, graph) {
  const onRoad = roadMask(graph);
  const sites = [
    [-198, 2826], [-182, 2815], [-167, 2823], [-149, 2833], [-130, 2821],
    [-113, 2821], [-95, 2815], [-69, 2823], [-60, 2840], [-72, 2855],
    [-151, 2865], [-178, 2869], [-191, 2896], [-185, 2905], [-190, 2917],
    [-205, 2950], [-190, 2971], [-167, 2982], [-126, 2967], [-100, 2962],
    [-79, 2881], [-72, 2905], [-76, 2938], [-72, 2959], [-89, 2978],
  ].filter(([x, z]) => !onRoad(x, z, 1.5));
  if (!sites.length) return;
  const palms = new THREE.InstancedMesh(palmGeometry(), litColor('#ffffff', { vertexColors: true }), sites.length);
  const tree = new THREE.Object3D();
  sites.forEach(([x, z], i) => {
    tree.position.set(x, 0.25, z);
    tree.rotation.y = i * 2.4;
    tree.scale.setScalar(0.82 + (i % 5) * 0.09);
    tree.updateMatrix();
    palms.setMatrixAt(i, tree.matrix);
  });
  palms.name = 'Mandalay Bay Beach palms';
  palms.computeBoundingSphere();
  out.add(palms);
}

function conventionRoof(out, building) {
  // These arrays sit on the west hall immediately beside the beach, above the mapped footprint.
  const panels = new Soup(), racks = new Soup();
  for (const [x0, x1, z0, z1] of [[-270, -248, 2812, 2883], [-243, -227, 2812, 2883],
    [-270, -231, 2941, 2981]]) {
    for (let z = z0; z < z1; z += 2.65) {
      racks.box((x0 + x1) / 2, building.h + 0.04, z, x1 - x0 + 0.4, 0.34, 1.76);
      for (let x = x0 + 1.12; x < x1 - 0.8; x += 2.25) {
        panels.box(x, building.h + 0.34, z, 2.13, 0.14, 1.46);
      }
    }
  }
  out.add(
    panels.mesh(sheen('#3b4b5f', { refl: 0.16, spec: 0.26 }), 'Mandalay Bay convention hall solar arrays'),
    racks.mesh(facade(MODE.stone, { color: '#84878a', roof: '#899097' }), 'Convention hall panel supports'),
  );
}

function beach(out, data, graph) {
  const deck = new Soup(), sand = new Soup(), water = new Soup(), wave = new Soup(), motif = new Soup();
  const coping = new Soup(), walls = new Soup(), shade = new Soup(), seats = new Soup(), garden = new Soup();
  const terrace = clean([
    [-205, 2812], [-180, 2812], [-169, 2818], [-150, 2813], [-144, 2802],
    [-126, 2810], [-100, 2801], [-79, 2802], [-58, 2812], [-56, 2842],
    [-37, 2860], [-34, 2890], [-42, 2911], [-40, 2943], [-51, 2977],
    [-65, 2986], [-103, 2991], [-143, 2986], [-184, 2993], [-204, 2988],
    [-214, 2951], [-210, 2927], [-213, 2890], [-208, 2851],
  ]);
  deck.cap(terrace, 0.22);
  for (const a of data.areas) {
    const [x, z] = centroid(a.pts);
    if (x < -213 || x > -8 || z < 2780 || z > 2985) continue;
    const ring = clean(a.pts);
    if (a.k === 'sand') sand.cap(ring, 0.3);
    if (a.k !== 'water') continue;
    const elevated = /Moorea Beach Club|Villa Soleil/.test(a.name ?? '');
    const y = elevated ? 7.18 : 0.40;
    const basin = a.name === 'Wave Pool' ? wave : water;
    basin.cap(ring, y);
    coping.skirt(offset(ring, 0.41), y + 0.12, ring, y + 0.12);
    coping.walls(ring, y - 0.1, y + 0.12);
  }

  // The aerial shows an open loop against the west wall, with an island between the banks.
  const lazyRiver = curve([
    [-197, 2880], [-184, 2883], [-177, 2892], [-173, 2902], [-175, 2912],
    [-181, 2924], [-188, 2934], [-197, 2940], [-200, 2936], [-196, 2929],
    [-192, 2918], [-189, 2908], [-190, 2900], [-194, 2893], [-197, 2885],
  ], true);
  ribbon(coping, lazyRiver, 5.0, 0.34);
  ribbon(water, lazyRiver, 4.0, 0.40);
  garden.cap(clean([[-194, 2884], [-184, 2887], [-178, 2898], [-177, 2908], [-181, 2919],
    [-187, 2928], [-196, 2936], [-192, 2926], [-186, 2915], [-185, 2903], [-188, 2893]]), 0.31);
  deck.box(-192.1, 0.42, 2888.6, 5.8, 0.66, 2.6, 0.93, 0.368);
  const beachEdge = curve([[-158, 2885], [-140, 2888], [-123, 2894], [-108, 2903],
    [-94, 2916], [-86, 2932], [-83, 2948]]);
  ribbon(sand, beachEdge, 9.6, 0.31);
  for (const row of [-1, 1]) {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const p = beachEdge.getPointAt(t), tangent = beachEdge.getTangentAt(t);
      const x = p.x + tangent.z * row * 1.75, z = p.z - tangent.x * row * 1.75;
      const accent = (i % 4 === 0 ? shade : seats);
      accent.box(x, 0.31, z, 1.05, 0.39, 2.28, tangent.x, tangent.z);
    }
  }
  ribbon(motif, curve([[-141, 2906], [-135, 2909], [-135, 2912], [-141, 2913], [-131, 2916], [-126, 2915]]), 0.82, 0.41);
  ribbon(motif, curve([[-141, 2917], [-132, 2919], [-119, 2920], [-113, 2923], [-114, 2927]]), 0.69, 0.41);

  // The deep end has a straight masonry wave gate and the east side steps up to Moorea.
  walls.box(-176.9, 0.23, 2960.7, 28.2, 3.8, 1.7, 0.707, 0.707);
  coping.box(-176.9, 4.02, 2960.7, 28.6, 0.34, 1.95, 0.707, 0.707);
  for (let i = -2; i <= 2; i++) walls.box(-176.9 + i * 4.6, 0.28, 2960.7 + i * 4.6, 1.25, 4.4, 2.1, 0.707, 0.707);
  for (const [x, z, ax, az] of [[-186, 2835, 1, 0], [-182, 2828, 0.92, 0.39],
    [-148, 2857, 1, 0], [-104, 2822, 0.86, -0.51], [-70, 2881, 0.66, 0.75],
    [-81, 2959, 0.91, 0.42], [-75, 2964, 0.91, 0.42]]) {
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      walls.box(x + ax * s * 1.65 - az * t * 1.48, 0.24, z + az * s * 1.65 + ax * t * 1.48,
        0.21, 2.8, 0.21, ax, az);
    }
    shade.box(x, 3.01, z, 3.8, 0.26, 3.5, ax, az);
  }
  const stone = (color, roof, self = 0.03) => facade(MODE.stone, { color, roof, self, floodK: 0.21 });
  for (const [soup, material, name] of [
    [deck, stone('#c4b9a3', '#c7bfad'), 'Mandalay Bay Beach deck'],
    [sand, stone('#dfc598', '#e5cca4'), 'Mandalay Bay Beach sand'],
    [water, makeWaterMaterial('#54bdd3', '#2c7d9e', '#92d6e2'), 'Mandalay lagoons, pools and lazy river'],
    [wave, makeWaterMaterial('#3eafcf', '#236f97', '#92e2ea', { shallow: [-142, 2909, 0.75, -0.66] }), 'Mandalay Bay wave pool'],
    [motif, makeWaterMaterial('#357f9b', '#205775', '#65aabd'), 'Wave pool tile motif'],
    [coping, stone('#d5d2c2', '#e6e0ca', 0.12), 'Mandalay pool coping and bridges'],
    [garden, stone('#527e61', '#587d62'), 'Lazy river island garden'],
    [walls, stone('#baaa91', '#c2b29a', 0.11), 'Wave gate and cabana columns'],
    [shade, stone('#aa5045', '#b75e50', 0.09), 'Mandalay beach cabanas and red loungers'],
    [seats, stone('#e3dccd', '#ece5d3', 0.1), 'Mandalay beach loungers'],
  ]) {
    const mesh = soup.mesh(material, name);
    if (mesh) out.add(mesh);
  }
  addPalms(out, graph);
  out.add(spill(-127, 0.48, 2880, 90, '#72d6f4', 0.17));
}

export function buildMandalayBay(data, graph) {
  const out = new THREE.Group();
  out.name = 'Mandalay Bay and W Las Vegas';
  const tower = data.buildings.find(b => /^mandalay bay resort & casino$/i.test(b.name ?? '') && b.h > 100);
  const west = data.buildings.find(b => /^w las vegas$/i.test(b.name ?? '') && b.h > 100);
  const podium = data.buildings.find(b => /^mandalay bay$/i.test(b.name ?? '') && b.h < 25);
  const convention = data.buildings.find(b => b.name === 'Mandalay Bay Convention Center');
  if (tower) {
    heroOwned.add(tower);
    mandalayTower(out, tower, podium?.h ?? 16);
    beach(out, data, graph);
    if (convention) conventionRoof(out, convention);
  }
  if (west) {
    heroOwned.add(west);
    wTower(out, west);
  }
  return out;
}
