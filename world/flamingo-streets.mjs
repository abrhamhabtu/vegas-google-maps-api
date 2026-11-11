import { toLocal } from '../landmarks/georeference.mjs';

const center = toLocal(36.11468, -115.17288);
export const FLAMINGO_PAVEMENT = {
  center,
  color: 'roadFlamingo',
  innerRadius: 105,
  outerRadius: 185,
};

const approachNames = new Set([
  'South Las Vegas Boulevard',
  'East Flamingo Road',
  'West Flamingo Road',
]);

export function isFlamingoApproach(edge) {
  if (edge.internal || edge.elevated || !approachNames.has(edge.way.name)) return false;
  const [startX, startZ] = edge.ref.pts[0];
  const [endX, endZ] = edge.ref.pts.at(-1);
  return Math.hypot((startX + endX) / 2 - center[0], (startZ + endZ) / 2 - center[1]) < 155;
}

export function hasFlamingoConcreteMedian(edge) {
  return edge.way.name === 'South Las Vegas Boulevard' && isFlamingoApproach(edge) &&
    edge.ref.pts[0][1] < center[1] && edge.ref.pts.at(-1)[1] < center[1];
}

export function isFlamingoJunction(x, z) {
  return Math.hypot(x - center[0], z - center[1]) < 12;
}
