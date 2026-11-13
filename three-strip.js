/** The reference city's road users and geometry, on the existing Google map. */
import { ORIGIN, toLocal, mercatorSouth, adaptVertexShader } from './landmarks/georeference.mjs';
import { decode } from './landmarks/vendor/core/data.js';
import { theme } from './landmarks/vendor/core/theme.js';
import { Shadows } from './landmarks/vendor/core/shadows.js';
import { buildCity } from './world/city.js';
import { startFleet } from './world/fleet-runtime.js';

const THREE = window.THREE;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
window.VEGAS_ROAD_WORLD_ENABLED = true;
document.documentElement.classList.add('world-enabled');

function prepareMaterials(root) {
  root.traverse(object => {
    for (const material of [].concat(object.material || [])) {
      if (material.userData.vegasProjected) continue;
      material.userData.vegasProjected = true;
      const previous = material.onBeforeCompile;
      material.onBeforeCompile = function(shader, renderer) {
        previous.call(this, shader, renderer);
        shader.vertexShader = adaptVertexShader(shader.vertexShader, THREE.ShaderChunk.project_vertex);
      };
      material.customProgramCacheKey = () => 'vegas-mercator-city-r160-v2';
      material.needsUpdate = true;
    }
  });
}

window.createVegasThreeLayer = function() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(theme.c('fog'), 0.00003);
  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  const ambient = new THREE.HemisphereLight('#dceeff', '#70716b', 1.1);
  const sun = new THREE.DirectionalLight('#fff0d8', 1.1);
  scene.add(ambient, sun);
  const animations = [], simulationAnimations = [], disposers = [], scheduled = new Set();
  const frustum = new THREE.Frustum(), mvp = new THREE.Matrix4(), target = new THREE.Vector3();
  let renderer, map, city, runtime, timer, simulationTimer, abortController, shadows;
  let disposed = false, visible = true, detailed = true, labelsEnabled = true, ready = false;
  let lastRender = 0, lastTick = 0, animationTime = 0, simulationTime = 0;
  let themeName = 'day';

  const requestFrame = () => { if (!disposed && !document.hidden) map?.triggerRepaint(); };
  function status(text, state = 'loading', fraction) {
    performance.mark(`scene:${text}`);
    const element = document.getElementById('scene-status');
    if (element) { element.textContent = text; element.dataset.state = state; }
    document.documentElement.dataset.scene = state;
    window.dispatchEvent(new CustomEvent('vegas-progress', { detail: { text, state, fraction } }));
  }
  // The city's three groups join the scene as soon as they exist and fill in phase by phase,
  // so the skyline is on screen long before the last street lamp is built.
  let parts = null;
  function attach(groups) {
    parts = groups;
    groups.buildings.visible = visible;
    groups.roads.visible = groups.detail.visible = detailed;
    scene.add(groups.buildings, groups.roads, groups.detail);
  }
  function reveal(phase) {
    if (disposed || !parts) return;
    scene.updateMatrixWorld(true);
    prepareMaterials(scene);
    theme.apply(themeName);
    performance.mark(`scene:reveal ${phase}`);
    window.dispatchEvent(new CustomEvent('vegas-city-reveal', { detail: { phase } }));
    requestFrame();
  }
  const engine = {
    scene, camera, afterRender: [], updaters: [],
    get canvas() { return map.getCanvas(); },
    get renderer() { return renderer; },
    get shadowSize() { return theme.uniforms.uNight.value < 0.7 ? 1024 : 0; },
    animate(object, update, bounds) {
      const entry = { object, update, bounds };
      (object.name === 'road users' ? simulationAnimations : animations).push(entry);
    },
    invalidate: requestFrame,
    progress: (text, fraction) => status(text, 'loading', fraction),
    attach,
    reveal,
    yield: () => new Promise(resolve => setTimeout(resolve, 0)),
    schedule(callback, delay) {
      const id = setTimeout(() => { scheduled.delete(id); if (!disposed) callback(); }, delay);
      scheduled.add(id);
      return id;
    },
    listen(object, type, listener, options) {
      object.addEventListener(type, listener, options);
      disposers.push(() => object.removeEventListener(type, listener, options));
    },
  };

  // This clock is independent of camera motion, landmark culling and reduced-motion
  // decoration. The source Driver still substeps each update for its actual physics.
  function tick() {
    clearTimeout(simulationTimer);
    if (disposed || document.hidden || !runtime) return;
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, Math.max(0, now - (lastTick || now)));
    lastTick = now;
    if (!runtime.fleet.paused) {
      simulationTime += dt;
      for (const animation of simulationAnimations) animation.update({ t: simulationTime, dt });
    }
    runtime.controls.advance(dt);
    requestFrame();
    simulationTimer = setTimeout(tick, 33);
  }

  async function load() {
    status('Loading Las Vegas…', 'loading', 0.02);
    try {
      abortController = new AbortController();
      const response = await fetch('landmarks/footprints.json', { signal: abortController.signal });
      if (!response.ok) throw new Error(`City data: HTTP ${response.status}`);
      const raw = await response.json();
      performance.mark('scene:json parsed');
      if (disposed) return;
      if (raw.origin.lat !== ORIGIN.lat || raw.origin.lon !== ORIGIN.lon) throw new Error('City coordinate origin does not match the map.');
      const data = decode(raw);
      performance.mark('scene:decoded');
      await engine.yield();
      if (disposed) return;
      city = await buildCity(data, engine);
      if (disposed) return;
      if (!parts) attach(city);
      performance.mark('scene:city built');
      window.__vegas = { scene, city, data }; // debugging hook: inspect the built city from the console
      scene.updateMatrixWorld(true);
      prepareMaterials(scene);
      runtime = startFleet(map, data, city, engine, prepareMaterials);
      runtime.labels.enabled = labelsEnabled;
      shadows = new Shadows(engine, () => runtime.controls.cur);
      for (const root of [city.buildings, city.detail]) shadows.addCasters(root);
      for (const deck of city.bridgeDecks) shadows.addCasters(deck);
      for (const animation of animations) {
        if (!animation.bounds || animation.bounds.radius > 2000) {
          animation.bounds = new THREE.Box3().setFromObject(animation.object).getBoundingSphere(new THREE.Sphere());
        }
      }
      theme.apply(themeName);
      ready = true;
      status('Live city', 'ready');
      requestFrame();
      tick();
      window.dispatchEvent(new CustomEvent('vegas-landmarks-ready', { detail: { footprints: data.buildings.length } }));
    } catch (error) {
      if (disposed || error.name === 'AbortError') return;
      status('City unavailable · reload to retry', 'error');
      console.error('Unable to prepare Las Vegas:', error);
    }
  }

  return {
    id: 'vegas-threejs-landmarks', type: 'custom', renderingMode: '3d',
    onAdd(mapInstance, gl) {
      map = mapInstance;
      const origin = maplibregl.MercatorCoordinate.fromLngLat([ORIGIN.lon, ORIGIN.lat], 0);
      const scale = origin.meterInMercatorCoordinateUnits();
      this.modelMatrix = new THREE.Matrix4().set(
        scale, 0, 0, origin.x, 0, 0, scale, origin.y,
        0, scale, 0, origin.z, 0, 0, 0, 1,
      );
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      engine.listen(document, 'visibilitychange', () => {
        clearTimeout(timer); clearTimeout(simulationTimer);
        lastTick = 0;
        if (!document.hidden) { requestFrame(); tick(); }
      });
      load();
    },
    setTheme(name) {
      if (!['day', 'golden', 'night'].includes(name)) return;
      themeName = name;
      theme.apply(name, reducedMotion.matches ? 0 : 0.8);
      requestFrame();
    },
    setBuildingsVisible(next) {
      visible = next;
      if (city) city.buildings.visible = next;
      requestFrame();
    },
    setStreetsVisible(next) {
      detailed = next;
      if (city) city.roads.visible = city.detail.visible = next;
      requestFrame();
    },
    setLabelsVisible(next) {
      labelsEnabled = next;
      if (runtime) { runtime.labels.enabled = next; runtime.labels.lastKey = ''; runtime.labels.update(); }
      requestFrame();
    },
    getFollowElevation() { return runtime?.controls.targetElevation || 0; },
    stopFollowing() {
      if (runtime) {
        if (runtime.controls.driving) runtime.fleet.setManual(false);
        runtime.fleet.following = false;
        runtime.fleet.onChange();
      }
    },
    updateEgoVehiclePose() { /* The imported Fleet owns all road users. */ },
    render(gl, matrix) {
      if (disposed) return;
      clearTimeout(timer);
      const now = performance.now() / 1000, dt = Math.min(now - (lastRender || now), 0.1);
      lastRender = now;
      const transitioning = theme.step(dt);
      scene.fog.color.copy(theme.c('fog'));
      scene.fog.density = theme.current.fogDensity * 0.35;
      animationTime += reducedMotion.matches ? 0 : dt;
      theme.uniforms.uTime.value = animationTime;
      sun.position.copy(theme.uniforms.uSunDir.value).multiplyScalar(1000);
      sun.intensity = theme.uniforms.uSun.value;
      ambient.intensity = theme.uniforms.uAmbient.value;
      mvp.fromArray(matrix).multiply(this.modelMatrix);
      frustum.setFromProjectionMatrix(mvp);

      const center = map.getCenter(), [cx, cz] = toLocal(center.lat, center.lng);
      const pitch = map.getPitch() * Math.PI / 180, bearing = map.getBearing() * Math.PI / 180;
      const pixelsPerMeter = 512 * 2 ** map.getZoom() / (2 * Math.PI * 6378137 * Math.cos(center.lat * Math.PI / 180));
      const distance = map.getCanvas().clientHeight * 1.5 / pixelsPerMeter;
      const horizontal = distance * Math.sin(pitch), elevation = this.getFollowElevation();
      camera.position.set(cx - Math.sin(bearing) * horizontal, elevation + distance * Math.cos(pitch), mercatorSouth(cz) + Math.cos(bearing) * horizontal);
      camera.up.set(0, 1, 0);
      camera.lookAt(target.set(cx, elevation, mercatorSouth(cz)));
      camera.updateMatrix(); camera.updateMatrixWorld(true);
      camera.projectionMatrix.multiplyMatrices(mvp, camera.matrixWorld);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      runtime?.controls.sync();

      renderer.resetState();
      let updating = false;
      const simulationFrame = { t: simulationTime, dt: runtime?.fleet.paused ? 0 : dt };
      for (const updater of engine.updaters) updating = updater(simulationFrame) || updating;
      if (ready) {
        for (const animation of animations) {
          if (!animation.object.parent || (animation.bounds && !frustum.intersectsSphere(animation.bounds))) continue;
          animation.update({ t: animationTime, dt });
        }
      }
      renderer.resetState();
      renderer.clearDepth();
      renderer.render(scene, camera);
      for (const callback of engine.afterRender) callback({ t: simulationTime, dt });
      if (!document.hidden && (transitioning || updating || (!runtime && ready))) timer = setTimeout(requestFrame, transitioning ? 16 : 50);
    },
    onRemove() {
      disposed = true;
      clearTimeout(timer); clearTimeout(simulationTimer);
      abortController?.abort();
      for (const id of scheduled) clearTimeout(id);
      for (const dispose of disposers) dispose();
      runtime?.destroy();
      shadows?.rt?.dispose();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of [].concat(object.material || [])) materials.add(material);
      });
      for (const material of materials) {
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        for (const uniform of Object.values(material.uniforms || {})) if (uniform.value?.isTexture) textures.add(uniform.value);
        material.dispose();
      }
      for (const geometry of geometries) geometry.dispose();
      for (const texture of textures) texture.dispose();
      renderer?.dispose();
    },
  };
};
