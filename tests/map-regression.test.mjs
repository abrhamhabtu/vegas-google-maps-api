import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { toLngLat } from '../landmarks/georeference.mjs';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: { addEventListener() {} }, console });
vm.runInContext(source, context);
const evaluate = expression => vm.runInContext(expression, context);

test('AV lateral lane offsets retain 3.5m separation and travel direction', () => {
  for (const heading of [0, 45, 90, 180, 270, 350]) {
    const pose = evaluate(`offsetLatLngByLaneMeters(36.10305, -115.17275, ${heading}, 3.5)`);
    const distance = evaluate(`computeHaversineMiles(36.10305, -115.17275, ${pose.lat}, ${pose.lng})`) * 1609.344;
    const bearing = evaluate(`computeBearingDegrees(36.10305, -115.17275, ${pose.lat}, ${pose.lng})`);
    assert.ok(Math.abs(distance - 3.5) < 0.01);
    const error = ((bearing - heading - 90 + 540) % 360) - 180;
    assert.ok(Math.abs(error) < 0.01);
  }
});

test('existing AV corridors and MGM intersection remain available', () => {
  assert.deepEqual(Array.from(evaluate('Object.keys(PRESET_ROUTES)')), ['full-strip', 'strip-southbound', 'mgm-bruno-loop', 'sphere-loop']);
  assert.equal(evaluate('MGM_BRUNO_MARS_INTERSECTION.lat'), 36.10305);
  assert.equal(evaluate('MGM_BRUNO_MARS_INTERSECTION.lng'), -115.17275);
  for (const name of evaluate('Object.keys(PRESET_ROUTES)')) {
    const points = evaluate(`PRESET_ROUTES[${JSON.stringify(name)}].waypoints`);
    assert.ok(points.length >= 4);
    for (const point of points) {
      assert.ok(point.lat > 36.08 && point.lat < 36.14);
      assert.ok(point.lng > -115.18 && point.lng < -115.15);
    }
  }
});

test('snapshot contains required footprint models at their geographic sites', async () => {
  const data = JSON.parse(await readFile(new URL('../landmarks/footprints.json', import.meta.url), 'utf8'));
  const sites = [
    [/^luxor las vegas$/i, 36.0955, -115.1761],
    [/^sphere$/i, 36.1213, -115.1621],
    [/^eiffel tower$/i, 36.1125, -115.1722],
    [/^allegiant stadium$/i, 36.0908, -115.1833],
    [/^new las vegas stadium$/i, 36.09927, -115.170025],
    [/guitar tower/i, 36.121145, -115.172991],
    [/^resorts world las vegas$/i, 36.13477, -115.16621],
  ];
  for (const [pattern, lat, lng] of sites) {
    const footprint = data.buildings.find(b => pattern.test(b.name || ''));
    assert.ok(footprint, `Missing ${pattern}`);
    let x = 0, z = 0;
    for (let i = 0; i < footprint.p.length; i += 2) { x += footprint.p[i] / 10; z += footprint.p[i + 1] / 10; }
    const n = footprint.p.length / 2;
    const [actualLng, actualLat] = toLngLat(x / n, z / n);
    const distance = evaluate(`computeHaversineMiles(${lat}, ${lng}, ${actualLat}, ${actualLng})`) * 1609.344;
    assert.ok(distance < 100, `${pattern} is ${distance.toFixed(1)}m from its site`);
  }
  assert.ok(data.areas.some(area => area.k === 'water' && area.p.length > 30));
  assert.ok(data.pois.some(poi => /^high roller$/i.test(poi.n)));
});
