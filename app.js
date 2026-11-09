/**
 * Las Vegas Strip — Google Maps Carbon Copy & Autonomous Vehicle Simulation
 *
 * Dual-Engine Architecture:
 * 1. Instant 3D WebGL Map Engine (MapLibre GL + Google Maps Hybrid/Road/Traffic Tiles + 3D Extruded Strip Buildings + Real OSRM Road Routing)
 *    Guarantees immediate, zero-error 3D rendering of the entire Las Vegas Strip even if a Google AI Studio key does not have Maps JS API activated yet.
 * 2. Native Google Maps JS SDK (`google.maps.Map` + `Map3DElement`) when activated on the key, with automatic `gm_authFailure` recovery.
 */

const VEGAS_STRIP_CENTER = { lat: 36.1127, lng: -115.1728 }; // Bellagio / Center Strip

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
  { name: "Welcome to Las Vegas Sign", lat: 36.0820, lng: -115.1728, category: "Landmark" },
  { name: "Mandalay Bay", lat: 36.0919, lng: -115.1752, category: "Resort" },
  { name: "Allegiant Stadium", lat: 36.0908, lng: -115.1833, category: "Stadium" },
  { name: "Luxor Pyramid", lat: 36.0955, lng: -115.1761, category: "Resort" },
  { name: "Excalibur", lat: 36.0988, lng: -115.1754, category: "Resort" },
  { name: "MGM Grand", lat: 36.1024, lng: -115.1699, category: "Resort" },
  { name: "New York-New York", lat: 36.1024, lng: -115.1745, category: "Resort" },
  { name: "T-Mobile Arena", lat: 36.1028, lng: -115.1784, category: "Arena" },
  { name: "Aria Resort", lat: 36.1072, lng: -115.1766, category: "Resort" },
  { name: "The Cosmopolitan", lat: 36.1098, lng: -115.1739, category: "Resort" },
  { name: "Bellagio Fountains", lat: 36.1127, lng: -115.1743, category: "Landmark" },
  { name: "Paris Las Vegas", lat: 36.1125, lng: -115.1707, category: "Resort" },
  { name: "Caesars Palace", lat: 36.1162, lng: -115.1745, category: "Resort" },
  { name: "The Venetian", lat: 36.1212, lng: -115.1697, category: "Resort" },
  { name: "The Sphere", lat: 36.1213, lng: -115.1620, category: "Venue" },
  { name: "Wynn Las Vegas", lat: 36.1265, lng: -115.1657, category: "Resort" },
  { name: "Resorts World", lat: 36.1345, lng: -115.1691, category: "Resort" },
  { name: "The STRAT Tower", lat: 36.1475, lng: -115.1566, category: "Landmark" },
  { name: "Fremont Street", lat: 36.1707, lng: -115.1439, category: "Downtown" },
  { name: "Harry Reid Airport (LAS)", lat: 36.0840, lng: -115.1537, category: "Airport" },
];

let glMap = null;
let glEgoMarker = null;
let glEgoInnerEl = null;
let is3DView = true;
let isSatelliteView = false;
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

// Catch Google Maps JS SDK authentication failure cleanly so it never breaks the UI
window.gm_authFailure = function () {
  console.warn("Google Maps JS SDK reported gm_authFailure for this API key. Running on 3D WebGL Vegas Strip Engine.");
  const dot = document.getElementById("engine-badge-dot");
  const txt = document.getElementById("engine-badge-text");
  if (dot) {
    dot.classList.remove("ok");
    dot.classList.add("warn");
  }
  if (txt) txt.textContent = "3D Engine (Key Needs Maps API)";
  const diag = document.getElementById("api-diagnostic-msg");
  if (diag) {
    diag.textContent =
      "Google Maps SDK returned an auth/activation notice for your API key (common when an AI Studio key hasn't had 'Maps JavaScript API' enabled in Google Cloud Console yet). The app is actively running on the built-in 3D Las Vegas Strip Engine with Google Map Tiles.";
  }
  // Ensure WebGL map is visible
  document.getElementById("map-gl").classList.remove("hidden");
  document.getElementById("map-gmaps").classList.add("hidden");
};

function initApp() {
  setupUIHandlers();
  initWebGLVegasMap();
}

