/** The Luxor pyramid, Sky Beam, stepped hotel towers and Strip-facing Egyptian court. */
import { theme } from '../landmarks/vendor/core/theme.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { halo, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { roadMask } from '../landmarks/vendor/map/lanegraph.js';
import { MODE, SERIF, Soup, WHITE, centroid, clean, facade, inset, makeWaterMaterial, obb, offset, sign, spill } from './hero-kit.js';

const THREE = window.THREE;

function rectangle({ cx, cz, ax, az, w, d }) {
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([s, t]) => [
    cx + (ax * s - az * t) / 2,
    cz + (az * s + ax * t) / 2,
  ]);
}

function ellipsoid(out, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  out.add(mesh);
  return mesh;
}

function rod(out, material, a, b, radius, top = radius, sides = 8) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const axis = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, radius, axis.length(), sides), material);
  mesh.position.copy(start).addScaledVector(axis, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  out.add(mesh);
}

function skyBeam(out, x, height, z) {
  const beam = new THREE.Group();
  beam.name = 'Luxor Sky Beam';
  beam.position.set(x, height, z);
  for (const [radius, flare, reach, tint, strength] of [
    [1.1, 2.65, 1650, '#c3ebff', 0.54],
    [2.0, 7.2, 1900, '#77bfff', 0.25],
  ]) {
    const geometry = new THREE.CylinderGeometry(flare, radius, reach, 16, 1, true).translate(0, reach / 2, 0);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uNight: theme.uniforms.uNight,
        uTint: { value: new THREE.Color(tint) },
        uStrength: { value: strength },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        varying float vHeight;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vNormal = normalMatrix * normal;
          vView = -mvPosition.xyz;
          vHeight = uv.y;
        }
      `,
      fragmentShader: `
        uniform vec3 uTint;
        uniform float uNight, uStrength;
        varying vec3 vNormal;
        varying vec3 vView;
        varying float vHeight;
        void main() {
          float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.7);
          float fade = exp(-3.8 * vHeight) * (1.0 - smoothstep(0.62, 1.0, vHeight));
          gl_FragColor = vec4(uTint, edge * fade * uStrength * smoothstep(0.26, 0.98, uNight));
          #include <colorspace_fragment>
        }
      `,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    beam.add(new THREE.Mesh(geometry, material));
  }
  const lens = halo(15, '#c8eaff', 0.45);
  lens.position.y = 0.8;
  beam.add(lens);
  const sync = () => { beam.visible = theme.uniforms.uNight.value > 0.26; };
  theme.onChange(sync);
  sync();
  out.add(beam);
}

function pyramid(out, building) {
  const box = obb(building.pts);
  const h = 106.7;
  const outer = rectangle(box), tip = rectangle({ ...box, w: 3.6, d: 3.6 });
  const glass = new Soup(), metal = new Soup(), ridge = new THREE.Group();
  const rail = sheen('#454a53', { spec: 0.23, glow: '#a4c7f2', glowK: 0.58 });
  const markers = sheen('#8e99a7', { glow: '#cfebff', glowK: 1.17 });
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const p = outer[i], q = outer[j], P = tip[i], Q = tip[j];
    const dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
    const ax = dx / length, az = dz / length;
    const n = new THREE.Vector3(dz * h / length, box.d / 2, -dx * h / length).normalize().toArray();
    const aux = [h, 13 + i * 8, 0, 1.25];
    const vert = (r, y) => glass.vert(r[0], y, r[1], n, (r[0] - p[0]) * ax + (r[1] - p[1]) * az, WHITE, aux);
    const a = vert(p, 0.25), b = vert(q, 0.25), c = vert(Q, h), d = vert(P, h);
    glass.idx.push(a, c, b, a, d, c);

    const start = [p[0], 0.28, p[1]], end = [P[0], h, P[1]];
    rod(ridge, rail, start, end, 0.36, 0.23, 5);
    for (let k = 1; k < 26; k++) {
      const t = k / 26;
      const at = (s) => start.map((v, axis) => v + (end[axis] - v) * s);
      rod(ridge, markers, at(t - 0.0017), at(t + 0.0017), 0.26, 0.23, 5);
    }
  }
  metal.prism(offset(tip, 0.34), h - 0.42, h + 0.48);
  out.add(
    glass.mesh(facade(MODE.slopedGlass, { color: '#292933', glass: '#3b4354', self: 0.042, rate: 0.033, bay: 3.64 }), 'Luxor obsidian glazing'),
    metal.mesh(sheen('#636875', { spec: 0.62, glow: '#b7ddfc', glowK: 0.32 }), 'Luxor apex light housing'),
    bakeStatic(ridge),
  );
  skyBeam(out, box.cx, h + 0.48, box.cz);
}

function annexes(out, data) {
  const walls = new Soup(), parapets = new Soup(), trim = new Soup();
  const towers = data.buildings.filter(b => {
    if (!b.part || b.col !== 'black' || b.h < 30) return false;
    const [x, z] = centroid(b.pts);
    return x > -242 && x < 15 && z > 2149 && z < 2181;
  });
  for (const b of towers) {
    heroOwned.add(b);
    const ring = clean(b.pts), y = (b.mh ?? 20) - 6.25;
    walls.walls(ring, y, b.h - 0.57, WHITE, [b.h, b.h + centroid(ring)[0] * 0.13, 0, y]);
    parapets.prism(offset(ring, 0.22), b.h - 0.63, b.h + 0.13);
    parapets.walls(offset(ring, 0.31), b.h + 0.09, b.h + 0.45);
    trim.walls(offset(ring, 0.12), y, y + 0.84);
    if (b.h < 80) continue;
    const box = obb(ring);
    parapets.box(box.cx, b.h + 0.13, box.cz, box.w * 0.55, 1.6, box.d * 0.52, box.ax, box.az);
    for (const s of [-1, 1]) {
      trim.box(box.cx + box.ax * s * (box.w / 2 - 0.15), y, box.cz + box.az * s * (box.w / 2 - 0.15),
        0.65, b.h - y - 0.63, box.d + 0.24, box.ax, box.az);
    }
  }
  for (const [soup, material, name] of [
    [walls, facade(MODE.slopedGlass, { color: '#333d49', glass: '#475263', self: 0.075, rate: 0.069, bay: 3.22 }), 'Luxor stepped hotel towers'],
    [parapets, facade(MODE.stone, { color: '#6c6b69', roof: '#aaa69c', self: 0.04 }), 'Luxor tower terraces'],
    [trim, sheen('#80786c', { spec: 0.21, glow: '#d2b382', glowK: 0.18 }), 'Luxor tower end frames'],
  ]) {
    const mesh = soup.mesh(material, name);
    if (mesh) out.add(mesh);
  }
}

/** Smooth, indexed sections for the Sphinx's body, paws, face and headcloth. */
function loft(out, sections, point, material, flip = false) {
  const sides = 32, positions = [], uvs = [], faces = [];
  for (let i = 0; i < sections.length; i++) {
    for (let j = 0; j < sides; j++) {
      const t = j * 2 * Math.PI / sides;
      positions.push(...point(sections[i], Math.cos(t), Math.sin(t)));
      uvs.push(j / sides, i / (sections.length - 1));
      if (i === 0) continue;
      const a = (i - 1) * sides + j, b = (i - 1) * sides + (j + 1) % sides;
      const c = a + sides, d = b + sides;
      if (flip) faces.push(a, c, b, b, c, d);
      else faces.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  out.add(new THREE.Mesh(geometry, material));
}

function sphinx(out) {
  const statue = new THREE.Group();
  statue.name = 'Luxor Great Sphinx';
  statue.position.set(18.6, 7.05, 2311.8);
  const stone = sheen('#e4caa1', { spec: 0.12, glow: '#ffca91', glowK: 0.24 });
  const face = sheen('#e7c79c', { spec: 0.11, glow: '#ffd4a2', glowK: 0.26 });
  const gold = sheen('#b88b4e', { spec: 0.36, glow: '#f4b95f', glowK: 0.19 });
  const blue = sheen('#375982', { spec: 0.22, glow: '#6f99bc', glowK: 0.23 });
  const ink = sheen('#292f45', { glow: '#7991ac', glowK: 0.095 });
  const eye = sheen('#f1dcb5', { glow: '#e9c799', glowK: 0.2 });
  const along = ([x, y, depth, rise], c, s) => [x, y + rise * c, depth * s];
  const upright = ([y, x, depth, width], c, s) => [x + depth * c, y, width * s];

  loft(statue, [
    [-30.5, 2.1, 0.05, 0.05], [-28, 4.65, 5.9, 4.65], [-22, 5.3, 8.8, 5.3],
    [-14, 5.35, 9.5, 5.35], [-5, 6.45, 10.0, 6.45], [2.2, 8.05, 10.5, 8.05],
    [7.6, 8.4, 9.4, 8.4], [12.5, 7.55, 7.55, 7.55],
    [15.5, 5.65, 5.35, 5.65], [16.8, 4.25, 0.08, 0.08],
  ], along, stone);
  for (const side of [-1, 1]) {
    loft(statue, [
      [3.2, 3.2, 2.65, 3.2], [10.7, 3.2, 3.25, 3.2], [17.5, 2.6, 2.75, 2.6],
      [27.0, 1.9, 2.75, 1.9], [35.8, 1.7, 2.95, 1.7], [40.4, 1.55, 3.05, 1.55],
      [43.25, 1.4, 2.7, 1.4], [44.2, 1.22, 0.1, 0.1],
    ], (ring, c, s) => {
      const [x, y, z] = along(ring, c, s);
      return [x, y, z + side * 6.25];
    }, stone);
    for (const toe of [-1, 0, 1]) {
      ellipsoid(statue, stone, 42.8, 1.44, side * 6.25 + toe * 1.49, 2.04, 1.33, 0.93);
    }
  }
  ellipsoid(statue, face, 9.9, 15.4, 0, 4.55, 6.0, 4.75);
  loft(statue, [
    [16.35, 11.3, 0.1, 0.1], [17.3, 11.1, 2.7, 2.45],
    [18.6, 10.6, 3.52, 3.32], [20.6, 10.1, 4.06, 3.88], [22.2, 10.05, 4.05, 4.04],
    [23.7, 9.94, 4.03, 4.08], [25.0, 9.6, 3.72, 3.81],
    [25.95, 9.55, 2.52, 2.72], [26.28, 9.55, 0.1, 0.1],
  ], upright, face, true);

  const cloth = [
    [9.5, 9.4, 0.12, 3.65], [12.1, 8.75, 1.2, 4.82],
    [16.1, 6.25, 3.5, 6.45], [18.8, 5.8, 4.5, 7.2], [21.2, 6.2, 4.95, 6.42],
    [23.9, 7.3, 5.15, 4.99], [25.1, 8.6, 5.09, 4.57], [26.75, 8.95, 4.74, 4.42],
    [27.65, 9.06, 3.31, 3.75], [27.88, 9.08, 0.08, 0.08],
  ];
  // Alternate stripes along the flared linen, including the cloth draped over the shoulders.
  for (let j = 0; j < cloth.length - 1; j++) {
    const a = cloth[j], b = cloth[j + 1], count = Math.max(1, Math.round((b[0] - a[0]) / 0.62));
    const at = t => a.map((v, i) => THREE.MathUtils.lerp(v, b[i], t));
    for (let k = 0; k < count; k++) {
      loft(statue, [at(k / count), at((k + 0.61) / count)], upright, blue, true);
      loft(statue, [at((k + 0.61) / count), at((k + 1) / count)], upright, gold, true);
    }
  }
  for (const side of [-1, 1]) {
    ellipsoid(statue, face, 10.7, 22.17, side * 3.95, 0.82, 1.57, 0.49);
    ellipsoid(statue, ink, 13.66, 22.42, side * 1.65, 0.32, 0.47, 1.05);
    ellipsoid(statue, eye, 13.83, 22.43, side * 1.66, 0.24, 0.3, 0.81);
    ellipsoid(statue, ink, 14.02, 22.44, side * 1.61, 0.21, 0.23, 0.32);
    const brow = new THREE.CatmullRomCurve3([[13.9, 23.36, 0.74], [13.85, 23.68, 1.75],
      [13.57, 23.47, 2.56], [13.2, 23.1, 3.36]].map(([x, y, z]) => new THREE.Vector3(x, y, side * z)));
    statue.add(new THREE.Mesh(new THREE.TubeGeometry(brow, 12, 0.12, 5), ink));
  }
  ellipsoid(statue, face, 14.02, 21.32, 0, 1.17, 1.42, 0.69);
  ellipsoid(statue, face, 14.17, 20.48, 0, 0.8, 0.48, 0.86);
  ellipsoid(statue, gold, 14.01, 19.15, 0, 0.25, 0.19, 1.13);
  rod(statue, blue, [14.52, 12.5, 0], [13.62, 17.55, 0], 0.49, 1.01);
  for (let y = 13.1; y < 17.4; y += 0.6) {
    const x = 14.52 - (y - 12.5) * 0.18;
    ellipsoid(statue, gold, x + 0.48, y, 0, 0.24, 0.12, 0.62);
  }
  ellipsoid(statue, gold, 13.43, 26.25, 0, 0.83, 1.92, 0.6);
  ellipsoid(statue, gold, 13.82, 27.9, 0, 0.56, 0.56, 0.45);
  out.add(bakeStatic(statue));
}

function obelisk(out, site) {
  const box = obb(site.pts);
  const { cx, cz, ax, az } = box;
  const shaft = new Soup(), moldings = new Soup();
  const foot = rectangle({ ...box, w: 9.8, d: 9.8 });
  const base = rectangle({ ...box, w: 7.35, d: 7.35 });
  const shoulder = rectangle({ ...box, w: 4.45, d: 4.45 });
  const point = rectangle({ ...box, w: 0.06, d: 0.06 });
  moldings.prism(foot, 0, 1.0);
  moldings.prism(inset(foot, 0.64) ?? foot, 1.0, 3.5);
  moldings.prism(offset(base, 0.28), 3.5, 4.3);
  shaft.skirt(base, 4.3, shoulder, 38.75);
  shaft.skirt(shoulder, 38.75, point, 42.7);
  out.add(
    shaft.mesh(facade(MODE.stone, { color: '#d5bd95', flood: '#ffd69d', floodK: 0.74, self: 0.14 }), 'Luxor sandstone obelisk'),
    moldings.mesh(facade(MODE.stone, { color: '#cbb089', roof: '#cbb695', floodK: 0.72 }), 'Luxor obelisk plinth'),
  );
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 175px ${SERIF}`;
  ctx.fillStyle = '#223b59';
  ctx.strokeStyle = '#c4ae8b';
  ctx.lineWidth = 5;
  [...'LUXOR'].forEach((letter, i) => {
    ctx.strokeText(letter, 128, 118 + i * 192);
    ctx.fillText(letter, 128, 118 + i * 192);
  });
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, alphaTest: 0.08, fog: true });
  const geometry = new THREE.PlaneGeometry(4.4, 16.8);
  const slope = (7.35 - 4.45) / 2 / (38.75 - 4.3);
  const y = 28.4, stand = 7.35 / 2 - (y - 4.3) * slope + 0.10;
  for (const [nx, nz] of [[ax, az], [-ax, -az], [-az, ax], [az, -ax]]) {
    const panel = new THREE.Mesh(geometry, mat);
    panel.position.set(cx + stand * nx, y, cz + stand * nz);
    panel.rotation.y = Math.atan2(nx, nz);
    panel.rotateX(-Math.atan(slope));
    out.add(panel);
  }
}

