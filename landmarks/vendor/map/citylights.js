// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { theme } from '../core/theme.js';
import { glowPoints } from '../landmarks/sheen.js';
import { RESORT_LOOKS } from './buildings.js';
import { normals } from './geom.js';
import { PLACES, placeXZ } from '../places.js';
const SPEC = {
    motorway: {
        gap: 62,
        color: '#ffb46e',
        pool: 30,
        k: 0.16
    },
    primary: {
        gap: 36,
        color: '#ffd6a6',
        pool: 27,
        k: 0.2
    },
    secondary: {
        gap: 44,
        color: '#ffdcb4',
        pool: 24,
        k: 0.17
    },
    tertiary: {
        gap: 62,
        color: '#ffe6c8',
        pool: 21,
        k: 0.13
    }
};
export function buildCityLights(data) {
    const lamps = [], pools = [];
    const colors = new Map();
    const col = (s)=>{
        let c = colors.get(s);
        if (!c) colors.set(s, c = new THREE.Color(s));
        return c;
    };
    for (const r of data.roads){
        const spec = SPEC[r.hw];
        if (!spec || r.tn || r.pts.length < 2) continue;
        const isStrip = /las vegas boulevard/i.test(r.name ?? '');
        const gap = isStrip ? 34 : spec.gap;
        const hw = (r.lanes ?? 2) * 3.5 / 2 + 0.8;
        const n = normals(r.pts);
        let acc = gap * 0.5, flip = 1;
        for(let i = 0; i < r.pts.length - 1; i++){
            const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            while(acc < L){
                const t = acc / L;
                const y = r.y ? r.y[i] + (r.y[i + 1] - r.y[i]) * t : 0;
                const side = r.ow ? r.ow : flip = -flip;
                const x = a[0] + (b[0] - a[0]) * t + n[i][0] * hw * side, z = a[1] + (b[1] - a[1]) * t + n[i][1] * hw * side;
                lamps.push({
                    x,
                    y: y + (isStrip ? 11 : 9.5),
                    z,
                    color: col(isStrip ? '#fff0d8' : spec.color),
                    size: isStrip ? 4 : 3.5
                });
                pools.push({
                    x,
                    y: y + 0.35,
                    z,
                    r: isStrip ? 30 : spec.pool,
                    color: col(isStrip ? '#ffe2b8' : spec.color),
                    k: isStrip ? 0.14 : spec.k * 0.6
                });
                acc += gap;
            }
            acc -= L;
        }
    }
    for (const p of PLACES){
        if (!p.badge) continue;
        const look = RESORT_LOOKS.find((l)=>l.re.test(p.name));
        if (!look?.glow) continue;
        const [x, z] = placeXZ(p);
        pools.push({
            x,
            y: 0.4,
            z,
            r: 190,
            color: col(look.glow),
            k: 0.08 * Math.min(1.3, look.glowK ?? 1)
        });
    }
    const grp = new THREE.Group();
    grp.name = 'city lights';
    grp.add(poolMesh(pools), glowPoints(lamps, 'lamps', 1.4, 0.85));
    return {
        group: grp,
        spots: lamps
    };
}
function poolMesh(pools) {
    const g = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    g.index = plane.index;
    g.setAttribute('position', plane.getAttribute('position'));
    g.instanceCount = pools.length;
    const a = new Float32Array(pools.length * 4), b = new Float32Array(pools.length * 4);
    pools.forEach((p, i)=>{
        a.set([
            p.x,
            p.y,
            p.z,
            p.r
        ], i * 4);
        b.set([
            p.color.r,
            p.color.g,
            p.color.b,
            p.k
        ], i * 4);
    });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(a, 4));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(b, 4));
    const m = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uLamps: theme.uniforms.uLamps
        },
        fog: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 iPos, iCol;
      varying vec2 vP; varying vec4 vC;
      void main() { vP = position.xz; vC = iCol;
        vec4 mvPosition = viewMatrix * vec4(iPos.xyz + vec3(position.x, 0.0, position.z) * iPos.w, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
        fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uLamps; varying vec2 vP; varying vec4 vC;
      void main() {
        float d = max(1.0 - length(vP), 0.0);
        float a = d * d * vC.a * uLamps * exp(-pow(fogDensity * vFogDepth, 2.0));
        gl_FragColor = vec4(vC.rgb, a);
        #include <colorspace_fragment>
      }`
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 55;
    const sync = ()=>{
        mesh.visible = theme.uniforms.uLamps.value > 0.01;
    };
    theme.onChange(sync);
    sync();
    return mesh;
}
