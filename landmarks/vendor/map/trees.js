// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { hash } from './geom.js';
import { boundaryAt, boundaryLine, roadMask, sample } from './lanegraph.js';
import { litColor } from './materials.js';
import { isStripEdge } from '../../../world/strip-streets.mjs';
import { inSouthStrip } from '../../../world/south-strip-roads.mjs';
import { inStripCorridor } from '../../../world/strip-corridor-pavement.mjs';
import { supportsTree } from '../../../world/road-planting.mjs';
import { atWelcome } from '../../../world/welcome-sign-roads.mjs';
export function palmGeometry() {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.15, 0.25, 8.6, 5, 1, true);
    trunk.translate(0, 4.3, 0);
    setColor(trunk, new THREE.Color('#8a7864'));
    parts.push(trunk);
    for(let i = 0; i < 11; i++){
        const a = i / 11 * Math.PI * 2 + i % 2 * 0.18;
        const f = new THREE.PlaneGeometry(1, 1, 2, 7);
        const length = 2.5 + hash(i + 23) * 0.7;
        const pos = f.attributes.position;
        for(let k = 0; k < pos.count; k++){
            const u = pos.getX(k), t = 0.5 - pos.getY(k);
            const width = 0.08 + 0.83 * Math.sin(Math.PI * t) ** 0.8;
            const arch = (i % 3 === 0 ? 2.45 : 1.6) * t - 2.65 * t * t;
            pos.setXYZ(k, u * width, arch - Math.abs(u) * width * 0.49, t * length);
        }
        f.rotateY(a);
        f.translate(0, 8.6, 0);
        f.computeVertexNormals();
        setColor(f, new THREE.Color(i % 2 ? '#3b7651' : '#4b8960'));
        parts.push(f);
    }
    return merge(parts);
}
function canopyGeometry() {
    const trunk = new THREE.CylinderGeometry(0.16, 0.23, 2.5, 5, 1, true);
    trunk.translate(0, 1.25, 0);
    setColor(trunk, new THREE.Color('#7a6a58'));
    const parts = [trunk];
    for (const [x, y, z, radius, color] of [
        [0, 4.18, 0, 1.63, '#4c7d58'], [-0.88, 3.57, 0.2, 1.22, '#386b4a'],
        [0.82, 3.85, 0.53, 1.16, '#447953'], [0.25, 4.08, -0.92, 1.13, '#50825c']
    ]) {
        const crown = new THREE.IcosahedronGeometry(radius, 1);
        crown.scale(1, 1.13, 0.94).translate(x, y, z);
        setColor(crown, new THREE.Color(color));
        parts.push(crown);
    }
    return merge(parts);
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
export function plantTrees(data, g, planting) {
    const onRoad = roadMask(g);
    const palms = [];
    const round = [];
    const t = data.trees;
    for(let i = 0; i < t.length; i += 3){
        const x = t[i], z = t[i + 1], k = t[i + 2];
        const welcome = atWelcome(x, z);
        if (onRoad(x, z, 0.8) || welcome && !supportsTree(planting.welcome, x, z, 0.4) &&
            !supportsTree(planting.median, x, z, 0.4)) continue;
        const r = hash(i);
        (k === 1 || welcome && r < 0.8 ? palms : round).push([
            x,
            z,
            0.8 + r * 0.45,
            r * 6.28
        ]);
    }
    const occupied = new Set();
    const key = (x, z, cell = 6)=>`${Math.round(x / cell)},${Math.round(z / cell)}`;
    for (const p of palms)occupied.add(key(p[0], p[1]));
    for (const r of round)occupied.add(key(r[0], r[1]));
    const bldgGrid = new Map();
    for (const b of data.buildings ?? []){
        const pts = b.pts;
        if (!pts || pts.length < 3) continue;
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const [bx, bz] of pts){
            if (bx < x0) x0 = bx;
            if (bx > x1) x1 = bx;
            if (bz < z0) z0 = bz;
            if (bz > z1) z1 = bz;
        }
        const pad = 2.4;
        const entry = [pts, x0 - pad, x1 + pad, z0 - pad, z1 + pad];
        for(let cx = Math.floor((x0 - pad) / 50); cx <= Math.floor((x1 + pad) / 50); cx++)
            for(let cz = Math.floor((z0 - pad) / 50); cz <= Math.floor((z1 + pad) / 50); cz++){
                const bk = `${cx},${cz}`;
                let list = bldgGrid.get(bk);
                if (!list) bldgGrid.set(bk, list = []);
                list.push(entry);
            }
    }
    const inBuilding = (x, z, margin = 2.0)=>{
        const list = bldgGrid.get(`${Math.floor(x / 50)},${Math.floor(z / 50)}`);
        if (!list) return false;
        const m2 = margin * margin;
        for (const [pts, x0, x1, z0, z1] of list){
            if (x < x0 || x > x1 || z < z0 || z > z1) continue;
            let inside = false;
            for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){
                const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
                if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi || 1e-9) + xi) inside = !inside;
                const dx = xj - xi, dz = zj - zi, L2 = dx * dx + dz * dz || 1;
                const t = Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / L2));
                const d2 = (x - (xi + dx * t)) ** 2 + (z - (zi + dz * t)) ** 2;
                if (d2 <= m2) return true;
            }
            if (inside) return true;
        }
        return false;
    };
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
        if (!k.connector || k.line.pts.length < 2 || k.line.y.some(y=>y > 2)) continue;
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
        if (!bestM || bestT < 1.2 || bestT >= 28) return 0;
        const mIsLink = /_link$/.test(bestM.way.hw);
        if (!mIsLink && !(bestHd < -0.35 && bestM.oneway && (bestM.cls === 'arterial' || bestM.cls === 'collector'))) return 0;
        return bestT;
    };
    for (const e of g.edges){
        if (!e.oneway || e.elevated || e.internal || /_link$/.test(e.way.hw)) continue;
        const name = e.way.name ?? '';
        const stripEdge = isStripEdge(e);
        if (!stripEdge && !/Las Vegas Boulevard|Flamingo Road|Tropicana Avenue|Harmon Avenue|Spring Mountain Road|Bruno Mars Drive|Park Avenue/i.test(name)) continue;
        const isStrip = stripEdge || /Las Vegas Boulevard/i.test(name);
        // 1. Landscaped center median trees (alternating palms & leafy canopy trees, matching Apple Maps)
        {
            const minGap = isStrip ? 1.25 : 2.0;
            const step = isStrip ? 8.2 : 14.5;
            const endPad = isStrip ? 5.5 : 10;
            const left = boundaryLine(e, 0);
            for(let s = endPad; s < left.length - endPad; s += step){
                const q = sample(left, s);
                const gap = islandWidthAt(e, q.x, q.z, q.hx, q.hz);
                if (gap < minGap) continue;
                const lx = q.hz, lz = -q.hx;
                const x = q.x + lx * (gap * 0.5), z = q.z + lz * (gap * 0.5);
                const roadMargin = gap < 2.2 ? 0.35 : 0.65;
                if (occupied.has(key(x, z)) || atWelcome(x, z) || onRoad(x, z, roadMargin) || onCarriageway(x, z, roadMargin) || onConn(x, z, 0.75)) continue;
                const reviewed = stripEdge || inSouthStrip(x, z) || inStripCorridor(x, z);
                if (reviewed && !supportsTree(planting.median, x, z, 0.43)) continue;
                occupied.add(key(x, z));
                const h = hash(Math.round(x * 7 + z * 3));
                const yaw = hash(Math.round(x + z * 5)) * 6.28;
                const widthFit = Math.min(1, Math.max(0.72, (gap - 0.3) / 2.6));
                if (isStrip && h > 0.66 && gap >= 1.9) {
                    round.push([
                        x,
                        z,
                        (0.78 + h * 0.32) * widthFit,
                        yaw
                    ]);
                } else {
                    palms.push([
                        x,
                        z,
                        (0.88 + h * 0.34) * Math.max(0.84, widthFit),
                        yaw
                    ]);
                }
                if (isStrip && gap >= 5.6) {
                    for (const off of [
                        -gap * 0.24,
                        gap * 0.24
                    ]){
                        const sx2 = x + lx * off + q.hx * 4.2, sz2 = z + lz * off + q.hz * 4.2;
                        if (!occupied.has(key(sx2, sz2)) && !atWelcome(sx2, sz2) && !onRoad(sx2, sz2, 0.7) && !onCarriageway(sx2, sz2, 0.65) && !onConn(sx2, sz2, 0.8) &&
                            (!reviewed || supportsTree(planting.median, sx2, sz2, 0.48))) {
                            occupied.add(key(sx2, sz2));
                            const h2 = hash(Math.round(sx2 * 5 + sz2));
                            (h2 > 0.62 ? round : palms).push([
                                sx2,
                                sz2,
                                0.85 + h2 * 0.32,
                                hash(Math.round(sx2 + sz2 * 5)) * 6.28
                            ]);
                        }
                    }
                }
            }
        }
        // 2. Strip boulevard sidewalk trees along outer curbs (clear of roads, intersections, and buildings)
        if (stripEdge && e.ref.length >= 22) {
            const right = boundaryLine(e, e.lanes.length);
            for(let s = 9.5; s < right.length - 9.5; s += 11.5){
                const q = sample(right, s);
                const rx = -q.hz, rz = q.hx;
                const x = q.x + rx * 2.25, z = q.z + rz * 2.25;
                if (occupied.has(key(x, z)) || atWelcome(x, z) || onRoad(x, z, 1.0) || onCarriageway(x, z, 0.9) || onConn(x, z, 1.1) || inBuilding(x, z, 2.2) ||
                    !supportsTree(planting.sidewalk, x, z, 0.44)) continue;
                occupied.add(key(x, z));
                const h = hash(Math.round(x * 11 + z * 7));
                const yaw = hash(Math.round(x * 3 + z * 13)) * 6.28;
                if (h < 0.76) {
                    round.push([
                        x,
                        z,
                        0.76 + h * 0.32,
                        yaw
                    ]);
                } else {
                    palms.push([
                        x,
                        z,
                        0.92 + (h - 0.76) * 1.1,
                        yaw
                    ]);
                }
            }
        }
    }
    return {
        palms,
        round
    };
}
export function buildTrees(data, g, planting) {
    const { palms, round } = plantTrees(data, g, planting);
    const group = new THREE.Group();
    group.name = 'trees';
    const mk = (geo, list, color)=>{
        if (!list.length) return;
        const mat = litColor('#ffffff', {
            vertexColors: true
        });
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
        list.forEach(([x, z, s, yaw], i)=>{
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
            sc.set(s, s, s);
            const y = planting.median(x, z) ? 0.122 : planting.sidewalk(x, z) || atWelcome(x, z) && planting.welcome(x, z) ? 0.11 : 0;
            pos.set(x, y, z);
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