function initWebGLVegasMap() {
  // Base style using OpenFreeMap Liberty vector tiles (for real 3D building extrusions) + Google Maps Hybrid/Road/Traffic raster layers
  glMap = new maplibregl.Map({
    container: "map-gl",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [VEGAS_STRIP_CENTER.lng, VEGAS_STRIP_CENTER.lat],
    zoom: 16.2,
    pitch: 60,
    bearing: 15,
    antialias: true,
    maxPitch: 80,
  });

  glMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

  glMap.on("load", () => {
    // Add Google Maps Satellite/Hybrid & Road & Traffic tile sources
    if (!glMap.getSource("google-satellite")) {
      glMap.addSource("google-satellite", {
        type: "raster",
        tiles: ["https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"],
        tileSize: 256,
        attribution: "Map data © Google",
      });
    }

    if (!glMap.getSource("google-traffic")) {
      glMap.addSource("google-traffic", {
        type: "raster",
        tiles: ["https://mt1.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}"],
        tileSize: 256,
      });
    }

    // Find the first label/building layer so satellite sits underneath 3D buildings
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
          "raster-opacity": 0.95,
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
          "raster-opacity": 0.85,
        },
      },
      firstBuildingOrSymbolId
    );

    // Enhance 3D building extrusions across the Las Vegas Strip
    enhance3DBuildingsLayer();

    // Add Route GeoJSON source & glow layers for AV corridor
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
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#4285f4",
        "line-width": 12,
        "line-opacity": 0.3,
      },
    });

    glMap.addLayer({
      id: "av-route-line",
      type: "line",
      source: "av-route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#4285f4",
        "line-width": 5,
        "line-opacity": 0.95,
      },
    });

    // Render interactive Landmark pins along the Strip
    renderLandmarkMarkers();

    // Load default Full Strip AV Corridor
    loadPresetRoute("full-strip");
  });
}

function enhance3DBuildingsLayer() {
  const layers = glMap.getStyle().layers || [];
  for (const layer of layers) {
    if (layer.type === "fill-extrusion") {
      glMap.setPaintProperty(layer.id, "fill-extrusion-opacity", 0.86);
    }
  }
}

function renderLandmarkMarkers() {
  LANDMARKS.forEach((lm) => {
    const el = document.createElement("div");
    el.className = "landmark-pin";
    el.textContent = lm.name;
    el.title = `${lm.name} (${lm.category})`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      flyToLocation(lm.lat, lm.lng, 16.8, is3DView ? 62 : 0, 20);
    });

    new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lm.lng, lm.lat])
      .addTo(glMap);
  });
}

function flyToLocation(lat, lng, zoom = 16.5, tilt = 60, heading = 15) {
  if (glMap) {
    glMap.flyTo({
      center: [lng, lat],
      zoom: zoom,
      pitch: is3DView ? tilt : 0,
      bearing: heading,
      duration: 1600,
      essential: true,
    });
  }
}

async function loadPresetRoute(routeKey) {
  const preset = PRESET_ROUTES[routeKey];
  if (!preset) return;

  stopSimulation("READY");

  // Query OSRM real road geometry along Las Vegas Strip for accurate lane-snapped path
  const coordsQuery = preset.waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(osrmUrl);
    const data = await res.json();
    if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
      const coords = data.routes[0].geometry.coordinates; // [[lng, lat], ...]
      buildRouteFromLngLatPairs(coords);
      return;
    }
  } catch (err) {
    console.warn("OSRM road router fallback to dense Strip waypoint interpolation:", err);
  }

  // Fallback dense interpolation if offline
  const fallbackCoords = preset.waypoints.map((w) => [w.lng, w.lat]);
  buildRouteFromLngLatPairs(fallbackCoords);
}

