import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decode } from '../landmarks/vendor/core/data.js';
import { BRIDGE_SLAB_DEPTH, createRoadSurface, sameRoadLevel } from '../world/road-surface.mjs';

const mk = (pts, y) => ({ line: { pts, y } });
test('picks the deck nearest current height and separates levels', () => {
  const s = createRoadSurface({ lanes: [mk([[0, 0], [100, 0]], [0, 0]), mk([[0, 0], [100, 0]], [10, 10])] });
  assert.equal(s.heightAt(50, 0, 0), 0);
  assert.equal(s.heightAt(50, 0, 9), 10);
  assert.equal(s.heightAt(500, 500, 3), 0);
  assert.ok(!sameRoadLevel({ y: 0 }, { y: 10 }));
  assert.ok(sameRoadLevel({ y: 0 }, { y: 1 }));
});

test('a moving car follows its ramp grade and cannot snap to a deck above it', () => {
  const s = createRoadSurface({ lanes: [
    mk([[-100, 0], [100, 0]], [0, 0]),
    mk([[0, -20], [0, 20]], [5.5, 7.5]),
  ] });
  assert.equal(s.heightAt(0, 0, 0, 0.3), 0);
  assert.ok(Math.abs(s.heightAt(0, 1, 6.5, 0.3) - 6.55) < 1e-8);
  assert.equal(s.heightAt(0, 15, 0, 0.3), 0);
  assert.equal(s.heightAt(30, 0, 6.5, 0.3), 6.5);
});

test('the Russell Road deck holds its grade above the Terminal 3 exit ramp', () => {
  const raw = JSON.parse(readFileSync(new URL('../landmarks/footprints.json', import.meta.url), 'utf8'));
  const { roads } = decode(raw);
  const westbound = roads.find(r => r.id === 179220461);
  const ramp = roads.find(r => r.id === 158924739);
  const split = roads.find(r => r.id === 430920616);
  assert.ok(westbound.br);
  assert.ok(westbound.y.every(y => y - BRIDGE_SLAB_DEPTH >= 4.9));
  assert.equal(split.y[0], westbound.y.at(-1));
  assert.ok(!ramp.y || ramp.y.every(y => y < 0.05));
});
