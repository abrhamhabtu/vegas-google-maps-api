// One-time/repeatable import; no dependency installation or application build required.
// Run with Node >=22.13: node scripts/import-landmarks.mjs /path/to/vegas-strip-v2
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const source = resolve(process.argv[2] || '../vegas-strip-v2');
const destination = new URL('../landmarks/vendor/', import.meta.url);
const files = [
  'core/data', 'core/theme', 'core/shadows', 'map/geom', 'map/materials', 'map/facades',
  'map/surfaces', 'map/buildings', 'places', 'landmarks/landmarks',
  'landmarks/resorts', 'landmarks/arenas', 'landmarks/guitar',
  'landmarks/construction', 'landmarks/sheen', 'landmarks/details',
  'landmarks/welcome',
  'map/lanegraph', 'map/movements', 'map/intersections', 'map/roads', 'map/signalplan',
  'map/valetstops', 'map/valets', 'map/trees', 'map/citylights', 'map/streetscape',
  'map/skybridges', 'map/names', 'landmarks/signs',
  'cars/models', 'cars/vehicles', 'sim/driver', 'sim/places', 'sim/fleet', 'ui/ride', 'ui/labels',
];

for (const file of files) {
  let original = await readFile(join(source, 'src', file + '.ts'), 'utf8');
  if (file === 'landmarks/welcome') {
    // Import the sign at its OSM node; Google's map already supplies its median lot.
    original = original.slice(0, original.indexOf('/** Find the two Las Vegas Blvd'))
      .replace(/import .* from '..\/map\/(?:lanegraph|trees)';\n/g, '')
      .replace('grp.add(medianLot(g, sx, sz));', '');
  }
  if (file === 'sim/fleet') {
    original = "import { sameRoadLevel } from '../../../world/road-surface.mjs';\n" + original;
    // A car retains its deck when entering manual mode. Nearby traffic on a
    // different road level must not trigger braking, lane blocking or contact.
    original = original.replace(/(car\.phase = 'manual';)\s*car\.y = 0;/g, '$1')
      .replaceAll('if (o === car || !o.vehicle.root.visible) continue;',
        'if (o === car || !o.vehicle.root.visible || !sameRoadLevel(car, o)) continue;');
    original = original.replace("if (!this.controls.driving || (e.target as HTMLElement)?.tagName === 'SELECT') return;",
      "if (!this.controls.driving || this.paused || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable || document.querySelector('[aria-modal=\"true\"]:not(.hidden)')?.closest('.modal-backdrop:not(.hidden)')) return;");
    // Source owns its delayed seeds; the integration needs to cancel them on removal.
    original = original.replaceAll('setTimeout(', 'this.engine.schedule(');
    original = original.replace(/(?<!\.)\baddEventListener\(/g, 'this.engine.listen(window, ')
      .replaceAll('canvas.addEventListener(', 'this.engine.listen(canvas, ');
  }
  if (file === 'ui/ride') {
    original = original
      .replace("if (t?.tagName === 'SELECT' || t?.tagName === 'INPUT') return;", "if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /^(SELECT|INPUT|TEXTAREA)$/.test(t?.tagName) || t?.isContentEditable || document.querySelector('.modal-backdrop:not(.hidden) [aria-modal=\"true\"]')) return;")
      .replace("if (k === 'h') ui.classList.toggle('dr-hidden');", '')
      .replace("if (k === 'l') toggleLab();", "if (k === 'b') toggleLab();")
      .replace(/\baddEventListener\(/g, 'fleet.listen(')
      .replace('setInterval(refresh, 200);', 'fleet.uiInterval = setInterval(refresh, 200);');
  }
  if (file === 'ui/labels') {
    original = original.replace("import * as THREE from 'three';", "import * as THREE from 'three';\nimport { mercatorSouth } from '../../georeference.mjs';")
      .replace('this.v.set(it.x, it.y, it.z).project(cam);', 'this.v.set(it.x, it.y, mercatorSouth(it.z)).project(cam);');
  }
  let js = stripTypeScriptTypes(original, { mode: 'transform' });
  js = js.replace(/import \* as THREE from ['"]three['"];?/g, 'const THREE = window.THREE;')
    .replace(/from (['"])(\.[^'"]+)\1/g, (_, quote, path) => `from ${quote}${/\.(?:m?js)$/.test(path) ? path : path + '.js'}${quote}`)
    .replace(/from ['"]three\/examples\/jsm\/utils\/BufferGeometryUtils.js['"]/g, "from '../three/BufferGeometryUtils.js'")
    .replace(/from ['"]three\/examples\/jsm\/geometries\/RoundedBoxGeometry.js['"]/g, "from '../three/RoundedBoxGeometry.js'");
  const target = new URL(file + '.js', destination);
  await mkdir(dirname(target.pathname), { recursive: true });
  await writeFile(target, '// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.\n' + js);
}

// Official geometry helpers already used by the source's procedural vehicle models.
await mkdir(new URL('three/', destination), { recursive: true });
for (const [name, path] of [['BufferGeometryUtils', 'utils'], ['RoundedBoxGeometry', 'geometries']]) {
  const helper = await readFile(join(source, `node_modules/three/examples/jsm/${path}/${name}.js`), 'utf8');
  await writeFile(new URL(`three/${name}.js`, destination), helper.replace(/import\s*\{([\s\S]*?)\}\s*from ['"]three['"];?/,
    (_, names) => `const {${names}} = window.THREE;`));
}
await writeFile(new URL('three/LICENSE', destination), await readFile(join(source, 'node_modules/three/LICENSE'), 'utf8'));

const data = JSON.parse(await readFile(join(source, 'public/data/vegas.json'), 'utf8'));
// The complete component requires its actual road topology, grade-separated node
// elevations, signals, sidewalks, valets and trees, not only the building snapshot.
await writeFile(new URL('../footprints.json', destination), JSON.stringify(data));
// Keep the original end-to-end Driver checks runnable against the imported data.
let drivingCheck = stripTypeScriptTypes(await readFile(join(source, 'scripts/drive-test.ts'), 'utf8'), { mode: 'transform' });
drivingCheck = drivingCheck.replaceAll('../src/', '../landmarks/vendor/')
  .replace('public/data/vegas.json', 'landmarks/footprints.json')
  .replace(/from (['"])(\.[^'"]+)\1/g, (_, quote, path) => `from ${quote}${path}.js${quote}`);
await writeFile(new URL('../../scripts/source-drive.mjs', destination), '// Adapted original vegas-strip-v2 driving checks.\n' + drivingCheck);
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await writeFile(new URL('../PROVENANCE.md', destination), `# Vegas v2 city component\n\nImported from [abrhamhabtu/vegas-strip-v2](https://github.com/abrhamhabtu/vegas-strip-v2), commit \`${commit}\`. The source checkout was read without modification.\n\nOriginal model builders, facades, palette, full map decoder/elevation solver, lane graph, intersections, bridges, streetscape, vegetation, valets, vehicle models, Fleet/Driver, booking and scenario UI are retained as browser JavaScript modules. The complete snapshot keeps original decimetre polygon vertices, source heights and topology at origin latitude ${data.origin.lat}, longitude ${data.origin.lon}. Map data © OpenStreetMap contributors (ODbL).\n\nLocal adapters: shared window.THREE (r160), explicit module extensions, UV-preserving baking, MapLibre camera/projection integration, managed Fleet timers, shortcut isolation and Mercator-correct DOM labels. Fixed-height source rail meshes are replaced by road-clearance-aware guideways using the same rail footprints/styles. Google's raster remains the map base. Official Three.js helper source includes its MIT license.\n\nRegenerate using \`node scripts/import-landmarks.mjs /path/to/vegas-strip-v2\`. The manually maintained \`vendor/landmarks/bake.js\` is intentionally separate.\n`);
console.log(`Imported ${files.length} modules, ${data.buildings.length} building footprints, source ${commit.slice(0, 8)}`);
