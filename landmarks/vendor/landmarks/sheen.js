// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { SHADOW_PARS, shadowUniforms } from '../core/shadows.js';
import { theme } from '../core/theme.js';
import { CURTAIN_V, facadeTextures, Layer, TILE_U, TILE_V } from '../map/facades.js';
const SHEEN_VERT = `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vL;
  varying vec3 vLN;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vW = wp.xyz;
    vL = position;
    vLN = normal;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const SHEEN_FRAG = `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor, uGlow, uWinLit, uSunDir, uSunTint, uAmbientTint, uTop, uHorizon, uGroundC;
  uniform float uSun, uAmbient, uNight, uRefl, uSpec, uGlowK, uBaseGlow, uOpacity, uWin, uDim, uLayer, uTU, uTV, uHasMap;
  uniform sampler2DArray uFacade, uFacadeNight;
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vL;
  varying vec3 vLN;
  ${SHADOW_PARS}
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vW);
    if (dot(n, v) < 0.0) n = -n; // whichever way a surface was wound, light the side we can see
    vec3 r = reflect(-v, n);
    float hemi = 0.72 + 0.28 * n.y;
    float key = max(dot(n, uSunDir), 0.0);
    vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : uColor;
    vec3 lightIn = (uAmbient * hemi * uAmbientTint + uSun * key * uSunTint) * mix(1.0, uDim, uNight * uNight) * shadowAt(vW);
    bool walls = uWin > 0.0 && abs(n.y) < 0.5;
    vec3 ln = abs(vLN);
    float wu = ln.z > 0.5 ? vL.x : (ln.x > 0.5 ? vL.z : vL.x + vL.z);
    vec2 fuv = vec2(wu / uTU, 1.0 - vL.y / uTV);
    if (walls) base *= texture(uFacade, vec3(fuv, uLayer), 0.6).rgb;
    vec3 c = base * lightIn;
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    vec3 env = r.y > 0.0 ? mix(uHorizon, uTop, pow(r.y, 0.6)) : uGroundC * 0.7;
    c = mix(c, env, uRefl * (0.3 + 0.7 * fres));
    c += uSunTint * uSun * uSpec * pow(max(dot(r, uSunDir), 0.0), 60.0);
    vec3 e = uGlow * (uBaseGlow + uGlowK * uNight);
    if (walls) e += texture(uFacadeNight, vec3(fuv, uLayer), 0.6).rgb * uNight * uWin * 1.1;
    if (uHasMap > 0.5) e += base * (uBaseGlow + uGlowK * uNight);
    gl_FragColor = vec4(c + e, uOpacity);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;
