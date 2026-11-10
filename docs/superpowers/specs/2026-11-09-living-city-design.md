# Living city and road users

Continue on `Codex`. Reuse the reference project's complete road/lane, signal, vehicle, driver, ride-booking and scenario components. The user explicitly requested the full component, richer daytime life, freeway approaches/bridges, and safe separation between rail infrastructure and roads.

The Google raster map stays the base. Source-generated pavement/markings, elevated highway decks, pedestrian bridges, valet entrances, palms, street furniture, signals, lights and optional labels supplement it. Rendered roads and all cars use the same decoded source lane graph and elevation solver. Keep original geographic origin, footprints and the Mercator projection adapter.

Port the actual Zoox, Waymo and Tesla models and the original Fleet/Driver/ride card, including profiles, pickup/dropoff bookings, self-driving/manual modes, traffic, camera views, staged tests and telemetry. Replace the old three marker demonstration in the normal flow. Adapt the source controls to the existing MapLibre camera, including road-deck elevation in the follow view. Time must advance independently of camera movement/culling; no duplicate clocks or conflicting keyboard shortcuts.

Replace the source's fixed-height rail meshes with an adaptation of those same footprints and styles that checks every road crossing and suppresses supports inside drivable footprints. Import the original freeway and pedestrian bridges. Preserve ramps and shared node elevations; vehicles follow deck height rather than floating below or above it.

Daytime polish comes from the source's trees, sidewalks, facade textures, active road traffic and clearer daylight. Night gets source signal/lamp light pools. The compact source driving card and Lab remain usable on mobile. Keep map/layer navigation and attribution intact.

Verification: physics/route tests with actual snapshot data, bridge/elevation continuity and rail clearance tests; real browser testing of vehicle switches, bookings, manual controls, pause, scenarios, traffic density, 2D/3D, satellite and day/night. Inspect representative MGM pedestrian, I-15 freeway and ARIA tram crossings. Keep the reference checkout unchanged.
