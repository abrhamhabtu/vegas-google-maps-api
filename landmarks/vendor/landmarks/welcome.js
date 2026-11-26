// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
// Rebuilt to authentic 1959 Betty Willis Welcome to Fabulous Las Vegas Sign fidelity
// with real-life desert rock planter, visitor photo plaza, safety bollards, and solar canopies.
const THREE = window.THREE;
import { latLonToXZ } from '../core/data.js';
import { theme } from '../core/theme.js';
import { ORIGIN } from '../places.js';
import { nightAura, sheen } from './sheen.js';
export { SIGN_LATLON } from '../places.js';
import { SIGN_LATLON } from '../places.js';

function makeRoundedShape(pts, radii) {
    const shape = new THREE.Shape();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const prev = pts[(i + n - 1) % n];
        const curr = pts[i];
        const next = pts[(i + 1) % n];
        const v1x = prev[0] - curr[0], v1y = prev[1] - curr[1];
        const v2x = next[0] - curr[0], v2y = next[1] - curr[1];
        const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1;
        const rad = Array.isArray(radii) ? radii[i] : radii;
        const r = Math.min(rad, l1 * 0.42, l2 * 0.42);
        const p1x = curr[0] + (v1x / l1) * r, p1y = curr[1] + (v1y / l1) * r;
        const p2x = curr[0] + (v2x / l2) * r, p2y = curr[1] + (v2y / l2) * r;
        if (i === 0) shape.moveTo(p1x, p1y);
        else shape.lineTo(p1x, p1y);
        shape.quadraticCurveTo(curr[0], curr[1], p2x, p2y);
    }
    shape.closePath();
    return shape;
}

function makeDiamondFaceGeometry(w, h, rTip = 0.17, rApex = 0.24) {
    const pts = [
        [-w, 0],
        [0, h],
        [w, 0],
        [0, -h]
    ];
    const shape = makeRoundedShape(pts, [rTip, rApex, rTip, rApex]);
    const geom = new THREE.ShapeGeometry(shape, 18);
    const pos = geom.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (pos.getX(i) + w) / (2 * w);
        uv[i * 2 + 1] = (pos.getY(i) + h) / (2 * h);
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geom;
}

