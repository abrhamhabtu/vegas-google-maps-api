import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceToZoom, zoomToDistance, nearestAngle, extendCityDepth } from '../world/map-camera.mjs';

test('street-level camera distance and map zoom round trip on desktop and mobile', () => {
  for (const height of [844, 1224]) for (const distance of [15, 42, 85, 600, 2400]) {
    const zoom = distanceToZoom(distance, height, 36.11624);
    assert.ok(Math.abs(zoomToDistance(zoom, height, 36.11624) - distance) < 1e-8);
  }
});

test('follow bearing retains the nearest angle across north and complete revolutions', () => {
  const D = Math.PI / 180;
  assert.ok(Math.abs(nearestAngle(359 * D, 1 * D) - -1 * D) < 1e-12);
  assert.ok(Math.abs(nearestAngle(-90 * D, 270 * D) - 270 * D) < 1e-12);
  assert.ok(Math.abs(nearestAngle(181 * D, -179 * D) - -179 * D) < 1e-12);
});

test('a close driving camera can see the skyline without moving map points or the near plane', () => {
  const near = 0.2, far = 105, farCity = 9500, cameraZ = 14;
  const k = (far + near) / (far - near);
  // Perspective matrix with a translated and pitch-biased view: both the clip-Z
  // and clip-W rows depend on world Y and Z.
  const before = [3, 0, 0, 0, 0, 2, -0.24 * k, -0.24, 0, -1, -0.97 * k, -0.97,
    1, 2, cameraZ * k - 2 * far * near / (far - near), cameraZ];
  const m = before.slice();
  const project = (mat, x, y, z) => {
    const clip = [0, 1, 2, 3].map(i => mat[i] * x + mat[i + 4] * y + mat[i + 8] * z + mat[i + 12]);
    return clip.slice(0, 3).map(value => value / clip[3]);
  };
  assert.ok(extendCityDepth(m, near, far, farCity));
  const remote = 180 - (farCity - cameraZ) / 0.97;
  for (const point of [[2, 5, 6], [10, 150, -1500], [0, 0, remote]]) {
    const a = project(before, ...point), b = project(m, ...point);
    assert.deepEqual(a.slice(0, 2), b.slice(0, 2), 'only depth may change');
    assert.ok(b[2] > -1 && b[2] <= 1);
  }
  assert.ok(project(before, 10, 150, -1500)[2] > 1);
  assert.ok(Math.abs(project(m, 0, 0, (cameraZ - near) / 0.97)[2] + 1) < 1e-10);
  assert.ok(Math.abs(project(m, 0, 0, (cameraZ - farCity) / 0.97)[2] - 1) < 1e-10);
  assert.equal(extendCityDepth(m, near, farCity, far), false);
});