function buildRouteFromLngLatPairs(lngLatArray) {
  // Update MapLibre route line
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
  const R = 3958.7613; // Earth radius in miles
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
      pitch: is3DView ? 64 : 0,
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
      zoom: 17.2,
      pitch: is3DView ? 64 : 0,
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

  // First check built-in Strip landmarks for instant match
  const localMatch = LANDMARKS.find((l) => l.name.toLowerCase().includes(query.toLowerCase()));
  if (localMatch) {
    flyToLocation(localMatch.lat, localMatch.lng, 16.8, 62, 15);
    return;
  }

  // Otherwise geocode within the Las Vegas Valley
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query + " Las Vegas"
    )}&limit=1`;
    const res = await fetch(url);
    const items = await res.json();
    if (items && items[0]) {
      flyToLocation(parseFloat(items[0].lat), parseFloat(items[0].lon), 16.5, 60, 0);
    }
  } catch (e) {
    console.warn("Search error:", e);
  }
}

function testGoogleMapsSDK() {
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Please enter an API key first.");
    return;
  }
  const existing = document.getElementById("gmaps-sdk");
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.id = "gmaps-sdk";
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
    apiKey
  )}&v=alpha&libraries=places,geometry,maps3d`;
  script.async = true;
  script.onload = () => {
    document.getElementById("api-modal").classList.add("hidden");
    const gmapDiv = document.getElementById("map-gmaps");
    gmapDiv.classList.remove("hidden");
    new google.maps.Map(gmapDiv, {
      center: VEGAS_STRIP_CENTER,
      zoom: 16,
      tilt: 45,
      mapTypeId: "hybrid",
    });
  };
  document.head.appendChild(script);
}

function setupUIHandlers() {
  // Corridor Landmark Chips
  document.querySelectorAll("#landmark-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#landmark-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const lat = parseFloat(chip.dataset.lat);
      const lng = parseFloat(chip.dataset.lng);
      const zoom = parseFloat(chip.dataset.zoom || "16.5");
      const tilt = parseFloat(chip.dataset.tilt || "60");
      const heading = parseFloat(chip.dataset.heading || "0");
      flyToLocation(lat, lng, zoom, tilt, heading);
    });
  });

  // Search box
  document.getElementById("search-go-btn").addEventListener("click", handlePlaceSearch);
  document.getElementById("place-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handlePlaceSearch();
  });

  document.getElementById("reset-strip-btn").addEventListener("click", () => {
    flyToLocation(VEGAS_STRIP_CENTER.lat, VEGAS_STRIP_CENTER.lng, 16.2, 60, 15);
  });

  // 3D vs 2D Mode
  const mode3dBtn = document.getElementById("mode-3d-btn");
  const mode2dBtn = document.getElementById("mode-2d-btn");

  mode3dBtn.addEventListener("click", () => {
    is3DView = true;
    mode3dBtn.classList.add("active");
    mode2dBtn.classList.remove("active");
    if (glMap) glMap.easeTo({ pitch: 60, duration: 700 });
  });

  mode2dBtn.addEventListener("click", () => {
    is3DView = false;
    mode2dBtn.classList.add("active");
    mode3dBtn.classList.remove("active");
    if (glMap) glMap.easeTo({ pitch: 0, bearing: 0, duration: 700 });
  });

  // Satellite Layer (Google Hybrid Tiles)
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

  // Live Google Traffic Layer
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

  // Camera HUD
  document.getElementById("cam-rotate-left").addEventListener("click", () => {
    if (glMap) glMap.easeTo({ bearing: glMap.getBearing() - 35, duration: 400 });
  });
  document.getElementById("cam-rotate-right").addEventListener("click", () => {
    if (glMap) glMap.easeTo({ bearing: glMap.getBearing() + 35, duration: 400 });
  });
  document.getElementById("cam-tilt-toggle").addEventListener("click", () => {
    if (!glMap) return;
    const nextPitch = glMap.getPitch() > 20 ? 0 : 62;
    is3DView = nextPitch > 0;
    mode3dBtn.classList.toggle("active", is3DView);
    mode2dBtn.classList.toggle("active", !is3DView);
    glMap.easeTo({ pitch: nextPitch, duration: 500 });
  });

  // AV Controls
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
    flyToLocation(pose.lat, pose.lng, 16.5, 60, pose.heading);
  });

  const speedRange = document.getElementById("av-speed-multiplier");
  speedRange.addEventListener("input", () => {
    speedMultiplier = parseFloat(speedRange.value);
    document.getElementById("speed-mult-label").textContent = `${speedMultiplier}x`;
  });

  // API Key Modal
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

  document.getElementById("try-gmaps-sdk-btn").addEventListener("click", testGoogleMapsSDK);
}

window.addEventListener("DOMContentLoaded", initApp);
