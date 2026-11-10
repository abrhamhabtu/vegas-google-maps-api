// Source rail styles from vegas-strip-v2, with heights and supports from the traffic clearance plan.
const THREE = window.THREE;
import { Soup, normals } from '../landmarks/vendor/map/geom.js';
import { box } from '../landmarks/vendor/map/roads.js';
import { litColor, litMaterial } from '../landmarks/vendor/map/materials.js';
import { planRailways, RAIL_STYLES } from './rail-network.mjs';

function quad(soup, points) {
  const a = points[0], b = points[1], c = points[2];
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1, normal = [nx / length, ny / length, nz / length];
  const ids = points.map(p => soup.vert(...p, normal));
  soup.quad(...ids);
}

function beam(soup, leftA, rightA, leftB, rightB, heightA, heightB, depth, wallTop = 0) {
  const p = (xz, height) => [xz[0], height, xz[1]];
  quad(soup, [p(leftA, heightA), p(rightA, heightA), p(rightB, heightB), p(leftB, heightB)]);
  quad(soup, [p(leftA, heightA - depth), p(leftB, heightB - depth), p(rightB, heightB - depth), p(rightA, heightA - depth)]);
  quad(soup, [p(leftA, heightA - depth), p(leftA, heightA + wallTop), p(leftB, heightB + wallTop), p(leftB, heightB - depth)]);
  quad(soup, [p(rightA, heightA + wallTop), p(rightA, heightA - depth), p(rightB, heightB - depth), p(rightB, heightB + wallTop)]);
}

function monorail(soup, line) {
  const normal = normals(line.points);
  for (let i = 0; i + 1 < line.points.length; i++) {
    const a = line.points[i], b = line.points[i + 1], na = normal[i], nb = normal[i + 1];
    for (const side of [-1, 1]) {
      const a0 = [a[0] + na[0] * side * 2.4, a[1] + na[1] * side * 2.4];
      const b0 = [b[0] + nb[0] * side * 2.4, b[1] + nb[1] * side * 2.4];
      const length = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1;
      const sx = -(b0[1] - a0[1]) / length * 0.35, sz = (b0[0] - a0[0]) / length * 0.35;
      beam(soup, [a0[0] - sx, a0[1] - sz], [a0[0] + sx, a0[1] + sz],
        [b0[0] - sx, b0[1] - sz], [b0[0] + sx, b0[1] + sz], line.heights[i], line.heights[i + 1], 1.6);
    }
  }
  for (const pier of line.piers) {
    const height = pier.height + RAIL_STYLES.monorail.pierTop;
    box(soup, pier.x, pier.z, 1.4, 1.4, 0, pier.height, pier.yaw);
    // The long dimension lies across both running beams, as a T-column capital.
    box(soup, pier.x, pier.z, 6.2, 1.2, height - 2.4, height - 1.6, pier.yaw);
  }
}

function resortTram(soup, line) {
  const normal = normals(line.points), width = 1.5;
  for (let i = 0; i + 1 < line.points.length; i++) {
    const a = line.points[i], b = line.points[i + 1], na = normal[i], nb = normal[i + 1];
    beam(soup, [a[0] - na[0] * width, a[1] - na[1] * width], [a[0] + na[0] * width, a[1] + na[1] * width],
      [b[0] - nb[0] * width, b[1] - nb[1] * width], [b[0] + nb[0] * width, b[1] + nb[1] * width],
      line.heights[i], line.heights[i + 1], 1.4, 0.5);
  }
  for (const pier of line.piers) box(soup, pier.x, pier.z, 1.2, 1.2, 0, pier.height, pier.yaw);
}

export function buildRailways(data, graph, engine) {
  const group = new THREE.Group();
  group.name = 'Rail guideways';
  const plan = planRailways(data, graph), mono = new Soup(), tram = new Soup();
  for (const line of plan.lines) {
    if (line.kind === 'monorail') monorail(mono, line);
    else resortTram(tram, line);
  }
  for (const [soup, material, name] of [[mono, () => litMaterial('pillar'), 'Monorail'], [tram, () => litColor('#8e96a6'), 'Resort trams']]) {
    if (!soup.idx.length) continue;
    const mesh = new THREE.Mesh(soup.geometry(), material());
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.railways = plan;
  // Retain the same builder contract as animated source landmarks.
  void engine;
  return group;
}
