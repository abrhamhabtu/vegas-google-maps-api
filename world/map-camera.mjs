import { toLocal, toLngLat } from '../landmarks/georeference.mjs';

const R = 6378137, D = Math.PI / 180;
export function nearestAngle(angle, reference) {
  return reference + Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference));
}
export function distanceToZoom(distance, height, latitude) {
  return Math.log2(height * 1.5 * 2 * Math.PI * R * Math.cos(latitude * D) / (512 * Math.max(9, distance)));
}
export function zoomToDistance(zoom, height, latitude) {
  return height * 1.5 * 2 * Math.PI * R * Math.cos(latitude * D) / (512 * 2 ** zoom);
}

/** Source MapControls interface, backed by the existing geographic map camera. */
export function createMapControls(map, getFleet) {
  const controls = { cur: {}, goal: {}, minDist: 9, maxPitch: 1.42, targetElevation: 0 };
  let driving = false;
  Object.defineProperty(controls, 'driving', {
    get: () => driving,
    set(value) {
      driving = Boolean(value);
      if (driving) map.keyboard.disable(); else map.keyboard.enable();
    },
  });
  function read() {
    const c = map.getCenter(), [x, z] = toLocal(c.lat, c.lng);
    return { x, z, dist: zoomToDistance(map.getZoom(), map.getCanvas().clientHeight, c.lat), pitch: map.getPitch() * D,
      yaw: nearestAngle(-map.getBearing() * D, controls.cur.yaw || 0) };
  }
  function options(view) {
    const center = toLngLat(view.x, view.z);
    return { center, zoom: Math.max(11, Math.min(23.5, distanceToZoom(view.dist, map.getCanvas().clientHeight, center[1]))),
      pitch: Math.min(81, view.pitch / D), bearing: -view.yaw / D };
  }
  Object.assign(controls.cur, read());
  Object.assign(controls.goal, controls.cur);
  controls.flyTo = (view, seconds = 1) => {
    Object.assign(controls.goal, view);
    controls.goal.yaw = nearestAngle(controls.goal.yaw, controls.cur.yaw);
    controls.targetElevation = Math.max(0, getFleet()?.selected.y || 0);
    map.easeTo({ ...options(controls.goal), duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : seconds * 1000 });
  };
  controls.sync = () => {
    Object.assign(controls.cur, read());
    if (!getFleet()?.following) Object.assign(controls.goal, controls.cur);
  };
  controls.advance = dt => {
    const fleet = getFleet();
    if (!fleet?.following) {
      controls.targetElevation = 0;
      controls.sync();
      return;
    }
    controls.targetElevation = Math.max(0, fleet.selected.y || 0);
    if (map.isEasing()) { Object.assign(controls.cur, read()); return; }
    const k = 1 - Math.exp(-dt * 10), cur = controls.cur, goal = controls.goal;
    goal.yaw = nearestAngle(goal.yaw, cur.yaw);
    for (const key of ['x', 'z', 'dist', 'pitch', 'yaw']) cur[key] += (goal[key] - cur[key]) * k;
    map.jumpTo(options(cur));
  };
  return controls;
}
