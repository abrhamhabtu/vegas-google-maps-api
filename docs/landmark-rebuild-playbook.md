# Landmark rebuild playbook

How to remake one Strip resort so it matches a reference screenshot (usually Apple Maps at night).
Written for an AI agent working in this repo. Follow the steps in order, one resort at a time.

The worked example is [`world/tropicana-trio.js`](../world/tropicana-trio.js): MGM Grand, Excalibur and
New York-New York, built with this exact process. Read it before you start. Copy its patterns.

---

## 0. What you are given, and what "done" means

**Input from the user:** the name of a resort and one or more reference screenshots.

**Done means all of these are true:**

1. The resort's towers are drawn by a hand-written builder in `world/`, not by the generic extruder.
2. Side by side with the reference at a similar camera angle, the massing, colours and night lighting read as the same building.
3. Day, Sunset and Night all look right. Night is the priority.
4. `npm test` passes and the browser console shows no new errors.
5. Nothing that was there before has disappeared (signs, fountains, valets, statues, neighbours).
6. You showed the user before/after screenshots and listed what still differs from the reference.

Do not commit or push unless the user asks.

---

## 1. How the city is put together (read once)

| Thing | Where | What it does |
|---|---|---|
| Footprint data | `landmarks/footprints.json`, decoded by `landmarks/vendor/core/data.js` | 23,764 OSM buildings: `{ name, pts, h, mh, part, b, col }` |
| Scene assembly | `world/city.js` → `buildCity()` | Calls every builder. Order matters (see step 5). |
| Generic buildings | `landmarks/vendor/map/buildings.js` | Extrudes every footprint with one shader. `RESORT_LOOKS` picks tint, style and glow by name. |
| Older hand models | `landmarks/vendor/landmarks/resorts.js`, `details.js`, `landmarks.js`, `arenas.js` | Earlier per-resort dressing layered on top of generic towers. |
| **Hero kit** | `world/hero-kit.js` | Shared tools for rebuilt resorts. **Use this.** |
| **Hero resorts** | `world/tropicana-trio.js` (and the files you add) | The rebuilt resorts. |
| Theme | `landmarks/vendor/core/theme.js` | Day / golden / night palettes. `theme.uniforms.uNight` runs 0 → 1. |
| Renderer | `three-strip.js` | Three.js r160 drawn into the MapLibre canvas. No post-processing, no bloom. |

**Coordinates.** Everything is local metres: `x` = east, `y` = up, `z` = **south**. Origin is lat 36.11624, lon -115.17455.
Convert with `toLocal(lat, lng)` from `landmarks/georeference.mjs`. The Strip runs roughly along `x ≈ 0`; larger `z` is further south.

**Footprint fields.**
- `pts`: outline as `[x, z]` pairs. Winding is not consistent; always pass it through `clean()`.
- `h`: top height in metres. `mh`: base height (for parts that float, like roofs).
- `part`: true for OSM `building:part` pieces. These are the detailed massing (towers, steps, turrets). The big non-part outline is usually the whole podium.
- `col`: OSM colour when mapped. Useful for finding pieces that belong together.

---

## 2. Study the data before modelling

Run the dump script. It is the single most useful step: every good decision in the worked example came from reading real outlines.

```bash
node scripts/dump-footprints.mjs "bellagio"
```

```bash
node scripts/dump-footprints.mjs "caesars" --radius 350 --min-height 30 --rings
```

```bash
node scripts/dump-footprints.mjs 36.1126 -115.1767 --radius 200
```

Write down, for the resort:

- Which rows are the **towers** (tall parts), which is the **podium** (largest, low), which are **decorations** (small circles = turrets or domes, stacked octagons = rotundas, stepped rows = terraces).
- Centroid and bounding box of each tower. You will filter on these.
- Orientation: are the outlines axis-aligned or rotated? (`--rings` shows it.)
- Stacked parts that share a centre: they are tiers of one object. Only the top tier gets a roof.
- Nearby POIs (statues, signs, fountains) that you can anchor props to.

Then find every place the resort is already drawn, so you do not draw it twice:

```bash
grep -rniE "bellagio" landmarks/vendor world --include=*.js | grep -v footprints | cut -c1-200
```

Typical hits: an entry in `RESORT_LOOKS` (buildings.js), a function in `resorts.js` or `details.js`, a pylon in `signs.js`, valet stops, labels. Read the function that draws it.

---

## 3. Capture the "before"

The preview server is `vegas-map` in `.claude/launch.json` (port 8080). Open it, switch to Night, and frame the resort like the reference.

Paste this in the page console (or run it through the browser tool) to drive the camera and hide the UI:

```js
window.shot = (lat, lng, zoom, bearing, pitch) => glMap.jumpTo({ center: [lng, lat], zoom, bearing, pitch });
window.hideUi = () => { for (const s of ['header.top-bar', '.camera-hud', '.view-caption', '.map-hint', '#labels', '#driving-ui', '#av-panel', '#show-controls', '.vegas-hover-tip', '.maplibregl-control-container']) document.querySelectorAll(s).forEach(e => e.style.display = 'none'); };
hideUi(); shot(36.1004, -115.1737, 16.2, 18, 62);
```

Switch theme with `document.querySelector('.theme-btn[data-theme=night]').click()` (`day`, `golden`, `night`).

Take one wide shot matching the reference and one close shot per tower. Keep the camera numbers; you will reuse them after every change.

**Traps that cost time in the worked example:**

- Navigating to the same URL with a different `#hash` does **not** reload. Use `location.reload()`.
- The city takes about 15 seconds to build. Wait until `document.documentElement.dataset.scene === 'ready'` before judging anything. Until then the night ground is not dimmed and looks white.
- A browser tab that is not in front does not render. Screenshots of a background tab time out. Bring the tab to the front.
- The `H` key toggles the controls and the state is remembered across reloads. Use `hideUi()` instead.
- The console already shows one shader error from `citylights.js` (`iPos` / `vegasProject`). It is old and unrelated. Any *other* shader error is yours.

---

## 4. Read the reference like a modeller

Look at the reference and write a short list before writing code. For each tower answer:

1. **Massing.** Plan shape (slab, cross, L, crescent, cylinder). Setbacks? Stepped ends? Does the top differ from the shaft?
2. **Facade rhythm.** Horizontal bands, vertical bays, punched window grid, or flat glass? This picks the shader mode.
3. **Night signature.** What is the one thing that glows? (MGM: every floor a green line. Excalibur: floodlit white turrets with coloured cones. NYNY: dark towers, lit crowns.)
4. **Colours.** Sample three: the lit colour, the unlit wall colour, the roof colour. Roofs in the reference are usually dark navy.
5. **Crown and props.** Parapets, spires, domes, signs, statues, rooftop plant.
6. **Light on the ground.** Does the resort tint the streets and podium roof around it?

Apple Maps night style in one line: buildings keep their hue but go dim and blue, a few things are strongly self-lit, roofs are dark, and windows are sparse.

---

## 5. Build it

### 5.1 Create the module

Add `world/<area>.js` (group neighbours in one file, like the Tropicana trio) exporting one function:

```js
import { heroOwned } from '../landmarks/vendor/map/buildings.js';
import { halo, sheen } from '../landmarks/vendor/landmarks/sheen.js';
import { bakeStatic } from '../landmarks/vendor/landmarks/bake.js';
import { MODE, Soup, WHITE, area, bounds, centroid, clean, facade, inset, keep, offset, sign, spill } from './hero-kit.js';

const THREE = window.THREE;

export function buildMyResort(data) {
  const out = new THREE.Group();
  out.name = 'My Resort';
  // 1. pick footprints  2. claim them  3. build soups  4. materials  5. props, signs, light
  return out;
}
```

Register it in `world/city.js` **before** `buildBuildings(...)`:

```js
buildings.add(buildMyResort(specialData));   // must precede buildBuildings: it claims footprints
buildings.add(buildBuildings(data, valetPlan).group);
```

### 5.2 Claim the footprints

Select the parts by position and height (values from step 2), then `heroOwned.add(b)` for each. The generic extruder skips anything in that set.

```js
const towers = data.buildings.filter(b => {
  if (!b.part || b.h < 50) return false;
  const c = centroid(b.pts);
  return c[0] > 225 && c[0] < 600 && c[1] > 1410 && c[1] < 1665;
});
towers.forEach(b => heroOwned.add(b));
```

Rules:

- **Claim only what you redraw.** Anything claimed and not drawn vanishes.
- **Leave the podium to the generic pipeline.** Its shader cuts openings for valet drives and roads (`uCut`). If you claim a podium, cars drive through a solid wall. Restyle podiums through `RESORT_LOOKS` instead (5.6).
- Filter tightly. A loose radius will swallow the neighbour's buildings. Print how many you matched and compare with the dump.

### 5.3 Draw the massing with `Soup`

`Soup` (in `hero-kit.js`) collects walls and roofs into one mesh per material.

