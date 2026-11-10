// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { theme } from './theme.js';
const OFFSET = 20000;
export const shadowUniforms = {
    uShadowMap: {
        value: null
    },
    uShadowVP: {
        value: new THREE.Matrix4()
    },
    uShadowDir: theme.uniforms.uSunDir,
    uShadowK: theme.uniforms.uShadowK,
    uShadowOn: {
        value: 0
    },
    uShadowTexel: {
        value: 1 / 2048
    },
    uShadowBias: {
        value: 2
    }
};
export const SHADOW_PARS = `
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowVP;
  uniform vec3 uShadowDir;
  uniform float uShadowK, uShadowOn, uShadowTexel, uShadowBias;
  float shadowAt(vec3 w) {
    if (uShadowOn < 0.5) return 1.0;
    vec4 p = uShadowVP * vec4(w, 1.0);
    vec2 uv = p.xy * 0.5 + 0.5;
    vec2 e = abs(uv - 0.5) * 2.0;
    float edge = 1.0 - smoothstep(0.85, 1.0, max(e.x, e.y));
    if (edge <= 0.0) return 1.0;
    float own = dot(w, normalize(uShadowDir)) + ${OFFSET.toFixed(1)} + uShadowBias;
    float hit = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854 + 0.4;
      float r = i < 4 ? 0.8 : 1.7;
      if (texture2D(uShadowMap, uv + vec2(cos(a), sin(a)) * r * uShadowTexel).r > own) hit += 0.125;
    }
    return 1.0 - hit * uShadowK * edge;
  }
`;
const LAYER = 1;
export class Shadows {
    engine;
    view;
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 40000);
    rt = null;
    mat = new THREE.ShaderMaterial({
        uniforms: {
            uDir: theme.uniforms.uSunDir
        },
        side: THREE.DoubleSide,
        vertexShader: `
      varying vec3 vW;
      void main() {
        #ifdef USE_INSTANCING
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 wp = modelMatrix * vec4(position, 1.0);
        #endif
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
        fragmentShader: `
      uniform vec3 uDir; varying vec3 vW;
      void main() { gl_FragColor = vec4(dot(vW, normalize(uDir)) + ${OFFSET.toFixed(1)}, 0.0, 0.0, 1.0); }`
    });
    at = new THREE.Vector3(Infinity, 0, 0);
    span = 0;
    dir = new THREE.Vector3();
    clear = new THREE.Color();
    ready = false;
    lastX = NaN;
    lastZ = NaN;
    lastDist = NaN;
    constructor(engine, view){
        this.engine = engine;
        this.view = view;
        this.cam.layers.set(LAYER);
        engine.updaters.push(()=>this.update());
    }
    addCasters(root) {
        const walk = (o)=>{
            if (o.userData.crane) return;
            const m = o;
            if (m.isMesh && !m.material.transparent && !/fountains/i.test(o.name)) o.layers.enable(LAYER);
            o.children.forEach(walk);
        };
        walk(root);
        this.ready = false;
    }
    update() {
        const size = this.engine.shadowSize;
        shadowUniforms.uShadowOn.value = size > 0 ? 1 : 0;
        if (!size) return false;
        const v = this.view();
        const STEP = 1.3;
        const span = THREE.MathUtils.clamp(180 * Math.pow(STEP, Math.round(Math.log(Math.max(v.dist * 1.5, 180) / 180) / Math.log(STEP))), 180, 2600);
        const grid = span / 6, cx = Math.round(v.x / grid) * grid, cz = Math.round(v.z / grid) * grid;
        const sun = theme.uniforms.uSunDir.value;
        const stale = cx !== this.at.x || cz !== this.at.z || span !== this.span;
        const turned = this.dir.distanceToSquared(sun) > 1e-5;
        const resized = !this.rt || this.rt.width !== size;
        const still = v.x === this.lastX && v.z === this.lastZ && v.dist === this.lastDist;
        this.lastX = v.x;
        this.lastZ = v.z;
        this.lastDist = v.dist;
        if (this.ready && !stale && !turned && !resized) return false;
        const outrun = !this.ready || turned || resized || Math.hypot(v.x - this.at.x, v.z - this.at.z) > this.span * 0.35 || span > this.span * 1.7;
        if (!still && !outrun) return true;
        if (resized) {
            this.rt?.dispose();
            this.rt = new THREE.WebGLRenderTarget(size, size, {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                generateMipmaps: false
            });
        }
        this.at.set(cx, 0, cz);
        this.span = span;
        this.dir.copy(sun);
        const c = this.cam;
        c.left = c.bottom = -span;
        c.right = c.top = span;
        c.position.set(cx + sun.x * 15000, sun.y * 15000, cz + sun.z * 15000);
        c.up.set(0, 1, 0);
        c.lookAt(cx, 0, cz);
        c.updateProjectionMatrix();
        c.updateMatrixWorld(true);
        shadowUniforms.uShadowVP.value.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
        shadowUniforms.uShadowTexel.value = 1 / size;
        shadowUniforms.uShadowBias.value = 0.6 + span / size * 3;
        const { renderer: r, scene } = this.engine;
        const target = r.getRenderTarget(), alpha = r.getClearAlpha(), bg = scene.background, fog = scene.fog;
        r.getClearColor(this.clear);
        scene.background = null;
        scene.fog = null;
        scene.overrideMaterial = this.mat;
        shadowUniforms.uShadowMap.value = null;
        r.setRenderTarget(this.rt);
        r.setClearColor(0x000000, 0);
        r.clear();
        r.render(scene, c);
        r.setRenderTarget(target);
        r.setClearColor(this.clear, alpha);
        scene.overrideMaterial = null;
        scene.background = bg;
        scene.fog = fog;
        shadowUniforms.uShadowMap.value = this.rt.texture;
        this.ready = true;
        return false;
    }
}
