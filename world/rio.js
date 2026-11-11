/** Rio's hotel towers and grounds, built over the mapped casino and valet geometry. */
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { roadMask } from '../landmarks/vendor/map/lanegraph.js';
import { litColor } from '../landmarks/vendor/map/materials.js';
import { palmGeometry } from '../landmarks/vendor/map/trees.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { MODE, Soup, WHITE, bounds, centroid, clean, facade, inset, obb, offset, sign, spill } from './hero-kit.js';

const THREE = window.THREE;
const PALETTE = ['#ffad57', '#ed465a', '#b94cc4', '#35cbde', '#9c56db', '#f26b74', '#ffac58'];

function wordmarkTexture(colors, outline) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.scale(2.8, 2.8);
  ctx.lineCap = ctx.lineJoin = 'round';
  // Draw the italic Rio signature and its long rising underline.
  const strokes = [
    'M29 80 Q49 58 64 41 Q76 28 87 27 M36 52 Q74 19 115 24 Q139 28 114 44 Q95 57 69 54 Q98 54 117 70',
    'M119 67 Q132 49 145 44 Q140 54 133 64 Q144 66 160 55 M149 34 L152 31',
    'M163 55 Q176 37 201 36 Q220 37 204 51 Q180 67 165 63 Q160 60 163 55',
    'M29 90 Q100 66 175 67 Q216 67 241 73',
  ];
  for (let i = 0; i < strokes.length; i++) {
    const path = new Path2D(strokes[i]);
    ctx.lineWidth = i === 3 ? 13 : 16;
    ctx.strokeStyle = outline;
    ctx.stroke(path);
    ctx.lineWidth -= 6;
    ctx.strokeStyle = colors[i];
    ctx.stroke(path);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function mark(texture, x, y, z, nx, nz, width) {
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, alphaTest: 0.025, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.43), material);
  mesh.name = 'Rio signature';
  mesh.position.set(x, y, z);
  mesh.rotation.y = Math.atan2(nx, nz);
  return mesh;
}

function cap(soup, ring, height, color = WHITE) {
  const inside = inset(ring, 0.52) ?? ring;
  const outside = offset(ring, 0.24);
  const top = height + 0.65;
  const aux = [top, 0, 0, height - 3];
  soup.cap(inside, height - 0.35, color);
  soup.walls(outside, height - 1.25, top, color, aux);
  soup.walls(inside, height - 0.35, top, color, aux);
  soup.skirt(outside, top, inside, top, color, aux);
}

function addIpanema(out, tower, parts, logo, base) {
  const ring = clean(tower.pts);
  const h = tower.h;
  const glass = parts.glass;
  // Reset the colour arc and pilaster spacing on each face of the three wings.
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const normal = [(q[1] - p[1]) / length, 0, -(q[0] - p[0]) / length];
    const aux = [h, length, 0, base];
    const a = glass.vert(p[0], base, p[1], normal, 0, WHITE, aux);
    const b = glass.vert(q[0], base, q[1], normal, length, WHITE, aux);
    const c = glass.vert(q[0], h, q[1], normal, length, WHITE, aux);
    const d = glass.vert(p[0], h, p[1], normal, 0, WHITE, aux);
    glass.idx.push(a, c, b, a, d, c);
  }
  cap(parts.trim, ring, h);
  // Central elevator crown rises above the three Ipanema wings.
  const x = -1219, z = -142, ax = Math.SQRT1_2, az = Math.SQRT1_2;
  const top = h + 9.3;
  parts.core.box(x, base, z, 24, top - base, 24, ax, az);
  parts.trim.box(x, top - 1.25, z, 25.2, 1.65, 25.2, ax, az);
  parts.trim.box(x, top + 0.4, z, 18.2, 1.6, 18.2, ax, az);
  for (const [nx, nz] of [[-ax, az], [ax, az]]) {
    parts.trim.box(x + nx * 12.1, base, z + nz * 12.1, 3.7, top - base - 6, 0.65, nz, -nx,
      WHITE, [top - 6, 0, 0, base]);
    out.add(mark(logo, x + nx * 12.7, top - 2.6, z + nz * 12.7, nx, nz, 21));
  }
}

