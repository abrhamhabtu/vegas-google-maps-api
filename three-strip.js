/** Vegas v2 models over the existing Google map, sharing MapLibre's WebGL context. */
import { ORIGIN, toLocal, mercatorSouth, adaptVertexShader } from './landmarks/georeference.mjs';
import { theme } from './landmarks/vendor/core/theme.js';
import { buildBuildings } from './landmarks/vendor/map/buildings.js';
import { buildLandmarks } from './landmarks/vendor/landmarks/landmarks.js';
import { buildResorts } from './landmarks/vendor/landmarks/resorts.js';
import { buildArenas } from './landmarks/vendor/landmarks/arenas.js';
import { buildGuitar } from './landmarks/vendor/landmarks/guitar.js';
import { buildDetails } from './landmarks/vendor/landmarks/details.js';
import { welcomeSign } from './landmarks/vendor/landmarks/welcome.js';

const THREE = window.THREE;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const decodePoints = p => Array.from({ length: p.length / 2 }, (_, i) => [p[i * 2] / 10, p[i * 2 + 1] / 10]);

function decodeSnapshot(raw) {
  if (raw.origin.lat !== ORIGIN.lat || raw.origin.lon !== ORIGIN.lon) throw new Error('Landmark coordinate origin does not match the map adapter.');
  const decode = row => ({ ...row, pts: decodePoints(row.p) });
  return {
    ...raw,
    buildings: raw.buildings.map(decode),
    areas: raw.areas.map(decode),
    roads: raw.roads.map(decode),
    walks: raw.walks.map(decode),
    rail: raw.rail.map(decode),
    pois: raw.pois.map(p => ({ ...p, x: p.p[0] / 10, z: p.p[1] / 10 })),
  };
}

// All materials project in the same geographic frame, including instances and built-ins.
function prepareMaterials(root) {
  const materials = new Set();
  root.traverse(object => {
    for (const material of [].concat(object.material || [])) materials.add(material);
  });
  for (const material of materials) {
    if (material.userData.vegasProjected) continue;
    material.userData.vegasProjected = true;
    const previousCompile = material.onBeforeCompile;
    material.onBeforeCompile = function(shader, renderer) {
      previousCompile.call(this, shader, renderer);
      shader.vertexShader = adaptVertexShader(shader.vertexShader, THREE.ShaderChunk.project_vertex);
    };
    material.customProgramCacheKey = () => 'vegas-mercator-r160-v1';
    material.needsUpdate = true;
  }
}

function createEgoCar() {
  const group = new THREE.Group();
  const paint = new THREE.MeshBasicMaterial({ color: '#e8f0ed' });
  const glass = new THREE.MeshBasicMaterial({ color: '#183b46' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.05, 4.7), paint);
  body.position.y = 0.8;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.5), glass);
  cabin.position.set(0, 1.6, 0.1);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12), glass);
  lidar.position.y = 2.1;
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.45, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#24bba2', transparent: true, opacity: 0.6, depthWrite: false }));
  ring.position.y = 0.2;
  group.add(body, cabin, lidar, ring);
  return group;
}

