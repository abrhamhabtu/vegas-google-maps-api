// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { theme } from '../core/theme.js';
import { hash } from './geom.js';
import { boundaryAt, boundaryLine, roadMask, sample } from './lanegraph.js';
import { litColor } from './materials.js';
import { latLonToXZ } from '../core/data.js';
import { ORIGIN, SIGN_LATLON } from '../places.js';
import { hasFlamingoConcreteMedian } from '../../../world/flamingo-streets.mjs';
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
    const key = (x, z)=>`${Math.round(x / 9)},${Math.round(z / 9)}`;
    for (const p of palms)occupied.add(key(p[0], p[1]));
    const medGrid = new Map();
    for (const m of g.edges){
        if (m.internal || m.cls === 'service' || m.elevated) continue;
        for(let i = 0; i < m.ref.pts.length - 1; i++){
            const a = m.ref.pts[i], b = m.ref.pts[i + 1];
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 20));
            for(let k = 0; k <= n; k++){
                const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
                const cKey = `${Math.floor(x / 40)},${Math.floor(z / 40)}`;
                let list = medGrid.get(cKey);
                if (!list) medGrid.set(cKey, list = []);
                if (!list.length || list[list.length - 1][0] !== m || list[list.length - 1][1] !== i) list.push([
                    m,
                    i
                ]);
            }
        }
    }
    const connGrid = new Map();
    for (const k of g.lanes){
        if (!k.connector || k.line.pts.length < 2) continue;
        const hw = (k.width ?? 3.5) * 0.5;
        for(let i = 0; i < k.line.pts.length - 1; i++){
            const a = k.line.pts[i], b = k.line.pts[i + 1];
            const mx = (a[0] + b[0]) * 0.5, mz = (a[1] + b[1]) * 0.5;
            const cKey = `${Math.floor(mx / 30)},${Math.floor(mz / 30)}`;
            let list = connGrid.get(cKey);
            if (!list) connGrid.set(cKey, list = []);
            list.push([
                a[0],
                a[1],
                b[0],
                b[1],
                hw
            ]);
        }
    }
    const onConn = (x, z, margin = 0.8)=>{
        const cx = Math.floor(x / 30), cz = Math.floor(z / 30);
        for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [ax, az, bx, bz, hw] of connGrid.get(`${cx + a},${cz + b}`) ?? []){
            const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
            if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) <= hw + margin) return true;
        }
        return false;
    };
    const onCarriageway = (x, z, margin = 0.85, excludeWayId = -1, excludeEdgeId = -1)=>{
        const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
        for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [m, seg] of medGrid.get(`${cx + a},${cz + b}`) ?? []){
            if (m.id === excludeEdgeId || m.way.id === excludeWayId) continue;
            const u = m.ref.pts[seg], v = m.ref.pts[seg + 1];
            const dx = v[0] - u[0], dz = v[1] - u[1], L = Math.hypot(dx, dz);
            if (L < 1e-4) continue;
            const hx = dx / L, hz = dz / L, nx = -hz, nz = hx;
            const along = (x - u[0]) * hx + (z - u[1]) * hz;
            if (along < -1.5 || along > L + 1.5) continue;
            const s = m.ref.cum[seg] + Math.max(0, Math.min(L, along));
            const lat = (x - u[0]) * nx + (z - u[1]) * nz;
            if (lat >= boundaryAt(m, 0, s) - margin && lat <= boundaryAt(m, m.lanes.length, s) + margin) return true;
        }
        return false;
    };
    const islandWidthAt = (e, x, z, hx, hz)=>{
        const lx = hz, lz = -hx;
        if (onCarriageway(x + lx * 0.4, z + lz * 0.4, 0.2, e.way.id, e.id) || onConn(x + lx * 0.6, z + lz * 0.6, 0.25)) return 0;
        let bestT = 32, bestM = null, bestHd = 0;
        const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
        for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [m, seg] of medGrid.get(`${cx + a},${cz + b}`) ?? []){
            if (m.id === e.id || m.way.id === e.way.id || m.twin === e.id) continue;
            const u = m.ref.pts[seg], v = m.ref.pts[seg + 1];
            const dx = v[0] - u[0], dz = v[1] - u[1], L = Math.hypot(dx, dz);
            if (L < 1e-4) continue;
            const mhx = dx / L, mhz = dz / L, mnx = -mhz, mnz = mhx;
            const den = lx * mnx + lz * mnz;
            if (Math.abs(den) < 0.35) continue;
            const tRef = ((u[0] - x) * mnx + (u[1] - z) * mnz) / den;
            const along = (x + lx * tRef - u[0]) * mhx + (z + lz * tRef - u[1]) * mhz;
            if (along < -2.0 || along > L + 2.0) continue;
            const s = m.ref.cum[seg] + Math.max(0, Math.min(L, along));
            const t0 = tRef + (boundaryAt(m, 0, s) - 0.15) / den;
            const t1 = tRef + (boundaryAt(m, m.lanes.length, s) + 0.15) / den;
            const tNear = Math.min(t0, t1), tFar = Math.max(t0, t1);
            if (tNear <= 0.15 && tFar >= -0.15) return 0;
            if (tNear > 0.15 && tNear < bestT) {
                bestT = tNear;
                bestM = m;
                bestHd = hx * mhx + hz * mhz;
            }
        }
        if (!bestM || bestT < 1.9 || bestT >= 28) return 0;
        const mIsLink = /_link$/.test(bestM.way.hw);
        if (!mIsLink && !(bestHd < -0.35 && bestM.oneway && (bestM.cls === 'arterial' || bestM.cls === 'collector'))) return 0;
        return bestT;
    };
    for (const e of g.edges){
        if (!e.oneway || e.elevated || e.internal || /_link$/.test(e.way.hw) || hasFlamingoConcreteMedian(e)) continue;
        const name = e.way.name ?? '';
        if (!/Las Vegas Boulevard|Flamingo Road|Tropicana Avenue|Harmon Avenue|Spring Mountain Road|Bruno Mars Drive|Park Avenue/i.test(name)) continue;
        const isStrip = /Las Vegas Boulevard/i.test(name);
        const step = isStrip ? 12.5 : 16;
        const left = boundaryLine(e, 0);
        for(let s = 12; s < left.length - 12; s += step){
            const q = sample(left, s);
            const gap = islandWidthAt(e, q.x, q.z, q.hx, q.hz);
            if (gap < 2.0) continue;
            const lx = q.hz, lz = -q.hx;
            const x = q.x + lx * (gap * 0.5), z = q.z + lz * (gap * 0.5);
            if (occupied.has(key(x, z)) || inLot(x, z) || onRoad(x, z, 0.9) || onCarriageway(x, z, 0.75) || onConn(x, z, 0.85)) continue;
            occupied.add(key(x, z));
            palms.push([
                x,
                z,
                1.02 + hash(Math.round(x * 7 + z)) * 0.35,
                hash(Math.round(x + z * 3)) * 6.28
            ]);
            if (isStrip && gap >= 6.8) {
                for (const off of [
                    -gap * 0.24,
                    gap * 0.24
                ]){
                    const sx2 = x + lx * off + q.hx * 5.5, sz2 = z + lz * off + q.hz * 5.5;
                    if (!occupied.has(key(sx2, sz2)) && !inLot(sx2, sz2) && !onRoad(sx2, sz2, 0.9) && !onCarriageway(sx2, sz2, 0.85) && !onConn(sx2, sz2, 0.9)) {
                        occupied.add(key(sx2, sz2));
                        palms.push([
                            sx2,
                            sz2,
                            0.95 + hash(Math.round(sx2 * 5 + sz2)) * 0.35,
                            hash(Math.round(sx2 + sz2 * 5)) * 6.28
                        ]);
                    }
                }
            }
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
