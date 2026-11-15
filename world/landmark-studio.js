import { studioModels } from './landmark-models.js';
import { theme } from '../landmarks/vendor/core/theme.js';
import { decode } from '../landmarks/vendor/core/data.js';
import { buildLaneGraph } from '../landmarks/vendor/map/lanegraph.js';
import { toLngLat } from '../landmarks/georeference.mjs';

const THREE = window.THREE;
const byId = id => document.getElementById(id);
const viewport = byId('viewport'), list = byId('model-list'), status = byId('model-status');
const download = byId('download-model'), exportStatus = byId('export-status');
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(39, 1, 0.15, 5000);
// The shared aureoles read exponential fog uniforms, even in an isolated scene.
scene.fog = new THREE.FogExp2('#d7e3ed', 0.00001);
const ambient = new THREE.HemisphereLight('#e0efff', '#8b817c', 1.55);
const sun = new THREE.DirectionalLight('#fff0d9', 1.35);
const swatches = { day: ['#d7e3ed', '#c2ccd0', '#8796a1'], golden: ['#dac9bd', '#bfa89a', '#847d87'], night: ['#192936', '#293b4e', '#526780'] };
let renderer, selected, current, cityData, graph, measure, backdrop, grid, capture, waiting = false, show = 'day', exportBusy = false;
let azimuth, elevation, range, drag;
let drawing = false;
const target = new THREE.Vector3();
const cache = new Map();
const engine = { animate() {}, invalidate() {} }; // construction poses in the studio are static
let lastPaint = 0, transition = false;

