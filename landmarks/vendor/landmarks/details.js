// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { Soup, convexHull, normals, ringArea } from '../map/geom.js';
import { litColor } from '../map/materials.js';
import { sheen, textPanel } from './sheen.js';
import { box } from '../map/roads.js';
import { bakeStatic } from './bake.js';
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
const findB = (d, re)=>d.buildings.filter((b)=>b.name && re.test(b.name)).sort((a, b)=>Math.abs(ringArea(b.pts)) - Math.abs(ringArea(a.pts)))[0];
const glow = (c)=>new THREE.MeshBasicMaterial({
        color: c,
        fog: true
    });
export function buildDetails(data, engine) {
    const g = new THREE.Group();
    g.name = 'strip-details';
    const add = (o)=>{
        if (o) g.add(o);
    };
    const bake = (o)=>o ? bakeStatic(o, (k)=>k.userData.keep === true) : null;
    // Excalibur and the NYNY tower crowns are modelled in world/tropicana-trio.js.
    add(bake(nynySkyline(data)));
    add(bake(liberty(data)));
    add(coaster(data, engine));
    // Luxor's Sphinx and obelisk are drawn by world/luxor.js.
    add(trams(data));
    return g;
}
function excalibur(data) {
    const b = findB(data, /^excalibur hotel & casino$/i) ?? findB(data, /excalibur/i);
    if (!b) return null;
    const ring = b.pts;
    const bc = centroid(ring);
    const grp = new THREE.Group();
    grp.name = 'Excalibur castle';
    const white = litColor('#f5f1e8');
    const stoneTrim = litColor('#dfd5c0');
    const redRoof = sheen('#c91e28', {
        spec: 0.7,
        glow: '#ff4a4a',
        glowK: 0.22,
        baseGlow: 0.08
    });
    const blueRoof = sheen('#1e52a8', {
        spec: 0.7,
        glow: '#4a88ff',
        glowK: 0.22,
        baseGlow: 0.08
    });
    const goldRoof = sheen('#dca628', {
        refl: 0.45,
        spec: 1.1,
        glow: '#ffd36b',
        glowK: 0.35,
        baseGlow: 0.1
    });
    const ball = sheen('#f5cf58', {
        refl: 0.6,
        spec: 1.3,
        glow: '#ffe184',
        glowK: 0.6,
        baseGlow: 0.15
    });
    const roofs = [
        redRoof,
        blueRoof,
        goldRoof,
        redRoof
    ];
    const addTurretCrown = (target, x, z, r, baseH, extraShaft, roof)=>{
        const topY = baseH + extraShaft;
        if (extraShaft > 0.2) {
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, extraShaft, 16), white);
            shaft.position.set(x, baseH + extraShaft / 2, z);
            target.add(shaft);
        }
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.14, r * 1.0, 1.5, 16), stoneTrim);
        collar.position.set(x, topY - 0.3, z);
        target.add(collar);
        const merlons = Math.max(8, Math.min(14, Math.round(r * 2.4)));
        for(let k = 0; k < merlons; k++){
            const a = k / merlons * Math.PI * 2;
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.25, 0.85), white);
            m.position.set(x + Math.cos(a) * r * 1.04, topY + 0.85, z + Math.sin(a) * r * 1.04);
            m.rotation.y = -a;
            target.add(m);
        }
        const coneH = Math.max(7.5, r * 2.95);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.18, coneH, 16), roof);
        cone.position.set(x, topY + 1.1 + coneH / 2, z);
        target.add(cone);
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 2.8, 6), ball);
        spire.position.set(x, topY + 1.1 + coneH + 1.2, z);
        target.add(spire);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 6), ball);
        orb.position.set(x, topY + 1.1 + coneH + 2.6, z);
        target.add(orb);
    };
    let tIdx = 0;
    for (const part of data.buildings){
        if (!part.part) continue;
        const pc = centroid(part.pts);
        if (Math.hypot(pc[0] - bc[0], pc[1] - bc[1]) > 165) continue;
        const area = Math.abs(ringArea(part.pts));
        if (area >= 12 && area <= 260 && part.h >= 14) {
            const r = Math.max(2.2, Math.min(7.5, Math.sqrt(area / Math.PI)));
            const roof = roofs[tIdx++ % roofs.length];
            addTurretCrown(grp, pc[0], pc[1], r, part.h, 2.2, roof);
        } else if (part.h >= 55 && area > 2000) {
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (const p of part.pts){
                minX = Math.min(minX, p[0]);
                maxX = Math.max(maxX, p[0]);
                minZ = Math.min(minZ, p[1]);
                maxZ = Math.max(maxZ, p[1]);
            }
            const corners = [];
            for (const target of [
                [
                    minX,
                    minZ
                ],
                [
                    maxX,
                    minZ
                ],
                [
                    maxX,
                    maxZ
                ],
                [
                    minX,
                    maxZ
                ],
                [
                    pc[0],
                    pc[1]
                ]
            ]){
                let bestP = part.pts[0], bestD = Infinity;
                for (const p of part.pts){
                    const d = Math.hypot(p[0] - target[0], p[1] - target[1]);
                    if (d < bestD) {
                        bestD = d;
                        bestP = p;
                    }
                }
                if (corners.every((q)=>Math.hypot(q[0] - bestP[0], q[1] - bestP[1]) > 14)) corners.push(bestP);
            }
            corners.forEach((p, idx)=>{
                const dx = pc[0] - p[0], dz = pc[1] - p[1], L = Math.hypot(dx, dz) || 1;
                const tx = p[0] + dx / L * 2.8, tz = p[1] + dz / L * 2.8;
                addTurretCrown(grp, tx, tz, 3.6, part.h, 4.5, roofs[(idx + tIdx) % roofs.length]);
            });
        }
    }
    const xs = ring.map((p)=>p[0]);
    const maxX = Math.max(...xs), minX = Math.min(...xs);
    const front = ring.filter((p)=>p[0] > maxX - (maxX - minX) * 0.28);
    const fc = centroid(front);
    const gateGrp = new THREE.Group();
    gateGrp.position.set(fc[0] + 4, 0, fc[1]);
    gateGrp.rotation.y = Math.PI / 2;
    const moatWater = new THREE.Mesh(new THREE.BoxGeometry(112, 0.22, 18), sheen('#155e8a', {
        refl: 0.85,
        spec: 1.4,
        glow: '#3fc8ff',
        glowK: 0.35,
        baseGlow: 0.08
    }));
    moatWater.position.set(0, 0.11, 13);
    gateGrp.add(moatWater);
    const coping = new THREE.Mesh(new THREE.BoxGeometry(114, 0.55, 19.6), stoneTrim);
    coping.position.set(0, 0.05, 13);
    gateGrp.add(coping);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(106, 16, 9.5), stoneTrim);
    wall.position.set(0, 8, 5.5);
    gateGrp.add(wall);
    const redBanner = new THREE.Mesh(new THREE.BoxGeometry(106.4, 1.4, 9.8), redRoof);
    redBanner.position.set(0, 14.2, 5.5);
    gateGrp.add(redBanner);
    for(let x = -50; x <= 50; x += 3.2){
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 1.0), white);
        m.position.set(x, 16.9, 10.0);
        gateGrp.add(m);
    }
    const spires = [
        [
            -48,
            8,
            5.0,
            26,
            redRoof
        ],
        [
            48,
            8,
            5.0,
            26,
            redRoof
        ],
        [
            -34,
            4,
            4.3,
            33,
            blueRoof
        ],
        [
            34,
            4,
            4.3,
            33,
            blueRoof
        ],
        [
            -20,
            2,
            4.9,
            40,
            goldRoof
        ],
        [
            20,
            2,
            4.9,
            40,
            goldRoof
        ],
        [
            -10,
            7,
            3.6,
            29,
            redRoof
        ],
        [
            10,
            7,
            3.6,
            29,
            blueRoof
        ],
        [
            0,
            -2,
            7.2,
            50,
            redRoof
        ],
        [
            -27,
            -4,
            3.4,
            43,
            blueRoof
        ],
        [
            27,
            -4,
            3.4,
            43,
            goldRoof
        ]
    ];
    for (const [x, z, r, h, roof] of spires)addTurretCrown(gateGrp, x, z, r, 0, h, roof);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(16, 0.7, 13), litColor('#5b3b22'));
    bridge.position.set(0, 0.45, 15.5);
    gateGrp.add(bridge);
    const gateSurround = new THREE.Mesh(new THREE.BoxGeometry(13.5, 13.5, 1.4), white);
    gateSurround.position.set(0, 6.75, 10.4);
    gateGrp.add(gateSurround);
    const gate = new THREE.Mesh(new THREE.BoxGeometry(10, 11.5, 1.6), litColor('#1f2a33'));
    gate.position.set(0, 5.75, 10.5);
    gateGrp.add(gate);
    const sign = textPanel('EXCALIBUR', 38, 6.2, {
        font: '700 108pxCinzel, Georgia, serif',
        color: '#ffe388',
        background: '#8a141c'
    });
    sign.userData.keep = true;
    sign.position.set(0, 21.5, 11.2);
    gateGrp.add(sign);
    grp.add(gateGrp);
    return grp;
}
function nynySkyline(data) {
    const anchor = findB(data, /^new york new york hotel and casino$/i);
    if (!anchor) return null;
    const grp = new THREE.Group();
    grp.name = 'NYNY skyline crowns';
    const limestone = litColor('#e5dac3');
    const artDecoGold = sheen('#d8ad48', {
        refl: 0.5,
        spec: 1.2,
        glow: '#ffe08a',
        glowK: 0.7,
        baseGlow: 0.12
    });
    const silverSteel = sheen('#d6dde6', {
        refl: 0.82,
        spec: 1.5,
        glow: '#e6f0ff',
        glowK: 0.65,
        baseGlow: 0.1
    });
    const patinaCopper = sheen('#529682', {
        refl: 0.35,
        spec: 0.8,
        glow: '#78d4b8',
        glowK: 0.2,
        baseGlow: 0.05
    });
    const darkSlate = litColor('#3e4652');
    const wood = litColor('#6e4b32');
    const nynyParts = data.buildings.filter((b)=>{
        if (b) return false; // crowns now come from world/tropicana-trio.js
        const c = centroid(b.pts);
        return c[0] > -95 && c[0] < 40 && c[1] > 1440 && c[1] < 1650;
    });
    for (const part of nynyParts){
        const c = centroid(part.pts);
        const area = Math.abs(ringArea(part.pts));
        const h = part.h;
        if (area < 60) continue;
        if (h >= 158 && c[1] > 1560) {
            const esb = new THREE.Group();
            esb.position.set(c[0], h, c[1]);
            const t1 = new THREE.Mesh(new THREE.BoxGeometry(22, 6.5, 22), limestone);
            t1.position.y = 3.25;
            esb.add(t1);
            const t2 = new THREE.Mesh(new THREE.BoxGeometry(16, 5.5, 16), limestone);
            t2.position.y = 9.25;
            esb.add(t2);
            const t3 = new THREE.Mesh(new THREE.BoxGeometry(11, 4.5, 11), artDecoGold);
            t3.position.y = 14.25;
            esb.add(t3);
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.2, 16, 16), silverSteel);
            mast.position.y = 24.5;
            esb.add(mast);
            for (const ry of [
                18,
                23,
                28,
                32
            ]){
                const ringGlow = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.9, 16), glow('#ffd878'));
                ringGlow.position.y = ry;
                esb.add(ringGlow);
            }
            const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 1.3, 22, 10), silverSteel);
            spire.position.y = 43.5;
            esb.add(spire);
            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), glow('#ff3b30'));
            beacon.position.y = 55.0;
            esb.add(beacon);
            grp.add(esb);
            continue;
        }
        if (h >= 150 && c[1] < 1520) {
            const chr = new THREE.Group();
            chr.position.set(c[0], h, c[1]);
            for(let tier = 0; tier < 6; tier++){
                const f = 1 - tier * 0.14;
                const w = 15.5 * f, th = 3.2;
                const y = tier * 2.9 + th / 2;
                const boxTier = new THREE.Mesh(new THREE.BoxGeometry(w, th, w), silverSteel);
                boxTier.position.y = y;
                chr.add(boxTier);
                const arch = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.44, w * 0.44, w + 0.3, 12).rotateZ(Math.PI / 2), glow('#eef5ff'));
                arch.position.y = y + 0.3;
                chr.add(arch);
                const arch2 = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.44, w * 0.44, w + 0.3, 12).rotateX(Math.PI / 2), glow('#eef5ff'));
                arch2.position.y = y + 0.3;
                chr.add(arch2);
            }
            const needle = new THREE.Mesh(new THREE.ConeGeometry(1.4, 21, 12), silverSteel);
            needle.position.y = 6 * 2.9 + 10.5;
            chr.add(needle);
            grp.add(chr);
            continue;
        }
        const w = Math.max(12, Math.min(26, Math.sqrt(area) * 0.92));
        if (Math.abs(c[0] - -28) < 10 && Math.abs(c[1] - 1558) < 10) {
            const pyr = new THREE.Mesh(new THREE.ConeGeometry(w * 0.68, 18, 4).rotateY(Math.PI / 4), patinaCopper);
            pyr.position.set(c[0], h + 9, c[1]);
            grp.add(pyr);
            const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 6, 8), artDecoGold);
            lantern.position.set(c[0], h + 20, c[1]);
            grp.add(lantern);
        } else if (Math.abs(c[0] - -49) < 10 && Math.abs(c[1] - 1572) < 10) {
            for(let k = 0; k < 3; k++){
                const s = w * (0.85 - k * 0.2);
                const step = new THREE.Mesh(new THREE.BoxGeometry(s, 4.2, s), k === 2 ? artDecoGold : limestone);
                step.position.set(c[0], h + k * 4.2 + 2.1, c[1]);
                grp.add(step);
            }
        } else {
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.66, 7.5, 4).rotateY(Math.PI / 4), c[1] % 2 > 1 ? patinaCopper : darkSlate);
            cap.position.set(c[0], h + 3.75, c[1]);
            grp.add(cap);
            const legs = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 2.6, 6), darkSlate);
            legs.position.set(c[0] + 3, h + 1.3, c[1] - 2);
            grp.add(legs);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.2, 10), wood);
            barrel.position.set(c[0] + 3, h + 4.2, c[1] - 2);
            grp.add(barrel);
            const cone = new THREE.Mesh(new THREE.ConeGeometry(1.85, 1.5, 10), darkSlate);
            cone.position.set(c[0] + 3, h + 6.5, c[1] - 2);
            grp.add(cone);
        }
    }
    const nySign = textPanel('NEW YORK - NEW YORK', 38, 6.0, {
        font: '700 92px Georgia, serif',
        color: '#ffe494',
        background: '#162844'
    });
    nySign.userData.keep = true;
    nySign.position.set(78, 19, 1545);
    nySign.rotation.y = Math.PI / 2;
    grp.add(nySign);
    const hershey = data.pois.find((p)=>/hershey/i.test(p.n));
    if (hershey) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 16, 9.5), litColor('#3d1e10'));
        bar.position.set(hershey.x - 4, 11, hershey.z);
        grp.add(bar);
        const hSign = textPanel("HERSHEY'S", 11, 3.2, {
            font: '700 100px Arial, sans-serif',
            color: '#f5efe6',
            background: '#4a2212'
        });
        hSign.userData.keep = true;
        hSign.position.set(hershey.x - 2.2, 13.5, hershey.z);
        hSign.rotation.y = Math.PI / 2;
        grp.add(hSign);
    }
    return grp;
}
function liberty(data) {
    const p = data.pois.find((q)=>/^statue of liberty$/i.test(q.n));
    if (!p) return null;
    const grp = new THREE.Group();
    grp.name = 'Statue of Liberty';
    const stone = litColor('#d5cbb8');
    const darkStone = litColor('#b0a48e');
    const copper = sheen('#6ec2a2', {
        spec: 0.65,
        glow: '#7fe0bc',
        glowK: 0.28,
        baseGlow: 0.08
    });
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(16.5, 17.2, 0.7, 24), sheen('#166891', {
        refl: 0.85,
        spec: 1.4,
        glow: '#4fd2ff',
        glowK: 0.4,
        baseGlow: 0.1
    }));
    pool.position.y = 0.35;
    grp.add(pool);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(17.8, 18.2, 0.55, 24), darkStone);
    rim.position.y = 0.25;
    grp.add(rim);
    for(let k = 0; k < 2; k++){
        const star = new THREE.Mesh(new THREE.BoxGeometry(14.5, 4.2, 14.5), darkStone);
        star.position.y = 2.1;
        star.rotation.y = k * Math.PI / 4;
        grp.add(star);
    }
    const ped = new THREE.Mesh(new THREE.BoxGeometry(9.6, 12.5, 9.6), stone);
    ped.position.y = 10.2;
    grp.add(ped);
    const cornice1 = new THREE.Mesh(new THREE.BoxGeometry(10.8, 1.1, 10.8), darkStone);
    cornice1.position.y = 16.6;
    grp.add(cornice1);
    const ped2 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 5.8, 7.2), stone);
    ped2.position.y = 19.8;
    grp.add(ped2);
    const cornice2 = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.9, 8.4), darkStone);
    cornice2.position.y = 22.9;
    grp.add(cornice2);
    const robeLower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.4, 9.5, 14), copper);
    robeLower.position.y = 28.0;
    grp.add(robeLower);
    const robeUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.6, 7.5, 14), copper);
    robeUpper.position.y = 35.8;
    grp.add(robeUpper);
    const sash = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6.8, 1.2), copper);
    sash.position.set(0, 35.5, 1.5);
    sash.rotation.z = 0.35;
    grp.add(sash);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.55, 12, 10), copper);
    head.position.y = 40.8;
    grp.add(head);
    const crownBand = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.58, 0.7, 12), copper);
    crownBand.position.y = 41.6;
    grp.add(crownBand);
    for(let i = 0; i < 7; i++){
        const ray = new THREE.Mesh(new THREE.ConeGeometry(0.24, 2.2, 4), copper);
        const a = -Math.PI / 2 + (i - 3) * 0.32;
        ray.position.set(Math.cos(a) * 1.65, 42.1 + Math.sin(a + Math.PI) * -0.5, Math.sin(a) * 0.3 - 0.3);
        ray.rotation.z = -(i - 3) * 0.32;
        grp.add(ray);
    }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.65, 8.8, 8), copper);
    arm.position.set(2.1, 42.5, 0.2);
    arm.rotation.z = -0.22;
    grp.add(arm);
    const torchCup = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.45, 1.1, 10), litColor('#c99b3b'));
    torchCup.position.set(3.0, 46.8, 0.2);
    grp.add(torchCup);
    const torch = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.4, 10), glow('#ffdd6b'));
    torch.position.set(3.0, 48.4, 0.2);
    grp.add(torch);
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 2.2), copper);
    tablet.position.set(-2.5, 34.2, 0.8);
    tablet.rotation.z = 0.2;
    grp.add(tablet);
    grp.position.set(p.x, 0, p.z);
    grp.rotation.y = -Math.PI / 2;
    return grp;
}
function coaster(data, engine) {
    const anchor = findB(data, /^new york new york hotel and casino$/i);
    if (!anchor) return null;
    const rawPts = [
        [
            38,
            18,
            1515
        ],
        [
            44,
            19,
            1575
        ],
        [
            16,
            22,
            1638
        ],
        [
            -22,
            38,
            1648
        ],
        [
            -58,
            56,
            1632
        ],
        [
            -68,
            62,
            1582
        ],
        [
            -62,
            54,
            1525
        ],
        [
            -34,
            21,
            1488
        ],
        [
            4,
            46,
            1464
        ],
        [
            48,
            20,
            1474
        ],
        [
            72,
            15,
            1502
        ]
    ];
    for(let k = 1; k <= 11; k++){
        const a = -Math.PI / 2 + k / 12 * Math.PI * 2;
        const lx = 73 + k / 12 * 6;
        const ly = 27 + Math.sin(a) * 12;
        const lz = 1518 + Math.cos(a) * 11;
        rawPts.push([
            lx,
            ly,
            lz
        ]);
    }
    rawPts.push([
        80,
        15,
        1536
    ], [
        84,
        34,
        1568
    ], [
        76,
        18,
        1604
    ], [
        88,
        13,
        1644
    ], [
        84,
        14,
        1666
    ], [
        56,
        17,
        1656
    ], [
        24,
        25,
        1612
    ], [
        28,
        20,
        1558
    ]);
    const ctrl = rawPts.map(([x, y, z])=>new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(ctrl, true, 'catmullrom', 0.35);
    const grp = new THREE.Group();
    grp.name = 'Big Apple Coaster';
    const trackGrp = new THREE.Group();
    const redRail = sheen('#e0242c', {
        spec: 0.9,
        glow: '#ff3b3b',
        glowK: 0.28,
        baseGlow: 0.1
    });
    const spineMat = litColor('#a81920');
    const tieMat = litColor('#c82028');
    for (const [dx, dy] of [
        [
            -0.55,
            0.22
        ],
        [
            0.55,
            0.22
        ]
    ]){
        const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 560, 0.22, 6, true), redRail);
        rail.position.set(dx, dy, 0);
        trackGrp.add(rail);
    }
    const spine = new THREE.Mesh(new THREE.TubeGeometry(curve, 560, 0.38, 6, true), spineMat);
    spine.position.y = -0.35;
    trackGrp.add(spine);
    const ties = new Soup();
    const sup = new Soup();
    const footers = new Soup();
    const samples = 360;
    for(let i = 0; i < samples; i++){
        const u = i / samples;
        const p = curve.getPointAt(u);
        const tan = curve.getTangentAt(u);
        const yaw = Math.atan2(tan.x, tan.z);
        if (i % 2 === 0) {
            box(ties, p.x, p.z, 1.35, 0.22, p.y - 0.15, p.y + 0.18, yaw);
        }
        const inLoopTop = p.z > 1506 && p.z < 1530 && p.x > 70 && p.y > 24;
        if (i % 9 === 0 && !inLoopTop) {
            box(sup, p.x, p.z, 0.55, 0.55, 0, p.y - 0.35, 0);
            box(footers, p.x, p.z, 1.2, 1.2, 0, 1.2, 0);
        }
    }
    trackGrp.add(new THREE.Mesh(ties.geometry(), tieMat));
    trackGrp.add(new THREE.Mesh(sup.geometry(), litColor('#7a828e')));
    trackGrp.add(new THREE.Mesh(footers.geometry(), litColor('#cfc8ba')));
    grp.add(bakeStatic(trackGrp));
    const trainGrp = new THREE.Group();
    trainGrp.name = 'NYC Taxi Coaster Train';
    const taxiYellow = sheen('#ffcc18', {
        refl: 0.5,
        spec: 1.2,
        glow: '#ffda44',
        glowK: 0.5,
        baseGlow: 0.18
    });
    const checkerBlack = litColor('#181a1f');
    const headlightMat = glow('#ffffff');
    const taillightMat = glow('#ff2a2a');
    const cars = [];
    const CAR_COUNT = 6;
    for(let c = 0; c < CAR_COUNT; c++){
        const car = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.95, 3.1), taxiYellow);
        body.position.y = 0.72;
        car.add(body);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.24, 3.14), checkerBlack);
        stripe.position.y = 0.72;
        car.add(stripe);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.4), checkerBlack);
        hood.position.set(0, 1.25, -0.2);
        car.add(hood);
        if (c === 0) {
            const roofLight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.35), headlightMat);
            roofLight.position.set(0, 1.55, 0.1);
            car.add(roofLight);
            for (const sx of [
                -0.55,
                0.55
            ]){
                const hl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), headlightMat);
                hl.position.set(sx, 0.72, 1.6);
                car.add(hl);
            }
        }
        if (c === CAR_COUNT - 1) {
            for (const sx of [
                -0.55,
                0.55
            ]){
                const tl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), taillightMat);
                tl.position.set(sx, 0.72, -1.6);
                car.add(tl);
            }
        }
        cars.push(car);
        trainGrp.add(car);
    }
    grp.add(trainGrp);
    if (engine) {
        const lookTarget = new THREE.Vector3();
        const placeTrain = (t)=>{
            const baseU = t * 0.042 % 1;
            for(let c = 0; c < CAR_COUNT; c++){
                const u = (baseU - c * 0.0046 + 1) % 1;
                const p = curve.getPointAt(u);
                const tan = curve.getTangentAt(u);
                const car = cars[c];
                car.position.copy(p);
                lookTarget.copy(p).add(tan);
                car.lookAt(lookTarget);
                car.updateMatrix();
            }
        };
        placeTrain(0);
        engine.animate(trainGrp, (f)=>placeTrain(f.t), new THREE.Sphere(new THREE.Vector3(15, 30, 1565), 160));
    }
    return grp;
}
function luxorExtras(data) {
    const b = findB(data, /^luxor( las vegas)?$/i);
    if (!b) return null;
    const c = centroid(b.pts);
    const hull = convexHull(b.pts);
    let best = {
        yaw: 0,
        half: 90,
        a: Infinity
    };
    for(let i = 0; i < hull.length; i++){
        const p = hull[i], q = hull[(i + 1) % hull.length];
        const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
        const cs = Math.cos(ang), sn = Math.sin(ang);
        let mu = Infinity, Mu = -Infinity, mv = Infinity, Mv = -Infinity;
        for (const h of hull){
            const u = h[0] * cs + h[1] * sn, v = -h[0] * sn + h[1] * cs;
            mu = Math.min(mu, u);
            Mu = Math.max(Mu, u);
            mv = Math.min(mv, v);
            Mv = Math.max(Mv, v);
        }
        const a = (Mu - mu) * (Mv - mv);
        if (a < best.a) best = {
            yaw: ang,
            half: Math.max(Mu - mu, Mv - mv) / 2,
            a
        };
    }
    const H = 107, half = best.half;
    const grp = new THREE.Group();
    grp.name = 'Luxor details';
    const ridge = new THREE.MeshBasicMaterial({
        color: '#cfe0ff',
        fog: true
    });
    for(let i = 0; i < 4; i++){
        const a = best.yaw + Math.PI / 4 + i * Math.PI / 2;
        const corner = new THREE.Vector3(Math.cos(a) * half * Math.SQRT2, 0, Math.sin(a) * half * Math.SQRT2);
        const apex = new THREE.Vector3(0, H, 0);
        const len = corner.distanceTo(apex);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, len, 4), ridge);
        const off = new THREE.Vector3(c[0], 0, c[1]);
        corner.add(off);
        apex.add(off);
        m.position.copy(corner.clone().add(apex).multiplyScalar(0.5));
        m.lookAt(apex);
        m.rotateX(Math.PI / 2);
        grp.add(m);
    }
    const stone = litColor('#d8bc8c');
    const goldTrim = sheen('#e0b24c', {
        refl: 0.45,
        spec: 1.1,
        glow: '#ffd670',
        glowK: 0.4,
        baseGlow: 0.1
    });
    const royalBlue = litColor('#1f4488');
    let front = new THREE.Vector3(1, 0, 0), fx = -2;
    for(let i = 0; i < 4; i++){
        const a = best.yaw + i * Math.PI / 2;
        if (Math.cos(a) > fx) {
            fx = Math.cos(a);
            front = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        }
    }
    const sph = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(52, 2.4, 22), litColor('#bfa172'));
    plinth.position.set(4, 1.2, 0);
    sph.add(plinth);
    const body = new THREE.Mesh(new THREE.BoxGeometry(36, 11, 15), stone);
    body.position.set(0, 7.5, 0);
    sph.add(body);
    const haunch = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 15, 14).rotateX(Math.PI / 2), stone);
    haunch.position.set(-15, 8.5, 0);
    sph.add(haunch);
    for (const z of [
        -4.8,
        4.8
    ]){
        const paw = new THREE.Mesh(new THREE.BoxGeometry(18, 3.8, 4.4), stone);
        paw.position.set(22, 4.1, z);
        sph.add(paw);
    }
    const chest = new THREE.Mesh(new THREE.BoxGeometry(11, 17, 13), stone);
    chest.position.set(13, 12.5, 0);
    sph.add(chest);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.2, 2.2, 12), goldTrim);
    collar.position.set(14.5, 19.5, 0);
    sph.add(collar);
    const head = new THREE.Mesh(new THREE.BoxGeometry(8.2, 9.4, 8.2), goldTrim);
    head.position.set(15.5, 24.5, 0);
    sph.add(head);
    const nemes = new THREE.Mesh(new THREE.ConeGeometry(8.8, 10.5, 4, 1, false, Math.PI / 4), royalBlue);
    nemes.position.set(13.8, 25.5, 0);
    nemes.scale.set(0.82, 1, 1.25);
    sph.add(nemes);
    for (const s of [
        -1,
        1
    ]){
        const lap = new THREE.Mesh(new THREE.BoxGeometry(4.4, 13, 2.4), royalBlue);
        lap.position.set(14.5, 18.5, s * 5.8);
        sph.add(lap);
        const lapGold = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 2.6), goldTrim);
        lapGold.position.set(14.5, 15.5, s * 5.8);
        sph.add(lapGold);
    }
    const beard = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 5.2, 6), royalBlue);
    beard.position.set(19.2, 18.2, 0);
    beard.rotation.z = -0.25;
    sph.add(beard);
    const cobra = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.9), goldTrim);
    cobra.position.set(19.8, 28.2, 0);
    sph.add(cobra);
    sph.position.set(c[0] + front.x * (half + 60), 0, c[1] + front.z * (half + 60));
    sph.rotation.y = -Math.atan2(front.z, front.x);
    grp.add(sph);
    const ob = new THREE.Group();
    const obBase = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4.5, 7.5), litColor('#bfa172'));
    obBase.position.y = 2.25;
    ob.add(obBase);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.8, 34, 4, 1), stone);
    shaft.position.y = 21.5;
    shaft.rotation.y = Math.PI / 4;
    ob.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.8, 4), glow('#ffd86b'));
    tip.position.y = 40.4;
    tip.rotation.y = Math.PI / 4;
    ob.add(tip);
    ob.position.set(c[0] + front.x * (half + 120) + front.z * 30, 0, c[1] + front.z * (half + 120) - front.x * 30);
    grp.add(ob);
    const sign = textPanel('LUXOR', 42, 8.5, {
        font: '600 120px Didot, Georgia, serif',
        color: '#f3e3b0'
    });
    sign.userData.keep = true;
    const sAt = half * 0.76;
    sign.position.set(c[0] + front.x * sAt, 20, c[1] + front.z * sAt);
    sign.rotation.y = Math.atan2(front.x, front.z);
    grp.add(sign);
    return grp;
}
function trams(data) {
    const s = new Soup();
    const H = 7.5, HW = 1.5;
    for (const r of data.rail){
        if (r.k !== 'funicular' || !r.br) continue;
        const pts = r.pts;
        const n = normals(pts);
        for(let i = 0; i < pts.length - 1; i++){
            const a = pts[i], b = pts[i + 1], na = n[i], nb = n[i + 1];
            const v = [
                s.vert(a[0] - na[0] * HW, H, a[1] - na[1] * HW, [
                    0,
                    1,
                    0
                ]),
                s.vert(a[0] + na[0] * HW, H, a[1] + na[1] * HW, [
                    0,
                    1,
                    0
                ]),
                s.vert(b[0] + nb[0] * HW, H, b[1] + nb[1] * HW, [
                    0,
                    1,
                    0
                ]),
                s.vert(b[0] - nb[0] * HW, H, b[1] - nb[1] * HW, [
                    0,
                    1,
                    0
                ])
            ];
            s.quad(v[0], v[1], v[2], v[3]);
            for (const side of [
                -1,
                1
            ]){
                const nn = [
                    na[0] * side,
                    0,
                    na[1] * side
                ];
                const w = [
                    s.vert(a[0] + na[0] * HW * side, H - 1.4, a[1] + na[1] * HW * side, nn),
                    s.vert(b[0] + nb[0] * HW * side, H - 1.4, b[1] + nb[1] * HW * side, nn),
                    s.vert(b[0] + nb[0] * HW * side, H + 0.5, b[1] + nb[1] * HW * side, nn),
                    s.vert(a[0] + na[0] * HW * side, H + 0.5, a[1] + na[1] * HW * side, nn)
                ];
                s.quad(w[0], w[1], w[2], w[3]);
            }
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            for(let d = 0; d < L; d += 28)box(s, a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L, 1.2, 1.2, 0, H - 1.4, 0);
        }
    }
    if (!s.idx.length) return null;
    const m = new THREE.Mesh(s.geometry(), litColor('#8e96a6'));
    m.name = 'Resort trams';
    return m;
}
