import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoadSurface, sameRoadLevel } from '../world/road-surface.mjs';

const mk = (pts, y) => ({ line: { pts, y } });
test('picks the deck nearest current height and separates levels', () => {
  const s = createRoadSurface({ lanes: [mk([[0, 0], [100, 0]], [0, 0]), mk([[0, 0], [100, 0]], [10, 10])] });
  assert.equal(s.heightAt(50, 0, 0), 0);
  assert.equal(s.heightAt(50, 0, 9), 10);
  assert.equal(s.heightAt(500, 500, 3), 0);
  assert.ok(!sameRoadLevel({ y: 0 }, { y: 10 }));
  assert.ok(sameRoadLevel({ y: 0 }, { y: 1 }));
});
