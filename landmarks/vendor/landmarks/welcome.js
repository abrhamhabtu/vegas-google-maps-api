// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { latLonToXZ } from '../core/data.js';
import { theme } from '../core/theme.js';
import { flatMaterial, litColor, ORDER } from '../map/materials.js';
import { palmGeometry } from '../map/trees.js';
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

function makeFlatPoly(pts, mat, y, order, radius = 0.9) {
    // Shape uses (x, -z) so rotateX(-PI/2) maps (x, y_shape, 0) -> (x, 0, -y_shape) = (x, 0, z)
    const shape = makeRoundedShape(pts.map(([x, z]) => [x, -z]), radius);
    const geo = new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.renderOrder = order;
    return mesh;
}

function makeRaisedIsland(pts, topMat, curbMat, height = 0.16, radius = 1.4) {
    const grp = new THREE.Group();
    const shape = makeRoundedShape(pts.map(([x, z]) => [x, -z]), radius);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(geo, curbMat);
    body.renderOrder = ORDER.road + 4;
    const topGeo = new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = height + 0.012;
    top.renderOrder = ORDER.road + 5;
    grp.add(body, top);
    return grp;
}

function makePavementLabel(lines, w, h) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#d6dfec';
    ctx.font = '800 66px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = lines.length > 1 ? 82 : 0;
    const startY = 128 - ((lines.length - 1) * step) / 2;
    lines.forEach((line, i) => ctx.fillText(line, 128, startY + i * step, 236));
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({
        map: tx,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        fog: true
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), mat);
    mesh.renderOrder = ORDER.paint + 2;
    return mesh;
}

function makeArrowMesh(mat, scale = 1) {
    const s = new THREE.Shape();
    s.moveTo(-0.14, -1.4);
    s.lineTo(0.14, -1.4);
    s.lineTo(0.14, 0.55);
    s.lineTo(0.54, 0.55);
    s.lineTo(0, 1.45);
    s.lineTo(-0.54, 0.55);
    s.lineTo(-0.14, 0.55);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(scale);
    mesh.renderOrder = ORDER.paint + 2;
    return mesh;
}

function makeZebraCrosswalk(x0, x1, z, mat, y = 0.055, depth = 2.5) {
    const grp = new THREE.Group();
    const span = x1 - x0;
    const stripeW = 0.48, pitch = 1.02;
    const count = Math.max(2, Math.floor((span - stripeW) / pitch) + 1);
    const startX = (x0 + x1 - (count - 1) * pitch) / 2;
    const geo = new THREE.PlaneGeometry(stripeW, depth).rotateX(-Math.PI / 2);
    for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(startX + i * pitch, y, z);
        m.renderOrder = ORDER.paint + 2;
        grp.add(m);
    }
    return grp;
}

