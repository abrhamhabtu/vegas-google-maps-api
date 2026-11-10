import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN, toLocal, toLngLat, mercatorSouth, projectionGLSL, adaptVertexShader } from '../landmarks/georeference.mjs';

const R = 6378137;
const D = Math.PI / 180;
const landmarks = [
  [36.0908, -115.1833], [36.09551, -115.17606], [36.10283, -115.17818],
  [36.11252, -115.17218], [36.12123, -115.16208], [36.13477, -115.16621],
  [36.1707, -115.1439],
];

test('source origin and landmark geographic round trips are preserved', () => {
  assert.deepEqual(ORIGIN, { lat: 36.11624, lon: -115.17455 });
  for (const [lat, lng] of landmarks) {
    const [x, z] = toLocal(lat, lng);
    const result = toLngLat(x, z);
    assert.ok(Math.abs(result[0] - lng) < 1e-10);
    assert.ok(Math.abs(result[1] - lat) < 1e-10);
  }
});

test('Mercator correction stays within one millimetre throughout the imported city', () => {
  const mercatorY = lat => Math.log(Math.tan(Math.PI / 4 + lat * D / 2));
  for (let z = -10000; z <= 10000; z += 100) {
    const lat = ORIGIN.lat - z / R / D;
    const exact = R * Math.cos(ORIGIN.lat * D) * (mercatorY(ORIGIN.lat) - mercatorY(lat));
    assert.ok(Math.abs(mercatorSouth(z) - exact) < 0.001, `Projection drift at ${z}m`);
  }
});

test('projection handles source shader paths including animated fountain instances', () => {
  const paths = [
    'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    'vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;',
    'vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;',
    'gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);',
    '#include <project_vertex>',
  ];
  for (const path of paths) {
    const adapted = adaptVertexShader(path);
    assert.ok((adapted.match(/vegasProject\(/g) || []).length >= 2, `No projection call in: ${path}`);
    assert.ok(!adapted.includes('modelViewMatrix * vec4'));
  }
  assert.ok(projectionGLSL.includes('vec4 vegasProject'));
  const fountain = adaptVertexShader(paths[3]);
  assert.ok(fountain.includes('vegasProject(modelMatrix * instanceMatrix * vec4(position, 1.0))'));
  const builtIn = adaptVertexShader('#include <project_vertex>', 'vec4 mvPosition = vec4(transformed, 1.0); mvPosition = modelViewMatrix * mvPosition; gl_Position = projectionMatrix * mvPosition;');
  assert.ok(builtIn.includes('viewMatrix * vegasProject(modelMatrix * mvPosition)'));
});
