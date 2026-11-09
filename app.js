/**
 * Las Vegas Strip — Three.js 3D Resorts & Landmarks + Google Maps Hybrid/Traffic & AV Simulation
 * Inspired by abrhamhabtu/vegas-strip-v2
 */

const VEGAS_STRIP_CENTER = { lat: 36.1127, lng: -115.1735 }; // Bellagio / Paris / Center Strip

const PRESET_ROUTES = {
  "full-strip": {
    name: "Full Las Vegas Strip (Welcome Sign → Wynn)",
    waypoints: [
      { lat: 36.0820, lng: -115.1728 }, // Welcome to Fabulous Las Vegas Sign
      { lat: 36.0919, lng: -115.1731 }, // Mandalay Bay
      { lat: 36.1015, lng: -115.1727 }, // MGM Grand / Tropicana Ave
      { lat: 36.1088, lng: -115.1728 }, // Cosmopolitan / Harmon Ave
      { lat: 36.1147, lng: -115.1727 }, // Bellagio / Flamingo Rd
      { lat: 36.1212, lng: -115.1697 }, // The Venetian / Mirage
      { lat: 36.1265, lng: -115.1657 }, // Wynn Las Vegas
      { lat: 36.1310, lng: -115.1636 }, // Encore North Strip
    ],
  },
  "sphere-loop": {
    name: "Center Strip → The Sphere → Bellagio Loop",
    waypoints: [
      { lat: 36.1127, lng: -115.1728 }, // Bellagio
      { lat: 36.1238, lng: -115.1686 }, // Sands Ave / Venetian
      { lat: 36.1213, lng: -115.1605 }, // The Sphere / Koval Ln
      { lat: 36.1145, lng: -115.1642 }, // Flamingo Rd East
      { lat: 36.1127, lng: -115.1728 }, // Return to Bellagio
    ],
  },
  "airport-connector": {
    name: "Harry Reid Airport (LAS) → MGM → Caesars Palace",
    waypoints: [
      { lat: 36.0854, lng: -115.1506 }, // LAS Airport Terminal 1
      { lat: 36.1008, lng: -115.1545 }, // Paradise & Tropicana
      { lat: 36.1015, lng: -115.1725 }, // MGM Grand / LV Blvd
      { lat: 36.1162, lng: -115.1732 }, // Caesars Palace
    ],
  },
  "downtown-run": {
    name: "North Strip (Sahara) → Fremont Street Downtown",
    waypoints: [
      { lat: 36.1425, lng: -115.1566 }, // Sahara Ave & LV Blvd
      { lat: 36.1475, lng: -115.1558 }, // The STRAT
      { lat: 36.1592, lng: -115.1483 }, // Arts District
      { lat: 36.1699, lng: -115.1398 }, // Fremont Street Experience
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
  { name: "Hard Rock Guitar", lat: 36.1212, lng: -115.1741, category: "Resort", color: "#00c8ff" },
  { name: "The Venetian", lat: 36.1212, lng: -115.1697, category: "Resort", color: "#ffdca6" },
  { name: "The Sphere", lat: 36.1213, lng: -115.1620, category: "Venue", color: "#ff3d6e" },
  { name: "Wynn Las Vegas", lat: 36.1265, lng: -115.1657, category: "Resort", color: "#ffc76b" },
  { name: "Trump Tower", lat: 36.1295, lng: -115.1727, category: "Resort", color: "#ffe066" },
  { name: "Resorts World", lat: 36.1345, lng: -115.1691, category: "Resort", color: "#ff335c" },
  { name: "Fontainebleau", lat: 36.1362, lng: -115.1628, category: "Resort", color: "#5ea0ff" },
  { name: "The STRAT Tower", lat: 36.1475, lng: -115.1566, category: "Landmark", color: "#ff5c5c" },
  { name: "Fremont St Canopy", lat: 36.1707, lng: -115.1439, category: "Downtown", color: "#ff8800" },
];

let glMap = null;
let threeStripLayer = null;
let glEgoMarker = null;
let glEgoInnerEl = null;
let is3DView = true;
let isSatelliteView = true; // Default to Google Hybrid Satellite + Three.js 3D Buildings
let isTrafficVisible = true;

// AV Simulation State
let routePoints = []; // [{lat, lng, distMiles, heading}]
let totalRouteMiles = 0;
let simRunning = false;
let simProgressMiles = 0;
let simAnimationFrame = null;
let lastFrameTime = 0;
let speedMultiplier = 2;
const BASE_AV_SPEED_MPH = 35.0;

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
}

function initWebGLVegasMap() {
  glMap = new maplibregl.Map({
    container: "map-gl",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [VEGAS_STRIP_CENTER.lng, VEGAS_STRIP_CENTER.lat],
    zoom: 16.3,
    pitch: 64,
    bearing: 18,
    antialias: true,
    maxPitch: 82,
  });

  glMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

  glMap.on("load", () => {
    // 1. Add Google Maps Satellite/Hybrid & Live Traffic tile layers
    if (!glMap.getSource("google-satellite")) {
      glMap.addSource("google-satellite", {
        type: "raster",
        tiles: ["https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"],
        tileSize: 256,
        attribution: "Map data © Google, Three.js 3D Resorts",
      });
    }

    if (!glMap.getSource("google-traffic")) {
      glMap.addSource("google-traffic", {
        type: "raster",
        tiles: ["https://mt1.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}"],
        tileSize: 256,
      });
    }

    const layers = glMap.getStyle().layers || [];
    let firstBuildingOrSymbolId = undefined;
    for (const layer of layers) {
      if (layer.type === "fill-extrusion" || layer.type === "symbol") {
        firstBuildingOrSymbolId = layer.id;
        break;
      }
    }

    glMap.addLayer(
      {
        id: "google-satellite-layer",
        type: "raster",
        source: "google-satellite",
        layout: {
          visibility: isSatelliteView ? "visible" : "none",
        },
        paint: {
          "raster-opacity": 0.94,
          "raster-contrast": 0.08,
          "raster-saturation": 0.12,
        },
      },
      firstBuildingOrSymbolId
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
          "raster-opacity": 0.88,
        },
      },
      firstBuildingOrSymbolId
    );

    // 2. Style base OSM 3D extrusions with height-varied warm desert/glass palette (like vegas-strip-v2)
    styleBaseBuildingsPalette();

    // 3. Add AV Route GeoJSON source & neon line layers
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
      id: "av-route-glow",
      type: "line",
      source: "av-route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#00ff88",
        "line-width": 14,
        "line-opacity": 0.32,
      },
    });

    glMap.addLayer({
      id: "av-route-line",
      type: "line",
      source: "av-route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#4285f4",
        "line-width": 5.5,
        "line-opacity": 0.96,
      },
    });

    // 4. Mount the Three.js Custom 3D Layer (21 Hero Resorts, Landmarks & 3D Robotaxi)
    if (window.createVegasThreeLayer) {
      threeStripLayer = window.createVegasThreeLayer();
      glMap.addLayer(threeStripLayer);
    }

    // 5. Render interactive Landmark badges
    renderLandmarkMarkers();

    // 6. Load default Full Strip AV Corridor
    loadPresetRoute("full-strip");
  });
}

