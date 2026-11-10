// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { bakeStatic } from './bake.js';
import { sheen } from './sheen.js';
export const SITE = {
    yellow: sheen('#e8b21c'),
    steel: sheen('#8b9097'),
    concrete: sheen('#b3aea4'),
    hoard: sheen('#1f3a5a'),
    net: sheen('#9cc2a5', {
        opacity: 0.35
    })
};
const warn = new THREE.MeshBasicMaterial({
    color: '#ff2a10',
    fog: true
});
const UP = new THREE.Vector3(0, 1, 0);
export function bar(g, mat, x0, y0, z0, x1, y1, z1, r = 0.12) {
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(r * 2, a.distanceTo(b), r * 2), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    g.add(m);
    return m;
}
export function block(g, mat, x, y, z, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    g.add(m);
    return m;
}
export function towerCrane(height = 80, jib = 50, phase = 0) {
    const obj = new THREE.Group();
    obj.userData.crane = true;
    const s = 1.1, { yellow, steel, concrete } = SITE;
    const mast = new THREE.Group();
    for (const [x, z] of [
        [
            -s,
            -s
        ],
        [
            s,
            -s
        ],
        [
            s,
            s
        ],
        [
            -s,
            s
        ]
    ])bar(mast, yellow, x, 0, z, x, height, z, 0.14);
    for(let y = 0; y < height; y += 3){
        const f = Math.floor(y / 3) % 2 ? 1 : -1;
        bar(mast, yellow, -s, y, s * f, s, y + 3, s * f, 0.07);
        bar(mast, yellow, s * f, y, -s, s * f, y + 3, s, 0.07);
    }
    block(mast, concrete, 0, -0.5, 0, 6, 1.2, 6);
    obj.add(bakeStatic(mast));
    const head = new THREE.Group();
    block(head, yellow, 0, 0, 0, 3, 1.4, 3);
    block(head, steel, 1.6, 0.2, 1.8, 2.2, 2.2, 2);
    for (const z of [
        -0.8,
        0.8
    ]){
        bar(head, yellow, 0, 1.4, z, jib, 1.4, z, 0.1);
        bar(head, yellow, 0, 1.4, z, -jib * 0.3, 1.4, z, 0.1);
    }
    bar(head, yellow, 0, 3.4, 0, jib, 1.6, 0, 0.08);
    for(let x = 3; x < jib; x += 3){
        const y = 2.4 - x / jib;
        bar(head, yellow, x, 1.4, -0.8, x + 1.5, y, 0, 0.05);
        bar(head, yellow, x, 1.4, 0.8, x + 1.5, y, 0, 0.05);
    }
    bar(head, yellow, 0, 1.4, 0, 0, 7, 0, 0.14);
    bar(head, steel, 0, 7, 0, jib * 0.7, 1.6, 0, 0.03);
    bar(head, steel, 0, 7, 0, -jib * 0.28, 1.6, 0, 0.03);
    block(head, concrete, -jib * 0.26, -0.4, 0, 4, 2.6, 2.6);
    const top = new THREE.Group();
    top.position.y = height;
    top.add(bakeStatic(head));
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.4), steel);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06).translate(0, -0.5, 0), steel);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 0.9), yellow);
    const peak = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), warn);
    peak.position.set(0, 7.4, 0);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), warn);
    tip.position.set(jib, 1.8, 0);
    top.add(trolley, line, hook, peak, tip);
    obj.add(top);
    const update = (t)=>{
        top.rotation.y = phase + Math.sin(t * 0.12 + phase) * 0.9;
        const x = jib * (0.42 + 0.34 * Math.sin(t * 0.09 + phase * 3));
        const drop = height * (0.38 + 0.2 * Math.sin(t * 0.14 + phase * 2));
        trolley.position.set(x, 0.85, 0);
        line.position.set(x, 0.6, 0);
        line.scale.y = drop;
        hook.position.set(x, 0.1 - drop, 0);
        for (const o of [
            top,
            trolley,
            line,
            hook
        ])o.updateMatrix();
        const on = Math.sin(t * 2.6) > 0 ? 1 : 0.22;
        warn.color.setRGB(on, 0.05 * on, 0.02 * on);
    };
    update(0);
    return {
        obj,
        update
    };
}
export function scaffold(w, d, y0, y1, bay = 3) {
    const g = new THREE.Group();
    const loop = [
        [
            -w / 2,
            -d / 2
        ],
        [
            w / 2,
            -d / 2
        ],
        [
            w / 2,
            d / 2
        ],
        [
            -w / 2,
            d / 2
        ]
    ];
    for(let i = 0; i < 4; i++){
        const [ax, az] = loop[i], [bx, bz] = loop[(i + 1) % 4];
        const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / bay));
        for(let k = 0; k <= n; k++){
            const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
            bar(g, SITE.steel, x, y0, z, x, y1, z, 0.06);
        }
        for(let y = y0; y <= y1; y += 2)bar(g, SITE.steel, ax, y, az, bx, y, bz, 0.05);
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(L, y1 - y0), SITE.net);
        sheet.position.set((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
        sheet.rotation.y = -Math.atan2(bz - az, bx - ax);
        g.add(sheet);
    }
    return g;
}
export function hoarding(w, d, h = 3) {
    const g = new THREE.Group();
    block(g, SITE.hoard, 0, 0, -d / 2, w, h, 0.3);
    block(g, SITE.hoard, -w / 2, 0, 0, 0.3, h, d);
    block(g, SITE.hoard, w / 2, 0, 0, 0.3, h, d);
    for (const s of [
        -1,
        1
    ])block(g, SITE.hoard, s * (w / 4 + 6), 0, d / 2, w / 2 - 12, h, 0.3);
    return g;
}
export function columnStubs(g, pts, y, h = 3.4) {
    for (const [x, z] of pts){
        block(g, SITE.concrete, x, y, z, 1.2, h, 1.2);
        for (const [dx, dz] of [
            [
                -0.4,
                -0.4
            ],
            [
                0.4,
                0.4
            ]
        ])bar(g, SITE.steel, x + dx, y + h, z + dz, x + dx, y + h + 1.6, z + dz, 0.03);
    }
}
