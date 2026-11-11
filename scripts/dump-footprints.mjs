#!/usr/bin/env node
/**
 * Lists the building footprints around a place, in the city's local metres
 * (x = east, z = south, origin in landmarks/georeference.mjs). Step 2 of
 * docs/landmark-rebuild-playbook.md: know the data before modelling on it.
 *
 *   node scripts/dump-footprints.mjs "bellagio"            # around the largest footprint whose name matches
 *   node scripts/dump-footprints.mjs 36.1126 -115.1767     # around a lat/lng
 *   node scripts/dump-footprints.mjs "caesars" --radius 350 --rings --min-height 30
 *
 * Columns: name | part (1 = building:part, the detailed massing) | h top height | mh base height
 *          A area m² | c centroid | bb xmin,xmax,zmin,zmax | n vertices | b OSM type | col OSM colour
 * --rings also prints each outline as "x,z x,z …" so you can design against real coordinates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { decode } = await import(path.join(root, 'landmarks/vendor/core/data.js'));
const { toLocal } = await import(path.join(root, 'landmarks/georeference.mjs'));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = args[i + 1];
  args.splice(i, 2);
  return Number(value);
};
const rings = args.includes('--rings');
if (rings) args.splice(args.indexOf('--rings'), 1);
const radius = flag('radius', 260), minHeight = flag('min-height', 0), minArea = flag('min-area', 0);
if (!args.length) {
  console.error('usage: node scripts/dump-footprints.mjs <name regex | lat lng> [--radius m] [--min-height m] [--min-area m2] [--rings]');
  process.exit(1);
}

const data = decode(JSON.parse(fs.readFileSync(path.join(root, 'landmarks/footprints.json'), 'utf8')));
const area = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
const centroid = r => { let x = 0, z = 0; for (const p of r) { x += p[0]; z += p[1]; } return [x / r.length, z / r.length]; };
const box = r => { const xs = r.map(p => p[0]), zs = r.map(p => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)].map(v => v.toFixed(0)).join(','); };

let centre;
if (args.length >= 2 && !Number.isNaN(Number(args[0])) && !Number.isNaN(Number(args[1]))) {
  centre = toLocal(Number(args[0]), Number(args[1]));
} else {
  const re = new RegExp(args[0], 'i');
  const hit = data.buildings.filter(b => b.name && re.test(b.name)).sort((a, b) => area(b.pts) - area(a.pts))[0];
  if (!hit) { console.error(`No named footprint matches /${args[0]}/i`); process.exit(1); }
  centre = centroid(hit.pts);
  console.log(`anchor: "${hit.name}"`);
}
console.log(`centre x=${centre[0].toFixed(0)} z=${centre[1].toFixed(0)}  radius=${radius} m\n`);

const near = data.buildings
  .filter(b => { const c = centroid(b.pts); return Math.hypot(c[0] - centre[0], c[1] - centre[1]) < radius && b.h >= minHeight && area(b.pts) >= minArea; })
  .sort((a, b) => area(b.pts) - area(a.pts));
for (const b of near) {
  const c = centroid(b.pts);
  console.log(`${(b.name ?? '-').slice(0, 36).padEnd(36)} part=${b.part ? 1 : 0} h=${String(b.h).padEnd(6)} mh=${String(b.mh ?? 0).padEnd(4)} A=${area(b.pts).toFixed(0).padStart(6)} c=${c[0].toFixed(0)},${c[1].toFixed(0)} bb=${box(b.pts)} n=${b.pts.length} b=${b.b ?? ''} col=${b.col ?? ''}`);
  if (rings) console.log('    ' + b.pts.map(p => `${p[0].toFixed(0)},${p[1].toFixed(0)}`).join(' '));
}
console.log(`\n${near.length} footprints`);
const pois = data.pois.filter(p => p.n && Math.hypot(p.x - centre[0], p.z - centre[1]) < radius);
if (pois.length) console.log('\nPOIs: ' + pois.slice(0, 60).map(p => `${p.n} [${p.k}] ${p.x.toFixed(0)},${p.z.toFixed(0)}`).join(' | '));