| Call | Use |
|---|---|
| `clean(ring)` | Always first. Fixes winding, drops duplicate points. |
| `soup.walls(ring, y0, y1, color, aux)` | Vertical faces only. |
| `soup.cap(ring, y, color, aux)` | Flat roof. |
| `soup.prism(ring, y0, y1, color, aux)` | Walls + roof. |
| `soup.box(cx, y0, cz, w, h, d, ax, az, color, aux)` | Upright box; `(ax, az)` is the unit direction of its width. |
| `soup.battlements(ring, y, color, aux, opts)` | Parapet rail plus merlons along every edge. |
| `offset(ring, d)` | Grow (`+`) or shrink (`-`) an outline. Good for parapets and trim lines (±0.3 to 0.5 m). |
| `inset(ring, d)` | Shrink for a setback; returns `null` if the result is not a sane polygon. Always handle `null`. |
| `soup.mesh(material, name)` | Finish. Returns `null` if empty. |

`aux` is `[topHeight, seed, variant, floodBaseHeight]`:

- `topHeight`: the tower's top. The shader stops windows under the parapet and lights crowns relative to it.
- `seed`: any number that differs per building, so window patterns do not repeat. `hash(i * 17 + 3) * 40` works.
- `variant`: shader-mode specific (masonry: `1` = tall continuous glazing).
- `floodBaseHeight`: where the uplight starts (stone mode). `0` for ground level.

Walls start at `y = 0` even when a podium hides the bottom. It is simpler and nothing shows.

**Offsets are fragile on outlines with small notches.** `offset`/`inset` by more than the shortest edge self-intersects. For big setbacks on complicated outlines, derive rectangles from the bounding box instead (see the MGM penthouse spines).

### 5.4 Pick a facade mode

`facade(mode, options)` returns the shared hero shader. Windows and bands are drawn procedurally from wall distance and height, so they are sharp at any zoom.

| Mode | Look | Example |
|---|---|---|
| `MODE.glass` | Curtain wall, one lit spandrel line per floor, a few lit suites | MGM Grand |
| `MODE.stucco` | Pale wall, recessed vertical window bays, flooded from the base | Excalibur towers |
| `MODE.masonry` | Stone piers, punched windows, lit crown. Uses **vertex colours** (`vertexColors: true`), so each tower has its own colour in one mesh | NYNY |
| `MODE.stone` | Plain dressed stone, warm uplight. Works on Three.js primitives too | Turrets, keeps, parapets, rotundas |

Options (all optional):

| Option | Meaning | Typical |
|---|---|---|
| `color` | Wall colour by day | sample from reference, then brighten slightly |
| `glow` | Self-lit colour (glass floor lines) | the brightest colour in the reference |
| `self` | How much the wall glows its own colour at night | 0.04 – 0.2 |
| `flood` / `floodK` | Uplight colour and strength | `'#ffe2b8'`, 0.5 – 1.0 |
| `roof` | Roof colour | dark blue-grey, e.g. `'#3a4150'` |
| `roofGlow` | Roof lit by the flood colour at night | 0 for towers, 0.4 for a lit rotunda |
| `vertexColors` | Per-vertex wall colour | masonry |

**If no mode fits** (for example gold mirror glass, LED media facades, vertical fins), add a new mode: add a branch in `FRAG` in `hero-kit.js`, add its name to `MODE`, and keep the same structure: compute day colour `c` from `base * light`, dim it for night, add emissive `e` scaled by `night`. Reuse `band()` for anything periodic; it handles anti-aliasing and far-distance averaging. Do not change the existing branches' numbers; other resorts depend on them.

### 5.5 Props, crowns, signs

- **Primitives** (cylinders, cones, boxes, spheres): add them to a `THREE.Group`, then `out.add(bakeStatic(group, keep))`. Baking merges hundreds of meshes into a few. Every primitive geometry has the same attributes, so they merge. Do **not** bake `Soup` meshes.
- **Materials for props:** `sheen(color, { refl, spec, glow, glowK, baseGlow })` from `sheen.js`. `glowK` is night emission, `baseGlow` is always-on. Saturated roofs: `glowK` ≈ 0.4. Gold trim: ≈ 1.0. Always-bright bits (beacons): `new THREE.MeshBasicMaterial({ color, fog: true })`.
- **Turrets:** `turretKit()` + `turret(group, kit, x, z, r, y0, y1, roofMaterial, opts)` from the kit.
- **Signs:** `sign(text, w, h, x, y, z, dx, dz, { font, color, background })`. `(dx, dz)` is the direction the sign faces. Put it 0.45 m in front of the wall.
- **Halos:** `halo(size, color, k)` is an additive sprite. Keep `k` at 0.14 – 0.26 for washes; they blow out fast.
- Anything that must survive baking needs `userData.keep = true` (`sign`, `halo` and `spill` already set it).

### 5.6 Light on the ground

`spill(x, y, z, radius, color, k)` is an additive night-only disc.

