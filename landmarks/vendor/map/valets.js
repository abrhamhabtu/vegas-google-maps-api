// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { bakeStatic } from '../landmarks/bake.js';
import { glowPoints, nightAura, sheen, textPanel } from '../landmarks/sheen.js';
import { SHADOW_PARS, shadowUniforms } from '../core/shadows.js';
import { theme } from '../core/theme.js';
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
        const w = Math.max(9.5, lanes * 3.7 + 6.0);
        if (r.cov || r.tn) {
            stroke(r.pts, w, '#ff0000');
        } else if (r.hw !== 'service') {
            stroke(r.pts, w, '#0000ff');
        } else if (r.svc !== 'parking_aisle') {
            stroke(r.pts, 10.5, '#ff0000');
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
const RESORT_VALET_STYLES = [
    { re: /bellagio/i, fascia: '#eadcc3', trim: '#7a5f3b', glow: '#ffd48e', apron: '#b59a7d', signBg: '#1b2e4d', signFg: '#f5e1b8' },
    { re: /caesars/i, fascia: '#f2ece0', trim: '#c8a24e', glow: '#ffebc0', apron: '#c6b79f', signBg: '#4a1822', signFg: '#f7e0a8' },
    { re: /venetian|palazzo/i, fascia: '#efe0c4', trim: '#b87344', glow: '#ffd99c', apron: '#bfa282', signBg: '#5c1f28', signFg: '#f7e2b5' },
    { re: /wynn|encore/i, fascia: '#b89f82', trim: '#7d5d38', glow: '#ffc870', apron: '#625951', signBg: '#2a1e16', signFg: '#f3d7a2' },
    { re: /mgm grand/i, fascia: '#e2ddd2', trim: '#1e6b4c', glow: '#86e5ba', apron: '#4e5854', signBg: '#144d36', signFg: '#f0d796' },
    { re: /aria|vdara/i, fascia: '#cad4e0', trim: '#435061', glow: '#dbeeff', apron: '#49505a', signBg: '#1f2630', signFg: '#eef3f8' },
    { re: /cosmopolitan/i, fascia: '#3e4350', trim: '#9b4dca', glow: '#e6b8ff', apron: '#41454f', signBg: '#181a22', signFg: '#f2e8ff' },
    { re: /paris/i, fascia: '#ede0c4', trim: '#3b4e75', glow: '#ffe0a3', apron: '#7c7a76', signBg: '#1d366e', signFg: '#f6d36b' },
    { re: /flamingo/i, fascia: '#f0e8ec', trim: '#e84894', glow: '#ff74cc', apron: '#a89695', signBg: '#b8256b', signFg: '#ffffff' },
    { re: /mandalay bay/i, fascia: '#e8d4ad', trim: '#b8892c', glow: '#ffd27a', apron: '#b39876', signBg: '#4a3514', signFg: '#fff0c4' },
    { re: /luxor/i, fascia: '#3c404e', trim: '#c9a244', glow: '#ffdb85', apron: '#464852', signBg: '#181b26', signFg: '#f0d68a' },
    { re: /excalibur/i, fascia: '#eae0cf', trim: '#b83238', glow: '#ffd79a', apron: '#8a8276', signBg: '#7d1d22', signFg: '#f5e2b5' },
    { re: /new york/i, fascia: '#dfd5c6', trim: '#415b76', glow: '#ffe0a8', apron: '#63676e', signBg: '#1d324a', signFg: '#f5e7c8' },
    { re: /park mgm|nomad/i, fascia: '#e4dfd3', trim: '#2c5840', glow: '#ffe7be', apron: '#75736e', signBg: '#1d3d2c', signFg: '#f2ead8' },
    { re: /treasure island/i, fascia: '#ecd4b0', trim: '#c85a48', glow: '#ffba78', apron: '#a69076', signBg: '#41296b', signFg: '#ffd996' },
    { re: /resorts world/i, fascia: '#e8e4de', trim: '#b02344', glow: '#ff708a', apron: '#4a4d54', signBg: '#8f1834', signFg: '#ffffff' },
    { re: /fontainebleau/i, fascia: '#eef2f8', trim: '#1c488f', glow: '#b8dcff', apron: '#c4c9d1', signBg: '#122b59', signFg: '#eef5ff' },
    { re: /strat/i, fascia: '#d8dde4', trim: '#d95448', glow: '#ff9c8a', apron: '#50545c', signBg: '#222733', signFg: '#ff9285' },
    { re: /planet hollywood/i, fascia: '#d6d4e0', trim: '#6b489b', glow: '#d2b4ff', apron: '#53515c', signBg: '#2a1d42', signFg: '#f0e2ff' },
    { re: /linq|harrah/i, fascia: '#e4e0da', trim: '#2e6b9e', glow: '#9cd8ff', apron: '#666b73', signBg: '#1a3a59', signFg: '#eef7ff' },
    { re: /horseshoe|bally/i, fascia: '#e8dfd0', trim: '#9e2a2b', glow: '#ffd699', apron: '#756f68', signBg: '#5e1718', signFg: '#f7e0b0' },
];
function valetStyleFor(c, resortName = '') {
    const name = resortName || nearestPlace(c)?.name || '';
    const preset = RESORT_VALET_STYLES.find((s)=>s.re.test(name));
    if (preset) return preset;
    const look = nearestLook(c);
    return {
        fascia: look?.tint ?? '#dedad2',
        trim: look?.roof ?? '#6b6862',
        glow: look?.glow ?? '#ffe6c0',
        apron: '#7a7772',
        signBg: '#1a2a44',
        signFg: '#ffffff'
    };
}
const dressCache = new Map();
function dressFor(c, resortName = '') {
    const st = valetStyleFor(c, resortName);
    const key = `${st.fascia}|${st.trim}|${st.glow}`;
    let d = dressCache.get(key);
    if (!d) {
        const base = new THREE.Color(st.fascia).lerp(new THREE.Color('#eae8e2'), 0.28);
        const trimCol = new THREE.Color(st.trim);
        const colBase = base.clone().multiplyScalar(0.84);
        dressCache.set(key, d = {
            style: st,
            fascia: sheen(base, {
                refl: 0.14,
                spec: 0.48,
                glow: st.glow,
                glowK: 0.42
            }),
            trim: sheen(trimCol, {
                refl: 0.22,
                spec: 0.65,
                glow: st.glow,
                glowK: 0.22
            }),
            roof: sheen(base.clone().lerp(new THREE.Color('#8e9296'), 0.58), {
                refl: 0.08,
                glow: st.glow,
                glowK: 0.1
            }),
            strip: sheen('#fcf9f2', {
                glow: st.glow,
                glowK: 2.35,
                baseGlow: 0.1
            }),
            column: sheen(colBase, {
                refl: 0.12,
                spec: 0.44
            }),
            plinth: sheen(colBase.clone().multiplyScalar(0.82), {
                refl: 0.08,
                spec: 0.3
            }),
            soffit: sheen('#f7f1e3', {
                glow: '#ffe6be',
                glowK: 1.65,
                baseGlow: 0.08
            }),
            coffer: sheen('#ddd5c6', {
                refl: 0.05,
                glow: '#ffdfb0',
                glowK: 0.45
            }),
            bollard: sheen('#3a3e46', {
                refl: 0.28,
                spec: 0.72
            }),
            bollardCap: sheen('#fff6e0', {
                glow: st.glow,
                glowK: 1.8,
                baseGlow: 0.08
            }),
            pool: nightAura(st.glow, 0.16)
        });
    }
    return d;
}
let paverTexCache = null;
function paverTexture() {
    if (paverTexCache) return paverTexCache;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#cfccc4';
    ctx.fillRect(0, 0, 256, 256);
    const rows = 8, cols = 4, rh = 256 / rows, cw = 256 / cols;
    let seed = 4219;
    const rnd = ()=>{
        seed = seed * 16807 % 2147483647;
        return (seed - 1) / 2147483646;
    };
    for(let r = 0; r < rows; r++){
        const off = r % 2 ? cw * 0.5 : 0;
        for(let c = -1; c <= cols; c++){
            const shade = 200 + Math.round((rnd() - 0.5) * 20);
            ctx.fillStyle = `rgb(${shade},${shade - 2},${shade - 5})`;
            ctx.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
        }
    }
    ctx.fillStyle = 'rgba(42,40,38,0.28)';
    for(let r = 0; r < rows; r++){
        ctx.fillRect(0, r * rh - 1, 256, 2);
        const off = r % 2 ? cw * 0.5 : 0;
        for(let c = 0; c <= cols; c++)ctx.fillRect((c * cw + off) % 256 - 1, r * rh, 2, rh);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    paverTexCache = tex;
    return tex;
}
const apronMatCache = new Map();
function apronMaterial(colorHex) {
    let m = apronMatCache.get(colorHex);
    if (!m) {
        const u = theme.uniforms;
        apronMatCache.set(colorHex, m = new THREE.ShaderMaterial({
            uniforms: {
                ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
                ...shadowUniforms,
                uColor: { value: new THREE.Color(colorHex) },
                uMap: { value: paverTexture() },
                uSunDir: u.uSunDir,
                uSun: u.uSun,
                uAmbient: u.uAmbient,
                uSunTint: u.uSunTint,
                uAmbientTint: u.uAmbientTint,
                uNight: u.uNight
            },
            vertexShader: `
              #include <common>
              #include <fog_pars_vertex>
              varying vec3 vW;
              void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vW = wp.xyz;
                vec4 mvPosition = viewMatrix * wp;
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
              }
            `,
            fragmentShader: `
              #include <common>
              #include <fog_pars_fragment>
              uniform vec3 uColor, uSunDir, uSunTint, uAmbientTint;
              uniform float uSun, uAmbient, uNight;
              uniform sampler2D uMap;
              varying vec3 vW;
              ${SHADOW_PARS}
              void main() {
                vec3 tex = texture2D(uMap, vW.xz / 4.2).rgb;
                vec3 base = uColor * (0.78 + 0.34 * tex);
                float key = max(uSunDir.y, 0.0);
                vec3 light = (uAmbient * uAmbientTint + uSun * key * uSunTint) * mix(1.0, 0.58, uNight * uNight) * shadowAt(vW);
                gl_FragColor = vec4(base * light, 1.0);
                #include <fog_fragment>
                #include <colorspace_fragment>
              }
            `,
            fog: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -2
        }));
    }
    return m;
}
function addArchitecturalColumn(parent, x, z, baseY, h, d, radiusTop = 0.34, radiusBot = 0.40) {
    const shaftH = Math.max(1.2, h - 1.15);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(radiusBot * 1.28, radiusBot * 1.42, 0.78, 12), d.plinth);
    plinth.position.set(x, baseY + 0.39, z);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBot, shaftH, 12), d.column);
    col.position.set(x, baseY + 0.78 + shaftH * 0.5, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop * 1.45, radiusTop * 1.06, 0.37, 12), d.trim);
    cap.position.set(x, baseY + h - 0.185, z);
    parent.add(plinth, col, cap);
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
    const canopyPolys = [];
    const openCenters = [];
    const onRoad = roadMask(graph);
    const groundYAt = (c)=>{
        const hit = nearestDrive(graph, c, 20);
        if (!hit) return 0;
        const e = graph.edges[hit.edge];
        return e ? Math.max(0, sample(e.ref, hit.s).y) : 0;
    };
    const stopAt = (name, c, main)=>{
        const hit = nearestDrive(graph, c);
        if (!hit) return null;
        const had = stops.find((o)=>o.name === name && o.edge === hit.edge && Math.abs(o.s - hit.s) < 1);
        if (had) {
            had.main = had.main || main;
            return had;
        }
        const entry = {
            name,
            main,
            ...hit
        };
        stops.push(entry);
        return entry;
    };
    const list = [
        ...plan.canopies
    ];
    const pubGrid = [];
    for (const e of graph.edges) {
        if (e.cls === 'service' || e.elevated || e.lanes.length < 3) continue;
        const hw = e.lanes.reduce((a, id)=>a + graph.lanes[id].width, 0) * 0.5;
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const p of e.ref.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
        pubGrid.push({ pts: e.ref.pts, hw: hw + 0.6, x0: x0 - hw - 2, x1: x1 + hw + 2, z0: z0 - hw - 2, z1: z1 + hw + 2 });
    }
    const onPublicMultiLane = (x, z)=>{
        for (const r of pubGrid) {
            if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
            for (let k = 0; k + 1 < r.pts.length; k++) {
                const a = r.pts[k], b = r.pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
                const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
                if (Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)) < r.hw) return true;
            }
        }
        return false;
    };
    for (const rawB of list){
        const rawClear = rawB.pts.filter((p)=>!onPublicMultiLane(p[0], p[1]));
        let b = rawB;
        if (rawClear.length >= Math.ceil(rawB.pts.length * 0.5) && rawClear.length < rawB.pts.length) {
            const safe = centroid(rawClear);
            b = { ...rawB, pts: rawB.pts.map((p)=>{
                if (!onPublicMultiLane(p[0], p[1])) return p;
                let lo = 0, hi = 1;
                for (let step = 0; step < 8; step++) {
                    const m = (lo + hi) * 0.5;
                    if (onPublicMultiLane(p[0] + (safe[0] - p[0]) * m, p[1] + (safe[1] - p[1]) * m)) lo = m;
                    else hi = m;
                }
                return [p[0] + (safe[0] - p[0]) * hi, p[1] + (safe[1] - p[1]) * hi];
            }) };
        }
        const c = centroid(b.pts), area = Math.abs(ringArea(b.pts));
        let under = 0;
        for (const o of list){
            if (o === b || o.h >= b.h) continue;
            const oc = centroid(o.pts);
            if (Math.abs(oc[0] - c[0]) < 40 && Math.abs(oc[1] - c[1]) < 40 && inside(c, o.pts)) under = Math.max(under, o.h);
        }
        const baseY = under > 0 ? 0 : groundYAt(c);
        const y0 = under > 0 ? Math.max(under, CLEARANCE + 1.8) : Math.max(baseY + CLEARANCE, b.mh ?? 0);
        const y1 = Math.max(b.h + baseY, y0 + (under > 0 ? 1.55 : 1.85));
        const d = dressFor(c);
        const g = new THREE.Group();
        g.position.set(c[0], 0, c[1]);
        // Architectural multi-layer canopy: main fascia, crisp upper/lower cornice trims, recessed roof & accent light band
        prism(g, b.pts, c, y0, y1, d.fascia);
        prism(g, b.pts, c, y1 - 0.16, y1 + 0.08, d.trim, 1.014);
        prism(g, b.pts, c, y1 + 0.08, y1 + 0.22, d.roof, 0.965);
        if (area > 90) {
            prism(g, b.pts, c, y0 + (y1 - y0) * 0.43, y0 + (y1 - y0) * 0.57, d.strip, 1.008);
            prism(g, b.pts, c, y0 - 0.04, y0 + 0.14, d.trim, 1.01);
        }
        if (under === 0) {
            // Recessed coffered soffit rim + warm illuminated ceiling pan
            prism(g, b.pts, c, y0 - 0.12, y0, d.coffer, 0.988);
            prism(g, b.pts, c, y0 - 0.06, y0 - 0.01, d.soffit, 0.93);
            // Strict lane & drive clearance so columns NEVER clip into drivable valet lanes or custom motor courts
            const inCustomCourt = (wx, wz) =>
                (wx > -79.8 && wx < -50.2 && wz > 454 && wz < 506) ||
                (wx > 1.2 && wx < 22.5 && wz > -16 && wz < 35) ||
                (wx > -79.0 && wx < 17.0 && wz > 798 && wz < 852) ||
                (Math.hypot(wx - (-107.5), wz - 995.5) < 42.5) ||
                (Math.hypot(wx - 692.5, wz - (-1233.5)) < 34.0) ||
                (wx > 840 && wx < 958 && wz > -1532 && wz < -1454) ||
                (wx > 324 && wx < 520 && wz > -605 && wz < -435) ||
                (wx > 418 && wx < 484 && wz > -876 && wz < -786) ||
                (wx > 495 && wx < 622 && wz > 1582 && wz < 1685) ||
                (wx > 16 && wx < 98 && wz > 2620 && wz < 2736);
            const r = ringArea(b.pts) > 0 ? b.pts : b.pts.slice().reverse();
            const every = area > 800 ? 13 : 8.5;
            let acc = 0;
            for(let i = 0; i < r.length; i++){
                const p = r[i], q = r[(i + 1) % r.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
                for(let s = every - acc; s < L; s += every){
                    const t = s / L, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
                    if (inCustomCourt(x, z) || onDrive(data, x, z, 4.9) || onRoad(x, z, 2.4)) continue;
                    addArchitecturalColumn(g, x - c[0], z - c[1], baseY, y0 - baseY, d, 0.33, 0.40);
                }
                acc = (acc + L) % every;
            }
            if (area > 200) {
                const R = Math.min(28, Math.sqrt(area / Math.PI) * 1.45);
                const pool = new THREE.Mesh(new THREE.CircleGeometry(R, 24).rotateX(-Math.PI / 2), d.pool);
                pool.position.y = baseY + 0.55;
                g.add(pool);
                lamps.push({
                    x: c[0],
                    y: y0 - 0.25,
                    z: c[1],
                    color: warm,
                    size: 3.6
                });
            }
            canopyPolys.push({ pts: b.pts, c });
        }
        body.add(g);
        const over = plan.crossing.get(b);
        const stacked = list.some((o)=>o !== b && o.h > b.h && inside(centroid(o.pts), b.pts));
        if (under === 0 && area > 200 && over && over.all > 8) candidates.push({
            c,
            size: area * 0.4 + (stacked ? 6000 : 0)
        });
    }
    const insideExistingCanopy = (pt, pad = 12)=>canopyPolys.some(({ pts, c })=>inside(pt, pts) || Math.hypot(pt[0] - c[0], pt[1] - c[1]) < pad);
    for (const p of plan.open){
        const mid = p.pts[Math.floor(p.pts.length / 2)];
        // Skip open-passage canopy when an OSM roof canopy already covers this spot (prevents Caesars Palace overlap/z-fighting)
        if (insideExistingCanopy(mid, 14)) continue;
        const d = dressFor(mid);
        const baseY = groundYAt(mid);
        const h0 = baseY + CLEARANCE;
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
        g.add(new THREE.Mesh(soup(9.5, h0, h0 + 1.7), d.fascia));
        g.add(new THREE.Mesh(soup(9.75, h0 + 0.68, h0 + 1.04), d.strip));
        g.add(new THREE.Mesh(soup(9.8, h0 + 1.56, h0 + 1.78), d.trim));
        g.add(new THREE.Mesh(soup(6.6, h0 + 1.75, h0 + 2.95), d.fascia));
        g.add(new THREE.Mesh(soup(6.8, h0 + 2.95, h0 + 3.12), d.roof));
        g.add(new THREE.Mesh(soup(9.2, h0 - 0.1, h0), d.coffer));
        g.add(new THREE.Mesh(soup(8.4, h0 - 0.05, h0 - 0.01), d.soffit));
        for(let i = 0; i < run.length; i += 4)for (const side of [
            -1,
            1
        ]){
            const cx = run[i][0] + nr[i][0] * 8.6 * side, cz = run[i][1] + nr[i][1] * 8.6 * side;
            if (onDrive(data, cx, cz, 4.5) || onRoad(cx, cz, 2.4)) continue;
            addArchitecturalColumn(g, cx, cz, baseY, h0 - baseY, d, 0.35, 0.42);
        }
        const pool = new THREE.Mesh(new THREE.CircleGeometry(24, 24).rotateX(-Math.PI / 2), d.pool);
        pool.position.set(mid[0], baseY + 0.55, mid[1]);
        g.add(pool);
        body.add(g);
        openCenters.push(mid);
        lamps.push({
            x: mid[0],
            y: h0 - 0.25,
            z: mid[1],
            color: warm,
            size: 3.6
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
        const st = stopAt(name, c, true);
        entrance(c, name, st);
    }
    for (const [name, k] of best){
        const st = stopAt(name, k.c, true);
        if (st) entrance(k.c, name, st);
    }
    // Crisp resort-matched paved drop-off aprons & painted valet/rideshare stall markings aligned to lane graph
    const apronSoups = new Map();
    const bays = new Soup();
    for (const st of stops){
        if (!st.main) continue;
        // Custom multi-lane porte-cochere motor courts handle their own pavement and markings
        if (/^(bellagio|caesars palace|the cosmopolitan|aria|wynn las vegas|encore|the venetian|mgm grand|mandalay bay)$/i.test(st.name ?? '')) continue;
        const e = graph.edges[st.edge];
        if (!e) continue;
        const W = e.lanes.length * e.laneWidth;
        const halfW = W * 0.5;
        const s0 = Math.max(0.5, st.s - 15), s1 = Math.min(e.ref.length - 0.5, st.s + 15);
        if (s1 - s0 < 5) continue;
        const style = valetStyleFor([st.x, st.z], st.name);
        let apron = apronSoups.get(style.apron);
        if (!apron) apronSoups.set(style.apron, apron = new Soup());
        // Paved stone/slate drop-off apron covering the drivable lane width under the porte-cochère
        const step = 2.0;
        const apronPts = [];
        for(let d = s0; d <= s1 + 0.01; d = Math.min(s1, d + step)){
            apronPts.push(sample(e.ref, d));
            if (d >= s1) break;
        }
        const apronHalf = halfW - 0.08;
        for(let i = 0; i < apronPts.length - 1; i++){
            const a = apronPts[i], b = apronPts[i + 1];
            const nax = -a.hz, naz = a.hx, nbx = -b.hz, nbz = b.hx;
            const v0 = apron.vert(a.x - nax * apronHalf, a.y, a.z - naz * apronHalf);
            const v1 = apron.vert(a.x + nax * apronHalf, a.y, a.z + naz * apronHalf);
            const v2 = apron.vert(b.x + nbx * apronHalf, b.y, b.z + nbz * apronHalf);
            const v3 = apron.vert(b.x - nbx * apronHalf, b.y, b.z - nbz * apronHalf);
            apron.quad(v0, v1, v2, v3);
        }
        // Subtle painted valet/rideshare drop-off zone border + curb-side stall dividers + entry chevron
        const bayS0 = Math.max(s0 + 1.0, st.s - 10.5), bayS1 = Math.min(s1 - 1.0, st.s + 10.5);
        if (bayS1 - bayS0 >= 5.5) {
            const laneRight = halfW - 0.22;
            const laneInner = Math.max(-halfW + 0.35, laneRight - 2.35);
            const addStripe = (d0, d1, u0, u1)=>{
                const p0 = sample(e.ref, d0), p1 = sample(e.ref, d1);
                const n0x = -p0.hz, n0z = p0.hx, n1x = -p1.hz, n1z = p1.hx;
                const q0 = bays.vert(p0.x + n0x * u0, p0.y, p0.z + n0z * u0);
                const q1 = bays.vert(p0.x + n0x * u1, p0.y, p0.z + n0z * u1);
                const q2 = bays.vert(p1.x + n1x * u1, p1.y, p1.z + n1z * u1);
                const q3 = bays.vert(p1.x + n1x * u0, p1.y, p1.z + n1z * u0);
                bays.quad(q0, q1, q2, q3);
            };
            // Longitudinal drop-off bay boundary line along inner edge of curb-side drop-off lane
            for(let d = bayS0; d < bayS1 - 0.1; d += 2.0){
                const dn = Math.min(bayS1, d + 2.0);
                addStripe(d, dn, laneInner - 0.06, laneInner + 0.06);
                addStripe(d, dn, laneRight - 0.06, laneRight + 0.06);
            }
            // Crisp stall divider ticks every 5.2m (standard rideshare/valet drop-off bay length)
            for(let d = bayS0; d <= bayS1 + 0.05; d += 5.2){
                const dEnd = Math.min(bayS1, d + 0.14);
                addStripe(d, dEnd, laneInner, laneRight);
            }
            // Subtle directional flow chevron on approach
            const chevD = bayS0 + 1.8;
            if (chevD + 1.5 < bayS1) {
                const pc = sample(e.ref, chevD);
                const nx = -pc.hz, nz = pc.hx, uMid = (laneInner + laneRight) * 0.5;
                for (const side of [-1, 1]) {
                    const q0 = bays.vert(pc.x + nx * (uMid + side * 0.55), pc.y, pc.z + nz * (uMid + side * 0.55));
                    const q1 = bays.vert(pc.x + nx * uMid + pc.hx * 0.85, pc.y, pc.z + nz * uMid + pc.hz * 0.85);
                    const q2 = bays.vert(pc.x + nx * uMid + pc.hx * 1.12, pc.y, pc.z + nz * uMid + pc.hz * 1.12);
                    const q3 = bays.vert(pc.x + nx * (uMid + side * 0.55) + pc.hx * 0.27, pc.y, pc.z + nz * (uMid + side * 0.55) + pc.hz * 0.27);
                    bays.quad(q0, q1, q2, q3);
                }
            }
        }
    }
    for (const [apronHex, soup] of apronSoups){
        if (!soup.idx.length) continue;
        const m = new THREE.Mesh(soup.geometry(), apronMaterial(apronHex));
        m.renderOrder = ORDER.road + 4.5;
        out.add(m);
    }
    if (bays.idx.length) {
        const m = new THREE.Mesh(bays.geometry(), flatMaterial('paint'));
        m.renderOrder = ORDER.paint + 1;
        out.add(m);
    }
    function entrance(c, resortName = '', stop = null) {
        const edge = stop ? graph.edges[stop.edge] : null;
        const laneSample = edge ? sample(edge.ref, stop.s) : null;
        const anchor = laneSample ? [laneSample.x, laneSample.z] : c;
        const baseY = laneSample ? Math.max(0, laneSample.y) : 0;
        const roadW = edge ? edge.lanes.length * edge.laneWidth : 6.0;
        const nearDrive = laneSample ? Math.atan2(laneSample.hx, laneSample.hz) : driveDir(data, anchor);
        const cs = Math.cos(nearDrive), sn = Math.sin(nearDrive);
        const g = new THREE.Group();
        g.position.set(anchor[0], 0, anchor[1]);
        const d = dressFor(anchor, resortName);
        // Only skip building a porte-cochère if the stop itself is actually covered by an existing canopy
        const isCovered = canopyPolys.some(({ pts, c: cc })=>inside(anchor, pts) || inside(c, pts) || Math.hypot(cc[0] - anchor[0], cc[1] - anchor[1]) < 14) || openCenters.some((q)=>Math.hypot(q[0] - anchor[0], q[1] - anchor[1]) < 12);
        const h0 = baseY + CLEARANCE;
        let spanL = 22.0;
        if (!isCovered) {
            const canopyGrp = new THREE.Group();
            canopyGrp.rotation.y = nearDrive;
            const spanW = Math.max(15.6, Math.min(22.0, roadW + 9.2));
            spanL = 24.0;
            const h1 = h0 + 1.75, h2 = h0 + 2.95;
            // Warm recessed coffered ceiling (perimeter soffit frame + 3x4 architectural coffer beams)
            const soffitPan = new THREE.Mesh(new THREE.BoxGeometry(spanW - 0.8, 0.08, spanL - 0.8), d.soffit);
            soffitPan.position.y = h0 - 0.04;
            canopyGrp.add(soffitPan);
            for (const bx of [-spanW * 0.24, 0, spanW * 0.24]) {
                const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, spanL - 0.6), d.coffer);
                beam.position.set(bx, h0 - 0.09, 0);
                canopyGrp.add(beam);
            }
            for (const bz of [-spanL * 0.32, -spanL * 0.11, spanL * 0.11, spanL * 0.32]) {
                const cross = new THREE.Mesh(new THREE.BoxGeometry(spanW - 0.6, 0.18, 0.28), d.coffer);
                cross.position.set(0, h0 - 0.09, bz);
                canopyGrp.add(cross);
            }
            // Crisp lower eave molding, main dressed-stone/metal fascia, illuminated resort accent band, stepped crown & roof
            const lowerTrim = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.36, 0.18, spanL + 0.36), d.trim);
            lowerTrim.position.y = h0 + 0.05;
            const mainFascia = new THREE.Mesh(new THREE.BoxGeometry(spanW, h1 - h0, spanL), d.fascia);
            mainFascia.position.y = (h0 + h1) * 0.5;
            const glowBand = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.26, 0.30, spanL + 0.26), d.strip);
            glowBand.position.y = h0 + (h1 - h0) * 0.52;
            const upperCornice = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.56, 0.22, spanL + 0.56), d.trim);
            upperCornice.position.y = h1 + 0.05;
            const crownTier = new THREE.Mesh(new THREE.BoxGeometry(spanW * 0.74, h2 - h1, spanL * 0.78), d.fascia);
            crownTier.position.y = (h1 + h2) * 0.5 + 0.08;
            const crownRoof = new THREE.Mesh(new THREE.BoxGeometry(spanW * 0.78, 0.18, spanL * 0.82), d.roof);
            crownRoof.position.y = h2 + 0.16;
            canopyGrp.add(lowerTrim, mainFascia, glowBand, upperCornice, crownTier, crownRoof);
            // Structural columns placed strictly on curbs/islands (NEVER clipping into drivable valet lanes!)
            const minColX = Math.max(spanW * 0.44, roadW * 0.5 + 2.2);
            for (const sz of [-8.6, 0, 8.6]) for (const side of [-1, 1]){
                let placedX = null;
                for (const absX of [minColX, minColX + 1.6, minColX + 3.2]){
                    const lx = side * absX;
                    const wx = anchor[0] + lx * cs + sz * sn, wz = anchor[1] - lx * sn + sz * cs;
                    if (!onDrive(data, wx, wz, 4.2) && !onRoad(wx, wz, 2.2)) {
                        placedX = lx;
                        break;
                    }
                }
                if (placedX !== null) {
                    addArchitecturalColumn(canopyGrp, placedX, sz, baseY, h0 - baseY, d, 0.34, 0.42);
                }
            }
            const pool = new THREE.Mesh(new THREE.CircleGeometry(19, 24).rotateX(-Math.PI / 2), d.pool);
            pool.position.y = baseY + 0.52;
            canopyGrp.add(pool);
            g.add(canopyGrp);
            openCenters.push(anchor);
            // Warm recessed coffered downlights along the porte-cochère
            for (const lz of [-6.5, 0, 6.5]) {
                lamps.push({
                    x: anchor[0] + lz * sn,
                    y: h0 - 0.18,
                    z: anchor[1] + lz * cs,
                    color: warm,
                    size: 3.4
                });
            }
        }
        // Drive-aligned landscaped entry planters & subtle illuminated safety bollards (strictly clear of traffic!)
        const planter = sheen('#cdc6b8', { refl: 0.06 }), planterRim = sheen('#dfd9cc', { refl: 0.08 }), green = litColor('#4b8742');
        const planterOffsetX = Math.max(8.2, roadW * 0.5 + 4.8);
        for (const [lx, lz] of [
            [-planterOffsetX, -13.5],
            [planterOffsetX, -13.5],
            [-planterOffsetX, 13.5],
            [planterOffsetX, 13.5]
        ]){
            const wx = anchor[0] + lx * cs + lz * sn, wz = anchor[1] - lx * sn + lz * cs;
            // Never plant a palm inside a porte-cochere canopy footprint (prevents palms poking through roofs!)
            if (insideExistingCanopy([wx, wz], 3.0) || onDrive(data, wx, wz, 5.2) || onRoad(wx, wz, 2.5)) continue;
            const dx = wx - anchor[0], dz = wz - anchor[1];
            const box = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.35, 0.68, 16), planter);
            box.position.set(dx, baseY + 0.34, dz);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.28, 2.24, 0.12, 16), planterRim);
            rim.position.set(dx, baseY + 0.68, dz);
            const top = new THREE.Mesh(new THREE.CylinderGeometry(1.98, 2.02, 0.16, 16), green);
            top.position.set(dx, baseY + 0.74, dz);
            g.add(box, rim, top);
            if (!onRoad(wx, wz, 1.2)) palms.push([wx, wz, baseY + 0.72]);
        }
        // Subtle architectural curb-side bollards framing the drop-off zone (strictly on curb/sidewalk, clear of lanes)
        const bollardOffsetX = Math.max(5.6, roadW * 0.5 + 1.9);
        const skipBollards = /^(bellagio|caesars palace)$/i.test(resortName);
        if (!skipBollards) for (const lz of [-9.0, -3.0, 3.0, 9.0]) for (const side of [-1, 1]){
            const lx = side * bollardOffsetX;
            const wx = anchor[0] + lx * cs + lz * sn, wz = anchor[1] - lx * sn + lz * cs;
            if (onDrive(data, wx, wz, 3.8) || onRoad(wx, wz, 1.6)) continue;
            const dx = wx - anchor[0], dz = wz - anchor[1];
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.88, 10), d.bollard);
            post.position.set(dx, baseY + 0.44, dz);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), d.bollardCap);
            cap.position.set(dx, baseY + 0.90, dz);
            g.add(post, cap);
        }
        // Resort-matched architectural VALET signage (double-sided, mounted on entry/exit fascia or suspended under OSM canopy)
        const labelTxt = resortName ? `${resortName.toUpperCase()} · VALET` : 'VALET';
        const signW = resortName ? 6.6 : 3.8, signH = 1.12;
        const signZList = isCovered ? [0] : [-(spanL * 0.5 + 0.22), spanL * 0.5 + 0.22];
        const signY = isCovered ? h0 - 0.56 : h0 + 0.88;
        for (const signZ of signZList) {
            const sign = textPanel(labelTxt, signW, signH, {
                font: '700 112px "Helvetica Neue", Arial, sans-serif',
                color: d.style.signFg,
                background: d.style.signBg
            });
            sign.material.side = THREE.DoubleSide;
            sign.position.set(signZ * sn, signY, signZ * cs);
            sign.rotation.y = nearDrive;
            sign.userData.keep = true;
            g.add(sign);
        }
        out.add(bakeStatic(g, (o)=>o.userData.keep === true));
    }
    out.add(bakeStatic(body));
    if (palms.length) {
        const inst = new THREE.InstancedMesh(palmGeometry(), litColor('#ffffff', {
            vertexColors: true
        }), palms.length);
        const m = new THREE.Matrix4(), s = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion(), p = new THREE.Vector3();
        palms.forEach(([x, z, py = 0.7], i)=>{
            p.set(x, py, z);
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