function styleBaseBuildingsPalette() {
  const layers = glMap.getStyle().layers || [];
  for (const layer of layers) {
    if (layer.type === "fill-extrusion") {
      // Keep the native MapLibre extrusion layer active at 0.004 opacity (< 1/255 alpha, invisible)
      // so MapLibre decodes all `openmaptiles` building footprints for `querySourceFeatures`
      // without drawing any duplicate grey boxes.
      glMap.setPaintProperty(layer.id, "fill-extrusion-opacity", 0.004);
    }
  }
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
      flyToLocation(lm.lat, lm.lng, 16.5, is3DView ? 64 : 0, 20);
    });

    new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lm.lng, lm.lat])
      .addTo(glMap);
  });
}

function flyToLocation(lat, lng, zoom = 16.4, tilt = 64, heading = 15) {
  if (glMap) {
    glMap.flyTo({
      center: [lng, lat],
      zoom: zoom,
      pitch: is3DView ? tilt : 0,
      bearing: heading,
      duration: 1500,
      essential: true,
    });
  }
}

async function loadPresetRoute(routeKey) {
  const preset = PRESET_ROUTES[routeKey];
  if (!preset) return;

  stopSimulation("READY");

  const coordsQuery = preset.waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(osrmUrl);
    const data = await res.json();
    if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
      buildRouteFromLngLatPairs(data.routes[0].geometry.coordinates);
      return;
    }
  } catch (err) {
    console.warn("OSRM fallback to Strip waypoints:", err);
  }

  buildRouteFromLngLatPairs(preset.waypoints.map((w) => [w.lng, w.lat]));
}