function addMasquerade(out, tower, steps, parts, logo, base) {
  const ring = clean(tower.pts);
  const [x] = centroid(ring);
  const shoulder = steps[0] ? steps[0].h - 7 : tower.h;
  parts.core.walls(offset(ring, 0.25), 0, base, WHITE, [base, 0, 0, 0]);
  parts.glass.walls(ring, base, shoulder, WHITE, [shoulder, x, 1, base]);
  cap(parts.trim, ring, shoulder);

  let lower = shoulder;
  for (const step of steps) {
    const outline = clean(step.pts);
    const upper = inset(outline, 0.62) ?? outline;
    parts.glass.walls(upper, lower - 0.31, step.h, WHITE, [shoulder, x, 1, base]);
    cap(parts.trim, upper, step.h);
    lower = step.h;
  }
  const front = bounds(ring).z1;
  out.add(mark(logo, x, lower - 5.6, front + 0.9, 0, 1, 31));
  out.add(sign('VOODOO LOUNGE', 21, 2.6, x, lower - 9.8, front + 1.05, 0, 1,
    { font: '600 130px sans-serif', color: '#e8d5fb' }));

  // White uplights sit on the plinth, attached to the curved south façade.
  let along = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
    for (let s = 7.4 - along; s < length; s += 7.4) {
      if (-tx < 0.38) continue;
      const px = a[0] + tx * s + tz * 0.34, pz = a[1] + tz * s - tx * 0.34;
      parts.light.box(px, 0.6, pz, 0.88, base - 0.6, 0.79, tx, tz);
    }
    along = (along + length) % 7.4;
  }
}

function addCanopy(parts, footprint) {
  // Match the existing 8 m valet fascia. All new ribs are above the drive opening.
  const { cx, cz, w, d, ax, az } = obb(footprint.pts);
  const halfWidth = d * 0.31, length = w * 0.94, base = 8.18, rise = 3.75;
  function section(s0, s1, soup, lift) {
    const row = [];
    const count = 10;
    for (let i = 0; i <= count; i++) {
      const t = i / count * 2 - 1;
      const y = base + rise * (1 - t * t) + lift;
      const slope = 2 * rise * t / halfWidth;
      const n = new THREE.Vector3(-az * slope, 1, ax * slope).normalize().toArray();
      row.push([s0, s1].map(s => soup.vert(
        cx + ax * s - az * t * halfWidth, y, cz + az * s + ax * t * halfWidth,
        n, 0, WHITE, [base + rise, 0, 0, base],
      )));
    }
    for (let i = 1; i < row.length; i++) {
      const [a, b] = row[i - 1], [c, d] = row[i];
      soup.idx.push(a, c, b, b, c, d);
    }
  }
  for (let i = 0; i < 7; i++) {
    const s = length * (i / 7 - 0.5);
    section(s, s + length / 7, parts.canopy, 0);
    section(s - 0.17, s + 0.17, parts.trim, 0.11);
  }
  section(length / 2 - 0.17, length / 2 + 0.17, parts.trim, 0.11);
  for (const side of [-1, 1]) {
    parts.trim.box(cx - az * halfWidth * side, base - 0.04, cz + ax * halfWidth * side,
      length, 0.35, 0.42, ax, az);
  }
}

