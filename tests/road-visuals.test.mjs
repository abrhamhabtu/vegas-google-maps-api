import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowMarking, dashRuns, offsetStation, widestClearSpan, zebraBars } from '../world/road-visuals.mjs';
import { surfaceMask, supportsTree } from '../world/road-planting.mjs';
import { finishSouthStripPavement } from '../world/south-strip-pavement.mjs';
import { finishStripCorridorPavement } from '../world/strip-corridor-pavement.mjs';
import { junctionOutline } from '../world/south-strip-roads.mjs';

globalThis.window = { THREE: {} };
const { guideClearsCrossing, paintSpans, planCrossingPaint } = await import('../world/road-crossings.mjs');

test('offset markings use the same reference cross section on curves', () => {
  const reference = { length: 20, cum: [0, 10, 20] };
  const laneEdge = { length: 24, cum: [0, 8, 24] };
  assert.equal(offsetStation(reference, laneEdge, 5), 4);
  assert.equal(offsetStation(reference, laneEdge, 10), 8);
  assert.equal(offsetStation(reference, laneEdge, 15), 16);
  const rounded = { length: 20, cum: [0, 5, 10, 20] };
  const offset = { length: 24, cum: [0, 3, 8, 24], reference: rounded };
  assert.equal(offsetStation(reference, offset, 15), 16);
});

