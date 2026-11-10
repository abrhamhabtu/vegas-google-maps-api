// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { theme } from '../core/theme.js';
import { hash } from './geom.js';
import { roadMask, sample } from './lanegraph.js';
import { litColor } from './materials.js';
import { latLonToXZ } from '../core/data.js';
import { ORIGIN, SIGN_LATLON } from '../places.js';
export function palmGeometry() {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 9, 5, 1, true);
    trunk.translate(0, 4.5, 0);
    setColor(trunk, new THREE.Color('#7d7466'));
    parts.push(trunk);
    for(let i = 0; i < 7; i++){
        const a = i / 7 * Math.PI * 2 + i % 2 * 0.2;
        const f = new THREE.PlaneGeometry(0.9, 3.4, 1, 3);
        const pos = f.attributes.position;
        for(let k = 0; k < pos.count; k++){
            const y = pos.getY(k) + 1.7;
            const droop = -0.12 * y * y;
            pos.setXYZ(k, pos.getX(k) * (1 - y / 4.2), droop, y);
        }
        f.rotateY(a);
        f.translate(0, 9, 0);
        f.computeVertexNormals();
        setColor(f, new THREE.Color(i % 2 ? '#2f8a6c' : '#287a60'));
        parts.push(f);
    }
    return merge(parts);
}
function canopyGeometry() {
    const trunk = new THREE.CylinderGeometry(0.15, 0.22, 2.6, 5, 1, true);
    trunk.translate(0, 1.3, 0);
    setColor(trunk, new THREE.Color('#6f665a'));
    const crown = new THREE.IcosahedronGeometry(2.1, 1);
    crown.scale(1, 1.15, 1);
    crown.translate(0, 4.1, 0);
    setColor(crown, new THREE.Color('#23735f'));
    return merge([
        trunk,
        crown
    ]);
}
function setColor(g, c) {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for(let i = 0; i < n; i++){
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}
function merge(parts) {
    const out = new THREE.BufferGeometry();
    const pos = [], nrm = [], col = [], idx = [];
    let base = 0;
    for (const p of parts){
        const g = p.index ? p : p;
        const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color;
        for(let i = 0; i < P.count; i++){
            pos.push(P.getX(i), P.getY(i), P.getZ(i));
            nrm.push(N.getX(i), N.getY(i), N.getZ(i));
            col.push(C.getX(i), C.getY(i), C.getZ(i));
        }
        if (g.index) for(let i = 0; i < g.index.count; i++)idx.push(g.index.getX(i) + base);
        else for(let i = 0; i < P.count; i++)idx.push(i + base);
        base += P.count;
    }
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.setIndex(idx);
    return out;
}
export function plantTrees(data, g) {
    const onRoad = roadMask(g);
    const palms = [];
    const round = [];
    const [sx, sz] = latLonToXZ(ORIGIN, SIGN_LATLON.lat, SIGN_LATLON.lon);
    const inLot = (x, z)=>Math.abs(x - sx) < 17 && z > sz - 20 && z < sz + 232;
    const t = data.trees;
    for(let i = 0; i < t.length; i += 3){
        const x = t[i], z = t[i + 1], k = t[i + 2];
        if (inLot(x, z) || onRoad(x, z, 0.8)) continue;
        const r = hash(i);
        (k === 1 ? palms : round).push([
            x,
            z,
            0.8 + r * 0.45,
            r * 6.28
        ]);
    }
    const occupied = new Set();
    const key = (x, z)=>`${Math.round(x / 8)},${Math.round(z / 8)}`;
    for (const p of palms)occupied.add(key(p[0], p[1]));
    for (const e of g.edges){
        if (!e.oneway || !/Las Vegas Boulevard/.test(e.way.name ?? '') || e.elevated) continue;
        for(let s = 10; s < e.ref.length - 10; s += 16){
            const p = sample(e.ref, s);
            const nx = -p.hz, nz = p.hx;
            let gap = 0;
            for(let u = 1; u <= 24; u++)if (onRoad(p.x - nx * u, p.z - nz * u, 0)) {
                gap = u;
                break;
            }
            if (gap < 4.5) continue;
            const x = p.x - nx * (gap / 2), z = p.z - nz * (gap / 2);
            if (occupied.has(key(x, z)) || inLot(x, z) || onRoad(x, z, 0.8)) continue;
            occupied.add(key(x, z));
            palms.push([
                x,
                z,
                1 + hash(Math.round(x * 7 + z)) * 0.35,
                hash(Math.round(x + z * 3)) * 6.28
            ]);
        }
    }
    return {
        palms,
        round
    };
}
export function buildTrees(data, g) {
    const { palms, round } = plantTrees(data, g);
    const group = new THREE.Group();
    group.name = 'trees';
    const mk = (geo, list, color)=>{
        if (!list.length) return;
        const mat = litColor(theme.name === 'day' ? '#ffffff' : '#ffffff', {
            vertexColors: true
        });
        void color;
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
        list.forEach(([x, z, s, yaw], i)=>{
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
            sc.set(s, s, s);
            pos.set(x, 0, z);
            mesh.setMatrixAt(i, m.compose(pos, q, sc));
        });
        mesh.computeBoundingSphere();
        mesh.name = color;
        group.add(mesh);
    };
    mk(palmGeometry(), palms, 'palm');
    mk(canopyGeometry(), round, 'tree');
    return group;
}
