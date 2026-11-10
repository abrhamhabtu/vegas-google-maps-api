// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { latLonToXZ } from '../core/data.js';
import { theme } from '../core/theme.js';
import { Soup } from '../map/geom.js';
import { flatMaterial, litColor, ORDER } from '../map/materials.js';
import { ORIGIN } from '../places.js';
import { nightAura, sheen, textPanel } from './sheen.js';
export { SIGN_LATLON } from '../places.js';
import { SIGN_LATLON } from '../places.js';
export function welcomeSign(g, engine) {
    const [sx, sz] = latLonToXZ(ORIGIN, SIGN_LATLON.lat, SIGN_LATLON.lon);
    const grp = new THREE.Group();
    grp.name = 'Welcome sign';
    const sign = new THREE.Group();
    const outline = [
        [
            -5.8,
            0
        ],
        [
            -2.8,
            2.4
        ],
        [
            2.8,
            2.4
        ],
        [
            5.8,
            0
        ],
        [
            2.8,
            -2.4
        ],
        [
            -2.8,
            -2.4
        ]
    ];
    const shape = new THREE.Shape();
    outline.forEach(([x, y], i)=>i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const ivory = sheen('#f6eddb', {
        glow: '#fff4dc',
        glowK: 0.8,
        baseGlow: 0.05
    });
    const goldM = sheen('#cba259', {
        refl: 0.3,
        spec: 1.2,
        glow: '#ffc76b',
        glowK: 0.9
    });
    const faceM = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
        depth: 0.3,
        bevelEnabled: true,
        bevelSize: 0.12,
        bevelThickness: 0.08,
        bevelSegments: 2
    }).translate(0, 0, -0.15), ivory);
    faceM.position.y = 6.4;
    sign.add(faceM);
    const edgePts = outline.map(([x, y])=>new THREE.Vector3(x, y + 6.4, 0));
    const edgePath = new THREE.CurvePath();
    edgePts.forEach((p, i)=>edgePath.add(new THREE.LineCurve3(p, edgePts[(i + 1) % edgePts.length])));
    sign.add(new THREE.Mesh(new THREE.TubeGeometry(edgePath, 96, 0.14, 6, true), goldM));
    const post = sheen('#2d85ab', {
        refl: 0.2,
        spec: 0.8
    });
    for (const x of [
        -3.8,
        3.8
    ]){
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8.3, 0.35), post);
        p.position.set(x, 4.15, 0);
        sign.add(p);
    }
    const FACE_Z = 0.3;
    const words = (t, w, h, y, x, color, font, flip = false)=>{
        const o = textPanel(t, w, h, {
            color,
            font
        });
        o.position.set(flip ? -x : x, y, flip ? -FACE_Z : FACE_Z);
        if (flip) o.rotation.y = Math.PI;
        sign.add(o);
    };
    words('LAS VEGAS', 10, 1.75, 5.9, 0, '#ce343b', '900 190px "Helvetica Neue", Arial, sans-serif');
    words('TO', 1.1, 0.5, 7.65, -3.1, '#24679c', '700 150px "Helvetica Neue", Arial, sans-serif');
    words('Fabulous', 6.4, 1.3, 7.3, 0, '#24679c', 'italic 160px "Snell Roundhand", "Brush Script MT", cursive');
    words('NEVADA', 4.4, 0.7, 4.75, 0, '#28678c', '600 130px "Helvetica Neue", Arial, sans-serif');
    words('Drive', 6.4, 1.3, 7.3, 0, '#24679c', 'italic 160px "Snell Roundhand", "Brush Script MT", cursive', true);
    words('CAREFULLY', 9.4, 1.5, 5.9, 0, '#ce343b', '900 170px "Helvetica Neue", Arial, sans-serif', true);
    words('COME BACK SOON', 6, 0.7, 4.75, 0, '#28678c', '600 110px "Helvetica Neue", Arial, sans-serif', true);
    for(let i = 0; i < 7; i++){
        const x = (i - 3) * 1.22;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 24).rotateX(Math.PI / 2), ivory);
        disc.position.set(x, 8.95, 0);
        sign.add(disc);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 6, 24), goldM);
        ring.position.set(x, 8.95, 0.26);
        sign.add(ring);
        words('WELCOME'[i], 0.8, 0.85, 8.96, x, '#cf3d35', '700 170px "Helvetica Neue", Arial, sans-serif');
    }
    const star = new THREE.Shape();
    for(let i = 0; i < 16; i++){
        const a = i * Math.PI / 8, r = i % 2 ? 0.34 : i % 4 ? 1.12 : 1.7;
        if (i) star.lineTo(Math.sin(a) * r, Math.cos(a) * r);
        else star.moveTo(0, r);
    }
    star.closePath();
    const starM = new THREE.Mesh(new THREE.ExtrudeGeometry(star, {
        depth: 0.2,
        bevelEnabled: false
    }), sheen('#ef4930', {
        glow: '#ff3d15',
        glowK: 2,
        baseGlow: 0.18
    }));
    starM.position.set(-3.4, 11, 0.05);
    sign.add(starM);
    const bulbPts = [];
    for(let i = 0; i < outline.length; i++){
        const a = outline[i], c = outline[(i + 1) % outline.length], n = Math.ceil(Math.hypot(a[0] - c[0], a[1] - c[1]) / 0.38);
        for(let k = 0; k < n; k++)bulbPts.push([
            a[0] + (c[0] - a[0]) * k / n,
            6.4 + a[1] + (c[1] - a[1]) * k / n
        ]);
    }
    const bulbMat = new THREE.MeshBasicMaterial({
        color: '#fff2bb',
        fog: true
    });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 6, 4), bulbMat, bulbPts.length * 2);
    const bm = new THREE.Matrix4();
    bulbPts.forEach(([x, y], i)=>{
        bulbs.setMatrixAt(i * 2, bm.makeTranslation(x, y, 0.3));
        bulbs.setMatrixAt(i * 2 + 1, bm.makeTranslation(x, y, -0.3));
    });
    sign.add(bulbs);
    sign.position.set(sx, 0, sz);
    sign.scale.setScalar(0.95);
    const island = new THREE.Mesh(new THREE.BoxGeometry(9, 0.25, 4), sheen('#000000', {
        live: 'plaza'
    }));
    island.position.set(sx, 0.12, sz);
    grp.add(island, sign);
    const glowRing = new THREE.Mesh(new THREE.CircleGeometry(9, 32).rotateX(-Math.PI / 2), nightAura('#ffd9a0', 0.14));
    glowRing.position.set(sx, 0.3, sz);
    grp.add(glowRing);
    engine.animate(sign, (f)=>{
        const n = theme.uniforms.uNight.value;
        bulbMat.color.setRGB(1, 0.95, 0.73).multiplyScalar(1 + n * (0.9 + 0.5 * Math.sin(f.t * 6)));
    });
    return grp;
}
