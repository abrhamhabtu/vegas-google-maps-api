// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { mergeGeometries } from '../three/BufferGeometryUtils.js';
import { roadMask, sample } from './lanegraph.js';
export const LENS_Y = 0.37;
const HEAD_Y = 5.75, MAX_ARM = 15;
export function planSignals(g) {
    const onRoad = roadMask(g);
    const arms = [], heads = [];
    const signals = (g.intersections ?? []).filter((i)=>i.control === 'signal');
    const stopOf = (a)=>{
        const e = g.edges[a.edge];
        return {
            e,
            p: sample(e.ref, Math.max(0, e.ref.length - a.stopAt))
        };
    };
    let farSide = 0;
    for (const i of signals){
        const near = signals.filter((o)=>Math.hypot(o.x - i.x, o.z - i.z) < 70);
        for (const leg of i.legs)for (const a of leg.approaches){
            if (!a.inbound) continue;
            const { e, p } = stopOf(a);
            if (e.cls === 'service' || !e.lanes.length) continue;
            const nx = -p.hz, nz = p.hx, W = e.lanes.length * e.laneWidth;
            let D = Infinity;
            const names = new Set();
            for (const o of near)for (const l2 of o.legs)for (const b of l2.approaches){
                const be = g.edges[b.edge];
                if (be.way.name && be.way.name !== e.way.name && Math.abs(sample(be.ref, be.ref.length).hx * p.hx + sample(be.ref, be.ref.length).hz * p.hz) < 0.6) names.add(be.way.name);
                if (!b.inbound || b.edge === a.edge) continue;
                const q = stopOf(b).p;
                if (q.hx * p.hx + q.hz * p.hz > -0.8) continue;
                const dx = q.x - p.x, dz = q.z - p.z, along = dx * p.hx + dz * p.hz;
                if (along > 9 && along < 110 && Math.abs(dx * nx + dz * nz) < 45 && along < D) D = along;
            }
            const outs = new Map();
            for (const o of near)for (const l2 of o.legs)for (const b of l2.approaches)if (!b.inbound) outs.set(b.edge, b);
            let lane = e.lanes.find((l)=>g.lanes[l].next.some((c)=>g.lanes[c].movement === 'through'));
            for(let step = 0; lane !== undefined && step < 6; step++){
                const c = g.lanes[lane].next.find((k)=>g.lanes[k].movement === 'through');
                if (c === undefined) break;
                const nextLane = g.lanes[c].next[0], ne = g.edges[g.lanes[nextLane].edge], out = outs.get(ne.id);
                if (out) {
                    const q = sample(ne.ref, Math.min(ne.ref.length, out.stopAt));
                    const along = (q.x - p.x) * p.hx + (q.z - p.z) * p.hz;
                    if (along > 6 && along < 130) D = along;
                    break;
                }
                if (ne.ref.length > 70) break;
                lane = nextLane;
            }
            const far = D !== Infinity;
            if (far) farSide++;
            let fwd = far ? D + 1.5 : 1.5;
            let bx = p.x + p.hx * fwd, bz = p.z + p.hz * fwd;
            const yaw = Math.atan2(-p.hx, -p.hz);
            const conn = new Set(e.lanes.flatMap((l)=>g.lanes[l].next));
            const clear = (u0, dir)=>{
                for(let k = 0; k <= 16; k++){
                    const u = u0 + dir * k;
                    if (!onRoad(bx + nx * u, bz + nz * u, 0.25)) return u;
                }
                return null;
            };
            let R = clear(W + 1.2, 1), Lp = W > 14 ? clear(-1.2, -1) : null;
            if (R === null && Lp === null) {
                fwd = 1.5;
                bx = p.x + p.hx * fwd;
                bz = p.z + p.hz * fwd;
                R = clear(W + 1.2, 1);
                Lp = clear(-1.2, -1);
                if (R === null && Lp === null) continue;
            }
            const span = R === null ? null : Math.min(MAX_ARM, R);
            let splitAt = 0;
            if (R !== null && span !== null) splitAt = Math.max(0, R - span);
            if (Lp === null && R !== null) splitAt = Math.max(0, R - Math.min(R, 24));
            const street = [
                ...names
            ].sort((x, y)=>x.length - y.length)[0];
            const label = e.cls === 'arterial' || e.cls === 'collector' ? street?.replace(/^(North|South|East|West)\s/, (m0)=>m0[0] + ' ').replace(/\bBoulevard\b/, 'Blvd').replace(/\bAvenue\b/, 'Ave').replace(/\bRoad\b/, 'Rd').replace(/\bDrive\b/, 'Dr').replace(/\bStreet\b/, 'St') : undefined;
            if (R === null) arms.push({
                px: bx + nx * Lp,
                pz: bz + nz * Lp,
                ax: bx + nx * (W - 0.3),
                az: bz + nz * (W - 0.3),
                yaw,
                name: label
            });
            if (R !== null) arms.push({
                px: bx + nx * R,
                pz: bz + nz * R,
                ax: bx + nx * splitAt,
                az: bz + nz * splitAt,
                yaw,
                name: label
            });
            if (Lp !== null && splitAt > 0.5) arms.push({
                px: bx + nx * Lp,
                pz: bz + nz * Lp,
                ax: bx + nx * splitAt,
                az: bz + nz * splitAt,
                yaw
            });
            e.lanes.forEach((l, k)=>{
                const u = (k + 0.5) * e.laneWidth, own = new Set(g.lanes[l].next);
                heads.push({
                    x: bx + nx * u,
                    z: bz + nz * u,
                    y: HEAD_Y,
                    yaw,
                    i,
                    greens: own.size ? own : conn
                });
            });
        }
    }
    return {
        arms,
        heads,
        farSide
    };
}
const paint = (g, color)=>{
    const out = g.index ? g.toNonIndexed() : g;
    out.deleteAttribute('uv');
    const c = new THREE.Color(color), n = out.attributes.position.count, arr = new Float32Array(n * 3);
    for(let i = 0; i < n; i++){
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
    }
    out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return out;
};
const BRONZE = '#3a3a38', POLE_FOOT = '#55544f';
export function signalPoleGeometry() {
    const pole = new THREE.CylinderGeometry(0.11, 0.19, 7.5, 8, 1, true).translate(0, 3.75, 0);
    const cap = new THREE.CylinderGeometry(0.02, 0.11, 0.14, 8).translate(0, 7.57, 0);
    const foot = new THREE.CylinderGeometry(0.34, 0.38, 0.5, 10).translate(0, 0.25, 0);
    const ped = new THREE.BoxGeometry(0.42, 0.46, 0.2).translate(0, 3.0, 0.24);
    const hand = new THREE.PlaneGeometry(0.28, 0.28).translate(0, 3.0, 0.345);
    return mergeGeometries([
        paint(pole, BRONZE),
        paint(cap, BRONZE),
        paint(foot, POLE_FOOT),
        paint(ped, '#1b1b1a'),
        paint(hand, '#a2470d')
    ]);
}
export function signalArmGeometry() {
    const tube = new THREE.CylinderGeometry(0.1, 0.05, 1, 6, 8, true);
    tube.rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
    const pos = tube.attributes.position;
    for(let i = 0; i < pos.count; i++){
        const x = pos.getX(i);
        pos.setY(i, pos.getY(i) + 0.55 * x * (2 - x) * 0.6);
    }
    tube.computeVertexNormals();
    return mergeGeometries([
        paint(tube, BRONZE)
    ]);
}
export function signalHeadGeometry() {
    const parts = [
        paint(new THREE.BoxGeometry(0.1, 1.15, 0.1).translate(0, 1.0, -0.02), BRONZE),
        paint(new THREE.BoxGeometry(0.36, 1.16, 0.22), '#121312'),
        paint(new THREE.BoxGeometry(0.72, 1.52, 0.02).translate(0, 0, -0.1), '#0b0b0b'),
        paint(new THREE.BoxGeometry(0.8, 1.6, 0.012).translate(0, 0, -0.114), '#c8a31c'),
        paint(new THREE.BoxGeometry(0.82, 1.62, 0.02).translate(0, 0, -0.13), '#0b0b0b')
    ];
    const lens = [
        '#2d0805',
        '#2b2105',
        '#05241a'
    ];
    [
        LENS_Y,
        0,
        -LENS_Y
    ].forEach((y, k)=>{
        parts.push(paint(new THREE.CircleGeometry(0.125, 10).translate(0, y, 0.115), lens[k]));
        const hood = new THREE.CylinderGeometry(0.15, 0.15, 0.24, 8, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, y, 0.23);
        parts.push(paint(hood, '#121312'));
    });
    return mergeGeometries(parts);
}
