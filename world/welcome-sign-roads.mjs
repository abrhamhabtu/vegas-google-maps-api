import { toLocal } from '../landmarks/georeference.mjs';
import { SIGN_LATLON } from '../landmarks/vendor/places.js';
import { roundSouthStripRoad } from './south-strip-roads.mjs';

export const WELCOME_SIGN_POINT = toLocal(SIGN_LATLON.lat, SIGN_LATLON.lon);
const [sx, sz] = WELCOME_SIGN_POINT;
export const WELCOME_AISLE = 135295758;
export const WELCOME_BOUNDS = [sx - 42, sz - 173, sx + 42, sz + 230];
export const atWelcome = (x, z) => Math.abs(x - sx) < 17 && z > sz - 171 && z < sz + 225;
const local = ([x, z]) => [sx + x, sz + z];
const parkingArea = area => area.k === 'parking' && area.pts.every(([x, z]) => atWelcome(x, z) && z > sz + 40);
const grassArea = area => area.k === 'park' && area.pts.every(([x, z]) => atWelcome(x, z));

// At each station the access lane is positioned from the driveable graph,
// which preserves the mapped southbound entrance and the curved return.
export function stationAtZ(line, z) {
  for (let i = 1; i < line.pts.length; i++) {
    const [, a] = line.pts[i - 1], [, b] = line.pts[i];
    if (z >= Math.min(a, b) && z <= Math.max(a, b) && a !== b) {
      return line.cum[i - 1] + (line.cum[i] - line.cum[i - 1]) * (z - a) / (b - a);
    }
  }
}

export function addWelcomeSignGround(data, layers, height, medianRims) {
  const raised = (layer, points, y) => {
    const { pts } = roundSouthStripRoad(points, points.map(() => 0), true);
    layer.at(...pts[0]).polygon(pts, y);
  };
  // Aerial imagery locates the landscaped island ends. The carriageway rims
  // determine their width, with a small overlap for the pavement cut.
  for (const [from, to] of [[-171, -124], [-117, 221]]) {
    const left = [], right = [];
    const steps = Math.ceil((to - from) / 4);
    for (let i = 0; i <= steps; i++) {
      const z = sz + from + (to - from) * i / steps;
      const rims = medianRims(z);
      if (!rims) continue;
      const endInset = Math.max(0, 5 - Math.min(z - sz - from, sz + to - z));
      left.push([rims[0] - 0.15 + endInset, z]);
      right.push([rims[1] + 0.15 - endInset, z]);
    }
    if (left.length >= 2) raised(layers.gravel, [...left, ...right.reverse()], height);
  }
  for (const area of data.areas) {
    if (parkingArea(area)) raised(layers.aisle, area.pts, 0);
    if (grassArea(area)) raised(layers.medianPlanting, area.pts, height + 0.012);
  }
  const plaza = [[-4.3, 13], [3.2, 13], [4.6, 17.5], [5.2, 45], [-1.7, 45], [-5.1, 23]];
  raised(layers.plaza, plaza.map(local), height);
}
