# Vegas v2 city component

Imported from [abrhamhabtu/vegas-strip-v2](https://github.com/abrhamhabtu/vegas-strip-v2), commit `15bedab7a31435f942bbe6ce1c2de944bdcf71c6`. The source checkout was read without modification.

Original model builders, facades, palette, full map decoder/elevation solver, lane graph, intersections, bridges, streetscape, vegetation, valets, vehicle models, Fleet/Driver, booking and scenario UI are retained as browser JavaScript modules. The complete snapshot keeps original decimetre polygon vertices, source heights and topology at origin latitude 36.11624, longitude -115.17455. Map data © OpenStreetMap contributors (ODbL).

Local adapters: shared window.THREE (r160), explicit module extensions, UV-preserving baking, MapLibre camera/projection integration, managed Fleet timers, shortcut isolation and Mercator-correct DOM labels. Fixed-height source rail meshes are replaced by road-clearance-aware guideways using the same rail footprints/styles. Google's raster remains the map base. Official Three.js helper source includes its MIT license.

The South Strip road pass uses the checked-in OpenStreetMap lane, median, and crossing data. Google satellite imagery was the primary visual check, with Apple Maps as a second view of the junctions. Clipper 6.4.2 is vendored as an ES module for the pavement union and curb cuts. Its source and license notices are in `vendor/clipper/`.

Regenerate using `node scripts/import-landmarks.mjs /path/to/vegas-strip-v2`. The manually maintained `vendor/landmarks/bake.js` is intentionally separate.