export function sheen(color, o = {}) {
    const u = theme.uniforms;
    const tex = facadeTextures();
    const opacity = o.opacity ?? 1;
    return new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            ...shadowUniforms,
            uColor: {
                value: o.live ? theme.c(o.live) : new THREE.Color(color)
            },
            uDim: {
                value: o.live ? 1 : 0.42
            },
            uLayer: {
                value: o.masonry ? Layer.Masonry : Layer.Curtain
            },
            uTU: {
                value: TILE_U[o.masonry ? Layer.Masonry : Layer.Curtain]
            },
            uTV: {
                value: o.masonry ? TILE_V : CURTAIN_V
            },
            uFacade: {
                value: tex.color
            },
            uFacadeNight: {
                value: tex.night
            },
            uMap: {
                value: o.map ?? null
            },
            uHasMap: {
                value: o.map ? 1 : 0
            },
            uGlow: {
                value: new THREE.Color(o.glow ?? '#000000')
            },
            uWinLit: {
                value: theme.c('windowLit')
            },
            uTop: {
                value: theme.c('skyTop')
            },
            uHorizon: {
                value: theme.c('skyHorizon')
            },
            uGroundC: {
                value: theme.c('ground')
            },
            uSunDir: u.uSunDir,
            uSunTint: u.uSunTint,
            uAmbientTint: u.uAmbientTint,
            uSun: u.uSun,
            uAmbient: u.uAmbient,
            uNight: u.uNight,
            uRefl: {
                value: o.refl ?? 0
            },
            uSpec: {
                value: o.spec ?? 0
            },
            uGlowK: {
                value: o.glowK ?? 0
            },
            uBaseGlow: {
                value: o.baseGlow ?? 0
            },
            uOpacity: {
                value: opacity
            },
            uWin: {
                value: o.windows ?? 0
            }
        },
        vertexShader: SHEEN_VERT,
        fragmentShader: SHEEN_FRAG,
        fog: true,
        side: THREE.DoubleSide,
        transparent: opacity < 1,
        depthWrite: opacity >= 1
    });
}
export function nightAura(color, k = 0.35) {
    return new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uC: {
                value: new THREE.Color(color)
            },
            uK: {
                value: k
            },
            uNight: theme.uniforms.uNight
        },
        vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vN; varying vec3 vV;
      void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mvPosition.xyz; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
        fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uC; uniform float uK, uNight; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float a = f * uK * smoothstep(0.1, 0.9, uNight) * exp(-pow(fogDensity * vFogDepth, 2.0));
        gl_FragColor = vec4(uC, a);
        #include <colorspace_fragment>
      }`,
        fog: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
}
const radial = (()=>{
    let t = null;
    return ()=>{
        if (t) return t;
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const x = c.getContext('2d');
        const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.4)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 128, 128);
        t = new THREE.CanvasTexture(c);
        return t;
    };
})();
export function halo(size, color, k = 0.5) {
    const m = new THREE.SpriteMaterial({
        map: radial(),
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        opacity: 0
    });
    const s = new THREE.Sprite(m);
    s.scale.set(size, size, 1);
    const sync = ()=>{
        m.opacity = k * theme.uniforms.uNight.value;
        s.visible = m.opacity > 0.01;
    };
    theme.onChange(sync);
    sync();
    s.userData.keep = true;
    return s;
}
export function glowPoints(pts, drive = 'lamps', minPx = 1.6, gain = 1) {
    const pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3), size = new Float32Array(pts.length);
    pts.forEach((p, i)=>{
        pos.set([
            p.x,
            p.y,
            p.z
        ], i * 3);
        col.set([
            p.color.r,
            p.color.g,
            p.color.b
        ], i * 3);
        size[i] = p.size;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const u = theme.uniforms;
    const uPx = {
        value: 1000
    };
    const m = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uK: drive === 'lamps' ? u.uLamps : u.uNight,
            uPx,
            uMin: {
                value: minPx
            },
            uGain: {
                value: gain
            }
        },
        vertexColors: true,
        fog: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      attribute float aSize; uniform float uPx, uMin; varying vec3 vC;
      void main() { vC = color; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(aSize * uPx / max(-mvPosition.z, 1.0), uMin, 64.0);
        #include <fog_vertex>
      }`,
        fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uK, uGain; varying vec3 vC;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(max(1.0 - d, 0.0), 2.0) * uK * uGain * exp(-pow(fogDensity * vFogDepth, 2.0));
        gl_FragColor = vec4(vC, a);
        #include <colorspace_fragment>
      }`
    });
    const out = new THREE.Points(g, m);
    out.frustumCulled = false;
    const v = new THREE.Vector2();
    out.onBeforeRender = (r, _s, cam)=>{
        uPx.value = r.getDrawingBufferSize(v).y / (2 * Math.tan(cam.fov * Math.PI / 360));
    };
    const sync = ()=>{
        out.visible = m.uniforms.uK.value > 0.01;
    };
    theme.onChange(sync);
    sync();
    out.userData.keep = true;
    return out;
}
export function textPanel(text, w, h, o = {}) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const x = c.getContext('2d');
    if (o.background) {
        x.fillStyle = o.background;
        x.fillRect(0, 0, 1024, 256);
    }
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = o.color ?? '#fff3d3';
    x.font = o.font ?? '600 80px Georgia';
    x.save();
    x.translate(512, o.sub ? 104 : 128);
    x.scale(Math.min(4, 940 / Math.max(1, x.measureText(text).width)), 1);
    x.fillText(text, 0, 0);
    x.restore();
    if (o.sub) {
        x.font = '500 32px sans-serif';
        x.fillText(o.sub, 512, 197, 930);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        alphaTest: 0.08,
        fog: true,
        depthWrite: false
    }));
    mesh.userData.keep = true;
    return mesh;
}
