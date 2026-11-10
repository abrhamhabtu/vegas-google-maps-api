/**
 * Las Vegas Strip — Google Maps Carbon Copy (High-DPI Lane-Level Street Tiles + Three.js 3D Resorts + Multi-Lane AV Fleet)
 *
 * Uses Google Maps Retina Road Tiles (`mt0..3.google.com/vt/lyrs=m&hl=en&scale=2` up to zoom 22) as the primary ground
 * layer so every individual dashed lane line, turn pocket arrow, crosswalk zebra stripe, median, and POI icon matches
 * Google Maps 1:1 (including `S Las Vegas Blvd`, `Bruno Mars Dr`, and `MGM Rd`).
 */

const MGM_BRUNO_MARS_INTERSECTION = { lat: 36.10305, lng: -115.17275 }; // Exact view from the user's Google Maps screenshot
const VEGAS_STRIP_CENTER = { lat: 36.1127, lng: -115.1735 };

const PRESET_ROUTES = {
  "full-strip": {
    name: "S Las Vegas Blvd Northbound (Welcome Sign → MGM → Bellagio → Wynn)",
    waypoints: [
      { lat: 36.0820, lng: -115.1728 },
      { lat: 36.0919, lng: -115.1731 },
      { lat: 36.1015, lng: -115.1726 },
      { lat: 36.1031, lng: -115.1726 }, // MGM Rd / Bruno Mars Dr Northbound carriageway
      { lat: 36.1088, lng: -115.1727 },
      { lat: 36.1147, lng: -115.1726 },
      { lat: 36.1212, lng: -115.1695 },
      { lat: 36.1265, lng: -115.1656 },
      { lat: 36.1310, lng: -115.1635 },
    ],
  },
  "strip-southbound": {
    name: "S Las Vegas Blvd Southbound (Wynn → Bellagio → MGM → Mandalay Bay)",
    waypoints: [
      { lat: 36.1310, lng: -115.1639 },
      { lat: 36.1265, lng: -115.1660 },
      { lat: 36.1147, lng: -115.1730 },
      { lat: 36.1031, lng: -115.1729 }, // MGM Rd / Bruno Mars Dr Southbound carriageway
      { lat: 36.0919, lng: -115.1734 },
    ],
  },
  "mgm-bruno-loop": {
    name: "MGM Rd ↔ Bruno Mars Dr ↔ S Las Vegas Blvd Turn Lanes",
    waypoints: [
      { lat: 36.10302, lng: -115.17435 }, // Bruno Mars Dr Eastbound approach
      { lat: 36.10308, lng: -115.17275 }, // Intersection at S Las Vegas Blvd & MGM Rd
      { lat: 36.10550, lng: -115.17265 }, // Northbound S Las Vegas Blvd
      { lat: 36.10150, lng: -115.17290 }, // Southbound S Las Vegas Blvd
    ],
  },
  "sphere-loop": {
    name: "Center Strip → The Sphere → Bellagio Loop",
    waypoints: [
      { lat: 36.1127, lng: -115.1728 },
      { lat: 36.1238, lng: -115.1686 },
      { lat: 36.1213, lng: -115.1605 },
      { lat: 36.1145, lng: -115.1642 },
      { lat: 36.1127, lng: -115.1728 },
    ],
  },
};