function makeDiamondTexture(side) {
    const W = 2048, H = 1024;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');

    // Warm translucent backlit cream-white acrylic face (authentic 1959 plastic pan)
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.05, W * 0.5, H * 0.5, W * 0.55);
    bg.addColorStop(0, '#fffdf5');
    bg.addColorStop(0.7, '#faf5e6');
    bg.addColorStop(1, '#ede4ce');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle vintage inner pinstripe following the diamond silhouette
    ctx.save();
    ctx.strokeStyle = 'rgba(202, 168, 92, 0.45)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(W * 0.045, H * 0.5);
    ctx.lineTo(W * 0.5, H * 0.055);
    ctx.lineTo(W * 0.955, H * 0.5);
    ctx.lineTo(W * 0.5, H * 0.945);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (side === 'front') {
        // "TO" — crisp royal-blue sans-serif tucked upper-left of Fabulous
        ctx.save();
        ctx.fillStyle = '#1563ad';
        ctx.font = '800 84px "Helvetica Neue", "Arial Narrow", Arial, sans-serif';
        ctx.fillText('TO', W * 0.285, H * 0.305);
        ctx.restore();

        // "Fabulous" — sweeping mid-century cyan-blue Googie brush script
        ctx.save();
        ctx.fillStyle = '#0693d9';
        ctx.font = 'italic 600 186px "Snell Roundhand", "Brush Script MT", "Apple Chancery", Georgia, cursive';
        ctx.translate(W * 0.535, H * 0.315);
        ctx.rotate(-0.025);
        ctx.scale(1.06, 0.96);
        ctx.fillText('Fabulous', 0, 0);
        // Subtle mid-century script underline flourish
        ctx.strokeStyle = '#0693d9';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-250, 52);
        ctx.quadraticCurveTo(20, 34, 290, 48);
        ctx.stroke();
        ctx.restore();

        // "LAS VEGAS" — iconic tall, bold vivid red Googie sans-serif across center
        ctx.save();
        ctx.fillStyle = '#dc1f26';
        ctx.font = '900 250px "Helvetica Neue", "Arial Black", Impact, Arial, sans-serif';
        ctx.translate(W * 0.5, H * 0.545);
        ctx.scale(0.96, 1.06);
        ctx.fillText('LAS VEGAS', 0, 0);
        ctx.restore();

        // "NEVADA" — wide-tracked royal-blue sans-serif in lower diamond triangle
        ctx.save();
        ctx.fillStyle = '#175ea6';
        ctx.font = '800 94px "Helvetica Neue", Arial, sans-serif';
        const nevada = 'NEVADA';
        const spacing = 74;
        const startX = W * 0.5 - ((nevada.length - 1) * spacing) * 0.5;
        for (let i = 0; i < nevada.length; i++) {
            ctx.fillText(nevada[i], startX + i * spacing, H * 0.748);
        }
        ctx.restore();
    } else {
        // Back face (facing north toward departing traffic): "Drive CAREFULLY COME BACK SOON"
        ctx.save();
        ctx.fillStyle = '#0693d9';
        ctx.font = 'italic 600 188px "Snell Roundhand", "Brush Script MT", "Apple Chancery", Georgia, cursive';
        ctx.translate(W * 0.5, H * 0.31);
        ctx.rotate(-0.02);
        ctx.fillText('Drive', 0, 0);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = '#dc1f26';
        ctx.font = '900 222px "Helvetica Neue", "Arial Black", Impact, Arial, sans-serif';
        ctx.translate(W * 0.5, H * 0.545);
        ctx.scale(0.95, 1.05);
        ctx.fillText('CAREFULLY', 0, 0);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = '#175ea6';
        ctx.font = '800 76px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('COME BACK SOON', W * 0.5, H * 0.742);
        ctx.restore();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

function makeSilverDollarTexture(letter) {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');

    // Bright translucent white backlit silver-dollar disc (authentic real-life look)
    const g = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.08, S * 0.5, S * 0.5, S * 0.5);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.78, '#faf7ef');
    g.addColorStop(1, '#e6dfd0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    if (letter) {
        // Subtle red neon tube halo + crisp vivid red neon letter
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 162px "Helvetica Neue", "Arial Black", Arial, sans-serif';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 55, 40, 0.42)';
        ctx.lineWidth = 18;
        ctx.strokeText(letter, S * 0.5, S * 0.53);
        ctx.fillStyle = '#e01b24';
        ctx.fillText(letter, S * 0.5, S * 0.53);
        // Inner bright neon tube highlight
        ctx.strokeStyle = 'rgba(255, 150, 120, 0.55)';
        ctx.lineWidth = 4;
        ctx.strokeText(letter, S * 0.5, S * 0.53);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

function makePaverTexture() {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cbbca6';
    ctx.fillRect(0, 0, S, S);

    const rows = 16, cols = 8;
    const rw = S / cols, rh = S / rows;
    for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (rw * 0.5);
        for (let col = -1; col <= cols; col++) {
            const x = col * rw + offset;
            const y = r * rh;
            const h = Math.sin(r * 19.3 + col * 37.1) * 0.5 + 0.5;
            const shade = h < 0.35 ? '#c6a98c' : h < 0.7 ? '#d3c2aa' : '#be9d80';
            ctx.fillStyle = shade;
            ctx.fillRect(x + 2, y + 2, rw - 4, rh - 4);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 5);
    tex.anisotropy = 4;
    return tex;
}

function makeSolarTexture() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#182b47';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(145, 185, 225, 0.38)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo((i * S) / 8, 0);
        ctx.lineTo((i * S) / 8, S);
        ctx.stroke();
    }
    for (let j = 1; j < 6; j++) {
        ctx.beginPath();
        ctx.moveTo(0, (j * S) / 6);
        ctx.lineTo(S, (j * S) / 6);
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

function buildIBeamColumn(height, mat) {
    const g = new THREE.Group();
    const flangeW = 0.18, flangeT = 0.032, depth = 0.22, webT = 0.036;
    const front = new THREE.Mesh(new THREE.BoxGeometry(flangeW, height, flangeT), mat);
    front.position.set(0, height * 0.5, depth * 0.5 - flangeT * 0.5);
    const back = new THREE.Mesh(new THREE.BoxGeometry(flangeW, height, flangeT), mat);
    back.position.set(0, height * 0.5, -depth * 0.5 + flangeT * 0.5);
    const web = new THREE.Mesh(new THREE.BoxGeometry(webT, height, depth - flangeT * 2), mat);
    web.position.set(0, height * 0.5, 0);
    g.add(front, back, web);
    return g;
}

function buildAgave(scale, mat) {
    const g = new THREE.Group();
    const bladeGeom = new THREE.ConeGeometry(0.09 * scale, 0.62 * scale, 4);
    bladeGeom.translate(0, 0.31 * scale, 0);
    for (let ring = 0; ring < 2; ring++) {
        const count = ring === 0 ? 7 : 5;
        const tilt = ring === 0 ? 0.95 : 0.45;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + ring * 0.45;
            const blade = new THREE.Mesh(bladeGeom, mat);
            blade.rotation.order = 'YXZ';
            blade.rotation.y = a;
            blade.rotation.x = tilt;
            g.add(blade);
        }
    }
    return g;
}

