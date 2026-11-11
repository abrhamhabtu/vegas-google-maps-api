// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { latLonToXZ } from '../core/data.js';
import { sample } from '../map/lanegraph.js';
import { ORIGIN } from '../places.js';
const SERIF = 'Didot, "Bodoni 72", Georgia, "Times New Roman", serif';
const SANS = '"Helvetica Neue", "SF Pro Display", Arial, sans-serif';
const SIGNS = [
    {
        lat: 36.1024,
        lon: -115.1699,
        text: 'MGM GRAND',
        font: `700 96px ${SERIF}`,
        color: '#f6e7a6',
        both: true
    },
    // Caesars Palace and Paris signs are positioned on their models in world/four-corners.js.
    // Flamingo's rooftop wordmarks are drawn by world/four-corners.js.
    {
        lat: 36.0986,
        lon: -115.1754,
        text: 'EXCALIBUR',
        font: `800 96px ${SERIF}`,
        color: '#ff5a50'
    },
    {
        lat: 36.1024,
        lon: -115.1747,
        text: 'NEW YORK-NEW YORK',
        font: `800 80px ${SANS}`,
        color: '#ffffff'
    },
    // Rio's signed towers and street marquee are supplied by world/rio.js.
    {
        lat: 36.1140,
        lon: -115.1946,
        text: 'PALMS',
        font: `800 120px ${SANS}`,
        color: '#8ff4ff',
        both: true
    },
    {
        lat: 36.1215,
        lon: -115.1689,
        text: 'THE VENETIAN',
        font: `600 90px ${SERIF}`,
        color: '#ffe2a8'
    },
    {
        lat: 36.1240,
        lon: -115.1679,
        text: 'THE PALAZZO',
        font: `600 90px ${SERIF}`,
        color: '#ffe2a8'
    },
    {
        lat: 36.1182,
        lon: -115.1707,
        text: 'LINQ',
        font: `900 130px ${SANS}`,
        color: '#ffffff'
    },
    {
        lat: 36.1192,
        lon: -115.1712,
        text: "Harrah's",
        font: `italic 800 120px ${SERIF}`,
        color: '#ff5a5a'
    },
    {
        lat: 36.1100,
        lon: -115.1712,
        text: 'PLANET HOLLYWOOD',
        font: `800 84px ${SANS}`,
        color: '#f5d6ff'
    },
    {
        lat: 36.1072,
        lon: -115.1768,
        text: 'ARIA',
        font: `300 130px ${SANS}`,
        color: '#ffffff',
        both: true
    },
    {
        lat: 36.1425,
        lon: -115.1564,
        text: 'SAHARA',
        font: `700 110px ${SERIF}`,
        color: '#ffcf8a',
        both: true
    },
    {
        lat: 36.1135,
        lon: -115.1706,
        text: 'HORSESHOE',
        font: `800 92px ${SERIF}`,
        color: '#ffd27a'
    },
    {
        lat: 36.1046,
        lon: -115.1762,
        text: 'PARK MGM',
        font: `700 92px ${SANS}`,
        color: '#f2e6c8'
    },
    {
        lat: 36.1720,
        lon: -115.1462,
        text: 'CIRCA',
        font: `800 130px ${SANS}`,
        color: '#ffb36b',
        both: true
    },
    {
        lat: 36.1700,
        lon: -115.1455,
        text: 'GOLDEN NUGGET',
        font: `700 90px ${SERIF}`,
        color: '#ffd76b'
    }
];
export function buildSigns(data, g) {
    const RW = 2048, RH = 192;
    const cv = document.createElement('canvas');
    cv.width = RW;
    cv.height = RH * SIGNS.length;
    const ctx = cv.getContext('2d');
    const widths = [];
    SIGNS.forEach((s, i)=>{
        ctx.font = s.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = Math.min(RW - 40, ctx.measureText(s.text).width + 40);
        widths.push(w);
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, RW / 2, i * RH + RH / 2 + 6, RW - 60);
        ctx.shadowBlur = 0;
        ctx.fillText(s.text, RW / 2, i * RH + RH / 2 + 6, RW - 60);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const strip = [];
    for (const e of g.edges)if (/Las Vegas Boulevard/.test(e.way.name ?? '') && e.cls === 'arterial') for(let s = 0; s < e.ref.length; s += 40){
        const p = sample(e.ref, s);
        strip.push([
            p.x,
            p.z
        ]);
    }
    const pos = [], uv = [], idx = [];
    const tall = data.buildings.filter((b)=>b.h > 45);
    SIGNS.forEach((s, i)=>{
        const [ax, az] = latLonToXZ(ORIGIN, s.lat, s.lon);
        let best, bh = 0;
        for (const b of tall){
            const c = centroid(b.pts);
            if (Math.hypot(c[0] - ax, c[1] - az) < 170 && b.h > bh) {
                bh = b.h;
                best = b;
            }
        }
        if (!best) return;
        const c = centroid(best.pts);
        let dir = [
            1,
            0
        ], bd = Infinity;
        for (const p of strip){
            const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
            if (d < bd) {
                bd = d;
                dir = [
                    p[0] - c[0],
                    p[1] - c[1]
                ];
            }
        }
        const L = Math.hypot(dir[0], dir[1]) || 1;
        dir = [
            dir[0] / L,
            dir[1] / L
        ];
        const aspect = widths[i] / RH;
        for (const sign of s.both ? [
            1,
            -1
        ] : [
            1
        ]){
            const d = [
                dir[0] * sign,
                dir[1] * sign
            ];
            let t = 0;
            while(t < 200 && inside([
                c[0] + d[0] * t,
                c[1] + d[1] * t
            ], best.pts))t += 0.5;
            const side = [
                -d[1],
                d[0]
            ];
            const span = (k)=>{
                let u = 0;
                while(u < 120 && inside([
                    c[0] + d[0] * (t - 2) + side[0] * u * k,
                    c[1] + d[1] * (t - 2) + side[1] * u * k
                ], best.pts))u += 1;
                return u;
            };
            const half = Math.max(8, Math.min(span(1), span(-1)));
            const w = Math.min(half * 1.6, 70) * (s.scale ?? 1), h = w / aspect;
            const y1 = best.h - 2.5, y0 = y1 - h;
            const px = c[0] + d[0] * (t + 0.6), pz = c[1] + d[1] * (t + 0.6);
            const r = [
                -side[0],
                -side[1]
            ];
            const base = pos.length / 3;
            pos.push(px - r[0] * w / 2, y0, pz - r[1] * w / 2, px + r[0] * w / 2, y0, pz + r[1] * w / 2, px + r[0] * w / 2, y1, pz + r[1] * w / 2, px - r[0] * w / 2, y1, pz - r[1] * w / 2);
            const u0 = (RW / 2 - widths[i] / 2) / RW, u1 = (RW / 2 + widths[i] / 2) / RW;
            const v0 = 1 - (i + 1) * RH / cv.height, v1 = 1 - i * RH / cv.height;
            uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
        polygonOffset: true,
        polygonOffsetFactor: -2
    }));
    mesh.name = 'Resort signs';
    mesh.renderOrder = 120;
    return mesh;
}
function centroid(r) {
    let x = 0, z = 0;
    for (const p of r){
        x += p[0];
        z += p[1];
    }
    return [
        x / r.length,
        z / r.length
    ];
}
function inside(pt, poly) {
    let c = false;
    for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if (zi > pt[1] !== zj > pt[1] && pt[0] < (xj - xi) * (pt[1] - zi) / (zj - zi) + xi) c = !c;
    }
    return c;
}