window.createVegasThreeLayer = function() {
  const scene = new THREE.Scene();
  // Source glow shaders explicitly use exponential fog uniforms.
  scene.fog = new THREE.FogExp2(theme.c('fog'), 0.00003);
  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  const city = new THREE.Group();
  const ego = createEgoCar();
  ego.visible = false;
  scene.add(city, ego);
  const animations = [];
  const frustum = new THREE.Frustum();
  const mvp = new THREE.Matrix4();
  const target = new THREE.Vector3();
  let renderer, map, timer, abortController;
  let disposed = false, visible = true, ready = false;
  let lastTime = 0, animationTime = 0;
  let themeName = 'day';

  const requestFrame = () => { if (!disposed && !document.hidden) map?.triggerRepaint(); };
  const engine = {
    animate(object, update, bounds) { animations.push({ object, update, bounds }); },
  };

  function status(text, state) {
    const element = document.getElementById('scene-status');
    if (element) { element.textContent = text; element.dataset.state = state; }
    document.documentElement.dataset.scene = state;
  }

  async function load() {
    status('Loading landmarks…', 'loading');
    try {
      abortController = new AbortController();
      const response = await fetch('landmarks/footprints.json', { signal: abortController.signal });
      if (!response.ok) throw new Error(`Footprints: HTTP ${response.status}`);
      const data = decodeSnapshot(await response.json());
      if (disposed) return;
      // These builders share the same source snapshot and replacement ownership rules.
      city.add(buildLandmarks(data, engine));
      city.add(buildArenas(data, engine));
      city.add(buildGuitar(data, engine));
      city.add(buildResorts(data, engine).group);
      city.add(buildDetails(data, engine));
      city.add(welcomeSign(null, engine));
      const mask = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      mask.needsUpdate = true;
      city.add(buildBuildings(data, {
        canopies: new Set(), mask,
        maskOrigin: new THREE.Vector2(0, 0), maskSize: new THREE.Vector2(1, 1),
      }).group);
      city.updateMatrixWorld(true);
      prepareMaterials(scene);
      for (const animation of animations) {
        if (!animation.bounds || animation.bounds.radius > 2000) {
          animation.bounds = new THREE.Box3().setFromObject(animation.object).getBoundingSphere(new THREE.Sphere());
        }
      }
      theme.apply(themeName);
      ready = true;
      status('Landmarks ready', 'ready');
      requestFrame();
      window.dispatchEvent(new CustomEvent('vegas-landmarks-ready', { detail: { footprints: data.buildings.length } }));
    } catch (error) {
      if (disposed || error.name === 'AbortError') return;
      status('Landmarks unavailable · reload to retry', 'error');
      console.error('Unable to load Vegas landmarks:', error);
    }
  }

  return {
    id: 'vegas-threejs-landmarks', type: 'custom', renderingMode: '3d',
    onAdd(mapInstance, gl) {
      map = mapInstance;
      const origin = maplibregl.MercatorCoordinate.fromLngLat([ORIGIN.lon, ORIGIN.lat], 0);
      const scale = origin.meterInMercatorCoordinateUnits();
      // Source is +east/+up/+south; Mercator is +east/+south/+up.
      this.modelMatrix = new THREE.Matrix4().set(
        scale, 0, 0, origin.x,
        0, 0, scale, origin.y,
        0, scale, 0, origin.z,
        0, 0, 0, 1,
      );
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      document.addEventListener('visibilitychange', requestFrame);
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
      city.visible = next;
      clearTimeout(timer);
      requestFrame();
    },
    updateEgoVehiclePose(lat, lng, heading) {
      const [x, z] = toLocal(lat, lng);
      ego.position.set(x, 0.1, z);
      ego.rotation.y = -heading * Math.PI / 180;
      ego.visible = true;
      requestFrame();
    },
    render(gl, matrix) {
      if (disposed) return;
      clearTimeout(timer);
      const now = performance.now() / 1000;
      const dt = Math.min(now - (lastTime || now), 0.1);
      lastTime = now;
      const transitioning = theme.step(dt);
      scene.fog.color.copy(theme.c('fog'));
      scene.fog.density = theme.current.fogDensity * 0.35;
      animationTime += reducedMotion.matches ? 0 : dt;
      theme.uniforms.uTime.value = animationTime;

      mvp.fromArray(matrix).multiply(this.modelMatrix);
      frustum.setFromProjectionMatrix(mvp);
      let animateVisible = false;
      if (visible && ready && map.getZoom() > 12) {
        for (const animation of animations) {
          if (animation.bounds && !frustum.intersectsSphere(animation.bounds)) continue;
          animation.update({ t: animationTime, dt });
          animateVisible = true;
        }
      }

      // Give glass and reflective facades a real camera position while retaining
      // MapLibre's exact view/projection matrix for geometry placement.
      const center = map.getCenter();
      const [cx, cz] = toLocal(center.lat, center.lng);
      const pitch = map.getPitch() * Math.PI / 180, bearing = map.getBearing() * Math.PI / 180;
      const pixelsPerMeter = 512 * 2 ** map.getZoom() / (2 * Math.PI * 6378137 * Math.cos(center.lat * Math.PI / 180));
      const distance = map.getCanvas().clientHeight * 1.5 / pixelsPerMeter;
      const horizontal = distance * Math.sin(pitch);
      camera.position.set(cx - Math.sin(bearing) * horizontal, distance * Math.cos(pitch), mercatorSouth(cz) + Math.cos(bearing) * horizontal);
      camera.up.set(0, 1, 0);
      camera.lookAt(target.set(cx, 0, mercatorSouth(cz)));
      camera.updateMatrix();
      camera.updateMatrixWorld(true);
      camera.projectionMatrix.multiplyMatrices(mvp, camera.matrixWorld);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      renderer.resetState();
      renderer.clearDepth();
      renderer.render(scene, camera);
      // Map interactions render at native cadence; ambient shows run at 20fps.
      if (!document.hidden && (transitioning || (animateVisible && !reducedMotion.matches))) {
        timer = setTimeout(requestFrame, transitioning ? 16 : 50);
      }
    },
    onRemove() {
      disposed = true;
      clearTimeout(timer);
      abortController?.abort();
      document.removeEventListener('visibilitychange', requestFrame);
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
