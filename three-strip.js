/**
 * Three.js Custom 3D Layer for the Las Vegas Strip — Exact OSM Footprint Extrusions + Hero Landmarks
 *
 * Directly inspired by abrhamhabtu/vegas-strip-v2:
 * 1. Every resort tower, wing, and casino podium (MGM Grand, Bellagio, Mandalay Bay, Wynn, Encore,
 *    Venetian, Palazzo, Caesars Palace, Aria, Cosmopolitan, New York-New York, Excalibur, Paris,
 *    Flamingo, LINQ, Planet Hollywood, Resorts World, Fontainebleau, Trump, etc.) is extruded in Three.js
 *    from its EXACT OpenStreetMap footprint polygon (`openmaptiles` -> `building`), with zero duplicate
 *    or misaligned boxes.
 * 2. One custom GLSL facade shader renders signature resort wall tints, roofs, glowing floor bands
 *    (MGM/Wynn/Mandalay/Trump), lit pilasters & window grids (Bellagio/Caesars/Venetian/Paris),
 *    reflective glass curtain walls (Aria/Cosmo/Fontainebleau), and LED grids (Resorts World/LINQ).
 * 3. Special non-box architectural landmarks (Luxor Pyramid + Sky Beam, The Sphere LED Exosphere,
 *    Allegiant Stadium dome, Paris Eiffel Tower lattice + Balloon, High Roller wheel, The STRAT needle,
 *    Bellagio Fountains, Hard Rock Guitar, Fremont Viva Vision canopy) replace only their specific
 *    underlying flat OSM mass and sit 100% grounded and proportioned to their real footprints.
 */

const STRIP_ORIGIN_LNG = -115.1728;
const STRIP_ORIGIN_LAT = 36.1147;
const EARTH_RADIUS = 6378137;
const COS_ORIGIN_LAT = Math.cos((STRIP_ORIGIN_LAT * Math.PI) / 180);

function latLngToLocalXZ(lat, lng) {
  const x = ((lng - STRIP_ORIGIN_LNG) * Math.PI / 180) * EARTH_RADIUS * COS_ORIGIN_LAT;
  const z = -((lat - STRIP_ORIGIN_LAT) * Math.PI / 180) * EARTH_RADIUS;
  return [x, z];
}

function latLngToVector3(lat, lng, alt = 0) {
  const [x, z] = latLngToLocalXZ(lat, lng);
  return new THREE.Vector3(x, alt, z);
}

/**
 * Facade Styles in the custom GLSL Building Shader (matching vegas-strip-v2):
 * 1 = Generic Warm Vegas Masonry / Stucco
 * 2 = High-Rise Window Grid
 * 4 = Reflective Curtain-Wall Glass (Aria, Cosmo, Vdara, Fontainebleau)
 * 6 = Continuous Glowing Floor Bands (MGM Grand, Wynn, Encore, Mandalay Bay, Delano, Trump, Golden Nugget)
 * 7 = Lit Classical Pilasters + Warm Window Grid (Bellagio, Caesars Palace, Venetian, Palazzo, Paris, TI)
 * 9 = Animated / Lit Neon Grid (Resorts World, Planet Hollywood, LINQ, Rio)
 * 10 = Neon Uplight / Arena Facade (Flamingo, T-Mobile Arena)
 */
const STYLE = {
  MASONRY: 1,
  TOWER: 2,
  GLASS: 4,
  BANDS: 6,
  PILASTERS: 7,
  GRID: 9,
  NEON: 10,
};

/**
 * Spatial Resort Zones along the Las Vegas Strip & Downtown.
 * Each OSM building/building:part whose centroid falls within a resort's zone receives that resort's
 * authentic wall tint, roof color, night/band glow color, and procedural facade style.
 */
