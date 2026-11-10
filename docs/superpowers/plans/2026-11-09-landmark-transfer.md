# Landmark transfer implementation plan

> Execute natively in this session, with focused review after integration.

**Goal:** Bring the stronger Vegas v2 geometry and map controls into the current Google map.

**Architecture:** A static ES module custom layer imports the original model builders and shared palette. A small adapter supplies animation timing and Mercator projection while existing route and simulation functions stay in `app.js`.

**Tech stack:** MapLibre GL 4.7.1, shared Three.js 0.160.0, vanilla JavaScript, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-09-landmark-transfer-design.md`

## Constraints and review focus

- Keep the Google raster sources and existing vehicle/lane projection.
- Source origin: latitude 36.11624, longitude -115.17455. Source coordinates are metres, east/up/south.
- Correct geographic projection in both static and animated shaders.
- Suppress underlying generic masses only where detailed source models replace them.
- Check 2D, collapsed/mobile controls, reduced motion, slow or failed model loading, and hidden tabs.

## Tasks

- [x] Test geographic round trips, Mercator displacement, shader projection across instanced and ordinary model paths, and AV lane geometry.
- [x] Import original model builders, palettes, material/geometry helpers, and a compact snapshot of the footprint data with source commit provenance. Preserve the source checkout.
- [x] Adapt shared context rendering, shader projection, model loading, visibility, animation culling and cleanup in `three-strip.js` and `landmarks/`.
- [x] Implement compact controls, landmark presets, themes, zoom/compass/tilt, keyboard shortcuts, and the collapsing simulation dock in `index.html`, `styles.css`, `map-controls.js`, and a small `app.js` integration.
- [x] Run Node tests and syntax checks. Verify all major landmarks, themes and map/simulation controls in the running preview. Review the diff and document limitations.

## Verification

`npm test`: six tests pass. JavaScript syntax checks and `git diff --check` pass. Live browser checks cover daytime, sunset and night; Paris/Eiffel and the lake fountains; Luxor; Allegiant and T-Mobile; Athletics construction; Sphere LED shows; Resorts World; satellite, traffic and building visibility; 2D lane view; mobile at 390×844; landmark filtering; modal keyboard focus; AV start, lane selection, advancing telemetry and pause. Independent code review findings concerning raster readiness, gesture mode state, live summary updates and modal shortcuts were fixed.

The model dataset is a local snapshot, not a live feed. The AV system remains the existing OSRM/waypoint simulation foundation. The unchanged Three.js r160 CDN build emits its existing deprecation notice; no new shader errors remain after the fog adapter fix.