function addMarquee(out, graph, logo) {
  const onRoad = roadMask(graph, true);
  // Sign island just past the east corner of the garage along Flamingo.
  const site = [[-1296, 33], [-1302, 35], [-1309, 36], [-1316, 37]]
    .find(([x, z]) => !onRoad(x, z, 7));
  if (!site) return;
  const g = new THREE.Group();
  g.name = 'Rio carnival marquee';
  g.position.set(site[0], 0, site[1]);
  g.rotation.y = -0.28;
  const base = sheen('#34435c', { spec: 0.28 });
  const screen = sheen('#e5a15d', { glow: '#ff9d52', glowK: 0.72, baseGlow: 0.1 });
  const framing = new Soup(), display = new Soup();
  for (const side of [-1, 1]) {
    framing.box(side * 3.7, 0, 0, 1.85, 5.4, 2.2);
    display.box(side * 3.7, 3.2, 0, 1.91, 0.65, 2.24);
  }
  framing.box(0, 4.5, 0, 15.8, 6.45, 2.8);
  for (const side of [-1, 1]) display.box(0, 5.1, 1.43 * side, 14.4, 5.25, 0.07);
  g.add(framing.mesh(base, 'Rio marquee framing'), display.mesh(screen, 'Rio amber display'));
  for (let i = 0; i < PALETTE.length; i++) {
    const side = i - 3;
    const tipX = side * 3.45, tipY = 12.4 - Math.abs(side) * 1.64;
    const plume = new THREE.Shape();
    plume.moveTo(side * 0.36 - 0.75, 0);
    plume.quadraticCurveTo(tipX * 0.46, tipY * 0.57, tipX - 1.12, tipY - 0.72);
    plume.lineTo(tipX + 0.94, tipY);
    plume.quadraticCurveTo(tipX * 0.67, tipY * 0.48, side * 0.36 + 0.75, 0);
    plume.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(plume, { depth: 0.36, bevelEnabled: false, curveSegments: 8 }),
      sheen(PALETTE[i], { glow: PALETTE[i], glowK: 0.57, baseGlow: 0.055 }));
    fin.position.set(0, 10.8, -Math.abs(side) * 0.19);
    g.add(fin);
  }
  const gold = sheen('#ffd86a', { glow: '#ffd455', glowK: 0.9, baseGlow: 0.12 });
  for (const side of [-1, 1]) {
    const ornament = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), gold);
    ornament.position.set(side * 1.25, 12.5, 0.63);
    ornament.rotation.z = -side * 0.5;
    ornament.scale.set(0.92, 1.85, 0.42);
    g.add(ornament);
  }
  out.add(bakeStatic(g));
  const nx = Math.sin(g.rotation.y), nz = Math.cos(g.rotation.y);
  for (const dir of [-1, 1]) {
    out.add(mark(logo, site[0] + nx * dir * 1.65, 17, site[1] + nz * dir * 1.65, nx * dir, nz * dir, 15.4));
  }
  out.add(spill(site[0], 0.43, site[1], 14, '#ffbd79', 0.34));
}

function addArrivalGardens(out, graph) {
  const sites = [
    [[-1248, 24], [-1223, 35], 3.1],
    [[-1193, 40], [-1155, 42], 3.5],
    [[-1123, 35], [-1101, 37], 3.0],
    [[-1000, 43], [-1001, 55], 2.6],
    [[-1294, 47], [-1279, 47], 2.7],
  ];
  const onRoad = roadMask(graph, true);
  const soil = new Soup(), edging = new Soup(), palms = [];
  for (const [a, b, radius] of sites) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.ceil(length / 1.4);
    const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    // Keep the whole raised bed behind the curb, including the two round ends.
    if (Array.from({ length: count + 1 }, (_, i) => at(i / count)).some(
      ([x, z]) => onRoad(x, z, radius + 0.45),
    )) continue;
    const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const shape = [];
    for (const [end, sign] of [[b, 1], [a, -1]]) {
      for (let i = 0; i <= 12; i++) {
        const angle = yaw - Math.PI / 2 + i * Math.PI / 12;
        shape.push([end[0] + sign * radius * Math.cos(angle), end[1] + sign * radius * Math.sin(angle)]);
      }
    }
    const ring = clean(shape);
    edging.prism(ring, 0.19, 0.34);
    soil.cap(inset(ring, 0.24) ?? ring, 0.35);
    const trees = Math.max(2, Math.round(length / 8));
    for (let i = 0; i < trees; i++) palms.push(at((i + 0.35) / trees));
  }
  for (const mesh of [
    soil.mesh(facade(MODE.stone, { color: '#447d69', roof: '#3c806b', self: 0.13 }), 'Rio arrival gardens'),
    edging.mesh(facade(MODE.stone, { color: '#a2aeb8', roof: '#a2aeb8' }), 'Rio planter curbs'),
  ]) if (mesh) out.add(mesh);
  if (palms.length) {
    const trees = new THREE.InstancedMesh(palmGeometry(), litColor('#ffffff', { vertexColors: true }), palms.length);
    const tree = new THREE.Object3D();
    palms.forEach(([x, z], i) => {
      tree.position.set(x, 0.35, z);
      tree.rotation.y = i * 2.4;
      tree.scale.setScalar(0.84 + (i % 4) * 0.075);
      tree.updateMatrix();
      trees.setMatrixAt(i, tree.matrix);
    });
    trees.name = 'Rio arrival palms';
    trees.computeBoundingSphere();
    out.add(trees);
  }
}

