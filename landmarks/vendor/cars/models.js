// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { mergeGeometries } from '../three/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../three/RoundedBoxGeometry.js';
const tyreMat = new THREE.MeshStandardMaterial({
    color: 0x151515,
    roughness: 0.9
});
const rimMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.25,
    metalness: 0.9
});
const rimDark = new THREE.MeshStandardMaterial({
    color: 0x2b2f36,
    roughness: 0.35,
    metalness: 0.8
});
const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0f14,
    roughness: 0.05,
    metalness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6
});
const trimMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.55,
    metalness: 0.2
});
const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xf4f7ff,
    emissiveIntensity: 1.2,
    roughness: 0.2
});
const tailMat = new THREE.MeshStandardMaterial({
    color: 0x5a0a10,
    emissive: 0xff1a2a,
    emissiveIntensity: 0.6,
    roughness: 0.3
});
export const LIGHT_MATS = {
    headMat,
    tailMat
};
const paintCache = new Map();
export function paint(hex) {
    let m = paintCache.get(hex);
    if (!m) {
        m = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(hex),
            metalness: 0.55,
            roughness: 0.32,
            clearcoat: 1,
            clearcoatRoughness: 0.04,
            envMapIntensity: 1.25
        });
        paintCache.set(hex, m);
    }
    return m;
}
function bodyShape(P) {
    const { L, wb, r, belt, hood, nose, tail, clear } = P;
    const fx = wb / 2, rx = -wb / 2, hl = L / 2;
    const s = new THREE.Shape();
    s.moveTo(-hl + 0.1, clear + 0.08);
    s.lineTo(rx - r - 0.07, clear);
    s.absarc(rx, r, r + 0.07, Math.PI, 0, true);
    s.lineTo(fx - r - 0.07, clear);
    s.absarc(fx, r, r + 0.07, Math.PI, 0, true);
    s.lineTo(hl - 0.2, clear + 0.02);
    s.quadraticCurveTo(hl + 0.02, clear + 0.05, hl, nose);
    s.quadraticCurveTo(hl - 0.05, hood + 0.02, hl - 0.55, hood);
    s.lineTo(P.shield, belt);
    s.lineTo(P.rear, belt);
    s.quadraticCurveTo(-hl + 0.1, tail + 0.05, -hl, tail - 0.08);
    s.quadraticCurveTo(-hl - 0.04, clear + 0.25, -hl + 0.1, clear + 0.08);
    return s;
}
function canopyShape(P) {
    const s = new THREE.Shape();
    s.moveTo(P.shield + 0.08, P.belt - 0.02);
    s.quadraticCurveTo(P.roofF + 0.25, P.roof - 0.02, P.roofF, P.roof);
    s.quadraticCurveTo((P.roofF + P.roofR) / 2, P.roof + 0.06, P.roofR, P.roof - 0.02);
    s.quadraticCurveTo(P.rear + 0.25, P.roof - 0.15, P.rear - 0.05, P.belt - 0.02);
    s.lineTo(P.shield + 0.08, P.belt - 0.02);
    return s;
}
function extrude(shape, width, bevel, mat) {
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: width - bevel * 2,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel * 0.8,
        bevelSegments: 5,
        curveSegments: 18
    });
    g.translate(0, 0, -(width - bevel * 2) / 2);
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
}
function wheel(P, dark) {
    const g = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r, P.tw, 28, 1), tyreMat);
    tyre.rotation.x = Math.PI / 2;
    const side = new THREE.Mesh(new THREE.TorusGeometry(P.r * 0.84, P.r * 0.16, 8, 28), tyreMat);
    side.position.z = P.tw / 2 - 0.02;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(P.r * 0.72, P.r * 0.72, 0.04, 24), dark ? rimDark : rimMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = P.tw / 2 - 0.03;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(P.r * 0.14, P.r * 0.14, 0.05, 12), trimMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = P.tw / 2;
    g.add(tyre, side, disc, hub);
    for(let i = 0; i < 5; i++){
        const sp = new THREE.Mesh(new THREE.BoxGeometry(P.r * 0.62, 0.08, 0.03), i % 2 ? rimMat : rimDark);
        sp.position.set(Math.cos(i / 5 * Math.PI * 2) * P.r * 0.32, Math.sin(i / 5 * Math.PI * 2) * P.r * 0.32, P.tw / 2 - 0.005);
        sp.rotation.z = i / 5 * Math.PI * 2;
        g.add(sp);
    }
    return g;
}
const PRESETS = {
    hero: {
        L: 4.75,
        W: 1.95,
        wb: 2.9,
        r: 0.37,
        tw: 0.26,
        clear: 0.2,
        nose: 0.62,
        hood: 0.86,
        belt: 0.98,
        tail: 1.02,
        shield: 0.95,
        rear: -1.95,
        roofF: 0.1,
        roofR: -0.85,
        roof: 1.58,
        dark: true
    },
    sedan: {
        L: 4.6,
        W: 1.88,
        wb: 2.8,
        r: 0.34,
        tw: 0.24,
        clear: 0.18,
        nose: 0.6,
        hood: 0.8,
        belt: 0.93,
        tail: 0.95,
        shield: 0.85,
        rear: -1.75,
        roofF: 0.0,
        roofR: -0.95,
        roof: 1.44
    },
    suv: {
        L: 4.8,
        W: 1.95,
        wb: 2.85,
        r: 0.38,
        tw: 0.26,
        clear: 0.26,
        nose: 0.78,
        hood: 1.02,
        belt: 1.12,
        tail: 1.2,
        shield: 0.9,
        rear: -2.2,
        roofF: 0.25,
        roofR: -1.95,
        roof: 1.78
    },
    van: {
        L: 6.1,
        W: 2.15,
        wb: 3.7,
        r: 0.38,
        tw: 0.28,
        clear: 0.28,
        nose: 0.9,
        hood: 1.15,
        belt: 1.25,
        tail: 2.45,
        shield: 2.0,
        rear: -2.95,
        roofF: 1.45,
        roofR: -2.95,
        roof: 2.55
    }
};
export function buildCar(kind = 'sedan', color = '#f5f5f4') {
    const P = PRESETS[kind];
    const car = new THREE.Group();
    const body = new THREE.Group();
    car.add(body);
    const pm = paint(color);
    const shell = extrude(bodyShape(P), P.W, 0.12, pm);
    body.add(shell);
    if (kind === 'van') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(P.L - 1.9, P.roof - P.belt + 0.1, P.W - 0.02), pm);
        box.position.set(-0.95, (P.roof + P.belt) / 2 - 0.02, 0);
        body.add(box);
        const ws = extrude((()=>{
            const s = new THREE.Shape();
            s.moveTo(1.55, P.belt);
            s.lineTo(2.2, P.belt);
            s.quadraticCurveTo(2.05, 1.9, 1.62, 2.35);
            s.lineTo(1.55, 2.35);
            s.lineTo(1.55, P.belt);
            return s;
        })(), P.W - 0.12, 0.06, glassMat);
        body.add(ws);
    } else {
        const can = extrude(canopyShape(P), P.W - 0.5, 0.22, glassMat);
        body.add(can);
    }
    const hl = P.L / 2 + 0.1;
    for (const sd of [
        -1,
        1
    ]){
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.5), headMat);
        strip.position.set(hl - 0.08, P.nose + 0.1, sd * (P.W / 2 - 0.38));
        strip.rotation.y = sd * 0.25;
        body.add(strip);
        const mir = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.2), P.dark ? pm : trimMat);
        mir.position.set(P.shield - 0.2, P.belt + 0.1, sd * (P.W / 2 + 0.07));
        body.add(mir);
        for (const ax of [
            P.wb / 2,
            -P.wb / 2
        ]){
            const arch = new THREE.Mesh(new THREE.TorusGeometry(P.r + 0.1, 0.05, 6, 20, Math.PI), trimMat);
            arch.position.set(ax, P.r, sd * (P.W / 2 + 0.005));
            body.add(arch);
        }
        const sill = new THREE.Mesh(new THREE.BoxGeometry(P.wb - 2 * P.r - 0.3, 0.14, 0.04), trimMat);
        sill.position.set(0, P.clear + 0.1, sd * (P.W / 2 + 0.005));
        body.add(sill);
        for (const dx of [
            P.shield - 0.35,
            (P.shield + P.rear) / 2 + 0.05
        ]){
            const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, P.belt - P.clear - 0.25, 0.01), trimMat);
            seam.position.set(dx, (P.belt + P.clear) / 2 + 0.05, sd * (P.W / 2 + 0.003));
            body.add(seam);
        }
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.012), trimMat);
        handle.position.set(P.shield - 0.65, P.belt - 0.12, sd * (P.W / 2 + 0.004));
        body.add(handle);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, P.W - 0.36), tailMat);
    bar.position.set(-P.L / 2 - 0.1, P.tail - 0.16, 0);
    body.add(bar);
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, P.W - 0.24), trimMat);
    diffuser.position.set(-P.L / 2 - 0.02, P.clear + 0.14, 0);
    body.add(diffuser);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, P.W - 0.7), trimMat);
    grille.position.set(P.L / 2 + 0.06, P.clear + 0.14, 0);
    body.add(grille);
    const wheels = [];
    for (const [x, z] of [
        [
            P.wb / 2,
            1
        ],
        [
            P.wb / 2,
            -1
        ],
        [
            -P.wb / 2,
            1
        ],
        [
            -P.wb / 2,
            -1
        ]
    ]){
        const pivot = new THREE.Group();
        pivot.position.set(x, P.r, z * (P.W / 2 - P.tw / 2 - 0.02));
        const w = wheel(P, P.dark);
        if (z < 0) w.rotation.y = Math.PI;
        pivot.add(w);
        pivot.userData = {
            front: x > 0,
            spin: w,
            side: z
        };
        car.add(pivot);
        wheels.push(pivot);
    }
    car.traverse((o)=>{
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    car.userData = {
        wheels,
        body,
        kind,
        P,
        spin: 0
    };
    return car;
}
export function animateCar(car, dist, steerAngle, accel) {
    const u = car.userData;
    u.spin -= dist / u.P.r;
    for (const w of u.wheels){
        w.userData.spin.rotation.z = u.spin * (w.userData.side < 0 ? -1 : 1);
        if (w.userData.front) w.rotation.y = -steerAngle;
    }
    const pitch = THREE.MathUtils.clamp(-accel * 0.004, -0.03, 0.03);
    u.body.rotation.z += (pitch - u.body.rotation.z) * 0.1;
}
export function lowPolyCarGeometry() {
    const parts = [];
    const col = (g, c)=>{
        const n = g.attributes.position.count, arr = new Float32Array(n * 3);
        for(let i = 0; i < n; i++){
            arr[i * 3] = c[0];
            arr[i * 3 + 1] = c[1];
            arr[i * 3 + 2] = c[2];
        }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        return g.index ? g.toNonIndexed() : g;
    };
    const P = PRESETS.sedan;
    const body = new THREE.ExtrudeGeometry(bodyShape(P), {
        depth: P.W - 0.2,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.08,
        bevelSegments: 1,
        curveSegments: 4
    });
    body.translate(0, 0, -(P.W - 0.2) / 2);
    parts.push(col(body.toNonIndexed(), [
        1,
        1,
        1
    ]));
    const can = new THREE.ExtrudeGeometry(canopyShape(P), {
        depth: P.W - 0.5,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.08,
        bevelSegments: 1,
        curveSegments: 4
    });
    can.translate(0, 0, -(P.W - 0.5) / 2);
    parts.push(col(can.toNonIndexed(), [
        0.05,
        0.06,
        0.08
    ]));
    for (const [x, z] of [
        [
            P.wb / 2,
            1
        ],
        [
            P.wb / 2,
            -1
        ],
        [
            -P.wb / 2,
            1
        ],
        [
            -P.wb / 2,
            -1
        ]
    ]){
        const w = new THREE.CylinderGeometry(P.r, P.r, 0.22, 12);
        w.rotateX(Math.PI / 2);
        w.translate(x, P.r, z * (P.W / 2 - 0.13));
        parts.push(col(w.toNonIndexed(), [
            0.04,
            0.04,
            0.04
        ]));
    }
    let n = 0;
    for (const p of parts)n += p.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cc = new Float32Array(n * 3);
    let o = 0;
    for (const p of parts){
        p.computeVertexNormals();
        pos.set(p.attributes.position.array, o * 3);
        nor.set(p.attributes.normal.array, o * 3);
        cc.set(p.attributes.color.array, o * 3);
        o += p.attributes.position.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    return g;
}
const table = (T, f)=>{
    if (f <= T[0][0]) return T[0][1];
    for(let i = 0; i < T.length - 1; i++)if (f <= T[i + 1][0]) {
        const t = (f - T[i][0]) / (T[i + 1][0] - T[i][0]), s = t * t * (3 - 2 * t);
        return T[i][1] + (T[i + 1][1] - T[i][1]) * s;
    }
    return T[T.length - 1][1];
};
const RT = {
    L: 4.42,
    W: 0.94,
    wb: 2.78,
    r: 0.35,
    rF: 0.34,
    rR: 0.38,
    tw: 0.25,
    clear: 0.2,
    belt: [
        [
            -1,
            0.88
        ],
        [
            -0.85,
            0.95
        ],
        [
            -0.45,
            0.93
        ],
        [
            0,
            0.86
        ],
        [
            0.3,
            0.8
        ],
        [
            0.55,
            0.72
        ],
        [
            0.8,
            0.64
        ],
        [
            0.93,
            0.57
        ],
        [
            1,
            0.5
        ]
    ],
    top: [
        [
            -1,
            0.02
        ],
        [
            -0.93,
            0.12
        ],
        [
            -0.7,
            0.3
        ],
        [
            -0.45,
            0.44
        ],
        [
            -0.15,
            0.53
        ],
        [
            0.1,
            0.54
        ],
        [
            0.3,
            0.46
        ],
        [
            0.48,
            0.27
        ],
        [
            0.6,
            0.12
        ],
        [
            0.75,
            0.07
        ],
        [
            0.9,
            0.04
        ],
        [
            1,
            0.01
        ]
    ],
    green: [
        -0.42,
        0.6
    ]
};
const roboPaint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#cdb07c'),
    metalness: 0.6,
    roughness: 0.28,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.5,
    sheen: 0.4,
    sheenColor: new THREE.Color('#ffd9a0')
});
const roboGlass = new THREE.MeshPhysicalMaterial({
    color: 0x111316,
    metalness: 0.4,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.8
});
const roboTrim = new THREE.MeshStandardMaterial({
    color: 0x1a1512,
    roughness: 0.55,
    metalness: 0.2
});
export const ROBO_MATS = {
    paint: roboPaint,
    glass: roboGlass,
    trim: roboTrim
};
function roboSurface(x, th) {
    const f = x / (RT.L / 2), af = Math.abs(f);
    const pf = f > 0 ? 3.0 : 4.2;
    const se = Math.pow(Math.max(1 - Math.pow(af, pf), 0.0004), 1 / pf);
    const w = RT.W * (f < 0 ? 0.74 + 0.26 * se : se);
    const belt = table(RT.belt, f);
    const bottom = Math.max(belt - RT.clear - 0.02 - Math.pow(af, 6) * 0.25, 0.04);
    const inGreen = f > RT.green[0] && f < RT.green[1];
    const top = table(RT.top, f);
    const c = Math.cos(th), s = Math.sin(th);
    const upper = s >= 0;
    const n = upper ? inGreen ? 2.4 : 5 : 7;
    const gIn = inGreen ? Math.min(1, (f - RT.green[0]) / 0.12, (RT.green[1] - f) / 0.12) : 0;
    const wy = upper ? w * (1 - 0.14 * gIn) : w;
    let y = wy * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    let z = belt + (upper ? top : bottom) * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    if (!upper && Math.abs(y) > w * 0.35) {
        for (const [xw, r] of [
            [
                RT.wb / 2,
                RT.rF
            ],
            [
                -RT.wb / 2,
                RT.rR
            ]
        ]){
            const R = r + 0.07, dx = x - xw;
            if (Math.abs(dx) < R) z = Math.max(z, r + Math.sqrt(R * R - dx * dx) - 0.02);
        }
    }
    return [
        x,
        z,
        y
    ];
}
function roboBody() {
    const NS = 120, NR = 64;
    const pos = [], idxPaint = [], idxGlass = [], idxTrim = [];
    const doorIndices = [
        [
            [],
            [],
            []
        ],
        [
            [],
            [],
            []
        ]
    ];
    for(let i = 0; i <= NS; i++){
        const t = i / NS, x = -RT.L / 2 + RT.L * (0.5 - 0.5 * Math.cos(Math.PI * t));
        for(let j = 0; j < NR; j++)pos.push(...roboSurface(x, j / NR * Math.PI * 2));
    }
    const V = (k)=>[
            pos[k * 3],
            pos[k * 3 + 1],
            pos[k * 3 + 2]
        ];
    for(let i = 0; i < NS; i++)for(let j = 0; j < NR; j++){
        const a = i * NR + j, b = i * NR + (j + 1) % NR, c = (i + 1) * NR + (j + 1) % NR, d = (i + 1) * NR + j;
        const pa = V(a), pc = V(c);
        const cx = (pa[0] + pc[0]) / 2, cz = (pa[1] + pc[1]) / 2, f = cx / (RT.L / 2);
        const th = (j + 0.5) / NR * Math.PI * 2, upper = Math.sin(th) > 0;
        const belt = table(RT.belt, f);
        let list = idxPaint;
        if (upper && f > RT.green[0] + 0.03 && f < RT.green[1] - 0.02 && cz > belt + 0.05) list = idxGlass;
        if (!upper && cz < 0.42 && f > -0.84 && f < 0.9) list = idxTrim;
        const sideZ = (pa[2] + pc[2]) / 2;
        if (cx > -0.72 && cx < 0.98 && cz > 0.36 && Math.abs(sideZ) > 0.64) {
            const material = list === idxPaint ? 0 : list === idxGlass ? 1 : 2;
            doorIndices[sideZ > 0 ? 1 : 0][material].push(a, d, c, a, c, b);
        } else list.push(a, d, c, a, c, b);
    }
    const copyRing = (ring)=>{
        const at = pos.length / 3;
        for(let j = 0; j < NR; j++)pos.push(pos[(ring * NR + j) * 3], pos[(ring * NR + j) * 3 + 1], pos[(ring * NR + j) * 3 + 2]);
        return at;
    };
    const ringF = copyRing(NS), ringR = copyRing(0);
    const capF = pos.length / 3;
    pos.push(RT.L / 2 + 0.005, table(RT.belt, 1) - 0.05, 0);
    const capR = pos.length / 3;
    pos.push(-RT.L / 2 - 0.005, table(RT.belt, -1) - 0.05, 0);
    for(let j = 0; j < NR; j++){
        idxPaint.push(ringF + j, ringF + (j + 1) % NR, capF);
        idxPaint.push(capR, ringR + j, ringR + (j + 1) % NR);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex([
        ...idxPaint,
        ...idxGlass,
        ...idxTrim
    ]);
    g.addGroup(0, idxPaint.length, 0);
    g.addGroup(idxPaint.length, idxGlass.length, 1);
    g.addGroup(idxPaint.length + idxGlass.length, idxTrim.length, 2);
    g.computeVertexNormals();
    const assembly = new THREE.Group();
    assembly.add(new THREE.Mesh(g, [
        roboPaint,
        roboGlass,
        roboTrim
    ]));
    const doors = [];
    for (const [i, side] of [
        -1,
        1
    ].entries()){
        const pivot = new THREE.Group();
        pivot.position.set(0.98, 1.2, side * 0.62);
        const dg = new THREE.BufferGeometry();
        dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const [paint, glass, trim] = doorIndices[i];
        dg.setIndex([
            ...paint,
            ...glass,
            ...trim
        ]);
        dg.addGroup(0, paint.length, 0);
        dg.addGroup(paint.length, glass.length, 1);
        dg.addGroup(paint.length + glass.length, trim.length, 2);
        dg.translate(-pivot.position.x, -pivot.position.y, -pivot.position.z);
        dg.computeVertexNormals();
        const mats = [
            roboPaint,
            roboGlass,
            roboTrim
        ].map((m)=>{
            const c = m.clone();
            c.side = THREE.DoubleSide;
            return c;
        });
        pivot.add(new THREE.Mesh(dg, mats));
        pivot.userData.side = side;
        assembly.add(pivot);
        doors.push(pivot);
    }
    assembly.userData.doors = doors;
    return assembly;
}
function beltBar(from, to, mat, radius) {
    const pts = [];
    const N = 24;
    for(let k = 0; k <= N; k++){
        const t = k / N, f = from + (to - from) * t;
        const p = roboSurface(f * RT.L / 2, 0.02);
        pts.push(new THREE.Vector3(p[0], p[1], p[2] + 0.012));
    }
    for(let k = N; k >= 0; k--){
        const t = k / N, f = from + (to - from) * t;
        const p = roboSurface(f * RT.L / 2, Math.PI - 0.02);
        pts.push(new THREE.Vector3(p[0], p[1], p[2] - 0.012));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius, 6, false), mat);
}
export function buildRobotaxi() {
    const car = new THREE.Group();
    const body = new THREE.Group();
    car.add(body);
    const shell = roboBody();
    body.add(shell);
    const leather = new THREE.MeshStandardMaterial({
        color: 0xd5c5ac,
        roughness: 0.9
    });
    for (const side of [
        -1,
        1
    ]){
        body.add(box(0.58, 0.15, 0.55, leather, -0.32, 0.45, side * 0.43));
        const back = box(0.16, 0.55, 0.55, leather, -0.62, 0.72, side * 0.43);
        back.rotation.z = -0.12;
        body.add(back);
    }
    body.add(beltBar(0.955, 0.999, headMat, 0.02));
    body.add(beltBar(-0.93, -0.999, tailMat, 0.026));
    for (const s of [
        -1,
        1
    ]){
        const cam = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), roboTrim);
        cam.position.set(-0.55, 1.08, s * 0.8);
        body.add(cam);
    }
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.9), roboTrim);
    intake.position.set(RT.L / 2 - 0.2, 0.32, 0);
    body.add(intake);
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.46), new THREE.MeshStandardMaterial({
        color: 0xb79b69,
        roughness: 0.5,
        metalness: 0.5
    }));
    star.position.set(-1.28, 1.2, 0);
    star.rotation.z = 0.3;
    body.add(star);
    const P = {
        r: RT.r,
        tw: RT.tw
    };
    const wheels = [];
    for (const [x, z] of [
        [
            RT.wb / 2,
            1
        ],
        [
            RT.wb / 2,
            -1
        ],
        [
            -RT.wb / 2,
            1
        ],
        [
            -RT.wb / 2,
            -1
        ]
    ]){
        const r = x > 0 ? RT.rF : RT.rR, tw = x > 0 ? RT.tw : RT.tw + 0.03;
        const pivot = new THREE.Group();
        pivot.position.set(x, r, z * (RT.W - tw / 2 - 0.03 - (x > 0 ? 0 : 0.03)));
        const w = new THREE.Group();
        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, tw, 36), tyreMat);
        tyre.rotation.x = Math.PI / 2;
        const cover = new THREE.Mesh(new THREE.SphereGeometry(r * 0.84, 36, 8, 0, Math.PI * 2, 0, 0.5), roboPaint);
        cover.rotation.x = Math.PI / 2;
        cover.scale.set(1, 0.4, 1);
        cover.position.z = tw / 2 - r * 0.84 * Math.cos(0.5) * 0.4;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.1, 0.02, 20), roboTrim);
        hub.rotation.x = Math.PI / 2;
        hub.position.z = tw / 2 + 0.03;
        const seam = new THREE.Mesh(new THREE.TorusGeometry(r * 0.845, 0.01, 6, 48), roboTrim);
        seam.position.z = tw / 2 + 0.005;
        w.add(tyre, cover, hub, seam);
        if (z < 0) w.rotation.y = Math.PI;
        pivot.add(w);
        pivot.userData = {
            front: x > 0,
            spin: w,
            side: z
        };
        car.add(pivot);
        wheels.push(pivot);
    }
    car.traverse((o)=>{
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    car.userData = {
        wheels,
        body,
        kind: 'robotaxi',
        P,
        spin: 0,
        doors: shell.userData.doors
    };
    return car;
}
export function compactCar(car) {
    car.updateMatrixWorld(true);
    const groups = [
        car.userData.body,
        ...car.userData.wheels.map((w)=>w.userData.spin)
    ];
    for (const g of groups){
        const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
        const byMat = new Map();
        const victims = [];
        g.traverse((o)=>{
            if (!o.isMesh || Array.isArray(o.material)) return;
            const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
            const keepUv = !!o.material.map;
            for (const k of Object.keys(geo.attributes))if (k !== 'position' && k !== 'normal' && !(keepUv && k === 'uv')) geo.deleteAttribute(k);
            geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
            let list = byMat.get(o.material);
            if (!list) byMat.set(o.material, list = []);
            list.push(geo);
            victims.push(o);
        });
        for (const o of victims)o.parent.remove(o);
        for (const c of [
            ...g.children
        ])if (!c.isMesh && c.children.length === 0 && c.type === 'Group') g.remove(c);
        for (const [mat, list] of byMat){
            const m = new THREE.Mesh(mergeGeometries(list), mat);
            m.castShadow = m.receiveShadow = true;
            g.add(m);
        }
    }
    return car;
}
function textPlate(text, w, h, color = '#ffffff', weight = 700) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.round(512 * h / w);
    const x = c.getContext('2d');
    x.fillStyle = color;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `${weight} ${c.height * 0.72}px Inter, system-ui, sans-serif`;
    x.letterSpacing = `${c.height * 0.12}px`;
    x.fillText(text, 256, c.height * 0.54);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        depthWrite: false
    });
}
const box = (w, h, d, mat, x, y, z)=>{
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
};
const blackGloss = new THREE.MeshPhysicalMaterial({
    color: 0x0c0e11,
    roughness: 0.12,
    metalness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.4
});
const sensorBlack = new THREE.MeshStandardMaterial({
    color: 0x15171b,
    roughness: 0.45,
    metalness: 0.3
});
const waymoTeal = new THREE.MeshStandardMaterial({
    color: 0x00a9c0,
    emissive: 0x19d6c8,
    emissiveIntensity: 1.2,
    roughness: 0.3
});
const zooxBlue = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    emissive: 0x2563eb,
    emissiveIntensity: 0.9,
    roughness: 0.3
});
const hubGrey = new THREE.MeshStandardMaterial({
    color: 0xbfc4ca,
    roughness: 0.5,
    metalness: 0.2
});
const waymoPaint = new THREE.MeshPhysicalMaterial({
    color: 0xf2f3f4,
    metalness: 0.25,
    roughness: 0.35,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.1
});
const zooxPaint = new THREE.MeshPhysicalMaterial({
    color: 0xa3d8ca,
    metalness: 0.1,
    roughness: 0.38,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1
});
function roboWheel(r, tw, face) {
    const g = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, tw, 30), tyreMat);
    tyre.rotation.x = Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.03, 30), face === 'x' ? tyreMat : rimDark);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = tw / 2;
    g.add(tyre, disc);
    if (face === 'x') {
        for(let k = 0; k < 4; k++){
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.66, r * 0.16, 0.03), hubGrey);
            const a = Math.PI / 4 + k * Math.PI / 2;
            spoke.position.set(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, tw / 2 + 0.02);
            spoke.rotation.z = a;
            g.add(spoke);
        }
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.13, r * 0.13, 0.04, 16), hubGrey);
        hub.rotation.x = Math.PI / 2;
        hub.position.z = tw / 2 + 0.03;
        g.add(hub);
    } else {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.04, 16), sensorBlack);
        cap.rotation.x = Math.PI / 2;
        cap.position.z = tw / 2 + 0.02;
        g.add(cap);
    }
    return g;
}
function addWheels(car, P, face) {
    const wheels = [];
    for (const [x, z] of [
        [
            P.wb / 2,
            1
        ],
        [
            P.wb / 2,
            -1
        ],
        [
            -P.wb / 2,
            1
        ],
        [
            -P.wb / 2,
            -1
        ]
    ]){
        const pivot = new THREE.Group();
        pivot.position.set(x, P.r, z * (P.W / 2 - P.tw / 2 - 0.02));
        const w = roboWheel(P.r, P.tw, face);
        if (z < 0) w.rotation.y = Math.PI;
        pivot.add(w);
        pivot.userData = {
            front: x > 0,
            spin: w,
            side: z
        };
        car.add(pivot);
        wheels.push(pivot);
    }
    return wheels;
}
function loftBody(L, sec, mat, mats, axles, NS = 70, NR = 44) {
    const pos = [], groups = mats.map(()=>[]), W0 = sec(0).w;
    const point = (x, th)=>{
        const f = x / (L / 2), s = sec(f), c = Math.cos(th), sn = Math.sin(th), up = sn >= 0;
        const n = up ? s.nu : s.nd, w = up ? s.wt : s.w;
        const y = w * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
        let z = s.zm + (up ? s.zt - s.zm : s.zm - s.zb) * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
        if (!up && Math.abs(y) > W0 * 0.6) for (const [ax, r] of axles){
            const R = r + 0.06, dx = x - ax;
            if (Math.abs(dx) < R) z = Math.max(z, r + Math.sqrt(R * R - dx * dx) - 0.02);
        }
        return [
            x,
            z,
            y
        ];
    };
    for(let i = 0; i <= NS; i++){
        const t = i / NS, x = -L / 2 + L * (0.5 - 0.5 * Math.cos(Math.PI * t));
        for(let j = 0; j < NR; j++)pos.push(...point(x, j / NR * Math.PI * 2));
    }
    const V = (k)=>[
            pos[k * 3],
            pos[k * 3 + 1],
            pos[k * 3 + 2]
        ];
    for(let i = 0; i < NS; i++)for(let j = 0; j < NR; j++){
        const a = i * NR + j, b = i * NR + (j + 1) % NR, c = (i + 1) * NR + (j + 1) % NR, d = (i + 1) * NR + j;
        const pa = V(a), pc = V(c), cx = (pa[0] + pc[0]) / 2, cz = (pa[1] + pc[1]) / 2, cy = (pa[2] + pc[2]) / 2;
        const f = cx / (L / 2), s = sec(f), up = Math.sin((j + 0.5) / NR * Math.PI * 2) > 0;
        groups[mat(f, up, cz, Math.abs(cy) / (up ? s.wt : s.w), s)].push(a, d, c, a, c, b);
    }
    for (const [end, ring] of [
        [
            1,
            NS
        ],
        [
            -1,
            0
        ]
    ]){
        const s = sec(end), ci = pos.length / 3;
        pos.push(end * L / 2 + end * 0.002, s.zm, 0);
        for(let j = 0; j < NR; j++){
            const a = ring * NR + j, b = ring * NR + (j + 1) % NR, z = (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2;
            const idx = mat(end, z > s.zm, z, 0, s);
            if (end > 0) groups[idx].push(b, a, ci);
            else groups[idx].push(a, b, ci);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const index = [];
    let start = 0;
    groups.forEach((list, k)=>{
        index.push(...list);
        g.addGroup(start, list.length, k);
        start += list.length;
    });
    g.setIndex(index);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mats);
    m.castShadow = m.receiveShadow = true;
    return m;
}
const pill = (w, h, d, r, mat, x, y, z)=>{
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
    m.position.set(x, y, z);
    return m;
};
export function buildWaymo() {
    const P = {
        L: 4.69,
        W: 1.99,
        wb: 3.0,
        r: 0.37,
        tw: 0.26
    };
    const car = new THREE.Group(), body = new THREE.Group();
    car.add(body);
    const hw = P.W / 2;
    const plan = (f)=>Math.pow(Math.max(1 - Math.pow(Math.abs(f), 9), 1e-12), 1 / 9);
    const zt = (f)=>table([
            [
                -1,
                1.56
            ],
            [
                -0.975,
                1.7
            ],
            [
                -0.9,
                1.76
            ],
            [
                0.3,
                1.76
            ],
            [
                0.55,
                1.63
            ],
            [
                0.78,
                1.32
            ],
            [
                0.9,
                1.14
            ],
            [
                0.97,
                1.06
            ],
            [
                1,
                1.0
            ]
        ], f);
    const zm = (f)=>table([
            [
                -1,
                0.96
            ],
            [
                0.8,
                0.96
            ],
            [
                1,
                0.9
            ]
        ], f);
    const sec = (f)=>({
            w: hw * plan(f),
            wt: hw * plan(f) * 0.955,
            zb: 0.32,
            zm: zm(f),
            zt: zt(f),
            nd: 7,
            nu: 3.4
        });
    const roof = new THREE.MeshPhysicalMaterial({
        color: 0x0d0f12,
        roughness: 0.25,
        metalness: 0.4,
        clearcoat: 1,
        clearcoatRoughness: 0.1
    });
    const mats = [
        waymoPaint,
        blackGloss,
        sensorBlack,
        roof
    ];
    const mat = (f, up, z, ay, s)=>{
        if (!up && z < 0.5) return 2;
        if (f > 0.93 && z > 0.66 && z < 0.86) return 1;
        if (up && z > s.zt - 0.07 && ay < 0.86 && f < 0.48) return 3;
        if (up && f > 0.46 && z > s.zm + 0.14) return 1;
        if (up && f < 0.46 && f > -0.93 && z > s.zm + 0.12 && z < s.zt - 0.12 && ay > 0.55) return 1;
        if (f < -0.965 && z > s.zm + 0.16 && z < s.zt - 0.1) return 1;
        return 0;
    };
    body.add(loftBody(P.L, sec, mat, mats, [
        [
            P.wb / 2,
            P.r
        ],
        [
            -P.wb / 2,
            P.r
        ]
    ]));
    for (const z of [
        1,
        -1
    ]){
        body.add(box(0.04, 0.05, 0.6, headMat, P.L / 2 - 0.02, 0.8, z * 0.5));
        body.add(box(0.04, 0.035, 0.24, headMat, P.L / 2 - 0.05, 0.72, z * 0.72));
    }
    body.add(box(0.04, 0.05, P.W - 0.5, tailMat, -P.L / 2 + 0.01, 1.5, 0));
    body.add(box(0.05, 0.12, 0.34, sensorBlack, P.L / 2 - 0.01, 0.46, 0));
    for (const z of [
        1,
        -1
    ]){
        for (const x of [
            0.46,
            -0.22,
            -0.9
        ])body.add(box(0.012, 0.9, 0.012, sensorBlack, x, 0.98, z * (hw - 0.005)));
        const fp = pill(0.34, 0.2, 0.18, 0.07, sensorBlack, 1.02, 1.3, z * (hw + 0.06));
        body.add(fp);
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), blackGloss);
        lens.position.set(1.2, 1.3, z * (hw + 0.1));
        body.add(lens);
        body.add(pill(0.26, 0.18, 0.2, 0.07, sensorBlack, -2.18, 1.66, z * (hw - 0.08)));
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), textPlate('waymo', 0.9, 0.16, '#00a2c7', 600));
        plate.position.set(-0.05, 0.72, z * (hw + 0.012));
        if (z < 0) plate.rotation.y = Math.PI;
        body.add(plate);
    }
    body.add(pill(0.95, 0.16, 1.05, 0.07, waymoPaint, 0.05, 1.82, 0));
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.22, 32), sensorBlack);
    drum.position.set(0.1, 2.0, 0);
    body.add(drum);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.035, 32, 1, true), waymoTeal);
    halo.position.set(0.1, 2.07, 0);
    body.add(halo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), blackGloss);
    dome.position.set(0.1, 2.11, 0);
    body.add(dome);
    for (const z of [
        1,
        -1
    ]){
        const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.08), textPlate('waymo', 0.34, 0.08, '#ffffff', 600));
        lbl.position.set(0.05, 1.82, z * 0.53);
        if (z < 0) lbl.rotation.y = Math.PI;
        body.add(lbl);
    }
    const wheels = addWheels(car, {
        ...P,
        W: P.W - 0.1
    }, 'aero');
    car.traverse((o)=>{
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    car.userData = {
        wheels,
        body,
        kind: 'waymo',
        P,
        spin: 0
    };
    return car;
}
export function buildZoox() {
    const P = {
        L: 3.63,
        W: 1.94,
        wb: 2.72,
        r: 0.4,
        tw: 0.3
    };
    const car = new THREE.Group(), body = new THREE.Group();
    car.add(body);
    const hw = P.W / 2;
    const plan = (f)=>Math.pow(Math.max(1 - Math.pow(Math.abs(f), 6), 1e-9), 1 / 6);
    const zt = (f)=>table([
            [
                0,
                1.95
            ],
            [
                0.7,
                1.93
            ],
            [
                0.86,
                1.84
            ],
            [
                0.95,
                1.62
            ],
            [
                1,
                1.35
            ]
        ], Math.abs(f));
    const sec = (f)=>({
            w: hw * plan(f),
            wt: hw * plan(f) * 0.97,
            zb: 0.3,
            zm: 0.96,
            zt: zt(f),
            nd: 6,
            nu: 3.2
        });
    const mats = [
        zooxPaint,
        blackGloss,
        sensorBlack
    ];
    const mat = (f, up, z, ay, s)=>{
        if (!up && z < 0.46) return 2;
        if (Math.abs(f) > 0.8 && z > s.zm + 0.04) return 1;
        if (up && z > s.zt - 0.05 && ay < 0.8) return 1;
        if (up && Math.abs(f) < 0.56 && z > s.zm + 0.08 && z < s.zt - 0.14 && ay > 0.55) return 1;
        return 0;
    };
    body.add(loftBody(P.L, sec, mat, mats, [
        [
            P.wb / 2,
            P.r
        ],
        [
            -P.wb / 2,
            P.r
        ]
    ]));
    for (const x of [
        1,
        -1
    ]){
        body.add(box(0.04, 0.05, P.W - 0.6, x > 0 ? headMat : tailMat, x * (P.L / 2 - 0.01), 0.9, 0));
        for (const z of [
            1,
            -1
        ]){
            body.add(pill(0.46, 0.34, 0.36, 0.12, sensorBlack, x * (P.L / 2 - 0.16), 1.72, z * (hw - 0.1)));
            const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 20), sensorBlack);
            lid.position.set(x * (P.L / 2 - 0.18), 1.94, z * (hw - 0.14));
            body.add(lid);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), zooxBlue);
            cap.position.set(x * (P.L / 2 - 0.18), 2.01, z * (hw - 0.14));
            body.add(cap);
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), blackGloss);
            eye.position.set(x * (P.L / 2 + 0.08), 1.72, z * (hw - 0.1));
            body.add(eye);
            body.add(box(0.02, 0.05, 0.16, x > 0 ? headMat : tailMat, x * (P.L / 2 - 0.02), 0.62, z * (hw - 0.14)));
        }
    }
    for (const z of [
        1,
        -1
    ]){
        body.add(box(0.012, 1.25, 0.012, sensorBlack, 0, 1.0, z * (hw + 0.004)));
        for (const x of [
            -1.02,
            1.02
        ])body.add(box(0.012, 1.25, 0.012, sensorBlack, x, 1.0, z * (hw + 0.002)));
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.09), textPlate('Z O O X', 0.4, 0.09, '#2b2f36', 700));
        plate.position.set(0.55, 0.72, z * (hw + 0.012));
        if (z < 0) plate.rotation.y = Math.PI;
        body.add(plate);
    }
    const wheels = addWheels(car, {
        ...P,
        W: P.W - 0.06
    }, 'x');
    car.traverse((o)=>{
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    car.userData = {
        wheels,
        body,
        kind: 'zoox',
        P,
        spin: 0
    };
    return car;
}
export function buildTaxi() {
    const car = buildCar('sedan', '#f5c518');
    const P = car.userData.P, body = car.userData.body;
    const signMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff3c4,
        emissiveIntensity: 0.6,
        roughness: 0.4
    });
    const sign = box(0.34, 0.26, 0.9, signMat, -0.45, P.roof + 0.18, 0);
    const base = box(0.4, 0.05, 1.0, sensorBlack, -0.45, P.roof + 0.04, 0);
    body.add(base, sign);
    for (const z of [
        1,
        -1
    ]){
        const band = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.12), textPlate('▪▫▪▫▪▫▪▫▪▫▪▫', 2.2, 0.12, '#111111', 900));
        band.position.set(-0.1, P.belt - 0.28, z * (P.W / 2 + 0.03));
        if (z < 0) band.rotation.y = Math.PI;
        body.add(band);
        const txt = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.22), textPlate('TAXI', 0.8, 0.22, '#111111', 800));
        txt.position.set(-0.45, P.roof + 0.18, z * 0.46);
        txt.rotation.y = z > 0 ? 0 : Math.PI;
        body.add(txt);
    }
    car.traverse((o)=>{
        if (o.isMesh) o.castShadow = true;
    });
    car.userData.kind = 'taxi';
    return car;
}
export function buildVehicle(kind, color) {
    if (kind === 'robotaxi') return buildRobotaxi();
    if (kind === 'waymo') return buildWaymo();
    if (kind === 'zoox') return buildZoox();
    if (kind === 'taxi') return buildTaxi();
    return buildCar(kind, color);
}
export function bakeVehicle(kind) {
    const car = buildVehicle(kind, '#ffffff');
    car.updateMatrixWorld(true);
    const parts = [];
    const white = paint('#ffffff');
    const colourOf = (m)=>{
        if (m === white) return new THREE.Color(1, 1, 1);
        const e = m.emissive;
        if (e && m.emissiveIntensity > 0.3 && (e.r > 0 || e.g > 0 || e.b > 0)) return e.clone().multiplyScalar(1.3);
        return m.color.clone();
    };
    car.traverse((o)=>{
        if (!o.isMesh || o.material.transparent) return;
        const mats = Array.isArray(o.material) ? o.material : [
            o.material
        ];
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        const n = g.attributes.position.count, arr = new Float32Array(n * 3);
        if (mats.length > 1 && g.groups.length) {
            for (const grp of g.groups){
                const col = colourOf(mats[grp.materialIndex] || mats[0]);
                for(let i = grp.start, e = grp.start + grp.count; i < e; i++)arr.set([
                    col.r,
                    col.g,
                    col.b
                ], i * 3);
            }
        } else {
            const col = colourOf(mats[0]);
            for(let i = 0; i < n; i++)arr.set([
                col.r,
                col.g,
                col.b
            ], i * 3);
        }
        for (const k of Object.keys(g.attributes))if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        parts.push(g);
    });
    const out = mergeGeometries(parts);
    out.computeBoundingSphere();
    return out;
}
