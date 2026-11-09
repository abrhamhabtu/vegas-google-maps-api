/**
 * Las Vegas Strip — Google Maps Platform Carbon Copy & Autonomous Vehicle Simulation
 */

const VEGAS_STRIP_CENTER = { lat: 36.1147, lng: -115.1728 }; // Bellagio / Flamingo & Las Vegas Blvd
const VEGAS_BOUNDS = {
  south: 35.95,
  west: -115.35,
  north: 36.30,
  east: -114.95,
};

const PRESET_ROUTES = {
  "full-strip": {
    name: "Full Las Vegas Strip (South to North)",
    origin: { lat: 36.0820, lng: -115.1728 }, // Welcome to Fabulous Las Vegas Sign
    destination: { lat: 36.1295, lng: -115.1654 }, // Encore / Wynn North Strip
    waypoints: [
      { location: { lat: 36.0919, lng: -115.1731 }, stopover: false }, // Mandalay Bay
      { location: { lat: 36.1024, lng: -115.1728 }, stopover: false }, // MGM Grand / Tropicana
      { location: { lat: 36.1147, lng: -115.1728 }, stopover: false }, // Bellagio / Caesars
      { location: { lat: 36.1215, lng: -115.1697 }, stopover: false }, // Venetian / Mirage
    ],
  },
  "sphere-loop": {
    name: "Center Strip → The Sphere → Bellagio Loop",
    origin: { lat: 36.1126, lng: -115.1728 }, // Bellagio
    destination: { lat: 36.1126, lng: -115.1728 },
    waypoints: [
      { location: { lat: 36.1247, lng: -115.1686 }, stopover: false }, // Sands Ave & LV Blvd
      { location: { lat: 36.1208, lng: -115.1605 }, stopover: false }, // Sphere / Koval Ln
      { location: { lat: 36.1145, lng: -115.1642 }, stopover: false }, // Flamingo Rd
    ],
  },
  "airport-connector": {
    name: "Harry Reid Airport (LAS) → MGM → Caesars Palace",
    origin: { lat: 36.0854, lng: -115.1506 }, // Terminal 1
    destination: { lat: 36.1162, lng: -115.1745 }, // Caesars Palace
    waypoints: [
      { location: { lat: 36.1015, lng: -115.1725 }, stopover: false }, // Tropicana & LV Blvd
    ],
  },
  "downtown-run": {
    name: "North Strip (Sahara) → Fremont Street Downtown",
    origin: { lat: 36.1425, lng: -115.1566 }, // Sahara & LV Blvd
    destination: { lat: 36.1699, lng: -115.1398 }, // Fremont Street Experience
    waypoints: [
      { location: { lat: 36.1474, lng: -115.1561 }, stopover: false }, // The STRAT
    ],
  },
};

const LANDMARKS = [
  { name: "Welcome to Fabulous Las Vegas Sign", lat: 36.0820, lng: -115.1728, category: "Landmark" },
  { name: "Mandalay Bay", lat: 36.0919, lng: -115.1752, category: "Resort" },
  { name: "Allegiant Stadium", lat: 36.0908, lng: -115.1833, category: "Venue" },
  { name: "Luxor Hotel & Casino", lat: 36.0955, lng: -115.1761, category: "Resort" },
  { name: "MGM Grand", lat: 36.1024, lng: -115.1699, category: "Resort" },
  { name: "New York-New York", lat: 36.1024, lng: -115.1745, category: "Resort" },
  { name: "T-Mobile Arena", lat: 36.1028, lng: -115.1784, category: "Venue" },
  { name: "Aria Resort & Casino", lat: 36.1072, lng: -115.1766, category: "Resort" },
  { name: "The Cosmopolitan", lat: 36.1098, lng: -115.1739, category: "Resort" },
  { name: "Bellagio Fountains", lat: 36.1127, lng: -115.1743, category: "Landmark" },
  { name: "Paris Las Vegas", lat: 36.1125, lng: -115.1707, category: "Resort" },
  { name: "Caesars Palace", lat: 36.1162, lng: -115.1745, category: "Resort" },
  { name: "The Venetian", lat: 36.1212, lng: -115.1697, category: "Resort" },
  { name: "Sphere at The Venetian", lat: 36.1213, lng: -115.1620, category: "Venue" },
  { name: "Wynn Las Vegas", lat: 36.1265, lng: -115.1657, category: "Resort" },
  { name: "Resorts World Las Vegas", lat: 36.1345, lng: -115.1691, category: "Resort" },
  { name: "The STRAT Hotel & Tower", lat: 36.1475, lng: -115.1566, category: "Landmark" },
  { name: "Fremont Street Experience", lat: 36.1707, lng: -115.1439, category: "Downtown" },
];

