/**
 * Three.js Custom 3D Layer for Las Vegas Strip Landmarks, Hero Resorts & 3D Autonomous Robotaxi
 * Inspired by abrhamhabtu/vegas-strip-v2 — integrates directly into MapLibre GL's WebGL context
 * using MercatorCoordinate so every resort stands on its exact real-world GPS footprint in metres.
 */

const STRIP_ORIGIN_LNG = -115.1728;
const STRIP_ORIGIN_LAT = 36.1147;

/** Convert (lat, lng, altitudeMeters) to local Three.js scene offsets (x East, y Up, z South) in metres */
function latLngToLocalMeters(lat, lng, alt = 0) {
  const earthRadius = 6378137;
  const cosLat = Math.cos((STRIP_ORIGIN_LAT * Math.PI) / 180);
  const dx = ((lng - STRIP_ORIGIN_LNG) * Math.PI / 180) * earthRadius * cosLat;
  const dz = -((lat - STRIP_ORIGIN_LAT) * Math.PI / 180) * earthRadius;
  return new THREE.Vector3(dx, alt, dz);
}

/** Procedural facade canvas texture with lit window bands, pilasters & crown glow */
function createFacadeTexture({
  baseColor = "#1fa36a",
  windowColor = "#a8ffda",
  bandColor = "#3dff9a",
  floors = 32,
  cols = 16,
  style = "bands", // "bands" | "pilasters" | "grid" | "glass"
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Base wall tint
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle vertical gradient (darker at base, brighter near crown)
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "rgba(255,255,255,0.16)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.05)");
  grad.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rowH = canvas.height / floors;
  const colW = canvas.width / cols;

  // Window bands
  for (let r = 1; r < floors - 1; r++) {
    const y = r * rowH;
    if (style === "bands") {
      ctx.fillStyle = windowColor;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(4, y + rowH * 0.2, canvas.width - 8, rowH * 0.55);
      if (r % 6 === 0) {
        ctx.fillStyle = bandColor;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(0, y, canvas.width, 2.5);
      }
    } else if (style === "pilasters") {
      for (let c = 0; c < cols; c++) {
        const lit = ((r * 7 + c * 13) % 5) !== 0;
        ctx.fillStyle = lit ? windowColor : "rgba(0,0,0,0.28)";
        ctx.globalAlpha = lit ? 0.75 : 0.45;
        ctx.fillRect(c * colW + 3, y + 2, colW - 6, rowH - 4);
      }
    } else if (style === "grid") {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 3 === 0 ? bandColor : windowColor;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(c * colW + 2, y + 2, colW - 4, rowH - 3);
      }
    } else {
      // glass curtain wall
      ctx.fillStyle = windowColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(2, y + 1, canvas.width - 4, rowH - 2);
    }
  }

  // Top glowing crown strip
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = bandColor;
  ctx.fillRect(0, 0, canvas.width, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Build a curved arc slab tower (e.g., Wynn, Encore, Bellagio, Resorts World) */
function createArcTower({
  width = 160,
  depth = 26,
  height = 140,
  curveSag = 22,
  crownDip = 0,
  material,
  roofColor = "#6d4d2c",
  trimColor = "#ffc76b",
}) {
  const group = new THREE.Group();
  const segments = 24;
  const segW = width / segments;

  const trimMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    emissive: trimColor,
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.8,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: 0.6,
  });

  for (let i = 0; i < segments; i++) {
    const t = (i + 0.5) / segments - 0.5; // -0.5 .. 0.5
    const x = t * width;
    const z = (t * t * 4 - 0.5) * curveSag;
    const dz = 8 * t * (curveSag / width);
    const angle = Math.atan(dz);

    const localH = height - (1 - 4 * t * t) * crownDip;

    const boxGeo = new THREE.BoxGeometry(segW * 1.06, localH, depth);
    const mesh = new THREE.Mesh(boxGeo, material);
    mesh.position.set(x, localH / 2, z);
    mesh.rotation.y = -angle;
    group.add(mesh);

    // Crown neon rib
    const crownGeo = new THREE.BoxGeometry(segW * 1.08, 3.2, depth + 1.2);
    const crownMesh = new THREE.Mesh(crownGeo, trimMat);
    crownMesh.position.set(x, localH + 1.6, z);
    crownMesh.rotation.y = -angle;
    group.add(crownMesh);

    // Roof cap
    const roofGeo = new THREE.BoxGeometry(segW * 1.02, 1.5, depth * 0.9);
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(x, localH + 3.4, z);
    roofMesh.rotation.y = -angle;
    group.add(roofMesh);
  }

  return group;
}

