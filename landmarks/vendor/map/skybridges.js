// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { sheen, textPanel } from '../landmarks/sheen.js';
import { normals, Soup } from './geom.js';
import { roadMask, sample } from './lanegraph.js';
import { litColor } from './materials.js';
import { box } from './roads.js';
const DECK = 1.2, CANOPY = 5.2, RAIL = 1.15;
function band(s, pts, ys, off, y0, y1, face) {
    if (pts.length < 2) return;
    const ns = normals(pts);
    for(let i = 0; i + 1 < pts.length; i++){
        const a = pts[i], b = pts[i + 1], na = ns[i], nb = ns[i + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
        const n = [
            nx * face,
            0,
            nz * face
        ];
        const v0 = s.vert(a[0] + na[0] * off, ys[i] + y0, a[1] + na[1] * off, n), v1 = s.vert(b[0] + nb[0] * off, ys[i + 1] + y0, b[1] + nb[1] * off, n);
        const v2 = s.vert(b[0] + nb[0] * off, ys[i + 1] + y1, b[1] + nb[1] * off, n), v3 = s.vert(a[0] + na[0] * off, ys[i] + y1, a[1] + na[1] * off, n);
        if (face > 0) s.quad(v0, v1, v2, v3);
        else s.quad(v0, v3, v2, v1);
    }
}
function plate(s, pts, ys, l, r, dy, up) {
    if (pts.length < 2) return;
    const ns = normals(pts);
    const n = [
        0,
        up,
        0
    ];
    for(let i = 0; i + 1 < pts.length; i++){
        const a = pts[i], b = pts[i + 1], na = ns[i], nb = ns[i + 1];
        const v0 = s.vert(a[0] + na[0] * l, ys[i] + dy, a[1] + na[1] * l, n), v1 = s.vert(a[0] + na[0] * r, ys[i] + dy, a[1] + na[1] * r, n);
        const v2 = s.vert(b[0] + nb[0] * r, ys[i + 1] + dy, b[1] + nb[1] * r, n), v3 = s.vert(b[0] + nb[0] * l, ys[i + 1] + dy, b[1] + nb[1] * l, n);
        if (up > 0) s.quad(v0, v3, v2, v1);
        else s.quad(v0, v1, v2, v3);
    }
}
const shortName = (n)=>n.replace(/^(North|South|East|West)\s/, '').replace(/\bBoulevard\b/, 'Blvd').replace(/\bAvenue\b/, 'Ave').replace(/\bRoad\b/, 'Rd').replace(/\bDrive\b/, 'Dr').toUpperCase();
export function buildSkybridges(data, g) {
    const out = new THREE.Group();
    out.name = 'pedestrian bridges';
    const deck = new Soup(), fascia = new Soup(), glass = new Soup(), steel = new Soup(), soffit = new Soup(), roof = new Soup(), tower = new Soup(), stone = new Soup(), truss = new Soup();
    const elevRoadEdges = g.edges.filter((e)=>e.elevated && !e.internal);
    const isHighwayBridgeSidewalk = (w)=>{
        if (w.fw === 'sidewalk' || w.fw === 'crossing' || w.fw === 'traffic_island' || w.fw === 'link') return true;
        const pts = w.pts;
        if (pts.length < 2) return false;
        const mid = pts[Math.floor(pts.length / 2)];
        const a = pts[0], b = pts[pts.length - 1], wl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const wx = (b[0] - a[0]) / wl, wz = (b[1] - a[1]) / wl;
        for (const e of elevRoadEdges){
            const ref = e.ref.pts;
            for(let k = 0; k < ref.length; k++){
                if (Math.hypot(ref[k][0] - mid[0], ref[k][1] - mid[1]) > 24) continue;
                const p0 = ref[Math.max(0, k - 1)], p1 = ref[Math.min(ref.length - 1, k + 1)], rl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
                const rx = (p1[0] - p0[0]) / rl, rz = (p1[1] - p0[1]) / rl;
                if (Math.abs(wx * rx + wz * rz) > 0.78) return true;
            }
        }
        return false;
    };
    const walks = data.walks.filter((w)=>w.y && !w.tn && !w.indoor && w.y.some((v)=>v > 1.5) && !isHighwayBridgeSidewalk(w));
    const isSpan = (w)=>!!w.br && w.hw !== 'steps' && !w.conv;
    const walkLen = (pts)=>pts.reduce((t, p, i)=>t + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    const onRoad = roadMask(g);
    const roads = g.edges.filter((e)=>(e.cls === 'arterial' || e.cls === 'collector') && e.way.name && !e.elevated);
    const groundRoads = g.edges.filter((e)=>!e.elevated && !e.internal && e.cls !== 'service');
    const crossesGroundRoad = (pts)=>{
        for(let i = 0; i + 1 < pts.length; i++){
            const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const steps = Math.max(1, Math.ceil(L / 4));
            for(let s = 0; s <= steps; s++){
                const x = a[0] + (b[0] - a[0]) * s / steps, z = a[1] + (b[1] - a[1]) * s / steps;
                for (const e of groundRoads){
                    for (const rp of e.ref.pts){
                        if (Math.hypot(rp[0] - x, rp[1] - z) < 12) return true;
                    }
                }
            }
        }
        return false;
    };
    const spanWalks = walks.filter(isSpan);
    const keptTer = [];
    const skipTerrace = new Set();
    for (const w of [
        ...spanWalks
    ].sort((a, b)=>walkLen(b.pts) - walkLen(a.pts))){
        const L = walkLen(w.pts);
        if (crossesGroundRoad(w.pts) || L < 14) continue;
        const mid = w.pts[Math.floor(w.pts.length / 2)];
        if (keptTer.some((k)=>Math.hypot(k.mid[0] - mid[0], k.mid[1] - mid[1]) < 8.5)) {
            skipTerrace.add(w);
        } else {
            keptTer.push({
                mid,
                L
            });
        }
    }
    const ends = new Map();
    const endKey = (p)=>`${Math.round(p[0] / 4)},${Math.round(p[1] / 4)}`;
    for (const w of walks)if (isSpan(w) && !skipTerrace.has(w)) for (const p of [
        w.pts[0],
        w.pts[w.pts.length - 1]
    ])ends.set(endKey(p), (ends.get(endKey(p)) ?? 0) + 1);
    const towers = new Set();
    for (const w of walks){
        if (skipTerrace.has(w)) continue;
        const rawYs = w.y, pts = w.pts;
        if (!isSpan(w)) {
            if (w.hw !== 'steps' && !w.conv) continue;
            if (pts.some((p, i)=>rawYs[i] < 4.5 && onRoad(p[0], p[1], 1.8))) continue;
            const ys = rawYs.map((v)=>Math.max(0, v));
            const W = w.conv ? 0.72 : 0.9;
            plate(deck, pts, ys, -W, W, 0, 1);
            for (const sd of [
                -1,
                1
            ])band(truss, pts, ys, sd * W, -0.45, 0.95, sd);
            plate(truss, pts, ys, -W, W, -0.45, -1);
            for(let i = 1; i + 1 < pts.length; i++)if (ys[i] > 2.5 && !onRoad(pts[i][0], pts[i][1], 1.2)) box(steel, pts[i][0], pts[i][1], 0.4, 0.4, 0, ys[i] - 0.35, 0);
            continue;
        }
        const L = walkLen(pts);
        const roadCrossing = crossesGroundRoad(pts);
        const ys = rawYs.map((v)=>Math.max(5.5, v));
        if (!roadCrossing || L < 14) {
            const W = roadCrossing ? 2.4 : 2.1;
            plate(deck, pts, ys, -W, W, 0, 1);
            plate(steel, pts, ys, -W - 0.08, W + 0.08, -DECK * 0.75, -1);
            for (const sd of [
                -1,
                1
            ]){
                band(fascia, pts, ys, sd * (W + 0.08), -DECK * 0.75, 0.1, sd);
                band(glass, pts, ys, sd * (W - 0.05), 0.05, RAIL, sd);
                band(steel, pts, ys, sd * (W - 0.02), RAIL, RAIL + 0.08, sd);
            }
            continue;
        }
        const W = 2.8;
        plate(deck, pts, ys, -W, W, 0, 1);
        plate(soffit, pts, ys, -W * 0.55, W * 0.55, -DECK - 0.02, -1);
        plate(steel, pts, ys, -W - 0.12, W + 0.12, -DECK, -1);
        for (const sd of [
            -1,
            1
        ]){
            band(fascia, pts, ys, sd * (W + 0.12), -DECK, 0.12, sd);
            band(glass, pts, ys, sd * (W - 0.06), 0.05, RAIL, sd);
            band(steel, pts, ys, sd * (W - 0.02), RAIL, RAIL + 0.1, sd);
        }
        let run = 0;
        for(let i = 0; i + 1 < pts.length; i++){
            const a = pts[i], b = pts[i + 1], segL = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (segL < 0.01) continue;
            const nx = -(b[1] - a[1]) / segL, nz = (b[0] - a[0]) / segL;
            for(; run < segL; run += 6){
                const t = run / segL, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = ys[i] + (ys[i + 1] - ys[i]) * t;
                for (const sd of [
                    -1,
                    1
                ])box(steel, x + nx * sd * (W - 0.1), z + nz * sd * (W - 0.1), 0.14, 0.14, y, y + CANOPY, 0);
            }
            run -= segL;
        }
        plate(roof, pts, ys, -W - 0.25, W + 0.25, CANOPY + 0.12, 1);
        plate(roof, pts, ys, -W - 0.25, W + 0.25, CANOPY, -1);
        for (const sd of [
            -1,
            1
        ])band(steel, pts, ys, sd * (W + 0.25), CANOPY, CANOPY + 0.12, sd);
        for (const [p, q, y] of [
            [
                pts[0],
                pts[1],
                ys[0]
            ],
            [
                pts[pts.length - 1],
                pts[pts.length - 2],
                ys[ys.length - 1]
            ]
        ]){
            if (L < 18 || ends.get(endKey(p)) !== 1 || towers.has(endKey(p)) || y < 4) continue;
            const dx = p[0] - q[0], dz = p[1] - q[1], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, nx = -uz, nz = ux;
            const yaw = Math.atan2(dx, dz);
            let placed = null;
            for (const [along, side] of [
                [
                    2.8,
                    0
                ],
                [
                    3.4,
                    3.2
                ],
                [
                    3.4,
                    -3.2
                ],
                [
                    1.8,
                    4.2
                ],
                [
                    1.8,
                    -4.2
                ]
            ]){
                const tx = p[0] + ux * along + nx * side, tz = p[1] + uz * along + nz * side;
                if (!onRoad(tx, tz, 3.2)) {
                    placed = [
                        tx,
                        tz
                    ];
                    break;
                }
            }
            if (!placed) continue;
            towers.add(endKey(p));
            const [cx, cz] = placed;
            box(tower, cx, cz, 4.6, 4.6, 0, y + CANOPY + 0.4, yaw);
            box(stone, cx, cz, 5.2, 5.2, y + CANOPY + 0.4, y + CANOPY + 1.1, yaw);
            box(stone, cx, cz, 5.0, 5.0, 0, 0.9, yaw);
        }
        if (L >= 18) {
            const line = {
                pts,
                y: ys,
                cum: pts.map((_, i)=>pts.slice(0, i + 1).reduce((t, p, k)=>t + (k ? Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0), 0)),
                length: L
            };
            const m = sample(line, L / 2);
            let best = 22, name;
            for (const e of roads){
                const ref = e.ref.pts;
                for(let k = 0; k < ref.length; k += 1){
                    const d = Math.hypot(ref[k][0] - m.x, ref[k][1] - m.z);
                    if (d >= best) continue;
                    const a = ref[Math.max(0, k - 1)], b = ref[Math.min(ref.length - 1, k + 1)], n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
                    if (Math.abs((b[0] - a[0]) / n * m.hx + (b[1] - a[1]) / n * m.hz) > 0.55) continue;
                    best = d;
                    name = e.way.name;
                }
            }
            if (name) for (const sd of [
                -1,
                1
            ]){
                const p = textPanel(shortName(name), Math.min(13, L * 0.5), 1.02, {
                    color: '#f5e7c4',
                    font: '600 74px Georgia, serif',
                    background: '#1d2b3a'
                });
                p.position.set(m.x - m.hz * sd * (W + 0.17), m.y - DECK / 2 + 0.06, m.z + m.hx * sd * (W + 0.17));
                p.rotation.y = Math.atan2(-m.hz * sd, m.hx * sd);
                out.add(p);
            }
        }
    }
    const add = (s, m, name)=>{
        if (!s.count) return;
        const o = new THREE.Mesh(s.geometry(), m);
        o.name = name;
        out.add(o);
    };
    const two = (m)=>{
        m.side = THREE.DoubleSide;
        return m;
    };
    add(deck, two(litColor('#d9d3c7')), 'bridge decks');
    add(fascia, two(sheen('#b6bcc2', {
        refl: 0.35,
        spec: 0.9
    })), 'bridge fascia');
    add(steel, two(litColor('#6a6f76')), 'bridge steel');
    add(roof, two(litColor('#8b9097')), 'bridge canopy');
    add(truss, two(litColor('#4a4d52')), 'escalator trusses');
    add(soffit, two(sheen('#fff4dc', {
        glow: '#ffd9a0',
        glowK: 1.6,
        baseGlow: 0.08
    })), 'bridge soffit');
    add(tower, sheen('#3b4a57', {
        refl: 0.6,
        spec: 1.1,
        glow: '#ffe1b0',
        glowK: 0.55
    }), 'bridge towers');
    add(stone, litColor('#cfc8ba'), 'tower caps');
    const gl = two(sheen('#9fc3cf', {
        refl: 0.7,
        spec: 1.4,
        opacity: 0.4
    }));
    gl.transparent = true;
    gl.depthWrite = false;
    add(glass, gl, 'bridge glass');
    return out;
}
