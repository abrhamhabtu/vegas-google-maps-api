// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { theme } from '../core/theme.js';
import { convexHull, ringArea, Soup } from '../map/geom.js';
import { bakeStatic } from './bake.js';
import { centroid, obb } from './landmarks.js';
import { glowPoints, halo, nightAura, sheen, textPanel } from './sheen.js';
const keep = (o)=>o.userData.keep === true || o.userData.crane === true;
const SCRIPT = '"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive';
const SERIF = 'Didot, "Bodoni 72", Georgia, serif';
const SANS = '"Helvetica Neue", Arial, sans-serif';
const stone = sheen('#e8dcc5');
const ivory = sheen('#f6eddb', {
    glow: '#ffe9c4',
    glowK: 0.35
});
const gold = sheen('#cba259', {
    refl: 0.3,
    spec: 1.2,
    glow: '#ffc76b',
    glowK: 0.9
});
const dark = sheen('#26343e', {
    refl: 0.2
});
const roofDark = sheen('#000000', {
    live: 'roof'
});
const slabEnd = (c)=>sheen(c, {
        refl: 0.1
    });
function towerNear(data, x, z, r, minH) {
    let best = null, bd = r;
    for (const b of data.buildings){
        if (b.h < minH) continue;
        const c = centroid(b.pts), d = Math.hypot(c[0] - x, c[1] - z);
        if (d < bd) {
            bd = d;
            best = {
                ring: b.pts,
                h: b.h
            };
        }
    }
    return best;
}
function named(data, re) {
    let best = null, area = 0;
    for (const b of data.buildings){
        if (!b.name || !re.test(b.name)) continue;
        const a = Math.abs(ringArea(b.pts));
        if (a > area) {
            area = a;
            best = {
                ring: b.pts,
                h: b.h
            };
        }
    }
    return best;
}
function fitSlab(ring, toward, depthCap = 60) {
    const box = obb(ring);
    const hull = convexHull(ring);
    let cx = 0, cz = 0;
    for (const p of hull){
        cx += p[0];
        cz += p[1];
    }
    cx /= hull.length;
    cz /= hull.length;
    const yaw = box.w >= box.d ? box.yaw : box.yaw + Math.PI / 2;
    let ux = Math.cos(yaw), uz = Math.sin(yaw), vx = -uz, vz = ux;
    if (vx * toward[0] + vz * toward[1] < 0) {
        ux = -ux;
        uz = -uz;
        vx = -vx;
        vz = -vz;
    }
    const pts = ring.map((p)=>[
            (p[0] - cx) * ux + (p[1] - cz) * uz,
            (p[0] - cx) * vx + (p[1] - cz) * vz
        ]);
    const us = pts.map((p)=>p[0]);
    const lo = Math.min(...us), hi = Math.max(...us), w = hi - lo;
    const S = [
        0,
        0,
        0,
        0,
        0
    ], T = [
        0,
        0,
        0
    ];
    for (const [u, v] of pts){
        const s = (u - lo) / w * 2 - 1;
        let k = 1;
        for(let i = 0; i < 5; i++){
            S[i] += k;
            if (i < 3) T[i] += v * k;
            k *= s;
        }
    }
    const M = [
        [
            S[0],
            S[1],
            S[2],
            T[0]
        ],
        [
            S[1],
            S[2],
            S[3],
            T[1]
        ],
        [
            S[2],
            S[3],
            S[4],
            T[2]
        ]
    ];
    for(let i = 0; i < 3; i++){
        for(let j = i + 1; j < 3; j++){
            const f = M[j][i] / (M[i][i] || 1e-6);
            for(let k = i; k < 4; k++)M[j][k] -= f * M[i][k];
        }
    }
    const co = [
        0,
        0,
        0
    ];
    for(let i = 2; i >= 0; i--){
        let v = M[i][3];
        for(let k = i + 1; k < 3; k++)v -= M[i][k] * co[k];
        co[i] = v / (M[i][i] || 1e-6);
    }
    const fit = (s)=>co[0] + co[1] * s + co[2] * s * s;
    const dev = pts.map(([u, v])=>Math.abs(v - fit((u - lo) / w * 2 - 1))).sort((a, b)=>a - b);
    const depth = Math.min(depthCap, Math.max(14, dev[Math.floor(dev.length * 0.7)] * 2));
    return {
        c: [
            cx + ux * ((lo + hi) / 2),
            cz + uz * ((lo + hi) / 2)
        ],
        rotY: Math.atan2(vx, vz),
        w,
        depth,
        path: (t)=>[
                (t - 0.5) * w,
                fit(t * 2 - 1)
            ]
    };
}
function frontage(data, c) {
    let bd = Infinity, at = c;
    for (const r of data.roads){
        if (!r.name || !/las vegas boulevard/i.test(r.name)) continue;
        for(let i = 0; i < r.pts.length - 1; i++){
            const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
            const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
            const x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(c[0] - x, c[1] - z);
            if (d < bd) {
                bd = d;
                at = [
                    x,
                    z
                ];
            }
        }
    }
    return {
        at,
        out: [
            (c[0] - at[0]) / (bd || 1),
            (c[1] - at[1]) / (bd || 1)
        ],
        dist: bd
    };
}
function swept(g, o) {
    const n = 48, base = o.base ?? 0, crown = o.crown ?? 0;
    const H = (t)=>o.h - crown * (1 - Math.pow(2 * t - 1, 2));
    const nrm = (t)=>{
        const a = o.path(Math.max(0, t - 0.01)), b = o.path(Math.min(1, t + 0.01));
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        return [
            -dz / L,
            dx / L
        ];
    };
    const skin = new Soup(), roof = new Soup(), ribs = new Soup(), fins = new Soup(), ends = new Soup();
    const wall = (s, t0, t1, off, y0, y1, side)=>{
        const P = (t)=>{
            const p = o.path(t), m = nrm(t);
            return [
                p[0] + m[0] * off,
                p[1] + m[1] * off
            ];
        };
        const a = P(t0), b = P(t1), na = nrm(t0), nb = nrm(t1);
        const v = [
            s.vert(a[0], y0(t0), a[1], [
                na[0] * side,
                0,
                na[1] * side
            ]),
            s.vert(b[0], y0(t1), b[1], [
                nb[0] * side,
                0,
                nb[1] * side
            ]),
            s.vert(b[0], y1(t1), b[1], [
                nb[0] * side,
                0,
                nb[1] * side
            ]),
            s.vert(a[0], y1(t0), a[1], [
                na[0] * side,
                0,
                na[1] * side
            ])
        ];
        s.quad(v[0], v[1], v[2], v[3]);
    };
    for(let i = 0; i < n; i++){
        const t0 = i / n, t1 = (i + 1) / n;
        for (const side of [
            1,
            -1
        ]){
            const off = side * o.depth / 2;
            wall(skin, t0, t1, off, ()=>base, H, side);
            if (o.ribs) {
                const every = o.ribEvery ?? 6.8, rOff = off + side * 0.18;
                for(let y = base + every; y < o.h; y += every){
                    if (y + 0.35 > Math.min(H(t0), H(t1)) - 1) continue;
                    wall(ribs, t0, t1, rOff, ()=>y, ()=>y + 0.4, side);
                }
                wall(ribs, t0, t1, rOff, (t)=>H(t) - 1.2, H, side);
            }
        }
        const a = o.path(t0), b = o.path(t1), na = nrm(t0), nb = nrm(t1), d = o.depth / 2;
        const v = [
            roof.vert(a[0] - na[0] * d, H(t0), a[1] - na[1] * d, [
                0,
                1,
                0
            ]),
            roof.vert(b[0] - nb[0] * d, H(t1), b[1] - nb[1] * d, [
                0,
                1,
                0
            ]),
            roof.vert(b[0] + nb[0] * d, H(t1), b[1] + nb[1] * d, [
                0,
                1,
                0
            ]),
            roof.vert(a[0] + na[0] * d, H(t0), a[1] + na[1] * d, [
                0,
                1,
                0
            ])
        ];
        roof.quad(v[0], v[1], v[2], v[3]);
    }
    for (const t of [
        0,
        1
    ]){
        const p = o.path(t), m = nrm(t), d = o.depth / 2, sgn = t === 0 ? -1 : 1;
        const nE = [
            -m[1] * -sgn,
            0,
            m[0] * -sgn
        ];
        const e = o.endMat ? ends : skin;
        const v = [
            e.vert(p[0] - m[0] * d, base, p[1] - m[1] * d, nE),
            e.vert(p[0] + m[0] * d, base, p[1] + m[1] * d, nE),
            e.vert(p[0] + m[0] * d, H(t), p[1] + m[1] * d, nE),
            e.vert(p[0] - m[0] * d, H(t), p[1] - m[1] * d, nE)
        ];
        e.quad(v[0], v[1], v[2], v[3]);
    }
    if (o.endMat) g.add(new THREE.Mesh(ends.geometry(), o.endMat));
    if (o.band) {
        const bs = new Soup();
        for(let i = 0; i < n; i++)for (const side of [
            1,
            -1
        ])wall(bs, i / n, (i + 1) / n, side * o.depth / 2 + side * 0.7, (t)=>H(t) - o.band.h, (t)=>H(t) + 0.6, side);
        g.add(new THREE.Mesh(bs.geometry(), o.band.mat));
    }
    if (o.fins) {
        const every = o.finEvery ?? 12, L = Math.hypot(o.path(1)[0] - o.path(0)[0], o.path(1)[1] - o.path(0)[1]), count = Math.round(L / every);
        const at = o.finAt ?? Array.from({
            length: count + 1
        }, (_, i)=>i / count);
        const hw = o.finW ?? 0.004, out = o.finOut ?? 0.5;
        for (const t of at){
            const c = Math.max(t - hw, 0), e = Math.min(t + hw, 1);
            for (const side of [
                1,
                -1
            ])wall(fins, c, e, side * o.depth / 2 + side * out, ()=>base, H, side);
        }
        g.add(new THREE.Mesh(fins.geometry(), o.fins));
    }
    g.add(new THREE.Mesh(skin.geometry(), o.skin), new THREE.Mesh(roof.geometry(), o.roof ?? roofDark));
    if (o.ribs) g.add(new THREE.Mesh(ribs.geometry(), o.ribs));
    return H;
}
function ringTower(g, ring, c, y0, y1, mat, scale = 1) {
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
function pilasters(g, ring, c, y0, y1, every, mat, w = 0.9) {
    const r = ringArea(ring) > 0 ? ring : ring.slice().reverse();
    for(let i = 0; i < r.length; i++){
        const a = r[i], b = r[(i + 1) % r.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
        if (L < 4) continue;
        const yaw = Math.atan2(dz, dx);
        const count = Math.max(1, Math.round(L / every));
        for(let k = 0; k <= count; k++){
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, y1 - y0, 0.8), mat);
            m.position.set(a[0] + dx * k / count - c[0], (y0 + y1) / 2, a[1] + dz * k / count - c[1]);
            m.rotation.y = -yaw;
            g.add(m);
        }
    }
}
function curvedSign(g, tex, path, depth, t0, t1, y0, y1, face) {
    const s = new Soup(), n = 12;
    for(let i = 0; i <= n; i++){
        const k = i / n, t = face > 0 ? t0 + (t1 - t0) * k : t1 - (t1 - t0) * k;
        const a = path(Math.max(0, t - 0.01)), b = path(Math.min(1, t + 0.01)), p = path(t);
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, mx = -dz / L, mz = dx / L;
        const off = face * (depth / 2 + 0.5);
        const nv = [
            mx * face,
            0,
            mz * face
        ];
        s.vert(p[0] + mx * off, y0, p[1] + mz * off, nv);
        s.uv.push(k, 0);
        s.vert(p[0] + mx * off, y1, p[1] + mz * off, nv);
        s.uv.push(k, 1);
        if (i) {
            const q = s.count - 4;
            s.quad(q, q + 2, q + 3, q + 1);
        }
    }
    const m = new THREE.Mesh(s.geometry(), new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
        fog: true,
        depthWrite: false
    }));
    m.userData.keep = true;
    g.add(m);
}
function signature(text, color, sub = false) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 384;
    const x = c.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = color;
    x.strokeStyle = color;
    x.font = `italic 700 240px ${SCRIPT}`;
    const w = x.measureText(text).width;
    const k = Math.min(1, 960 / w);
    x.save();
    x.translate(512, 170);
    x.scale(k, 1);
    x.fillText(text, 0, 0);
    x.restore();
    if (sub) {
        x.lineWidth = 7;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(512 - w * k / 2, 305);
        x.bezierCurveTo(400, 285, 620, 330, 512 + w * k / 2 + 40, 285);
        x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}
