# Vegas Strip — Google map & AV simulation

A Google street/satellite map of Las Vegas with the detailed landmarks, streets and complete vehicle component from `vegas-strip-v2`. Runs as a static site; no build or dependency installation is required.

```sh
npm start
# http://localhost:8080
```

## Explore

- **Places** opens the searchable landmark menu: Bellagio fountains, Paris/Eiffel Tower, Sphere, Luxor, Allegiant Stadium, T-Mobile Arena, Athletics ballpark construction, Hard Rock guitar construction, High Roller, Resorts World, Wynn/Encore, and more.
- **Day / Sunset / Night** smoothly changes building lighting, windows, LEDs, fountain lighting and the map's brightness.
- **Layers** controls buildings, detailed streets/bridges, landmark badges, Google satellite imagery and traffic.
- **Street lanes** returns to the original MGM Road / Bruno Mars Drive intersection in unobstructed 2D.
- The driving card includes the source **Zoox / Waymo / Tesla** models, four driving profiles, pickup/dropoff bookings, follow camera, manual driving and telemetry. **Pause / Resume / Reset** controls the fleet.
- **Lab** opens the original eight driving scenarios and traffic density control. Autonomous driving uses the source lane graph, signals, stop lines, valets and road-deck elevations.
- **Places → Streets & bridges** includes the Tropicana flyover over Joey Bishop Drive and the Airport Connector at Terminal 3, along with the Flamingo freeway bridge and ARIA tram.

Drag to pan, scroll/pinch to zoom, Shift/right-drag to orbit. Use the camera dock to zoom, turn, tilt or reset north. Keyboard: **T** cycles lighting, **D** toggles 2D/3D, **N** resets north, **P** opens places, **L** opens layers, **B** opens the vehicle Lab, **C** cycles the car camera, **H** hides controls, **Escape** closes panels. In manual driving, use **W/A/S/D** or arrows and **Space** to brake. Map shortcuts yield to manual driving and text fields. Reduced motion stops decorative animation while the vehicle test clock keeps running.

Links can include a view and theme, for example `/#theme=night&view=sphere` or `/#theme=golden&view=bellagio`.

## Shared city geometry

The detailed models and 23,764 building footprints were imported from `abrhamhabtu/vegas-strip-v2`. See [provenance](landmarks/PROVENANCE.md) for the source commit and adaptations. The source checkout is unchanged.

Original building polygons, heights and geographic origin are retained. The custom layer projects source east/up/south metres into MapLibre's Mercator frame, including animated instances. The source renderer's building ownership rules suppress the plain building masses beneath detailed models. Google raster streets, satellite and traffic retain their existing coordinates.

The Google raster basemap supplies imagery. The OpenStreetMap-based snapshot supplies road geometry, lane tags, and bridge levels for the 3D scene and simulator. The renderer estimates lane boundaries and deck elevations from those tags. Google's [road-level map details](https://developers.google.com/maps/comms/msa-road-level-details) are available for display, and the [Navigation SDK](https://developers.google.com/maps/documentation/navigation/android-sdk/tbt-feed#lane_guidance) exposes turn directions and recommendations per lane.

The road elevation solver and lane graph provide both the rendered decks and vehicle paths. Bridge supports are placed around lower carriageways, including raised ramps beneath a flyover. Manual vehicles interpolate grade on their current level and can follow connected ramps.

Rail footprints remain geographically fixed. The guideway planner raises connected spans to preserve at least 5.6 metres of clearance above intersecting road surfaces, and places supports outside drivable road envelopes. Road/rail planning is geometric; the simulation is a local testing environment, with the source's simplified vehicle physics.

```sh
npm test
npm run test:drive
# Optional refresh from an existing source checkout (Node >=22.13):
npm run import-landmarks -- /path/to/vegas-strip-v2
```

The driving check runs the source's 66 rides across all three vehicle types and four profiles, checking signals, stop lines and pavement containment. The Node regression suite covers projection, camera continuity, road levels and rail clearance.

## Local configuration

Copy `config.example.js` to `config.local.js` for the existing optional Google API key configuration, or use **Layers → Google map settings**. Local config and `.env` files remain ignored by Git. The current ground map uses the existing Google raster tile sources; the 3D landmarks are custom models rather than Google photorealistic 3D tiles.

Map imagery © Google. Building footprint data © OpenStreetMap contributors (ODbL).