/** Build a 3-wing Y-shaped resort tower (MGM Grand, Mandalay Bay, Caesars, Venetian) */
function createYTower({
  wingLength = 95,
  wingDepth = 26,
  height = 110,
  wingAngles = [0, 120, 240],
  material,
  crownColor = "#3dff9a",
}) {
  const group = new THREE.Group();
  const crownMat = new THREE.MeshStandardMaterial({
    color: crownColor,
    emissive: crownColor,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.6,
  });

  // Central core hub
  const coreGeo = new THREE.CylinderGeometry(wingDepth * 0.75, wingDepth * 0.75, height + 5, 16);
  const coreMesh = new THREE.Mesh(coreGeo, material);
  coreMesh.position.y = (height + 5) / 2;
  group.add(coreMesh);

  wingAngles.forEach((deg) => {
    const rad = (deg * Math.PI) / 180;
    const pivot = new THREE.Group();
    pivot.rotation.y = rad;

    const wingGeo = new THREE.BoxGeometry(wingLength, height, wingDepth);
    const wing = new THREE.Mesh(wingGeo, material);
    wing.position.set(wingLength / 2 + wingDepth * 0.25, height / 2, 0);
    pivot.add(wing);

    const topNeon = new THREE.Mesh(
      new THREE.BoxGeometry(wingLength + 1, 3.0, wingDepth + 1.2),
      crownMat
    );
    topNeon.position.set(wingLength / 2 + wingDepth * 0.25, height + 1.5, 0);
    pivot.add(topNeon);

    group.add(pivot);
  });

  return group;
}

