// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { bakeStatic } from '../landmarks/bake.js';
import { glowPoints, nightAura, sheen, textPanel } from '../landmarks/sheen.js';
import { PLACES, placeXZ } from '../places.js';
import { RESORT_LOOKS } from './buildings.js';
import { Soup, normals, ringArea } from './geom.js';
import { isDrivable, isPassage, roadMask, sample } from './lanegraph.js';
import { flatMaterial, ORDER } from './materials.js';
import { MAIN_VALET, nearestDrive } from './valetstops.js';
import { litColor } from './materials.js';
import { palmGeometry } from './trees.js';
const CLEARANCE = 6.2;
const PIECE_MIN = 14;
const PIECE_MAX = 150;
const OPEN_MAX_H = 32;
function inside(pt, poly) {
    let c = false;
    for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if (zi > pt[1] !== zj > pt[1] && pt[0] < (xj - xi) * (pt[1] - zi) / (zj - zi) + xi) c = !c;
    }
    return c;
}
const centroid = (r)=>{
    let x = 0, z = 0;
    for (const p of r){
        x += p[0];
        z += p[1];
    }
    return [
        x / r.length,
        z / r.length
    ];
};
const isDrive = (r)=>(!r.tn || isPassage(r)) && (r.hw === 'service' ? r.svc !== 'parking_aisle' && r.svc !== 'emergency_access' && r.access !== 'no' : /_link$|tertiary|unclassified|residential/.test(r.hw));
const notAStructure = (b)=>/garage|parking|bridge|industrial|warehouse|house|detached|residential|apartments/.test(b.b ?? '') || /parking|garage/i.test(b.name ?? '');
export function planValets(data) {
    const cell = 80, grid = new Map();
    for (const b of data.buildings){
        if (b.h > 60 || notAStructure(b)) continue;
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const p of b.pts){
            x0 = Math.min(x0, p[0]);
            x1 = Math.max(x1, p[0]);
            z0 = Math.min(z0, p[1]);
            z1 = Math.max(z1, p[1]);
        }
        for(let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++)for(let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++){
            const k = `${i},${j}`;
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push(b);
        }
    }
    const pieces = [];
    const crossing = new Map();
    for (const r of data.roads){
        if (!isDrive(r)) continue;
        const open = new Map();
        const close = (b)=>{
            const cur = open.get(b);
            if (cur.pts.length >= 2) pieces.push({
                pts: cur.pts,
                len: cur.len,
                building: b,
                covered: !!r.cov || !!r.tn
            });
            open.delete(b);
        };
        for(let i = 0; i < r.pts.length - 1; i++){
            const a = r.pts[i], c = r.pts[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.ceil(L / 3));
            for(let k = 0; k <= n; k++){
                const p = [
                    a[0] + (c[0] - a[0]) * k / n,
                    a[1] + (c[1] - a[1]) * k / n
                ];
                const here = new Set((grid.get(`${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`) ?? []).filter((b)=>inside(p, b.pts)));
                for (const b of here){
                    let cur = open.get(b);
                    if (!cur) open.set(b, cur = {
                        pts: [],
                        len: 0
                    });
                    const last = cur.pts[cur.pts.length - 1];
                    if (last) cur.len += Math.hypot(p[0] - last[0], p[1] - last[1]);
                    cur.pts.push(p);
                    const t = crossing.get(b) ?? {
                        all: 0,
                        covered: 0
                    };
                    t.all += L / n;
                    if (r.cov || r.tn) t.covered += L / n;
                    crossing.set(b, t);
                }
                for (const b of [
                    ...open.keys()
                ])if (!here.has(b)) close(b);
            }
        }
        for (const b of [
            ...open.keys()
        ])close(b);
    }
    const canopies = new Set();
    for (const b of data.buildings){
        // Elevated architectural crowns are not drive-through canopies.
        if (b.b === 'roof' && b.h <= 60 && !b.name?.match(/conservatory/i)) {
            canopies.add(b);
            continue;
        }
        if (notAStructure(b) || b.h > 8.5 || Math.abs(ringArea(b.pts)) > 2600) continue;
        const t = crossing.get(b);
        if (t && t.covered >= 12) canopies.add(b);
    }
    const open = [], portals = [];
    for (const p of pieces){
        if (canopies.has(p.building) || p.len < PIECE_MIN) continue;
        if (p.len <= PIECE_MAX && p.building.h <= OPEN_MAX_H) open.push(p);
        else portals.push(p);
    }
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const r of data.roads)for (const p of r.pts){
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        z0 = Math.min(z0, p[1]);
        z1 = Math.max(z1, p[1]);
    }
    const S = 4096, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const X = (x)=>(x - x0) / (x1 - x0) * S, Z = (z)=>(z - z0) / (z1 - z0) * S;
    const stroke = (pts, width, color)=>{
        g.strokeStyle = color;
        g.lineWidth = width / (x1 - x0) * S;
        g.beginPath();
        pts.forEach((p, i)=>i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])));
        g.stroke();
    };
    for (const p of portals)stroke(p.pts, 9, '#ff0000');
    for (const p of open)stroke(p.pts, 16, '#00ff00');
    for (const r of data.roads){
        if (r.y && r.y.some((v)=>v > 2.5)) continue;
        if (!isDrivable(r) && !isDrive(r)) continue;
        const lanes = r.lanes ?? (r.ow ? r.hw === 'service' || r.hw.endsWith('_link') ? 1 : 2 : /primary|trunk/.test(r.hw) ? 4 : 2);
        const w = Math.max(8, lanes * 3.7 + 4.5);
        if (r.cov || r.tn) {
            stroke(r.pts, w, '#ff0000');
        } else if (r.hw !== 'service') {
            stroke(r.pts, w, '#0000ff');
        } else if (r.svc !== 'parking_aisle') {
            stroke(r.pts, 9.5, '#ff0000');
        }
    }
    const mask = new THREE.CanvasTexture(cv);
    mask.flipY = false;
    mask.generateMipmaps = false;
    mask.minFilter = mask.magFilter = THREE.LinearFilter;
    const zones = [];
    for (const b of canopies){
        const c = centroid(b.pts);
        if (nearestLook(c)) zones.push({
            x: c[0],
            z: c[1],
            r: 65
        });
    }
    for (const p of open){
        const c = p.pts[Math.floor(p.pts.length / 2)];
        zones.push({
            x: c[0],
            z: c[1],
            r: 65
        });
    }
    for (const c of Object.values(MAIN_VALET))zones.push({
        x: c[0],
        z: c[1],
        r: 85
    });
    return {
        canopies,
        crossing,
        open,
        portals,
        mask,
        maskOrigin: new THREE.Vector2(x0, z0),
        maskSize: new THREE.Vector2(x1 - x0, z1 - z0),
        zones
    };
}
function nearestPlace(c, within = 420) {
    let best = null, bd = within;
    for (const p of PLACES){
        if (!p.badge || p.noValetLook) continue;
        const [x, z] = placeXZ(p), d = Math.hypot(x - c[0], z - c[1]);
        if (d < bd) {
            bd = d;
            best = p;
        }
    }
    return best;
}
function nearestLook(c) {
    const p = nearestPlace(c);
    return p ? RESORT_LOOKS.find((l)=>l.re.test(p.name)) ?? null : null;
}
const dressCache = new Map();
function dressFor(c) {
    const look = nearestLook(c);
    const tint = look?.tint ?? '#d8d4cc', glow = look?.glow ?? '#ffe6c0', key = tint + glow;
    let d = dressCache.get(key);
    if (!d) {
        const base = new THREE.Color(tint).lerp(new THREE.Color('#e8e6e0'), 0.45);
        dressCache.set(key, d = {
            fascia: sheen(base, {
                refl: 0.12,
                spec: 0.5,
                glow,
                glowK: 0.5
            }),
            roof: sheen(new THREE.Color(tint).lerp(new THREE.Color('#9a9c9f'), 0.55), {
                refl: 0.08,
                glow,
                glowK: 0.12
            }),
            strip: sheen('#fbf8f0', {
                glow,
                glowK: 2.2,
                baseGlow: 0.08
            }),
            column: sheen(base.clone().multiplyScalar(0.8), {
                refl: 0.1,
                spec: 0.4
            }),
            soffit: sheen('#f5f0e4', {
                glow: '#ffe9c8',
                glowK: 1.5,
                baseGlow: 0.05
            }),
            pool: nightAura(glow, 0.16)
        });
    }
    return d;
}
function prism(g, ring, c, y0, y1, mat, scale = 1) {
    const r = ringArea(ring) > 0 ? ring : ring.slice().reverse();
    const shape = new THREE.Shape(r.map((p)=>new THREE.Vector2((p[0] - c[0]) * scale, -(p[1] - c[1]) * scale)));
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: y1 - y0,
        bevelEnabled: false
    });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y0;
    g.add(m);
}
export function buildValets(data, plan, graph) {
    const out = new THREE.Group();
    out.name = 'valets';
    const body = new THREE.Group();
    const palms = [];
    const lamps = [];
    const warm = new THREE.Color('#ffe7c2');
    const stops = [];
    const candidates = [];
    const canopyCenters = [];
    const onRoad = roadMask(graph);
    const stopAt = (name, c, main)=>{
        const hit = nearestDrive(graph, c);
        if (!hit) return false;
        const had = stops.find((o)=>o.name === name && o.edge === hit.edge && Math.abs(o.s - hit.s) < 1);
        if (had) had.main = had.main || main;
        else stops.push({
            name,
            main,
            ...hit
        });
        return true;
    };
    const list = [
        ...plan.canopies
    ];
    for (const b of list){
        const c = centroid(b.pts), area = Math.abs(ringArea(b.pts));
        let under = 0;
        for (const o of list){
            if (o === b || o.h >= b.h) continue;
            const oc = centroid(o.pts);
            if (Math.abs(oc[0] - c[0]) < 40 && Math.abs(oc[1] - c[1]) < 40 && inside(c, o.pts)) under = Math.max(under, o.h);
        }
        const y0 = under > 0 ? under : Math.max(CLEARANCE, b.mh ?? 0);
        const y1 = Math.max(b.h, y0 + (under > 0 ? 1.6 : 1.8));
        const d = dressFor(c);
        const g = new THREE.Group();
        g.position.set(c[0], 0, c[1]);
        prism(g, b.pts, c, y0, y1, d.fascia);
        prism(g, b.pts, c, y1, y1 + 0.12, d.roof, 0.97);
        if (area > 90) prism(g, b.pts, c, y0 + (y1 - y0) * 0.42, y0 + (y1 - y0) * 0.58, d.strip, 1.006);
        if (under === 0) {
            prism(g, b.pts, c, y0 - 0.06, y0, d.soffit, 0.985);
            const r = ringArea(b.pts) > 0 ? b.pts : b.pts.slice().reverse();
            const every = area > 800 ? 13 : 8;
            let acc = 0;
            for(let i = 0; i < r.length; i++){
                const p = r[i], q = r[(i + 1) % r.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
                for(let s = every - acc; s < L; s += every){
                    const t = s / L, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
                    if (onDrive(data, x, z, 4.8) || onRoad(x, z, 2.2)) continue;
                    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, y0, 10), d.column);
                    col.position.set(x - c[0], y0 / 2, z - c[1]);
                    g.add(col);
                }
                acc = (acc + L) % every;
            }
            if (area > 200) {
                const R = Math.min(30, Math.sqrt(area / Math.PI) * 1.5);
                const pool = new THREE.Mesh(new THREE.CircleGeometry(R, 24).rotateX(-Math.PI / 2), d.pool);
                pool.position.y = 0.55;
                g.add(pool);
                lamps.push({
                    x: c[0],
                    y: y0 - 0.3,
                    z: c[1],
                    color: warm,
                    size: 3.5
                });
            }
        }
        body.add(g);
        canopyCenters.push(c);
        const over = plan.crossing.get(b);
        const stacked = list.some((o)=>o !== b && o.h > b.h && inside(centroid(o.pts), b.pts));
        if (under === 0 && area > 200 && over && over.all > 8) candidates.push({
            c,
            size: area * 0.4 + (stacked ? 6000 : 0)
        });
    }
    for (const p of plan.open){
        const mid = p.pts[Math.floor(p.pts.length / 2)], d = dressFor(mid);
        const n = normals(p.pts), L0 = Math.max(0, Math.floor((p.pts.length - 1) / 2 - 7)), L1 = Math.min(p.pts.length - 1, Math.floor((p.pts.length - 1) / 2 + 7));
        const run = p.pts.slice(L0, L1 + 1), nr = n.slice(L0, L1 + 1);
        if (run.length < 2) continue;
        const soup = (hw, y0, y1)=>{
            const s = new Soup();
            const v = (i, side, y, nn)=>s.vert(run[i][0] + nr[i][0] * hw * side, y, run[i][1] + nr[i][1] * hw * side, nn);
            for(let i = 0; i < run.length - 1; i++){
                const t = [
                    v(i, -1, y1, [
                        0,
                        1,
                        0
                    ]),
                    v(i, 1, y1, [
                        0,
                        1,
                        0
                    ]),
                    v(i + 1, 1, y1, [
                        0,
                        1,
                        0
                    ]),
                    v(i + 1, -1, y1, [
                        0,
                        1,
                        0
                    ])
                ];
                s.quad(t[0], t[3], t[2], t[1]);
                for (const side of [
                    -1,
                    1
                ]){
                    const nn = [
                        nr[i][0] * side,
                        0,
                        nr[i][1] * side
                    ];
                    const w = [
                        v(i, side, y0, nn),
                        v(i + 1, side, y0, nn),
                        v(i + 1, side, y1, nn),
                        v(i, side, y1, nn)
                    ];
                    s.quad(w[0], w[1], w[2], w[3]);
                }
            }
            for (const [i, sign] of [
                [
                    0,
                    -1
                ],
                [
                    run.length - 1,
                    1
                ]
            ]){
                const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
                const nn = [
                    dx / L * sign,
                    0,
                    dz / L * sign
                ];
                const w = [
                    v(i, -1, y0, nn),
                    v(i, 1, y0, nn),
                    v(i, 1, y1, nn),
                    v(i, -1, y1, nn)
                ];
                s.quad(w[0], w[1], w[2], w[3]);
            }
            return s.geometry();
        };
        const g = new THREE.Group();
        g.add(new THREE.Mesh(soup(9.5, CLEARANCE, CLEARANCE + 1.7), d.fascia));
        g.add(new THREE.Mesh(soup(9.7, CLEARANCE + 0.65, CLEARANCE + 1.05), d.strip));
        g.add(new THREE.Mesh(soup(6.5, CLEARANCE + 1.7, CLEARANCE + 3), d.fascia));
        g.add(new THREE.Mesh(soup(6.6, CLEARANCE + 3, CLEARANCE + 3.15), d.roof));
        g.add(new THREE.Mesh(soup(9.2, CLEARANCE - 0.06, CLEARANCE), d.soffit));
        for(let i = 0; i < run.length; i += 4)for (const side of [
            -1,
            1
        ]){
            const cx = run[i][0] + nr[i][0] * 8.6 * side, cz = run[i][1] + nr[i][1] * 8.6 * side;
            if (onDrive(data, cx, cz, 4.2) || onRoad(cx, cz, 2.2)) continue;
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, CLEARANCE, 10), d.column);
            col.position.set(cx, CLEARANCE / 2, cz);
            g.add(col);
        }
        const pool = new THREE.Mesh(new THREE.CircleGeometry(24, 24).rotateX(-Math.PI / 2), d.pool);
        pool.position.set(mid[0], 0.55, mid[1]);
        g.add(pool);
        body.add(g);
        canopyCenters.push(mid);
        lamps.push({
            x: mid[0],
            y: CLEARANCE - 0.3,
            z: mid[1],
            color: warm,
            size: 3.5
        });
        if (p.covered || p.len > 25) candidates.push({
            c: mid,
            size: Math.min(p.len, 60) * 16 * (p.covered ? 1.2 : 0.5)
        });
    }
    const best = new Map();
    for (const k of candidates){
        const name = campusAt(data, k.c);
        if (!name) continue;
        stopAt(name, k.c, false);
        const cur = best.get(name);
        if (!cur || k.size > cur.size) best.set(name, k);
    }
    for (const [name, c] of Object.entries(MAIN_VALET)){
        best.delete(name);
        stopAt(name, c, true);
        entrance(c, name);
    }
    for (const [name, k] of best)if (stopAt(name, k.c, true)) entrance(k.c, name);
    const bays = new Soup();
    for (const st of stops){
        if (!st.main) continue;
        const e = graph.edges[st.edge];
        const W = e.lanes.length * e.laneWidth, s0 = Math.max(0, st.s - 11), s1 = Math.min(e.ref.length, st.s + 11);
        if (s1 - s0 < 6) continue;
        for(let d = s0; d < s1; d += 2){
            const p = sample(e.ref, d), nx = -p.hz, nz = p.hx;
            const q = [
                [
                    W + 0.1,
                    0
                ],
                [
                    W + 2.6,
                    0
                ],
                [
                    W + 2.6,
                    0.32
                ],
                [
                    W + 0.1,
                    0.32
                ]
            ].map(([u, v])=>bays.vert(p.x + nx * u + p.hx * v, 0, p.z + nz * u + p.hz * v));
            bays.quad(q[0], q[1], q[2], q[3]);
        }
    }
    if (bays.idx.length) {
        const m = new THREE.Mesh(bays.geometry(), flatMaterial('paint'));
        m.renderOrder = ORDER.paint + 1;
        out.add(m);
    }
    function entrance(c, resortName = '') {
        const g = new THREE.Group();
        g.position.set(c[0], 0, c[1]);
        const nearDrive = driveDir(data, c);
        const hasNearbyCanopy = canopyCenters.some((q)=>Math.hypot(q[0] - c[0], q[1] - c[1]) < 32);
        if (!hasNearbyCanopy) {
            const d = dressFor(c);
            const canopyGrp = new THREE.Group();
            canopyGrp.rotation.y = nearDrive;
            const spanW = 16.4, spanL = 22.0, h0 = CLEARANCE, h1 = CLEARANCE + 1.65, h2 = CLEARANCE + 2.85;
            const soffitMesh = new THREE.Mesh(new THREE.BoxGeometry(spanW - 0.5, 0.1, spanL - 0.5), d.soffit);
            soffitMesh.position.y = h0 - 0.05;
            const mainFascia = new THREE.Mesh(new THREE.BoxGeometry(spanW, h1 - h0, spanL), d.fascia);
            mainFascia.position.y = (h0 + h1) * 0.5;
            const glowBand = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.25, 0.36, spanL + 0.25), d.strip);
            glowBand.position.y = h0 + (h1 - h0) * 0.5;
            const crownTier = new THREE.Mesh(new THREE.BoxGeometry(spanW * 0.72, h2 - h1, spanL * 0.76), d.fascia);
            crownTier.position.y = (h1 + h2) * 0.5;
            const crownRoof = new THREE.Mesh(new THREE.BoxGeometry(spanW * 0.75, 0.18, spanL * 0.79), d.roof);
            crownRoof.position.y = h2 + 0.09;
            canopyGrp.add(soffitMesh, mainFascia, glowBand, crownTier, crownRoof);
            const cs = Math.cos(nearDrive), sn = Math.sin(nearDrive);
            for (const sz of [
                -7.6,
                7.6
            ])for (const side of [
                -1,
                1
            ]){
                let placedX = null;
                for (const absX of [
                    7.8,
                    9.6,
                    11.4
                ]){
                    const lx = side * absX;
                    const wx = c[0] + lx * cs + sz * sn, wz = c[1] - lx * sn + sz * cs;
                    if (!onDrive(data, wx, wz, 3.8) && !onRoad(wx, wz, 2.0)) {
                        placedX = lx;
                        break;
                    }
                }
                if (placedX !== null) {
                    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, h0, 12), d.column);
                    col.position.set(placedX, h0 * 0.5, sz);
                    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.64, 0.85, 12), d.fascia);
                    plinth.position.set(placedX, 0.425, sz);
                    canopyGrp.add(col, plinth);
                }
            }
            const pool = new THREE.Mesh(new THREE.CircleGeometry(18, 24).rotateX(-Math.PI / 2), d.pool);
            pool.position.y = 0.52;
            canopyGrp.add(pool);
            g.add(canopyGrp);
            canopyCenters.push(c);
            lamps.push({
                x: c[0],
                y: h0 - 0.25,
                z: c[1],
                color: warm,
                size: 3.6
            });
        }
        const planter = sheen('#c9c3b6', {
            refl: 0.05
        }), green = litColor('#4f8a45');
        for (const [dx, dz] of [
            [
                -15,
                -13
            ],
            [
                15,
                13
            ],
            [
                -15,
                13
            ],
            [
                15,
                -13
            ]
        ]){
            const x = c[0] + dx, z = c[1] + dz;
            if (onDrive(data, x, z, 5) || onRoad(x, z, 2.2)) continue;
            const box = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.7, 14), planter);
            box.position.set(dx, 0.35, dz);
            const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.16, 14), green);
            top.position.set(dx, 0.75, dz);
            g.add(box, top);
            if (!onRoad(x, z, 0.8)) palms.push([
                x,
                z
            ]);
        }
        const labelTxt = resortName ? `${resortName.toUpperCase()} · VALET` : 'VALET';
        const sign = textPanel(labelTxt, resortName ? 6.4 : 3.6, 1.15, {
            font: '700 120px "Helvetica Neue", Arial, sans-serif',
            color: '#ffffff',
            background: '#1a2a44'
        });
        sign.position.set(0, CLEARANCE - 0.52, 0);
        sign.rotation.y = nearDrive;
        sign.userData.keep = true;
        g.add(sign);
        out.add(bakeStatic(g, (o)=>o.userData.keep === true));
    }
    out.add(bakeStatic(body));
    if (palms.length) {
        const inst = new THREE.InstancedMesh(palmGeometry(), litColor('#ffffff', {
            vertexColors: true
        }), palms.length);
        const m = new THREE.Matrix4(), s = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion(), p = new THREE.Vector3();
        palms.forEach(([x, z], i)=>{
            p.set(x, 0.7, z);
            inst.setMatrixAt(i, m.compose(p, q, s));
        });
        inst.computeBoundingSphere();
        inst.frustumCulled = false;
        out.add(inst);
    }
    if (lamps.length) out.add(glowPoints(lamps, 'night', 1.5, 0.9));
    return {
        group: out,
        stops
    };
}
const CAMPUS = [
    [
        'Mandalay Bay',
        /^mandalay bay|^delano|^w las vegas|four seasons/i
    ],
    [
        'Luxor',
        /^luxor/i
    ],
    [
        'Excalibur',
        /^excalibur/i
    ],
    [
        'New York-New York',
        /^new york.new york/i
    ],
    [
        'MGM Grand',
        /^mgm grand|signature at mgm/i
    ],
    [
        'Park MGM',
        /^park mgm|nomad/i
    ],
    [
        'ARIA',
        /^aria|^vdara|crystals/i
    ],
    [
        'The Cosmopolitan',
        /cosmopolitan/i
    ],
    [
        'Bellagio',
        /^bellagio/i
    ],
    [
        'Paris Las Vegas',
        /^paris/i
    ],
    [
        'Horseshoe',
        /horseshoe|bally/i
    ],
    [
        'Planet Hollywood',
        /planet hollywood|miracle mile/i
    ],
    [
        'Caesars Palace',
        /^caesars|forum shops|octavius|augustus|nobu/i
    ],
    [
        'Flamingo Las Vegas',
        /^flamingo/i
    ],
    [
        'The LINQ',
        /linq|harrah/i
    ],
    [
        'The Venetian',
        /venetian|palazzo/i
    ],
    [
        'Treasure Island',
        /treasure island/i
    ],
    [
        'Wynn Las Vegas',
        /^wynn/i
    ],
    [
        'Encore',
        /^encore/i
    ],
    [
        'Resorts World',
        /^resorts world/i
    ],
    [
        'Fontainebleau',
        /^fontainebleau/i
    ],
    [
        'Circus Circus',
        /^circus circus|adventuredome/i
    ],
    [
        'Sahara',
        /^sahara/i
    ],
    [
        'The STRAT',
        /^the strat|stratosphere/i
    ],
    [
        'Rio',
        /^rio\b/i
    ],
    [
        'Palms',
        /^palms/i
    ]
];
function campusAt(data, c) {
    let best = null, bd = 45;
    for (const b of data.buildings){
        if (!b.name || /parking|garage/i.test(b.name)) continue;
        const site = CAMPUS.find(([, re])=>re.test(b.name));
        if (!site) continue;
        if (inside(c, b.pts)) return site[0];
        for (const p of b.pts){
            const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
            if (d < bd) {
                bd = d;
                best = site[0];
            }
        }
    }
    return best;
}
let driveGrid = null;
function drives(data) {
    if (driveGrid) return driveGrid;
    driveGrid = new Map();
    for (const r of data.roads){
        if (!isDrive(r)) continue;
        for(let i = 0; i < r.pts.length - 1; i++){
            const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 30));
            for(let k = 0; k <= n; k++){
                const key = `${Math.floor((a[0] + (b[0] - a[0]) * k / n) / 30)},${Math.floor((a[1] + (b[1] - a[1]) * k / n) / 30)}`;
                if (!driveGrid.has(key)) driveGrid.set(key, []);
                driveGrid.get(key).push([
                    a,
                    b
                ]);
            }
        }
    }
    return driveGrid;
}
function nearestSeg(data, x, z) {
    let best = {
        d: Infinity,
        yaw: 0
    };
    const cx = Math.floor(x / 30), cz = Math.floor(z / 30), g = drives(data);
    for(let i = -1; i <= 1; i++)for(let j = -1; j <= 1; j++)for (const [a, b] of g.get(`${cx + i},${cz + j}`) ?? []){
        const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
        if (d < best.d) best = {
            d,
            yaw: Math.atan2(dx, dz)
        };
    }
    return best;
}
function onDrive(data, x, z, clear = 4.5) {
    return nearestSeg(data, x, z).d < clear;
}
function driveDir(data, c) {
    return nearestSeg(data, c[0], c[1]).yaw;
}
