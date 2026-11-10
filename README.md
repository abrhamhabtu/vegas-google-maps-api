# Vegas Strip — Google map & AV simulation

A Google street/satellite map of Las Vegas with detailed Three.js landmarks and a lane-offset robotaxi simulation. Runs as a static site; no build or dependency installation is required.

```sh
npm start
# http://localhost:8080
```

## Explore

- **Places** opens the searchable landmark menu: Bellagio fountains, Paris/Eiffel Tower, Sphere, Luxor, Allegiant Stadium, T-Mobile Arena, Athletics ballpark construction, Hard Rock guitar construction, High Roller, Resorts World, Wynn/Encore, and more.
- **Day / Sunset / Night** smoothly changes building lighting, windows, LEDs, fountain lighting and the map's brightness.
- **Layers** controls 3D buildings, Google satellite imagery and traffic.
- **Street lanes** returns to the original MGM Road / Bruno Mars Drive intersection in unobstructed 2D.
- Expand **Robotaxi** for the existing AV routes, lane selection, follow camera, simulation speed and telemetry. Routing uses OSRM with the existing waypoint fallback.

Drag to pan, scroll/pinch to zoom, Shift/right-drag to orbit. Use the camera dock to zoom, turn, tilt or reset north. Keyboard: **T** cycles lighting, **D** toggles 2D/3D, **N** resets north, **P** opens places, **L** opens layers, **H** hides controls, **Escape** closes panels. Motion is reduced when the OS requests reduced motion.

Links can include a view and theme, for example `/#theme=night&view=sphere` or `/#theme=golden&view=bellagio`.

## Landmark geometry

The detailed models and 23,764 building footprints were imported from `abrhamhabtu/vegas-strip-v2`. See [provenance](landmarks/PROVENANCE.md) for the source commit and adaptations. The source checkout is unchanged.

Original building polygons, heights and geographic origin are retained. The custom layer projects source east/up/south metres into MapLibre's Mercator frame, including animated instances. The source renderer's building ownership rules suppress the plain building masses beneath detailed models. Google raster streets, satellite, traffic, AV routes and lane-offset geometry retain their existing coordinates.

No source roads or routing engine are rendered over Google's road map. The imported map snapshot contains the building, attraction, water and frontage data required by the model builders.

```sh
npm test
# Optional refresh from an existing source checkout (Node >=22.13):
npm run import-landmarks -- /path/to/vegas-strip-v2
```

## Local configuration

Copy `config.example.js` to `config.local.js` for the existing optional Google API key configuration, or use **Layers → Google map settings**. Local config and `.env` files remain ignored by Git. The current ground map uses the existing Google raster tile sources; the 3D landmarks are custom models rather than Google photorealistic 3D tiles.

Map imagery © Google. Building footprint data © OpenStreetMap contributors (ODbL).
