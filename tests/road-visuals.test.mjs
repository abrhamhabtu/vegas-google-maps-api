import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowMarking, dashRuns, offsetStation, widestClearSpan, zebraBars } from '../world/road-visuals.mjs';
import { surfaceMask, supportsTree } from '../world/road-planting.mjs';
import { finishSouthStripPavement } from '../world/south-strip-pavement.mjs';
import { finishStripCorridorPavement } from '../world/strip-corridor-pavement.mjs';
import {
  BELLAGIO_TREE_COORDS,
  bellagioWayHeights,
  finishBellagioDrivePavement,
  isBellagioFlattenedBridge,
} from '../world/bellagio-drive-roads.mjs';
import { junctionOutline } from '../world/south-strip-roads.mjs';
import { stripLaneCount, stripLaneWidth } from '../world/strip-streets.mjs';

globalThis.window = { THREE: {} };
const { guideClearsCrossing, paintSpans, planCrossingPaint } = await import('../world/road-crossings.mjs');
const { isPassage } = await import('../landmarks/vendor/map/lanegraph.js');

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

test('Strip lane widths, midblock overrides, and underground tunnel exclusion preserve Strip alignment', () => {
  assert.equal(stripLaneCount({ id: 255169900 }), 4);
  assert.equal(stripLaneCount({ id: 1037094415 }), 4);
  assert.equal(stripLaneWidth({ name: 'South Las Vegas Boulevard' }, 7, 'arterial', false, true), 3.05);
  assert.equal(stripLaneWidth({ name: 'South Las Vegas Boulevard' }, 4, 'arterial', true, false), 3.20);
  assert.equal(stripLaneWidth({ name: 'South Las Vegas Boulevard' }, 4, 'arterial', false, false), undefined);
  assert.equal(isPassage({ tn: 1, hw: 'primary', layer: -1, name: 'Wilbur Clark D.I. Road', pts: [[0, 0], [90, 0]] }), false);
  assert.equal(isPassage({ tn: 1, hw: 'unclassified', layer: -1, name: 'Resorts World Connector', pts: [[0, 0], [100, 0]] }), false);
  assert.equal(isPassage({ tn: 1, hw: 'service', pts: [[0, 0], [40, 0]] }), true);
});