function entrance(out, data, graph) {
  const podium = data.buildings.find(b => {
    if (b.part || b.h !== 7) return false;
    const [x, z] = centroid(b.pts);
    return x > 21 && x < 27 && z > 2308 && z < 2315;
  });
  const terrace = new Soup(), rails = new Soup(), courts = new Soup(), water = new Soup();
  if (podium) {
    const ring = clean(podium.pts);
    terrace.prism(offset(ring, 0.16), podium.h - 0.56, podium.h + 0.09);
    for (const side of [-1, 1]) {
      rails.box(42.3, 7.09, 2311.75 + side * 12.0, 42, 0.46, 0.62);
      for (const x of [25, 34, 43, 52, 62]) {
        rails.box(x, 7.09, 2311.75 + side * 12.0, 1.02, 1.1, 1.06);
      }
    }
  }
  const onRoad = roadMask(graph);
  const guardians = new THREE.Group();
  guardians.name = 'Luxor avenue of sphinxes';
  const guardianStone = sheen('#d9c29e', { glow: '#efc58f', glowK: 0.19 });
  for (const z of [2256.7, 2363.8]) {
    // The twin stone stairways start in the forecourt on either side of the statue.
    if (onRoad(94, z, 4.5)) continue;
    for (let i = 0; i < 7; i++) {
      courts.box(100.1 - i * 1.2, 0.09, z, 1.35, 0.24 + i * 0.19, 7.5);
    }
    for (const side of [-1, 1]) {
      rails.box(95.8, 0.16, z + side * 4.3, 9.25, 1.2, 0.92);
      for (const x of [93.2, 97.2, 100.5]) {
        const pz = z + side * 4.3;
        rails.box(x, 1.2, pz, 1.34, 0.74, 0.93);
        ellipsoid(guardians, guardianStone, x - 0.15, 2.19, pz, 0.62, 0.27, 0.37);
        ellipsoid(guardians, guardianStone, x + 0.28, 2.54, pz, 0.24, 0.56, 0.26);
      }
    }
  }
  if (guardians.children.length) out.add(bakeStatic(guardians));
  for (const a of data.areas) {
    if (a.k !== 'water') continue;
    const [x, z] = centroid(a.pts);
    if (x < -296 || x > -222 || z < 2217 || z > 2340) continue;
    const ring = clean(a.pts);
    water.cap(ring, 0.33);
    terrace.skirt(offset(ring, 0.42), 0.45, ring, 0.45);
  }
  const stone = facade(MODE.stone, { color: '#c9b28f', roof: '#d9c7aa', flood: '#ffcc94', floodK: 0.68 });
  for (const [soup, material, name] of [
    [terrace, stone, 'Luxor Sphinx court and pool coping'],
    [rails, stone, 'Luxor temple balustrades'],
    [courts, stone, 'Luxor forecourt steps'],
    [water, makeWaterMaterial('#59bacd', '#277899', '#98dbe3'), 'Luxor Oasis pools'],
  ]) {
    const mesh = soup.mesh(material, name);
    if (mesh) out.add(mesh);
  }
  // This panel sits on the entry fascia below the glass pyramid.
  out.add(sign('LUXOR', 21, 4.3, -13.76, 5.06, 2311.4, 1, 0, {
    font: `700 124px ${SERIF}`, color: '#f9e6bc',
  }));
  out.add(spill(24, 0.45, 2312, 101, '#ffe0b4', 0.23));
}

export function buildLuxor(data, graph) {
  const out = new THREE.Group();
  out.name = 'Luxor Las Vegas';
  const building = data.buildings.find(b => /^luxor( las vegas)?$/i.test(b.name ?? '') && b.h > 85);
  if (!building) return out;
  const site = data.buildings.find(b => {
    if (b.name || b.part || b.h < 40 || b.h > 70) return false;
    const [x, z] = centroid(b.pts);
    return Math.hypot(x - 111, z - 2311) < 5;
  });
  if (site) {
    heroOwned.add(site);
    obelisk(out, site);
  }
  pyramid(out, building);
  annexes(out, data);
  entrance(out, data, graph);
  sphinx(out);
  return out;
}
