// One-time/repeatable import; no dependency installation or application build required.
// Run with Node >=22.13: node scripts/import-landmarks.mjs /path/to/vegas-strip-v2
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const source = resolve(process.argv[2] || '../vegas-strip-v2');
const destination = new URL('../landmarks/vendor/', import.meta.url);
const files = [
  'core/theme', 'core/shadows', 'map/geom', 'map/materials', 'map/facades',
  'map/surfaces', 'map/buildings', 'places', 'landmarks/landmarks',
  'landmarks/resorts', 'landmarks/arenas', 'landmarks/guitar',
  'landmarks/construction', 'landmarks/sheen', 'landmarks/details',
  'landmarks/welcome',
];

for (const file of files) {
  let original = await readFile(join(source, 'src', file + '.ts'), 'utf8');
  if (file === 'landmarks/welcome') {
    // Import the sign at its OSM node; Google's map already supplies its median lot.
    original = original.slice(0, original.indexOf('/** Find the two Las Vegas Blvd'))
      .replace(/import .* from '..\/map\/(?:lanegraph|trees)';\n/g, '')
      .replace('grp.add(medianLot(g, sx, sz));', '');
  }
  let js = stripTypeScriptTypes(original, { mode: 'transform' });
  js = js.replace(/import \* as THREE from ['"]three['"];?/g, 'const THREE = window.THREE;')
    .replace(/from (['"])(\.[^'"]+)\1/g, (_, quote, path) => `from ${quote}${path}.js${quote}`);
  const target = new URL(file + '.js', destination);
  await mkdir(dirname(target.pathname), { recursive: true });
  await writeFile(target, '// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.\n' + js);
}

// Only the prism helper is needed. Do not import the source's roads or routing engine.
const roads = await readFile(join(source, 'src/map/roads.ts'), 'utf8');
const box = roads.slice(roads.indexOf('export function box('), roads.indexOf('\ntype Frame ='));
await writeFile(new URL('map/roads.js', destination), stripTypeScriptTypes(box, { mode: 'transform' }));
await writeFile(new URL('core/data.js', destination), `
export function latLonToXZ(origin, lat, lon) {
  const d = Math.PI / 180, R = 6378137;
  return [(lon - origin.lon) * d * R * Math.cos(origin.lat * d), -(lat - origin.lat) * d * R];
}
`);

const data = JSON.parse(await readFile(join(source, 'public/data/vegas.json'), 'utf8'));
// Retain all original building rings, heights and names. No hand-repositioned models.
const subset = {
  origin: data.origin, attribution: data.attribution,
  buildings: data.buildings,
  pois: data.pois,
  areas: data.areas.filter(a => a.k === 'water'),
  roads: data.roads.filter(r => /las vegas boulevard|fremont street/i.test(r.name || '')),
  walks: data.walks.filter(r => /fremont street/i.test(r.name || '')),
  rail: data.rail,
};
await writeFile(new URL('../footprints.json', destination), JSON.stringify(subset));
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await writeFile(new URL('../PROVENANCE.md', destination), `# Vegas v2 models\n\nImported from [abrhamhabtu/vegas-strip-v2](https://github.com/abrhamhabtu/vegas-strip-v2), commit \`${commit}\`. The source checkout was read without modification.\n\nModel builders, shared palette, facade textures, geometry utilities and building ownership rules are retained as JavaScript modules. The map and routing engine are not imported. The footprint snapshot keeps original decimetre polygon vertices and source heights at origin latitude ${data.origin.lat}, longitude ${data.origin.lon}. Map data © OpenStreetMap contributors (ODbL).\n\nLocal adaptations: shared window.THREE (r160), explicit browser module extensions, prism-only roads helper, UV-preserving static baking, and a MapLibre animation/projection adapter. Shader projection is corrected from source local metres to Mercator without modifying footprint geometry or animation frames.\n\nRegenerate the vendor modules and data using \`node scripts/import-landmarks.mjs /path/to/vegas-strip-v2\`. The manually maintained \`vendor/landmarks/bake.js\` adapter is intentionally separate from the importer.\n`);
console.log(`Imported ${files.length} modules, ${data.buildings.length} building footprints, source ${commit.slice(0, 8)}`);