test('Strip pavement finishers clip orphan curbs and clear stray vertical curb faces inside asphalt', async () => {
  for (const [finish, x, z] of [[finishSouthStripPavement, 140, 2010], [finishStripCorridorPavement, 150, 250]]) {
    const keys = ['major', 'asphalt', 'service', 'aisle', 'slipPavement', 'sidewalk', 'concreteMedians', 'medians',
      'medianPaving', 'medianPlanting', 'medianApron', 'frontagePlanting', 'curb', 'curbFaces', 'paint', 'paintDim', 'paintYellow', 'reviewedAisles', 'parkingBase'];
    const layers = Object.fromEntries(keys.map(key => {
      const mesh = {
        pos: [], idx: [], output: [],
        vert(vx, vy, vz) { this.pos.push(vx, vy, vz); return this.pos.length / 3 - 1; },
        polygon(outer, y, holes) { this.output.push({ outer, y, holes }); },
      };
      return [key, { m: new Map([[`0,${Math.floor(z / 1400)}`, mesh]]), at: () => mesh }];
    }));
    const rectangle = (layer, left, top, right, bottom) => {
      const mesh = layers[layer].at();
      const base = mesh.pos.length / 3;
      mesh.pos.push(x + left, 0, z + top, x + right, 0, z + top, x + right, 0, z + bottom, x + left, 0, z + bottom);
      mesh.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    rectangle('major', 0, 0, 10, 10);
    // An orphan curb floating out in open space with no median or sidewalk nearby
    rectangle('curb', 20, 20, 22, 22);
    // A stray vertical curbFace standing right inside drivable asphalt
    const cf = layers.curbFaces.at();
    cf.pos.push(x + 2, 0, z + 5, x + 8, 0, z + 5, x + 8, 0.17, z + 5);
    cf.idx.push(0, 1, 2);

    await finish(layers);
    assert.equal(layers.curb.at().output.length, 0);
    assert.equal(layers.curbFaces.at().idx.length, 0);
  }
});

test('Bellagio drive flattens porte-cochere ways, keeps open Strip mouths curb-free, and grounds every tree on planting', () => {
  for (const id of [14293119, 311030164, 789702807, 789702808, 789702810, 789702812, 311030162, 374989475]) {
    const way = { id, pts: [[0, 0], [10, 0]] };
    assert.deepEqual(bellagioWayHeights(way), [0, 0]);
    assert.equal(isBellagioFlattenedBridge(way), true);
  }
  const ramp = bellagioWayHeights({ id: 25718279, pts: [[0, 0], [10, 0], [20, 0]] });
  assert.equal(ramp[0], 0);
  assert.equal(ramp.at(-1), -4.2);

  const keys = ['major', 'asphalt', 'service', 'slipPavement', 'sidewalk', 'concreteMedians', 'medians',
    'medianPaving', 'medianPlanting', 'frontagePlanting', 'curb', 'curbFaces', 'paint', 'paintDim', 'paintYellow'];
  const layers = Object.fromEntries(keys.map(key => {
    const mesh = {
      pos: [], idx: [],
      vert(vx, vy, vz) { this.pos.push(vx, vy, vz); return this.pos.length / 3 - 1; },
      polygon(outer, y, holes = []) {
        // Fan/ear-clip check via simple triangulation is unnecessary for convex; use Clipper-compatible point-in-polygon via polygon records
        this.polys.push({ outer, y, holes });
      },
      polys: [],
    };
    return [key, { m: new Map([['0,0', mesh]]), at: () => mesh }];
  }));

  finishBellagioDrivePavement(layers);

  const inRing = (x, z, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i], [xj, zj] = ring[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  const inLayer = (key, x, z) => layers[key].at().polys.some(({ outer, holes }) =>
    inRing(x, z, outer) && !holes.some(h => inRing(x, z, h)));

  // Every key Bellagio carriageway & motor-court lane sits on finished drivable asphalt
  const drivableCheckpoints = [
    [-75.0, 472.0], // Porte-cochere outer valet/taxi lane
    [-62.5, 472.0], // Porte-cochere main arrival lane
    [-55.1, 472.0], // Porte-cochere inner lane
    [-38.0, 435.8], // North roundabout arc
    [-18.0, 515.0], // Roundabout turn-back loop
    [-38.0, 539.0], // Self-parking garage exit
    [95.0, 579.4],  // EB 3 left-turn lanes
    [95.0, 589.8],  // EB 2 right-turn lanes
    [95.0, 555.4],  // WB 3 lanes
    [118.0, 567.0], // Strip intersection mouth (no curb/sidewalk gap)
    [121.0, 557.5], // WB mouth at Strip seam
    [121.0, 577.5], // EB mouth at Strip seam
  ];
  for (const [x, z] of drivableCheckpoints) {
    assert.equal(inLayer('major', x, z), true, `expected drivable asphalt at (${x}, ${z})`);
    assert.equal(inLayer('curb', x, z), false, `unexpected curb on asphalt at (${x}, ${z})`);
    assert.equal(inLayer('sidewalk', x, z), false, `unexpected sidewalk on asphalt at (${x}, ${z})`);
  }

  // Every Bellagio tree stands strictly inside finished medianPlanting and clear of asphalt
  for (const [tx, tz] of BELLAGIO_TREE_COORDS) {
    assert.equal(inLayer('medianPlanting', tx, tz), true, `tree at (${tx}, ${tz}) not on medianPlanting`);
    assert.equal(inLayer('major', tx, tz), false, `tree at (${tx}, ${tz}) overlaps drivable asphalt`);
  }
});
