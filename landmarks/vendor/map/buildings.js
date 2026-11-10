// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { latLonToXZ } from '../core/data.js';
import { SHADOW_PARS, shadowUniforms } from '../core/shadows.js';
import { theme } from '../core/theme.js';
import { Chunked, hash, ringArea } from './geom.js';
import { FLOOR_H, facadeTextures, Layer, STORE_H, TILE_U, TILE_V } from './facades.js';
import { ORDER } from './materials.js';
import { ORIGIN, PLACES, placeXZ } from '../places.js';
export var Style = /*#__PURE__*/ function(Style) {
    Style[Style["Plain"] = 0] = "Plain";
    Style[Style["Homes"] = 1] = "Homes";
    Style[Style["Tower"] = 2] = "Tower";
    Style[Style["Podium"] = 3] = "Podium";
    Style[Style["Glass"] = 4] = "Glass";
    Style[Style["Garage"] = 5] = "Garage";
    Style[Style["Bands"] = 6] = "Bands";
    Style[Style["Pilasters"] = 7] = "Pilasters";
    Style[Style["Construction"] = 8] = "Construction";
    Style[Style["Grid"] = 9] = "Grid";
    Style[Style["Neon"] = 10] = "Neon";
    Style[Style["Facade"] = 11] = "Facade";
    return Style;
}({});
export const RESORT_LOOKS = [
    {
        re: /bellagio/i,
        tint: '#f0e2c6',
        k: 0.7,
        style: 7,
        glow: '#ffd9a0',
        glowK: 0.8,
        roof: '#c9a77a'
    },
    {
        re: /caesars|augustus|octavius|palace tower|forum tower|nobu/i,
        tint: '#f4efe4',
        k: 0.72,
        style: 7,
        glow: '#fff1d6',
        glowK: 0.9,
        roof: '#e9e2d2'
    },
    {
        re: /flamingo/i,
        tint: '#ff4fa3',
        k: 0.66,
        style: 10,
        glow: '#ff5cc4',
        glowK: 1.2,
        podium: 10
    },
    {
        re: /wynn|encore/i,
        tint: '#a8743e',
        k: 0.85,
        style: 6,
        glow: '#ffc76b',
        glowK: 1.1,
        roof: '#6d4d2c'
    },
    {
        re: /hard rock|mirage/i,
        tint: '#b49a6c',
        k: 0.6,
        style: 8,
        glow: '#ffffff',
        glowK: 0.6
    },
    {
        re: /venetian|palazzo/i,
        tint: '#eedfc2',
        k: 0.66,
        style: 7,
        glow: '#ffdca6',
        glowK: 0.7,
        roof: '#c98a5c'
    },
    {
        re: /treasure island|\bti\b/i,
        tint: '#f0d6ae',
        k: 0.75,
        style: 7,
        glow: '#ff7a6a',
        glowK: 1.15,
        roof: '#e7c9a0'
    },
    {
        re: /paris/i,
        tint: '#eedcbd',
        k: 0.62,
        style: 7,
        glow: '#ffe2b0',
        glowK: 0.8,
        roof: '#4f78d8'
    },
    {
        re: /signature at mgm|signature/i,
        tint: '#aebdd0',
        k: 0.6,
        style: 4,
        glow: '#e4ecff',
        glowK: 0.5
    },
    {
        re: /mgm grand/i,
        tint: '#1fa36a',
        k: 0.82,
        style: 6,
        glow: '#3dff9a',
        glowK: 1.25,
        roof: '#1c6e4b'
    },
    {
        re: /mandalay|delano|four seasons/i,
        tint: '#c9963a',
        k: 0.85,
        style: 6,
        glow: '#ffcf6a',
        glowK: 0.9,
        roof: '#8a6a2a'
    },
    {
        re: /excalibur/i,
        tint: '#f7f3eb',
        k: 0.78,
        style: 2,
        podium: 2,
        roof: '#c41e28',
        glow: '#ffe7b0',
        glowK: 0.85,
        paint: Layer.Masonry
    },
    {
        re: /new york|nyny/i,
        tint: '#d4c3a3',
        k: 0.92,
        style: 2,
        roof: '#5e7a6e',
        glow: '#ffe2a8',
        glowK: 0.9,
        vary: [
            '#dfd3be',
            '#c78363',
            '#7f9894',
            '#b56348',
            '#d4be98',
            '#8d99a6',
            '#a66b4f',
            '#e6dcc8'
        ],
        paint: Layer.Masonry
    },
    {
        re: /t-mobile arena/i,
        tint: '#b8733f',
        k: 0.85,
        style: 10,
        glow: '#ff2a85',
        glowK: 1.15
    },
    {
        re: /aria|vdara|waldorf|crystals|veer/i,
        tint: '#9fb8d8',
        k: 0.6,
        style: 4,
        glow: '#cfe3ff',
        glowK: 0.6
    },
    {
        re: /cosmopolitan|chelsea|boulevard tower/i,
        tint: '#5f7699',
        k: 0.62,
        style: 4,
        glow: '#b8d0ff',
        glowK: 0.7
    },
    {
        re: /planet hollywood|elara/i,
        tint: '#b694e6',
        k: 0.5,
        style: 9,
        glow: '#d36bff',
        glowK: 0.9
    },
    {
        re: /park mgm|nomad/i,
        tint: '#d9c59c',
        k: 0.6,
        style: 2,
        paint: Layer.Masonry
    },
    {
        re: /horseshoe|bally/i,
        tint: '#ecd9b5',
        k: 0.5,
        style: 2,
        glow: '#ffd27a',
        glowK: 0.6
    },
    {
        re: /linq|quad/i,
        tint: '#8db6d6',
        k: 0.55,
        style: 9,
        glow: '#6fd0ff',
        glowK: 0.7
    },
    {
        re: /harrah/i,
        tint: '#dfb39b',
        k: 0.55,
        style: 2,
        glow: '#ffb27a',
        glowK: 0.6
    },
    {
        re: /cromwell/i,
        tint: '#a8916c',
        k: 0.55,
        style: 4
    },
    {
        re: /resorts world/i,
        tint: '#c22a4c',
        k: 0.78,
        style: 9,
        glow: '#ff3d6e',
        glowK: 1.1
    },
    {
        re: /fontainebleau/i,
        tint: '#2f6fd0',
        k: 0.75,
        style: 4,
        glow: '#7fb4ff',
        glowK: 0.9
    },
    {
        re: /sahara/i,
        tint: '#e0c79a',
        k: 0.5,
        style: 2,
        glow: '#ff9b6a',
        glowK: 0.6
    },
    {
        re: /circus circus/i,
        tint: '#f0a8bc',
        k: 0.8,
        style: 2,
        glow: '#ff5fb0',
        glowK: 0.9,
        paint: Layer.Masonry
    },
    {
        re: /\brio\b|masquerade|ipanema|voodoo/i,
        tint: '#9c2f4a',
        k: 0.72,
        style: 9,
        glow: '#ff4060',
        glowK: 1.0,
        vary: [
            '#9c2f4a',
            '#2f4f9c'
        ]
    },
    {
        re: /palms/i,
        tint: '#4aaec4',
        k: 0.6,
        style: 4,
        glow: '#7ff0ff',
        glowK: 0.8
    },
    {
        re: /virgin/i,
        tint: '#e9e9ee',
        k: 0.45,
        style: 2
    },
    {
        re: /trump/i,
        tint: '#d9b25c',
        k: 0.85,
        style: 6,
        glow: '#ffd36b',
        glowK: 0.7
    },
    {
        re: /allegiant/i,
        tint: '#121418',
        k: 0.92,
        style: 10,
        glow: '#d6dbe6',
        glowK: 0.6
    },
    {
        re: /convention center|lvcc/i,
        tint: '#c9d3e0',
        k: 0.3,
        style: 3
    },
    {
        re: /golden nugget/i,
        tint: '#e6c35c',
        k: 0.6,
        style: 6,
        glow: '#ffd36b',
        glowK: 0.8
    },
    {
        re: /plaza hotel|the plaza/i,
        tint: '#e8e2d4',
        k: 0.45,
        style: 2
    },
    {
        re: /circa/i,
        tint: '#3e4a62',
        k: 0.6,
        style: 4,
        glow: '#ff9f5a',
        glowK: 0.8
    },
    {
        re: /four queens|binion|fremont hotel|golden gate|el cortez|d las vegas|downtown grand/i,
        tint: '#e9dfc6',
        k: 0.45,
        style: 10,
        glow: '#ffc06a',
        glowK: 0.9
    },
    {
        re: /westgate/i,
        tint: '#e7e1d5',
        k: 0.45,
        style: 2
    },
    {
        re: /\bstrat\b|stratosphere/i,
        tint: '#e9edf3',
        k: 0.45,
        style: 2
    },
    {
        re: /luxor/i,
        tint: '#181d28',
        k: 0.94,
        style: 4,
        glow: '#ffd480',
        glowK: 0.65,
        roof: '#12151e'
    },
    {
        re: /new las vegas stadium|ballpark/i,
        tint: '#8a8478',
        k: 0.5,
        style: 8,
        glow: '#ffffff',
        glowK: 0.5
    }
];
export const LANDMARK_SKIP = /^(the campanile|bellagio las vegas|bellagio spa tower|sphere|msg sphere|luxor( las vegas)?|the strat tower|stratosphere tower|high roller|eiffel tower|paris balloon|new las vegas stadium|allegiant stadium|hard rock las vegas guitar tower|veer towers( east| west)?)$/i;
const HERO_TOWERS = [
    [
        750,
        -2062,
        25,
        150
    ],
    [
        809,
        -1153,
        25,
        150
    ],
    [
        887,
        -1467,
        25,
        150
    ],
    [
        1353,
        -2413,
        30,
        150
    ],
    [
        242,
        -943,
        30,
        90
    ],
    [
        -160,
        347,
        15,
        100
    ],
    [
        -164,
        708,
        25,
        150
    ],
    [
        -2,
        728,
        25,
        150
    ],
    [
        43,
        665,
        25,
        150
    ],
    [
        -24,
        2720,
        25,
        100
    ],
    [
        -146,
        1285,
        25,
        90
    ],
    [
        14,
        980,
        24,
        90
    ],
    [
        -40,
        983,
        24,
        90
    ]
];
const OPEN_LIMIT = 33;
const SKIP_AT = [
    [
        36.10283,
        -115.17818,
        96
    ]
];
const POS_LOOKS = [];
export const landmarkFootprints = [];
const GENERIC = [
    '#2f5578',
    '#8e4a36',
    '#b8b4aa',
    '#43474e',
    '#c9b49a',
    '#a4a7ab',
    '#7f4436',
    '#3a6a7a'
];
function facadeFor(b, r) {
    if (/house|detached|residential|apartments|terrace|bungalow|semidetached/.test(b.b ?? '')) return 11 + Layer.Residential;
    const pick = (...l)=>11 + l[Math.floor(r * l.length)];
    if (b.h > 60) return pick(Layer.Glass, Layer.Modern, Layer.Office, Layer.Office, Layer.Residential);
    if (b.h > 24) return pick(Layer.Glass, Layer.Office, Layer.Modern, Layer.Brick, Layer.Residential);
    return pick(Layer.Brick, Layer.Office, Layer.Modern, Layer.Residential, Layer.Glass, Layer.Brick);
}
const VERT = `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec4 ext;     // u (m along walls), top height, seed, style*10 + tint strength*0.9
  attribute vec4 aux;     // glow rgb, glow strength
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vTint;
  varying vec4 vExt;
  varying vec4 vAux;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vW = wp.xyz;
    vTint = color;
    vExt = ext;
    vAux = aux;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const FRAG = `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uWall, uRoof, uWinLit, uWinDark;
  uniform vec3 uSunDir;
  uniform float uSun, uAmbient, uNight;
  uniform vec3 uSunTint, uAmbientTint, uHorizon;
  uniform sampler2DArray uFacade, uFacadeNight;
  uniform sampler2D uCut;
  uniform vec2 uCutO, uCutS;
  uniform float uTileU[8];
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vTint;
  varying vec4 vExt;
  varying vec4 vAux;
  ${SHADOW_PARS}

  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  // anti-aliased band: 1 inside [a,b] of a repeating unit, fades to its coverage when tiny on screen
  float band(float x, float a, float b, float fw) {
    float f = fract(x);
    float s = smoothstep(a - fw, a + fw, f) * (1.0 - smoothstep(b - fw, b + fw, f));
    return mix(b - a, s, clamp(1.0 - fw * 2.5, 0.0, 1.0));
  }

  void main() {
    // openings for valet drives: green takes out a whole low podium, red a portal at street level
    vec4 cut = texture2D(uCut, (vW.xz - uCutO) / uCutS);
    if ((cut.g > 0.5 && vExt.y < ${OPEN_LIMIT.toFixed(1)}) || (cut.r > 0.5 && vW.y < 6.0)) discard;
    vec3 n = normalize(vN);
    float style = floor(vExt.w / 10.0 + 0.001);
    float tintK = clamp(fract(vExt.w / 10.0) * 10.0 / 9.0, 0.0, 1.0);
    vec3 glow = vAux.rgb;
    float gk = vAux.a;
    bool roof = n.y > 0.5;
    float night = uNight;
    vec3 tintN = vTint * mix(0.58, 1.0, 1.0 - night);
    vec3 base = roof ? mix(uRoof, tintN * 1.05, tintK * 0.8) : mix(uWall, tintN, tintK);

    float hemi = 0.74 + 0.26 * n.y;
    float key = max(dot(n, uSunDir), 0.0);
    vec3 light = (uAmbient * hemi * uAmbientTint + uSun * key * uSunTint + (roof ? 0.06 : 0.0)) * shadowAt(vW);
    vec3 c = base * light;
    float topH = vExt.y;
    c *= mix(0.68, 1.0, smoothstep(0.0, 9.0, vW.y));
    c *= mix(1.0, 1.1, smoothstep(0.0, 1.0, vW.y / max(topH, 1.0)) * (1.0 - night * 0.5));

    if (roof) {
      // membrane panels, weathering, and rooftop plant, fading to their average when tiny on screen
      vec2 q = vW.xz;
      float fwq = fwidth(q.x) + fwidth(q.y);
      float near = clamp(1.0 - fwq * 0.35, 0.0, 1.0);
      c *= mix(1.0, 0.95 + 0.1 * h21(floor(q / 0.7) + vExt.z), near);
      c *= mix(1.0, 0.97 + 0.06 * h21(floor(q / 6.0) + vExt.z), near);
      vec2 cell = floor(q / 18.0), f = fract(q / 18.0) - 0.5;
      float size = 0.05 + 0.07 * h21(cell + 3.0);
      float unit = step(0.68, h21(cell + 7.0)) * step(max(abs(f.x), abs(f.y)), size);
      float lip = unit * smoothstep(size - 0.015, size, max(abs(f.x), abs(f.y)));
      c = mix(c, c * (1.25 - lip * 0.55), unit * near);
    }

    if (!roof && abs(n.y) < 0.3) {
      float u = vExt.x;
      float y = vW.y;
      float onFacade = step(3.0, y) * step(y, topH - 0.8);
      // resorts are washed by warm uplights at night
      c += glow * night * gk * 0.22 * (1.0 - smoothstep(0.0, 45.0, y)) * tintK;

      if (style >= 11.0) {
        // painted facades: a storefront band on the street, floors above it, a parapet at the top
        float layer = style - 11.0;
        bool store = y < ${STORE_H.toFixed(1)} && vExt.y > 6.0 && layer != ${Layer.Residential.toFixed(1)};
        float at = store ? ${Layer.Store.toFixed(1)} : layer;
        vec2 uv = store ? vec2((u + vExt.z) / uTileU[5], 1.0 - y / ${STORE_H.toFixed(1)})
                        : vec2((u + vExt.z) / uTileU[int(layer)], 1.0 - y / ${TILE_V.toFixed(1)});
        vec3 alb = texture(uFacade, vec3(uv, at), 0.6).rgb;
        alb = mix(alb, alb * vTint, tintK * 0.92);
        alb *= 0.9 + 0.2 * fract(vExt.z * 3.7);
        float parapet = smoothstep(topH - 0.9, topH - 0.8, y);
        alb = mix(alb, uWall * 1.05, parapet);
        c = alb * light * mix(1.0, 0.34, night) * mix(0.68, 1.0, smoothstep(0.0, 9.0, y));
        if (layer == ${Layer.Glass.toFixed(1)} && !store) {
          vec3 v = normalize(cameraPosition - vW);
          float f = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          c = mix(c, uHorizon * (1.0 - night * 0.7), f * 0.55);
        }
        // one painted tile repeats across a tower, so each window also rolls its own switch per building
        vec2 cellUv = uv * vec2(8.0, 4.0);
        float cellFw = max(fwidth(cellUv.x), fwidth(cellUv.y));
        float on = store ? 1.0 : mix(0.4, step(h21(floor(cellUv) + vExt.z), 0.45), clamp(1.0 - cellFw * 1.5, 0.0, 1.0));
        c += texture(uFacadeNight, vec3(uv, at), 0.6).rgb * night * (1.0 - parapet) * on * 0.8;
      } else if (style == 6.0) {
        // MGM / Wynn / Mandalay: continuous glowing floor lines across the whole facade
        float fy = y / 3.4;
        float fw = fwidth(fy);
        float line = band(fy, 0.0, 0.16, fw) * onFacade;
        vec3 glass = mix(c, c * 0.42 + tintN * 0.1, 0.75);
        c = mix(c, glass, onFacade * 0.7);
        vec3 lit = glow * (1.15 + 0.25 * h21(vec2(floor(fy), vExt.z)));
        c = mix(c, mix(c * 1.25 + tintN * 0.15, lit, night), line * mix(0.45, gk, night));
      } else if (style == 7.0) {
        // TI / Caesars / Bellagio / Venetian: lit pilasters + warm window grid
        float fu = u / 9.0, fy = y / 3.3;
        float pil = band(fu, 0.0, 0.1, fwidth(fu)) * onFacade;
        vec2 g = vec2(u / 2.4, fy);
        vec2 fw = fwidth(g);
        float win = band(g.x, 0.22, 0.78, fw.x) * band(g.y, 0.3, 0.78, fw.y) * onFacade * (1.0 - pil);
        float lit = mix(0.5, step(h21(floor(g) + vExt.z), 0.5), clamp(1.0 - max(fw.x, fw.y) * 2.0, 0.0, 1.0));
        c = mix(c, mix(c, uWinDark, 0.68), win * (1.0 - night));
        c = mix(c, uWinLit * (0.6 + 0.4 * h21(floor(g) * 1.3)), win * lit * night * 0.85);
        c = mix(c, glow * 1.2, pil * night * gk);
        c = mix(c, c * 1.15, pil * (1.0 - night));
      } else if (style == 8.0) {
        // construction: concrete slabs, scaffold grid, sparse work lights
        float fy = y / 3.6, fu = u / 4.0;
        vec2 fw = vec2(fwidth(fu), fwidth(fy));
        float slab = band(fy, 0.0, 0.14, fw.y);
        float scaf = max(band(fu, 0.0, 0.05, fw.x), band(fy * 2.0, 0.0, 0.06, fw.y * 2.0));
        c = mix(c, vec3(0.55, 0.55, 0.53) * (uAmbient + uSun * key), slab * 0.5 * onFacade);
        c = mix(c, vec3(0.75, 0.6, 0.3) * (uAmbient + uSun * key), scaf * 0.35 * onFacade);
        float work = step(0.965, h21(floor(vec2(fu, fy) * vec2(0.5, 1.0)) + vExt.z)) * onFacade;
        c = mix(c, vec3(1.0, 0.97, 0.88) * 1.4, work * night * band(fy, 0.3, 0.8, fw.y));
      } else if (style == 9.0) {
        // Rio / Resorts World / LINQ: glass with a lit mullion grid
        vec2 g = vec2(u / 3.0, y / 3.4);
        vec2 fw = fwidth(g);
        float grid = max(band(g.x, 0.0, 0.08, fw.x), band(g.y, 0.0, 0.1, fw.y)) * onFacade;
        float pane = (1.0 - grid) * onFacade;
        float lit = mix(0.45, step(h21(floor(g) + vExt.z), 0.45), clamp(1.0 - max(fw.x, fw.y) * 2.0, 0.0, 1.0));
        c = mix(c, c * 0.7 + tintN * 0.15, pane * 0.6);
        c = mix(c, uWinLit * 0.85, pane * lit * night * 0.55);
        c = mix(c, glow * 1.1, grid * night * gk * 0.8);
      } else if (style == 10.0) {
        // neon podium (Flamingo, T-Mobile, Fremont casinos): glowing crown + vertical fins
        float crown = smoothstep(topH - 3.2, topH - 2.6, y) * (1.0 - smoothstep(topH - 1.2, topH - 0.8, y));
        float base = smoothstep(4.0, 4.4, y) * (1.0 - smoothstep(5.4, 5.8, y));
        float fu = u / 5.0;
        float fin = band(fu, 0.0, 0.12, fwidth(fu)) * step(6.0, y) * step(y, topH - 3.5);
        c = mix(c, glow * 1.3, (crown + base) * mix(0.25, 1.0, night) * gk);
        c = mix(c, glow * 0.9, fin * night * gk * 0.6);
        // tall neon towers (Flamingo) still get windows
        if (topH > 30.0) {
          vec2 g2 = vec2(u / 6.0, y / 3.35);
          vec2 fw2 = fwidth(g2);
          float w2 = band(g2.x, 0.06, 0.94, fw2.x) * band(g2.y, 0.34, 0.7, fw2.y) * onFacade;
          float lit2 = mix(0.45, step(h21(floor(g2) + vExt.z), 0.45), clamp(1.0 - max(fw2.x, fw2.y) * 2.0, 0.0, 1.0));
          c = mix(c, mix(glow, uWinLit, 0.4) * 1.1, w2 * lit2 * night * 0.85);
          c = mix(c, mix(c, uWinDark, 0.35), w2 * (1.0 - night));
        }
      } else if (style == 1.0 || style == 2.0 || style == 4.0) {
        float floorH = style == 1.0 ? 3.0 : 3.35;
        float bayW = style == 4.0 ? 7.5 : style == 2.0 ? 6.0 : 4.5;
        vec2 g = vec2(u / bayW, y / floorH);
        vec2 fw = fwidth(g);
        float aa = clamp(1.0 - max(fw.x, fw.y) * 1.6, 0.0, 1.0);
        vec2 wmin = style == 4.0 ? vec2(0.03, 0.3) : style == 2.0 ? vec2(0.06, 0.34) : vec2(0.26, 0.3);
        vec2 wmax = style == 4.0 ? vec2(0.97, 0.72) : style == 2.0 ? vec2(0.94, 0.7) : vec2(0.74, 0.78);
        float inWin = band(g.x, wmin.x, wmax.x, fw.x) * band(g.y, wmin.y, wmax.y, fw.y) * onFacade;
        float rate = style == 1.0 ? 0.12 : style == 4.0 ? (tintK > 0.84 ? 0.14 : 0.34) : 0.3;
        float lit = mix(rate, step(h21(floor(g) + vExt.z * 17.0), rate), aa);
        float warm = h21(floor(g).yx + vExt.z * 3.1);
        vec3 wl = mix(uWinLit, vec3(1.0, 0.93, 0.82), step(0.7, warm));
        wl = mix(wl, glow * 1.1, gk * 0.45 * step(0.45, warm));
        float bright = (0.55 + 0.45 * h21(floor(g) * 1.7 + 3.0)) * mix(0.62, 1.0, aa); // far façades average down, not to a flat peach wall
        c = mix(c, mix(c, uWinDark, 0.72), inWin * (1.0 - night));
        c = mix(c, mix(c * 0.62, wl * bright, lit), inWin * night * mix(0.45, 1.0, aa));
      } else if (style == 3.0) {
        float b = smoothstep(4.2, 4.6, y) * (1.0 - smoothstep(5.2, 5.6, y));
        c += mix(vTint, glow, step(0.01, gk)) * b * night * 0.6;
      }
    }
    gl_FragColor = vec4(c, 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;
export function buildingMaterial(cut) {
    const tex = facadeTextures();
    return new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            ...shadowUniforms,
            uWall: {
                value: theme.c('wall')
            },
            uRoof: {
                value: theme.c('roof')
            },
            uWinLit: {
                value: theme.c('windowLit')
            },
            uWinDark: {
                value: theme.c('windowDark')
            },
            uSunDir: theme.uniforms.uSunDir,
            uSun: theme.uniforms.uSun,
            uAmbient: theme.uniforms.uAmbient,
            uSunTint: theme.uniforms.uSunTint,
            uAmbientTint: theme.uniforms.uAmbientTint,
            uNight: theme.uniforms.uNight,
            uHorizon: {
                value: theme.c('skyHorizon')
            },
            uFacade: {
                value: tex.color
            },
            uFacadeNight: {
                value: tex.night
            },
            uTileU: {
                value: TILE_U
            },
            uCut: {
                value: cut.mask
            },
            uCutO: {
                value: cut.maskOrigin
            },
            uCutS: {
                value: cut.maskSize
            }
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        vertexColors: true,
        fog: true
    });
}
export function makeHeightIndex(data, extra = []) {
    const cell = 50, grid = new Map();
    for (const [x, z, h] of extra){
        const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push([
            x,
            z,
            h
        ]);
    }
    for (const b of data.buildings){
        const [x, z] = centroid(b.pts);
        const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push([
            x,
            z,
            b.h
        ]);
    }
    return (x, z, r)=>{
        let h = 0;
        const n = Math.ceil(r / cell);
        for(let i = -n; i <= n; i++)for(let j = -n; j <= n; j++)for (const [bx, bz, bh] of grid.get(`${Math.floor(x / cell) + i},${Math.floor(z / cell) + j}`) ?? [])if (Math.hypot(bx - x, bz - z) < r) h = Math.max(h, bh);
        return h;
    };
}
function inside(pt, poly) {
    let c = false;
    for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if (zi > pt[1] !== zj > pt[1] && pt[0] < (xj - xi) * (pt[1] - zi) / (zj - zi) + xi) c = !c;
    }
    return c;
}
function centroid(r) {
    let x = 0, z = 0;
    for (const p of r){
        x += p[0];
        z += p[1];
    }
    return [
        x / r.length,
        z / r.length
    ];
}
export function buildBuildings(data, valets) {
    const group = new THREE.Group();
    group.name = 'buildings';
    const ch = new Chunked(1000);
    const resorts = data.pois.filter((p)=>p.k === 'resort' || p.k === 'hotel' || p.k === 'attraction');
    for (const p of PLACES)if (p.badge) {
        const [x, z] = placeXZ(p);
        resorts.unshift({
            n: p.name,
            k: 'resort',
            x,
            z
        });
    }
    const skipAt = SKIP_AT.map(([la, lo, r])=>[
            ...latLonToXZ(ORIGIN, la, lo),
            r
        ]);
    const posLooks = POS_LOOKS.map(([la, lo, r, n, h])=>[
            ...latLonToXZ(ORIGIN, la, lo),
            r,
            n,
            h
        ]);
    const owned = [
        ...landmarkFootprints
    ];
    for (const b of data.buildings)if (b.name && LANDMARK_SKIP.test(b.name.trim()) && !b.part) owned.push(b.pts);
    const named = [];
    const t = new THREE.Color(), g = new THREE.Color();
    let i = 0;
    for (const b of data.buildings){
        i++;
        if (b.name && LANDMARK_SKIP.test(b.name.trim())) continue;
        if (valets.canopies.has(b)) continue;
        const ring = b.pts;
        const area = Math.abs(ringArea(ring));
        const c = centroid(ring);
        if (HERO_TOWERS.some(([x, z, r, minH])=>b.h >= minH && Math.hypot(c[0] - x, c[1] - z) < r)) continue;
        if (skipAt.some(([x, z, r])=>Math.hypot(c[0] - x, c[1] - z) < r)) continue;
        if (owned.some((poly)=>inside(c, poly))) continue;
        const pos = posLooks.find(([x, z, r])=>Math.hypot(c[0] - x, c[1] - z) < r);
        let h = b.h;
        const isGarage = b.b === 'parking' || /parking|garage/i.test(b.name ?? '');
        const look = pos ? RESORT_LOOKS.find((l)=>l.re.test(pos[3])) : isGarage ? undefined : lookFor(b, c, resorts);
        if (pos?.[4]) h = Math.max(h, pos[4]);
        let style = look?.style ?? styleFor(b, area);
        const texturable = style === 2 || style === 1 || style === 4 || style === 0 || style === 3;
        const painted = texturable && !isGarage && h >= FLOOR_H;
        if (painted) {
            const low = look && style === 3 ? 11 + (look.paint ?? Layer.Office) : null;
            style = look?.paint !== undefined ? 11 + look.paint : style === 4 ? 11 + Layer.Glass : low ?? facadeFor(b, hash(i * 3));
        }
        let k;
        if (look) {
            const pal = look.vary;
            t.set(pal ? pal[Math.floor(hash(i * 7) * pal.length)] : look.tint);
            k = look.k;
        } else if (b.col && /^#|^[a-z]+$/i.test(b.col)) {
            t.set(safeColor(b.col));
            k = 0.3;
        } else {
            t.set(GENERIC[Math.floor(hash(i * 13) * GENERIC.length)]);
            k = painted ? 0 : b.b === 'house' || b.b === 'residential' ? 0.55 : 0.82;
        }
        if (b.b === 'construction' && !look) {
            style = 8;
            t.set('#8d8a82');
            k = 0.5;
        }
        g.set(look?.glow ?? '#000000');
        const gk = look?.glowK ?? 0;
        const roofTint = look?.roof ? new THREE.Color(look.roof) : null;
        if (b.name && b.h > 30) named.push({
            name: b.name,
            c,
            h: b.h,
            area
        });
        extrude(ch.at(c[0], c[1]), ring, b.mh ?? 0, h, [
            t.r,
            t.g,
            t.b
        ], hash(i) * 50, style, k, roofTint, [
            g.r,
            g.g,
            g.b,
            gk
        ]);
    }
    const mat = buildingMaterial(valets);
    for (const m of ch.meshes(mat, 'bldg', ORDER.solid))group.add(m);
    return {
        group,
        index: {
            named
        }
    };
}
function safeColor(s) {
    try {
        return '#' + new THREE.Color(s).getHexString();
    } catch  {
        return '#ffffff';
    }
}
function styleFor(b, area) {
    const t = b.b ?? '';
    if (t === 'construction') return 8;
    if (t === 'parking') return 5;
    if (/house|detached|residential|apartments|terrace|bungalow|semidetached/.test(t)) return b.h > 18 ? 2 : 1;
    if (b.h > 28) return 2;
    if (area > 6000 && b.h < 25) return 3;
    if (/garage|shed|roof|carport/.test(t)) return 3;
    return b.h >= 5 ? 2 : 0;
}
function lookFor(b, c, resorts) {
    if (b.name) {
        const l = RESORT_LOOKS.find((x)=>x.re.test(b.name));
        if (l) {
            if (b.h < 26 && l.style !== 10 && l.style !== 8) return {
                ...l,
                k: l.k * 0.7,
                style: l.podium ?? 3
            };
            return l;
        }
    }
    if (b.h < 14 && Math.abs(ringArea(b.pts)) < 3000) return undefined;
    let l, bd = 300;
    for (const p of resorts){
        const d = Math.hypot(p.x - c[0], p.z - c[1]);
        if (d >= bd) continue;
        const m = RESORT_LOOKS.find((x)=>x.re.test(p.n));
        if (m) {
            bd = d;
            l = m;
        }
    }
    if (!l) return undefined;
    if (b.b === 'construction') return l;
    return b.h < 30 ? {
        ...l,
        k: l.k * 0.6,
        style: l.podium ?? 3
    } : l;
}
function extrude(s, ring, y0, y1, tint, seed, style, k, roofTint, aux) {
    const r = ringArea(ring) > 0 ? ring : ring.slice().reverse();
    const e = (u)=>[
            u,
            y1,
            seed,
            style * 10 + Math.min(0.99, k) * 0.9
        ];
    let u = 0;
    for(let i = 0; i < r.length; i++){
        const a = r[i], b = r[(i + 1) % r.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
        if (L < 0.05) continue;
        const n = [
            dz / L,
            0,
            -dx / L
        ];
        const v0 = s.vert(a[0], y0, a[1], n, tint, e(u));
        const v1 = s.vert(b[0], y0, b[1], n, tint, e(u + L));
        const v2 = s.vert(b[0], y1, b[1], n, tint, e(u + L));
        const v3 = s.vert(a[0], y1, a[1], n, tint, e(u));
        s.aux.push(...aux, ...aux, ...aux, ...aux);
        s.idx.push(v0, v2, v1, v0, v3, v2);
        u += L;
    }
    const contour = r.map((p)=>new THREE.Vector2(p[0], p[1]));
    let tris;
    try {
        tris = THREE.ShapeUtils.triangulateShape(contour, []);
    } catch  {
        return;
    }
    const rt = roofTint ? [
        roofTint.r,
        roofTint.g,
        roofTint.b
    ] : tint;
    const ek = [
        0,
        y1,
        seed,
        style * 10 + (roofTint ? 0.95 : 0) * 0.9
    ];
    const base = s.count;
    for (const p of r){
        s.vert(p[0], y1, p[1], [
            0,
            1,
            0
        ], rt, ek);
        s.aux.push(...aux);
    }
    for (const t of tris)s.idx.push(base + t[0], base + t[2], base + t[1]);
}
