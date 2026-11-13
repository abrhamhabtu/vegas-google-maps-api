import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decode } from '../landmarks/vendor/core/data.js';
import { planBridgeDecks } from '../world/bridge-decks.mjs';

globalThis.window = { THREE: {} };
const { boundaryAt, boundaryLine, buildLaneGraph, edgeLine, makeLine } = await import('../landmarks/vendor/map/lanegraph.js');

test('a divided bridge joins both road rims through a staggered split', () => {
  const edge = (id, pts, y) => ({
    id, cls: 'arterial', elevated: true, oneway: true, way: { name: 'Bridge Road', hw: 'primary' }, ref: makeLine(pts, y),
  });
  const east = edge(0, [[0, 4], [48, 4], [100, 4]], [2, 4.4, 7]);
  const west = edge(1, [[100, -3], [62, -3]], [7, 5.2]);
  const westApproach = edge(2, [[62, -3], [0, -3]], [5.2, 2.1]);
  const upper = edge(3, [[100, -1], [0, -1]], [14, 14]);
  const { spans, joined } = planBridgeDecks([east, west, westApproach, upper], e => e.ref);

  assert.deepEqual(joined.get(east.id), [[0, 48], [48, 62], [62, 100]]);
  assert.ok(!joined.has(upper.id));
  assert.deepEqual(spans[0].right.pts, [[0, 4], [48, 4]]);
  assert.deepEqual(spans[0].right.y, [2, 4.4]);
  assert.equal(spans[1].left.y[1], 5.2);
  assert.equal(spans[2].left.y[0], 5.2);
});

test('Paradise Road keeps its through lanes and its ramp joins aligned', () => {
  const raw = JSON.parse(readFileSync(new URL('../landmarks/footprints.json', import.meta.url), 'utf8'));
  const { edges, lanes } = buildLaneGraph(decode(raw));
  const byWay = id => edges.find(e => e.way.id === id);
  const main = byWay(430920613);
  const joins = [[byWay(1411342907), true], [byWay(1411342905), false]];
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01;

  assert.ok(main.joinAcross);
  for (let i = 0; i <= main.lanes.length; i++) {
    assert.ok(Math.abs(boundaryAt(main, i, main.ref.length / 2) - boundaryAt(main, i, 0)) < 0.1);
  }
  for (const [ramp, isMerge] of joins) {
    const mainEnd = line => isMerge ? line.pts[0] : line.pts.at(-1);
    const rampEnd = line => isMerge ? line.pts.at(-1) : line.pts[0];
    for (let i = 0; i <= 1; i++) {
      assert.ok(near(mainEnd(boundaryLine(main, 3 + i)), rampEnd(boundaryLine(ramp, i))));
    }
    const from = isMerge ? ramp.lanes[0] : main.lanes[3];
    const to = isMerge ? main.lanes[3] : ramp.lanes[0];
    assert.ok(lanes[from].next.some(id => lanes[id].next.includes(to)));
  }

  const tropicana = byWay(27831322);
  const rim = e => edgeLine(e, s => boundaryAt(e, 0, s) - 0.15);
  const { joined } = planBridgeDecks(edges, rim);
  const ranges = joined.get(tropicana.id);
  assert.ok(ranges[0][0] < 0.01);
  assert.ok(rim(tropicana).length - ranges.at(-1)[1] < 0.01);
  for (let i = 1; i < ranges.length; i++) assert.ok(ranges[i][0] - ranges[i - 1][1] < 0.01);
});