function wordmark(text, font, color) {
    const c = document.createElement('canvas');
    c.width = 2048;
    c.height = 256;
    const x = c.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = color;
    x.font = font;
    x.save();
    x.translate(1024, 132);
    x.scale(Math.min(1, 1960 / x.measureText(text).width), 1);
    x.fillText(text, 0, 0);
    x.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}
function seat(g, s) {
    g.position.set(s.c[0], 0, s.c[1]);
    g.rotation.y = s.rotY;
}
export function buildResorts(data, engine) {
    const out = new THREE.Group();
    out.name = 'resorts';
    const heights = [];
    const add = (o, x, z, h)=>{
        if (!o) return;
        out.add(o);
        if (x !== undefined) heights.push([
            x,
            z,
            h
        ]);
    };
    // Wynn and Encore towers: drawn by world/wynn-ti.js.
    add(resortsWorld(data, engine));
    add(fontainebleau(data));
    add(treasureIsland(data));
    // Bellagio is drawn by world/four-corners.js now; keep its height for the camera index.
    heights.push([-170, 348, 155]);
    add(cosmopolitan(data));
    add(mandalay(data));
    add(parkMgm(data));
    add(circusFront(data));
    add(nynyBridge(data));
    add(buildStripResorts(data, engine));
    return {
        group: out,
        heights
    };
}
function crescent(data, name) {
    const at = name === 'Wynn' ? [
        809,
        -1153
    ] : [
        887,
        -1467
    ];
    const f = towerNear(data, at[0], at[1], 25, 150);
    if (!f) return null;
    const s = fitSlab(f.ring, [
        -1,
        0.25
    ], 30);
    const g = new THREE.Group();
    g.name = name;
    seat(g, s);
    const skin = sheen('#b08c64', {
        refl: 0.12,
        spec: 0.9,
        windows: 0.015
    });
    const ribs = sheen('#d5c3a1', {
        refl: 0.15,
        spec: 1,
        glow: '#ffc56a',
        glowK: 0.95
    });
    const pale = sheen('#c7b394', {
        refl: 0.1,
        glow: '#ffcf78',
        glowK: 0.06
    });
    swept(g, {
        path: s.path,
        depth: s.depth,
        h: f.h,
        crown: 12,
        skin,
        ribs,
        ribEvery: 6.8,
        endMat: pale,
        band: {
            h: 1.6,
            mat: ribs
        }
    });
    const tex = signature(name, '#fff0cb', name === 'Wynn');
    for (const face of [
        1,
        -1
    ])curvedSign(g, tex, s.path, s.depth, 0.05, 0.42, f.h - 44, f.h - 9, face);
    const k = name === 'Encore' ? 0.72 : 1, mid = s.path(0.5), fz = mid[1] + s.depth / 2;
    const R = 14 * k, rz = fz + R + 8, ROOF = 14;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.93, R, 11 * k, 28), sheen('#d8cdb6', {
        masonry: true,
        windows: 0.5,
        glow: '#ffd9a8',
        glowK: 0.25
    }));
    drum.position.set(mid[0], ROOF + 5.5 * k, rz);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.04, R * 1.04, 0.9, 28), ivory);
    lip.position.set(mid[0], ROOF + 11 * k, rz);
    const domeM = new THREE.Mesh(new THREE.SphereGeometry(R * 0.95, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), sheen('#3f6f66', {
        refl: 0.25,
        spec: 0.8,
        glow: '#7fd6c0',
        glowK: 0.3
    }));
    domeM.position.set(mid[0], ROOF + 11.4 * k, rz);
    g.add(drum, lip, domeM);
    return bakeStatic(g, keep);
}
function resortsWorld(data, engine) {
    const f = towerNear(data, 750, -2062, 25, 150);
    if (!f) return null;
    const s = fitSlab(f.ring, [
        1,
        0.2
    ], 34);
    const g = new THREE.Group();
    g.name = 'Resorts World';
    seat(g, s);
    const skin = sheen('#8a5850', {
        refl: 0.12,
        spec: 0.9,
        windows: 0.16
    });
    const red = sheen('#b62034', {
        refl: 0.15,
        spec: 0.8,
        glow: '#e8102c',
        glowK: 0.42
    });
    swept(g, {
        path: s.path,
        depth: s.depth,
        h: f.h,
        crown: 6,
        skin,
        endMat: red,
        band: {
            h: 9,
            mat: red
        },
        fins: red,
        finAt: [
            0.02,
            0.18,
            0.82,
            0.98
        ],
        finW: 0.016,
        finOut: 1.4
    });
    const led = ledMaterial(0);
    const screen = new Soup(), n = 18, t0 = 0.2, t1 = 0.8, FACE = -1;
    const y0 = f.h * 0.14, y1 = f.h * 0.82;
    for(let i = 0; i <= n; i++){
        const k = i / n, t = FACE > 0 ? t0 + (t1 - t0) * k : t1 - (t1 - t0) * k;
        const a = s.path(t - 0.01), b = s.path(t + 0.01), p = s.path(t);
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, mx = -dz / L, mz = dx / L, off = FACE * (s.depth / 2 + 0.9);
        screen.vert(p[0] + mx * off, y0, p[1] + mz * off, [
            mx * FACE,
            0,
            mz * FACE
        ]);
        screen.uv.push(k, 0);
        screen.vert(p[0] + mx * off, y1, p[1] + mz * off, [
            mx * FACE,
            0,
            mz * FACE
        ]);
        screen.uv.push(k, 1);
        if (i) {
            const q = screen.count - 4;
            screen.quad(q, q + 2, q + 3, q + 1);
        }
    }
    const scr = new THREE.Mesh(screen.geometry(), led);
    scr.userData.keep = true;
    g.add(scr);
    const flare = halo(f.h * 1.5, '#ff2d4a', 0.04);
    flare.position.set(0, f.h * 0.5, -s.depth);
    g.add(flare);
    for (const [txt, t00, t11] of [
        [
            'CONRAD',
            0.04,
            0.3
        ],
        [
            'Hilton',
            0.7,
            0.96
        ]
    ]){
        curvedSign(g, wordmark(txt, `600 170px ${SERIF}`, '#f6d9a8'), s.path, s.depth + 1.6, t00, t11, f.h - 8, f.h - 1, -1);
    }
    curvedSign(g, wordmark('RESORTS WORLD', `700 170px ${SANS}`, '#fff1e0'), s.path, s.depth + 1.6, 0.2, 0.8, f.h - 8, f.h - 1, 1);
    const baked = bakeStatic(g, keep);
    engine.animate(baked, ()=>{}, new THREE.Sphere(new THREE.Vector3(s.c[0], f.h / 2, s.c[1]), s.w * 0.8));
    return baked;
}
let ledAtlasTex;
function ledMaterial(shift) {
    ledAtlasTex ??= ledAtlas();
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: theme.uniforms.uTime,
            uAtlas: {
                value: ledAtlasTex
            },
            uNight: theme.uniforms.uNight,
            uShift: {
                value: shift
            }
        },
        side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
      uniform float uTime, uNight, uShift; uniform sampler2D uAtlas; varying vec2 vUv;
      vec3 pal(float t) { return 0.5 + 0.5 * cos(6.2832 * (t + vec3(0.0, 0.33, 0.67))); }
      vec4 card(float i, vec2 uv) {
        float m = mod(i, 20.0);
        vec2 cell = vec2(mod(m, 4.0), floor(m / 4.0));
        // each ad pushes in slowly while it's up
        vec2 z = (uv - 0.5) * (1.0 - 0.05 * fract(uTime / 6.0)) + 0.5;
        return texture2D(uAtlas, (clamp(z, 0.004, 0.996) + cell) / vec2(4.0, 5.0));
      }
      void main() {
        float T = (uTime + uShift) / 6.0, i = floor(T), k = fract(T);
        vec2 q = vUv * 2.0 - 1.0;
        float w = sin(q.x * 3.0 + uTime * 0.7) + sin(q.y * 4.0 - uTime * 0.5) + sin(length(q) * 7.0 - uTime);
        vec3 bg = mix(vec3(0.34, 0.015, 0.05), pal(mod(i, 20.0) / 20.0 + w * 0.05) * 0.5, 0.45) * (0.65 + 0.2 * w);
        // cards wipe across in the last half second
        float edge = smoothstep(0.92, 1.0, k);
        vec4 a = card(i, vUv), b = card(i + 1.0, vUv);
        vec4 ca = vUv.x > edge ? a : b;
        vec3 c = mix(bg, ca.rgb, ca.a);
        vec2 grid = vUv * vec2(360.0, 300.0);
        vec2 fw = fwidth(grid);
        float dots = 1.0 - smoothstep(0.3, 0.5, length(fract(grid) - 0.5));
        c *= mix(dots * 1.3, 0.92, clamp(max(fw.x, fw.y) * 1.6, 0.0, 1.0));
        gl_FragColor = vec4(c * mix(1.0, 0.62, uNight), 1.0);
        #include <colorspace_fragment>
      }`
    });
}
function ledAtlas() {
    const S = 512, COLS = 4, ROWS = 5, c = document.createElement('canvas');
    c.width = S * COLS;
    c.height = S * ROWS;
    const x = c.getContext('2d');
    const cell = (i)=>[
            i % COLS * S,
            (ROWS - 1 - Math.floor(i / COLS)) * S
        ];
    const back = (i, a, b)=>{
        const [ox, oy] = cell(i), g = x.createLinearGradient(ox, oy, ox, oy + S);
        g.addColorStop(0, a);
        g.addColorStop(1, b);
        x.fillStyle = g;
        x.globalAlpha = 0.88;
        x.fillRect(ox, oy, S, S);
        x.globalAlpha = 1;
    };
    const line = (i, t, y, color, font)=>{
        const [ox, oy] = cell(i);
        x.save();
        x.translate(ox + S / 2, oy + y);
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = color;
        x.font = font;
        x.scale(Math.min(1, (S - 44) / x.measureText(t).width), 1);
        x.fillText(t, 0, 0);
        x.restore();
    };
    const [lx, ly] = cell(0);
    x.save();
    x.translate(lx + S / 2, ly + S / 2 - 30);
    for(let i = 0; i < 12; i++){
        x.rotate(Math.PI * 2 / 12);
        x.fillStyle = i % 2 ? '#ff2038' : '#d40f2a';
        x.beginPath();
        x.moveTo(0, 0);
        x.bezierCurveTo(70, -40, 120, -130, 20, -190);
        x.bezierCurveTo(-10, -130, -30, -60, 0, 0);
        x.fill();
    }
    x.fillStyle = '#fff4e6';
    x.beginPath();
    x.arc(0, 0, 26, 0, Math.PI * 2);
    x.fill();
    x.restore();
    line(0, 'RESORTS WORLD', S - 62, '#ffffff', `700 44px ${SANS}`);
    back(1, '#2a0b3d', '#14041f');
    line(1, 'ZOUK', 220, '#ff5ce1', `800 170px ${SANS}`);
    line(1, 'NIGHTCLUB · THU–SUN', 340, '#ffffff', `500 32px ${SANS}`);
    back(2, '#12123a', '#060618');
    line(2, 'LIVE', 170, '#7dd3fc', `800 130px ${SANS}`);
    line(2, 'TONIGHT', 290, '#ffffff', `800 96px ${SANS}`);
    line(2, 'THE THEATRE · 8PM', 390, '#7dd3fc', `500 32px ${SANS}`);
    back(3, '#c96442', '#7a3219');
    x.save();
    const [cx, cy] = cell(3);
    x.translate(cx + S / 2, cy + 118);
    x.strokeStyle = '#fff4e6';
    x.lineWidth = 11;
    x.lineCap = 'round';
    for(let i = 0; i < 12; i++){
        x.rotate(Math.PI * 2 / 12);
        x.beginPath();
        x.moveTo(0, 18);
        x.lineTo(0, i % 2 ? 56 : 76);
        x.stroke();
    }
    x.restore();
    line(3, 'THIS TOWER WAS BUILT BY', 235, '#fff4e6', `500 34px ${SANS}`);
    line(3, 'CLAUDE', 305, '#ffffff', `800 92px ${SANS}`);
    line(3, 'OPUS 5.5', 395, '#ffe2cf', `700 62px ${SANS}`);
    line(3, 'AND SO WAS THE REST OF THE STRIP', 462, '#fff4e6', `500 24px ${SANS}`);
    back(4, '#0f2a1f', '#06140e');
    line(4, 'CROCKFORDS', 210, '#e6cf84', `500 90px ${SERIF}`);
    line(4, 'THE ONES WHO KNOW, KNOW', 320, '#ffffff', `500 30px ${SANS}`);
    back(5, '#c81e1e', '#3c0505');
    line(5, 'FIGHT', 150, '#ffffff', `italic 900 130px ${SANS}`);
    line(5, 'NIGHT', 270, '#ffd21f', `italic 900 130px ${SANS}`);
    line(5, 'MAIN EVENT · SATURDAY 7PM', 400, '#ffffff', `600 30px ${SANS}`);
    back(6, '#ff8a00', '#d6246e');
    line(6, 'POOL', 150, '#ffffff', `900 130px ${SANS}`);
    line(6, 'PARTY', 270, '#fff3b0', `900 130px ${SANS}`);
    line(6, 'DAYCLUB · EVERY WEEKEND', 395, '#ffffff', `600 30px ${SANS}`);
    back(7, '#0a1f3d', '#03070f');
    line(7, 'EVERY GAME', 160, '#ffffff', `800 76px ${SANS}`);
    line(7, 'EVERY SCREEN', 250, '#39e58c', `800 76px ${SANS}`);
    line(7, 'SPORTSBOOK', 360, '#ffffff', `500 44px ${SANS}`);
    back(8, '#f2b632', '#b5531c');
    line(8, 'FAMOUS', 160, '#3b1404', `900 110px ${SERIF}`);
    line(8, 'FOODS', 265, '#7a1505', `900 110px ${SERIF}`);
    line(8, 'STREET EATS · OPEN LATE', 385, '#3b1404', `700 30px ${SANS}`);
    back(9, '#071a2b', '#0d4d57');
    line(9, 'NOBODY', 130, '#7fe0c0', `900 96px ${SANS}`);
    line(9, 'AT THE WHEEL', 225, '#ffffff', `800 62px ${SANS}`);
    line(9, 'ZOOX · WAYMO · TESLA', 320, '#7fe0c0', `600 36px ${SANS}`);
    line(9, 'THE VALET IS NOW A ROBOT', 385, '#ffffff', `500 26px ${SANS}`);
    back(10, '#161616', '#000000');
    line(10, 'RACE', 165, '#ffffff', `italic 900 130px ${SANS}`);
    line(10, 'WEEK', 285, '#ff3030', `italic 900 130px ${SANS}`);
    line(10, 'THE STRIP GOES FLAT OUT', 400, '#ffffff', `600 30px ${SANS}`);
    for(let i = 0; i < 16; i++){
        const [ox, oy] = cell(10);
        x.fillStyle = i % 2 ? '#fff' : '#000';
        x.fillRect(ox + i * 32, oy + 448, 32, 32);
        x.fillStyle = i % 2 ? '#000' : '#fff';
        x.fillRect(ox + i * 32, oy + 480, 32, 32);
    }
    back(11, '#1b1b1b', '#000000');
    line(11, 'CONRAD', 205, '#f4e6c8', `400 120px ${SERIF}`);
    line(11, 'SUITES AVAILABLE TONIGHT', 320, '#ffffff', `500 30px ${SANS}`);
    back(12, '#fbe9d2', '#f2b48a');
    line(12, '$9 SHRIMP', 150, '#b3261e', `900 96px ${SERIF}`);
    line(12, 'COCKTAIL', 250, '#b3261e', `900 96px ${SERIF}`);
    line(12, 'SINCE ABOUT 1959', 340, '#5c1a12', `600 30px ${SANS}`);
    line(12, 'INFLATION CANNOT TOUCH IT', 400, '#5c1a12', `500 26px ${SANS}`);
    back(13, '#ffe8ef', '#ff8fb2');
    line(13, 'GET MARRIED', 150, '#a3134a', `italic 800 76px ${SERIF}`);
    line(13, 'BY ELVIS', 250, '#ffffff', `900 104px ${SANS}`);
    line(13, 'OPEN 24 HOURS', 345, '#a3134a', `700 40px ${SANS}`);
    line(13, 'ANNULMENTS NEXT DOOR', 410, '#a3134a', `500 26px ${SANS}`);
    back(14, '#0b1730', '#2a0d4a');
    line(14, 'THE MAGIC', 150, '#ffd86b', `italic 800 92px ${SERIF}`);
    line(14, 'HOUR', 260, '#ffd86b', `italic 800 120px ${SERIF}`);
    line(14, 'YOUR RABBIT WILL BE RETURNED', 380, '#ffffff', `500 26px ${SANS}`);
    back(15, '#0d3b2e', '#04140f');
    line(15, 'HIGH LIMIT', 160, '#f1d98a', `500 88px ${SERIF}`);
    line(15, 'HIGHER HOPES', 265, '#ffffff', `700 56px ${SANS}`);
    line(15, 'PLEASE GAMBLE RESPONSIBLY', 380, '#f1d98a', `500 26px ${SANS}`);
    back(16, '#ff5a1f', '#7a1405');
    line(16, 'IT IS', 120, '#fff4e0', `800 70px ${SANS}`);
    line(16, '113°F', 245, '#ffffff', `900 150px ${SANS}`);
    line(16, 'BUT IT IS A DRY HEAT', 365, '#fff4e0', `600 34px ${SANS}`);
    line(16, 'FROZEN DRINKS · LEVEL 2', 420, '#fff4e0', `500 26px ${SANS}`);
    back(17, '#101a24', '#050709');
    line(17, 'WAKE UP', 150, '#7df9ff', `900 96px ${SANS}`);
    line(17, 'AT 3PM', 255, '#ffffff', `900 96px ${SANS}`);
    line(17, 'BREAKFAST SERVED ALL NIGHT', 370, '#7df9ff', `500 28px ${SANS}`);
    back(18, '#faf5ec', '#ead9c6');
    line(18, 'ASK CLAUDE', 140, '#c96442', `800 80px ${SERIF}`);
    line(18, 'WHERE YOU', 235, '#3a2a20', `500 56px ${SERIF}`);
    line(18, 'PARKED', 315, '#3a2a20', `500 72px ${SERIF}`);
    line(18, 'OPUS 5.5 · KNOWS THE WHOLE LOT', 410, '#c96442', `600 24px ${SANS}`);
    back(19, '#09122b', '#123a7a');
    line(19, 'CURB', 130, '#ffffff', `900 96px ${SANS}`);
    line(19, 'SIDE', 225, '#7fe0c0', `900 96px ${SANS}`);
    line(19, 'ROBOTAXI PICKUP · WEST VALET', 330, '#ffffff', `600 26px ${SANS}`);
    line(19, 'TIPPING IS CONFUSING NOW', 390, '#7fe0c0', `500 26px ${SANS}`);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
function fontainebleau(data) {
    const f = towerNear(data, 1353, -2413, 30, 150);
    if (!f) return null;
    const s = fitSlab(f.ring, [
        -1,
        0.2
    ], 40);
    const g = new THREE.Group();
    g.name = 'Fontainebleau';
    seat(g, s);
    const skin = sheen('#3a6ea8', {
        refl: 0.2,
        spec: 1.2,
        windows: 0.2,
        glow: '#2f6dff',
        glowK: 0.14
    });
    const fin = sheen('#7899ae', {
        refl: 0.2,
        spec: 0.8,
        glow: '#6f9dff',
        glowK: 0.4
    });
    swept(g, {
        path: s.path,
        depth: s.depth,
        h: f.h,
        crown: 3,
        skin,
        fins: fin,
        finEvery: 12,
        endMat: slabEnd('#aab6bd')
    });
    for (const face of [
        1,
        -1
    ])curvedSign(g, wordmark('FONTAINEBLEAU', `400 170px ${SERIF}`, '#eaf2ff'), s.path, s.depth, 0.16, 0.84, f.h - 20, f.h - 9, face);
    const glow = halo(f.h * 1.6, '#3f7dff', 0.07);
    glow.position.set(0, f.h * 0.55, 0);
    g.add(glow);
    return bakeStatic(g, keep);
}
function treasureIsland(data) {
    const f = towerNear(data, 242, -943, 30, 90);
    if (!f) return null;
    const c = centroid(f.ring), H = f.h;
    const g = new THREE.Group();
    g.name = 'Treasure Island';
    g.position.set(c[0], 0, c[1]);
    // the tower itself is drawn by world/wynn-ti.js; the pirate lagoon and TI pylon stay here.
    const fr = frontage(data, c);
    const front = new THREE.Group();
    front.name = 'Treasure Island front';
    const px = fr.at[0] + fr.out[0] * 54, pz = fr.at[1] + fr.out[1] * 54;
    front.position.set(px - c[0], 0, pz - c[1]);
    front.rotation.y = Math.atan2(-fr.out[0], -fr.out[1]);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), sheen('#000000', {
        live: 'water',
        refl: 0.35,
        spec: 1.2,
        glow: '#39d0c0',
        glowK: 0.12
    }));
    water.scale.set(40, 1, 16);
    water.position.set(12, 0.5, 8);
    front.add(water);
    const hull = new THREE.Shape();
    hull.moveTo(-4, 0);
    hull.lineTo(4, 0);
    hull.lineTo(6, 4);
    hull.lineTo(-6, 4);
    hull.closePath();
    const ship = new THREE.Mesh(new THREE.ExtrudeGeometry(hull, {
        depth: 28,
        bevelEnabled: false
    }).rotateY(Math.PI / 2), sheen('#533a25'));
    ship.position.set(-2, 1, 8);
    front.add(ship);
    const sailMat = sheen('#eee2c9', {
        glow: '#ffdcb0',
        glowK: 0.5
    });
    for (const x of [
        4,
        14,
        22
    ]){
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 20, 6), sheen('#6b4c30'));
        mast.position.set(x, 14, 8);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), sailMat);
        sail.position.set(x, 15, 8);
        sail.rotation.y = Math.PI / 2;
        front.add(mast, sail);
    }
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), dark);
    pylon.position.set(-34, 17, 12);
    const board = textPanel('TI', 16, 13, {
        font: `italic 700 200px ${SERIF}`,
        color: '#ffe06a',
        background: '#0c5a3c'
    });
    board.position.set(-34, 29, 13.9);
    const board2 = textPanel('TREASURE ISLAND', 16, 5, {
        font: `700 90px ${SANS}`,
        color: '#ffffff',
        background: '#d6a321'
    });
    board2.position.set(-34, 19.5, 13.9);
    front.add(pylon, board, board2);
    g.add(front);
    return bakeStatic(g, keep);
}
function bellagio(data) {
    const main = named(data, /^bellagio las vegas$/i);
    if (!main) return null;
    const s = fitSlab(main.ring, [
        1,
        0
    ], 30);
    const H = 155, g = new THREE.Group();
    g.name = 'Bellagio';
    seat(g, s);
    const w = s.w * 0.92;
    const bow = 16;
    const path = (t)=>[
            (t - 0.5) * w,
            bow * (Math.pow(2 * t - 1, 2) - 0.5) - 8
        ];
    const cream = sheen('#e4d4b9', {
        windows: 0.42,
        masonry: true,
        refl: 0.04,
        glow: '#ffdca0',
        glowK: 0.08
    });
    const copper = sheen('#567d70', {
        refl: 0.3,
        spec: 0.8,
        glow: '#7fd6c0',
        glowK: 0.3
    });
    const trim = sheen('#fbf3e2', {
        glow: '#ffe2ae',
        glowK: 1.1
    });
    swept(g, {
        path,
        depth: 24,
        h: H - 19,
        base: 8,
        skin: cream,
        ribs: trim,
        ribEvery: 22,
        roof: copper
    });
    const box = (x, y, z, bw, bh, bd, m)=>{
        const o = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
        o.position.set(x, y + bh / 2, z);
        g.add(o);
        return o;
    };
    const pavilion = (t, pw, ph, pd)=>{
        const [x, z] = path(t);
        box(x, 8, z, pw, ph - 8, pd, cream);
        for (const y of [
            ph - 10,
            ph - 3,
            ph
        ])box(x, y, z, pw + 1.8, y === ph ? 1.6 : 0.8, pd + 1.8, trim);
        for(let px = x - pw / 2 + 2; px < x + pw / 2; px += 7)box(px, 12, z + pd / 2 + 0.3, 1.1, ph - 14, 0.6, trim);
        return {
            x,
            z
        };
    };
    const mid = pavilion(0.5, 32, H - 6, 32);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), copper);
    dome.position.set(mid.x, H - 5, mid.z);
    g.add(dome);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 9, 8), gold);
    spire.position.set(mid.x, H + 12, mid.z);
    g.add(spire);
    for (const t of [
        0.03,
        0.97
    ]){
        const p = pavilion(t, 22, H - 24, 28);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(16, 11, 4), copper);
        cap.rotation.y = Math.PI / 4;
        cap.position.set(p.x, H - 18, p.z);
        g.add(cap);
    }
    for(let x = -w * 0.42; x <= w * 0.42; x += 10){
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 11, 8), ivory);
        col.position.set(x, 13.5, s.depth / 2 + 24);
        g.add(col);
        const arch = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.5, 6, 16, Math.PI), ivory);
        arch.position.set(x + 5, 19, s.depth / 2 + 24);
        g.add(arch);
    }
    box(0, 24, s.depth / 2 + 20, w * 0.88, 1.2, 14, copper);
    const sign = textPanel('BELLAGIO', 34, 7.5, {
        font: `500 100px ${SERIF}`,
        color: '#fff3d6'
    });
    sign.position.set(mid.x, H - 16, mid.z + 16.6);
    g.add(sign);
    const out = new THREE.Group();
    out.name = 'Bellagio resort';
    out.add(bakeStatic(g, keep));
    const spaF = named(data, /^bellagio spa tower$/i);
    if (spaF) {
        const ss = fitSlab(spaF.ring, [
            1,
            0
        ], 24);
        const sg = new THREE.Group();
        sg.name = 'Bellagio Spa Tower';
        seat(sg, ss);
        swept(sg, {
            path: ss.path,
            depth: Math.min(ss.depth, 22),
            h: 135,
            skin: cream,
            ribs: trim,
            ribEvery: 22,
            roof: copper
        });
        out.add(bakeStatic(sg, keep));
    }
    return {
        group: out,
        at: s.c,
        h: H
    };
}
function cosmopolitan(data) {
    const out = new THREE.Group();
    out.name = 'The Cosmopolitan';
    for (const [x, z, sign] of [
        [
            -164,
            708,
            'CHELSEA'
        ],
        [
            -2,
            728,
            'THE COSMOPOLITAN'
        ],
        [
            43,
            665,
            ''
        ]
    ]){
        const f = towerNear(data, x, z, 25, 150);
        if (!f) continue;
        const c = centroid(f.ring), box = obb(f.ring);
        const yaw = box.w >= box.d ? box.yaw : box.yaw + Math.PI / 2;
        const len = Math.max(box.w, box.d), dep = Math.min(box.w, box.d), g = new THREE.Group();
        g.name = `Cosmopolitan ${sign}`;
        g.position.set(c[0], 0, c[1]);
        g.rotation.y = -yaw;
        const body = new THREE.Mesh(new THREE.BoxGeometry(len, f.h - 3, dep), sheen('#344650', {
            refl: 0.3,
            spec: 1.1,
            windows: 0.34
        }));
        body.position.y = (f.h - 3) / 2;
        g.add(body);
        const terrace = sheen('#aeb6bc', {
            glow: '#fff0d8',
            glowK: 0.3
        });
        for(let y = 14; y < f.h - 3; y += 3.8){
            for (const side of [
                1,
                -1
            ]){
                const shelf = new THREE.Mesh(new THREE.BoxGeometry(len + 1.5, 0.26, 0.7), terrace);
                shelf.position.set(0, y, side * (dep + 0.7) / 2);
                g.add(shelf);
            }
        }
        for (const side of [
            1,
            -1
        ]){
            const fin = new THREE.Mesh(new THREE.BoxGeometry(1.3, f.h - 6, dep + 2.8), ivory);
            fin.position.set(side * (len + 1.3) / 2, (f.h - 6) / 2, 0);
            g.add(fin);
        }
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 3, 3, dep + 3.4), ivory);
        cap.position.y = f.h - 1.5;
        g.add(cap);
        if (sign === 'THE COSMOPOLITAN') {
            for (const side of [
                1,
                -1
            ]){
                const t = textPanel(sign, len * 0.86, len * 0.11, {
                    font: `500 84px ${SANS}`,
                    color: '#ffffff',
                    background: '#121419'
                });
                t.position.set(0, f.h - 9, side * (dep + 2.8) / 2 + side * 0.2);
                if (side < 0) t.rotation.y = Math.PI;
                g.add(t);
            }
        }
        out.add(bakeStatic(g, keep));
    }
    return out.children.length ? out : null;
}
function mandalay(data) {
    const f = towerNear(data, -24, 2720, 25, 100);
    if (!f) return null;
    const c = centroid(f.ring), H = f.h;
    const g = new THREE.Group();
    g.name = 'Mandalay Bay';
    g.position.set(c[0], 0, c[1]);
    const glass = sheen('#c9a24a', {
        refl: 0.3,
        spec: 1.3,
        windows: 0.26,
        glow: '#ffc35a',
        glowK: 0.1
    });
    const band = sheen('#f0cd7a', {
        refl: 0.3,
        spec: 1,
        glow: '#ffd27a',
        glowK: 1.5,
        baseGlow: 0.08
    });
    ringTower(g, f.ring, c, 0, H * 0.84, glass);
    ringTower(g, f.ring, c, H * 0.84, H * 0.84 + 1.4, band, 1.012);
    ringTower(g, f.ring, c, H * 0.84, H * 0.93, glass, 0.78);
    ringTower(g, f.ring, c, H * 0.93, H * 0.93 + 1.4, band, 0.79);
    ringTower(g, f.ring, c, H * 0.93, H, glass, 0.56);
    ringTower(g, f.ring, c, H, H + 1.6, band, 0.57);
    for (const y of [
        H * 0.25,
        H * 0.5,
        H * 0.67
    ])ringTower(g, f.ring, c, y, y + 0.9, band, 1.008);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(9, 14, 8, 6), band);
    crown.position.y = H + 5;
    g.add(crown);
    const fr = frontage(data, c);
    for (const d of [
        1,
        -1
    ]){
        const t = textPanel('MANDALAY BAY', 54, 7, {
            font: `600 88px ${SERIF}`,
            color: '#fff0bd'
        });
        t.position.set(fr.out[0] * -6 * d, H + 12, fr.out[1] * -6 * d);
        t.rotation.y = Math.atan2(-fr.out[0] * d, -fr.out[1] * d);
        g.add(t);
    }
    return bakeStatic(g, keep);
}
function parkMgm(data) {
    const f = towerNear(data, -146, 1285, 25, 90);
    if (!f) return null;
    const c = centroid(f.ring), H = f.h;
    const g = new THREE.Group();
    g.name = 'Park MGM';
    g.position.set(c[0], 0, c[1]);
    ringTower(g, f.ring, c, 0, H, sheen('#c7ad86', {
        windows: 0.42,
        masonry: true,
        refl: 0.05,
        glow: '#ffc98a',
        glowK: 0.06
    }));
    const bronze = sheen('#6f5436', {
        refl: 0.35,
        spec: 1,
        glow: '#ffb765',
        glowK: 1
    });
    for (const y of [
        13,
        H * 0.5
    ])ringTower(g, f.ring, c, y, y + 0.9, bronze, 1.008);
    ringTower(g, f.ring, c, H, H + 2.2, bronze, 1.012);
    pilasters(g, f.ring, c, 14, H, 13, sheen('#d8c19c', {
        glow: '#ffd9a8',
        glowK: 0.5
    }), 1.1);
    return bakeStatic(g, keep);
}
function circusFront(data) {
    const main = named(data, /^circus circus las vegas$/i);
    if (!main) return null;
    const c = centroid(main.ring), fr = frontage(data, c);
    const g = new THREE.Group();
    g.name = 'Circus Circus front';
    const x = fr.at[0] + fr.out[0] * 42, z = fr.at[1] + fr.out[1] * 42;
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-fr.out[0], -fr.out[1]);
    const tent = new THREE.ConeGeometry(30, 24, 24, 1, false).toNonIndexed();
    const pos = tent.getAttribute('position');
    const stripes = [
        new THREE.BufferGeometry(),
        new THREE.BufferGeometry()
    ];
    for (const n of [
        0,
        1
    ]){
        const p = [], nrm = [], nA = tent.getAttribute('normal');
        for(let i = 0; i < pos.count; i += 3){
            if (Math.floor(i / 3 / 2) % 2 !== n) continue;
            for(let k = 0; k < 3; k++){
                p.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
                nrm.push(nA.getX(i + k), nA.getY(i + k), nA.getZ(i + k));
            }
        }
        stripes[n].setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        stripes[n].setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    }
    const white = sheen('#f3e7d5', {
        glow: '#ffe7c4',
        glowK: 0.4
    }), redM = sheen('#ce3f58', {
        glow: '#ff5c7c',
        glowK: 0.6
    });
    for (const n of [
        0,
        1
    ]){
        const m = new THREE.Mesh(stripes[n], n ? white : redM);
        m.position.set(18, 22, -16);
        g.add(m);
    }
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 10, 24), ivory);
    drum.position.set(18, 5, -16);
    g.add(drum);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(2.4, 36, 2.4), gold);
    pole.position.set(-20, 18, 0);
    g.add(pole);
    const board = textPanel('CIRCUS CIRCUS', 26, 10, {
        font: `900 96px ${SERIF}`,
        color: '#ffe568',
        background: '#ac3152'
    });
    board.position.set(-20, 20, 1.4);
    g.add(board);
    const face = new THREE.Mesh(new THREE.SphereGeometry(4.2, 18, 12), ivory);
    face.position.set(-20, 31, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), redM);
    nose.position.set(-20, 31, 4.2);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(3.4, 7, 12), redM);
    hat.position.set(-20, 38, 0);
    g.add(face, nose, hat);
    for (const dx of [
        -1.3,
        1.3
    ]){
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), dark);
        eye.position.set(-20 + dx, 32.3, 3.8);
        g.add(eye);
    }
    const lights = [];
    const warm = new THREE.Color('#ffd98a');
    for(let i = 0; i < 24; i++){
        const t = i / 24 * Math.PI * 2;
        lights.push({
            x: 26 + Math.cos(t) * 30.5,
            y: 10.5,
            z: -34 + Math.sin(t) * 30.5,
            color: warm,
            size: 2
        });
    }
    g.add(glowPoints(lights, 'lamps', 1.2, 1));
    const baked = bakeStatic(g, keep);
    const dome = named(data, /^the adventuredome$/i);
    const grp = new THREE.Group();
    grp.name = 'Circus Circus';
    grp.add(baked);
    if (dome) {
        const dc = centroid(dome.ring), R = Math.sqrt(Math.abs(ringArea(dome.ring)) / Math.PI);
        const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), sheen('#c86a86', {
            refl: 0.4,
            spec: 1.2,
            glow: '#ff6ea0',
            glowK: 0.14
        }));
        shell.scale.y = 0.42;
        shell.position.set(dc[0], 8, dc[1]);
        grp.add(shell);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 8, 32), sheen('#8a4560', {
            glow: '#ff6ea0',
            glowK: 0.25
        }));
        rim.position.set(dc[0], 4, dc[1]);
        grp.add(rim);
    }
    return grp;
}
function nynyBridge(data) {
    const anchor = named(data, /^new york new york hotel and casino$/i);
    if (!anchor) return null;
    const c = centroid(anchor.ring), fr = frontage(data, c);
    const g = new THREE.Group();
    g.name = 'Brooklyn Bridge';
    g.position.set(fr.at[0] + fr.out[0] * 40, 0, fr.at[1] + fr.out[1] * 40);
    g.rotation.y = Math.atan2(-fr.out[0], -fr.out[1]);
    const m = sheen('#b7a78e', {
        glow: '#ffe2a8',
        glowK: 0.35
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(92, 1.2, 5), m);
    deck.position.y = 5.6;
    g.add(deck);
    for (const x of [
        -29,
        29
    ]){
        for (const dx of [
            -3,
            3
        ]){
            const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 21, 2.6), m);
            leg.position.set(x + dx, 10.5, 0);
            g.add(leg);
        }
        const top = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 3), m);
        top.position.set(x, 19, 0);
        g.add(top);
    }
    const cable = sheen('#8c7f6b');
    for (const z of [
        -2.5,
        2.5
    ]){
        const curve = new THREE.CatmullRomCurve3([
            [
                -46,
                8
            ],
            [
                -29,
                21
            ],
            [
                0,
                9
            ],
            [
                29,
                21
            ],
            [
                46,
                8
            ]
        ].map(([x, y])=>new THREE.Vector3(x, y, z)));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.18, 5), cable));
    }
    return bakeStatic(g, keep);
}
function towersNear(data, x, z, r, minH) {
    const out = [];
    for (const b of data.buildings){
        if (b.h < minH || /parking|garage/i.test(b.name ?? '')) continue;
        const c = centroid(b.pts);
        if (Math.hypot(c[0] - x, c[1] - z) < r) out.push({
            ring: b.pts,
            h: b.h
        });
    }
    return out;
}
function dress(g, t, o) {
    const c = centroid(t.ring), part = new THREE.Group(), y0 = o.y0 ?? 14;
    part.position.set(c[0], 0, c[1]);
    ringTower(part, t.ring, c, y0, t.h, o.skin, 1.012);
    ringTower(part, t.ring, c, t.h, t.h + 1.1, o.trim, 1.035);
    if (!o.crown) ringTower(part, t.ring, c, t.h + 1.1, t.h + 1.25, roofDark, 0.97);
    ringTower(part, t.ring, c, y0 - 1, y0, o.trim, 1.03);
    if (o.every) pilasters(part, t.ring.map((p)=>[
            c[0] + (p[0] - c[0]) * 1.018,
            c[1] + (p[1] - c[1]) * 1.018
        ]), c, y0, t.h, o.every, o.trim, 0.9);
    if (o.crown && o.crownH) {
        ringTower(part, t.ring, c, t.h + 1.1, t.h + 1.1 + o.crownH * 0.55, o.crown, 0.93);
        ringTower(part, t.ring, c, t.h + 1.1 + o.crownH * 0.55, t.h + 1.1 + o.crownH, o.crown, 0.7);
    }
    g.add(part);
}
function faceSign(data, g, t, text, w, h, y, font, color, background) {
    const c = centroid(t.ring), f = frontage(data, c), dx = -f.out[0], dz = -f.out[1];
    let reach = 0;
    for (const p of t.ring)reach = Math.max(reach, (p[0] - c[0]) * dx + (p[1] - c[1]) * dz);
    const panel = textPanel(text, w, h, {
        font,
        color,
        background
    });
    panel.position.set(c[0] + dx * (reach + 1.6), y, c[1] + dz * (reach + 1.6));
    panel.rotation.y = Math.atan2(dx, dz);
    panel.userData.keep = true;
    g.add(panel);
}
function frontFrame(data, c, back) {
    const f = frontage(data, c), g = new THREE.Group();
    g.position.set(f.at[0] + f.out[0] * back, 0, f.at[1] + f.out[1] * back);
    g.rotation.y = Math.atan2(f.out[0], f.out[1]);
    return g;
}
function column(g, x, z, h, r, m) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 10), m);
    shaft.position.set(x, h / 2 + 1, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, 1, r * 2.6), m);
    base.position.set(x, 0.5, z);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 2.8, 0.7, r * 2.8), m);
    cap.position.set(x, h + 1.35, z);
    g.add(shaft, base, cap);
}
function block(g, x, y, z, w, h, d, m) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y + h / 2, z);
    g.add(o);
    return o;
}
function adBoard(g, engine, x, z, w, h, shift, legs) {
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ledMaterial(shift));
    screen.position.set(x, 12 + h / 2, z - 0.7);
    screen.rotation.y = Math.PI;
    screen.userData.keep = true;
    g.add(screen);
    block(g, x, 11.4, z, w + 1.4, h + 1.2, 1.2, legs);
    for (const sd of [
        -1,
        1
    ])block(g, x + sd * w / 3, 0, z, 1.2, 12, 1.2, legs);
    engine.animate(screen, ()=>{}, new THREE.Sphere(new THREE.Vector3(0, 0, 0), 9000));
}
function buildStripResorts(data, engine) {
    const out = new THREE.Group();
    out.name = 'Strip resorts';
    const g = new THREE.Group();
    const white = sheen('#ded7c7', {
        glow: '#ffe9c4',
        glowK: 0.5
    });
    const water = sheen('#000000', {
        live: 'water',
        refl: 0.5
    });
    const bronze = sheen('#6b5a48', {
        refl: 0.25
    });
    const sans = (px, w = 700)=>`${w} ${px}px ${SANS}`, serif = (px, w = 500)=>`${w} ${px}px ${SERIF}`;
    const tower = (re)=>named(data, re);
    let shift = 7;
    const nextAd = ()=>shift += 17;
    const cream = sheen('#f4e6c8', {
        windows: 0.42,
        masonry: true,
        refl: 0.05,
        glow: '#ffdca0',
        glowK: 0.08
    });
    const palaceGlass = sheen('#dfe5e6', {
        windows: 0.5,
        refl: 0.2,
        glow: '#bfe0ff',
        glowK: 0.12
    });
    // Caesars towers (and their signs) are drawn by world/four-corners.js; the forecourt stays here.
    const aug = tower(/^palace tower$/i);
    const caes = tower(/^caesars palace hotel and casino$/i) ?? aug;
    if (caes) {
        const f = frontFrame(data, centroid(caes.ring), 54);
        block(f, 0, 0, 0, 92, 0.4, 16, stone);
        for(let x = -42; x <= 42; x += 6){
            column(f, x, 6, 13, 0.75, white);
            column(f, x, 13, 13, 0.75, white);
        }
        block(f, 0, 14.8, 6, 88, 1.3, 2.4, white);
        block(f, 0, 14.8, 13, 88, 1.3, 2.4, white);
        block(f, 0, 16.1, 9.5, 88, 0.6, 10, gold);
        const dome = sheen('#5d9a8c', {
            refl: 0.3,
            spec: 0.8
        });
        for (const sx of [
            -50,
            50
        ]){
            for(let k = 0; k < 8; k++){
                const a = k / 8 * Math.PI * 2;
                column(f, sx + Math.cos(a) * 6, 9 + Math.sin(a) * 6, 11, 0.55, white);
            }
            const ring = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1.2, 20), white);
            ring.position.set(sx, 13, 9);
            f.add(ring);
            const cap = new THREE.Mesh(new THREE.SphereGeometry(6.8, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), dome);
            cap.position.set(sx, 13.6, 9);
            f.add(cap);
        }
        block(f, 0, 0.05, 2, 84, 0.9, 5, water);
        adBoard(f, engine, 66, 2, 16, 20, nextAd(), bronze);
        g.add(f);
    }
    const venSkin = sheen('#f2e3c0', {
        windows: 0.4,
        masonry: true,
        glow: '#ffdca0',
        glowK: 0.08
    });
    const copperRoof = sheen('#4d8275', {
        refl: 0.3,
        spec: 0.8
    });
    for (const re of [
        /^venetian tower$/i,
        /^venezia tower$/i,
        /^palazzo tower$/i
    ]){
        const t = tower(re);
        if (t) dress(g, t, {
            skin: venSkin,
            trim: white,
            crown: copperRoof,
            crownH: 7,
            every: 14
        });
    }
    const vt = tower(/^venetian tower$/i), pz = tower(/^palazzo tower$/i);
    if (vt) faceSign(data, g, vt, 'THE VENETIAN', 52, 7, vt.h - 7, serif(90), '#ffe2a8');
    if (pz) faceSign(data, g, pz, 'THE PALAZZO', 44, 6.5, pz.h - 6, serif(90), '#ffe2a8');
    const cam = tower(/^the campanile$/i);
    if (cam) {
        const c = centroid(cam.ring), part = new THREE.Group();
        part.position.set(c[0], 0, c[1]);
        const W = 12, brick = sheen('#a9543d', {
            refl: 0.02
        }), H = cam.h;
        block(part, 0, 0, 0, W + 2, 3, W + 2, stone);
        block(part, 0, 3, 0, W, H * 0.62, W, brick);
        for (const sx of [
            -1,
            1
        ])for (const f2 of [
            0,
            1
        ])for(let k = -1; k <= 1; k++){
            const a = f2 ? k * 3 : sx * (W / 2 + 0.1), b = f2 ? sx * (W / 2 + 0.1) : k * 3;
            block(part, a, 3, b, f2 ? 0.7 : 0.4, H * 0.62, f2 ? 0.4 : 0.7, brick);
        }
        const y1 = 3 + H * 0.62;
        block(part, 0, y1, 0, W + 1.4, 1.2, W + 1.4, white);
        block(part, 0, y1 + 1.2, 0, W - 1, H * 0.14, W - 1, dark);
        for (const sx of [
            -1,
            1
        ])for (const sz of [
            -1,
            1
        ])block(part, sx * (W - 1) / 2, y1 + 1.2, sz * (W - 1) / 2, 1.3, H * 0.14, 1.3, white);
        block(part, 0, y1 + 1.2 + H * 0.14, 0, W + 1.2, 1.4, W + 1.2, white);
        const y2 = y1 + 2.6 + H * 0.14;
        block(part, 0, y2, 0, W - 2, H * 0.06, W - 2, ivory);
        const spire = new THREE.Mesh(new THREE.ConeGeometry((W - 2) * 0.72, H * 0.14, 4), copperRoof);
        spire.rotation.y = Math.PI / 4;
        spire.position.set(0, y2 + H * 0.06 + H * 0.07, 0);
        part.add(spire);
        const angel = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.4, 8), gold);
        angel.position.set(0, y2 + H * 0.2 + 2.2, 0);
        part.add(angel);
        g.add(part);
        const f = frontFrame(data, c, 54);
        const pink = sheen('#e4b7a8', {
            refl: 0.02
        });
        block(f, 0, 0, 12, 76, 6, 16, ivory);
        for(let x = -36; x <= 36; x += 4)column(f, x, 3.4, 5, 0.4, white);
        block(f, 0, 6.4, 8, 76, 1, 9, white);
        block(f, 0, 7.4, 12, 76, 12, 16, pink);
        for(let x = -34; x <= 34; x += 8.5)block(f, x, 10.6, 3.9, 3, 5, 0.3, dark);
        block(f, 0, 19.4, 12, 77, 0.9, 17, white);
        for(let x = -36; x <= 36; x += 4.5)block(f, x, 20.3, 4.4, 1.3, 2, 0.6, white);
        block(f, 0, 0.05, -5, 96, 0.8, 7, water);
        const rialto = new THREE.Mesh(new THREE.TorusGeometry(10, 1.1, 8, 20, Math.PI), white);
        rialto.position.set(42, 0, -3);
        rialto.rotation.y = Math.PI / 2;
        f.add(rialto);
        block(f, 42, 10.4, -3, 7, 3.6, 12, ivory);
        block(f, 42, 14, -3, 8, 1.3, 13, copperRoof);
        adBoard(f, engine, -56, -2, 16, 20, nextAd(), bronze);
        g.add(f);
    }
    const pa = tower(/^le boulevard at paris$/i);
    if (pa) {
        // Paris and the mapped Arc de Triomphe are drawn by world/four-corners.js.
        const f = frontFrame(data, centroid(pa.ring), 34);
        adBoard(f, engine, -8, 4, 18, 14, nextAd(), bronze);
        g.add(f);
    }
    const ph = tower(/^planet hollywood resort and casino$/i);
    if (ph) {
        const glass = sheen('#22324c', {
            windows: 0.4,
            refl: 0.65,
            spec: 1.3,
            glow: '#ff5fd0',
            glowK: 0.12
        });
        dress(g, ph, {
            skin: glass,
            trim: white,
            every: 9
        });
        faceSign(data, g, ph, 'PLANET HOLLYWOOD', 58, 6.5, ph.h - 7, sans(84, 800), '#f5d6ff');
        const f = frontFrame(data, centroid(ph.ring), 36);
        block(f, 0, 0, 10, 70, 10, 10, sheen('#2b2545', {
            refl: 0.4
        }));
        adBoard(f, engine, -24, 2, 22, 22, nextAd(), bronze);
        adBoard(f, engine, 24, 2, 22, 22, nextAd(), bronze);
        g.add(f);
    }
    const flam = tower(/^flamingo las vegas$/i);
    // Flamingo's tower wings are drawn by world/four-corners.js. Keep the street marquee.
    if (flam) {
        const f = frontFrame(data, centroid(flam.ring), 30);
        const pink = sheen('#ff5c9f', {
            glow: '#ff5c9f',
            glowK: 1.5,
            baseGlow: 0.15
        }), orange = sheen('#f4a13a', {
            glow: '#ffa63f',
            glowK: 1.4,
            baseGlow: 0.1
        });
        for(let i = 0; i < 11; i++){
            const a = (i - 5) * 0.17;
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(Math.sin(a) * 3, 8, 6),
                new THREE.Vector3(Math.sin(a) * 13, 22, 6),
                new THREE.Vector3(Math.sin(a) * 22, 32 + 5 * Math.cos(a * 2), 6)
            ]);
            f.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.72, 6), i % 2 ? orange : pink));
        }
        block(f, 0, 0, 6, 2.4, 9, 2.4, bronze);
        const label = textPanel('Flamingo', 26, 7, {
            font: `italic 700 120px ${SCRIPT}`,
            color: '#ffb1c4',
            background: '#672744'
        });
        label.position.set(0, 10.5, 4.2);
        label.rotation.y = Math.PI;
        label.userData.keep = true;
        f.add(label);
        g.add(f);
    }
    const mgm = towersNear(data, 465, 1515, 240, 75);
    const emerald = sheen('#0a8f58', {
        refl: 0.28,
        spec: 1.3,
        glow: '#6fffc2',
        glowK: 0.22
    });
    // The MGM towers, parapets and wordmarks are modelled in world/tropicana-trio.js.
    const main = mgm.slice().sort((a, b)=>b.h - a.h)[0];
    if (main) {
        const f = frontFrame(data, [
            262,
            1652
        ], 25);
        const lionGold = sheen('#b98a3c', {
            refl: 0.35,
            spec: 1.3,
            glow: '#ffc76b',
            glowK: 0.22
        });
        const lion = new THREE.Group();
        lion.position.set(0, 4.6, 5);
        const outline = [
            [
                -11,
                0
            ],
            [
                -9.6,
                0
            ],
            [
                -9,
                3.4
            ],
            [
                -7.6,
                5.2
            ],
            [
                -7.2,
                0
            ],
            [
                -5.8,
                0
            ],
            [
                -5.2,
                4.6
            ],
            [
                -1,
                4.3
            ],
            [
                2.4,
                4.4
            ],
            [
                2.6,
                0
            ],
            [
                4,
                0
            ],
            [
                4.5,
                3.9
            ],
            [
                5.4,
                3.9
            ],
            [
                5.7,
                0
            ],
            [
                7.1,
                0
            ],
            [
                7.6,
                4.4
            ],
            [
                8.6,
                5.4
            ],
            [
                10.6,
                5.6
            ],
            [
                12,
                6.4
            ],
            [
                12.2,
                7.2
            ],
            [
                11.2,
                7.5
            ],
            [
                11.6,
                8.3
            ],
            [
                10.6,
                8.8
            ],
            [
                10.9,
                9.9
            ],
            [
                9.9,
                9.9
            ],
            [
                9.9,
                11
            ],
            [
                8.8,
                10.9
            ],
            [
                8.5,
                12
            ],
            [
                7.5,
                11.5
            ],
            [
                6.8,
                12.3
            ],
            [
                6,
                11.3
            ],
            [
                5,
                11.8
            ],
            [
                4.6,
                10.7
            ],
            [
                3.6,
                10.8
            ],
            [
                3.5,
                9.6
            ],
            [
                2.4,
                9.5
            ],
            [
                1,
                9.3
            ],
            [
                -3,
                8.8
            ],
            [
                -7,
                9.2
            ],
            [
                -9.5,
                8.6
            ],
            [
                -10.8,
                7.2
            ],
            [
                -12.2,
                8.6
            ],
            [
                -13.8,
                10.6
            ],
            [
                -14.6,
                10.3
            ],
            [
                -13.2,
                8
            ],
            [
                -11.4,
                5.8
            ],
            [
                -11.2,
                3
            ]
        ];
        const lionGeo = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([x, y])=>new THREE.Vector2(x, y))), {
            depth: 3.4,
            bevelEnabled: true,
            bevelSize: 0.28,
            bevelThickness: 0.28,
            bevelSegments: 2
        });
        lionGeo.translate(0, 0, -1.7);
        const statue = new THREE.Mesh(lionGeo, lionGold);
        statue.rotation.y = Math.PI;
        statue.scale.setScalar(0.92);
        lion.add(statue);
        f.add(lion);
        const plinthMat = sheen('#6d675c', {
            refl: 0.15
        });
        block(f, 0, 0, 5, 29, 4.6, 9.5, plinthMat);
        block(f, 0, 4.2, 5, 30, 0.4, 10.5, lionGold);
        adBoard(f, engine, -26, 2, 20, 16, nextAd(), bronze);
        g.add(f);
    }
    const sigGold = sheen('#c2a26f', {
        windows: 0.42,
        refl: 0.5,
        spec: 1.1,
        glow: '#ffd98a',
        glowK: 0.1
    });
    for (const re of [
        /^the signature at mgm grand tower i$/i,
        /^the signature at mgm grand tower ii$/i,
        /^the signature at mgm grand tower iii$/i
    ]){
        const t = tower(re);
        if (t) dress(g, t, {
            skin: sigGold,
            trim: white,
            every: 18
        });
    }
    const silver = sheen('#c4cdd6', {
        refl: 0.62,
        spec: 1.25,
        glow: '#e4f0ff',
        glowK: 0.16
    });
    const ariaGlass = sheen('#1c3858', {
        windows: 0.42,
        refl: 0.78,
        spec: 1.48,
        glow: '#a8d4ff',
        glowK: 0.18
    });
    const aria = towersNear(data, -210, 950, 175, 90);
    for (const t of aria){
        dress(g, t, {
            skin: ariaGlass,
            trim: silver,
            crown: silver,
            crownH: 5.5,
            every: 18
        });
        const tc = centroid(t.ring);
        for(let y = 26; y < t.h - 4; y += 18){
            const bandGrp = new THREE.Group();
            bandGrp.position.set(tc[0], 0, tc[1]);
            ringTower(bandGrp, t.ring, tc, y, y + 0.85, silver, 1.018);
            g.add(bandGrp);
        }
        if (t.h >= 155) {
            faceSign(data, g, t, 'ARIA', 32, 8.8, t.h - 8.5, `300 128px ${SANS}`, '#f0f7ff');
        }
    }
    {
        const veerYellow = sheen('#d6b228', {
            windows: 0.45,
            refl: 0.68,
            spec: 1.35,
            glow: '#ffe26a',
            glowK: 0.25
        });
        const veerLouvers = sheen('#e5c94c', {
            refl: 0.5,
            spec: 1.2,
            glow: '#ffea88',
            glowK: 0.18
        });
        const veerConfigs = [
            [
                14,
                980,
                132,
                0.088,
                -0.04
            ],
            [
                -40,
                983,
                132,
                -0.088,
                0.04
            ]
        ];
        for (const [vx, vz, vh, tiltZ, tiltX] of veerConfigs){
            const vt = new THREE.Group();
            vt.position.set(vx, 0, vz);
            vt.rotation.y = 0.28;
            vt.rotation.z = tiltZ;
            vt.rotation.x = tiltX;
            const body = new THREE.Mesh(new THREE.BoxGeometry(24, vh, 44), veerYellow);
            body.position.y = vh / 2;
            vt.add(body);
            for(let h = 14; h < vh - 6; h += 13){
                const band = new THREE.Mesh(new THREE.BoxGeometry(24.6, 1.1, 44.6), veerLouvers);
                band.position.y = h;
                vt.add(band);
            }
            const fin = new THREE.Mesh(new THREE.BoxGeometry(22, 7.5, 42), silver);
            fin.position.y = vh + 3.75;
            vt.add(fin);
            g.add(vt);
        }
        const crystalRoof = sheen('#d4dde8', {
            refl: 0.78,
            spec: 1.5,
            glow: '#e2f0ff',
            glowK: 0.22
        });
        const crystalGlass = sheen('#2b415c', {
            windows: 0.48,
            refl: 0.82,
            spec: 1.5,
            glow: '#cce6ff',
            glowK: 0.28
        });
        for(let k = 0; k < 7; k++){
            const facet = new THREE.Mesh(new THREE.ConeGeometry(24, 15, 4), k % 2 ? crystalRoof : crystalGlass);
            facet.position.set(-22 + k * 15, 30.5 + k % 3 * 2.4, 868 + k * 18);
            facet.rotation.set(0.22 * (k % 2 ? 1 : -1), 0.38 + k * 0.32, 0.16 * (k % 2 ? -1 : 1));
            facet.scale.set(1.45, 0.68, 1.15);
            g.add(facet);
        }
        // Iconic Gucci Flagship Pavilion at ARIA / The Shops at Crystals (faceted champagne-bronze & fluted charcoal-gold architectural box)
        const gucciBronze = sheen('#8c6d46', {
            refl: 0.68,
            spec: 1.38,
            glow: '#ffd89a',
            glowK: 0.42,
            baseGlow: 0.12
        });
        const gucciGold = sheen('#d9b672', {
            refl: 0.75,
            spec: 1.45,
            glow: '#ffe6ae',
            glowK: 0.65,
            baseGlow: 0.16
        });
        const gucciDark = sheen('#1c1e22', {
            refl: 0.55,
            spec: 1.2
        });
        const gucciGreen = sheen('#0f4d2e', {
            glow: '#22a862',
            glowK: 0.55,
            baseGlow: 0.14
        });
        const gucciRed = sheen('#9e1b24', {
            glow: '#ff3844',
            glowK: 0.65,
            baseGlow: 0.16
        });
        const gucciVitrine = sheen('#fff4dc', {
            glow: '#ffe8be',
            glowK: 1.25,
            baseGlow: 0.28
        });
        const buildGucciPavilion = (gx, gz, rotY, gw, gd, gh)=>{
            const gp = new THREE.Group();
            gp.position.set(gx, 0, gz);
            gp.rotation.y = rotY;
            const body = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), gucciBronze);
            body.position.y = gh * 0.5;
            gp.add(body);
            const roofShard = new THREE.Mesh(new THREE.ConeGeometry(Math.max(gw, gd) * 0.68, 7.5, 4), gucciGold);
            roofShard.position.set(0, gh + 3.2, 0);
            roofShard.rotation.set(0.14, Math.PI * 0.25, -0.11);
            roofShard.scale.set(1.25, 0.65, 1.05);
            gp.add(roofShard);
            for(let u = -gw * 0.44; u <= gw * 0.44; u += 2.2){
                const fin = new THREE.Mesh(new THREE.BoxGeometry(0.32, gh - 4.8, 0.55), gucciGold);
                fin.position.set(u, 4.4 + (gh - 4.8) * 0.5, gd * 0.5 + 0.22);
                gp.add(fin);
            }
            const vitrine = new THREE.Mesh(new THREE.BoxGeometry(gw * 0.84, 4.2, 0.45), gucciVitrine);
            vitrine.position.set(0, 2.3, gd * 0.5 + 0.15);
            gp.add(vitrine);
            const frame = new THREE.Mesh(new THREE.BoxGeometry(gw * 0.88, 0.45, 0.65), gucciDark);
            frame.position.set(0, 4.5, gd * 0.5 + 0.2);
            gp.add(frame);
            const webG1 = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.4, 0.42, gd + 0.4), gucciGreen);
            webG1.position.y = gh - 2.1;
            const webR = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.45, 0.36, gd + 0.45), gucciRed);
            webR.position.y = gh - 1.68;
            const webG2 = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.4, 0.42, gd + 0.4), gucciGreen);
            webG2.position.y = gh - 1.26;
            gp.add(webG1, webR, webG2);
            const gSign = textPanel('G U C C I', gw * 0.68, 3.1, {
                font: serif(108, 600),
                color: '#fff2cf',
                background: '#171512'
            });
            gSign.userData.keep = true;
            gSign.position.set(0, gh - 4.2, gd * 0.5 + 0.48);
            gp.add(gSign);
            g.add(gp);
        };
        // Gucci at Crystals North / ARIA Promenade (-12.7, 860.8) & Crystals NE Strip Corner (74, 864)
        buildGucciPavilion(-12.7, 860.8, Math.PI, 26, 20, 22);
        buildGucciPavilion(76.0, 864.0, Math.PI * 0.5, 24, 18, 23);

        // Crystals Strip-front Luxury Flagship Row (Louis Vuitton, Prada, Dolce & Gabbana, Fendi, Tiffany & Co.)
        const crystalsStrip = [
            {
                name: 'LOUIS VUITTON',
                x: 87.5,
                z: 936.6,
                w: 24,
                d: 16,
                h: 23,
                skin: sheen('#cbb389', {
                    refl: 0.62,
                    spec: 1.35,
                    glow: '#ffe7ba',
                    glowK: 0.45,
                    baseGlow: 0.14
                }),
                fg: '#fff5dc',
                bg: '#2c1f14'
            },
            {
                name: 'PRADA',
                x: 82.8,
                z: 902.2,
                w: 22,
                d: 15,
                h: 22,
                skin: sheen('#d8e2dc', {
                    refl: 0.65,
                    spec: 1.3,
                    glow: '#e4fff2',
                    glowK: 0.35,
                    baseGlow: 0.1
                }),
                fg: '#111514',
                bg: '#dceee4'
            },
            {
                name: 'FENDI',
                x: 84.5,
                z: 962.0,
                w: 18,
                d: 14,
                h: 21,
                skin: sheen('#d4a84e', {
                    refl: 0.55,
                    spec: 1.25,
                    glow: '#ffdf88',
                    glowK: 0.4,
                    baseGlow: 0.12
                }),
                fg: '#ffe48e',
                bg: '#1c160e'
            },
            {
                name: 'DOLCE & GABBANA',
                x: 76.0,
                z: 1000.8,
                w: 22,
                d: 14,
                h: 20,
                skin: sheen('#22262e', {
                    refl: 0.72,
                    spec: 1.4,
                    glow: '#ffdca8',
                    glowK: 0.32
                }),
                fg: '#ffffff',
                bg: '#101216'
            }
        ];
        for (const st of crystalsStrip){
            const sg = new THREE.Group();
            sg.position.set(st.x, 0, st.z);
            sg.rotation.y = Math.PI * 0.5;
            const bMesh = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h, st.d), st.skin);
            bMesh.position.y = st.h * 0.5;
            sg.add(bMesh);
            const vit = new THREE.Mesh(new THREE.BoxGeometry(st.w * 0.82, 4.0, 0.4), gucciVitrine);
            vit.position.set(0, 2.2, st.d * 0.5 + 0.15);
            sg.add(vit);
            const lbl = textPanel(st.name, st.w * 0.78, 2.8, {
                font: serif(88, 700),
                color: st.fg,
                background: st.bg
            });
            lbl.userData.keep = true;
            lbl.position.set(0, st.h - 3.6, st.d * 0.5 + 0.42);
            sg.add(lbl);
            g.add(sg);
        }
        // Tiffany & Co. jewel box at Crystals West-North Plaza (-68.4, 905.5)
        {
            const tif = new THREE.Group();
            tif.position.set(-68.4, 0, 905.5);
            const tiffBlue = sheen('#81d8d0', {
                refl: 0.65,
                spec: 1.35,
                glow: '#81d8d0',
                glowK: 0.75,
                baseGlow: 0.22
            });
            const tBox = new THREE.Mesh(new THREE.BoxGeometry(16, 17, 16), tiffBlue);
            tBox.position.y = 8.5;
            tif.add(tBox);
            const tSign = textPanel('TIFFANY & CO.', 13.5, 2.4, {
                font: serif(84, 600),
                color: '#ffffff',
                background: '#0a5c56'
            });
            tSign.userData.keep = true;
            tSign.position.set(0, 14.2, -8.3);
            tSign.rotation.y = Math.PI;
            tif.add(tSign);
            g.add(tif);
        }
        // THE SHOPS AT CRYSTALS main Strip marquee
        {
            const crSign = textPanel('THE SHOPS AT CRYSTALS', 28, 3.8, {
                font: sans(86, 600),
                color: '#f2f7ff',
                background: '#182436'
            });
            crSign.userData.keep = true;
            crSign.position.set(99.5, 27.5, 919.0);
            crSign.rotation.y = Math.PI * 0.5;
            g.add(crSign);
        }
    }
    // Across S Las Vegas Blvd from ARIA & Crystals: 63 Las Vegas & BLVD Retail Center (Netflix, Lululemon, JD Sports, In-N-Out Burger, Adidas, Puma)
    {
        const eastRetail = new THREE.Group();
        eastRetail.name = 'East Strip Retail across from ARIA';
        const travertine = sheen('#e6dccb', {
            refl: 0.18,
            spec: 0.7,
            glow: '#ffe8c2',
            glowK: 0.25,
            baseGlow: 0.08
        });
        const darkMetal = sheen('#181b22', {
            refl: 0.55,
            spec: 1.25
        });
        const warmStorefront = sheen('#fff3d8', {
            glow: '#ffe4b4',
            glowK: 1.3,
            baseGlow: 0.3
        });

        // 1. 63 Las Vegas (SE corner of Harmon & Strip, x=186..234, z=882..946)
        {
            const s63 = new THREE.Group();
            s63.position.set(208, 0, 914);
            const base63 = new THREE.Mesh(new THREE.BoxGeometry(42, 21, 58), travertine);
            base63.position.y = 10.5;
            s63.add(base63);
            const glass63 = new THREE.Mesh(new THREE.BoxGeometry(42.8, 8.5, 58.8), sheen('#2c445e', {
                windows: 0.45,
                refl: 0.72,
                spec: 1.4,
                glow: '#bfe2ff',
                glowK: 0.32
            }));
            glass63.position.y = 12.2;
            s63.add(glass63);
            for (const y of [
                6.8,
                16.8,
                21.1
            ]){
                const ledge = new THREE.Mesh(new THREE.BoxGeometry(44.2, 0.75, 60.2), sheen('#d4b075', {
                    refl: 0.45,
                    spec: 1.1,
                    glow: '#ffd896',
                    glowK: 0.55,
                    baseGlow: 0.14
                }));
                ledge.position.y = y;
                s63.add(ledge);
            }
            const sign63 = textPanel('63 LAS VEGAS · OCEAN PRIME', 32, 3.8, {
                font: sans(88, 800),
                color: '#fff4d4',
                background: '#16202e'
            });
            sign63.userData.keep = true;
            sign63.position.set(-21.8, 18.8, 0);
            sign63.rotation.y = -Math.PI * 0.5;
            s63.add(sign63);
            eastRetail.add(s63);
        }

        // 2. Netflix House / Netflix Experience at BLVD (x=185..232, z=962..1032)
        {
            const nf = new THREE.Group();
            nf.position.set(206, 0, 997);
            const nfBlack = sheen('#101116', {
                refl: 0.42,
                spec: 1.15
            });
            const nfRed = sheen('#e50914', {
                refl: 0.35,
                spec: 1.1,
                glow: '#ff1e27',
                glowK: 1.45,
                baseGlow: 0.35
            });
            const nfBox = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 62), nfBlack);
            nfBox.position.y = 10;
            nf.add(nfBox);
            // Iconic vertical red Netflix N-ribbon bars along the Strip facade
            for(let z = -26; z <= 26; z += 5.2){
                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 13.5, 0.85), nfRed);
                bar.position.set(-20.3, 11.8, z);
                nf.add(bar);
            }
            const nfPortal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.2, 46), warmStorefront);
            nfPortal.position.set(-20.1, 2.7, 0);
            nf.add(nfPortal);
            const nfCanopy = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 52), nfRed);
            nfCanopy.position.set(-21.4, 5.6, 0);
            nf.add(nfCanopy);
            const nfSign = textPanel('NETFLIX', 28, 6.2, {
                font: sans(138, 900),
                color: '#e50914',
                background: '#08080b'
            });
            nfSign.userData.keep = true;
            nfSign.position.set(-20.8, 15.2, 0);
            nfSign.rotation.y = -Math.PI * 0.5;
            nf.add(nfSign);
            eastRetail.add(nf);
        }

        // 3. Lululemon Flagship at BLVD (x=185..224, z=1036..1061)
        {
            const lulu = new THREE.Group();
            lulu.position.set(202, 0, 1048.5);
            const luluWhite = sheen('#f5f2ec', {
                refl: 0.25,
                spec: 0.9,
                glow: '#fff8ee',
                glowK: 0.45,
                baseGlow: 0.14
            });
            const luluRed = sheen('#d31334', {
                glow: '#ff2b4a',
                glowK: 1.25,
                baseGlow: 0.3
            });
            const luluBody = new THREE.Mesh(new THREE.BoxGeometry(34, 15.5, 23), luluWhite);
            luluBody.position.y = 7.75;
            lulu.add(luluBody);
            const luluGlass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.4, 19.5), warmStorefront);
            luluGlass.position.set(-17.1, 2.8, 0);
            lulu.add(luluGlass);
            const omegaBadge = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.45, 24).rotateZ(Math.PI * 0.5), luluRed);
            omegaBadge.position.set(-17.3, 11.6, -6.5);
            lulu.add(omegaBadge);
            const luluSign = textPanel('lululemon', 15.5, 3.2, {
                font: sans(104, 700),
                color: '#ffffff',
                background: '#d31334'
            });
            luluSign.userData.keep = true;
            luluSign.position.set(-17.35, 11.6, 2.6);
            luluSign.rotation.y = -Math.PI * 0.5;
            lulu.add(luluSign);
            eastRetail.add(lulu);
        }

        // 4. JD Sports Flagship (x=185..224, z=1063..1083)
        {
            const jd = new THREE.Group();
            jd.position.set(202, 0, 1073);
            const jdBody = new THREE.Mesh(new THREE.BoxGeometry(34, 15.0, 18), darkMetal);
            jdBody.position.y = 7.5;
            jd.add(jdBody);
            const jdSign = textPanel('JD SPORTS', 15, 3.0, {
                font: sans(104, 900),
                color: '#ffe100',
                background: '#101216'
            });
            jdSign.userData.keep = true;
            jdSign.position.set(-17.3, 11.4, 0);
            jdSign.rotation.y = -Math.PI * 0.5;
            jd.add(jdSign);
            eastRetail.add(jd);
        }

        // 5. New In-N-Out Burger Flagship across from ARIA (x=184.5, z=1094.7, span z=1085..1125)
        {
            const ino = new THREE.Group();
            ino.position.set(201, 0, 1104);
            const inoWhite = sheen('#fbf8f1', {
                refl: 0.2,
                spec: 0.85,
                glow: '#fff3dc',
                glowK: 0.5,
                baseGlow: 0.16
            });
            const inoRed = sheen('#d91e26', {
                refl: 0.35,
                spec: 1.1,
                glow: '#ff333b',
                glowK: 1.35,
                baseGlow: 0.32
            });
            const inoYellow = sheen('#ffd400', {
                refl: 0.45,
                spec: 1.2,
                glow: '#ffe033',
                glowK: 1.5,
                baseGlow: 0.38
            });
            const inoBody = new THREE.Mesh(new THREE.BoxGeometry(33, 13.5, 34), inoWhite);
            inoBody.position.y = 6.75;
            ino.add(inoBody);
            // Signature red parapet fascia + awning
            const inoRoofTrim = new THREE.Mesh(new THREE.BoxGeometry(34.2, 1.35, 35.2), inoRed);
            inoRoofTrim.position.y = 13.5;
            const inoAwning = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.65, 28), inoRed);
            inoAwning.position.set(-17.6, 5.2, 0);
            const inoWindows = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.4, 26), warmStorefront);
            inoWindows.position.set(-16.6, 2.4, 0);
            ino.add(inoRoofTrim, inoAwning, inoWindows);
            // Iconic In-N-Out yellow bent-arrow boomerang tower + red marquee sign on the Strip corner
            const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 21, 12), inoWhite);
            pylon.position.set(-16.2, 10.5, -13.5);
            ino.add(pylon);
            const arrowBoomerang = new THREE.Group();
            arrowBoomerang.position.set(-16.8, 17.5, -13.5);
            const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 9.5), inoYellow);
            seg1.position.set(0, 1.8, 2.2);
            seg1.rotation.x = 0.42;
            const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 7.5), inoYellow);
            seg2.position.set(0, -0.4, -2.0);
            seg2.rotation.x = -0.55;
            const arrowTip = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.6, 4), inoYellow);
            arrowTip.position.set(0, -2.4, -5.2);
            arrowTip.rotation.x = -Math.PI * 0.5 - 0.55;
            arrowBoomerang.add(seg1, seg2, arrowTip);
            ino.add(arrowBoomerang);
            const inoSign = textPanel('IN-N-OUT BURGER', 22, 4.2, {
                font: sans(104, 900),
                color: '#ffffff',
                background: '#c8161d'
            });
            inoSign.userData.keep = true;
            inoSign.position.set(-16.9, 10.2, 1.5);
            inoSign.rotation.y = -Math.PI * 0.5;
            ino.add(inoSign);
            eastRetail.add(ino);
        }

        // 6. Adidas Flagship Store across from ARIA (x=185.7, z=1149.6, span z=1129..1182)
        {
            const adi = new THREE.Group();
            adi.position.set(203, 0, 1154);
            const adiBlack = sheen('#12151b', {
                refl: 0.62,
                spec: 1.35
            });
            const adiStripe = sheen('#ffffff', {
                refl: 0.5,
                spec: 1.2,
                glow: '#ffffff',
                glowK: 1.45,
                baseGlow: 0.35
            });
            const adiBody = new THREE.Mesh(new THREE.BoxGeometry(35, 18.5, 46), adiBlack);
            adiBody.position.y = 9.25;
            adi.add(adiBody);
            const adiGlass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.6, 38), warmStorefront);
            adiGlass.position.set(-17.6, 2.9, 0);
            adi.add(adiGlass);
            // Iconic Three Diagonal Stripes (///) across the Adidas Strip facade
            for(let sIdx = -1; sIdx <= 1; sIdx++){
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.75, 12.2, 2.3), adiStripe);
                stripe.position.set(-17.85, 11.4, -10.5 + sIdx * 4.2);
                stripe.rotation.x = 0.46;
                adi.add(stripe);
            }
            const adiSign = textPanel('adidas', 18.5, 4.0, {
                font: sans(120, 900),
                color: '#ffffff',
                background: '#0d0f14'
            });
            adiSign.userData.keep = true;
            adiSign.position.set(-17.9, 12.6, 8.5);
            adiSign.rotation.y = -Math.PI * 0.5;
            adi.add(adiSign);
            eastRetail.add(adi);
        }

        // 7. Puma Flagship Store (x=185.1, z=1203.7, span z=1185..1224)
        {
            const puma = new THREE.Group();
            puma.position.set(203, 0, 1204);
            const pumaBody = new THREE.Mesh(new THREE.BoxGeometry(34, 16.5, 34), darkMetal);
            pumaBody.position.y = 8.25;
            puma.add(pumaBody);
            const pumaAccent = new THREE.Mesh(new THREE.BoxGeometry(34.8, 0.85, 34.8), sheen('#e41e2b', {
                glow: '#ff2e3b',
                glowK: 1.2,
                baseGlow: 0.25
            }));
            pumaAccent.position.y = 15.8;
            puma.add(pumaAccent);
            const pumaSign = textPanel('PUMA', 16, 3.6, {
                font: sans(112, 900),
                color: '#ffffff',
                background: '#c41622'
            });
            pumaSign.userData.keep = true;
            pumaSign.position.set(-17.4, 11.8, 0);
            pumaSign.rotation.y = -Math.PI * 0.5;
            puma.add(pumaSign);
            eastRetail.add(puma);
        }

        g.add(eastRetail);
    }
    {
        const cokePoi = data.pois.find((p)=>/coca.?cola/i.test(p.n));
        const cx = cokePoi ? cokePoi.x - 4 : 180.5, cz = cokePoi ? cokePoi.z : 1403.1;
        const cokeGreen = sheen('#1c8a52', {
            refl: 0.78,
            spec: 1.5,
            glow: '#48ff9e',
            glowK: 0.48,
            baseGlow: 0.15
        });
        const cokeRed = sheen('#e01a22', {
            glow: '#ff3838',
            glowK: 0.85,
            baseGlow: 0.25
        });
        const bottle = new THREE.Group();
        bottle.position.set(cx, 0, cz);
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.3, 11, 18), cokeGreen);
        lower.position.y = 5.5;
        bottle.add(lower);
        const waist = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 5, 18), cokeGreen);
        waist.position.y = 13.5;
        bottle.add(waist);
        const labelBand = new THREE.Mesh(new THREE.CylinderGeometry(4.05, 3.35, 5.5, 18), cokeRed);
        labelBand.position.y = 18.5;
        bottle.add(labelBand);
        const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 3.95, 6.5, 18), cokeGreen);
        shoulder.position.y = 24.5;
        bottle.add(shoulder);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 4.5, 16), cokeGreen);
        neck.position.y = 30.0;
        bottle.add(neck);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 1.3, 18), silver);
        cap.position.y = 32.8;
        bottle.add(cap);
        const cokeSign = textPanel('Coca-Cola', 8.2, 2.8, {
            font: `italic 700 96px ${SCRIPT}`,
            color: '#ffffff',
            background: '#d81820'
        });
        cokeSign.userData.keep = true;
        cokeSign.position.set(-4.2, 18.5, 0);
        cokeSign.rotation.y = -Math.PI / 2;
        bottle.add(cokeSign);
        g.add(bottle);
        const mmPoi = data.pois.find((p)=>/m&m/i.test(p.n));
        const mx = mmPoi ? mmPoi.x - 10 : 181.8, mz = mmPoi ? mmPoi.z : 1431.5;
        const mmSign = textPanel("M&M'S WORLD", 22, 4.8, {
            font: sans(96, 900),
            color: '#ffdd20',
            background: '#4a200a'
        });
        mmSign.userData.keep = true;
        mmSign.position.set(mx, 16.5, mz);
        mmSign.rotation.y = -Math.PI / 2;
        g.add(mmSign);
        const candyColors = [
            '#e02020',
            '#ffd000',
            '#1e78d6',
            '#28a848',
            '#f07818'
        ];
        candyColors.forEach((col, idx)=>{
            const candy = new THREE.Mesh(new THREE.SphereGeometry(2.1, 14, 10), sheen(col, {
                spec: 1.2,
                glow: col,
                glowK: 0.4,
                baseGlow: 0.12
            }));
            candy.scale.set(0.45, 1, 1);
            candy.position.set(mx - 0.5, 10.5 + idx % 2 * 2.2, mz - 10 + idx * 5);
            g.add(candy);
        });
    }
    {
        const cloudGrp = new THREE.Group();
        cloudGrp.position.set(492, 0, -1245);
        cloudGrp.rotation.y = 0.46;
        const cloudSilver = sheen('#dfe5ee', {
            refl: 0.65,
            spec: 1.4,
            glow: '#cfe4ff',
            glowK: 0.25,
            baseGlow: 0.08
        });
        const ledUnderside = sheen('#48b8ff', {
            glow: '#58c8ff',
            glowK: 1.4,
            baseGlow: 0.25
        });
        const cloudCanopy = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 16), cloudSilver);
        cloudCanopy.scale.set(18, 3.2, 63);
        cloudCanopy.position.y = 39;
        cloudGrp.add(cloudCanopy);
        const cloudScreen = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 0.6, 24), ledUnderside);
        cloudScreen.scale.set(1.0, 1, 3.8);
        cloudScreen.position.y = 36.2;
        cloudGrp.add(cloudScreen);
        for (const pz of [
            -34,
            34
        ]){
            for (const px of [
                -11,
                11
            ]){
                const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 39, 10), silver);
                pylon.position.set(px, 19.5, pz);
                cloudGrp.add(pylon);
            }
        }
        const fsSign = textPanel('FASHION SHOW', 34, 5.2, {
            font: sans(92, 800),
            color: '#ffffff',
            background: '#162844'
        });
        fsSign.userData.keep = true;
        fsSign.position.set(18.5, 22, 0);
        fsSign.rotation.y = Math.PI / 2;
        cloudGrp.add(fsSign);
        g.add(cloudGrp);
    }
    const hs = tower(/^horseshoe las vegas hotel/i);
    if (hs) {
        const c = centroid(hs.ring), gildSkin = sheen('#d9bb88', {
            windows: 0.42,
            masonry: true,
            glow: '#ffdca0',
            glowK: 0.1
        });
        const list = towersNear(data, c[0], c[1], 160, 45);
        for (const t of list)dress(g, t, {
            skin: gildSkin,
            trim: gold,
            every: 14
        });
        if (list[0]) faceSign(data, g, list[0], 'HORSESHOE', 48, 7.5, list[0].h - 7, serif(92, 700), '#ffd98a');
        const f = frontFrame(data, c, 34);
        adBoard(f, engine, 0, 2, 18, 16, nextAd(), bronze);
        g.add(f);
    }
    const lq = tower(/^the linq hotel & casino/i);
    if (lq) {
        dress(g, lq, {
            skin: sheen('#dfe9ee', {
                windows: 0.45,
                refl: 0.35,
                glow: '#8fdcff',
                glowK: 0.12
            }),
            trim: white,
            every: 16
        });
        faceSign(data, g, lq, 'THE LINQ', 34, 7.5, lq.h - 7, sans(100, 800), '#1da7e0');
    }
    const harrahs = towersNear(data, 274, -396, 170, 45);
    const carnival = sheen('#d7a56e', {
        windows: 0.42,
        masonry: true,
        glow: '#ffb56b',
        glowK: 0.12
    });
    for (const t of harrahs)if (t !== lq) dress(g, t, {
        skin: carnival,
        trim: sheen('#c0334d', {
            glow: '#ff3f6b',
            glowK: 0.8
        }),
        every: 18
    });
    if (harrahs[0]) {
        faceSign(data, g, harrahs[0], "HARRAH'S", 40, 7.5, harrahs[0].h - 7, serif(96, 700), '#ffe8ba');
        const f = frontFrame(data, centroid(harrahs[0].ring), 36);
        adBoard(f, engine, 0, 2, 18, 16, nextAd(), bronze);
        g.add(f);
    }
    out.add(bakeStatic(g, keep));
    return out;
}
