// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { Chunked } from './geom.js';
import { sample } from './lanegraph.js';
import { ORDER, themed } from './materials.js';
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
    const usable = (e)=>!!e.way.name && !e.elevated && (e.cls === 'arterial' || e.cls === 'collector' || e.cls === 'local');
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
    for (const e of g.edges){
        if (!usable(e) || !e.oneway && e.twin !== undefined && e.id > e.twin) continue;
        const r = rects.get(e.way.name);
        if (!r) continue;
        const textH = e.cls === 'arterial' ? 2.6 : 2.1;
        const textL = r.w / RH * textH;
        if (e.ref.length < textL + 50) continue;
        const across = e.oneway ? e.lanes.length * e.laneWidth / 2 : 0;
        const spacing = e.cls === 'arterial' ? 260 : 200;
        for(let s = Math.max(25 + textL / 2, e.ref.length / 2 - Math.floor((e.ref.length / 2 - 25 - textL / 2) / spacing) * spacing); s < e.ref.length - 25 - textL / 2; s += spacing){
            const a = sample(e.ref, s - textL / 2), b = sample(e.ref, s + textL / 2), m = sample(e.ref, s);
            if (a.hx * b.hx + a.hz * b.hz < 0.985) continue;
            const nx = -m.hz, nz = m.hx;
            const cx = m.x + nx * across, cz = m.z + nz * across;
            const prev = placed.get(e.way.name) ?? [];
            if (prev.some(([px, pz])=>Math.hypot(px - cx, pz - cz) < spacing * 0.8)) continue;
            prev.push([
                cx,
                cz
            ]);
            placed.set(e.way.name, prev);
            let rx = m.hx, rz = m.hz;
            if (rx < -0.05 || Math.abs(rx) <= 0.05 && rz > 0) {
                rx = -rx;
                rz = -rz;
            }
            const ux = rz, uz = -rx;
            const hl = textL / 2, hh = textH / 2;
            const soup = ch.at(cx, cz);
            const v0 = soup.vert(cx - rx * hl - ux * hh, 0, cz - rz * hl - uz * hh);
            const v1 = soup.vert(cx + rx * hl - ux * hh, 0, cz + rz * hl - uz * hh);
            const v2 = soup.vert(cx + rx * hl + ux * hh, 0, cz + rz * hl + uz * hh);
            const v3 = soup.vert(cx - rx * hl + ux * hh, 0, cz - rz * hl + uz * hh);
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
        opacity: 0.9
    }), 'paintDim');
    const grp = new THREE.Group();
    grp.name = 'street-names';
    for (const mesh of ch.meshes(mat, 'names', ORDER.paint + 3))grp.add(mesh);
    return grp;
}