const LANDMARKS = [
  { name: "Welcome Sign", lat: 36.0820, lng: -115.1728, category: "Landmark", color: "#ffbf00" },
  { name: "Mandalay Bay", lat: 36.0919, lng: -115.1752, category: "Resort", color: "#ffd25a" },
  { name: "Allegiant Stadium", lat: 36.0908, lng: -115.1833, category: "Stadium", color: "#d8dee9" },
  { name: "Luxor Pyramid", lat: 36.0955, lng: -115.1761, category: "Resort", color: "#9fd8ff" },
  { name: "Excalibur", lat: 36.0988, lng: -115.1754, category: "Resort", color: "#ff6b6b" },
  { name: "MGM Grand", lat: 36.1024, lng: -115.1699, category: "Resort", color: "#3dff9a" },
  { name: "New York-New York", lat: 36.1024, lng: -115.1745, category: "Resort", color: "#ffd27d" },
  { name: "T-Mobile Arena", lat: 36.1028, lng: -115.1784, category: "Arena", color: "#ff4fa3" },
  { name: "Aria Resort", lat: 36.1072, lng: -115.1766, category: "Resort", color: "#8ec5ff" },
  { name: "The Cosmopolitan", lat: 36.1098, lng: -115.1739, category: "Resort", color: "#6ea8ff" },
  { name: "Bellagio Fountains", lat: 36.1127, lng: -115.1743, category: "Landmark", color: "#ffd9a0" },
  { name: "Paris & Eiffel Tower", lat: 36.1125, lng: -115.1722, category: "Resort", color: "#ff9e44" },
  { name: "Caesars Palace", lat: 36.1162, lng: -115.1745, category: "Resort", color: "#fff1d6" },
  { name: "High Roller Wheel", lat: 36.1177, lng: -115.1681, category: "Landmark", color: "#ff2ae2" },
  { name: "Hard Rock Guitar", lat: 36.121145, lng: -115.172991, category: "Resort", color: "#00c8ff" },
  { name: "The Venetian", lat: 36.1212, lng: -115.1697, category: "Resort", color: "#ffdca6" },
  { name: "The Sphere", lat: 36.1213, lng: -115.1620, category: "Venue", color: "#ff3d6e" },
  { name: "Wynn Las Vegas", lat: 36.1265, lng: -115.1657, category: "Resort", color: "#ffc76b" },
  { name: "Trump Tower", lat: 36.1295, lng: -115.1727, category: "Resort", color: "#ffe066" },
  { name: "Resorts World", lat: 36.13477, lng: -115.16621, category: "Resort", color: "#ff335c" },
  { name: "Fontainebleau", lat: 36.1362, lng: -115.1628, category: "Resort", color: "#5ea0ff" },
  { name: "The STRAT Tower", lat: 36.1475, lng: -115.1566, category: "Landmark", color: "#ff5c5c" },
  { name: "Fremont St Canopy", lat: 36.1707, lng: -115.1439, category: "Downtown", color: "#ff8800" },
];

let glMap = null;
let threeStripLayer = null;
let landmarkDomMarkers = [];
let glEgoMarker = null;
let glEgoInnerEl = null;
let companionMarkers = []; // Companion AV fleet markers driving in adjacent lanes
let is3DView = true;
let show3DBuildings = true;
let isSatelliteView = false; // Default to Google Maps Road & Lane tiles (`lyrs=m&scale=2`) so all lanes & turn arrows are crystal clear!
let isTrafficVisible = false; // Default off so traffic bars don't cover dashed lane dividers

// AV Simulation State
let routePoints = []; // [{lat, lng, distMiles, heading}]
let totalRouteMiles = 0;
let simRunning = false;
let simProgressMiles = 0;
let simAnimationFrame = null;
let lastFrameTime = 0;
let speedMultiplier = 1;
let selectedLaneIndex = 0; // -1 = left lane (-3.5m), 0 = center lane (0m), +1 = right lane (+3.5m)
const BASE_AV_SPEED_MPH = 28.0;

function getApiKey() {
  if (
    window.VEGAS_MAP_CONFIG &&
    window.VEGAS_MAP_CONFIG.GOOGLE_MAPS_API_KEY &&
    window.VEGAS_MAP_CONFIG.GOOGLE_MAPS_API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY_HERE"
  ) {
    return window.VEGAS_MAP_CONFIG.GOOGLE_MAPS_API_KEY;
  }
  return localStorage.getItem("VEGAS_GOOGLE_MAPS_API_KEY") || "";
}

