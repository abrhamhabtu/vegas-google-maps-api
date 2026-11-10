// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { convexHull, ringArea, Soup } from '../map/geom.js';
import { ORIGIN } from '../places.js';
import { latLonToXZ } from '../core/data.js';
import { bakeStatic } from './bake.js';
import { SITE, towerCrane } from './construction.js';
import { centroid, footprint, obb } from './landmarks.js';
import { glowPoints, halo, nightAura, sheen, textPanel } from './sheen.js';
const TAU = Math.PI * 2;
const STRIP_EAST = [
    1,
    0
];
const STRIP_WEST = [
    -1,
    0
];
const keep = (o)=>o.userData.crane === true || o.userData.keep === true;
function seat(g, c, yaw, w, d, toward) {
    const axes = [
        [
            Math.cos(yaw),
            Math.sin(yaw),
            d,
            w
        ],
        [
            -Math.cos(yaw),
            -Math.sin(yaw),
            d,
            w
        ],
        [
            -Math.sin(yaw),
            Math.cos(yaw),
            w,
            d
        ],
        [
            Math.sin(yaw),
            -Math.cos(yaw),
            w,
            d
        ]
    ];
    const best = axes.reduce((a, b)=>b[0] * toward[0] + b[1] * toward[1] > a[0] * toward[0] + a[1] * toward[1] ? b : a);
    g.position.set(c[0], 0, c[1]);
    g.rotation.y = Math.atan2(best[0], best[1]);
    return {
        w: best[2],
        d: best[3]
    };
}
const add = (g, geo, mat)=>{
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    return m;
};
export function buildArenas(data, engine) {
    const out = new THREE.Group();
    out.name = 'arenas';
    for (const o of [
        ballpark(data, engine),
        tMobile(data),
        allegiant(data)
    ])if (o) out.add(o);
    return out;
}
function ballpark(data, engine) {
    const f = footprint(data, /^new las vegas stadium$/i);
    if (!f) return null;
    const g = new THREE.Group();
    g.name = 'Athletics ballpark';
    g.position.set(f.c[0], 0, f.c[1]);
    g.rotation.y = Math.atan2(STRIP_WEST[0], STRIP_WEST[1]);
    const a = 104, b = 90, H = 54;
    const shell = sheen('#ddd6ca', {
        refl: 0.3,
        spec: 0.7
    });
    const glass = sheen('#7fa8bf', {
        refl: 0.65,
        spec: 1,
        opacity: 0.62,
        glow: '#ffd9a8',
        glowK: 0.55
    });
    const { concrete, steel } = SITE;
    const ring = (ea, eb, hole)=>{
        const sh = new THREE.Shape().absellipse(0, 0, ea, eb, 0, TAU, false, 0);
        sh.holes.push(new THREE.Path().absellipse(0, 0, ea * hole, eb * hole, 0, TAU, true, 0));
        return sh;
    };
    const flat = (r, color, sx, sz, y, z = 0)=>{
        const m = add(g, new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2), sheen(color));
        m.scale.set(sx, 1, sz);
        m.position.set(0, y, z);
        return m;
    };
    flat(1, '#a4825d', a * 1.12, b * 1.12, 0.1);
    flat(1, '#8c7a5a', a * 0.62, b * 0.62, 8.2, -b * 0.08);
    flat(1, '#4c7a45', a * 0.5, b * 0.48, 8.28, -b * 0.08);
    const infield = add(g, new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), sheen('#a4825d'));
    infield.position.set(0, 8.34, -b * 0.3);
    add(g, new THREE.CylinderGeometry(1, 1.02, 10, 48, 1, true), concrete).scale.set(a, 1, b);
    g.children[g.children.length - 1].position.y = 5;
    for(let k = 0; k < 4; k++){
        const t = add(g, new THREE.CylinderGeometry(1, 1, 1.2, 48, 1, true), concrete);
        const q = 0.68 + k * 0.08;
        t.scale.set(a * q, 1, b * q);
        t.position.y = 9 + k * 3;
    }
    const n = 5, step = (H - 10) / n;
    for(let i = 0; i < n; i++){
        const k = 1 - i * 0.11, back = -i * b * 0.075, y = 10 + i * step;
        if (i < 2) {
            const plate = add(g, new THREE.ExtrudeGeometry(ring(a * k, b * k, 0.62), {
                depth: 2.4,
                bevelEnabled: true,
                bevelSize: 1.2,
                bevelThickness: 0.8,
                bevelSegments: 2,
                curveSegments: 48
            }), shell);
            plate.rotation.x = -Math.PI / 2;
            plate.position.set(0, y + step - 2.4, back);
            const band = add(g, new THREE.CylinderGeometry(1, 1, step - 2.4, 48, 1, true), glass);
            band.scale.set(a * k * 0.96, 1, b * k * 0.96);
            band.position.set(0, y + (step - 2.4) / 2, back);
        } else {
            const sweep = i === 2 ? TAU * 0.8 : i === 3 ? TAU * 0.5 : TAU * 0.22;
            const girder = add(g, new THREE.TorusGeometry(1, 0.012, 4, 64, sweep), steel);
            girder.rotation.x = Math.PI / 2;
            girder.scale.set(a * k, b * k, 60);
            girder.position.set(0, y + step - 1, back);
            for(let q = 0; q < 24 * sweep / TAU; q++){
                const th = q / 24 * TAU;
                const col = add(g, new THREE.BoxGeometry(0.7, step, 0.7), steel);
                col.position.set(Math.cos(th) * a * k, y + step / 2, back + Math.sin(th) * b * k);
                if (q % 3 === 0) {
                    const rib = add(g, new THREE.BoxGeometry(a * k * 0.34, 0.8, 0.8), steel);
                    rib.position.set(Math.cos(th) * a * k * 0.83, y + step - 0.6, back + Math.sin(th) * b * k * 0.83);
                    rib.rotation.y = -th;
                }
            }
        }
    }
    const win = add(g, new THREE.CylinderGeometry(1, 1, step * 2 - 2, 32, 1, true, -0.8, 1.6), glass);
    win.scale.set(a * 1.01, 1, b * 1.01);
    win.position.y = 10 + step - 1;
    const cranes = [
        [
            -a * 0.78,
            -b * 0.5,
            92,
            60,
            0.3
        ],
        [
            a * 0.76,
            -b * 0.42,
            84,
            55,
            2.2
        ],
        [
            -a * 0.45,
            b * 0.74,
            76,
            48,
            4.1
        ],
        [
            a * 0.42,
            b * 0.76,
            70,
            45,
            5.3
        ]
    ].map(([x, z, h, jib, ph])=>{
        const c = towerCrane(h, jib, ph);
        c.obj.position.set(x, 0, z);
        g.add(c.obj);
        return c;
    });
    const floods = new THREE.Color('#fff1d4');
    const lights = [];
    for(let i = 0; i < 18; i++){
        const th = i / 18 * TAU;
        lights.push({
            x: Math.cos(th) * a * 0.86,
            y: 34 + i % 3 * 6,
            z: Math.sin(th) * b * 0.86 - b * 0.1,
            color: floods,
            size: 16
        });
    }
    g.add(glowPoints(lights, 'night', 2.2, 1.1));
    const wash = add(g, new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), nightAura('#ffe3b8', 0.32));
    wash.scale.set(a * 0.6, 1, b * 0.6);
    wash.position.set(0, 8.5, -b * 0.08);
    wash.userData.keep = true;
    const sign = textPanel('ATHLETICS', a * 0.62, a * 0.155, {
        color: '#0f7a4a',
        font: '800 110px Georgia',
        background: '#f4f1e8',
        sub: 'LAS VEGAS BALLPARK · OPENING 2028'
    });
    sign.position.set(0, 6.5, b * 1.2);
    g.add(sign);
    const baked = bakeStatic(g, keep);
    const site = new THREE.Group();
    site.name = 'Athletics ballpark site';
    const hull = convexHull(f.ring.map((p)=>[
            f.c[0] + (p[0] - f.c[0]) * 1.06,
            f.c[1] + (p[1] - f.c[1]) * 1.06
        ]));
    const fence = new Soup();
    for(let i = 0; i < hull.length; i++){
        const p = hull[i], q = hull[(i + 1) % hull.length];
        const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1;
        const nrm = [
            dz / L,
            0,
            -dx / L
        ];
        const v = [
            fence.vert(p[0], 0, p[1], nrm),
            fence.vert(q[0], 0, q[1], nrm),
            fence.vert(q[0], 3, q[1], nrm),
            fence.vert(p[0], 3, p[1], nrm)
        ];
        fence.quad(v[0], v[1], v[2], v[3]);
    }
    site.add(new THREE.Mesh(fence.geometry(), SITE.hoard));
    site.add(baked);
    engine.animate(site, (fi)=>{
        for (const c of cranes)c.update(fi.t);
    }, new THREE.Sphere(new THREE.Vector3(f.c[0], 50, f.c[1]), 220));
    return site;
}
function tMobile(data) {
    const p = latLonToXZ(ORIGIN, 36.10283, -115.17818);
    let ring = null, bestArea = 5000;
    for (const b of data.buildings){
        const c = centroid(b.pts);
        const area = Math.abs(ringArea(b.pts));
        if (Math.hypot(c[0] - p[0], c[1] - p[1]) < 45 && area > bestArea) {
            bestArea = area;
            ring = b.pts;
        }
    }
    if (!ring) return null;
    const box3 = obb(ring);
    const root = new THREE.Group();
    root.name = 'T-Mobile Arena';
    const { w: fw, d: fd } = seat(root, centroid(ring), box3.yaw, box3.w, box3.d, [
        STRIP_EAST[0],
        -0.35
    ]);
    const w = fw * 0.94, d = fd * 0.94, h = 35, r0 = w * 0.44;
    const rrect = (w, d, r)=>{
        const s = new THREE.Shape(), hw = w / 2, hd = d / 2, cr = Math.min(r, hw - 1, hd - 1);
        s.moveTo(-hw + cr, -hd);
        s.lineTo(hw - cr, -hd);
        s.quadraticCurveTo(hw, -hd, hw, -hd + cr);
        s.lineTo(hw, hd - cr);
        s.quadraticCurveTo(hw, hd, hw - cr, hd);
        s.lineTo(-hw + cr, hd);
        s.quadraticCurveTo(-hw, hd, -hw, hd - cr);
        s.lineTo(-hw, -hd + cr);
        s.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
        return s;
    };
    const prism = (shape, depth, mat, y)=>{
        const m = add(root, new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: false,
            curveSegments: 12
        }), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.y = y;
        return m;
    };
    const glass = sheen('#182432', {
        refl: 0.68,
        spec: 1.25,
        glow: '#ffd9a8',
        glowK: 0.65,
        windows: 0.36
    });
    const bronze = sheen('#b87d46', {
        refl: 0.45,
        spec: 1.3,
        glow: '#ff9a55',
        glowK: 0.18
    });
    const silver = sheen('#c8ccd2', {
        refl: 0.55,
        spec: 1.35,
        glow: '#e8eef7',
        glowK: 0.12
    });
    const magenta = sheen('#e20074', {
        glow: '#ff1a8c',
        glowK: 2.4,
        baseGlow: 0.4
    });
    const trim = sheen('#7d828a');
    prism(rrect(w - 6, d - 6, r0), h, glass, 0);
    [
        {
            o: 2.8,
            h0: 2.5,
            dh: 3.6,
            mat: bronze
        },
        {
            o: 4.8,
            h0: 8.2,
            dh: 3.4,
            mat: silver
        },
        {
            o: 3.4,
            h0: 14.0,
            dh: 3.6,
            mat: bronze
        },
        {
            o: 5.4,
            h0: 19.8,
            dh: 3.6,
            mat: bronze
        },
        {
            o: 3.8,
            h0: 25.6,
            dh: 3.4,
            mat: silver
        },
        {
            o: 2.4,
            h0: 30.8,
            dh: 2.8,
            mat: bronze
        }
    ].forEach(({ o, h0, dh, mat }, i)=>{
        const ribbon = rrect(w + 2 * o, d + 2 * o, r0 + 2 + o);
        ribbon.holes.push(rrect(w - 7, d - 7, r0 - 1));
        prism(ribbon, dh, mat, h0);
        if (i % 2 === 1 || i === 5) {
            const led = rrect(w + 2 * o + 0.6, d + 2 * o + 0.6, r0 + 2.3 + o);
            led.holes.push(rrect(w + 2 * o - 0.8, d + 2 * o - 0.8, r0 + 1.5 + o));
            prism(led, 0.55, magenta, h0 + dh + 0.05);
        }
    });
    const crown = rrect(w + 3.6, d + 3.6, r0 + 3.6);
    crown.holes.push(rrect(w - 2, d - 2, r0 + 1));
    prism(crown, 1.4, magenta, h - 0.2);
    prism(rrect(w - 2, d - 2, r0 + 1), 1.5, sheen('#b4b8be'), h - 0.4);
    const truss = sheen('#80858c');
    const dome = add(root, new THREE.SphereGeometry(1, 44, 10, 0, Math.PI * 2, 0, Math.PI / 2), sheen('#d8dce2', {
        refl: 0.22,
        spec: 0.5
    }));
    dome.scale.set(w / 2 - 5, 5.6, d / 2 - 5);
    dome.position.y = h + 0.8;
    for(let k = 0; k < 16; k++){
        const th = k / 16 * Math.PI * 2, rx = Math.cos(th) * (w / 2 - 7), rz = Math.sin(th) * (d / 2 - 7), L = Math.hypot(rx, rz);
        const rib = add(root, new THREE.BoxGeometry(L, 0.85, 1.05), truss);
        rib.position.set(rx / 2, h + 4.9, rz / 2);
        rib.rotation.y = -Math.atan2(rz, rx);
    }
    const roofLogo = textPanel('T··Mobile  ARENA', w * 0.52, w * 0.12, {
        color: '#e20074',
        font: '800 96px Arial, sans-serif',
        background: '#e6eaef'
    });
    roofLogo.userData.keep = true;
    roofLogo.rotation.x = -Math.PI / 2;
    roofLogo.position.set(0, h + 6.55, 0);
    root.add(roofLogo);
    const atriumW = w * 0.52, atriumH = h + 5.5;
    const atrium = add(root, new THREE.BoxGeometry(atriumW, atriumH, 16), glass);
    atrium.position.set(0, atriumH / 2, d / 2 + 4);
    const balcony = add(root, new THREE.BoxGeometry(atriumW * 1.06, 1.4, 6.5), bronze);
    balcony.position.set(0, 14.5, d / 2 + 13.5);
    const balconyLed = add(root, new THREE.BoxGeometry(atriumW * 1.07, 0.55, 6.7), magenta);
    balconyLed.position.set(0, 13.7, d / 2 + 13.5);
    for(let k = -4; k <= 4; k++){
        const col = add(root, new THREE.BoxGeometry(0.55, atriumH, 0.8), silver);
        col.position.set(k * (atriumW / 9), atriumH / 2, d / 2 + 12.1);
        col.rotation.z = (k % 2 === 0 ? 1 : -1) * 0.14;
    }
    const lid = add(root, new THREE.BoxGeometry(atriumW * 1.08, 1.5, 21), bronze);
    lid.position.set(0, atriumH + 0.75, d / 2 + 5.5);
    const lidTrim = add(root, new THREE.BoxGeometry(atriumW * 1.09, 0.6, 21.4), magenta);
    lidTrim.position.set(0, atriumH + 1.6, d / 2 + 5.5);
    const sign = textPanel('T··Mobile  ARENA', w * 0.44, w * 0.105, {
        color: '#ff2a95',
        font: '800 96px sans-serif'
    });
    sign.userData.keep = true;
    sign.position.set(0, atriumH - 4.8, d / 2 + 12.4);
    root.add(sign);
    const plaza = add(root, new THREE.BoxGeometry(atriumW * 0.92, 0.24, 15), sheen('#000000', {
        live: 'plaza'
    }));
    plaza.position.set(0, 0.12, d / 2 + 14.5);
    const steelMesh = sheen('#b9c2cc', {
        refl: 0.3,
        spec: 0.8,
        glow: '#b98cff',
        glowK: 1.4
    });
    const bliss = new THREE.Group();
    bliss.position.set(-atriumW * 0.28, 0.24, d / 2 + 17.5);
    bliss.rotation.y = 0.5;
    const limb = (r0, r1, len, x, y, z, rx, rz)=>{
        const m = add(bliss, new THREE.CylinderGeometry(r1, r0, len, 10), steelMesh);
        m.position.set(x, y, z);
        m.rotation.set(rx, 0, rz);
    };
    limb(0.55, 0.8, 7, -0.9, 3.5, 0, 0, 0.12);
    limb(0.55, 0.8, 7, 1.0, 3.5, 0.6, 0.18, -0.2);
    limb(1.4, 1.1, 4.8, 0, 8.8, 0, 0, 0);
    limb(0.35, 0.45, 5, -1.6, 12.8, 0, 0, 0.5);
    limb(0.35, 0.45, 5, 1.6, 12.8, 0, 0, -0.5);
    add(bliss, new THREE.SphereGeometry(0.95, 14, 10), steelMesh).position.set(0, 12.2, 0);
    root.add(bliss);
    for(let k = 0; k < 4; k++){
        const x = (k - 1.5) * (atriumW * 0.22), z = d / 2 + 13.5 + k % 2 * 4.5;
        add(root, new THREE.CylinderGeometry(0.22, 0.26, 8.5, 8), trim).position.set(x, 4.25, z);
        add(root, new THREE.ConeGeometry(4.8, 2.0, 6, 1, true), bronze).position.set(x, 8.5, z);
    }
    const aura = add(root, new THREE.ExtrudeGeometry(rrect(w + 9, d + 9, r0 + 6), {
        depth: 7,
        bevelEnabled: false,
        curveSegments: 10
    }), nightAura('#ff2a95', 0.08));
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = h - 4;
    aura.userData.keep = true;
    const flare = halo(w * 1.9, '#ff5ab0', 0.05);
    flare.position.set(0, h + 2, 0);
    root.add(flare);
    return bakeStatic(root, keep);
}
function allegiant(data) {
    const f = footprint(data, /^allegiant stadium$/i);
    if (!f) return null;
    const g = new THREE.Group();
    g.name = 'Allegiant Stadium';
    const s = seat(g, f.c, f.yaw, f.w, f.d, STRIP_EAST);
    const a = s.w / 2 * 0.96, b = s.d / 2 * 0.96, H = 62;
    const black = sheen('#0b0d12', {
        refl: 0.6,
        spec: 1.3
    });
    add(g, new THREE.CylinderGeometry(1, 0.9, H, 64, 1, true), black).scale.set(a, 1, b);
    g.children[g.children.length - 1].position.y = H / 2;
    const base = add(g, new THREE.CylinderGeometry(0.92, 0.95, 8, 64), sheen('#1b1e24'));
    base.scale.set(a, 1, b);
    base.position.y = 4;
    const ribbon = sheen('#e9eef5', {
        refl: 0.25,
        spec: 0.8,
        glow: '#ffffff',
        glowK: 1.3,
        baseGlow: 0.15
    });
    const aura = nightAura('#bcd6ff', 0.1);
    for(let r = 0; r < 3; r++){
        const pts = [];
        for(let i = 0; i <= 160; i++){
            const th = i / 160 * TAU, y = H * (0.3 + r * 0.2) + H * 0.12 * Math.sin(th * 3 + r * 1.9);
            const k = 0.9 + 0.1 * (y / H) + 0.012;
            pts.push(new THREE.Vector3(Math.cos(th) * a * k, y, Math.sin(th) * b * k));
        }
        const curve = new THREE.CatmullRomCurve3(pts, true);
        add(g, new THREE.TubeGeometry(curve, 320, 1.1, 6, true), ribbon);
        add(g, new THREE.TubeGeometry(curve, 200, 3.6, 6, true), aura).userData.keep = true;
    }
    const rim = add(g, new THREE.TorusGeometry(1, 0.012, 6, 96), sheen('#c9d0d8'));
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(a * 1.005, b * 1.005, 150);
    rim.position.y = H;
    const roof = add(g, new THREE.SphereGeometry(1, 48, 12, 0, TAU, 0, Math.PI / 2), sheen('#c9ced6', {
        refl: 0.15,
        spec: 0.3,
        glow: '#cfe3ff',
        glowK: 0.05
    }));
    roof.scale.set(a * 0.99, 16, b * 0.99);
    roof.position.y = H;
    const cableMat = sheen('#6b7380');
    for(let k = 0; k < 20; k++){
        const th = k / 20 * TAU, len = Math.hypot(Math.cos(th) * a, Math.sin(th) * b);
        const cable = add(g, new THREE.BoxGeometry(len, 0.5, 0.5), cableMat);
        cable.position.set(Math.cos(th) * a / 2, H + 11, Math.sin(th) * b / 2);
        cable.rotation.y = -th;
    }
    const lanai = add(g, new THREE.CylinderGeometry(1, 0.9, H * 0.8, 24, 1, true, -0.35, 0.7), sheen('#1c2430', {
        refl: 0.7,
        spec: 1.2,
        glow: '#ffcf94',
        glowK: 0.16,
        windows: 0.32
    }));
    lanai.scale.set(a * 1.01, 1, b * 1.01);
    lanai.position.y = H * 0.45;
    const plaza = add(g, new THREE.BoxGeometry(a * 0.7, 0.3, 30), sheen('#000000', {
        live: 'plaza'
    }));
    plaza.position.set(0, 0.15, b + 12);
    add(g, new THREE.CylinderGeometry(1.4, 3, 26, 16), sheen('#dfe3e8', {
        refl: 0.4,
        spec: 1
    })).position.set(a * 0.35, 13, b + 20);
    const flame = add(g, new THREE.ConeGeometry(2.2, 6, 12), sheen('#ffb347', {
        glow: '#ff7a1a',
        glowK: 3,
        baseGlow: 1.2
    }));
    flame.position.set(a * 0.35, 29, b + 20);
    const torchGlow = halo(46, '#ff8a30', 0.75);
    torchGlow.position.set(a * 0.35, 30, b + 20);
    g.add(torchGlow);
    const sign = textPanel('ALLEGIANT STADIUM', a * 0.7, a * 0.09, {
        color: '#f4f6f8',
        font: '700 90px sans-serif'
    });
    sign.position.set(0, H * 0.91, b * 0.995 + 1.6);
    g.add(sign);
    const dome = halo(a * 3.4, '#a9c8ff', 0.04);
    dome.position.set(0, H * 0.7, 0);
    g.add(dome);
    return bakeStatic(g, keep);
}
