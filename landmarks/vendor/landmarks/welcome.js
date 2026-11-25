// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { latLonToXZ } from '../core/data.js';
import { theme } from '../core/theme.js';
import { ORIGIN } from '../places.js';
import { nightAura, sheen, textPanel } from './sheen.js';
export { SIGN_LATLON } from '../places.js';
import { SIGN_LATLON } from '../places.js';

function makeRoundedShape(pts, radius = 0.8) {
    const shape = new THREE.Shape();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const prev = pts[(i + n - 1) % n];
        const curr = pts[i];
        const next = pts[(i + 1) % n];
        const v1x = prev[0] - curr[0], v1y = prev[1] - curr[1];
        const v2x = next[0] - curr[0], v2y = next[1] - curr[1];
        const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1;
        const r = Math.min(radius, l1 * 0.42, l2 * 0.42);
        const p1x = curr[0] + (v1x / l1) * r, p1y = curr[1] + (v1y / l1) * r;
        const p2x = curr[0] + (v2x / l2) * r, p2y = curr[1] + (v2y / l2) * r;
        if (i === 0) shape.moveTo(p1x, p1y);
        else shape.lineTo(p1x, p1y);
        shape.quadraticCurveTo(curr[0], curr[1], p2x, p2y);
    }
    shape.closePath();
    return shape;
}

