// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { latLonToXZ } from '../core/data.js';
import { ORIGIN } from '../places.js';
import { bakeStatic } from './bake.js';
import { block, columnStubs, hoarding, scaffold, SITE, towerCrane } from './construction.js';
import { footprint } from './landmarks.js';
import { nightAura, sheen, textPanel } from './sheen.js';
export const GUITAR_FACING_DEG = 40;
const SX = 0.8;
export function buildGuitar(data, engine) {
    const f = footprint(data, /guitar tower/i);
    const c = f?.c ?? latLonToXZ(ORIGIN, 36.1213, -115.1741);
    const g = new THREE.Group();
    g.name = 'Hard Rock guitar';
    const facing = GUITAR_FACING_DEG * Math.PI / 180;
    g.position.set(c[0], 0, c[1]);
    g.rotation.y = Math.atan2(Math.cos(facing), Math.sin(facing));
    const dark = sheen('#23252d');
    const gold = sheen('#d8a93c', {
        refl: 0.3,
        spec: 1.2,
        glow: '#ffc04d',
        glowK: 1.4,
        baseGlow: 0.12
    });
    const ivory = sheen('#f4ecd8', {
        refl: 0.2,
        spec: 0.6,
        glow: '#fff4d8',
        glowK: 2.2
    });
    const teal = sheen('#327e96', {
        refl: 0.5,
        spec: 1.1,
        glow: '#3fd4ff',
        glowK: 0.1,
        windows: 0.5
    });
    const add = (geo, mat, x, y, z)=>{
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        g.add(m);
        return m;
    };
    block(g, sheen('#2a2d36', {
        windows: 0.45,
        refl: 0.2
    }), 0, 0, 0, 88, 12, 40);
    const S = (x)=>x * SX;
    const shape = new THREE.Shape();
    shape.moveTo(0, 12);
    shape.bezierCurveTo(S(-60), 12, S(-58), 62, S(-33), 78);
    shape.bezierCurveTo(S(-18), 90, S(-44), 105, S(-34), 133);
    shape.bezierCurveTo(S(-22), 148, S(-13), 116, S(-9), 122);
    shape.lineTo(-8.6, 150);
    shape.lineTo(8.6, 150);
    shape.lineTo(9, 123);
    shape.bezierCurveTo(S(20), 115, S(28), 157, S(39), 137);
    shape.bezierCurveTo(S(50), 115, S(18), 94, S(34), 78);
    shape.bezierCurveTo(S(59), 60, S(61), 12, 0, 12);
    add(new THREE.ExtrudeGeometry(shape, {
        depth: 24,
        bevelEnabled: true,
        bevelSize: 1,
        bevelThickness: 0.8,
        bevelSegments: 2,
        curveSegments: 18
    }), teal, 0, 0, -12);
    const outline = shape.getPoints(140).map((p)=>new THREE.Vector3(p.x, p.y, 0));
    const curve = new THREE.CatmullRomCurve3(outline, true);
    const aura = nightAura('#ffb84a', 0.1);
    for (const z of [
        13.3,
        -13.3
    ]){
        add(new THREE.TubeGeometry(curve, 320, 0.7, 6, true), gold, 0, 0, z);
        add(new THREE.TubeGeometry(curve, 200, 2.6, 6, true), aura, 0, 0, z).userData.keep = true;
    }
    for(let i = 0; i < 6; i++)block(g, ivory, (i - 2.5) * 2.3, 43, 13.5, 0.3, 105, 0.35);
    block(g, dark, 0, 40, 14, 22, 3, 2);
    block(g, dark, 0, 69, 14, 19, 4, 2);
    block(g, SITE.concrete, 0, 150, 0, 13, 9, 11);
    columnStubs(g, [
        [
            -5,
            -4
        ],
        [
            5,
            -4
        ],
        [
            -5,
            4
        ],
        [
            5,
            4
        ]
    ], 159);
    g.add(scaffold(22, 30, 112, 164));
    const tall = towerCrane(222, 46, 0.4), low = towerCrane(128, 40, 2.1);
    tall.obj.position.set(-30, 0, -19);
    low.obj.position.set(32, 0, -19);
    g.add(tall.obj, low.obj);
    g.add(hoarding(92, 44));
    const sign = textPanel('Hard Rock', 40, 10, {
        font: 'italic 95px Georgia',
        color: '#ffe3a0',
        sub: 'HOTEL & CASINO · OPENING 2027'
    });
    sign.position.set(0, 6.5, 20.4);
    g.add(sign);
    const baked = bakeStatic(g, (o)=>o.userData.crane === true || o.userData.keep === true);
    engine.animate(baked, (fi)=>{
        tall.update(fi.t);
        low.update(fi.t);
    }, new THREE.Sphere(new THREE.Vector3(c[0], 100, c[1]), 170));
    return baked;
}
