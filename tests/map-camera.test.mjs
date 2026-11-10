import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceToZoom, zoomToDistance, nearestAngle } from '../world/map-camera.mjs';

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
