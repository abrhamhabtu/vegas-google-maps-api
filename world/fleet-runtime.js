import { Fleet } from '../landmarks/vendor/sim/fleet.js';
import { Labels } from '../landmarks/vendor/ui/labels.js';
import { createMapControls } from './map-camera.mjs';
import { mountFleetPanel } from './fleet-panel.js';
import { createRoadSurface } from './road-surface.mjs';

export function startFleet(map, data, city, engine, prepareMaterials) {
  let fleet;
  const controls = createMapControls(map, () => fleet);
  fleet = new Fleet(engine, controls, city.graph, data);
  let roadSurface;
  const originalManualStep = fleet.manualStep.bind(fleet);
  fleet.manualStep = (car, dt) => {
    const { x, z } = car;
    originalManualStep(car, dt);
    const step = Math.hypot(car.x - x, car.z - z);
    roadSurface ??= createRoadSurface(city.graph);
    car.y = roadSurface.heightAt(car.x, car.z, car.y, Math.max(0.3, step * 0.18));
  };
  fleet.listen = (type, listener, options) => engine.listen(window, type, listener, options);
  fleet.paused = false;
  const originalMake = fleet.make.bind(fleet);
  fleet.make = (...args) => {
    const car = originalMake(...args);
    prepareMaterials(car.vehicle.root);
    return car;
  };
  engine.scene.add(fleet.group);
  prepareMaterials(fleet.group);
  fleet.setPaused = value => {
    fleet.paused = Boolean(value);
    fleet.keys.clear();
    fleet.onChange();
    engine.invalidate();
  };
  fleet.resetRun = () => {
    fleet.endScenario();
    fleet.setManual(false);
    fleet.paused = false;
    fleet.telemetry = { seconds: 0, metres: 0, collisions: 0, redLights: 0, aeb: 0, hardStops: 0, passes: 0, yields: 0, lane: 0, samples: 0 };
    fleet.lastResult = null;
    const robotaxis = fleet.cars.filter(car => car.role === 'robotaxi');
    robotaxis.forEach((car, i) => { car.driver = null; car.pickup = null; car.dropoff = null; car.v = 0; car.y = 0; car.phase = 'cruising'; fleet.seed(car, i); });
    for (const car of fleet.cars.filter(car => car.role === 'traffic')) { car.vehicle.root.visible = false; car.driver = null; }
    fleet.onChange();
    engine.invalidate();
  };
  mountFleetPanel(fleet, engine, { onFollowingChange: following => {
    document.body.classList.toggle('following-car', following);
    if (following) document.getElementById('view-title').textContent = `${fleet.selected.name} · live drive`;
  } });
  const labels = new Labels(engine, controls, data, city.heightAt);
  fleet.start();
  document.body.classList.add('road-world-active');
  window.vegasFleet = fleet;
  return { fleet, controls, labels, destroy() {
    clearInterval(fleet.uiInterval);
    controls.driving = false;
    delete window.vegasFleet;
    document.getElementById('driving-ui')?.replaceChildren();
    document.getElementById('labels')?.replaceChildren();
  } };
}