function buildRouteFromLngLatPairs(lngLatArray) {
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

  for (let i = 0; i < lngLatArray.length; i++) {
    const [lng, lat] = lngLatArray[i];
    let heading = 15;
    if (i > 0) {
      const [prevLng, prevLat] = lngLatArray[i - 1];
      const stepMiles = computeHaversineMiles(prevLat, prevLng, lat, lng);
      cumulativeMiles += stepMiles;
      heading = computeBearingDegrees(prevLat, prevLng, lat, lng);
    } else if (lngLatArray.length > 1) {
      const [nextLng, nextLat] = lngLatArray[1];
      heading = computeBearingDegrees(lat, lng, nextLat, nextLng);
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
  simProgressMiles = 0;
  placeEgoVehicleAt(0);
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
    return { lat: VEGAS_STRIP_CENTER.lat, lng: VEGAS_STRIP_CENTER.lng, heading: 15 };
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
  const pose = interpolatePoseAtMiles(miles);
  if (!glMap) return;

  // Update 3D Three.js Robotaxi model pose
  if (threeStripLayer && threeStripLayer.updateEgoVehiclePose) {
    threeStripLayer.updateEgoVehiclePose(pose.lat, pose.lng, pose.heading);
  }

  // Update HUD beacon marker
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

  if (glEgoInnerEl) {
    const mapBearing = glMap.getBearing();
    const relRotation = pose.heading - mapBearing;
    glEgoInnerEl.style.transform = `rotate(${relRotation}deg)`;
  }

  updateTelemetryUI(pose, miles);

  const followCam = document.getElementById("av-follow-cam").checked;
  if (followCam && simRunning) {
    glMap.jumpTo({
      center: [pose.lng, pose.lat],
      bearing: pose.heading,
      pitch: is3DView ? 65 : 0,
    });
  }
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
    simProgressMiles = totalRouteMiles;
    placeEgoVehicleAt(simProgressMiles);
    stopSimulation("COMPLETED");
    return;
  }

  placeEgoVehicleAt(simProgressMiles);
  simAnimationFrame = requestAnimationFrame(stepSimulation);
}

function startSimulation() {
  if (!routePoints.length) return;
  if (simProgressMiles >= totalRouteMiles) {
    simProgressMiles = 0;
  }
  simRunning = true;
  lastFrameTime = 0;
  const statusEl = document.getElementById("sim-status");
  statusEl.textContent = "AUTONOMOUS";
  statusEl.classList.add("running");
  document.getElementById("av-start-btn").disabled = true;
  document.getElementById("av-pause-btn").disabled = false;

  if (document.getElementById("av-follow-cam").checked && glMap) {
    const pose = interpolatePoseAtMiles(simProgressMiles);
    glMap.easeTo({
      center: [pose.lng, pose.lat],
      zoom: 17.0,
      pitch: is3DView ? 65 : 0,
      bearing: pose.heading,
      duration: 600,
    });
  }

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

  const localMatch = LANDMARKS.find((l) => l.name.toLowerCase().includes(query.toLowerCase()));
  if (localMatch) {
    flyToLocation(localMatch.lat, localMatch.lng, 16.5, 64, 15);
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query + " Las Vegas"
    )}&limit=1`;
    const res = await fetch(url);
    const items = await res.json();
    if (items && items[0]) {
      flyToLocation(parseFloat(items[0].lat), parseFloat(items[0].lon), 16.4, 62, 0);
    }
  } catch (e) {
    console.warn("Search error:", e);
  }
}

function setupUIHandlers() {
  document.querySelectorAll("#landmark-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#landmark-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const lat = parseFloat(chip.dataset.lat);
      const lng = parseFloat(chip.dataset.lng);
      const zoom = parseFloat(chip.dataset.zoom || "16.4");
      const tilt = parseFloat(chip.dataset.tilt || "64");
      const heading = parseFloat(chip.dataset.heading || "0");
      flyToLocation(lat, lng, zoom, tilt, heading);
    });
  });

  document.getElementById("search-go-btn").addEventListener("click", handlePlaceSearch);
  document.getElementById("place-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handlePlaceSearch();
  });

  document.getElementById("reset-strip-btn").addEventListener("click", () => {
    flyToLocation(VEGAS_STRIP_CENTER.lat, VEGAS_STRIP_CENTER.lng, 16.3, 64, 18);
  });

  const mode3dBtn = document.getElementById("mode-3d-btn");
  const mode2dBtn = document.getElementById("mode-2d-btn");

  mode3dBtn.addEventListener("click", () => {
    is3DView = true;
    mode3dBtn.classList.add("active");
    mode2dBtn.classList.remove("active");
    if (glMap) glMap.easeTo({ pitch: 64, duration: 700 });
  });

  mode2dBtn.addEventListener("click", () => {
    is3DView = false;
    mode2dBtn.classList.add("active");
    mode3dBtn.classList.remove("active");
    if (glMap) glMap.easeTo({ pitch: 0, bearing: 0, duration: 700 });
  });

  const satBtn = document.getElementById("toggle-satellite-btn");
  satBtn.addEventListener("click", () => {
    isSatelliteView = !isSatelliteView;
    satBtn.classList.toggle("active", isSatelliteView);
    if (glMap && glMap.getLayer("google-satellite-layer")) {
      glMap.setLayoutProperty(
        "google-satellite-layer",
        "visibility",
        isSatelliteView ? "visible" : "none"
      );
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
    const nextPitch = glMap.getPitch() > 20 ? 0 : 64;
    is3DView = nextPitch > 0;
    mode3dBtn.classList.toggle("active", is3DView);
    mode2dBtn.classList.toggle("active", !is3DView);
    glMap.easeTo({ pitch: nextPitch, duration: 500 });
  });

  document.getElementById("preset-route").addEventListener("change", (e) => {
    loadPresetRoute(e.target.value);
  });

  document.getElementById("av-start-btn").addEventListener("click", startSimulation);
  document.getElementById("av-pause-btn").addEventListener("click", () => stopSimulation("PAUSED"));
  document.getElementById("av-reset-btn").addEventListener("click", () => {
    stopSimulation("READY");
    simProgressMiles = 0;
    placeEgoVehicleAt(0);
    const pose = interpolatePoseAtMiles(0);
    flyToLocation(pose.lat, pose.lng, 16.5, 64, pose.heading);
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