export function welcomeSign(engine) {
    const [sx, sz] = latLonToXZ(ORIGIN, SIGN_LATLON.lat, SIGN_LATLON.lon);
    const grp = new THREE.Group();
    grp.name = 'Welcome sign';

    const sign = new THREE.Group();
    const outline = [
        [-5.8, 0],
        [-2.75, 2.35],
        [2.75, 2.35],
        [5.8, 0],
        [2.75, -2.35],
        [-2.75, -2.35]
    ];
    const shape = makeRoundedShape(outline, 0.35);
    const ivory = sheen('#f8f3e6', {
        glow: '#fff6e0',
        glowK: 0.85,
        baseGlow: 0.08
    });
    const goldM = sheen('#d6a94e', {
        refl: 0.35,
        spec: 1.3,
        glow: '#ffd06b',
        glowK: 0.95
    });
    const faceM = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
        depth: 0.32,
        bevelEnabled: true,
        bevelSize: 0.12,
        bevelThickness: 0.08,
        bevelSegments: 2
    }).translate(0, 0, -0.16), ivory);
    faceM.position.y = 6.2;
    sign.add(faceM);

    const edgePts = outline.map(([x, y]) => new THREE.Vector3(x, y + 6.2, 0));
    const edgePath = new THREE.CurvePath();
    edgePts.forEach((p, i) => edgePath.add(new THREE.LineCurve3(p, edgePts[(i + 1) % edgePts.length])));
    sign.add(new THREE.Mesh(new THREE.TubeGeometry(edgePath, 96, 0.14, 6, true), goldM));

    // Iconic off-center twin cobalt-blue support columns rising above the sign to frame the starburst
    const postMat = sheen('#1976bd', {
        refl: 0.25,
        spec: 0.9,
        glow: '#2188d4',
        glowK: 0.25
    });
    for (const x of [-2.45, -0.85]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.36, 12.2, 0.38), postMat);
        p.position.set(x, 6.1, -0.02);
        sign.add(p);
    }
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.38, 0.4), postMat);
    topBar.position.set(-1.65, 12.1, -0.02);
    sign.add(topBar);

    // Classic 8-point red starburst + glowing golden 4-point neon cross inside the upper blue frame
    const redStar = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        const r = i % 2 ? 0.38 : i % 4 ? 1.15 : 1.72;
        if (i) redStar.lineTo(Math.sin(a) * r, Math.cos(a) * r);
        else redStar.moveTo(0, r);
    }
    redStar.closePath();
    const redStarMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(redStar, {
        depth: 0.18,
        bevelEnabled: false
    }).translate(0, 0, -0.09), sheen('#c92a2a', {
        glow: '#ff3b28',
        glowK: 1.6,
        baseGlow: 0.2
    }));
    redStarMesh.position.set(-1.65, 10.65, 0.02);
    sign.add(redStarMesh);

    const goldStar = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 ? 0.22 : 1.82;
        if (i) goldStar.lineTo(Math.sin(a) * r, Math.cos(a) * r);
        else goldStar.moveTo(0, r);
    }
    goldStar.closePath();
    const goldStarMat = new THREE.MeshBasicMaterial({ color: '#ffe566', fog: true });
    for (const zOff of [0.14, -0.14]) {
        const gStar = new THREE.Mesh(new THREE.ShapeGeometry(goldStar), goldStarMat);
        gStar.position.set(-1.65, 10.65, zOff);
        if (zOff < 0) gStar.rotation.y = Math.PI;
        sign.add(gStar);
    }

    const FACE_Z = 0.31;
    const words = (t, w, h, y, x, color, font, flip = false) => {
        const o = textPanel(t, w, h, { color, font });
        o.position.set(flip ? -x : x, y, flip ? -FACE_Z : FACE_Z);
        if (flip) o.rotation.y = Math.PI;
        sign.add(o);
    };
    words('LAS VEGAS', 10.2, 1.78, 5.75, 0, '#e03538', '900 190px "Helvetica Neue", Arial, sans-serif');
    words('TO', 1.1, 0.52, 7.45, -3.15, '#1f6fb2', '700 150px "Helvetica Neue", Arial, sans-serif');
    words('Fabulous', 6.5, 1.32, 7.12, 0.15, '#1e82d4', 'italic 160px "Snell Roundhand", "Brush Script MT", cursive');
    words('NEVADA', 4.5, 0.7, 4.58, 0, '#22659e', '700 130px "Helvetica Neue", Arial, sans-serif');
    words('Drive', 6.4, 1.3, 7.12, 0, '#1e82d4', 'italic 160px "Snell Roundhand", "Brush Script MT", cursive', true);
    words('CAREFULLY', 9.4, 1.5, 5.75, 0, '#e03538', '900 170px "Helvetica Neue", Arial, sans-serif', true);
    words('COME BACK SOON', 6, 0.7, 4.58, 0, '#22659e', '700 110px "Helvetica Neue", Arial, sans-serif', true);

    // 7 iconic dark-navy silver-dollar medallions with gold rims and glowing warm letters
    const discNavy = sheen('#1f3254', { glow: '#2b426b', glowK: 0.45, baseGlow: 0.14 });
    const discRim = sheen('#f5e6be', { glow: '#ffe9a8', glowK: 0.9, baseGlow: 0.18 });
    for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 1.18;
        const y = 8.62 - Math.abs(i - 3) * 0.13;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.56, 24).rotateX(Math.PI / 2), discNavy);
        disc.position.set(x, y, 0);
        sign.add(disc);
        for (const zSide of [0.285, -0.285]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 24), discRim);
            ring.position.set(x, y, zSide);
            sign.add(ring);
        }
        words('WELCOME'[i], 0.76, 0.8, y, x, '#ff9d42', '800 170px "Helvetica Neue", Arial, sans-serif');
    }

    // Perimeter marquee bulbs
    const bulbPts = [];
    for (let i = 0; i < outline.length; i++) {
        const a = outline[i], c = outline[(i + 1) % outline.length];
        const n = Math.ceil(Math.hypot(a[0] - c[0], a[1] - c[1]) / 0.34);
        for (let k = 0; k < n; k++) {
            bulbPts.push([
                a[0] + (c[0] - a[0]) * (k / n),
                6.2 + a[1] + (c[1] - a[1]) * (k / n)
            ]);
        }
    }
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffea94', fog: true });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.095, 6, 4), bulbMat, bulbPts.length * 2);
    const bm = new THREE.Matrix4();
    bulbPts.forEach(([x, y], i) => {
        bulbs.setMatrixAt(i * 2, bm.makeTranslation(x, y, 0.29));
        bulbs.setMatrixAt(i * 2 + 1, bm.makeTranslation(x, y, -0.29));
    });
    sign.add(bulbs);

    sign.position.set(sx, 0.11, sz);
    // Clark County lists the landmark at 25 feet tall.
    sign.scale.set(6.1 / 11.6, 7.62 / 12.47, 0.61);
    grp.add(sign);

    const glowRing = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32).rotateX(-Math.PI / 2), nightAura('#ffd9a0', 0.16));
    glowRing.position.set(sx, 0.28, sz);
    grp.add(glowRing);

    engine.animate(sign, (f) => {
        const n = theme.uniforms.uNight.value;
        bulbMat.color.setRGB(1, 0.93, 0.62).multiplyScalar(1 + n * (0.95 + 0.45 * Math.sin(f.t * 6)));
        goldStarMat.color.setRGB(1, 0.9, 0.42).multiplyScalar(1 + n * 1.15);
    });
    return grp;
}
