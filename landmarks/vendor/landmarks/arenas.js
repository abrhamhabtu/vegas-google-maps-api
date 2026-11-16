// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { convexHull, Soup } from '../map/geom.js';
import { bakeStatic } from './bake.js';
import { SITE, towerCrane } from './construction.js';
import { footprint } from './landmarks.js';
import { glowPoints, nightAura, sheen, textPanel } from './sheen.js';
const TAU = Math.PI * 2;
const STRIP_WEST = [
    -1,
    0
];
const keep = (o)=>o.userData.crane === true || o.userData.keep === true;
const add = (g, geo, mat)=>{
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    return m;
};
export function buildArenas(data, engine) {
    const out = new THREE.Group();
    out.name = 'arenas';
    const stadium = ballpark(data, engine);
    if (stadium) out.add(stadium);
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