export function welcomeSign(engine) {
    const [sx, sz] = latLonToXZ(ORIGIN, SIGN_LATLON.lat, SIGN_LATLON.lon);
    const grp = new THREE.Group();
    grp.name = 'Welcome sign';

    const WALK_Y = 0.11;
    const site = new THREE.Group();
    site.position.set(sx, WALK_Y, sz);
    grp.add(site);

    // ─── 1. AUTHENTIC 1959 BETTY WILLIS SIGN (25 FT = 7.62 m TALL) ──────────
    const sign = new THREE.Group();
    site.add(sign);

    const DIAMOND_W = 2.92;     // 5.84 m wide stretched horizontal Googie diamond
    const DIAMOND_H = 1.48;     // 2.96 m tall apex-to-apex
    const DIAMOND_Y = 3.92;     // Bottom apex ~2.44 m, top apex ~5.40 m
    const CABINET_D = 0.40;     // Sheet metal cabinet depth (±0.20, bevel to ±0.22)

    const diamondPts = [
        [-DIAMOND_W, 0],
        [0, DIAMOND_H],
        [DIAMOND_W, 0],
        [0, -DIAMOND_H]
    ];

    // Brushed metallic silver-champagne side casing & beveled perimeter channel
    const casingMat = sheen('#cfc7b4', {
        refl: 0.42,
        spec: 1.45,
        glow: '#ffe6a8',
        glowK: 0.22,
        baseGlow: 0.04
    });
    const goldTrimMat = sheen('#d4ab53', {
        refl: 0.48,
        spec: 1.6,
        glow: '#ffd573',
        glowK: 0.45,
        baseGlow: 0.06
    });
    const channelDarkMat = sheen('#7c7361', {
        refl: 0.25,
        spec: 0.9
    });

    // Main extruded diamond cabinet body
    const outerShape = makeRoundedShape(diamondPts, [0.18, 0.24, 0.18, 0.24]);
    const cabinetGeom = new THREE.ExtrudeGeometry(outerShape, {
        depth: CABINET_D,
        bevelEnabled: true,
        bevelSize: 0.04,
        bevelThickness: 0.02,
        bevelSegments: 2
    }).translate(0, 0, -CABINET_D * 0.5);
    const cabinet = new THREE.Mesh(cabinetGeom, casingMat);
    cabinet.position.y = DIAMOND_Y;
    sign.add(cabinet);

    // Outer metallic perimeter lip & recessed bulb trough on BOTH front (+z) and back (-z)
    const rimPath = new THREE.CurvePath();
    const rimVerts = diamondPts.map(([x, y]) => new THREE.Vector3(x, y + DIAMOND_Y, 0));
    for (let i = 0; i < rimVerts.length; i++) {
        rimPath.add(new THREE.LineCurve3(rimVerts[i], rimVerts[(i + 1) % rimVerts.length]));
    }
    const outerLip = new THREE.Mesh(new THREE.TubeGeometry(rimPath, 96, 0.064, 8, true), goldTrimMat);
    for (const zLip of [0.24, -0.24]) {
        const lip = outerLip.clone();
        lip.position.z = zLip;
        sign.add(lip);
    }

    // Slightly inset metallic bulb-channel backing ring (clean 1.8 cm clearance over cabinet ±0.22)
    const channelPts = diamondPts.map(([x, y]) => [x * 0.965, y * 0.965]);
    const channelShape = makeRoundedShape(channelPts, [0.16, 0.22, 0.16, 0.22]);
    const channelGeom = new THREE.ShapeGeometry(channelShape, 16);
    for (const zCh of [0.238, -0.238]) {
        const ch = new THREE.Mesh(channelGeom, channelDarkMat);
        ch.position.set(0, DIAMOND_Y, zCh);
        if (zCh < 0) ch.rotation.y = Math.PI;
        sign.add(ch);
    }

    // Backlit translucent acrylic diamond faces (Front +z & Back -z) with authentic typography
    const faceGeom = makeDiamondFaceGeometry(DIAMOND_W * 0.895, DIAMOND_H * 0.885, 0.14, 0.20);
    const frontMat = sheen('#ffffff', {
        map: makeDiamondTexture('front'),
        glow: '#000000',
        glowK: 0.72,
        baseGlow: 0.12
    });
    const backMat = sheen('#ffffff', {
        map: makeDiamondTexture('back'),
        glow: '#000000',
        glowK: 0.72,
        baseGlow: 0.12
    });
    const frontFace = new THREE.Mesh(faceGeom, frontMat);
    frontFace.position.set(0, DIAMOND_Y, 0.258);
    sign.add(frontFace);

    const backFace = new THREE.Mesh(faceGeom, backMat);
    backFace.position.set(0, DIAMOND_Y, -0.258);
    backFace.rotation.y = Math.PI;
    sign.add(backFace);

    // ─── 2. TWIN STRUCTURAL STEEL I-BEAM POLES WITH CROSS-BRACING RUNGS ─────
    // Authentic off-center left placement (x = -1.28 m and x = -0.40 m, center = -0.84 m)
    const POLE_L = -1.28;
    const POLE_R = -0.40;
    const POLE_CX = (POLE_L + POLE_R) * 0.5;
    const POLE_H = 7.62; // Exact 25 ft Clark County landmark height

    const steelMat = sheen('#8fa4b5', {
        refl: 0.34,
        spec: 1.15,
        glow: '#9db6cc',
        glowK: 0.14,
        baseGlow: 0.03
    });
    const steelDarkMat = sheen('#627585', {
        refl: 0.28,
        spec: 0.9
    });

    for (const px of [POLE_L, POLE_R]) {
        const col = buildIBeamColumn(POLE_H, steelMat);
        col.position.set(px, 0, -0.02);
        sign.add(col);

        // Bolted steel anchor base plate + concrete footing pedestal
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.34), steelDarkMat);
        plate.position.set(px, 0.24, -0.02);
        sign.add(plate);
        const footing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.44), sheen('#bdb4a2', { spec: 0.2 }));
        footing.position.set(px, 0.12, -0.02);
        sign.add(footing);
    }

    // Top horizontal steel crossbar joining the twin poles at 25 ft
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(POLE_R - POLE_L + 0.22, 0.18, 0.24), steelMat);
    topBar.position.set(POLE_CX, POLE_H - 0.09, -0.02);
    sign.add(topBar);

    // Horizontal steel ladder cross-bracing rungs between the two poles
    const span = POLE_R - POLE_L - 0.06;
    const rungGeom = new THREE.BoxGeometry(span, 0.055, 0.09);
    for (const ry of [0.68, 1.16, 1.64, 2.12, 2.60, 5.44, 5.78]) {
        const rung = new THREE.Mesh(rungGeom, steelDarkMat);
        rung.position.set(POLE_CX, ry, -0.02);
        sign.add(rung);
    }
    // Diagonal steel X-brace between lower rungs for authentic structural truss detail
    const diagLen = Math.hypot(span, 0.96);
    const diagAngle = Math.atan2(0.96, span);
    const diagGeom = new THREE.BoxGeometry(diagLen, 0.036, 0.05);
    for (const sgn of [-1, 1]) {
        const d = new THREE.Mesh(diagGeom, steelDarkMat);
        d.position.set(POLE_CX, 1.64, -0.02);
        d.rotation.z = sgn * diagAngle;
        sign.add(d);
    }

    // ─── 3. ICONIC 8-POINT RED-ORANGE STARBURST + 4-POINT YELLOW NEON STAR ──
    const STAR_Y = 6.62;
    const redStarShape = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        let r;
        if (i % 2 === 1) r = 0.18;          // narrow inner waist
        else if (i % 4 === 2) r = 0.54;     // 4 diagonal points
        else if (i === 0 || i === 8) r = 1.00; // tall vertical spikes
        else r = 0.88;                      // wide horizontal spikes
        const px = Math.sin(a) * r;
        const py = Math.cos(a) * r;
        if (i === 0) redStarShape.moveTo(px, py);
        else redStarShape.lineTo(px, py);
    }
    redStarShape.closePath();

    const redStarMat = sheen('#df3624', {
        refl: 0.25,
        spec: 0.9,
        glow: '#ff4220',
        glowK: 1.25,
        baseGlow: 0.18
    });
    const redStarMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(redStarShape, {
            depth: 0.11,
            bevelEnabled: true,
            bevelSize: 0.015,
            bevelThickness: 0.015,
            bevelSegments: 1
        }).translate(0, 0, -0.055),
        redStarMat
    );
    redStarMesh.position.set(POLE_CX, STAR_Y, -0.01);
    sign.add(redStarMesh);

    // Glowing yellow/gold 4-point neon tube star on BOTH front (+z) and back (-z)
    const goldStarPts = [];
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 === 1 ? 0.12 : (i === 0 || i === 4 ? 0.96 : 0.84);
        goldStarPts.push(new THREE.Vector3(Math.sin(a) * r, Math.cos(a) * r, 0));
    }
    const goldStarPath = new THREE.CurvePath();
    for (let i = 0; i < goldStarPts.length; i++) {
        goldStarPath.add(new THREE.LineCurve3(goldStarPts[i], goldStarPts[(i + 1) % goldStarPts.length]));
    }
    const goldTubeGeom = new THREE.TubeGeometry(goldStarPath, 64, 0.026, 6, true);
    const goldFillShape = new THREE.Shape();
    goldStarPts.forEach((p, i) => (i === 0 ? goldFillShape.moveTo(p.x, p.y) : goldFillShape.lineTo(p.x, p.y)));
    goldFillShape.closePath();
    const goldFillGeom = new THREE.ShapeGeometry(goldFillShape);

    const goldNeonMat = new THREE.MeshBasicMaterial({ color: '#ffea54', fog: true });
    const goldCoreMat = new THREE.MeshBasicMaterial({ color: '#fff49c', fog: true });
    for (const zSide of [0.09, -0.11]) {
        const tube = new THREE.Mesh(goldTubeGeom, goldNeonMat);
        tube.position.set(POLE_CX, STAR_Y, zSide);
        sign.add(tube);

        const core = new THREE.Mesh(goldFillGeom, goldCoreMat);
        core.scale.set(0.82, 0.82, 1);
        core.position.set(POLE_CX, STAR_Y, zSide + (zSide > 0 ? 0.005 : -0.005));
        if (zSide < 0) core.rotation.y = Math.PI;
        sign.add(core);
    }

    // ─── 4. SEVEN WHITE "SILVER DOLLAR" DISCS WITH RED NEON W-E-L-C-O-M-E ───
    const discDrumMat = sheen('#d2cab8', { refl: 0.42, spec: 1.4 });
    const discRimMat = sheen('#e8dec8', { refl: 0.48, spec: 1.5, glow: '#fff2cf', glowK: 0.35, baseGlow: 0.05 });
    const blankBackMat = sheen('#ffffff', {
        map: makeSilverDollarTexture(null),
        glow: '#000000',
        glowK: 0.68,
        baseGlow: 0.14
    });
    const DISC_R = 0.325;
    const DISC_D = 0.56; // Cleanly proud of diamond cabinet faces (±0.258) with zero clipping
    const drumGeom = new THREE.CylinderGeometry(DISC_R, DISC_R, DISC_D, 28).rotateX(Math.PI / 2);
    const rimGeom = new THREE.TorusGeometry(DISC_R, 0.026, 8, 28);
    const discFaceGeom = new THREE.CircleGeometry(DISC_R - 0.015, 28);

    const welcomeLetters = 'WELCOME';
    for (let i = 0; i < 7; i++) {
        const dx = (i - 3) * 0.61;
        // Arched/chevron placement following the top diamond slope
        const dy = DIAMOND_Y + DIAMOND_H - 0.06 - Math.abs(i - 3) * 0.255;

        const drum = new THREE.Mesh(drumGeom, discDrumMat);
        drum.position.set(dx, dy, 0);
        sign.add(drum);

        for (const zRim of [DISC_D * 0.5, -DISC_D * 0.5]) {
            const rim = new THREE.Mesh(rimGeom, discRimMat);
            rim.position.set(dx, dy, zRim);
            sign.add(rim);
        }

        // Front (+z): crisp white backlit silver dollar with vivid red neon letter
        const fMat = sheen('#ffffff', {
            map: makeSilverDollarTexture(welcomeLetters[i]),
            glow: '#000000',
            glowK: 0.78,
            baseGlow: 0.15
        });
        const frontDisc = new THREE.Mesh(discFaceGeom, fMat);
        frontDisc.position.set(dx, dy, DISC_D * 0.5 + 0.012);
        sign.add(frontDisc);

        // Back (-z): authentic blank white backlit silver dollar (just like real life)
        const backDisc = new THREE.Mesh(discFaceGeom, blankBackMat);
        backDisc.position.set(dx, dy, -DISC_D * 0.5 - 0.012);
        backDisc.rotation.y = Math.PI;
        sign.add(backDisc);
    }

    // ─── 5. CHASING WARM-WHITE / GOLD INCANDESCENT MARQUEE BULBS ────────────
    const bulbCoords = [];
    const bulbInset = 0.945;
    for (let i = 0; i < diamondPts.length; i++) {
        const a = diamondPts[i];
        const b = diamondPts[(i + 1) % diamondPts.length];
        const ax = a[0] * bulbInset, ay = a[1] * bulbInset;
        const bx = b[0] * bulbInset, by = b[1] * bulbInset;
        const n = 15;
        for (let k = 0; k < n; k++) {
            const t = k / n;
            bulbCoords.push([
                ax + (bx - ax) * t,
                DIAMOND_Y + ay + (by - ay) * t
            ]);
        }
    }

    // 4 phase groups for smooth zero-allocation chasing shimmer around the diamond
    const PHASES = 4;
    const phaseMats = [];
    const bulbGeom = new THREE.SphereGeometry(0.044, 7, 5);
    const socketGeom = new THREE.CylinderGeometry(0.032, 0.036, 0.028, 7).rotateX(Math.PI / 2);
    const socketMat = sheen('#8c826d', { refl: 0.3, spec: 0.8 });
    const sockets = new THREE.InstancedMesh(socketGeom, socketMat, bulbCoords.length * 2);
    const bm = new THREE.Matrix4();

    const phaseBuckets = Array.from({ length: PHASES }, () => []);
    bulbCoords.forEach(([x, y], idx) => {
        sockets.setMatrixAt(idx * 2, bm.makeTranslation(x, y, 0.252));
        sockets.setMatrixAt(idx * 2 + 1, bm.makeTranslation(x, y, -0.252));
        phaseBuckets[idx % PHASES].push([x, y]);
    });
    sign.add(sockets);

    for (let p = 0; p < PHASES; p++) {
        const mat = new THREE.MeshBasicMaterial({ color: '#fff1bd', fog: true });
        phaseMats.push(mat);
        const pts = phaseBuckets[p];
        const mesh = new THREE.InstancedMesh(bulbGeom, mat, pts.length * 2);
        pts.forEach(([x, y], i) => {
            mesh.setMatrixAt(i * 2, bm.makeTranslation(x, y, 0.278));
            mesh.setMatrixAt(i * 2 + 1, bm.makeTranslation(x, y, -0.278));
        });
        sign.add(mesh);
    }

    // ─── 6. REAL-LIFE DESERT ROCK PLANTER BED & AGAVES AT SIGN BASE ─────────
    const concreteCurbMat = sheen('#cfc7b8', { spec: 0.25 });
    const desertRockMat = sheen('#b89b78', { spec: 0.15 });
    const boulderMat = sheen('#9e8264', { spec: 0.18 });
    const agaveMat = sheen('#5b8768', { spec: 0.18 });
    const agaveBlueMat = sheen('#628a86', { spec: 0.2 });

    // Rounded concrete-curbed planter bed beneath the sign poles (x in [-3.4, +3.4], z in [-1.6, +1.8])
    const planterPts = [
        [-3.35, -1.55],
        [3.35, -1.55],
        [3.35, 1.75],
        [-3.35, 1.75]
    ];
    const planterOuter = makeRoundedShape(planterPts, 0.72);
    const planterInnerPts = [
        [-3.12, -1.32],
        [3.12, -1.32],
        [3.12, 1.52],
        [-3.12, 1.52]
    ];
    const planterInner = makeRoundedShape(planterInnerPts, 0.56);
    planterOuter.holes.push(planterInner);

    // Concrete curb wall around planter
    const curbGeom = new THREE.ExtrudeGeometry(planterOuter, { depth: 0.24, bevelEnabled: false }).rotateX(Math.PI / 2);
    const curbMesh = new THREE.Mesh(curbGeom, concreteCurbMat);
    curbMesh.position.y = 0.24;
    site.add(curbMesh);

    // Mounded Mojave desert gravel & decorative rock fill inside planter
    const rockBedGeom = new THREE.ExtrudeGeometry(planterInner, { depth: 0.16, bevelEnabled: false }).rotateX(Math.PI / 2);
    const rockBed = new THREE.Mesh(rockBedGeom, desertRockMat);
    rockBed.position.y = 0.17;
    site.add(rockBed);

    // Decorative desert boulders & Mojave agaves/succulents inside the planter bed
    const boulderSpecs = [
        [-2.45, -0.65, 0.42, 0.26, 0.34, 0.4],
        [-1.95, 0.88, 0.34, 0.22, 0.28, 1.1],
        [0.45, -0.78, 0.46, 0.28, 0.36, 2.2],
        [1.95, 0.72, 0.40, 0.25, 0.32, 0.8],
        [2.55, -0.45, 0.36, 0.24, 0.30, 1.7],
        [0.95, 0.92, 0.28, 0.18, 0.24, 2.7]
    ];
    const rockGeom = new THREE.DodecahedronGeometry(1, 0);
    for (const [bx, bz, sxB, syB, szB, rot] of boulderSpecs) {
        const b = new THREE.Mesh(rockGeom, boulderMat);
        b.scale.set(sxB, syB, szB);
        b.rotation.set(0.2, rot, 0.15);
        b.position.set(bx, 0.18 + syB * 0.45, bz);
        site.add(b);
    }

    const agaveSpecs = [
        [-2.55, 0.45, 0.95, agaveBlueMat],
        [-1.95, -0.82, 0.82, agaveMat],
        [0.55, 0.65, 0.88, agaveBlueMat],
        [1.55, -0.65, 0.96, agaveMat],
        [2.45, 0.35, 0.86, agaveBlueMat]
    ];
    for (const [ax, az, sc, mat] of agaveSpecs) {
        const ag = buildAgave(sc, mat);
        ag.position.set(ax, 0.16, az);
        site.add(ag);
    }

    // Two compact black ground floodlight fixtures aimed up at the sign face
    const darkMetalMat = sheen('#262a30', { refl: 0.3, spec: 0.8 });
    const floodLampMat = new THREE.MeshBasicMaterial({ color: '#ffe8a8', fog: true });
    for (const fx of [-1.45, 1.25]) {
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.18), darkMetalMat);
        housing.position.set(fx, 0.24, 1.32);
        housing.rotation.x = -0.55;
        site.add(housing);
        const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.10), floodLampMat);
        lens.position.set(fx, 0.28, 1.24);
        lens.rotation.x = -0.55;
        site.add(lens);
    }

    // ─── 7. VISITOR PHOTO VIEWING PAD, PLAZA WALKWAY, BOLLARDS & SOLAR CANOPIES
    const paverMat = sheen('#ffffff', {
        map: makePaverTexture(),
        glow: '#000000',
        glowK: 0.04,
        baseGlow: 0.02
    });

    // Paved brick/concrete photo viewing pad immediately in front (+z) of the sign
    // Connects cleanly south to the plaza walkway and north crosswalk (z = +44.9)
    // Strictly inside the safe median footprint (clears SB parking entrance aisle on -x)
    const plazaPts = [
        [-3.85, 1.95],
        [3.65, 1.95],
        [3.85, 13.2],
        [4.25, 17.8],
        [4.35, 43.0],
        [-1.05, 43.0],
        [-4.25, 22.8],
        [-3.85, 13.0]
    ];
    const plazaShape = makeRoundedShape(plazaPts, 0.55);
    const plazaGeom = new THREE.ShapeGeometry(plazaShape, 12).rotateX(Math.PI / 2);
    // Normalize UVs for crisp paver tiling
    const pPos = plazaGeom.attributes.position;
    const pUv = new Float32Array(pPos.count * 2);
    for (let i = 0; i < pPos.count; i++) {
        pUv[i * 2] = (pPos.getX(i) + 4.5) / 8.0;
        pUv[i * 2 + 1] = (pPos.getZ(i) - 1.5) / 14.0;
    }
    plazaGeom.setAttribute('uv', new THREE.BufferAttribute(pUv, 2));
    const plazaMesh = new THREE.Mesh(plazaGeom, paverMat);
    plazaMesh.position.y = 0.032; // Cleanly above WALK_HEIGHT gravel with zero z-fighting
    site.add(plazaMesh);

    // Subtle concrete border edging along the photo viewing pad (z = 2.0 to 13.0)
    const padBorderMat = sheen('#d6cfc0', { spec: 0.2 });
    const leftEdge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 11.2), padBorderMat);
    leftEdge.position.set(-3.88, 0.025, 7.55);
    const rightEdge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 11.2), padBorderMat);
    rightEdge.position.set(3.75, 0.025, 7.55);
    site.add(leftEdge, rightEdge);

    // Low black safety bollards & horizontal steel pedestrian fencing along both sides of photo pad
    const bollardGeom = new THREE.CylinderGeometry(0.055, 0.065, 0.88, 10);
    const bollardPositions = [];
    // West edge bollards (along SB Las Vegas Blvd)
    for (let bz = 2.6; bz <= 12.6; bz += 2.0) bollardPositions.push([-3.75, bz]);
    // East edge bollards (along NB Las Vegas Blvd)
    for (let bz = 2.6; bz <= 12.6; bz += 2.0) bollardPositions.push([3.62, bz]);
    // Plaza walkway east edge bollards
    for (let bz = 18.0; bz <= 40.0; bz += 4.4) bollardPositions.push([4.15, bz]);

    const bollards = new THREE.InstancedMesh(bollardGeom, darkMetalMat, bollardPositions.length);
    bollardPositions.forEach(([bx, bz], i) => {
        bollards.setMatrixAt(i, bm.makeTranslation(bx, 0.44, bz));
    });
    site.add(bollards);

    // Low horizontal safety rails linking the photo-pad bollards on west & east sides
    const railGeom = new THREE.BoxGeometry(0.04, 0.045, 10.0);
    for (const rx of [-3.75, 3.62]) {
        for (const ry of [0.42, 0.78]) {
            const rail = new THREE.Mesh(railGeom, darkMetalMat);
            rail.position.set(rx, ry, 7.6);
            site.add(rail);
        }
    }

    // Iconic Las Vegas Sign plaza solar-panel shade canopies (3 angled solar trees on east plaza)
    const solarMat = sheen('#ffffff', {
        map: makeSolarTexture(),
        refl: 0.45,
        spec: 1.5,
        glow: '#1a365c',
        glowK: 0.12
    });
    const solarFrameMat = sheen('#303640', { refl: 0.35, spec: 1.0 });
    const canopyPostGeom = new THREE.CylinderGeometry(0.11, 0.14, 3.25, 10);
    const canopyArmGeom = new THREE.BoxGeometry(0.10, 0.10, 2.3);
    const canopyPanelGeom = new THREE.BoxGeometry(2.75, 0.07, 2.35);

    for (const cz of [21.0, 28.0, 35.0]) {
        const canopy = new THREE.Group();
        canopy.position.set(2.35, 0, cz);

        const post = new THREE.Mesh(canopyPostGeom, solarFrameMat);
        post.position.y = 1.625;
        canopy.add(post);

        // Concrete base collar
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.22, 10), concreteCurbMat);
        collar.position.y = 0.11;
        canopy.add(collar);

        // Angled solar panel deck facing slightly south (+z)
        const deck = new THREE.Group();
        deck.position.y = 3.25;
        deck.rotation.x = 0.18;

        const arm = new THREE.Mesh(canopyArmGeom, solarFrameMat);
        arm.position.y = -0.06;
        deck.add(arm);

        const frame = new THREE.Mesh(canopyPanelGeom, solarFrameMat);
        deck.add(frame);

        const cells = new THREE.Mesh(new THREE.PlaneGeometry(2.60, 2.20).rotateX(-Math.PI / 2), solarMat);
        cells.position.y = 0.04;
        deck.add(cells);

        canopy.add(deck);
        site.add(canopy);
    }

    // Two visitor plaza benches beneath the solar shade canopies
    const benchWoodMat = sheen('#8c6244', { spec: 0.25 });
    for (const bz of [24.5, 31.5]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 1.85), benchWoodMat);
        seat.position.set(2.55, 0.46, bz);
        site.add(seat);
        for (const lo of [-0.68, 0.68]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.08), darkMetalMat);
            leg.position.set(2.55, 0.22, bz + lo);
            site.add(leg);
        }
    }

    // Warm nighttime ground glow aura beneath the sign & photo pad
    const glowRing = new THREE.Mesh(
        new THREE.CircleGeometry(5.2, 32).rotateX(-Math.PI / 2),
        nightAura('#ffd896', 0.20)
    );
    glowRing.position.set(0, 0.06, 1.8);
    site.add(glowRing);

    // ─── 8. SMOOTH ANIMATION (CHASING MARQUEE BULBS + GOLDEN NEON STAR) ─────
    engine.animate(sign, (f) => {
        const n = theme.uniforms.uNight.value;
        const t = f.t * 4.5;
        for (let p = 0; p < PHASES; p++) {
            // Subtle incandescent marquee chase at night; steady warm-gold in Day/Sunset
            const wave = 0.5 + 0.5 * Math.sin(t - (p * Math.PI * 2) / PHASES);
            const boost = 1 + n * (0.55 + 0.85 * wave);
            phaseMats[p].color.setRGB(1.0, 0.93, 0.68).multiplyScalar(boost);
        }
        const starBoost = 1 + n * (1.05 + 0.15 * Math.sin(f.t * 3.2));
        goldNeonMat.color.setRGB(1.0, 0.90, 0.34).multiplyScalar(starBoost);
        goldCoreMat.color.setRGB(1.0, 0.96, 0.62).multiplyScalar(1 + n * 1.15);
        floodLampMat.color.setRGB(1.0, 0.91, 0.66).multiplyScalar(0.55 + n * 1.35);
    });

    return grp;
}
