import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowMarking, dashRuns, offsetStation, zebraBars } from '../world/road-visuals.mjs';

test('offset markings use the same reference cross section on curves', () => {
  const reference = { length: 20, cum: [0, 10, 20] };
  const laneEdge = { length: 24, cum: [0, 8, 24] };
  assert.equal(offsetStation(reference, laneEdge, 5), 4);
  assert.equal(offsetStation(reference, laneEdge, 10), 8);
  assert.equal(offsetStation(reference, laneEdge, 15), 16);
});

test('dash phase carries across road splits and keeps paint out of crosswalk space', () => {
  assert.deepEqual(dashRuns(1, 27, 3, 9, 4), [[8, 11], [20, 23]]);
  assert.deepEqual(dashRuns(0, 8, 3, 9, 11), [[1, 4]]);
});

test('a shared turn arrow stays within a narrowing lane and points both ways', () => {
  const points = arrowMarking(['left', 'right', 'through'], 2.5).flat();
  assert.ok(Math.min(...points.map(([u]) => u)) < -0.8);
  assert.ok(Math.max(...points.map(([u]) => u)) > 0.8);
  assert.ok(points.every(([u]) => Math.abs(u) <= 1.1));
  assert.deepEqual(arrowMarking(['left'], 1.5), []);
});

test('zebra stripes are centered and wholly inside the available crossing', () => {
  const stripes = zebraBars(-2.3, 4.2);
  assert.ok(stripes.length >= 4);
  assert.ok(stripes[0][0] >= -2.3 && stripes.at(-1)[1] <= 4.2);
  assert.ok(Math.abs(stripes[0][0] + stripes.at(-1)[1] - 1.9) < 1e-8);
});
