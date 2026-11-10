// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { signalState } from './intersections.js';
import { roadMask, sample } from './lanegraph.js';
import { LENS_Y, planSignals, signalArmGeometry, signalHeadGeometry, signalPoleGeometry } from './signalplan.js';
import { litColor } from './materials.js';
import { normals, Soup } from './geom.js';
import { box } from './roads.js';
const CHUNK = 500;
const SHOW_BELOW = 1400;
export function buildStreetscape(g, engine, lampSpots) {
    const out = new THREE.Group();
    out.name = 'streetscape';
    const steel = litColor('#4b4f56');
    const onRoad = roadMask(g);
    const chunks = new Map();
    const at = (x, z)=>{
        const k = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
        let c = chunks.get(k);
        if (!c) chunks.set(k, c = {
            poles: new Soup(),
            group: new THREE.Group(),
            x: (Math.floor(x / CHUNK) + 0.5) * CHUNK,
            z: (Math.floor(z / CHUNK) + 0.5) * CHUNK,
            signals: []
        });
        return c;
    };
    const beam = (s, x0, z0, y, x1, z1, w)=>{
        const L = Math.hypot(x1 - x0, z1 - z0);
        box(s, (x0 + x1) / 2, (z0 + z1) / 2, w, L, y, y + w, Math.atan2(x1 - x0, z1 - z0));
    };
    const plan = planSignals(g);
    const heads = plan.heads.map((h, slot)=>({
            ...h,
            slot
        }));
    const byChunk = new Map();
    const bucket = (x, z)=>{
        const k = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
        let b = byChunk.get(k);
        if (!b) byChunk.set(k, b = {
            arms: [],
            heads: [],
            names: []
        });
        at(x, z);
        return {
            b,
            c: chunks.get(k)
        };
    };
    for (const a of plan.arms)bucket(a.px, a.pz).b.arms.push(a);
    for (const h of heads){
        const { b, c } = bucket(h.x, h.z);
        b.heads.push(h);
        c.signals.push(h);
    }
    const poleGeo = signalPoleGeometry(), armGeo = signalArmGeometry(), headGeo = signalHeadGeometry();
    const signalMat = litColor('#ffffff', {
        vertexColors: true
    });
    const yAxis = new THREE.Vector3(0, 1, 0), mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
    const nameMats = new Map();
    const nameMat = (t)=>{
        let m = nameMats.get(t);
        if (!m) {
            const cv = document.createElement('canvas');
            cv.width = 512;
            cv.height = 72;
            const x = cv.getContext('2d');
            x.fillStyle = '#0d5a34';
            x.fillRect(0, 0, 512, 72);
            x.strokeStyle = '#eaf2ec';
            x.lineWidth = 3;
            x.strokeRect(4, 4, 504, 64);
            x.fillStyle = '#ffffff';
            x.font = '700 44px Arial, sans-serif';
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            x.fillText(t, 256, 38, 480);
            const tx = new THREE.CanvasTexture(cv);
            tx.colorSpace = THREE.SRGBColorSpace;
            tx.anisotropy = 4;
            nameMats.set(t, m = new THREE.MeshBasicMaterial({
                map: tx,
                fog: true
            }));
        }
        return m;
    };
    const nameGeo = new THREE.PlaneGeometry(3.3, 0.46);
    for (const [k, b] of byChunk){
        const c = chunks.get(k);
        if (b.arms.length) {
            const poles = new THREE.InstancedMesh(poleGeo, signalMat, b.arms.length), arms = new THREE.InstancedMesh(armGeo, signalMat, b.arms.length);
            b.arms.forEach((a, i)=>{
                poles.setMatrixAt(i, mm.compose(pp.set(a.px, 0, a.pz), qq.setFromAxisAngle(yAxis, a.yaw), ss.set(1, 1, 1)));
                arms.setMatrixAt(i, mm.compose(pp.set(a.px, 6.9, a.pz), qq.setFromAxisAngle(yAxis, Math.atan2(-(a.ax - a.px), -(a.az - a.pz)) + Math.PI / 2), ss.set(Math.hypot(a.ax - a.px, a.az - a.pz), 1, 1)));
                if (a.name) {
                    const u = 2.3 / (Math.hypot(a.ax - a.px, a.az - a.pz) || 1);
                    const sign = new THREE.Mesh(nameGeo, nameMat(a.name));
                    sign.position.set(a.px + (a.ax - a.px) * u, 7.5, a.pz + (a.az - a.pz) * u);
                    sign.rotation.y = a.yaw;
                    c.group.add(sign);
                }
            });
            poles.computeBoundingSphere();
            arms.computeBoundingSphere();
            c.group.add(poles, arms);
        }
        if (b.heads.length) {
            const inst = new THREE.InstancedMesh(headGeo, signalMat, b.heads.length);
            b.heads.forEach((h, i)=>inst.setMatrixAt(i, mm.compose(pp.set(h.x, h.y, h.z), qq.setFromAxisAngle(yAxis, h.yaw), ss.set(1, 1, 1))));
            inst.computeBoundingSphere();
            c.group.add(inst);
        }
    }
    const lampGeo = new THREE.CircleGeometry(0.125, 10);
    const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({
        toneMapped: false,
        fog: true
    }), Math.max(1, heads.length));
    lamps.frustumCulled = false;
    const red = new THREE.Color(3.4, 0.2, 0.08), amber = new THREE.Color(3.6, 2.0, 0.1), green = new THREE.Color(0.12, 3.2, 1.3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const setHead = (h, t)=>{
        const st = signalState(h.i, t);
        let c = red, dy = LENS_Y;
        if (st.phase >= 0 && st.state !== 'red') {
            const phase = h.i.phases[st.phase];
            let mine = false;
            for (const conn of phase.greens)if (h.greens.has(conn)) {
                mine = true;
                break;
            }
            if (mine) {
                c = st.state === 'green' ? green : amber;
                dy = st.state === 'green' ? -LENS_Y : 0;
            }
        }
        q.setFromAxisAngle(up, h.yaw);
        pos.set(h.x + Math.sin(h.yaw) * 0.125, h.y + dy, h.z + Math.cos(h.yaw) * 0.125);
        lamps.setMatrixAt(h.slot, m.compose(pos, q, s1));
        lamps.setColorAt(h.slot, c);
    };
    heads.forEach((h)=>setHead(h, 0));
    const postGeo = new Soup();
    box(postGeo, 0, 0, 0.2, 0.2, 0, 9.4, 0);
    box(postGeo, 0, 1.1, 0.12, 2.4, 9.3, 9.42, 0);
    box(postGeo, 0, 2.2, 0.3, 0.5, 9.2, 9.34, 0);
    const postMesh = postGeo.geometry();
    const spotsByChunk = new Map();
    for (const l of lampSpots){
        if (onRoad(l.x, l.z, 0.3)) continue;
        const k = `${Math.floor(l.x / CHUNK)},${Math.floor(l.z / CHUNK)}`;
        if (!spotsByChunk.has(k)) spotsByChunk.set(k, []);
        spotsByChunk.get(k).push(l);
    }
    const lampMat = litColor('#6d7178');
    for (const [k, list] of spotsByChunk){
        const [ci, cj] = k.split(',').map(Number);
        const c = at((ci + 0.5) * CHUNK, (cj + 0.5) * CHUNK);
        const inst = new THREE.InstancedMesh(postMesh, lampMat, list.length);
        const mm = new THREE.Matrix4(), rot = new THREE.Quaternion(), pp = new THREE.Vector3();
        list.forEach((l, i)=>{
            rot.setFromAxisAngle(up, nearestRoadYaw(g, l.x, l.z));
            pp.set(l.x, Math.max(0, l.y - 9.5), l.z);
            inst.setMatrixAt(i, mm.compose(pp, rot, s1));
        });
        inst.computeBoundingSphere();
        c.group.add(inst);
    }
    const signMats = new Map();
    const signMat = (mph)=>{
        let mat = signMats.get(mph);
        if (!mat) {
            const cv = document.createElement('canvas');
            cv.width = 96;
            cv.height = 128;
            const x = cv.getContext('2d');
            x.fillStyle = '#f7f7f4';
            x.fillRect(0, 0, 96, 128);
            x.strokeStyle = '#111';
            x.lineWidth = 4;
            x.strokeRect(5, 5, 86, 118);
            x.fillStyle = '#111';
            x.textAlign = 'center';
            x.font = '700 16px Arial';
            x.fillText('SPEED', 48, 30);
            x.fillText('LIMIT', 48, 48);
            x.font = '700 50px Arial';
            x.fillText(String(mph), 48, 104);
            const t = new THREE.CanvasTexture(cv);
            t.colorSpace = THREE.SRGBColorSpace;
            signMats.set(mph, mat = new THREE.MeshBasicMaterial({
                map: t,
                fog: true
            }));
        }
        return mat;
    };
    const plate = new THREE.PlaneGeometry(0.76, 1.0);
    for (const e of g.edges){
        if (e.cls !== 'arterial' || !e.way.mph || e.ref.length < 120 || e.elevated) continue;
        const every = 500, first = Math.round(e.id * 37 % every + 60);
        for(let d = first; d < e.ref.length - 40; d += every){
            const p = sample(e.ref, d), W = e.lanes.length * e.laneWidth, x = p.x - p.hz * (W + 1.4), z = p.z + p.hx * (W + 1.4);
            if (onRoad(x, z, 0.3)) continue;
            const c = at(x, z);
            box(c.poles, x, z, 0.1, 0.1, 0, 3.2, 0);
            const sign = new THREE.Mesh(plate, signMat(e.way.mph));
            sign.position.set(x, 3.1, z);
            sign.rotation.y = Math.atan2(-p.hx, -p.hz);
            c.group.add(sign);
        }
    }
    for (const c of chunks.values()){
        if (c.poles.count) c.group.add(new THREE.Mesh(c.poles.geometry(), steel));
        c.group.visible = false;
        out.add(c.group);
    }
    out.add(lamps);
    let last = -1;
    const near = [];
    engine.updaters.push((f)=>{
        const cam = engine.camera.position, low = cam.y < (lamps.visible ? SHOW_BELOW * 1.12 : SHOW_BELOW * 0.9);
        lamps.visible = low;
        if (!low) {
            for (const c of chunks.values())c.group.visible = false;
            return false;
        }
        if (f.t - last < 0.5) return false;
        last = f.t;
        near.length = 0;
        const R = Math.max(900, cam.y * 2.2) ** 2;
        for (const c of chunks.values()){
            const d = (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2;
            c.group.visible = d < R;
            if (c.group.visible) near.push(...c.signals);
        }
        for (const h of near)setHead(h, f.t);
        lamps.instanceMatrix.needsUpdate = true;
        if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
        return false;
    });
    engine.animate(lamps, ()=>{}, new THREE.Sphere(new THREE.Vector3(0, 0, 0), 9000));
    return out;
}
const roadIdx = new Map();
function nearestRoadYaw(g, x, z) {
    if (!roadIdx.size) {
        for (const e of g.edges){
            if (e.cls === 'service' || e.cls === 'local') continue;
            const n = normals(e.ref.pts);
            e.ref.pts.forEach((p, i)=>{
                const k = `${Math.floor(p[0] / 60)},${Math.floor(p[1] / 60)}`;
                if (!roadIdx.has(k)) roadIdx.set(k, []);
                roadIdx.get(k).push({
                    x: p[0],
                    z: p[1],
                    yaw: Math.atan2(n[i][0], n[i][1])
                });
            });
        }
    }
    let best = Infinity, yaw = 0;
    const cx = Math.floor(x / 60), cz = Math.floor(z / 60);
    for(let i = -1; i <= 1; i++)for(let j = -1; j <= 1; j++)for (const r of roadIdx.get(`${cx + i},${cz + j}`) ?? []){
        const d = (r.x - x) ** 2 + (r.z - z) ** 2;
        if (d < best) {
            best = d;
            yaw = Math.atan2(r.x - x, r.z - z);
        }
    }
    return yaw;
}
