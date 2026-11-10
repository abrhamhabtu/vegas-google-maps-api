# Landmark transfer and map controls

Bring the detailed models from the local `vegas-strip-v2` checkout into this Google tile map on branch `Codex`. The user authorized the implementation, including visual polish, without a separate design approval step.

Keep the existing Google streets, satellite, traffic, lane coordinates, and AV routes. Import the source's buildings, hero resorts, Athletics ballpark construction, Allegiant Stadium, T-Mobile Arena, Luxor, Eiffel Tower, Paris balloon, High Roller, Sphere, guitar construction, and Bellagio fountains. Preserve the source's geographic footprint origin and dimensions. Correct the source's local equirectangular coordinates to Mercator at projection time, including animated instances. Use the same Three.js instance as the map.

The source's day, golden-hour, and night material uniforms drive the models. Apply coordinated raster adjustments without replacing Google's underlying tiles. Offer compact day/sunset/night buttons, a searchable places menu, a small layer menu, zoom/compass/tilt controls, and a collapsible AV dock. All functionality remains keyboard accessible and usable on narrow screens. Respect reduced motion. Keep map attribution visible.

Approaches considered: replace the whole app with the source engine; hand-copy approximate models; import its landmark and building renderers into a MapLibre custom layer. Use the third approach because it preserves this project's map and vehicle behavior while retaining the source geometry. No new application framework or runtime build step is needed.

Verify projection at distant landmarks, replacement ownership (no duplicate building masses), theme changes, major landmark views, satellite/traffic toggles, 2D lane visibility, AV start/pause/lane changes, keyboard navigation, mobile layout, and browser errors. Document provenance and keep local API keys out of changes.
