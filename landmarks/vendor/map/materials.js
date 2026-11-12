// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { SHADOW_PARS, shadowUniforms } from '../core/shadows.js';
import { theme } from '../core/theme.js';
import { surfaceFor } from './surfaces.js';
export const ORDER = {
    ground: 0,
    landuse: 10,
    water: 20,
    sidewalk: 30,
    road: 40,
    paint: 50,
    label: 60,
    solid: 100
};
export function themed(m, key) {
    m.color = theme.c(key);
    return m;
}
const flatCache = new Map();
const FLAT_VERT = `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const FLAT_FRAG = `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  uniform float uOpacity, uTile, uFadeOn, uGrain, uWeathering, uTone;
  uniform vec4 uFadeRect;
  uniform vec3 uFar;
  uniform sampler2D uMap;
  uniform vec3 uMapAvg;
  varying vec3 vW;
  ${SHADOW_PARS}
  #ifdef DECK_TINT
    uniform vec3 uDeckColor;
  #endif
  #ifdef ROAD_CORRIDOR_POINTS
    uniform vec2 uCorridorPath[ROAD_CORRIDOR_POINTS], uCorridorFade;
    uniform vec4 uCorridorBounds;
    uniform vec3 uCorridorColor;
    float corridorWeight(vec2 p) {
      if (any(lessThan(p, uCorridorBounds.xy)) || any(greaterThan(p, uCorridorBounds.zw))) return 0.0;
      float reach = uCorridorFade.y;
      float closest = reach * reach;
      for (int i = 0; i < ROAD_CORRIDOR_POINTS - 1; ++i) {
        vec2 a = uCorridorPath[i], b = uCorridorPath[i + 1];
        if (p.y < min(a.y, b.y) - reach || p.y > max(a.y, b.y) + reach) continue;
        vec2 span = b - a;
        vec2 delta = p - a - span * clamp(dot(p - a, span) / dot(span, span), 0.0, 1.0);
        closest = min(closest, dot(delta, delta));
      }
      return 1.0 - smoothstep(uCorridorFade.x, reach, sqrt(closest));
    }
  #endif
  void main() {
    // the texture carries grain and joints only; its average is divided out so the theme sets the colour
    vec3 c = uColor * uTone;
    float pavement = 0.0;
    #ifdef ROAD_CORRIDOR_POINTS
      pavement = corridorWeight(vW.xz);
      c = mix(c, uCorridorColor * uTone, pavement);
    #endif
    #ifdef DECK_TINT
      c = mix(c, uDeckColor * uTone, smoothstep(0.2, 4.5, vW.y));
    #endif
    if (uTile > 0.0) {
      c *= mix(vec3(1.0), texture2D(uMap, vW.xz / uTile).rgb / uMapAvg, uGrain * (1.0 - 0.25 * pavement));
      // a second, far larger sampling breaks up the repeat: resurfaced patches and weathering
      c *= mix(vec3(1.0), texture2D(uMap, vW.zx / (uTile * 11.3)).rgb / uMapAvg, uWeathering * (1.0 - 0.48 * pavement));
    }
    if (uFadeOn > 0.5) {
      // the city gives way to open desert instead of stopping at the edge of the map data
      vec2 q = max(uFadeRect.xy - vW.xz, vW.xz - uFadeRect.zw);
      float out_ = length(max(q, vec2(0.0)));
      c = mix(c, uFar * (0.9 + 0.1 * texture2D(uMap, vW.xz / 900.0).r / uMapAvg.r), smoothstep(-260.0, 1100.0, out_ + min(max(q.x, q.y), 0.0)));
    }
    c *= shadowAt(vW);
    gl_FragColor = vec4(c, uOpacity);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;
export function surfaceMaterial(key, opts = {}) {
    const s = surfaceFor(opts.texture ?? key);
    const opacity = opts.opacity ?? 1;
    const corridor = opts.corridor;
    let corridorUniforms = {};
    if (corridor) {
        const xs = corridor.path.map(p => p[0]), zs = corridor.path.map(p => p[1]), radius = corridor.outerRadius;
        corridorUniforms = {
            uCorridorPath: { value: corridor.path.map(p => new THREE.Vector2(...p)) },
            uCorridorFade: { value: new THREE.Vector2(corridor.innerRadius, radius) },
            uCorridorBounds: { value: new THREE.Vector4(Math.min(...xs) - radius, Math.min(...zs) - radius, Math.max(...xs) + radius, Math.max(...zs) + radius) },
            uCorridorColor: { value: theme.c(corridor.color) }
        };
    }
    return new THREE.ShaderMaterial({
        defines: {
            ...(corridor ? { ROAD_CORRIDOR_POINTS: corridor.path.length } : {}),
            ...(opts.deckTint ? { DECK_TINT: 1 } : {})
        },
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            ...shadowUniforms,
            ...corridorUniforms,
            ...(opts.deckTint ? { uDeckColor: { value: theme.c(opts.deckTint) } } : {}),
            uColor: {
                value: theme.c(key)
            },
            uOpacity: {
                value: opacity
            },
            uTile: {
                value: s ? s.tile : 0
            },
            uGrain: {
                value: opts.grain ?? 0.55
            },
            uWeathering: {
                value: opts.weathering ?? 0.5
            },
            uTone: {
                value: opts.tone ?? 1
            },
            uMap: {
                value: s ? s.map : null
            },
            uMapAvg: {
                value: s ? s.avg : new THREE.Color(1, 1, 1)
            },
            uFadeOn: {
                value: opts.fadeRect ? 1 : 0
            },
            uFadeRect: {
                value: new THREE.Vector4(...opts.fadeRect ?? [
                    0,
                    0,
                    0,
                    0
                ])
            },
            uFar: {
                value: theme.c('sand')
            }
        },
        vertexShader: FLAT_VERT,
        fragmentShader: FLAT_FRAG,
        fog: true,
        side: THREE.DoubleSide,
        depthWrite: opts.depthWrite ?? false,
        transparent: opacity < 1,
        polygonOffset: opts.polygonOffset !== undefined,
        polygonOffsetFactor: opts.polygonOffset ?? 0,
        polygonOffsetUnits: (opts.polygonOffset ?? 0) * 2
    });
}
export function flatMaterial(key, opts = {}) {
    const k = key + (opts.opacity ?? '');
    let m = flatCache.get(k);
    if (!m) flatCache.set(k, m = surfaceMaterial(key, opts));
    return m;
}
const LIT_VERT = `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vN;
  varying vec3 vW;
  #ifdef USE_COLOR
    varying vec3 vC;
  #endif
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    #ifdef USE_INSTANCING
      wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    #else
      vN = normalize(mat3(modelMatrix) * normal);
    #endif
    vW = wp.xyz;
    #ifdef USE_COLOR
      vC = color;
    #endif
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const LIT_FRAG = `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uSun;
  uniform float uAmbient;
  uniform vec3 uSunTint;
  uniform vec3 uAmbientTint;
  uniform float uNight;
  uniform float uEmissive;
  uniform float uDim;
  varying vec3 vN;
  varying vec3 vW;
  #ifdef USE_COLOR
    varying vec3 vC;
  #endif
  ${SHADOW_PARS}
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 base = uColor;
    #ifdef USE_COLOR
      base *= vC;
    #endif
    float hemi = 0.72 + 0.28 * n.y;
    float key = max(dot(n, uSunDir), 0.0);
    vec3 c = base * (uAmbient * hemi * uAmbientTint + uSun * key * uSunTint) * mix(1.0, uDim, uNight * uNight) * shadowAt(vW) + base * uEmissive;
    gl_FragColor = vec4(c, 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;
export function litMaterial(key, opts = {}) {
    return new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            ...shadowUniforms,
            uColor: {
                value: theme.c(key)
            },
            uSunDir: theme.uniforms.uSunDir,
            uSun: theme.uniforms.uSun,
            uAmbient: theme.uniforms.uAmbient,
            uSunTint: theme.uniforms.uSunTint,
            uAmbientTint: theme.uniforms.uAmbientTint,
            uNight: theme.uniforms.uNight,
            uDim: {
                value: 1
            },
            uEmissive: {
                value: opts.emissive ?? 0
            }
        },
        vertexShader: LIT_VERT,
        fragmentShader: LIT_FRAG,
        fog: true,
        vertexColors: !!opts.vertexColors,
        side: THREE.DoubleSide
    });
}
export function litColor(color, opts = {}) {
    const m = litMaterial('wall', opts);
    m.uniforms.uColor = {
        value: new THREE.Color(color)
    };
    m.uniforms.uDim = {
        value: 0.42
    };
    return m;
}