- One at `y = 0.45` for the streets, radius ≈ 1.3 × the resort's size, `k` ≈ 0.3.
- One just above the podium roof (`podiumHeight + 0.35`), radius small enough to stay inside the podium outline, `k` ≈ 0.3. Outside the podium it would float in mid-air.

### 5.7 Podium tint

In `RESORT_LOOKS` (buildings.js) add a `low` block to the resort's entry. It overrides tint and glow for its low-rise pieces only:

```js
low: { tint: '#cdd6da', k: 0.6, glow: '#fff0c8', glowK: 1.1 }
```

### 5.8 Retire the old drawing

Whatever step 2's grep found drawing the same towers must go, or you get two buildings fighting (flicker, doubled signs).

- Remove the call, not the whole function, and leave a one-line comment pointing at the new file.
- Keep parts you are not replacing (in the example: MGM's lion, NYNY's bridge, coaster and Statue of Liberty stayed).
- These files live under `landmarks/vendor/`, which `npm run import-landmarks` regenerates. Say so in your summary.

---

## 6. Verify, compare, tune

After every edit: `location.reload()`, wait for `ready`, `hideUi()`, same `shot(...)` numbers as the "before".

Check in this order:

1. **Console.** A shader typo makes the whole mesh disappear silently. Read the errors first.
2. **Night, wide shot.** Compare with the reference. Squint: is the brightness balance right? The usual first-pass faults and their fixes:

| Symptom | Fix |
|---|---|
| Towers look overexposed or chalky | Lower `floodK`, lower `self` |
| Too many lit windows, reads as a spreadsheet | Lower the lit-window rate in that mode (0.1 – 0.2 looks right; 0.3+ is too busy) |
| Lit cells look like big blocks | Make the cell narrower, lower their brightness |
| A flat roof glows like a lamp | It is using a `sheen` glow material on a top face. Use walls only, or `MODE.stone` trim |
| Colour too orange / saturated at night | Lower the night multiplier or `floodK` for that material |
| Building invisible | Console error, or you claimed footprints and never drew them |
| Building drawn twice, flickering | Old code still running (5.8), or footprints not claimed (5.2) |
| Faces look inside-out | You skipped `clean()` |

3. **Night, close shot per tower.** Parapet edges, signs readable and facing out, props sitting on the roof not inside it.
4. **Day and Sunset.** Glass too dark by day is common; raise the day mix, not the night one.
5. `npm test`.

Change a few numbers, reload, compare again. The worked example took two tuning passes. Stop when the remaining differences are things the data cannot give you, and list those for the user.

---

## 7. Report to the user

Lead with what now matches. Then, plainly:

- Before and after screenshots at the same camera.
- What still differs from the reference and why.
- Files added and files edited, flagging any under `landmarks/vendor/`.
- That nothing is committed.

---

## 8. Suggested order for the rest of the Strip

South to north, grouped so each file covers neighbours. Existing code to read (and partly retire) is in parentheses.

1. **Luxor + Mandalay Bay** (`landmarks.js` `luxor`, `details.js` `luxorExtras`, `resorts.js` `mandalay`)
2. **Park MGM + T-Mobile Arena** (`resorts.js` `parkMgm`, `arenas.js` `tMobile`)
3. **ARIA / Vdara / Cosmopolitan / Crystals** (`resorts.js` `cosmopolitan`, `buildStripResorts`)
4. **Planet Hollywood + Paris** (`buildStripResorts`, `landmarks.js` `eiffel`, `balloon`)
5. **Bellagio** (`resorts.js` `bellagio`, `landmarks.js` `fountains`)
6. **Caesars Palace + Flamingo + LINQ / High Roller** (`buildStripResorts`, `landmarks.js` `highRoller`)
7. **Mirage / Treasure Island / Venetian / Palazzo** (`resorts.js` `treasureIsland`, `buildStripResorts`)
8. **Wynn / Encore** (`resorts.js` `crescent`)
9. **Resorts World / Fontainebleau / Circus Circus / Sahara / Strat** (`resorts.js` `resortsWorld`, `fontainebleau`, `circusFront`, `landmarks.js` `strat`)

Some of these (Sphere, High Roller, Eiffel Tower, fountains, Allegiant) are already detailed bespoke models. Leave them unless the user's screenshot shows a clear gap.

---

## 9. Hard rules

- One resort (or one tight group) per pass. Verify before starting the next.
- Never claim a podium footprint.
- Never edit numbers inside an existing shader mode to suit a new resort; add options or a new mode.
- Keep the three already-rebuilt resorts looking the same: after your change, re-shoot the Tropicana corner (`shot(36.1004, -115.1737, 16.2, 18, 62)`) and confirm.
- No new dependencies, no build step. This is a static site.
- Do not commit, push, or run `npm run import-landmarks` unless asked.
