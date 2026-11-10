import test from 'node:test';
import assert from 'node:assert/strict';
import { capsuleInterval, createRoadIndex, isRoadFootprint, planRailways, sampleRail, RAIL_STYLES, ROAD_CLEARANCE } from '../world/rail-network.mjs';

const roadLine = (pts, y = 0, width = 3.5) => ({ line: { pts, y: pts.map(() => y) }, width });

test('capsule crossings include parallel, skew and endpoint overlaps', () => {
  assert.deepEqual(capsuleInterval([-10, 0], [10, 0], [0, -10], [0, 10], 2), [0.4, 0.6]);
  assert.deepEqual(capsuleInterval([-10, 1], [10, 1], [-5, 0], [5, 0], 1), [0.25, 0.75]);
  assert.equal(capsuleInterval([-10, 2], [10, 2], [-5, 0], [5, 0], 1), null);
  assert.ok(capsuleInterval([0, 0], [10, 10], [4, 3], [4, 4], 0.5));
});

test('support masks include raised decks, raw lanes and an entire support footprint', () => {
  const lane = roadLine([[0, -100], [0, 100]], 12.5);
  lane.raw = { pts: [[15, -100], [15, 100]], y: [0, 0] };
  const index = createRoadIndex({ lanes: [lane], hulls: [[[40, 40], [50, 40], [50, 50], [40, 50]]] });
  assert.ok(isRoadFootprint(index, 0, 0));
  assert.ok(isRoadFootprint(index, 15, 0));
  assert.ok(isRoadFootprint(index, 3.5, 0, 1));
  assert.ok(isRoadFootprint(index, 39, 45, 1));
  assert.equal(isRoadFootprint(index, 30, 0, 1), false);
  assert.deepEqual(index.query([1000, 1000, 1010, 1010]), []);
});

test('inside fills of tight service-drive corners exclude supports between connector lanes', () => {
  const lanes = [roadLine([[-9, 0], [0, 0]], 0, 1), roadLine([[0, 0], [0, 10]], 0, 1), roadLine([[0, 10], [9, 10]], 0, 1)];
  lanes.forEach((lane, id) => Object.assign(lane, { edge: 0, prev: id ? [id - 1] : [], next: id < 2 ? [id + 1] : [] }));
  const graph = { lanes, edges: [{ cls: 'service' }] };
  assert.equal(isRoadFootprint(createRoadIndex(graph), -3, 5), false);
  lanes[1].connector = true;
  assert.equal(isRoadFootprint(createRoadIndex(graph), -3, 5), true);
});

test('carriageway envelopes cover turning-lane flares and pavement outside lane centres', () => {
  const edge = {
    ref: { pts: [[0, -50], [0, 50]], y: [6.5, 6.5], cum: [0, 100], length: 100 },
    lanes: [0, 1, 2], laneWidth: 3, oneway: true,
    jointStart: [-2, 3, 7, 12], taperStart: 30,
  };
  const index = createRoadIndex({ edges: [edge], lanes: [] });
  assert.ok(isRoadFootprint(index, -11.8, -49));
  assert.ok(isRoadFootprint(index, -8.8, 20));
  assert.equal(isRoadFootprint(index, -30, 20), false);
});

const railWay = (pts, k = 'monorail') => ({ pts, k, br: 1 });

test('a raised road crossing clears cars across the full deck width with gentle approach ramps', () => {
  const data = { rail: [railWay([[-400, 0], [400, 0]])] };
  const graph = { lanes: [roadLine([[0, -200], [0, 200]], 12.5, 7)] };
  const { lines: [line] } = planRailways(data, graph);
  const style = RAIL_STYLES.monorail;
  for (let x = -6; x <= 6; x += 0.25) {
    const p = sampleRail(line, x + 400);
    assert.ok(p.height - style.depth >= 12.5 + ROAD_CLEARANCE + 0.18 - 1e-7, `Clearance at x=${x}`);
  }
  for (let i = 1; i < line.points.length; i++) {
    const length = Math.hypot(line.points[i][0] - line.points[i - 1][0], line.points[i][1] - line.points[i - 1][1]);
    assert.ok(Math.abs(line.heights[i] - line.heights[i - 1]) <= length * style.grade + 1e-7);
  }
  assert.equal(line.heights[0], style.height);
  assert.equal(line.heights.at(-1), style.height);
  assert.deepEqual(data.rail[0].pts, [[-400, 0], [400, 0]]);
});

test('a road beside a parallel guideway reserves the whole guideway rather than only centre crossings', () => {
  const { lines: [line] } = planRailways({ rail: [railWay([[-80, 0], [80, 0]], 'funicular')] }, {
    lanes: [roadLine([[-60, 2.5], [60, 2.5]], 6.5, 3.5)],
  });
  assert.ok(sampleRail(line, 80).height - RAIL_STYLES.funicular.depth >= 6.5 + ROAD_CLEARANCE + 0.18 - 1e-7);
});

test('height constraints continue through shared and nearly shared way endpoints', () => {
  const { lines } = planRailways({ rail: [railWay([[-250, 0], [0, 0]]), railWay([[0.1, 0], [250, 0]])] }, {
    lanes: [roadLine([[8, -80], [8, 80]], 12.5)],
  });
  assert.equal(lines[0].heights.at(-1), lines[1].heights[0]);
  assert.ok(lines[0].heights.at(-1) > RAIL_STYLES.monorail.height + 5);
  assert.ok(sampleRail(lines[0], 200).height > RAIL_STYLES.monorail.height);
});

test('pier placement shifts off ground service drives, raised roads and junction interiors', () => {
  const graph = {
    lanes: [roadLine([[15, -50], [15, 50]], 0, 6), roadLine([[75, -50], [75, 50]], 12.5, 6)],
    hulls: [[[100, -10], [140, -10], [140, 10], [100, 10]]],
  };
  const { lines: [line] } = planRailways({ rail: [railWay([[-150, 0], [180, 0]])] }, graph);
  assert.ok(line.piers.length >= 5);
  for (const pier of line.piers) {
    assert.ok(Math.abs(pier.x - 15) > 3 + Math.SQRT2 * 0.7);
    assert.ok(Math.abs(pier.x - 75) > 3 + Math.SQRT2 * 0.7);
    assert.ok(pier.x < 100 - Math.SQRT2 * 0.7 || pier.x > 140 + Math.SQRT2 * 0.7);
    assert.ok(pier.height > 0);
  }
});

test('unrelated elevated roads do not raise a guideway or mutate the input', () => {
  const data = { rail: [railWay([[-100, 0], [100, 0]]), railWay([[0, 20], [80, 20]], 'rail'), { ...railWay([[0, 30], [80, 30]], 'funicular'), br: undefined }] };
  const graph = { lanes: [roadLine([[-100, 1000], [100, 1000]], 100)] };
  const before = JSON.stringify({ data, graph });
  const { lines } = planRailways(data, graph);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].heights.every(height => height === 9.5));
  assert.equal(JSON.stringify({ data, graph }), before);
});