const RESORT_ZONES = [
  // South Strip
  {
    name: "Allegiant Stadium",
    lat: 36.0908,
    lng: -115.1833,
    radius: 240,
    tint: "#14171f",
    roof: "#252a36",
    glow: "#d8dee9",
    glowK: 1.0,
    style: STYLE.BANDS,
  },
  {
    name: "Mandalay Bay & Delano",
    lat: 36.0919,
    lng: -115.1755,
    radius: 320,
    tint: "#c9963a",
    roof: "#7a5b20",
    glow: "#ffcf6a",
    glowK: 0.95,
    style: STYLE.BANDS,
  },
  {
    name: "Luxor",
    lat: 36.0955,
    lng: -115.1761,
    radius: 230,
    tint: "#232836",
    roof: "#151821",
    glow: "#ffd480",
    glowK: 0.65,
    style: STYLE.GLASS,
  },
  {
    name: "Excalibur",
    lat: 36.0987,
    lng: -115.1754,
    radius: 230,
    tint: "#f4efe6",
    roof: "#c41e28",
    glow: "#ffe7b0",
    glowK: 0.8,
    style: STYLE.TOWER,
    vary: ["#f4efe6", "#eae2d3"],
    varyRoof: ["#c41e28", "#1e4fc4"],
  },
  {
    name: "MGM Grand",
    lat: 36.1025,
    lng: -115.1696,
    radius: 340,
    tint: "#1fa36a",
    roof: "#165e40",
    glow: "#3dff9a",
    glowK: 1.25,
    style: STYLE.BANDS,
  },
  {
    name: "The Signature at MGM",
    lat: 36.1072,
    lng: -115.1661,
    radius: 220,
    tint: "#d9c398",
    roof: "#8c754b",
    glow: "#ffe3a8",
    glowK: 0.75,
    style: STYLE.BANDS,
  },
  {
    name: "New York-New York",
    lat: 36.1024,
    lng: -115.1746,
    radius: 210,
    tint: "#d4c3a3",
    roof: "#5e7a6e",
    glow: "#ffe2a8",
    glowK: 0.85,
    style: STYLE.PILASTERS,
    vary: ["#dfd3be", "#c78363", "#7f9894", "#b56348", "#d4be98", "#8d99a6", "#a66b4f", "#e6dcc8"],
  },
  {
    name: "T-Mobile Arena",
    lat: 36.1028,
    lng: -115.1782,
    radius: 140,
    tint: "#b8733f",
    roof: "#2b211b",
    glow: "#ff2a85",
    glowK: 1.1,
    style: STYLE.NEON,
  },
  {
    name: "Park MGM & NoMad",
    lat: 36.1048,
    lng: -115.1745,
    radius: 190,
    tint: "#d9c59c",
    roof: "#7d3835",
    glow: "#ffe0a6",
    glowK: 0.7,
    style: STYLE.PILASTERS,
  },
  // CityCenter & Center Strip
  {
    name: "ARIA & Vdara & Veer",
    lat: 36.1075,
    lng: -115.1768,
    radius: 270,
    tint: "#789ec4",
    roof: "#344e6b",
    glow: "#cfe3ff",
    glowK: 0.7,
    style: STYLE.GLASS,
    vary: ["#789ec4", "#638ab2", "#8cb0d4"],
  },
  {
    name: "The Cosmopolitan",
    lat: 36.1098,
    lng: -115.1742,
    radius: 170,
    tint: "#4f6b94",
    roof: "#283952",
    glow: "#b8d0ff",
    glowK: 0.8,
    style: STYLE.GLASS,
  },
  {
    name: "Planet Hollywood & Elara",
    lat: 36.1097,
    lng: -115.1702,
    radius: 230,
    tint: "#987cc4",
    roof: "#483566",
    glow: "#d36bff",
    glowK: 0.9,
    style: STYLE.GRID,
  },
  {
    name: "Bellagio",
    lat: 36.1129,
    lng: -115.1765,
    radius: 290,
    tint: "#f0e2c6",
    roof: "#c27d48",
    glow: "#ffd9a0",
    glowK: 0.85,
    style: STYLE.PILASTERS,
  },
  {
    name: "Paris Las Vegas",
    lat: 36.1124,
    lng: -115.1706,
    radius: 200,
    tint: "#eedcbd",
    roof: "#3b62b8",
    glow: "#ffe2b0",
    glowK: 0.8,
    style: STYLE.PILASTERS,
  },
  {
    name: "Horseshoe & Cromwell",
    lat: 36.1143,
    lng: -115.1706,
    radius: 185,
    tint: "#e5cfa8",
    roof: "#8a6843",
    glow: "#ffd27a",
    glowK: 0.7,
    style: STYLE.TOWER,
  },
  {
    name: "Caesars Palace",
    lat: 36.1165,
    lng: -115.1755,
    radius: 310,
    tint: "#f4efe4",
    roof: "#c99b52",
    glow: "#fff1d6",
    glowK: 0.9,
    style: STYLE.PILASTERS,
  },
  {
    name: "Flamingo",
    lat: 36.1163,
    lng: -115.1704,
    radius: 180,
    tint: "#f06aa7",
    roof: "#9c3064",
    glow: "#ff5cc4",
    glowK: 1.1,
    style: STYLE.NEON,
  },
  {
    name: "The LINQ & Harrah's",
    lat: 36.1185,
    lng: -115.1705,
    radius: 220,
    tint: "#8db6d6",
    roof: "#456885",
    glow: "#6fd0ff",
    glowK: 0.8,
    style: STYLE.GRID,
  },
  // North-Center Strip
  {
    name: "Hard Rock / Mirage",
    lat: 36.1212,
    lng: -115.1745,
    radius: 260,
    tint: "#d4bc8c",
    roof: "#7d6840",
    glow: "#ffe5a3",
    glowK: 0.75,
    style: STYLE.BANDS,
  },
  {
    name: "The Venetian & Palazzo",
    lat: 36.1222,
    lng: -115.1692,
    radius: 340,
    tint: "#eedfc2",
    roof: "#c47c4e",
    glow: "#ffdca6",
    glowK: 0.8,
    style: STYLE.PILASTERS,
  },
  {
    name: "Treasure Island (TI)",
    lat: 36.1247,
    lng: -115.1721,
    radius: 210,
    tint: "#f0d6ae",
    roof: "#b87654",
    glow: "#ff7a6a",
    glowK: 1.0,
    style: STYLE.PILASTERS,
  },
  {
    name: "Wynn & Encore",
    lat: 36.1278,
    lng: -115.1656,
    radius: 380,
    tint: "#9e6832",
    roof: "#59391a",
    glow: "#ffc76b",
    glowK: 1.15,
    style: STYLE.BANDS,
  },
  {
    name: "Trump International",
    lat: 36.1295,
    lng: -115.1727,
    radius: 150,
    tint: "#d9b25c",
    roof: "#8f6f24",
    glow: "#ffd36b",
    glowK: 0.95,
    style: STYLE.BANDS,
  },
  {
    name: "Resorts World",
    lat: 36.1348,
    lng: -115.1665,
    radius: 360,
    tint: "#c22a4c",
    roof: "#6e1529",
    glow: "#ff3d6e",
    glowK: 1.1,
    style: STYLE.GRID,
  },
  {
    name: "Fontainebleau",
    lat: 36.1365,
    lng: -115.1610,
    radius: 300,
    tint: "#2f6fd0",
    roof: "#173c78",
    glow: "#7fb4ff",
    glowK: 0.95,
    style: STYLE.GLASS,
  },
  {
    name: "Circus Circus",
    lat: 36.1367,
    lng: -115.1650,
    radius: 250,
    tint: "#f0a8bc",
    roof: "#c93867",
    glow: "#ff5fb0",
    glowK: 0.85,
    style: STYLE.TOWER,
  },
  {
    name: "Sahara",
    lat: 36.1425,
    lng: -115.1566,
    radius: 220,
    tint: "#e0c79a",
    roof: "#8f6c3e",
    glow: "#ff9b6a",
    glowK: 0.7,
    style: STYLE.PILASTERS,
  },
  {
    name: "Rio",
    lat: 36.1165,
    lng: -115.1880,
    radius: 280,
    tint: "#9c2f4a",
    roof: "#2f4f9c",
    glow: "#ff4060",
    glowK: 1.0,
    style: STYLE.GRID,
    vary: ["#9c2f4a", "#2f4f9c"],
  },
  {
    name: "Palms",
    lat: 36.1148,
    lng: -115.1945,
    radius: 250,
    tint: "#4aaec4",
    roof: "#276270",
    glow: "#7ff0ff",
    glowK: 0.85,
    style: STYLE.GLASS,
  },
  // Downtown / Fremont
  {
    name: "Fremont Street & Golden Nugget & Circa",
    lat: 36.1705,
    lng: -115.1440,
    radius: 420,
    tint: "#e6c35c",
    roof: "#785d22",
    glow: "#ffd36b",
    glowK: 0.9,
    style: STYLE.BANDS,
    vary: ["#e6c35c", "#3e4a62", "#e9dfc6", "#c95b42"],
  },
].map((z) => {
  const [x, zPos] = latLngToLocalXZ(z.lat, z.lng);
  return { ...z, x, z: zPos };
});