function makeCanopyGeo() {
    const trunk = new THREE.CylinderGeometry(0.16, 0.23, 2.5, 6, 1, true);
    trunk.translate(0, 1.25, 0);
    const crown = new THREE.IcosahedronGeometry(2.05, 1);
    crown.scale(1, 1.12, 1);
    crown.translate(0, 3.95, 0);
    const out = new THREE.BufferGeometry();
    const pos = [], nrm = [], col = [], idx = [];
    const addPart = (g, hex) => {
        const c = new THREE.Color(hex);
        const base = pos.length / 3;
        const P = g.attributes.position, N = g.attributes.normal;
        for (let i = 0; i < P.count; i++) {
            pos.push(P.getX(i), P.getY(i), P.getZ(i));
            nrm.push(N.getX(i), N.getY(i), N.getZ(i));
            col.push(c.r, c.g, c.b);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
        else for (let i = 0; i < P.count; i++) idx.push(i + base);
    };
    addPart(trunk, '#7a6a58');
    addPart(crown, '#259272');
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.setIndex(idx);
    return out;
}

export function welcomeSign(g, engine) {
    const [sx, sz] = latLonToXZ(ORIGIN, SIGN_LATLON.lat, SIGN_LATLON.lon);
    const grp = new THREE.Group();
    grp.name = 'Welcome sign';

    // --- 1. Iconic Welcome to Fabulous Las Vegas Sign (matching Apple Maps geometry) ---
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

    sign.position.set(sx, 0, sz);
    sign.scale.setScalar(0.96);
    grp.add(sign);

    const glowRing = new THREE.Mesh(new THREE.CircleGeometry(10, 32).rotateX(-Math.PI / 2), nightAura('#ffd9a0', 0.16));
    glowRing.position.set(sx, 0.28, sz);
    grp.add(glowRing);

    // --- 2. Welcome Sign Median Parking Lot, Bus Parking, Crosswalks & Landscaping ---
    const lotGroup = new THREE.Group();
    lotGroup.name = 'Welcome sign parking & plaza';
    lotGroup.position.set(sx, 0, sz);

    const asphaltMat = flatMaterial('roadStrip');
    const medianTopMat = flatMaterial('median');
    const curbMat = flatMaterial('curb');
    const paintMat = flatMaterial('paint');
    const paintDimMat = flatMaterial('paintDim');

    // Continuous landscaped median base running from north of the sign to south of the exit loop
    const medianBase = makeRaisedIsland([
        [-7.5, -18],
        [7.5, -18],
        [10.2, 224],
        [-10.2, 224]
    ], medianTopMat, curbMat, 0.175, 4.5);
    lotGroup.add(medianBase);

    // Sculpted one-way asphalt driveway, upper car parking lot, lower BUS ONLY lot, and south exit curve
    // Coordinates align directly with OSM way 135295758 & OSM parking area [x: -8..+9.3, z: +52..+170]
    const lotAsphalt = makeFlatPoly([
        [-14.2, 14],   // Entry taper from southbound S Las Vegas Blvd
        [-7.2, 17],
        [-1.8, 34],
        [-0.6, 50],
        [7.8, 56],     // North-east corner of car parking lot
        [8.6, 108],    // East edge of car parking lot
        [2.6, 111],    // Planter bump-out indent by mid crosswalk
        [3.0, 121],
        [9.0, 126],    // North-east corner of BUS ONLY parking bay
        [9.5, 165],    // South-east corner of BUS ONLY bay
        [4.2, 168],    // South planter bump-out indent
        [8.4, 188],    // South exit curve outer bend
        [7.2, 202],
        [1.5, 208],
        [-13.8, 217],  // Exit merge back into southbound S Las Vegas Blvd
        [-14.2, 209],
        [-1.8, 202],
        [2.8, 195],
        [2.2, 183],
        [-3.8, 169],   // West edge of BUS ONLY bay
        [-5.6, 112],   // West edge by mid crosswalk
        [-8.0, 108],   // West edge of car parking lot
        [-8.2, 66],
        [-4.5, 56],
        [-6.4, 40],
        [-10.5, 27],
        [-14.2, 24]
    ], asphaltMat, 0.195, ORDER.road + 7, 2.2);
    lotGroup.add(lotAsphalt);

    // Subtle crisp border along the parking apron & crosswalks
    // 1. North entry crosswalk across the lot entrance + matching SB & NB crosswalks across S Las Vegas Blvd
    lotGroup.add(makeZebraCrosswalk(-6.2, -1.6, 43.0, paintMat, 0.212, 2.2));
    lotGroup.add(makeZebraCrosswalk(-19.8, -10.4, 43.0, paintMat, 0.06, 2.6));
    lotGroup.add(makeZebraCrosswalk(11.4, 21.2, 43.0, paintMat, 0.06, 2.6));

    // 2. Mid-lot pedestrian crosswalk between car parking and BUS ONLY parking
    lotGroup.add(makeZebraCrosswalk(-5.4, 2.6, 113.0, paintMat, 0.212, 2.4));

    // 3. Upper car parking stall dividers (west & east angled/perpendicular bays, dz = 60..104)
    const stallGeo = new THREE.PlaneGeometry(3.4, 0.12).rotateX(-Math.PI / 2);
    for (let z = 62; z <= 104; z += 4.2) {
        const leftStall = new THREE.Mesh(stallGeo, paintDimMat);
        leftStall.position.set(-5.7, 0.21, z);
        leftStall.renderOrder = ORDER.paint + 1;
        lotGroup.add(leftStall);

        const rightStall = new THREE.Mesh(stallGeo, paintDimMat);
        rightStall.position.set(5.6, 0.21, z);
        rightStall.renderOrder = ORDER.paint + 1;
        lotGroup.add(rightStall);
    }

    // 4. Bus parking lane divider & BUS ONLY pavement markings (dz = 118..164)
    const busLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 44).rotateX(-Math.PI / 2), paintDimMat);
    busLine.position.set(0.4, 0.21, 141);
    busLine.renderOrder = ORDER.paint + 1;
    lotGroup.add(busLine);

    for (const z of [131, 152]) {
        const busOnly = makePavementLabel(['BUS', 'ONLY'], 3.2, 4.4);
        busOnly.position.set(-2.3, 0.214, z);
        busOnly.rotation.y = Math.PI; // Readable when looking north or driving south
        lotGroup.add(busOnly);
    }

    // 5. Directional one-way arrows along entry, car lot, bus bypass lane, and south exit
    const arrows = [
        [-6.6, 29, 0.38, 0.95],
        [-3.2, 49, 0.15, 0.95],
        [-0.2, 66, 0.0, 1.0],
        [-0.2, 86, 0.0, 1.0],
        [-0.2, 104, 0.0, 1.0],
        [3.1, 123, 0.0, 0.95],
        [3.1, 140, 0.0, 0.95],
        [3.1, 157, 0.0, 0.95],
        [5.2, 191, -0.18, 0.95],
        [-8.8, 211, -1.05, 0.95]
    ];
    for (const [ax, az, rot, sc] of arrows) {
        const a = makeArrowMesh(paintMat, sc);
        a.position.set(ax, 0.213, az);
        // Base arrow points -z (north); rotate by PI to point +z (southbound through the lot)
        a.rotation.y = Math.PI + rot;
        lotGroup.add(a);
    }

    // Exit stop bar where the loop rejoins southbound S Las Vegas Blvd
    const exitStop = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 4.8).rotateX(-Math.PI / 2), paintMat);
    exitStop.position.set(-12.6, 0.213, 212.8);
    exitStop.rotation.y = 0.42;
    exitStop.renderOrder = ORDER.paint + 2;
    lotGroup.add(exitStop);

    // 6. Signature Palm & Canopy Trees matching Apple Maps Images 1 & 2
    const treeMat = litColor('#ffffff', { vertexColors: true });
    const palmSpots = [
        // Flanking the Welcome sign cleanly behind it (clear of medallions)
        [-4.5, -3.5, 0.96, 0.4],
        [4.5, -3.5, 0.98, 2.2],
        // Mid-lot planter bump-out next to crosswalk (strictly on green planter)
        [6.4, 115.0, 1.0, 1.1],
        // South bus bay planter bump-out
        [6.8, 170.5, 0.98, 3.8],
        // South exit island trees
        [-7.4, 189.0, 0.95, 5.1],
        [-8.4, 221.0, 0.92, 0.8]
    ];
    const canopySpots = [
        // Framing behind & in front of the Welcome sign (clear of sign text)
        [-2.0, -7.2, 1.02, 0.5],
        [0.8, -5.8, 0.92, 1.9],
        [1.4, 13.8, 0.85, 3.1],
        // South bus bay bump-out & south exit island
        [7.6, 173.5, 0.92, 2.4],
        [-7.8, 179.0, 0.95, 4.2],
        [-5.8, 194.5, 1.02, 1.3]
    ];
    const placeInstanced = (geo, spots, name) => {
        const mesh = new THREE.InstancedMesh(geo, treeMat, spots.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        spots.forEach(([x, z, s, yaw], i) => {
            q.setFromAxisAngle(up, yaw);
            sc.set(s, s, s);
            p.set(x, 0.14, z);
            mesh.setMatrixAt(i, m.compose(p, q, sc));
        });
        mesh.computeBoundingSphere();
        mesh.name = name;
        lotGroup.add(mesh);
    };
    placeInstanced(palmGeometry(), palmSpots, 'welcome-palms');
    placeInstanced(makeCanopyGeo(), canopySpots, 'welcome-trees');

    grp.add(lotGroup);

    engine.animate(sign, (f) => {
        const n = theme.uniforms.uNight.value;
        bulbMat.color.setRGB(1, 0.93, 0.62).multiplyScalar(1 + n * (0.95 + 0.45 * Math.sin(f.t * 6)));
        goldStarMat.color.setRGB(1, 0.9, 0.42).multiplyScalar(1 + n * 1.15);
    });
    return grp;
}