let map2d = null;
let map3d = null;
let trafficLayer = null;
let directionsService = null;
let directionsRenderer = null;
let egoMarker = null;
let isTrafficVisible = true;
let isSatellite = false;
let is3DMode = false;

// Simulation State
let routePoints = []; // [{lat, lng, distFromStartMiles, heading}]
let totalRouteMiles = 0;
let simRunning = false;
let simProgressMiles = 0;
let simAnimationFrame = null;
let lastFrameTime = 0;
let speedMultiplier = 2;
const BASE_AV_SPEED_MPH = 32.0; // Realistic Strip cruising speed

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

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById("gmaps-sdk");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "gmaps-sdk";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=beta&libraries=places,geometry,routes,maps3d`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

async function initApp() {
  setupUIHandlers();

  const apiKey = getApiKey();
  if (!apiKey) {
    document.getElementById("api-modal").classList.remove("hidden");
    return;
  }

  try {
    await loadGoogleMapsScript(apiKey);
    initMaps();
  } catch (err) {
    console.error("Failed to load Google Maps SDK:", err);
    document.getElementById("api-modal").classList.remove("hidden");
  }
}

function initMaps() {
  const mapEl = document.getElementById("map-2d");

  map2d = new google.maps.Map(mapEl, {
    center: VEGAS_STRIP_CENTER,
    zoom: 16,
    tilt: 45,
    heading: 15,
    mapTypeId: "roadmap",
    restriction: {
      latLngBounds: VEGAS_BOUNDS,
      strictBounds: false,
    },
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: true,
    zoomControl: true,
  });

  // Live Traffic Layer (enabled by default for realistic Strip congestion view)
  trafficLayer = new google.maps.TrafficLayer();
  trafficLayer.setMap(map2d);

  // Landmark Pins along the Strip
  const infoWindow = new google.maps.InfoWindow();
  LANDMARKS.forEach((lm) => {
    const marker = new google.maps.Marker({
      position: { lat: lm.lat, lng: lm.lng },
      map: map2d,
      title: lm.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: "#fbbc04",
        fillOpacity: 0.9,
        strokeColor: "#141821",
        strokeWeight: 1.5,
      },
    });
    marker.addListener("click", () => {
      infoWindow.setContent(
        `<div style="color:#111;padding:4px 6px;">
          <strong>${lm.name}</strong><br/>
          <small>${lm.category} • ${lm.lat.toFixed(4)}, ${lm.lng.toFixed(4)}</small>
        </div>`
      );
      infoWindow.open(map2d, marker);
    });
  });

  // Places Search Autocomplete bounded to Las Vegas Valley
  const searchInput = document.getElementById("place-search-input");
  if (google.maps.places) {
    const autocomplete = new google.maps.places.Autocomplete(searchInput, {
      bounds: VEGAS_BOUNDS,
      strictBounds: false,
      fields: ["geometry", "name", "formatted_address"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) return;
      const loc = place.geometry.location;
      flyToLocation(loc.lat(), loc.lng(), 17, 60, 0);
    });
  }

  // Directions & AV Route Setup
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map2d,
    suppressMarkers: false,
    preserveViewport: true,
    polylineOptions: {
      strokeColor: "#4285f4",
      strokeOpacity: 0.9,
      strokeWeight: 6,
    },
  });

  // Load initial Strip route for AV simulation
  loadPresetRoute("full-strip");
}

async function ensure3DMapInitialized() {
  if (map3d) return;
  const container = document.getElementById("map-3d-container");
  container.innerHTML = "";

  try {
    if (google.maps.importLibrary) {
      const { Map3DElement } = await google.maps.importLibrary("maps3d");
      map3d = new Map3DElement({
        center: { lat: VEGAS_STRIP_CENTER.lat, lng: VEGAS_STRIP_CENTER.lng, altitude: 120 },
        range: 1400,
        tilt: 65,
        heading: 15,
        mode: "HYBRID",
      });
      container.appendChild(map3d);
    }
  } catch (e) {
    console.warn("Photorealistic 3D Maps library fallback:", e);
  }
}

function flyToLocation(lat, lng, zoom = 16, tilt = 60, heading = 15) {
  if (map2d) {
    map2d.panTo({ lat, lng });
    map2d.setZoom(zoom);
    map2d.setTilt(tilt);
    map2d.setHeading(heading);
  }
  if (map3d) {
    map3d.center = { lat, lng, altitude: 120 };
    map3d.range = Math.max(400, (20 - zoom) * 350);
    map3d.tilt = tilt;
    map3d.heading = heading;
  }
}

function loadPresetRoute(routeKey) {
  const preset = PRESET_ROUTES[routeKey];
  if (!preset || !directionsService) return;

  stopSimulation();

  directionsService.route(
    {
      origin: preset.origin,
      destination: preset.destination,
      waypoints: preset.waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (status === "OK" && result.routes && result.routes[0]) {
        directionsRenderer.setDirections(result);
        buildDetailedRouteGeometry(result.routes[0]);
      } else {
        console.warn("Directions API unavailable or not enabled on key; using high-res fallback Strip geometry:", status);
        buildFallbackStripGeometry(preset);
      }
    }
  );
}

function buildDetailedRouteGeometry(route) {
  const path = route.overview_path;
  const pts = [];
  let cumulativeMeters = 0;

  for (let i = 0; i < path.length; i++) {
    const curr = { lat: path[i].lat(), lng: path[i].lng() };
    let heading = 0;
    if (i > 0) {
      const prev = path[i - 1];
      const stepMeters = google.maps.geometry.spherical.computeDistanceBetween(prev, path[i]);
      cumulativeMeters += stepMeters;
      heading = google.maps.geometry.spherical.computeHeading(prev, path[i]);
      if (heading < 0) heading += 360;
    } else if (path.length > 1) {
      heading = google.maps.geometry.spherical.computeHeading(path[0], path[1]);
      if (heading < 0) heading += 360;
    }
    pts.push({
      lat: curr.lat,
      lng: curr.lng,
      distMiles: cumulativeMeters / 1609.344,
      heading,
    });
  }

  routePoints = pts;
  totalRouteMiles = pts.length ? pts[pts.length - 1].distMiles : 0;
  simProgressMiles = 0;
  placeEgoVehicleAt(0);
}

function buildFallbackStripGeometry(preset) {
  const rawWaypoints = [
    preset.origin,
    ...(preset.waypoints || []).map((w) => w.location),
    preset.destination,
  ];
  const pts = [];
  let cumulativeMiles = 0;

  for (let i = 0; i < rawWaypoints.length; i++) {
    const curr = rawWaypoints[i];
    let heading = 12;
    if (i > 0) {
      const prev = rawWaypoints[i - 1];
      const dLat = (curr.lat - prev.lat) * 69.0;
      const dLng = (curr.lng - prev.lng) * 55.8;
      cumulativeMiles += Math.hypot(dLat, dLng);
      heading = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
    }
    pts.push({
      lat: curr.lat,
      lng: curr.lng,
      distMiles: cumulativeMiles,
      heading,
    });
  }
  routePoints = pts;
  totalRouteMiles = cumulativeMiles;
  simProgressMiles = 0;
  placeEgoVehicleAt(0);
}

function interpolatePoseAtMiles(targetMiles) {
  if (!routePoints.length) {
    return { lat: VEGAS_STRIP_CENTER.lat, lng: VEGAS_STRIP_CENTER.lng, heading: 0 };
  }
  if (targetMiles <= 0) return routePoints[0];
  if (targetMiles >= totalRouteMiles) return routePoints[routePoints.length - 1];

  for (let i = 1; i < routePoints.length; i++) {
    const prev = routePoints[i - 1];
    const curr = routePoints[i];
    if (targetMiles <= curr.distMiles) {
      const span = curr.distMiles - prev.distMiles || 0.0001;
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
  if (!map2d) return;

  if (!egoMarker) {
    egoMarker = new google.maps.Marker({
      position: { lat: pose.lat, lng: pose.lng },
      map: map2d,
      title: "Autonomous Ego Vehicle #1",
      zIndex: 999,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 6.5,
        fillColor: "#34a853",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        rotation: pose.heading,
      },
    });
  } else {
    egoMarker.setPosition({ lat: pose.lat, lng: pose.lng });
    const icon = egoMarker.getIcon();
    icon.rotation = pose.heading;
    egoMarker.setIcon(icon);
  }

  updateTelemetryUI(pose, miles);

  const followCam = document.getElementById("av-follow-cam").checked;
  if (followCam && simRunning) {
    map2d.panTo({ lat: pose.lat, lng: pose.lng });
    if (map3d) {
      map3d.center = { lat: pose.lat, lng: pose.lng, altitude: 65 };
      map3d.heading = pose.heading;
    }
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

function setupUIHandlers() {
  // Corridor Landmark Chips
  document.querySelectorAll("#landmark-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#landmark-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const lat = parseFloat(chip.dataset.lat);
      const lng = parseFloat(chip.dataset.lng);
      const zoom = parseFloat(chip.dataset.zoom || "16");
      const tilt = parseFloat(chip.dataset.tilt || "60");
      const heading = parseFloat(chip.dataset.heading || "0");
      flyToLocation(lat, lng, zoom, tilt, heading);
    });
  });

  document.getElementById("reset-strip-btn").addEventListener("click", () => {
    flyToLocation(VEGAS_STRIP_CENTER.lat, VEGAS_STRIP_CENTER.lng, 16, 60, 15);
  });

  // 2D vs Photorealistic 3D Mode
  const mode2dBtn = document.getElementById("mode-2d-btn");
  const mode3dBtn = document.getElementById("mode-3d-btn");
  mode2dBtn.addEventListener("click", () => {
    is3DMode = false;
    mode2dBtn.classList.add("active");
    mode3dBtn.classList.remove("active");
    document.getElementById("map-2d").classList.remove("hidden");
    document.getElementById("map-3d-container").classList.add("hidden");
  });

  mode3dBtn.addEventListener("click", async () => {
    is3DMode = true;
    mode3dBtn.classList.add("active");
    mode2dBtn.classList.remove("active");
    document.getElementById("map-2d").classList.add("hidden");
    document.getElementById("map-3d-container").classList.remove("hidden");
    await ensure3DMapInitialized();
  });

  // Traffic toggle
  const trafficBtn = document.getElementById("toggle-traffic-btn");
  trafficBtn.addEventListener("click", () => {
    isTrafficVisible = !isTrafficVisible;
    trafficBtn.classList.toggle("active", isTrafficVisible);
    if (trafficLayer && map2d) {
      trafficLayer.setMap(isTrafficVisible ? map2d : null);
    }
  });

  // Satellite toggle
  const satBtn = document.getElementById("toggle-satellite-btn");
  satBtn.addEventListener("click", () => {
    isSatellite = !isSatellite;
    satBtn.classList.toggle("active", isSatellite);
    if (map2d) {
      map2d.setMapTypeId(isSatellite ? "hybrid" : "roadmap");
    }
  });

  // AV Controls
  document.getElementById("preset-route").addEventListener("change", (e) => {
    loadPresetRoute(e.target.value);
  });

  document.getElementById("av-start-btn").addEventListener("click", () => {
    startSimulation();
  });

  document.getElementById("av-pause-btn").addEventListener("click", () => {
    stopSimulation("PAUSED");
  });

  document.getElementById("av-reset-btn").addEventListener("click", () => {
    stopSimulation("IDLE");
    simProgressMiles = 0;
    placeEgoVehicleAt(0);
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

  document.getElementById("save-api-key-btn").addEventListener("click", async () => {
    const val = document.getElementById("api-key-input").value.trim();
    if (!val) return;
    localStorage.setItem("VEGAS_GOOGLE_MAPS_API_KEY", val);
    if (window.VEGAS_MAP_CONFIG) {
      window.VEGAS_MAP_CONFIG.GOOGLE_MAPS_API_KEY = val;
    }
    apiModal.classList.add("hidden");
    window.location.reload();
  });
}

window.addEventListener("DOMContentLoaded", initApp);
