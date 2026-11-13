# Road Revamp Visual References (Apple Maps / Google Maps Target)

Visual references provided by the repository owner for rebuilding the Las Vegas Strip, behind-Strip corridors, resort valets/loops, and freeway interchanges. Because autonomous vehicles (Zoox, Waymo, Tesla, Robovan) drive directly on these roads (`npm run test:drive`), pavement geometry, lane centerlines, elevation grades, markings, and 3D structure clearances must all align.

## Target Reference Screenshots (Apple Maps)

- `target-apple-maps-rio-flamingo.jpg` — W Flamingo Rd & S Hotel Rio Dr: smooth curved resort drives, crisp `ONLY` turn bays, zebra crosswalks, continuous curbs, landscaped medians.
- `target-apple-maps-flamingo-dean-martin.jpg` — W Flamingo Rd & Dean Martin Dr: seamless multi-level overpass/underpass transitions, clean ramp tapers, unobstructed lanes.
- `target-apple-maps-bellagio-drive.jpg` — Bellagio front drive & Fountains: smooth curved viaduct split, chevron gores, `ONLY` turn pockets, clean pedestrian bridges with zero pavement overlap.

## Side-by-Side Comparisons (Current App vs. Apple Maps Target)

- `compare-tropicana-lvblvd-apple-maps.jpg` — W/E Tropicana Ave & S Las Vegas Blvd: side-by-side comparison showing target dark slate pavement, lane lines, turn bays, and corner radii vs. earlier app render.
- `compare-paris-arc-apple-maps.jpg` — E Paris Dr & Arc de Triomphe rotary: side-by-side comparison showing smooth circular rotary, clean curbs, centered lane lines, and unobstructed asphalt vs. earlier app render.

## Known Problem Screenshots ("Before" Issues to Fix Cleanly)

- `issue-strip-segment-alignment.jpg` — Strip lane segment shifts/misalignment and choppy driveway joins.
- `issue-paris-arc-rotary.jpg` — E Paris Dr & Arc de Triomphe jagged sawtooth median, squeezed `ONLY` text, overlapping/broken rotary lanes.
- `issue-bellagio-viaduct-forks.jpg` — Hard-edged polygon ramp forks, abrupt seam steps, and porte-cochere / canopy intrusion near Bellagio drive.
- `issue-caesars-flamingo-junction.jpg` — Tangled overlapping ramp ribbons and jagged median fragments at Caesars / Flamingo.
- `issue-frank-sinatra-flamingo-ramps.jpg` — Jagged median edges, crooked ramp joins, and lane arrows crossing/fighting ramp geometry at Frank Sinatra Dr & W Flamingo Rd.

## Non-Negotiable Rules

1. **Road is priority**: Never let sidewalks, curbs, median wedges, canopies, skybridge stairs/piers, or 3D buildings overlap drivable asphalt—push/trim structures back instead.
2. **Stay strictly in-lane**: Lane lines, arrows, stop bars, and `ONLY` markings must never bleed across neighboring lanes or intersections.
3. **Go section by section**: Fix one corridor/section at a time (1: Main Strip & major casino valets; 2: Rest of Strip; 3: Streets behind the Strip; 4: Freeways & ramps), verify in `http://localhost:8080` across Day/Sunset/Night, keep `npm test` and `npm run test:drive` 100% clean, and get owner feedback between sections.