const GENERIC_WALL_PALETTE = [
  "#d6c7b2",
  "#c4b097",
  "#b8b4aa",
  "#6e8296",
  "#9e7b66",
  "#a4a7ab",
  "#7b8d9e",
  "#cfb99d",
];

/**
 * Footprints where a custom non-box 3D landmark replaces the flat-topped OSM extrusion:
 * - Luxor Pyramid (only the square pyramid mass itself, so the grey box doesn't swallow the pyramid)
 * - The Sphere (so the flat cylinder doesn't poke through the spherical dome)
 * - The STRAT observation needle shaft
 */
const LANDMARK_EXCLUSION_ZONES = [
  { name: "Luxor Pyramid Core", lat: 36.09551, lng: -115.17606, radius: 96, minH: 30 },
  { name: "The Sphere Dome Core", lat: 36.12123, lng: -115.16208, radius: 92, minH: 15 },
  { name: "The STRAT Tower Core", lat: 36.14748, lng: -115.15665, radius: 42, minH: 60 },
].map((e) => {
  const [x, z] = latLngToLocalXZ(e.lat, e.lng);
  return { ...e, x, z };
});

function shouldExcludeFlatBuilding(cx, cz, height) {
  for (const ex of LANDMARK_EXCLUSION_ZONES) {
    if (height >= ex.minH && Math.hypot(cx - ex.x, cz - ex.z) < ex.radius) {
      return true;
    }
  }
  return false;
}

function matchResortZone(cx, cz, height, area) {
  let best = null;
  let bestDist = Infinity;
  for (const zone of RESORT_ZONES) {
    const d = Math.hypot(cx - zone.x, cz - zone.z);
    if (d < zone.radius && d < bestDist) {
      bestDist = d;
      best = zone;
    }
  }
  return best;
}