/** Create the Three.js Custom Layer for MapLibre GL */
window.createVegasThreeLayer = function () {
  let camera, scene, renderer;
  let animatedObjects = [];
  let egoCarGroup = null;
  let clock = new THREE.Clock();

  function buildAllLandmarks() {
    // 1. LUXOR PYRAMID + SKY BEAM + SPHINX (36.0955, -115.1761)
    {
      const luxorGroup = new THREE.Group();
      const pos = latLngToLocalMeters(36.0955, -115.1761, 0);
      luxorGroup.position.copy(pos);

      const pyramidH = 112;
      const pyramidBase = 175;
      const pyrGeo = new THREE.ConeGeometry(pyramidBase * 0.7, pyramidH, 4);
      pyrGeo.rotateY(Math.PI / 4);
      const pyrMat = new THREE.MeshStandardMaterial({
        color: "#141822",
        roughness: 0.15,
        metalness: 0.85,
        emissive: "#22293a",
        emissiveIntensity: 0.25,
      });
      const pyramid = new THREE.Mesh(pyrGeo, pyrMat);
      pyramid.position.y = pyramidH / 2;
      luxorGroup.add(pyramid);

      // Glowing Gold Pyramid Capstone
      const capGeo = new THREE.ConeGeometry(16, 15, 4);
      capGeo.rotateY(Math.PI / 4);
      const capMat = new THREE.MeshBasicMaterial({ color: "#fff4cc" });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = pyramidH - 6;
      luxorGroup.add(cap);

      // Iconic Luxor Sky Beam shooting 850m into the sky
      const beamGeo = new THREE.CylinderGeometry(28, 5, 850, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: "#cfe8ff",
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = pyramidH + 425;
      luxorGroup.add(beam);
      scene.add(luxorGroup);
    }

    // 2. ALLEGIANT STADIUM — Black & Silver Raiders Dome (36.0908, -115.1833)
    {
      const stadiumGroup = new THREE.Group();
      stadiumGroup.position.copy(latLngToLocalMeters(36.0908, -115.1833, 0));

      const bodyGeo = new THREE.CylinderGeometry(145, 130, 52, 40);
      bodyGeo.scale(1.22, 1, 0.95);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: "#111318",
        roughness: 0.2,
        metalness: 0.85,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 26;
      stadiumGroup.add(body);

      // Silver Stadium Rib Ring
      const ringGeo = new THREE.TorusGeometry(142, 4.5, 12, 48);
      ringGeo.rotateX(Math.PI / 2);
      ringGeo.scale(1.22, 0.95, 1);
      const ringMat = new THREE.MeshStandardMaterial({
        color: "#d8dee9",
        emissive: "#d8dee9",
        emissiveIntensity: 0.55,
        metalness: 0.9,
        roughness: 0.2,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 44;
      stadiumGroup.add(ring);

      // Translucent ETFE Roof Dome
      const domeGeo = new THREE.SphereGeometry(138, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.35);
      domeGeo.scale(1.22, 0.45, 0.95);
      const domeMat = new THREE.MeshStandardMaterial({
        color: "#2b303c",
        roughness: 0.3,
        metalness: 0.5,
      });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.y = 32;
      stadiumGroup.add(dome);

      scene.add(stadiumGroup);
    }

    // 3. MANDALAY BAY — Golden Glass Y-Tower (36.0919, -115.1752)
    {
      const mbTex = createFacadeTexture({
        baseColor: "#b88428",
        windowColor: "#ffe299",
        bandColor: "#ffd25a",
        style: "bands",
      });
      const mbMat = new THREE.MeshStandardMaterial({
        map: mbTex,
        roughness: 0.22,
        metalness: 0.75,
      });
      const mbTower = createYTower({
        wingLength: 105,
        wingDepth: 28,
        height: 146,
        wingAngles: [15, 135, 255],
        material: mbMat,
        crownColor: "#ffd25a",
      });
      mbTower.position.copy(latLngToLocalMeters(36.0919, -115.1752, 0));
      scene.add(mbTower);
    }

    // 4. EXCALIBUR — White Castle with Red/Blue Turrets (36.0988, -115.1754)
    {
      const exGroup = new THREE.Group();
      exGroup.position.copy(latLngToLocalMeters(36.0988, -115.1754, 0));

      const wallMat = new THREE.MeshStandardMaterial({ color: "#f5efe6", roughness: 0.5 });
      const redRoofMat = new THREE.MeshStandardMaterial({
        color: "#c41e28",
        emissive: "#c41e28",
        emissiveIntensity: 0.25,
      });
      const blueRoofMat = new THREE.MeshStandardMaterial({
        color: "#1e4fc4",
        emissive: "#1e4fc4",
        emissiveIntensity: 0.25,
      });

      // Two L-shaped hotel wings
      const wing1 = new THREE.Mesh(new THREE.BoxGeometry(115, 72, 24), wallMat);
      wing1.position.set(0, 36, -35);
      exGroup.add(wing1);

      const wing2 = new THREE.Mesh(new THREE.BoxGeometry(24, 72, 115), wallMat);
      wing2.position.set(-45, 36, 15);
      exGroup.add(wing2);

      // Castle Turret Spires in front
      const turretOffsets = [
        [25, -10, redRoofMat, 78],
        [42, 8, blueRoofMat, 65],
        [10, 15, blueRoofMat, 68],
        [28, 25, redRoofMat, 85],
      ];
      turretOffsets.forEach(([tx, tz, rMat, th]) => {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.5, th, 16), wallMat);
        cyl.position.set(tx, th / 2, tz);
        exGroup.add(cyl);

        const spire = new THREE.Mesh(new THREE.ConeGeometry(10.5, 26, 16), rMat);
        spire.position.set(tx, th + 13, tz);
        exGroup.add(spire);
      });

      scene.add(exGroup);
    }

    // 5. MGM GRAND — Signature Emerald Green 3-Wing Tower (36.1024, -115.1699)
    {
      const mgmTex = createFacadeTexture({
        baseColor: "#148554",
        windowColor: "#7bffc3",
        bandColor: "#3dff9a",
        style: "bands",
      });
      const mgmMat = new THREE.MeshStandardMaterial({
        map: mgmTex,
        roughness: 0.25,
        metalness: 0.65,
      });
      const mgmTower = createYTower({
        wingLength: 120,
        wingDepth: 30,
        height: 118,
        wingAngles: [0, 95, 195],
        material: mgmMat,
        crownColor: "#3dff9a",
      });
      mgmTower.position.copy(latLngToLocalMeters(36.1024, -115.1699, 0));
      scene.add(mgmTower);
    }

    // 6. NEW YORK-NEW YORK — Clustered Manhattan Skyline + Statue of Liberty (36.1024, -115.1745)
    {
      const nyGroup = new THREE.Group();
      nyGroup.position.copy(latLngToLocalMeters(36.1024, -115.1745, 0));

      const towers = [
        { x: 0, z: 0, w: 32, d: 32, h: 155, color: "#dfd3be", spire: 32 }, // Empire State
        { x: -34, z: 18, w: 26, d: 26, h: 125, color: "#c78363", spire: 20 }, // Chrysler
        { x: 32, z: -22, w: 28, d: 28, h: 110, color: "#7f9894", spire: 0 },
        { x: -24, z: -28, w: 25, d: 25, h: 96, color: "#b56348", spire: 0 },
        { x: 24, z: 26, w: 26, d: 24, h: 102, color: "#8d99a6", spire: 0 },
      ];

      towers.forEach((t) => {
        const tex = createFacadeTexture({
          baseColor: t.color,
          windowColor: "#ffe5b4",
          bandColor: "#ffd27d",
          style: "pilasters",
        });
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), mat);
        mesh.position.set(t.x, t.h / 2, t.z);
        nyGroup.add(mesh);

        if (t.spire > 0) {
          const spireMat = new THREE.MeshStandardMaterial({
            color: "#e6eef8",
            emissive: "#ffe2a8",
            emissiveIntensity: 0.5,
            metalness: 0.8,
          });
          const spire = new THREE.Mesh(new THREE.ConeGeometry(t.w * 0.28, t.spire, 8), spireMat);
          spire.position.set(t.x, t.h + t.spire / 2, t.z);
          nyGroup.add(spire);
        }
      });

      // Statue of Liberty at Tropicana & LV Blvd corner
      const libMat = new THREE.MeshStandardMaterial({
        color: "#6dbf9e",
        emissive: "#4ca886",
        emissiveIntensity: 0.35,
      });
      const ped = new THREE.Mesh(
        new THREE.BoxGeometry(14, 22, 14),
        new THREE.MeshStandardMaterial({ color: "#cbbba0" })
      );
      ped.position.set(58, 11, 48);
      nyGroup.add(ped);
      const statue = new THREE.Mesh(new THREE.ConeGeometry(6, 28, 12), libMat);
      statue.position.set(58, 36, 48);
      nyGroup.add(statue);

      scene.add(nyGroup);
    }

    // 7. ARIA & THE COSMOPOLITAN — Crystalline Blue Glass Towers (36.1072 & 36.1098)
    {
      const ariaTex = createFacadeTexture({
        baseColor: "#5b86b5",
        windowColor: "#cfe6ff",
        bandColor: "#8ec5ff",
        style: "glass",
      });
      const ariaMat = new THREE.MeshStandardMaterial({
        map: ariaTex,
        roughness: 0.18,
        metalness: 0.82,
      });
      const ariaTower = createArcTower({
        width: 155,
        depth: 26,
        height: 175,
        curveSag: 26,
        material: ariaMat,
        roofColor: "#2c4666",
        trimColor: "#9fd0ff",
      });
      ariaTower.position.copy(latLngToLocalMeters(36.1072, -115.1766, 0));
      ariaTower.rotation.y = 0.4;
      scene.add(ariaTower);

      // Cosmopolitan Twin Blue Glass Towers
      const cosmoGroup = new THREE.Group();
      cosmoGroup.position.copy(latLngToLocalMeters(36.1098, -115.1739, 0));
      const cosmoTex = createFacadeTexture({
        baseColor: "#3c5882",
        windowColor: "#b8d4ff",
        bandColor: "#6ea8ff",
        style: "grid",
      });
      const cosmoMat = new THREE.MeshStandardMaterial({
        map: cosmoTex,
        roughness: 0.2,
        metalness: 0.8,
      });
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(75, 180, 26), cosmoMat);
      t1.position.set(25, 90, 0);
      cosmoGroup.add(t1);
      const t2 = new THREE.Mesh(new THREE.BoxGeometry(75, 180, 26), cosmoMat);
      t2.position.set(-45, 90, 12);
      cosmoGroup.add(t2);
      scene.add(cosmoGroup);
    }

    // 8. BELLAGIO — Italian Cream Tower + Animated Fountains Lake (36.1127, -115.1743)
    {
      const belTex = createFacadeTexture({
        baseColor: "#ead7b7",
        windowColor: "#fff0d1",
        bandColor: "#ffd9a0",
        style: "pilasters",
      });
      const belMat = new THREE.MeshStandardMaterial({ map: belTex, roughness: 0.35 });
      const belTower = createArcTower({
        width: 195,
        depth: 28,
        height: 151,
        curveSag: 30,
        material: belMat,
        roofColor: "#b87a4b",
        trimColor: "#ffd9a0",
      });
      belTower.position.copy(latLngToLocalMeters(36.1127, -115.1765, 0));
      belTower.rotation.y = Math.PI / 2;
      scene.add(belTower);

      // Bellagio Lake & Animated Water Fountain Jets (36.1127, -115.1740)
      const lakeGroup = new THREE.Group();
      lakeGroup.position.copy(latLngToLocalMeters(36.1127, -115.1740, 0.5));
      const lakeGeo = new THREE.CylinderGeometry(85, 85, 1.2, 36);
      lakeGeo.scale(0.65, 1, 1.85);
      const lakeMat = new THREE.MeshStandardMaterial({
        color: "#0e4d78",
        emissive: "#16689e",
        emissiveIntensity: 0.35,
        roughness: 0.1,
        metalness: 0.6,
      });
      lakeGroup.add(new THREE.Mesh(lakeGeo, lakeMat));

      const jetMat = new THREE.MeshBasicMaterial({
        color: "#e6f7ff",
        transparent: true,
        opacity: 0.85,
      });
      const jets = [];
      for (let j = -7; j <= 7; j++) {
        const jetGeo = new THREE.ConeGeometry(2.6, 55, 8);
        const jet = new THREE.Mesh(jetGeo, jetMat);
        jet.position.set(Math.sin(j * 0.3) * 10, 27, j * 14);
        lakeGroup.add(jet);
        jets.push({ mesh: jet, phase: j * 0.55 });
      }
      scene.add(lakeGroup);

      animatedObjects.push((time) => {
        jets.forEach((j) => {
          const s = 0.35 + 0.85 * Math.abs(Math.sin(time * 2.4 + j.phase));
          j.mesh.scale.y = s;
          j.mesh.position.y = (55 * s) / 2;
        });
      });
    }

    // 9. PARIS LAS VEGAS — Half-Scale Eiffel Tower + Glowing Balloon (36.1125, -115.1722)
    {
      const parisGroup = new THREE.Group();
      parisGroup.position.copy(latLngToLocalMeters(36.1125, -115.1722, 0));

      const bronzeMat = new THREE.MeshStandardMaterial({
        color: "#b89058",
        emissive: "#ffd591",
        emissiveIntensity: 0.45,
        metalness: 0.75,
        roughness: 0.3,
        wireframe: false,
      });

      // Lower, middle, upper tapered Eiffel Lattice sections (165m total)
      const sec1 = new THREE.Mesh(new THREE.CylinderGeometry(14, 28, 52, 4, 1), bronzeMat);
      sec1.rotation.y = Math.PI / 4;
      sec1.position.y = 26;
      parisGroup.add(sec1);

      const sec2 = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 14, 52, 4, 1), bronzeMat);
      sec2.rotation.y = Math.PI / 4;
      sec2.position.y = 78;
      parisGroup.add(sec2);

      const sec3 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 7.5, 55, 4, 1), bronzeMat);
      sec3.rotation.y = Math.PI / 4;
      sec3.position.y = 131;
      parisGroup.add(sec3);

      // Paris Hotel Building with Blue Mansard Roof
      const hotelTex = createFacadeTexture({
        baseColor: "#ebd7b5",
        windowColor: "#ffe9bf",
        bandColor: "#4f78d8",
        style: "pilasters",
      });
      const hotel = createYTower({
        wingLength: 85,
        wingDepth: 24,
        height: 105,
        wingAngles: [0, 120, 240],
        material: new THREE.MeshStandardMaterial({ map: hotelTex, roughness: 0.4 }),
        crownColor: "#4f78d8",
      });
      hotel.position.set(70, 0, 10);
      parisGroup.add(hotel);

      // Glowing Paris Montgolfier Hot Air Balloon sign
      const balloonMat = new THREE.MeshStandardMaterial({
        color: "#ff5c77",
        emissive: "#ff9e44",
        emissiveIntensity: 0.85,
      });
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 20), balloonMat);
      balloon.scale.set(1, 1.3, 1);
      balloon.position.set(-22, 48, -18);
      parisGroup.add(balloon);

      scene.add(parisGroup);
    }

    // 10. CAESARS PALACE — Classical Roman White/Gold Columns (36.1162, -115.1745)
    {
      const cpTex = createFacadeTexture({
        baseColor: "#f4efe4",
        windowColor: "#fff1d6",
        bandColor: "#e6c167",
        style: "pilasters",
      });
      const cpMat = new THREE.MeshStandardMaterial({ map: cpTex, roughness: 0.35 });
      const cpGroup = new THREE.Group();
      cpGroup.position.copy(latLngToLocalMeters(36.1162, -115.1755, 0));

      const palaceTower = new THREE.Mesh(new THREE.BoxGeometry(88, 132, 28), cpMat);
      palaceTower.position.set(0, 66, 0);
      cpGroup.add(palaceTower);

      const augustusTower = new THREE.Mesh(new THREE.BoxGeometry(92, 140, 26), cpMat);
      augustusTower.position.set(35, 70, 58);
      cpGroup.add(augustusTower);

      scene.add(cpGroup);
    }

    // 11. THE HIGH ROLLER — Animated 167m Illuminated Observation Wheel (36.1177, -115.1681)
    {
      const hrGroup = new THREE.Group();
      hrGroup.position.copy(latLngToLocalMeters(36.1177, -115.1681, 0));

      const wheelRadius = 76;
      const centerH = 90;

      // Support legs
      const legMat = new THREE.MeshStandardMaterial({ color: "#d8dee9", metalness: 0.8 });
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 4, 105, 12), legMat);
      leg1.position.set(0, 48, -22);
      leg1.rotation.x = 0.22;
      hrGroup.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 4, 105, 12), legMat);
      leg2.position.set(0, 48, 22);
      leg2.rotation.x = -0.22;
      hrGroup.add(leg2);

      // Rotating Neon Rim + 28 Passenger Pods
      const wheelPivot = new THREE.Group();
      wheelPivot.position.y = centerH;

      const rimMat = new THREE.MeshStandardMaterial({
        color: "#ff2ae2",
        emissive: "#00e5ff",
        emissiveIntensity: 0.95,
      });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 2.8, 16, 64), rimMat);
      rim.rotation.y = Math.PI / 2;
      wheelPivot.add(rim);

      const podMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
      for (let p = 0; p < 24; p++) {
        const ang = (p / 24) * Math.PI * 2;
        const pod = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 10), podMat);
        pod.position.set(0, Math.sin(ang) * (wheelRadius + 3.5), Math.cos(ang) * (wheelRadius + 3.5));
        wheelPivot.add(pod);
      }

      hrGroup.add(wheelPivot);
      scene.add(hrGroup);

      animatedObjects.push((time) => {
        wheelPivot.rotation.x = time * 0.25;
        rimMat.emissive.setHSL((time * 0.08) % 1.0, 0.9, 0.55);
      });
    }

    // 12. THE VENETIAN & PALAZZO + CAMPANILE TOWER (36.1212, -115.1697)
    {
      const venTex = createFacadeTexture({
        baseColor: "#eddcc0",
        windowColor: "#ffe5ba",
        bandColor: "#d99b52",
        style: "pilasters",
      });
      const venMat = new THREE.MeshStandardMaterial({ map: venTex, roughness: 0.35 });
      const venTower = createYTower({
        wingLength: 110,
        wingDepth: 28,
        height: 145,
        wingAngles: [20, 140, 260],
        material: venMat,
        crownColor: "#ffdca6",
      });
      venTower.position.copy(latLngToLocalMeters(36.1212, -115.1697, 0));
      scene.add(venTower);

      // St. Mark's Campanile Bell Tower in front of Venetian
      const campGroup = new THREE.Group();
      campGroup.position.copy(latLngToLocalMeters(36.1214, -115.1715, 0));
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(12, 78, 12),
        new THREE.MeshStandardMaterial({ color: "#c97a53" })
      );
      shaft.position.y = 39;
      campGroup.add(shaft);
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(9, 24, 4),
        new THREE.MeshStandardMaterial({ color: "#4aa382" })
      );
      spire.rotation.y = Math.PI / 4;
      spire.position.y = 90;
      campGroup.add(spire);
      scene.add(campGroup);
    }

    // 13. THE SPHERE — Animated 112m x 157m Exosphere LED Dome (36.1213, -115.1620)
    {
      const sphereGroup = new THREE.Group();
      sphereGroup.position.copy(latLngToLocalMeters(36.1213, -115.1620, 0));

      // Create dynamic LED canvas texture for the Sphere Exosphere
      const sCanvas = document.createElement("canvas");
      sCanvas.width = 256;
      sCanvas.height = 128;
      const sCtx = sCanvas.getContext("2d");
      const sphereTex = new THREE.CanvasTexture(sCanvas);

      const sphereRadius = 78;
      const sphereGeo = new THREE.SphereGeometry(
        sphereRadius,
        48,
        32,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.78
      );
      const sphereMat = new THREE.MeshStandardMaterial({
        map: sphereTex,
        emissiveMap: sphereTex,
        emissive: "#ffffff",
        emissiveIntensity: 0.95,
        roughness: 0.2,
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.y = 38;
      sphereGroup.add(sphereMesh);
      scene.add(sphereGroup);

      animatedObjects.push((time) => {
        // Animate swirling plasma / LED bands across The Sphere
        const hue1 = Math.floor(((time * 28) % 360));
        const hue2 = (hue1 + 110) % 360;
        const hue3 = (hue1 + 220) % 360;
        const grad = sCtx.createLinearGradient(0, 0, sCanvas.width, sCanvas.height);
        grad.addColorStop(0, `hsl(${hue1}, 95%, 55%)`);
        grad.addColorStop(0.5, `hsl(${hue2}, 95%, 50%)`);
        grad.addColorStop(1, `hsl(${hue3}, 95%, 55%)`);
        sCtx.fillStyle = grad;
        sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);

        // Glowing latitude rings
        sCtx.fillStyle = "rgba(255,255,255,0.65)";
        for (let r = 0; r < 6; r++) {
          const ry = ((time * 40 + r * 22) % sCanvas.height);
          sCtx.fillRect(0, ry, sCanvas.width, 4);
        }
        sphereTex.needsUpdate = true;
        sphereMesh.rotation.y = time * 0.35;
      });
    }

    // 14. HARD ROCK GUITAR HOTEL — Iconic Neon Guitar Tower (36.1212, -115.1741)
    {
      const guitarGroup = new THREE.Group();
      guitarGroup.position.copy(latLngToLocalMeters(36.1212, -115.1741, 0));

      const gMat = new THREE.MeshStandardMaterial({
        color: "#1b5699",
        emissive: "#00c8ff",
        emissiveIntensity: 0.45,
        metalness: 0.85,
        roughness: 0.15,
      });

      // Lower & upper guitar body bouts
      const lowerBout = new THREE.Mesh(new THREE.CylinderGeometry(42, 46, 55, 24), gMat);
      lowerBout.scale.set(1.25, 1, 0.55);
      lowerBout.position.y = 27.5;
      guitarGroup.add(lowerBout);

      const upperBout = new THREE.Mesh(new THREE.CylinderGeometry(34, 30, 48, 24), gMat);
      upperBout.scale.set(1.2, 1, 0.55);
      upperBout.position.y = 75;
      guitarGroup.add(upperBout);

      // Guitar neck & glowing strings rising to 200m
      const neck = new THREE.Mesh(new THREE.BoxGeometry(16, 95, 14), gMat);
      neck.position.y = 145;
      guitarGroup.add(neck);

      // 6 Illuminated Guitar Strings + Sky Beams
      const stringMat = new THREE.MeshBasicMaterial({ color: "#ffd700" });
      for (let s = -2.5; s <= 2.5; s++) {
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 240, 6), stringMat);
        str.position.set(s * 2.2, 120, 8.5);
        guitarGroup.add(str);
      }

      scene.add(guitarGroup);
    }

    // 15. WYNN & ENCORE — Signature Bronze Curved Arcs with Gold Crowns (36.1265 & 36.1292)
    {
      const wynnTex = createFacadeTexture({
        baseColor: "#8f5b29",
        windowColor: "#ffd18a",
        bandColor: "#ffc76b",
        style: "bands",
      });
      const wynnMat = new THREE.MeshStandardMaterial({
        map: wynnTex,
        roughness: 0.18,
        metalness: 0.82,
      });

      const wynnArc = createArcTower({
        width: 185,
        depth: 26,
        height: 187,
        curveSag: 34,
        crownDip: 14,
        material: wynnMat,
        roofColor: "#5c3b1c",
        trimColor: "#ffc76b",
      });
      wynnArc.position.copy(latLngToLocalMeters(36.1265, -115.1657, 0));
      wynnArc.rotation.y = 0.65;
      scene.add(wynnArc);

      const encoreArc = createArcTower({
        width: 170,
        depth: 26,
        height: 192,
        curveSag: 30,
        crownDip: 12,
        material: wynnMat,
        roofColor: "#5c3b1c",
        trimColor: "#ffc76b",
      });
      encoreArc.position.copy(latLngToLocalMeters(36.1292, -115.1653, 0));
      encoreArc.rotation.y = 0.45;
      scene.add(encoreArc);
    }

    // 16. TRUMP INTERNATIONAL — Reflective Gold Glass Tower (36.1295, -115.1727)
    {
      const trumpTex = createFacadeTexture({
        baseColor: "#cfa23c",
        windowColor: "#fff0a8",
        bandColor: "#ffe066",
        style: "bands",
      });
      const trumpMat = new THREE.MeshStandardMaterial({
        map: trumpTex,
        roughness: 0.15,
        metalness: 0.9,
      });
      const trumpTower = new THREE.Mesh(new THREE.BoxGeometry(78, 190, 26), trumpMat);
      trumpTower.position.copy(latLngToLocalMeters(36.1295, -115.1727, 95));
      scene.add(trumpTower);
    }

    // 17. RESORTS WORLD — Crimson Red Curved LED Towers (36.1345, -115.1691)
    {
      const rwTex = createFacadeTexture({
        baseColor: "#a81d3d",
        windowColor: "#ff8da3",
        bandColor: "#ff335c",
        style: "grid",
      });
      const rwMat = new THREE.MeshStandardMaterial({
        map: rwTex,
        roughness: 0.22,
        metalness: 0.72,
      });
      const rwTower = createArcTower({
        width: 195,
        depth: 28,
        height: 204,
        curveSag: 32,
        material: rwMat,
        roofColor: "#6e1328",
        trimColor: "#ff335c",
      });
      rwTower.position.copy(latLngToLocalMeters(36.1345, -115.1691, 0));
      rwTower.rotation.y = -0.5;
      scene.add(rwTower);
    }

    // 18. FONTAINEBLEAU — Tall Sapphire Blue Glass Tower (36.1362, -115.1628)
    {
      const fbTex = createFacadeTexture({
        baseColor: "#1f58b8",
        windowColor: "#9ec5ff",
        bandColor: "#5ea0ff",
        style: "glass",
      });
      const fbMat = new THREE.MeshStandardMaterial({
        map: fbTex,
        roughness: 0.16,
        metalness: 0.85,
      });
      const fbTower = createArcTower({
        width: 165,
        depth: 28,
        height: 224,
        curveSag: 18,
        material: fbMat,
        roofColor: "#143875",
        trimColor: "#7fb4ff",
      });
      fbTower.position.copy(latLngToLocalMeters(36.1362, -115.1628, 0));
      fbTower.rotation.y = 0.35;
      scene.add(fbTower);
    }

    // 19. THE STRAT OBSERVATION TOWER — 350m Needle & Pod (36.1475, -115.1566)
    {
      const stratGroup = new THREE.Group();
      stratGroup.position.copy(latLngToLocalMeters(36.1475, -115.1566, 0));

      const concreteMat = new THREE.MeshStandardMaterial({ color: "#e3e7f0", roughness: 0.4 });
      const podMat = new THREE.MeshStandardMaterial({
        color: "#293242",
        emissive: "#ff4444",
        emissiveIntensity: 0.35,
        metalness: 0.7,
      });

      // Tapered tripod shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(8, 22, 245, 16), concreteMat);
      shaft.position.y = 122.5;
      stratGroup.add(shaft);

      // Observation Pod
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(24, 14, 34, 24), podMat);
      pod.position.y = 258;
      stratGroup.add(pod);

      // High-altitude needle mast (to 350m)
      const needle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 2.5, 75, 8),
        new THREE.MeshBasicMaterial({ color: "#ff3b3b" })
      );
      needle.position.y = 312;
      stratGroup.add(needle);

      scene.add(stratGroup);
    }

    // 20. FREMONT STREET EXPERIENCE — Illuminated Viva Vision Canopy (36.1707, -115.1439)
    {
      const fremontGroup = new THREE.Group();
      fremontGroup.position.copy(latLngToLocalMeters(36.1707, -115.1439, 0));
      fremontGroup.rotation.y = -0.46;

      const canopyGeo = new THREE.CylinderGeometry(16, 16, 420, 16, 1, true, 0, Math.PI);
      canopyGeo.rotateZ(Math.PI / 2);
      const canopyMat = new THREE.MeshBasicMaterial({
        color: "#ff6b00",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.y = 26;
      fremontGroup.add(canopy);
      scene.add(fremontGroup);

      animatedObjects.push((time) => {
        canopyMat.color.setHSL(((time * 0.12) + 0.08) % 1.0, 0.95, 0.55);
      });
    }

    // 21. WELCOME TO FABULOUS LAS VEGAS SIGN (36.0820, -115.1728)
    {
      const signGroup = new THREE.Group();
      signGroup.position.copy(latLngToLocalMeters(36.0820, -115.1728, 0));

      const poleMat = new THREE.MeshStandardMaterial({ color: "#e5e9f0", metalness: 0.8 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 18, 12), poleMat);
      pole.position.y = 9;
      signGroup.add(pole);

      const diamondGeo = new THREE.BoxGeometry(12, 12, 2.2);
      diamondGeo.rotateZ(Math.PI / 4);
      const diamondMat = new THREE.MeshStandardMaterial({
        color: "#ff2a4b",
        emissive: "#ffbf00",
        emissiveIntensity: 0.9,
      });
      const diamond = new THREE.Mesh(diamondGeo, diamondMat);
      diamond.position.y = 14;
      signGroup.add(diamond);

      scene.add(signGroup);
    }

    // 22. 3D AUTONOMOUS ROBOTAXI EGO VEHICLE (Waymo / Cybercab 3D Model with LiDAR & Headlight Cone)
    {
      egoCarGroup = new THREE.Group();

      // Sleek AV Chassis
      const bodyMat = new THREE.MeshStandardMaterial({
        color: "#f5f7fa",
        emissive: "#34a853",
        emissiveIntensity: 0.35,
        metalness: 0.6,
        roughness: 0.2,
      });
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.2, 18), bodyMat);
      chassis.position.y = 2.6;
      egoCarGroup.add(chassis);

      // Cabin greenhouse
      const glassMat = new THREE.MeshStandardMaterial({
        color: "#111827",
        metalness: 0.9,
        roughness: 0.1,
      });
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.2, 10.5), glassMat);
      cabin.position.set(0, 5.5, -1);
      egoCarGroup.add(cabin);

      // Spinning Green LiDAR Puck on Roof
      const lidarMat = new THREE.MeshBasicMaterial({ color: "#00ff88" });
      const lidar = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 1.6, 16), lidarMat);
      lidar.position.set(0, 7.8, 0);
      egoCarGroup.add(lidar);

      // LiDAR Perception Ring on Ground
      const ringGeo = new THREE.RingGeometry(13, 15.5, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: "#00ff88",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.8;
      egoCarGroup.add(ring);

      scene.add(egoCarGroup);
    }
  }

  const customLayer = {
    id: "vegas-threejs-landmarks",
    type: "custom",
    renderingMode: "3d",

    onAdd: function (map, gl) {
      this.map = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Warm Las Vegas Sunlight + Neon Night Fill Lights
      const ambientLight = new THREE.AmbientLight(0xffeedd, 1.25);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xfff2dc, 1.45);
      dirLight1.position.set(200, 500, 300);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x88b4ff, 0.85);
      dirLight2.position.set(-300, 350, -250);
      scene.add(dirLight2);

      buildAllLandmarks();

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },

    updateEgoVehiclePose: function (lat, lng, headingDeg) {
      if (!egoCarGroup) return;
      const pos = latLngToLocalMeters(lat, lng, 0);
      egoCarGroup.position.copy(pos);
      // Local +Z is South, -Z is North; heading 0° = North (-Z)
      const rad = (headingDeg * Math.PI) / 180;
      egoCarGroup.rotation.y = Math.PI - rad;
    },

    render: function (gl, matrix) {
      const elapsed = clock.getElapsedTime();
      for (let i = 0; i < animatedObjects.length; i++) {
        animatedObjects[i](elapsed);
      }

      const modelOrigin = maplibregl.MercatorCoordinate.fromLngLat(
        [STRIP_ORIGIN_LNG, STRIP_ORIGIN_LAT],
        0
      );
      const scale = modelOrigin.meterInMercatorCoordinateUnits();

      const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4()
        .makeTranslation(modelOrigin.x, modelOrigin.y, modelOrigin.z)
        .scale(new THREE.Vector3(scale, -scale, scale))
        .multiply(rotationX);

      camera.projectionMatrix = m.multiply(l);
      renderer.resetState();
      renderer.render(scene, camera);
      this.map.triggerRepaint();
    },
  };

  return customLayer;
};
