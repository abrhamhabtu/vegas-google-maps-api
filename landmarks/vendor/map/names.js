// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { Chunked } from './geom.js';
import { boundaryAt, edgeLine, sample } from './lanegraph.js';
import { ORDER, themed } from './materials.js';
import { offsetStation } from '../../../world/road-visuals.mjs';
const ABBR = [
    [
        /\bNorth\b/g,
        'N'
    ],
    [
        /\bSouth\b/g,
        'S'
    ],
    [
        /\bEast\b/g,
        'E'
    ],
    [
        /\bWest\b/g,
        'W'
    ],
    [
        /\bRoad\b/g,
        'RD'
    ],
    [
        /\bAvenue\b/g,
        'AVE'
    ],
    [
        /\bBoulevard\b/g,
        'BLVD'
    ],
    [
        /\bDrive\b/g,
        'DR'
    ],
    [
        /\bStreet\b/g,
        'ST'
    ],
    [
        /\bLane\b/g,
        'LN'
    ],
    [
        /\bParkway\b/g,
        'PKWY'
    ],
    [
        /\bCircle\b/g,
        'CIR'
    ],
    [
        /\bCourt\b/g,
        'CT'
    ],
    [
        /\bPlace\b/g,
        'PL'
    ],
    [
        /\bHighway\b/g,
        'HWY'
    ],
    [
        /\bExpressway\b/g,
        'EXPY'
    ]
];
export function shortName(n) {
    let s = n;
    for (const [re, r] of ABBR)s = s.replace(re, r);
    return s.toUpperCase();
}
export function buildStreetNames(g) {
    const len = new Map();
    const usable = (e)=>!!e.way.name && !e.internal && !/_link$/.test(e.way.hw) && (e.cls === 'arterial' || e.cls === 'collector' || e.cls === 'local');
    for (const e of g.edges)if (usable(e)) len.set(e.way.name, (len.get(e.way.name) ?? 0) + e.ref.length);
    const names = [
        ...len.entries()
    ].sort((a, b)=>b[1] - a[1]).map(([n])=>n).slice(0, 260);
    const W = 4096, RH = 64, FONT = 46;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = 4096;
    const ctx = cv.getContext('2d');
    ctx.font = `700 ${FONT}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    const rects = new Map();
    let x = 0, y = 0;
    for (const n of names){
        const label = shortName(n).split('').join(' ');
        const w = Math.ceil(ctx.measureText(label).width) + 24;
        if (x + w > W) {
            x = 0;
            y += RH;
        }
        if (y + RH > cv.height) break;
        ctx.fillText(label, x + 12, y + RH / 2 + 2);
        rects.set(n, {
            x,
            y,
            w
        });
        x += w;
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const ch = new Chunked(1400);
    const placed = new Map();
    const clearStart = new Map(), clearEnd = new Map();
    for (const ix of g.intersections ?? []) for (const leg of ix.legs) for (const approach of leg.approaches) {
        const reserve = approach.stopAt + (approach.inbound ? 20 : 4);
        (approach.inbound ? clearEnd : clearStart).set(approach.edge, reserve);
    }
    for (const e of g.edges){
        if (!usable(e) || !e.oneway && e.twin !== undefined && e.id > e.twin) continue;
        const r = rects.get(e.way.name);
        if (!r) continue;
        const textH = e.cls === 'arterial' ? 2.15 : 1.8;
        const textL = r.w / RH * textH;
        const from = (clearStart.get(e.id) ?? (e.prev !== undefined ? 3 : 13)) + textL / 2;
        const to = e.ref.length - (clearEnd.get(e.id) ?? (e.next !== undefined ? 3 : 17)) - textL / 2;
        if (to < from) continue;
        const midLane = (e.lanes.length - 1) / 2;
        const through = e.turns.map((_, i)=>i).filter((i)=>e.turns[i]?.includes('through'));
        const lane = through.reduce((best, i)=>Math.abs(i - midLane) < Math.abs(best - midLane) ? i : best, through[0] ?? Math.floor(midLane));
        const width = (d)=>boundaryAt(e, lane + 1, d) - boundaryAt(e, lane, d);
        const center = edgeLine(e, (d)=>(boundaryAt(e, lane, d) + boundaryAt(e, lane + 1, d)) / 2);
        const point = (d)=>sample(center, offsetStation(e.ref, center, d));
        const spacing = e.cls === 'arterial' ? 105 : 160;
        const first = (from + to) / 2 - Math.floor((to - from) / (2 * spacing)) * spacing;
        for(let s = first; s <= to; s += spacing){
            const a = point(s - textL / 2), b = point(s + textL / 2), m = point(s);
            if (a.hx * b.hx + a.hz * b.hz < 0.985 || Math.min(width(s - textL / 2), width(s + textL / 2)) < textH + 0.32) continue;
            const cx = m.x, cz = m.z;
            const prev = placed.get(e.way.name) ?? [];
            if (prev.some(([px, pz, hx, hz])=>Math.hypot(px - cx, pz - cz) < spacing * 0.8 && (!e.oneway || hx * m.hx + hz * m.hz > 0))) continue;
            prev.push([cx, cz, m.hx, m.hz]);
            placed.set(e.way.name, prev);
            const flip = m.hx < -0.05 || Math.abs(m.hx) <= 0.05 && m.hz > 0;
            const [start, end] = flip ? [b, a] : [a, b];
            const length = Math.hypot(end.x - start.x, end.z - start.z) || 1;
            const rx = (end.x - start.x) / length, rz = (end.z - start.z) / length;
            const ux = rz, uz = -rx;
            const hh = textH / 2;
            const elevated = e.ref.y.some((y)=>y > 0.4);
            const height = (q)=>elevated ? Math.max(0, q.y) + 0.11 : 0;
            const soup = ch.at(cx, cz);
            const v0 = soup.vert(start.x - ux * hh, height(start), start.z - uz * hh);
            const v1 = soup.vert(end.x - ux * hh, height(end), end.z - uz * hh);
            const v2 = soup.vert(end.x + ux * hh, height(end), end.z + uz * hh);
            const v3 = soup.vert(start.x + ux * hh, height(start), start.z + uz * hh);
            soup.quad(v0, v1, v2, v3);
            const u0 = r.x / W, u1 = (r.x + r.w) / W, vt = 1 - r.y / cv.height, vb = 1 - (r.y + RH) / cv.height;
            soup.uv.push(u0, vb, u1, vb, u1, vt, u0, vt);
        }
    }
    const mat = themed(new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0.78
    }), 'paint');
    const grp = new THREE.Group();
    grp.name = 'street-names';
    for (const mesh of ch.meshes(mat, 'names', ORDER.paint + 3))grp.add(mesh);
    return grp;
}