function initApp() {
  setupUIHandlers();
  initWebGLVegasMap();
  window.setupMapChrome({ getMap: () => glMap, getLayer: () => threeStripLayer });
}

function initWebGLVegasMap() {
  // Open on the central Strip; Street lanes still jumps to the original MGM intersection.
  glMap = new maplibregl.Map({
    container: "map-gl",
    style: { version: 8, sources: {}, layers: [{ id: 'map-background', type: 'background', paint: { 'background-color': '#dce4e6' } }] },
    attributionControl: { compact: true, customAttribution: '3D data © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' },
    center: [-115.1744, 36.1128],
    zoom: 16.3,
    pitch: 55,
    bearing: -12,
    maxZoom: 23.5,
    antialias: true,
    maxPitch: 82,
    transformCameraUpdate: () => ({ elevation: threeStripLayer?.getFollowElevation?.() || 0 }),
  });

  // Navigation lives in the compact camera dock; keep map attribution unobstructed.
  // Gesture tilt must update the same mode state used by the AV follow camera.
  glMap.on('pitchend', () => {
    const tilted = glMap.getPitch() > 10;
    if (is3DView === tilted) return;
    is3DView = tilted;
    set3DBuildingsVisibility(tilted);
    document.getElementById('mode-3d-btn').classList.toggle('active', tilted);
    document.getElementById('mode-lanes-btn').classList.toggle('active', !tilted);
  });

  glMap.on("load", () => {
    // Google raster layers are the only ground map. Buildings come from the
    // consolidated footprint snapshot, so no streamed vector masses can duplicate them.
    // Add Google Maps High-DPI Retina Street & Lane Tiles (`lyrs=m&scale=2` up to zoom 22)
    // This renders the exact grey-blue streets, dashed lane lines, turn-lane arrows, crosswalks, and POI icons from Google Maps!
    glMap.addSource("google-roadmap-lanes", {
      type: "raster",
      tiles: [
        "https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}&scale=2",
        "https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}&scale=2",
        "https://mt2.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}&scale=2",
        "https://mt3.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}&scale=2",
      ],
      tileSize: 256,
      maxzoom: 22,
      attribution: "Map data ©2026 Google",
    });

    // 3. Add Google Maps Satellite Hybrid (`lyrs=y&scale=2`) & Live Traffic (`lyrs=h,traffic`)
    glMap.addSource("google-satellite", {
      type: "raster",
      attribution: "Map imagery ©2026 Google",
      tiles: [
        "https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&scale=2",
        "https://mt1.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&scale=2",
      ],
      tileSize: 256,
      maxzoom: 22,
    });

    glMap.addSource("google-traffic", {
      type: "raster",
      attribution: "Traffic data ©2026 Google",
      tiles: ["https://mt1.google.com/vt/lyrs=h,traffic&hl=en&x={x}&y={y}&z={z}&scale=2"],
      tileSize: 256,
      maxzoom: 22,
    });

    glMap.addLayer(
      {
        id: "google-roadmap-layer",
        type: "raster",
        source: "google-roadmap-lanes",
        layout: {
          visibility: isSatelliteView ? "none" : "visible",
        },
        paint: {
          "raster-fade-duration": 0,
        },
      }
    );

    glMap.addLayer(
      {
        id: "google-satellite-layer",
        type: "raster",
        source: "google-satellite",
        layout: {
          visibility: isSatelliteView ? "visible" : "none",
        },
        paint: {
          "raster-fade-duration": 0,
        },
      }
    );

    glMap.addLayer(
      {
        id: "google-traffic-layer",
        type: "raster",
        source: "google-traffic",
        layout: {
          visibility: isTrafficVisible ? "visible" : "none",
        },
        paint: {
          "raster-opacity": 0.85,
        },
      }
    );

    // 4. Add Subtle AV Lane Path Guide Line (thin & translucent so Google Maps lane markings stay visible underneath!)
    glMap.addSource("av-route", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [],
        },
      },
    });

    glMap.addLayer({
      id: "av-route-line",
      type: "line",
      source: "av-route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#1a73e8",
        "line-width": 3.5,
        "line-opacity": 0.55,
        "line-dasharray": [2, 2],
      },
    });

    // 5. Mount the Three.js Custom 3D Layer (Resorts, Landmarks & 3D Robotaxis)
    if (window.createVegasThreeLayer) {
      threeStripLayer = window.createVegasThreeLayer();
      glMap.addLayer(threeStripLayer);
    }

    // 6. Render interactive Landmark badges
    if (!window.VEGAS_ROAD_WORLD_ENABLED) renderLandmarkMarkers();

    // 7. Load default Full Strip AV Corridor & position vehicle at MGM Rd / Bruno Mars Dr
    if (!window.VEGAS_ROAD_WORLD_ENABLED) loadPresetRoute("full-strip", true);
  });
}