export function buildRio(data, graph) {
  const out = new THREE.Group();
  out.name = 'Rio Hotel & Casino';
  const named = pattern => data.buildings.find(b => pattern.test(b.name ?? ''));
  const ipanema = named(/^Rio Ipanema Tower$/i);
  const masquerade = named(/^Rio Masquerade Tower$/i);
  const podium = named(/^Rio All Suite Hotel and Casino$/i);
  if (!ipanema || !masquerade || !podium) return out;

  const [mx, mz] = centroid(masquerade.pts);
  const crowns = data.buildings.filter(b => b !== masquerade && b.h >= 110 &&
    Math.hypot(centroid(b.pts)[0] - mx, centroid(b.pts)[1] - mz) < 21)
    .sort((a, b) => a.h - b.h);
  for (const part of [ipanema, masquerade, ...crowns]) heroOwned.add(part);

  const parts = { glass: new Soup(), core: new Soup(), trim: new Soup(), light: new Soup(), canopy: new Soup(), pools: new Soup() };
  const red = wordmarkTexture(['#f94958', '#ed4756', '#ff525e', '#ff4057'], '#601f37');
  const carnival = wordmarkTexture(['#ff5985', '#ffd76e', '#72e6ef', '#f67be1'], '#401d51');
  const cream = wordmarkTexture(['#fff0d2', '#fff0d2', '#fff0d2', '#ffe6b2'], '#3e2840');
  addIpanema(out, ipanema, parts, red, podium.h);
  addMasquerade(out, masquerade, crowns, parts, carnival, podium.h);
  parts.trim.walls(offset(clean(podium.pts), 0.16), podium.h - 0.5, podium.h + 0.78);

  const canopy = data.buildings.find(b => b.b === 'roof' && Math.hypot(
    centroid(b.pts)[0] + 1218, centroid(b.pts)[1] + 17,
  ) < 12);
  if (canopy) addCanopy(parts, canopy);
  for (const area of data.areas) {
    if (area.k !== 'water') continue;
    const [x, z] = centroid(area.pts);
    if (x > -1145 && x < -1000 && z > -210 && z < -106) {
      parts.pools.cap(clean(area.pts), 0.31);
    }
  }

  for (const [soup, material, name] of [
    [parts.glass, facade(MODE.rio, { color: '#3562a4', glow: '#688cc2', roof: '#556d95', bay: 3.65 }), 'Rio curtain walls'],
    [parts.core, facade(MODE.stone, { color: '#526688', roof: '#7389aa', flood: '#c1d7ff', floodK: 0.48, self: 0.19 }), 'Rio plinth and elevator crown'],
    [parts.trim, facade(MODE.stone, { color: '#a0afc2', roof: '#8194af', flood: '#c8d8ff', floodK: 0.28, self: 0.17 }), 'Rio coping and canopy frames'],
    [parts.light, sheen('#f5e6d7', { glow: '#ffe5c7', glowK: 1.22 }), 'Masquerade plinth lighting'],
    [parts.canopy, sheen('#7ea8c8', { refl: 0.7, spec: 1.4, glow: '#9bc9fd', glowK: 0.45 }), 'Rio barrel-vault valet canopy'],
    [parts.pools, sheen('#3b9bc6', { refl: 0.62, spec: 0.8, glow: '#337ccb', glowK: 0.31 }), 'Rio pool courtyard'],
  ]) {
    const mesh = soup.mesh(material, name);
    if (mesh) out.add(mesh);
  }
  addMarquee(out, graph, cream);
  addArrivalGardens(out, graph);
  out.add(spill(mx, 0.43, mz + 13, 64, '#a192f3', 0.24));
  out.add(spill(-1218, 0.43, -9, 34, '#e0eaff', 0.34));
  return out;
}