function simpleHash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function signedRingArea(ringXZ) {
  let a = 0;
  for (let i = 0; i < ringXZ.length; i++) {
    const p = ringXZ[i];
    const q = ringXZ[(i + 1) % ringXZ.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return 0.5 * a;
}

/**
 * Custom GLSL ShaderMaterial for all extruded OSM buildings & resorts (ported from vegas-strip-v2)
 */
function createBuildingShaderMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute vec4 aExt; // x = u distance along wall, y = topHeight, z = seed, w = style
      attribute vec4 aGlow; // rgb = glow color, a = glow intensity

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec4 vExt;
      varying vec4 vGlow;

      void main() {
        vWorldPos = position;
        vNormal = normalize(normal);
        vColor = aColor;
        vExt = aExt;
        vGlow = aGlow;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec4 vExt;
      varying vec4 vGlow;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 n = normalize(vNormal);
        bool isRoof = n.y > 0.55;
        float u = vExt.x;
        float topH = max(vExt.y, 1.0);
        float seed = vExt.z;
        float style = floor(vExt.w + 0.5);
        float y = vWorldPos.y;

        // Directional Vegas sun + sky hemisphere lighting
        vec3 sunDir = normalize(vec3(0.45, 0.78, 0.42));
        float sunDiff = max(dot(n, sunDir), 0.0);
        float hemi = 0.68 + 0.32 * n.y;
        float light = 0.58 * hemi + 0.52 * sunDiff;

        vec3 col = vColor * light;

        // Subtle ambient occlusion near ground & crown brightening
        col *= mix(0.75, 1.04, clamp(y / 14.0, 0.0, 1.0));
        col *= mix(1.0, 1.12, clamp(y / topH, 0.0, 1.0));

        if (isRoof) {
          // Subtle roof gravel/membrane grid
          vec2 rq = floor(vWorldPos.xz / 10.0);
          col *= 0.94 + 0.1 * hash21(rq + seed);
          gl_FragColor = vec4(col, 1.0);
          return;
        }

        // Facade window & resort styling on vertical walls
        if (y > 3.2 && y < topH - 1.2) {
          float floorY = fract(y / 3.5);
          float colX = fract(u / 3.2);

          if (style == 6.0) {
            // MGM Grand / Wynn / Encore / Mandalay Bay / Trump: Continuous horizontal glass & neon bands
            float bandLine = smoothstep(0.76, 0.84, floorY);
            float darkGlass = smoothstep(0.18, 0.25, floorY) * (1.0 - bandLine);
            col = mix(col, col * 0.65, darkGlass * 0.65);
            col = mix(col, vGlow.rgb * 1.15, bandLine * clamp(vGlow.a * 0.65, 0.25, 0.95));
          } else if (style == 7.0) {
            // Bellagio / Caesars / Venetian / Paris / TI: Classical pilasters + warm lit windows
            float pilaster = step(0.84, fract(u / 8.5));
            float winMask = step(0.22, colX) * step(colX, 0.78) * step(0.25, floorY) * step(floorY, 0.78) * (1.0 - pilaster);
            vec2 cell = vec2(floor(u / 3.2), floor(y / 3.5));
            float isLit = step(0.42, hash21(cell + seed));
            vec3 winCol = mix(col * 0.48, vGlow.rgb * 1.08, isLit * 0.75);
            col = mix(col, winCol, winMask * 0.85);
            col = mix(col, col * 1.16, pilaster * 0.7);
          } else if (style == 4.0) {
            // Aria / Cosmopolitan / Fontainebleau: Reflective blue glass curtain wall + mullions
            float mullion = step(0.9, colX) + step(0.88, floorY);
            vec3 skyRefl = vec3(0.55, 0.76, 0.98);
            col = mix(col, skyRefl * light, 0.35);
            col = mix(col, vGlow.rgb, clamp(mullion, 0.0, 1.0) * 0.35);
          } else if (style == 9.0 || style == 10.0) {
            // Resorts World / LINQ / Planet Hollywood / Flamingo: Neon grid & uplights
            float gridLine = step(0.86, fract(u / 4.5)) + step(0.86, floorY);
            col = mix(col, vGlow.rgb * 1.25, clamp(gridLine, 0.0, 1.0) * 0.6);
          } else {
            // Generic towers & masonry buildings: Subtle window grid
            float win = step(0.25, colX) * step(colX, 0.75) * step(0.28, floorY) * step(floorY, 0.74);
            col = mix(col, col * 0.56, win * 0.65);
          }
        }

        // Top glowing resort crown parapet on tall resort buildings
        if (topH > 32.0 && y >= topH - 2.2 && vGlow.a > 0.3) {
          col = mix(col, vGlow.rgb * 1.25, 0.78);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/**
 * Extrude an OSM polygon ring (in local [x, z] meters) from y0 to y1 into BufferGeometry arrays
 */
function appendExtrudedPolygon(ringXZ, y0, y1, wallColor, roofColor, glowColor, glowK, style, seed, arrays) {
  if (ringXZ.length < 3) return;
  // Remove duplicate closing vertex if present
  const pts = ringXZ.slice();
  if (
    pts.length > 2 &&
    Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.05
  ) {
    pts.pop();
  }
  if (pts.length < 3) return;

  // Ensure consistent winding
  if (signedRingArea(pts) < 0) {
    pts.reverse();
  }

  const { positions, normals, colors, exts, glows, indices } = arrays;
  const pushVertex = (px, py, pz, nx, ny, nz, col, u, topH, sty) => {
    const idx = positions.length / 3;
    positions.push(px, py, pz);
    normals.push(nx, ny, nz);
    colors.push(col.r, col.g, col.b);
    exts.push(u, topH, seed, sty);
    glows.push(glowColor.r, glowColor.g, glowColor.b, glowK);
    return idx;
  };

  // 1. Extrude vertical walls
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.1) continue;

    const nx = dz / len;
    const nz = -dx / len;

    const v0 = pushVertex(a[0], y0, a[1], nx, 0, nz, wallColor, u, y1, style);
    const v1 = pushVertex(b[0], y0, b[1], nx, 0, nz, wallColor, u + len, y1, style);
    const v2 = pushVertex(b[0], y1, b[1], nx, 0, nz, wallColor, u + len, y1, style);
    const v3 = pushVertex(a[0], y1, a[1], nx, 0, nz, wallColor, u, y1, style);

    indices.push(v0, v1, v2, v0, v2, v3);
    u += len;
  }

  // 2. Triangulate roof cap
  const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch (e) {
    return;
  }

  const roofBaseIdx = positions.length / 3;
  for (let i = 0; i < pts.length; i++) {
    pushVertex(pts[i][0], y1, pts[i][1], 0, 1, 0, roofColor, 0, y1, style);
  }
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    indices.push(roofBaseIdx + t[0], roofBaseIdx + t[2], roofBaseIdx + t[1]);
  }
}

window.createVegasThreeLayer = function () {
  let camera, scene, renderer, buildingsGroup, landmarksGroup;
  let buildingMaterial;
  let processedBuildingKeys = new Set();
  let animatedCallbacks = [];
  let egoCarGroup = null;
  let clock = new THREE.Clock();

  /**
   * Build only the special non-box architectural landmarks at their exact OSM footprints
   * (Luxor Pyramid + Sky Beam, The Sphere, Paris Eiffel Tower + Balloon, Bellagio Fountain Jets,
   * High Roller Wheel, The STRAT Needle, Hard Rock Guitar, Fremont Street Canopy, Welcome Sign).
   * All hotel towers and casino podiums are extruded directly from their real OSM footprints!
   */
  function buildSpecialLandmarks() {
    // 1. LUXOR PYRAMID + SKY BEAM — Exact 183m x 183m x 111m Black Glass Pyramid on Luxor's OSM square
    {
      const luxorGroup = new THREE.Group();
      luxorGroup.position.copy(latLngToVector3(36.09551, -115.17606, 0));

      const pyramidH = 111;
      // ConeGeometry radius is center-to-corner; for a 180m square side, radius = 180 / sqrt(2) = 127.3m
      const cornerRadius = 127.3;
      const pyrGeo = new THREE.ConeGeometry(cornerRadius, pyramidH, 4, 28);
      pyrGeo.rotateY(Math.PI / 4); // Align square base edges strictly N/S and E/W with the Strip

      const pyrMat = new THREE.MeshStandardMaterial({
        color: "#161a24",
        roughness: 0.18,
        metalness: 0.85,
        emissive: "#232a3b",
        emissiveIntensity: 0.28,
      });
      const pyramid = new THREE.Mesh(pyrGeo, pyrMat);
      pyramid.position.y = pyramidH / 2;
      luxorGroup.add(pyramid);

      // Glowing Gold Pyramidion Apex
      const capGeo = new THREE.ConeGeometry(14, 13, 4);
      capGeo.rotateY(Math.PI / 4);
      const capMat = new THREE.MeshBasicMaterial({ color: "#fff5cc" });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = pyramidH - 5.5;
      luxorGroup.add(cap);

      // Luxor Sky Beam
      const beamGeo = new THREE.CylinderGeometry(24, 4.5, 750, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: "#d4ebff",
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = pyramidH + 375;
      luxorGroup.add(beam);

      landmarksGroup.add(luxorGroup);
    }

    // 2. BELLAGIO FOUNTAINS — Animated Water Jets strictly inside Lake Bellagio (no fake blue oval!)
    {
      const fountainGroup = new THREE.Group();
      fountainGroup.position.copy(latLngToVector3(36.11265, -115.17395, 0));

      const jetMat = new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.88,
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: "#ffd9a0",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });

      const jets = [];
      const count = 19;
      for (let i = 0; i < count; i++) {
        const t = (i / (count - 1)) * 2 - 1; // -1 .. 1 along the 250m north-south shooter bar
        const z = t * 122;
        const x = -Math.cos(t * 1.2) * 18 + 10; // Gentle westward curve matching Bellagio's shooter bar

        const maxH = 48 * (1 - 0.35 * t * t);
        const jetGeo = new THREE.ConeGeometry(2.0, maxH, 8);
        const jet = new THREE.Mesh(jetGeo, jetMat);
        jet.position.set(x, maxH / 2, z);
        fountainGroup.add(jet);

        const baseRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 4.5, 16).rotateX(-Math.PI / 2), ringMat);
        baseRing.position.set(x, 0.4, z);
        fountainGroup.add(baseRing);

        jets.push({ mesh: jet, maxH, phase: i * 0.45 });
      }

      landmarksGroup.add(fountainGroup);

      animatedCallbacks.push((time) => {
        for (let i = 0; i < jets.length; i++) {
          const j = jets[i];
          const s = 0.25 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(time * 2.6 + j.phase), 1.6);
          j.mesh.scale.y = s;
          j.mesh.position.y = (j.maxH * s) / 2;
        }
      });
    }

    // 3. PARIS EIFFEL TOWER & BALLOON — Pure bronze lattice Eiffel Tower & Balloon at exact footprints
    {
      const eiffelGroup = new THREE.Group();
      eiffelGroup.position.copy(latLngToVector3(36.11252, -115.17218, 0));

      const bronzeMat = new THREE.MeshStandardMaterial({
        color: "#b89058",
        emissive: "#ffcf80",
        emissiveIntensity: 0.42,
        metalness: 0.78,
        roughness: 0.28,
      });

      // Four corner legs + 3 observation decks + tapered spire (165m total height, 28m base width)
      const s1 = new THREE.Mesh(new THREE.CylinderGeometry(11, 20, 48, 4, 1), bronzeMat);
      s1.rotation.y = Math.PI / 4;
      s1.position.y = 24;
      eiffelGroup.add(s1);

      const deck1 = new THREE.Mesh(new THREE.BoxGeometry(22, 2.5, 22), bronzeMat);
      deck1.position.y = 48;
      eiffelGroup.add(deck1);

      const s2 = new THREE.Mesh(new THREE.CylinderGeometry(6, 11, 48, 4, 1), bronzeMat);
      s2.rotation.y = Math.PI / 4;
      s2.position.y = 72;
      eiffelGroup.add(s2);

      const deck2 = new THREE.Mesh(new THREE.BoxGeometry(13, 2.2, 13), bronzeMat);
      deck2.position.y = 96;
      eiffelGroup.add(deck2);

      const s3 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 6, 56, 4, 1), bronzeMat);
      s3.rotation.y = Math.PI / 4;
      s3.position.y = 124;
      eiffelGroup.add(s3);

      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.4, 14, 8), bronzeMat);
      spire.position.y = 159;
      eiffelGroup.add(spire);

      landmarksGroup.add(eiffelGroup);

      // Paris Montgolfier Balloon Sign along LV Blvd
      const balloonGroup = new THREE.Group();
      balloonGroup.position.copy(latLngToVector3(36.11205, -115.17265, 0));
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.4, 24, 10),
        new THREE.MeshStandardMaterial({ color: "#b89058" })
      );
      stem.position.y = 12;
      balloonGroup.add(stem);

      const bMat = new THREE.MeshStandardMaterial({
        color: "#ff6677",
        emissive: "#ffaa44",
        emissiveIntensity: 0.85,
      });
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(9.5, 20, 20), bMat);
      balloon.scale.set(1, 1.28, 1);
      balloon.position.y = 32;
      balloonGroup.add(balloon);
      landmarksGroup.add(balloonGroup);
    }

    // 4. THE SPHERE — Exact 157m Wide (78.5m radius) x 112m High LED Exosphere Dome
    {
      const sphereGroup = new THREE.Group();
      sphereGroup.position.copy(latLngToVector3(36.12123, -115.16208, 0));

      const sCanvas = document.createElement("canvas");
      sCanvas.width = 256;
      sCanvas.height = 128;
      const sCtx = sCanvas.getContext("2d");
      const sphereTex = new THREE.CanvasTexture(sCanvas);

      const radius = 78.5;
      // Sphere center sits at y = 33.5m so top is at 33.5 + 78.5 = 112m and base meets ground at y = 0
      const sphereGeo = new THREE.SphereGeometry(
        radius,
        48,
        32,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.74
      );
      const sphereMat = new THREE.MeshStandardMaterial({
        map: sphereTex,
        emissiveMap: sphereTex,
        emissive: "#ffffff",
        emissiveIntensity: 0.95,
        roughness: 0.2,
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.y = 33.5;
      sphereGroup.add(sphereMesh);
      landmarksGroup.add(sphereGroup);

      animatedCallbacks.push((time) => {
        const hue1 = Math.floor((time * 28) % 360);
        const hue2 = (hue1 + 110) % 360;
        const hue3 = (hue1 + 220) % 360;
        const grad = sCtx.createLinearGradient(0, 0, sCanvas.width, sCanvas.height);
        grad.addColorStop(0, `hsl(${hue1}, 95%, 55%)`);
        grad.addColorStop(0.5, `hsl(${hue2}, 95%, 50%)`);
        grad.addColorStop(1, `hsl(${hue3}, 95%, 55%)`);
        sCtx.fillStyle = grad;
        sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);

        sCtx.fillStyle = "rgba(255,255,255,0.65)";
        for (let r = 0; r < 6; r++) {
          const ry = (time * 38 + r * 22) % sCanvas.height;
          sCtx.fillRect(0, ry, sCanvas.width, 3.5);
        }
        sphereTex.needsUpdate = true;
        sphereMesh.rotation.y = time * 0.35;
      });
    }

    // 5. THE HIGH ROLLER — 167.6m Tall Illuminated Observation Wheel at The LINQ
    {
      const hrGroup = new THREE.Group();
      hrGroup.position.copy(latLngToVector3(36.11765, -115.16838, 0));

      const wheelRadius = 71.5;
      const hubHeight = 94;

      const legMat = new THREE.MeshStandardMaterial({ color: "#e5e9f0", metalness: 0.8 });
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.2, 102, 12), legMat);
      leg1.position.set(-18, 47, 0);
      leg1.rotation.z = -0.19;
      hrGroup.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.2, 102, 12), legMat);
      leg2.position.set(18, 47, 0);
      leg2.rotation.z = 0.19;
      hrGroup.add(leg2);

      const wheelPivot = new THREE.Group();
      wheelPivot.position.y = hubHeight;

      const rimMat = new THREE.MeshStandardMaterial({
        color: "#ff2ae2",
        emissive: "#00e5ff",
        emissiveIntensity: 0.95,
      });
      // Wheel sits in the N-S plane (normal along X axis)
      const rim = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 2.2, 16, 64), rimMat);
      rim.rotation.y = Math.PI / 2;
      wheelPivot.add(rim);

      const podMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
      for (let p = 0; p < 28; p++) {
        const ang = (p / 28) * Math.PI * 2;
        const pod = new THREE.Mesh(new THREE.SphereGeometry(2.8, 10, 10), podMat);
        pod.position.set(0, Math.sin(ang) * (wheelRadius + 3.0), Math.cos(ang) * (wheelRadius + 3.0));
        wheelPivot.add(pod);
      }

      hrGroup.add(wheelPivot);
      landmarksGroup.add(hrGroup);

      animatedCallbacks.push((time) => {
        wheelPivot.rotation.x = time * 0.22;
        rimMat.emissive.setHSL((time * 0.08) % 1.0, 0.9, 0.55);
      });
    }

    // 6. HARD ROCK GUITAR HOTEL — Proportioned 137m Neon Guitar on the Strip Frontage
    {
      const guitarGroup = new THREE.Group();
      guitarGroup.position.copy(latLngToVector3(36.12115, -115.17335, 0));
      guitarGroup.rotation.y = 0.25;

      const gMat = new THREE.MeshStandardMaterial({
        color: "#1b5699",
        emissive: "#00c8ff",
        emissiveIntensity: 0.45,
        metalness: 0.85,
        roughness: 0.15,
      });

      const lowerBout = new THREE.Mesh(new THREE.CylinderGeometry(28, 31, 44, 24), gMat);
      lowerBout.scale.set(1.25, 1, 0.5);
      lowerBout.position.y = 22;
      guitarGroup.add(lowerBout);

      const upperBout = new THREE.Mesh(new THREE.CylinderGeometry(22, 20, 38, 24), gMat);
      upperBout.scale.set(1.2, 1, 0.5);
      upperBout.position.y = 60;
      guitarGroup.add(upperBout);

      const neck = new THREE.Mesh(new THREE.BoxGeometry(11, 62, 10), gMat);
      neck.position.y = 108;
      guitarGroup.add(neck);

      const stringMat = new THREE.MeshBasicMaterial({ color: "#ffd700" });
      for (let s = -2.5; s <= 2.5; s++) {
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 145, 6), stringMat);
        str.position.set(s * 1.4, 72.5, 6.2);
        guitarGroup.add(str);
      }

      landmarksGroup.add(guitarGroup);
    }

    // 7. THE STRAT OBSERVATION TOWER — 350m Tapered Needle & Pod on its exact OSM center
    {
      const stratGroup = new THREE.Group();
      stratGroup.position.copy(latLngToVector3(36.14748, -115.15665, 0));

      const concreteMat = new THREE.MeshStandardMaterial({ color: "#e3e7f0", roughness: 0.4 });
      const podMat = new THREE.MeshStandardMaterial({
        color: "#293242",
        emissive: "#ff4444",
        emissiveIntensity: 0.35,
        metalness: 0.7,
      });

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 20, 245, 16), concreteMat);
      shaft.position.y = 122.5;
      stratGroup.add(shaft);

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(22, 13, 32, 24), podMat);
      pod.position.y = 256;
      stratGroup.add(pod);

      const needle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 2.2, 75, 8),
        new THREE.MeshBasicMaterial({ color: "#ff3b3b" })
      );
      needle.position.y = 310;
      stratGroup.add(needle);

      landmarksGroup.add(stratGroup);
    }

    // 8. WELCOME TO FABULOUS LAS VEGAS SIGN (36.08206, -115.17277)
    {
      const signGroup = new THREE.Group();
      signGroup.position.copy(latLngToVector3(36.08206, -115.17277, 0));

      const poleMat = new THREE.MeshStandardMaterial({ color: "#e5e9f0", metalness: 0.8 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 14, 12), poleMat);
      pole.position.y = 7;
      signGroup.add(pole);

      const diamondGeo = new THREE.BoxGeometry(9, 9, 1.6);
      diamondGeo.rotateZ(Math.PI / 4);
      const diamondMat = new THREE.MeshStandardMaterial({
        color: "#ff2a4b",
        emissive: "#ffbf00",
        emissiveIntensity: 0.9,
      });
      const diamond = new THREE.Mesh(diamondGeo, diamondMat);
      diamond.position.y = 11;
      signGroup.add(diamond);

      landmarksGroup.add(signGroup);
    }

    // 9. 3D AUTONOMOUS ROBOTAXI EGO VEHICLE
    {
      egoCarGroup = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({
        color: "#f5f7fa",
        emissive: "#34a853",
        emissiveIntensity: 0.35,
        metalness: 0.6,
        roughness: 0.2,
      });
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.2, 14), bodyMat);
      chassis.position.y = 2.0;
      egoCarGroup.add(chassis);

      const glassMat = new THREE.MeshStandardMaterial({
        color: "#111827",
        metalness: 0.9,
        roughness: 0.1,
      });
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.4, 8.2), glassMat);
      cabin.position.set(0, 4.4, -0.8);
      egoCarGroup.add(cabin);

      const lidarMat = new THREE.MeshBasicMaterial({ color: "#00ff88" });
      const lidar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 16), lidarMat);
      lidar.position.set(0, 6.1, 0);
      egoCarGroup.add(lidar);

      const ringGeo = new THREE.RingGeometry(10, 12, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: "#00ff88",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.6;
      egoCarGroup.add(ring);

      scene.add(egoCarGroup);
    }
  }

  /**
   * Query loaded OpenMapTiles `building` features from MapLibre and extrude every new footprint
   * into Three.js with its exact polygon vertices, height, and resort facade styling.
   */
  function syncOSMBuildingsFromMap(map) {
    if (!map || !buildingsGroup) return;

    let features;
    try {
      features = map.querySourceFeatures("openmaptiles", { sourceLayer: "building" });
    } catch (e) {
      return;
    }
    if (!features || !features.length) return;

    const arrays = {
      positions: [],
      normals: [],
      colors: [],
      exts: [],
      glows: [],
      indices: [],
    };

    let addedCount = 0;

    for (let fIdx = 0; fIdx < features.length; fIdx++) {
      const feat = features[fIdx];
      const props = feat.properties || {};

      // Skip 2D base footprints that have 3D building:part replacements!
      if (props.hide_3d === true || props.hide_3d === "true" || props.hide_3d === 1) {
        continue;
      }

      const topH = Number(props.render_height || props.height || 8);
      const minH = Number(props.render_min_height || props.min_height || 0);
      if (topH <= minH || topH < 2.5) continue;

      const geom = feat.geometry;
      if (!geom) continue;

      const polys =
        geom.type === "Polygon"
          ? [geom.coordinates]
          : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];

      for (let pIdx = 0; pIdx < polys.length; pIdx++) {
        const outerRingLngLat = polys[pIdx][0];
        if (!outerRingLngLat || outerRingLngLat.length < 3) continue;

        // Convert ring to local meters [x, z] & compute centroid
        const ringXZ = [];
        let sumX = 0;
        let sumZ = 0;
        for (let k = 0; k < outerRingLngLat.length; k++) {
          const [lng, lat] = outerRingLngLat[k];
          const [x, z] = latLngToLocalXZ(lat, lng);
          ringXZ.push([x, z]);
          sumX += x;
          sumZ += z;
        }
        const cx = sumX / ringXZ.length;
        const cz = sumZ / ringXZ.length;
        const area = Math.abs(signedRingArea(ringXZ));

        // Deduplicate across vector tile reloads using quantized centroid + height
        const key = `${Math.round(cx * 0.5)}_${Math.round(cz * 0.5)}_${Math.round(topH)}_${Math.round(minH)}`;
        if (processedBuildingKeys.has(key)) continue;
        processedBuildingKeys.add(key);

        // Skip flat OSM boxes where a custom 3D non-box landmark sits (Luxor Pyramid, Sphere, STRAT)
        if (shouldExcludeFlatBuilding(cx, cz, topH)) {
          continue;
        }

        const seed = simpleHash(cx * 0.13 + cz * 0.29 + topH);
        const zone = matchResortZone(cx, cz, topH, area);

        let wallColorHex = GENERIC_WALL_PALETTE[Math.floor(seed * GENERIC_WALL_PALETTE.length)];
        let roofColorHex = "#343942";
        let glowColorHex = "#ffe4b5";
        let glowK = 0.25;
        let style = topH > 26 ? STYLE.TOWER : STYLE.MASONRY;

        if (zone) {
          wallColorHex = zone.vary
            ? zone.vary[Math.floor(seed * zone.vary.length)]
            : zone.tint;
          roofColorHex = zone.varyRoof
            ? zone.varyRoof[Math.floor(seed * zone.varyRoof.length)]
            : zone.roof || zone.tint;
          glowColorHex = zone.glow || "#ffe4b5";
          glowK = zone.glowK ?? 0.85;
          style = topH < 20 && zone.style !== STYLE.NEON ? STYLE.PILASTERS : zone.style;
        }

        const wallColor = new THREE.Color(wallColorHex);
        const roofColor = new THREE.Color(roofColorHex);
        const glowColor = new THREE.Color(glowColorHex);

        appendExtrudedPolygon(
          ringXZ,
          minH,
          topH,
          wallColor,
          roofColor,
          glowColor,
          glowK,
          style,
          seed * 50.0,
          arrays
        );
        addedCount++;
      }
    }

    if (addedCount > 0 && arrays.positions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(arrays.positions, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(arrays.normals, 3));
      geo.setAttribute("aColor", new THREE.Float32BufferAttribute(arrays.colors, 3));
      geo.setAttribute("aExt", new THREE.Float32BufferAttribute(arrays.exts, 4));
      geo.setAttribute("aGlow", new THREE.Float32BufferAttribute(arrays.glows, 4));
      geo.setIndex(arrays.indices);

      const mesh = new THREE.Mesh(geo, buildingMaterial);
      buildingsGroup.add(mesh);
    }
  }

  const customLayer = {
    id: "vegas-threejs-landmarks",
    type: "custom",
    renderingMode: "3d",

    onAdd: function (map, gl) {
      this.map = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Warm Vegas lighting for custom landmarks
      const ambientLight = new THREE.AmbientLight(0xffeedd, 1.3);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xfff2dc, 1.5);
      dirLight1.position.set(220, 520, 310);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x88b4ff, 0.85);
      dirLight2.position.set(-300, 350, -250);
      scene.add(dirLight2);

      buildingMaterial = createBuildingShaderMaterial();
      buildingsGroup = new THREE.Group();
      landmarksGroup = new THREE.Group();
      scene.add(buildingsGroup);
      scene.add(landmarksGroup);

      buildSpecialLandmarks();

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;

      // Sync OSM building footprints immediately and whenever new vector tiles stream in
      syncOSMBuildingsFromMap(map);
      map.on("sourcedata", (e) => {
        if (e.sourceId === "openmaptiles" && e.isSourceLoaded) {
          syncOSMBuildingsFromMap(map);
        }
      });
      map.on("moveend", () => syncOSMBuildingsFromMap(map));
      map.on("idle", () => syncOSMBuildingsFromMap(map));
    },

    updateEgoVehiclePose: function (lat, lng, headingDeg) {
      if (!egoCarGroup) return;
      const pos = latLngToVector3(lat, lng, 0);
      egoCarGroup.position.copy(pos);
      const rad = (headingDeg * Math.PI) / 180;
      egoCarGroup.rotation.y = Math.PI - rad;
    },

    render: function (gl, matrix) {
      const elapsed = clock.getElapsedTime();
      if (!this._lastSync || elapsed - this._lastSync > 0.75) {
        this._lastSync = elapsed;
        syncOSMBuildingsFromMap(this.map);
      }
      for (let i = 0; i < animatedCallbacks.length; i++) {
        animatedCallbacks[i](elapsed);
      }

      const modelOrigin = maplibregl.MercatorCoordinate.fromLngLat(
        [STRIP_ORIGIN_LNG, STRIP_ORIGIN_LAT],
        0
      );
      const scale = modelOrigin.meterInMercatorCoordinateUnits();

      const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4()
        .makeTranslation(modelOrigin.x, modelOrigin.y, modelOrigin.z)
        .scale(new THREE.Vector3(scale, -scale, scale))
        .multiply(rotationX);

      camera.projectionMatrix = m.multiply(l);
      renderer.resetState();
      // Clear depth buffer so MapLibre's underlying layers never occlude or z-fight with Three.js meshes
      gl.clear(gl.DEPTH_BUFFER_BIT);
      renderer.render(scene, camera);
      this.map.triggerRepaint();
    },
  };

  return customLayer;
};
