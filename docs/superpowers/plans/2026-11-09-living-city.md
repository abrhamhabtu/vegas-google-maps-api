# Living city implementation plan

**Goal:** Port the reference project's active city and complete vehicle test component onto the Google map.

**Architecture:** Extend the repeatable source importer and full city snapshot; build the source road graph once. The custom layer supplies an engine facade and MapLibre camera adapter to the original Fleet. Rail clearance and source card integration are independent modules.

**Spec:** `docs/superpowers/specs/2026-11-09-living-city-design.md`

- [ ] Import full source data decoder, elevation solver, road graph, intersections, road and bridge rendering, vegetation, streetscape, valets, vehicles, Fleet/Driver, ride card and label components.
- [ ] Integrate one clock, shared geographic projection, source camera adapter, model preparation, and independent vehicle rendering. Replace legacy marker flow in the normal UI.
- [ ] Add road-safe rail guideways with continuous crossing clearance and supports outside drivable footprints; test planner with pure Node fixtures.
- [ ] Bring over the full source driving card/Lab with responsive layout, keyboard isolation, pause/resume and reset.
- [ ] Improve daytime lighting and add source scene detail/labels with layer controls. Add bridge and street-level presets.
- [ ] Run route, bridge and regression checks, review integration, verify live desktop/mobile views and driving, and save commits on Codex.