function renderLandmarkMarkers() {
  LANDMARKS.forEach((lm) => {
    const el = document.createElement("div");
    el.className = "landmark-pin";
    el.style.borderColor = lm.color;
    el.style.color = lm.color;
    el.textContent = lm.name;
    el.title = `${lm.name} (${lm.category})`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      flyToLocation(lm.lat, lm.lng, 17.2, is3DView ? 60 : 0, 15);
    });

    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lm.lng, lm.lat])
      .addTo(glMap);
    landmarkDomMarkers.push(marker);
  });
}

function flyToLocation(lat, lng, zoom = 17.0, tilt = 60, heading = 0) {
  if (glMap) {
    threeStripLayer?.stopFollowing?.();
    glMap.flyTo({
      center: [lng, lat],
      zoom: zoom,
      pitch: tilt,
      bearing: heading,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1300,
    });
  }
}

/**
 * Offset a (lat, lng) coordinate laterally by `lateralMeters` perpendicular to `headingDeg`
 * (+lateralMeters shifts right of travel direction, -lateralMeters shifts left of travel direction)
 * so autonomous vehicles drive inside specific Google Maps lanes!
 */
function offsetLatLngByLaneMeters(lat, lng, headingDeg, lateralMeters) {
  const rightAngleRad = ((headingDeg + 90) * Math.PI) / 180;
  const dNorthMeters = Math.cos(rightAngleRad) * lateralMeters;
  const dEastMeters = Math.sin(rightAngleRad) * lateralMeters;
  const dLat = (dNorthMeters / 6378137) * (180 / Math.PI);
  const dLng =
    (dEastMeters / (6378137 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

async function loadPresetRoute(routeKey, startNearMgm = false) {
  const preset = PRESET_ROUTES[routeKey];
  if (!preset) return;

  stopSimulation("READY");

  const coordsQuery = preset.waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(osrmUrl);
    const data = await res.json();
    if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
      buildRouteFromLngLatPairs(data.routes[0].geometry.coordinates, startNearMgm);
      return;
    }
  } catch (err) {
    console.warn("OSRM fallback to Strip waypoints:", err);
  }

  buildRouteFromLngLatPairs(
    preset.waypoints.map((w) => [w.lng, w.lat]),
    startNearMgm
  );
}

function buildRouteFromLngLatPairs(lngLatArray, startNearMgm = false) {
  if (glMap && glMap.getSource("av-route")) {
    glMap.getSource("av-route").setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: lngLatArray,
      },
    });
  }

  const pts = [];
  let cumulativeMiles = 0;
  let mgmStartMiles = 0;
  let minMgmDist = Infinity;

  for (let i = 0; i < lngLatArray.length; i++) {
    const [lng, lat] = lngLatArray[i];
    let heading = 0;
    if (i > 0) {
      const [prevLng, prevLat] = lngLatArray[i - 1];
      const stepMiles = computeHaversineMiles(prevLat, prevLng, lat, lng);
      cumulativeMiles += stepMiles;
      heading = computeBearingDegrees(prevLat, prevLng, lat, lng);
    } else if (lngLatArray.length > 1) {
      const [nextLng, nextLat] = lngLatArray[1];
      heading = computeBearingDegrees(lat, lng, nextLat, nextLng);
    }

    const dToMgm = Math.hypot(
      lat - MGM_BRUNO_MARS_INTERSECTION.lat,
      lng - MGM_BRUNO_MARS_INTERSECTION.lng
    );
    if (dToMgm < minMgmDist) {
      minMgmDist = dToMgm;
      mgmStartMiles = cumulativeMiles;
    }

    pts.push({
      lat,
      lng,
      distMiles: cumulativeMiles,
      heading,
    });
  }

  routePoints = pts;
  totalRouteMiles = pts.length ? pts[pts.length - 1].distMiles : 0;
  simProgressMiles = startNearMgm ? mgmStartMiles : 0;
  placeEgoVehicleAt(simProgressMiles);
}

function computeHaversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.7613;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearingDegrees(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function interpolatePoseAtMiles(targetMiles) {
  if (!routePoints.length) {
    return {
      lat: MGM_BRUNO_MARS_INTERSECTION.lat,
      lng: MGM_BRUNO_MARS_INTERSECTION.lng,
      heading: 0,
    };
  }
  if (targetMiles <= 0) return routePoints[0];
  if (targetMiles >= totalRouteMiles) return routePoints[routePoints.length - 1];

  for (let i = 1; i < routePoints.length; i++) {
    const prev = routePoints[i - 1];
    const curr = routePoints[i];
    if (targetMiles <= curr.distMiles) {
      const span = curr.distMiles - prev.distMiles || 0.00001;
      const t = (targetMiles - prev.distMiles) / span;
      return {
        lat: prev.lat + (curr.lat - prev.lat) * t,
        lng: prev.lng + (curr.lng - prev.lng) * t,
        heading: curr.heading,
      };
    }
  }
  return routePoints[routePoints.length - 1];
}

function placeEgoVehicleAt(miles) {
  const basePose = interpolatePoseAtMiles(miles);
  if (!glMap) return;

  // Apply lateral lane offset (each Google Maps lane is ~3.5m wide)
  const lateralMeters = selectedLaneIndex * 3.5;
  const lanePos = offsetLatLngByLaneMeters(
    basePose.lat,
    basePose.lng,
    basePose.heading,
    lateralMeters
  );
  const pose = { lat: lanePos.lat, lng: lanePos.lng, heading: basePose.heading };

  if (threeStripLayer && threeStripLayer.updateEgoVehiclePose) {
    threeStripLayer.updateEgoVehiclePose(pose.lat, pose.lng, pose.heading);
  }

  if (!glEgoMarker) {
    const wrapper = document.createElement("div");
    wrapper.className = "ego-car-marker";
    glEgoInnerEl = document.createElement("div");
    glEgoInnerEl.className = "ego-car-inner";
    glEgoInnerEl.textContent = "▲";
    wrapper.appendChild(glEgoInnerEl);

    glEgoMarker = new maplibregl.Marker({ element: wrapper, anchor: "center" })
      .setLngLat([pose.lng, pose.lat])
      .addTo(glMap);
  } else {
    glEgoMarker.setLngLat([pose.lng, pose.lat]);
  }

  const mapBearing = glMap.getBearing();
  if (glEgoInnerEl) {
    glEgoInnerEl.style.transform = `rotate(${pose.heading - mapBearing}deg)`;
  }

  // Also update 2 companion autonomous vehicles in adjacent lanes (Waymo & Zoox)
  updateCompanionFleet(miles, mapBearing);

  updateTelemetryUI(pose, miles);

  const followCam = document.getElementById("av-follow-cam").checked;
  if (followCam && simRunning) {
    glMap.jumpTo({
      center: [pose.lng, pose.lat],
      bearing: is3DView ? pose.heading : 0,
    });
  }
}

function updateCompanionFleet(egoMiles, mapBearing) {
  const specs = [
    { offsetMiles: 0.025, laneIdx: -1, color: "#4285f4", label: "Waymo" },
    { offsetMiles: -0.02, laneIdx: 1, color: "#fbbc04", label: "Zoox" },
  ];

  specs.forEach((sp, idx) => {
    const m = Math.max(0, Math.min(totalRouteMiles, (egoMiles + sp.offsetMiles) % (totalRouteMiles || 1)));
    const bPose = interpolatePoseAtMiles(m);
    const lPos = offsetLatLngByLaneMeters(bPose.lat, bPose.lng, bPose.heading, sp.laneIdx * 3.5);

    if (!companionMarkers[idx]) {
      const wrap = document.createElement("div");
      wrap.className = "ego-car-marker";
      const inner = document.createElement("div");
      inner.className = "ego-car-inner";
      inner.style.background = sp.color;
      inner.style.boxShadow = `0 0 12px ${sp.color}`;
      inner.textContent = "▲";
      wrap.appendChild(inner);
      const marker = new maplibregl.Marker({ element: wrap, anchor: "center" })
        .setLngLat([lPos.lng, lPos.lat])
        .addTo(glMap);
      companionMarkers[idx] = { marker, inner };
    } else {
      companionMarkers[idx].marker.setLngLat([lPos.lng, lPos.lat]);
      companionMarkers[idx].inner.style.transform = `rotate(${bPose.heading - mapBearing}deg)`;
    }
  });
}

function updateTelemetryUI(pose, miles) {
  const currentSpeed = simRunning ? BASE_AV_SPEED_MPH : 0;
  document.getElementById("tel-speed").textContent = `${currentSpeed.toFixed(1)} mph`;
  document.getElementById("tel-heading").textContent = `${Math.round(pose.heading)}°`;
  document.getElementById("tel-lat").textContent = pose.lat.toFixed(5);
  document.getElementById("tel-lng").textContent = pose.lng.toFixed(5);

  const pct = totalRouteMiles > 0 ? Math.min(100, (miles / totalRouteMiles) * 100) : 0;
  document.getElementById("tel-progress-bar").style.width = `${pct.toFixed(1)}%`;
  document.getElementById("tel-distance").textContent = `${miles.toFixed(2)} / ${totalRouteMiles.toFixed(2)} mi`;
}

function stepSimulation(timestamp) {
  if (!simRunning) return;
  if (!lastFrameTime) lastFrameTime = timestamp;
  const dtSeconds = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  const milesPerSecond = (BASE_AV_SPEED_MPH / 3600) * speedMultiplier;
  simProgressMiles += milesPerSecond * dtSeconds;

  if (simProgressMiles >= totalRouteMiles) {
    simProgressMiles = 0;
  }

  placeEgoVehicleAt(simProgressMiles);
  simAnimationFrame = requestAnimationFrame(stepSimulation);
}

function startSimulation() {
  if (!routePoints.length) return;
  simRunning = true;
  lastFrameTime = 0;
  const statusEl = document.getElementById("sim-status");
  statusEl.textContent = "AUTONOMOUS";
  statusEl.classList.add("running");
  document.getElementById("av-start-btn").disabled = true;
  document.getElementById("av-pause-btn").disabled = false;
  simAnimationFrame = requestAnimationFrame(stepSimulation);
}

function stopSimulation(statusLabel = "PAUSED") {
  simRunning = false;
  if (simAnimationFrame) cancelAnimationFrame(simAnimationFrame);
  const statusEl = document.getElementById("sim-status");
  statusEl.textContent = statusLabel;
  statusEl.classList.remove("running");
  document.getElementById("av-start-btn").disabled = false;
  document.getElementById("av-pause-btn").disabled = true;
  const pose = interpolatePoseAtMiles(simProgressMiles);
  updateTelemetryUI(pose, simProgressMiles);
}

async function handlePlaceSearch() {
  const query = document.getElementById("place-search-input").value.trim();
  if (!query) return;

  const place = [...document.querySelectorAll('#landmark-chips .chip')].find(chip =>
    chip.querySelector('span').textContent.toLowerCase().includes(query.toLowerCase()));
  if (place) { place.click(); return; }

  const localMatch = LANDMARKS.find((l) => l.name.toLowerCase().includes(query.toLowerCase()));
  if (localMatch) {
    flyToLocation(localMatch.lat, localMatch.lng, 17.5, is3DView ? 60 : 0, 15);
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query + " Las Vegas"
    )}&limit=1`;
    const res = await fetch(url);
    const items = await res.json();
    if (items && items[0]) {
      flyToLocation(parseFloat(items[0].lat), parseFloat(items[0].lon), 18.5, is3DView ? 50 : 0, 0);
    }
  } catch (e) {
    console.warn("Search error:", e);
  }
}

function set3DBuildingsVisibility(visible) {
  show3DBuildings = visible;
  const bldgBtn = document.getElementById("toggle-bldg-btn");
  if (bldgBtn) bldgBtn.classList.toggle("active", show3DBuildings);
  if (threeStripLayer && threeStripLayer.setBuildingsVisible) {
    threeStripLayer.setBuildingsVisible(show3DBuildings);
  }
}

function setupUIHandlers() {
  document.querySelectorAll("#landmark-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#landmark-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const lat = parseFloat(chip.dataset.lat);
      const lng = parseFloat(chip.dataset.lng);
      const zoom = parseFloat(chip.dataset.zoom || "17.0");
      const tilt = parseFloat(chip.dataset.tilt || "0");
      const heading = parseFloat(chip.dataset.heading || "0");

      // If jumping to a high-zoom intersection (zoom >= 18.5), switch cleanly to top-down lane view
      if (zoom >= 18.5 && tilt === 0) {
        is3DView = false;
        set3DBuildingsVisibility(false);
        document.getElementById("mode-lanes-btn").classList.add("active");
        document.getElementById("mode-3d-btn").classList.remove("active");
      } else {
        is3DView = true;
        set3DBuildingsVisibility(true);
        document.getElementById("mode-3d-btn").classList.add("active");
        document.getElementById("mode-lanes-btn").classList.remove("active");
      }
      flyToLocation(lat, lng, zoom, tilt, heading);
    });
  });

  document.getElementById("search-go-btn").addEventListener("click", handlePlaceSearch);
  document.getElementById("place-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handlePlaceSearch();
  });

  // "Lanes View" button jumps straight to the MGM Rd / Bruno Mars Dr / S Las Vegas Blvd lane view from the screenshot
  document.getElementById("reset-strip-btn").addEventListener("click", () => {
    document.querySelector('#landmark-chips .chip[data-view="lanes"]').click();
  });

  const modeLanesBtn = document.getElementById("mode-lanes-btn");
  const mode3dBtn = document.getElementById("mode-3d-btn");

  modeLanesBtn.addEventListener("click", () => {
    is3DView = false;
    modeLanesBtn.classList.add("active");
    mode3dBtn.classList.remove("active");
    set3DBuildingsVisibility(false);
    if (glMap) {
      glMap.easeTo({ pitch: 0, bearing: 0, zoom: Math.max(glMap.getZoom(), 18.8), duration: 600 });
    }
  });

  mode3dBtn.addEventListener("click", () => {
    is3DView = true;
    mode3dBtn.classList.add("active");
    modeLanesBtn.classList.remove("active");
    set3DBuildingsVisibility(true);
    if (glMap) {
      glMap.easeTo({ pitch: 60, duration: 600 });
    }
  });

  document.getElementById("toggle-bldg-btn").addEventListener("click", () => {
    set3DBuildingsVisibility(!show3DBuildings);
  });

  const satBtn = document.getElementById("toggle-satellite-btn");
  satBtn.addEventListener("click", () => {
    isSatelliteView = !isSatelliteView;
    satBtn.classList.toggle("active", isSatelliteView);
    if (glMap) {
      if (glMap.getLayer("google-satellite-layer")) {
        glMap.setLayoutProperty(
          "google-satellite-layer",
          "visibility",
          isSatelliteView ? "visible" : "none"
        );
      }
      if (glMap.getLayer("google-roadmap-layer")) {
        glMap.setLayoutProperty(
          "google-roadmap-layer",
          "visibility",
          isSatelliteView ? "none" : "visible"
        );
      }
    }
  });

  const trafficBtn = document.getElementById("toggle-traffic-btn");
  trafficBtn.addEventListener("click", () => {
    isTrafficVisible = !isTrafficVisible;
    trafficBtn.classList.toggle("active", isTrafficVisible);
    if (glMap && glMap.getLayer("google-traffic-layer")) {
      glMap.setLayoutProperty(
        "google-traffic-layer",
        "visibility",
        isTrafficVisible ? "visible" : "none"
      );
    }
  });

  document.getElementById("cam-rotate-left").addEventListener("click", () => {
    if (glMap) glMap.easeTo({ bearing: glMap.getBearing() - 35, duration: 400 });
  });
  document.getElementById("cam-rotate-right").addEventListener("click", () => {
    if (glMap) glMap.easeTo({ bearing: glMap.getBearing() + 35, duration: 400 });
  });
  document.getElementById("cam-tilt-toggle").addEventListener("click", () => {
    if (!glMap) return;
    const nextPitch = glMap.getPitch() > 15 ? 0 : 60;
    is3DView = nextPitch > 0;
    set3DBuildingsVisibility(is3DView);
    mode3dBtn.classList.toggle("active", is3DView);
    modeLanesBtn.classList.toggle("active", !is3DView);
    glMap.easeTo({ pitch: nextPitch, duration: 500 });
  });

  document.getElementById("preset-route").addEventListener("change", (e) => {
    loadPresetRoute(e.target.value, false);
  });

  document.getElementById("lane-select").addEventListener("change", (e) => {
    selectedLaneIndex = parseFloat(e.target.value || "0");
    placeEgoVehicleAt(simProgressMiles);
  });

  document.getElementById("av-start-btn").addEventListener("click", startSimulation);
  document.getElementById("av-pause-btn").addEventListener("click", () => stopSimulation("PAUSED"));
  document.getElementById("av-reset-btn").addEventListener("click", () => {
    stopSimulation("READY");
    placeEgoVehicleAt(simProgressMiles);
  });

  const speedRange = document.getElementById("av-speed-multiplier");
  speedRange.addEventListener("input", () => {
    speedMultiplier = parseFloat(speedRange.value);
    document.getElementById("speed-mult-label").textContent = `${speedMultiplier}x`;
  });

  const apiModal = document.getElementById("api-modal");
  document.getElementById("api-key-btn").addEventListener("click", () => {
    document.getElementById("api-key-input").value = getApiKey();
    apiModal.classList.remove("hidden");
  });

  document.getElementById("close-api-modal-btn").addEventListener("click", () => {
    apiModal.classList.add("hidden");
  });

  document.getElementById("save-api-key-btn").addEventListener("click", () => {
    const val = document.getElementById("api-key-input").value.trim();
    if (val) {
      localStorage.setItem("VEGAS_GOOGLE_MAPS_API_KEY", val);
      if (window.VEGAS_MAP_CONFIG) {
        window.VEGAS_MAP_CONFIG.GOOGLE_MAPS_API_KEY = val;
      }
    }
    apiModal.classList.add("hidden");
  });
}

window.addEventListener("DOMContentLoaded", initApp);
