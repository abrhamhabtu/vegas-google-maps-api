# Vegas v2 models

Imported from [abrhamhabtu/vegas-strip-v2](https://github.com/abrhamhabtu/vegas-strip-v2), commit `15bedab7a31435f942bbe6ce1c2de944bdcf71c6`. The source checkout was read without modification.

Model builders, shared palette, facade textures, geometry utilities and building ownership rules are retained as JavaScript modules. The map and routing engine are not imported. The footprint snapshot keeps original decimetre polygon vertices and source heights at origin latitude 36.11624, longitude -115.17455. Map data © OpenStreetMap contributors (ODbL).

Local adaptations: shared window.THREE (r160), explicit browser module extensions, prism-only roads helper, UV-preserving static baking, and a MapLibre animation/projection adapter. Shader projection is corrected from source local metres to Mercator without modifying footprint geometry or animation frames.

Regenerate the vendor modules and data using `node scripts/import-landmarks.mjs /path/to/vegas-strip-v2`. The manually maintained `vendor/landmarks/bake.js` adapter is intentionally separate from the importer.