test('a right-angle intersection joins the curb rims along a tangent curve', () => {
  const corners = [];
  junctionOutline([
    { dir: [1, 0], pts: [[20, -10], [20, 10]] },
    { dir: [0, 1], pts: [[10, 20], [-10, 20]] },
    { dir: [-1, 0], pts: [[-20, 10], [-20, -10]] },
    { dir: [0, -1], pts: [[-10, -20], [10, -20]] },
  ], [0, 0], corners);
  assert.equal(corners.length, 4);
  const east = corners.find(([p]) => p[0] === 20);
  assert.deepEqual(east[0], [20, 10]);
  assert.deepEqual(east[6], [12.5, 12.5]);
  assert.deepEqual(east.at(-1), [10, 20]);
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

test('median edges follow narrow clear gaps and exclude a connector in the middle', () => {
  const [from, to] = widestClearSpan(5.4, d => d < 0.14 || d > 5.18 || (d > 1.02 && d < 3.77));
  assert.ok(from >= 3.77 && from <= 3.79);
  assert.ok(to <= 5.18 && to >= 5.16);
  const [nose, edge] = widestClearSpan(1.05, d => d < 0.13 || d > 0.90);
  assert.ok(edge - nose > 0.74);
  assert.deepEqual(widestClearSpan(5, () => true), [0, 0]);
});

test('both Strip pavement finishers retain planted medians and cut them around parking access', async () => {
  for (const [finish, x, z] of [[finishSouthStripPavement, 140, 2010], [finishStripCorridorPavement, 150, 250]]) {
    const keys = ['major', 'asphalt', 'service', 'aisle', 'slipPavement', 'sidewalk', 'concreteMedians', 'medians',
      'medianPaving', 'medianPlanting', 'medianApron', 'frontagePlanting', 'curb', 'paint', 'paintDim', 'paintYellow', 'reviewedAisles', 'parkingBase'];
    const layers = Object.fromEntries(keys.map(key => {
      const mesh = { pos: [], idx: [], output: [], polygon(outer, y, holes) { this.output.push({ outer, y, holes }); } };
      return [key, { m: new Map([[`0,${Math.floor(z / 1400)}`, mesh]]), at: () => mesh }];
    }));
    const rectangle = (layer, left, top, right, bottom) => {
      const mesh = layers[layer].at();
      mesh.pos.push(x + left, 0, z + top, x + right, 0, z + top, x + right, 0, z + bottom, x + left, 0, z + bottom);
      mesh.idx.push(0, 1, 2, 0, 2, 3);
    };
    rectangle('medians', 0, 0, 12, 4);
    rectangle('major', -4, -2, 2, 6);
    rectangle('aisle', 8, -2, 15, 6);
    rectangle('medianApron', 0, -1, 12, 5);

    await finish(layers);
    const area = ring => Math.abs(ring.reduce((sum, [px, pz], i) => {
      const [nx, nz] = ring[(i + 1) % ring.length];
      return sum + px * nz - nx * pz;
    }, 0)) / 2;
    const totalArea = layer => layers[layer].at().output.reduce((sum, { outer, holes }) =>
      sum + area(outer) - holes.reduce((removed, hole) => removed + area(hole), 0), 0);
    // Review blocks may split an island or lot without changing its coverage.
    assert.ok(Math.abs(totalArea('medianPlanting') - 24) < 0.02);
    assert.ok(Math.abs(totalArea('reviewedAisles') - 56) < 0.02);
    assert.ok(Math.abs(totalArea('major') - 60) < 0.02);
  }
});

test('a tree needs its full base on finished planting geometry', () => {
  const pos = [0, 0.122, 0, 4, 0.122, 0, 4, 0.122, 4, 0, 0.122, 4];
  const surface = surfaceMask({ m: new Map([[0, { pos, idx: [0, 1, 2, 0, 2, 3] }]]) });
  assert.ok(supportsTree(surface, 2, 2, 0.4));
  assert.ok(!supportsTree(surface, 0.1, 2, 0.4));
  assert.ok(!supportsTree(surface, 5, 2, 0.4));
});

function road(id, from, to, extra = {}) {
  const length = Math.abs(to - from);
  return {
    id, cls: 'collector', lanes: [0, 1], way: { name: 'West Sahara Avenue', n: [], hw: 'secondary' },
    ref: { pts: [[from, 0], [to, 0]], cum: [0, length], y: [0, 0], length },
    ...extra,
  };
}

function crossingPlan(extra) {
  return { legs: [], mouthStart: new Map(), mouthEnd: new Map(), usedCrossings: new Set(), endSetback: () => 0, ...extra };
}

test('departure paint clears the entire junction side of a crosswalk beyond a road split', () => {
  const first = road(0, 5, 12, { next: 1 });
  const second = road(1, 12, 35);
  const leg = { ctr: [0, 0], a: [1, 0], d: 24, cross: true, markedEdges: new Set([0]), entries: [{ e: first, atStart: true }] };
  const plan = crossingPlan({ legs: [leg], mouthStart: new Map([[0, { leg }]]) });
  const data = { crossings: [] };
  // The outside lane boundary is skewed back from the reference station.
  const boundary = (e, i) => i ? { pts: e.ref.pts.map(([x, z]) => [x - 1.4, z + 7]) } : e.ref;
  const result = planCrossingPaint(data, { edges: [first, second] }, plan, boundary, new Set());
  const [hit] = result.junctions.get(leg);
  assert.equal(hit.road, second);
  assert.ok(Math.abs(hit.station - 14.2) < 1e-9);
  assert.deepEqual([...paintSpans(0, 7, result.gaps.get(0))], []);
  const [[from, to]] = [...paintSpans(0, 23, result.gaps.get(1))];
  assert.ok(Math.abs(from - 17.5) < 1e-9);
  assert.equal(to, 23);
  assert.ok(guideClearsCrossing([[20, 0], [24, 0]], leg));
  assert.ok(!guideClearsCrossing([[23, 0], [25, 0]], leg));
  const raised = planCrossingPaint(data, { edges: [first, { ...second, elevated: true }] }, plan, boundary, new Set());
  assert.equal(raised.junctions.size, 0);
  assert.equal(raised.gaps.size, 0);
});

test('a midblock crosswalk interrupts markings in both directions and across a split', () => {
  const first = road(0, 0, 12, { next: 2, twin: 1 });
  first.way.n = [100, 101];
  const edges = [first, road(1, 12, 0, { twin: 0 }), road(2, 12, 30)];
  const data = { crossings: [
    { id: 100, x: 11.5, z: 0, k: 'marked', m: 'zebra' },
    { id: 101, x: 4, z: 0, k: 'uncontrolled', m: 'no' },
  ] };
  const result = planCrossingPaint(data, { edges }, crossingPlan({}), e => e.ref, new Set());
  assert.equal(result.standalone.size, 1);
  const [[left, right]] = result.gaps.get(0);
  assert.ok(Math.abs(left - 9.6) < 1e-9);
  assert.equal(right, 12);
  assert.ok(Math.abs(result.gaps.get(1)[0][1] - 2.4) < 1e-9);
  assert.ok(Math.abs(result.gaps.get(2)[0][1] - 1.4) < 1e-9);
  assert.deepEqual([...paintSpans(0, 20, [[2, 4], [3, 5], [10, 12]])], [[0, 2], [5, 10], [12, 20]]);
});