function draw() {
  if (drawing || !renderer) return;
  drawing = true;
  requestAnimationFrame(time => {
    drawing = false;
    const dt = Math.min(0.07, (time - (lastPaint || time)) / 1000);
    lastPaint = time;
    transition = theme.step(dt);
    sun.position.copy(theme.uniforms.uSunDir.value).multiplyScalar(1000);
    sun.intensity = theme.uniforms.uSun.value * 1.3;
    ambient.intensity = theme.uniforms.uAmbient.value * 1.35;
    const h = Math.cos(elevation) * range;
    camera.position.set(target.x + Math.sin(azimuth) * h, target.y + Math.sin(elevation) * range, target.z + Math.cos(azimuth) * h);
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (transition) draw();
  });
}
function lighting(name, animate = true) {
  show = name;
  theme.apply(name, animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.37 : 0);
  viewport.dataset.light = name;
  const [bg, floor, lines] = swatches[name];
  scene.background.set(bg);
  scene.fog.color.set(bg);
  backdrop.material.color.set(floor);
  grid.material.color.set(lines);
  document.querySelectorAll('[data-light]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.light === name));
  });
  updateLinks();
  draw();
}
function resize() {
  const { clientWidth: w, clientHeight: h } = viewport;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (current) resetView();
}
function radiusFor(box) {
  return Math.max(5, box.getSize(new THREE.Vector3()).length() * 0.5);
}
function resetView() {
  if (!measure) return;
  azimuth = (180 - selected.bearing) * Math.PI / 180;
  elevation = selected.id === 'crystals' ? 0.57 : 0.39;
  // Fit the projected bounds from this angle. A circumscribed sphere leaves
  // slender towers and long campuses very small on screen.
  const forward = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
  const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
  const up = new THREE.Vector3().crossVectors(forward, right);
  const view = measure.points.map(p => [p.dot(right), p.dot(up), p.dot(forward)]);
  const middle = i => (Math.min(...view.map(p => p[i])) + Math.max(...view.map(p => p[i]))) / 2;
  const mx = middle(0), my = middle(1), mz = middle(2);
  target.copy(right).multiplyScalar(mx).addScaledVector(up, my).addScaledVector(forward, mz);
  const tanY = Math.tan(camera.fov * Math.PI / 360) * 0.79, tanX = tanY * camera.aspect;
  range = Math.max(...view.map(([x, y, z]) => z - mz + Math.max(Math.abs(x - mx) / tanX, Math.abs(y - my) / tanY)));
  camera.far = Math.max(2500, range * 5);
  camera.updateProjectionMatrix();
  draw();
}
function stepZoom(factor) {
  if (!measure) return;
  range = THREE.MathUtils.clamp(range * factor, measure.radius * 0.68, Math.max(measure.radius * 10, range * 1.001));
  draw();
}
function orbit(radians) { azimuth += radians; draw(); }
function updateLinks() {
  const referred = new URLSearchParams(location.search).get('from');
  const activeTheme = show;
  if (referred && /^[a-z0-9-]+$/.test(referred)) byId('back-to-map').href = './#' + new URLSearchParams({ theme: activeTheme, view: referred });
  if (selected) byId('model-map-link').href = './#' + new URLSearchParams({ theme: activeTheme, view: selected.view ?? selected.id });
}
function build(item) {
  if (cache.has(item.id)) return cache.get(item.id);
  if (item.needsGraph) graph ??= buildLaneGraph(cityData);
  const root = item.build(cityData, { standalone: true }, engine, graph);
  const box = new THREE.Box3(), bounds = [];
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!object.isMesh || object.material?.blending === THREE.AdditiveBlending || !object.visible) return;
    if (object.isInstancedMesh) {
      object.computeBoundingBox();
      bounds.push(object.boundingBox.clone().applyMatrix4(object.matrixWorld));
    } else {
      object.geometry.computeBoundingBox();
      bounds.push(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    }
  });
  for (const boundsOfMesh of bounds) box.union(boundsOfMesh);
  if (box.isEmpty()) throw new Error('This model has no geometry in the city snapshot.');
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const anchor = [center.x, center.z], local = new THREE.Group();
  local.name = item.title;
  local.userData = { attribution: 'Footprints © OpenStreetMap contributors (ODbL)', location: toLngLat(...anchor), units: 'metres' };
  root.position.x -= center.x;
  root.position.z -= center.z;
  // The model is in local metres. Moving it here changes its origin, not scale.
  local.add(root);
  const points = bounds.flatMap(({ min, max }) => [min.x, max.x].flatMap(x => [min.y, max.y].flatMap(y =>
    [min.z, max.z].map(z => new THREE.Vector3(x - center.x, y, z - center.z)))));
  const entry = { group: local, size, points, radius: radiusFor(box) };
  cache.set(item.id, entry);
  return entry;
}
function select(item) {
  selected = item;
  for (const button of list.children) button.setAttribute('aria-current', String(button.dataset.id === item.id));
  const idx = studioModels.indexOf(item) + 1;
  byId('model-title').textContent = item.title;
  byId('model-district').textContent = `MODEL ${String(idx).padStart(2,'0')} / ${item.district}`;
  byId('model-note').textContent = item.description;
  byId('model-size').textContent = '';
  download.disabled = true;
  updateLinks();
  history.replaceState(null, '', '#' + item.id);
  if (current) scene.remove(current);
  current = null;
  measure = null;
  status.textContent = 'Preparing model…';
  if (!cityData || waiting) return;
  waiting = true;
  requestAnimationFrame(() => {
    waiting = false;
    const active = selected;
    try {
      const result = build(active);
      current = result.group;
      measure = result;
      scene.add(current);
      backdrop.scale.setScalar(Math.max(1, measure.radius / 130));
      grid.scale.setScalar(backdrop.scale.x);
      status.textContent = '';
      download.disabled = exportBusy;
      byId('model-size').textContent = `≈ ${Math.round(measure.size.y)} m tall · Drag to orbit · Scroll to zoom`;
      resetView();
    } catch (error) {
      status.textContent = 'This model could not load. Choose another building or reload.';
      console.error(error);
    }
  });
}
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.9));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.background = new THREE.Color();
  backdrop = new THREE.Mesh(new THREE.CircleGeometry(385, 100).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial());
  backdrop.position.y = -0.23;
  const lines = [];
  for (let i = -18; i <= 18; i++) {
    const cross = Math.sqrt(380 * 380 - i * i * 20 * 20);
    lines.push(i * 20, -0.184, -cross, i * 20, -0.184, cross, -cross, -0.184, i * 20, cross, -0.184, i * 20);
  }
  const gridGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.19 }));
  scene.add(backdrop, grid, ambient, sun);
  azimuth = 0; elevation = 0.4; range = 500;
  viewport.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D model. Use arrow keys to orbit and + or − to zoom.');
  renderer.domElement.tabIndex = 0;
  new ResizeObserver(resize).observe(viewport);
  lighting('day', false);
  resize();

  capture = renderer.domElement;
  capture.addEventListener('pointerdown', event => {
    drag = { x: event.clientX, y: event.clientY };
    capture.setPointerCapture(event.pointerId);
  });
  capture.addEventListener('pointermove', event => {
    if (!drag) return;
    azimuth -= (event.clientX - drag.x) * 0.008;
    elevation = THREE.MathUtils.clamp(elevation + (event.clientY - drag.y) * 0.006, 0.04, 1.47);
    drag = { x: event.clientX, y: event.clientY };
    draw();
  });
  capture.addEventListener('lostpointercapture', () => { drag = null; });
  capture.addEventListener('wheel', event => { event.preventDefault(); stepZoom(Math.exp(Math.sign(event.deltaY) * 0.14)); }, { passive: false });
  capture.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') orbit(-0.19);
    else if (event.key === 'ArrowRight') orbit(0.19);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      elevation = THREE.MathUtils.clamp(elevation + (event.key === 'ArrowUp' ? 0.12 : -0.12), 0.04, 1.47);
      draw();
    } else if (event.key === '+' || event.key === '=') stepZoom(0.84);
    else if (event.key === '-') stepZoom(1.18);
    else if (event.key === 'Home') resetView();
    else return;
    event.preventDefault();
  });
  byId('orbit-left').onclick = () => orbit(-0.27);
  byId('orbit-right').onclick = () => orbit(0.27);
  byId('zoom-out').onclick = () => stepZoom(1.18);
  byId('zoom-in').onclick = () => stepZoom(0.84);
  byId('reset-model').onclick = resetView;
  document.querySelectorAll('button[data-light]').forEach(button => { button.onclick = () => lighting(button.dataset.light); });

  studioModels.forEach((item, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'model-choice';
    button.dataset.id = item.id;
    button.style.setProperty('--model-color', item.color);
    const n = document.createElement('small'), dot = document.createElement('i'), label = document.createElement('span');
    n.textContent = String(i + 1).padStart(2, '0'); n.setAttribute('aria-hidden', 'true');
    dot.setAttribute('aria-hidden', 'true');
    label.textContent = item.title;
    button.append(n, dot, label);
    button.addEventListener('click', () => select(item));
    list.append(button);
  });
  const initial = () => studioModels.find(item => '#' + item.id === location.hash) ?? studioModels[0];
  const query = new URLSearchParams(location.search);
  if (Object.hasOwn(swatches, query.get('theme'))) lighting(query.get('theme'), false);
  select(initial());
  addEventListener('hashchange', () => select(initial()));
  const response = await fetch('landmarks/footprints.json');
  if (!response.ok) throw new Error(`City snapshot returned HTTP ${response.status}`);
  cityData = decode(await response.json());
  select(selected);

  download.onclick = async () => {
    if (!current || exportBusy) return;
    const source = current, item = selected;
    exportBusy = true;
    download.disabled = true;
    download.firstChild.textContent = 'Preparing .glb ';
    exportStatus.textContent = `Exporting ${item.title}.`;
    try {
      const { landmarkGLB } = await import('./landmark-export.js');
      const bytes = await landmarkGLB(source);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `vegas-${item.id}.glb`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
      download.firstChild.textContent = 'Download .glb ';
      exportStatus.textContent = `${item.title} export ready.`;
    } catch (error) {
      download.firstChild.textContent = 'Retry download ';
      exportStatus.textContent = 'Could not export the model. Please try again.';
      console.error(error);
    } finally {
      exportBusy = false;
      download.disabled = !current;
    }
  };
} catch (error) {
  status.textContent = 'The 3D studio could not start. Reload to try again.';
  console.error(error);
}
