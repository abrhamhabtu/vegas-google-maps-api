// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { Chunked, Soup, cellKey, convexHull, hash, normals, offsetLine, slice } from './geom.js';
import { boundaryAt, boundaryLine as rawBoundaryLine, edgeLine as rawEdgeLine, makeLine, offset, offsetBy, roadMask, sample } from './lanegraph.js';

const visRefCache = new WeakMap();
function smoothVisRef(e) {
    let cached = visRefCache.get(e);
    if (cached) return cached;
    const ref = e.ref, pts = ref.pts, ys = ref.y, n = pts.length;
    if (n < 3 || e.joinAcross || e.rampJoin) {
        visRefCache.set(e, ref);
        return ref;
    }
    const tangents = new Array(n);
    for (let i = 1; i < n - 1; i++) {
        const ax = pts[i][0] - pts[i - 1][0], az = pts[i][1] - pts[i - 1][1], la = Math.hypot(ax, az) || 1;
        const bx = pts[i + 1][0] - pts[i][0], bz = pts[i + 1][1] - pts[i][1], lb = Math.hypot(bx, bz) || 1;
        if ((ax * bx + az * bz) / (la * lb) < 0.25) { tangents[i] = null; continue; }
        const ux = ax / la + bx / lb, uz = az / la + bz / lb, lu = Math.hypot(ux, uz) || 1;
        tangents[i] = [ux / lu, uz / lu];
    }
    const chordDir = (i, j)=>{
        const dx = pts[j][0] - pts[i][0], dz = pts[j][1] - pts[i][1], l = Math.hypot(dx, dz) || 1;
        return [dx / l, dz / l];
    };
    const d0 = chordDir(0, 1), d1 = chordDir(n - 2, n - 1);
    const reflect = (d, t)=>{
        if (!t) return d;
        const k = 2 * (d[0] * t[0] + d[1] * t[1]);
        const rx = k * d[0] - t[0], rz = k * d[1] - t[1], rl = Math.hypot(rx, rz) || 1;
        return (rx * d[0] + rz * d[1]) / rl > 0.4 ? [rx / rl, rz / rl] : d;
    };
    tangents[0] = reflect(d0, tangents[1]);
    tangents[n - 1] = reflect(d1, tangents[n - 2]);
    const outPts = [], outY = [];
    for (let i = 0; i < n - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1], y0 = ys[i], y1 = ys[i + 1];
        const dx = p1[0] - p0[0], dz = p1[1] - p0[1], L = Math.hypot(dx, dz);
        outPts.push(p0);
        outY.push(y0);
        if (L > 2.2) {
            const ux = dx / L, uz = dz / L;
            const ta = tangents[i] ?? [ux, uz], tb = tangents[i + 1] ?? [ux, uz];
            if (ta[0] * ux + ta[1] * uz < 0.9965 || tb[0] * ux + tb[1] * uz < 0.9965) {
                const steps = Math.max(2, Math.min(8, Math.ceil(L / 2.2)));
                const s = L * 0.36;
                for (let k = 1; k < steps; k++) {
                    const u = k / steps, u2 = u * u, u3 = u2 * u;
                    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
                    outPts.push([
                        h00 * p0[0] + h10 * ta[0] * s + h01 * p1[0] + h11 * tb[0] * s,
                        h00 * p0[1] + h10 * ta[1] * s + h01 * p1[1] + h11 * tb[1] * s
                    ]);
                    outY.push(y0 + (y1 - y0) * u);
                }
            }
        }
    }
    outPts.push(pts[n - 1]);
    outY.push(ys[n - 1]);
    const vis = makeLine(outPts, outY);
    if (vis.length > 1e-6 && ref.length > 0) {
        const scale = ref.length / vis.length;
        for (let i = 0; i < vis.cum.length; i++) vis.cum[i] *= scale;
        vis.length = ref.length;
    }
    visRefCache.set(e, vis);
    return vis;
}
function edgeLine(e, f) {
    const ref = smoothVisRef(e);
    return ref === e.ref ? rawEdgeLine(e, f) : offsetBy(ref, f, e.mitreStart, e.mitreEnd);
}
function boundaryLine(e, i) {
    const ref = smoothVisRef(e);
    return ref === e.ref ? rawBoundaryLine(e, i) : edgeLine(e, (at)=>boundaryAt(e, i, at));
}
import { planIntersections } from './intersections.js';
import { flatMaterial, litMaterial, ORDER, surfaceMaterial } from './materials.js';
import { arrowMarking, dashRuns, offsetStation, widestClearSpan, zebraBars } from '../../../world/road-visuals.mjs';
import { CROSSWALK_HALF, CROSSWALK_OFFSET, guideClearsCrossing, paintSpans, planCrossingPaint } from '../../../world/road-crossings.mjs';
import { BRIDGE_SLAB_DEPTH } from '../../../world/road-surface.mjs';
import { planBridgeDecks } from '../../../world/bridge-decks.mjs';
import { STRIP_PAVEMENT, hasPavedStripMedian, planStripStreets } from '../../../world/strip-streets.mjs';
const ELEV = 0.4;
const WALK_HEIGHT = 0.11;
const CURB_HEIGHT = 0.17;
const sidewalkWidth = (e)=>e.cls === 'arterial' ? 3.2 : e.cls === 'collector' ? 2.6 : 2.1;
const roadHeight = (y)=>y > 0.03 ? y : 0;
/**
 * `plan` may be passed in when the caller already ran planIntersections (it mutates the lane graph,
 * so it must only run once); `pause` is an optional async yield so the long per-edge pass can be
 * time-sliced and the map stays responsive while the streets build.
 */
export async function buildRoads(data, g, valetZones = [], plan = planIntersections(data, g), pause = null) {
    const group = new THREE.Group();
    group.name = 'roads';
    const C = 1400;
    const sidewalk = new Chunked(C), curb = new Chunked(C), curbFaces = new Chunked(C), medians = new Chunked(C), medianPaving = new Chunked(C);
    const concreteMedians = new Chunked(C), medianPlanting = new Chunked(C), slipPavement = new Chunked(C);
    const deckWalk = new Chunked(C), deckCurb = new Chunked(C), deckCurbFaces = new Chunked(C), deckMedianPaving = new Chunked(C);
    const asphalt = new Chunked(C), major = new Chunked(C), freeway = new Chunked(C), service = new Chunked(C), aisle = new Chunked(C);
    const paint = new Chunked(C), paintDim = new Chunked(C), paintYellow = new Chunked(C);
    const deckTop = new Chunked(C), freewayDeckTop = new Chunked(C), deckPaint = new Chunked(C), deckPaintYellow = new Chunked(C);
    const deckSide = new Soup(), deckCoping = new Soup();
    const pillars = new Soup();
    const surfaceFor = (e)=>e.cls === 'motorway' || e.cls === 'ramp' ? freeway : e.cls === 'arterial' || e.way.hw === 'primary_link' || e.way.hw === 'trunk_link' ? major : e.cls === 'service' ? e.way.svc === 'parking_aisle' ? aisle : service : asphalt;
    const extents = (e)=>{
        const W = e.lanes.length * e.laneWidth;
        if (e.oneway) return [
            -0.15,
            W + 0.15
        ];
        const base = e.way;
        const centre = !base.ow && (base.lanes ?? 0) % 2 === 1 && (base.lanes ?? 0) >= 3 && !base.lf ? e.laneWidth / 2 : 0;
        return [
            -centre - 0.05,
            W + 0.15
        ];
    };
    const deckRims = new Map();
    const bridgePlan = planBridgeDecks(g.edges, e=>{
        const rim = edgeLine(e, d=>boundaryAt(e, 0, d) + extents(e)[0]);
        deckRims.set(e.id, rim);
        return rim;
    });
    for (const { a, left, right } of bridgePlan.spans) {
        const [x, z] = left.pts[0];
        ribbonSplit(surfaceFor(a).at(x, z), deckTop.at(x, z), left, right);
        deckUnderside(deckSide, left, right);
    }
    const sidewalkPiece = (piece, from, to, walkWidth, air = false, taper, widths)=>{
        if (piece.pts.length < 2) return;
        const [x, z] = piece.pts[0];
        const heights = piece.y.map((y)=>air ? roadHeight(y) : 0);
        if (widths || walkWidth > 0) {
            const walk = (air ? deckWalk : sidewalk).at(x, z);
            if (widths) {
                const ns = normals(piece.pts), sign = to > from ? 1 : -1;
                const innerPts = from === 0 ? piece.pts : piece.pts.map(([px, pz], i)=>[px + ns[i][0] * from, pz + ns[i][1] * from]);
                const outerPts = piece.pts.map(([px, pz], i)=>{
                    const w = sign * Math.max(0, widths[i] ?? walkWidth);
                    return [px + ns[i][0] * (from + w), pz + ns[i][1] * (from + w)];
                });
                const [leftPts, rightPts] = sign > 0 ? [innerPts, outerPts] : [outerPts, innerPts];
                ribbonY(walk, { pts: leftPts, y: heights }, { pts: rightPts, y: heights }, WALK_HEIGHT);
            } else if (taper?.some(Boolean)) {
                const line = makeLine(piece.pts, heights);
                const [start, end] = taper.map(m=>Math.min(m, line.length * 0.4));
                const stations = new Set(line.cum);
                for (let d = 1; d < start; d++) stations.add(d);
                for (let d = 1; d < end; d++) stations.add(line.length - d);
                if (start) stations.add(start);
                if (end) stations.add(line.length - end);
                const ds = [...stations].sort((a, b)=>a - b).filter((d, i, all)=>!i || d - all[i - 1] > 1e-5);
                const samples = ds.map(d=>sample(line, d)), pts = samples.map(q=>[q.x, q.z]), y = samples.map(q=>q.y);
                const ns = normals(pts), sign = Math.sign(to - from);
                const outer = pts.map(([px, pz], i)=>{
                    const d = ds[i];
                    const t = Math.min(1, start ? d / start : 1, end ? (line.length - d) / end : 1);
                    const w = sign * walkWidth * t * t * (3 - 2 * t);
                    return [px + ns[i][0] * w, pz + ns[i][1] * w];
                });
                ribbonY(walk, { pts, y }, { pts: outer, y }, WALK_HEIGHT);
            } else {
                const [lo, hi] = to > from ? [from, from + walkWidth] : [from - walkWidth, from];
                walk.ribbon(piece.pts, lo, hi, heights.map((y)=>y + WALK_HEIGHT));
            }
        }
        addCurb((air ? deckCurb : curb).at(x, z), (air ? deckCurbFaces : curbFaces).at(x, z), piece.pts, heights, from, to);
    };
    const isAir = (l)=>l.y.some((v)=>v > ELEV);
    const { legs, mouthStart, mouthEnd, setback, endSetback, intersectionAt } = plan;
    const stripStreets = planStripStreets(g, plan);
    const stripSlipEdges = new Set(stripStreets.slips.flatMap(chain=>chain.map(e=>e.id)));
    const edgeCut = (e, atStart)=>{
        const node = atStart ? e.fromNode : e.toNode;
        const mouth = (atStart ? mouthStart : mouthEnd).get(e.id);
        return Math.min(mouth?.inner ?? endSetback(e, node), e.ref.length / 2);
    };
    const onGroundRoad = roadMask(g);
    // Point-on-carriageway tests run millions of times. Each road segment is rasterised once into
    // a fine grid over everything it can answer "yes" for (its lateral extent padded by PAD), so a
    // query reads a single cell. Margins above PAD fall back to the original 3x3 coarse scan.
    const PAD = 4, FINE = 8;
    const fineCells = (corners, add)=>{
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const [x, z] of corners){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        for(let i = Math.floor(x0 / FINE); i <= Math.floor(x1 / FINE); i++)for(let j = Math.floor(z0 / FINE); j <= Math.floor(z1 / FINE); j++)add(cellKey(i, j));
    };
    // the widest lateral range boundary i can reach anywhere along e (tapers ease monotonically)
    const boundaryRange = (e, i)=>{
        const base = i * e.laneWidth;
        const dS = e.jointStart && e.taperStart ? e.jointStart[i] - base : 0, dE = e.jointEnd && e.taperEnd ? e.jointEnd[i] - base : 0;
        return [base + Math.min(0, dS) + Math.min(0, dE), base + Math.max(0, dS) + Math.max(0, dE)];
    };
    const buildCarriagewayTest = (pred, levelTolerance = 2.5)=>{
        const cell = 25, grid = new Map(), fine = new Map();
        for (const m of g.edges){
            if (!pred(m)) continue;
            const [ml0, ml1] = extents(m), mW = m.lanes.length * m.laneWidth;
            const lAdd = ml0, rAdd = ml1 - mW;
            const latLo = boundaryRange(m, 0)[0] + lAdd - PAD, latHi = boundaryRange(m, m.lanes.length)[1] + rAdd + PAD;
            for(let i = 0; i < m.ref.pts.length - 1; i++){
                const a = m.ref.pts[i], b = m.ref.pts[i + 1];
                const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (cell * 0.5)));
                for(let k = 0; k <= n; k++){
                    const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
                    const key = cellKey(Math.floor(x / cell), Math.floor(z / cell));
                    let list = grid.get(key);
                    if (!list) grid.set(key, list = []);
                    if (!list.length || list[list.length - 1][0] !== m || list[list.length - 1][1] !== i) list.push([
                        m,
                        i,
                        lAdd,
                        rAdd
                    ]);
                }
                if (L < 1e-4) continue;
                const hx = (b[0] - a[0]) / L, hz = (b[1] - a[1]) / L, nx = -hz, nz = hx, entry = [m, i, lAdd, rAdd];
                const at = (s, t)=>[a[0] + hx * s + nx * t, a[1] + hz * s + nz * t];
                fineCells([at(-1.2, latLo), at(L + 1.2, latLo), at(L + 1.2, latHi), at(-1.2, latHi)], (key)=>{
                    let list = fine.get(key);
                    if (!list) fine.set(key, list = []);
                    list.push(entry);
                });
            }
        }
        const hit = (x, z, low, high, margin, excludeWayId, excludeEdgeId, m, seg, lAdd, rAdd)=>{
            if (m.id === excludeEdgeId) return false;
            if (excludeWayId !== undefined && (m.way.id === excludeWayId || m.twin !== undefined && g.edges[m.twin].way.id === excludeWayId)) return false;
            const u = m.ref.pts[seg], v = m.ref.pts[seg + 1];
            const dx = v[0] - u[0], dz = v[1] - u[1], L = Math.hypot(dx, dz);
            if (L < 1e-4) return false;
            const hx = dx / L, hz = dz / L, nx = -hz, nz = hx;
            const along = (x - u[0]) * hx + (z - u[1]) * hz;
            if (along < -1.2 || along > L + 1.2) return false;
            const t = Math.max(0, Math.min(1, along / L));
            const my = m.ref.y[seg] + (m.ref.y[seg + 1] - m.ref.y[seg]) * t;
            if (my < low || my > high) return false;
            const lat = (x - u[0]) * nx + (z - u[1]) * nz;
            const s = m.ref.cum[seg] + t * L;
            const leftB = boundaryAt(m, 0, s) + lAdd - margin;
            const rightB = boundaryAt(m, m.lanes.length, s) + rAdd + margin;
            return lat >= leftB && lat <= rightB;
        };
        return (x, z, y, margin, excludeWayId, excludeEdgeId)=>{
            const low = typeof y === 'number' ? y - levelTolerance : y[0];
            const high = typeof y === 'number' ? y + levelTolerance : y[1];
            if (margin <= PAD) {
                for (const [m, seg, lAdd, rAdd] of fine.get(cellKey(Math.floor(x / FINE), Math.floor(z / FINE))) ?? []){
                    if (hit(x, z, low, high, margin, excludeWayId, excludeEdgeId, m, seg, lAdd, rAdd)) return true;
                }
                return false;
            }
            const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
            for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [m, seg, lAdd, rAdd] of grid.get(cellKey(cx + a, cz + b)) ?? []){
                if (hit(x, z, low, high, margin, excludeWayId, excludeEdgeId, m, seg, lAdd, rAdd)) return true;
            }
            return false;
        };
    };
    const onMainCarriageway = buildCarriagewayTest((m)=>!m.internal && m.cls !== 'service' && m.cls !== 'ramp' && !/_link$/.test(m.way.hw));
    const onLinkOrSvcCarriageway = buildCarriagewayTest((m)=>!m.internal && (/_link$/.test(m.way.hw) || m.cls === 'ramp' || m.cls === 'service' && m.way.svc !== 'parking_aisle'));
    const onAnyNonServiceRoad = buildCarriagewayTest((m)=>m.cls !== 'service');
    const onElevatedDeck = buildCarriagewayTest((m)=>isAir(m.ref), 0.95);
    const onConnector = (()=>{
        const cell = 25, grid = new Map(), fine = new Map();
        for (const k of g.lanes){
            if (!k.connector || k.line.pts.length < 2 || k.line.y.some((v)=>v > 2.0)) continue;
            const hw = (k.width ?? 3.5) * 0.5;
            for(let i = 0; i < k.line.pts.length - 1; i++){
                const a = k.line.pts[i], b = k.line.pts[i + 1];
                const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (cell * 0.5)));
                for(let j = 0; j <= n; j++){
                    const x = a[0] + (b[0] - a[0]) * j / n, z = a[1] + (b[1] - a[1]) * j / n;
                    const key = cellKey(Math.floor(x / cell), Math.floor(z / cell));
                    let list = grid.get(key);
                    if (!list) grid.set(key, list = []);
                    if (!list.length || list[list.length - 1][0] !== k || list[list.length - 1][1] !== i) list.push([
                        k,
                        i,
                        hw
                    ]);
                }
                const r = hw + PAD, entry = [k, i, hw];
                fineCells([[Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r], [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r]], (key)=>{
                    let list = fine.get(key);
                    if (!list) fine.set(key, list = []);
                    list.push(entry);
                });
            }
        }
        const near = (x, z, margin, k, seg, hw)=>{
            const u = k.line.pts[seg], v = k.line.pts[seg + 1];
            const dx = v[0] - u[0], dz = v[1] - u[1], L2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - u[0]) * dx + (z - u[1]) * dz) / L2));
            return Math.hypot(x - (u[0] + dx * t), z - (u[1] + dz * t)) <= hw + margin;
        };
        return (x, z, margin = 0.2)=>{
            if (margin <= PAD) {
                for (const [k, seg, hw] of fine.get(cellKey(Math.floor(x / FINE), Math.floor(z / FINE))) ?? [])if (near(x, z, margin, k, seg, hw)) return true;
                return false;
            }
            const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
            for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [k, seg, hw] of grid.get(cellKey(cx + a, cz + b)) ?? [])if (near(x, z, margin, k, seg, hw)) return true;
            return false;
        };
    })();
    const blocksSupport = (x, z, low, high, margin, e)=>
        low <= 0 && (onGroundRoad(x, z, margin) || onConnector(x, z, margin)) ||
        onAnyNonServiceRoad(x, z, [low, high], margin, e.way.id, e.id) ||
        onLinkOrSvcCarriageway(x, z, [low, high], margin, e.way.id, e.id);
    const medGrid = new Map();
    for (const m of g.edges){
        if (m.internal || m.cls === 'service') continue;
        for(let i = 0; i < m.ref.pts.length - 1; i++){
            const a = m.ref.pts[i], b = m.ref.pts[i + 1];
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 20));
            for(let k = 0; k <= n; k++){
                const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
                const key = cellKey(Math.floor(x / 40), Math.floor(z / 40));
                let list = medGrid.get(key);
                if (!list) medGrid.set(key, list = []);
                if (!list.length || list[list.length - 1][0] !== m || list[list.length - 1][1] !== i) list.push([
                    m,
                    i
                ]);
            }
        }
    }
    const medianProfileAt = (e, x, z, hx, hz, y, refined)=>{
        const lx = hz, lz = -hx;
        let bestT = 34, bestM = null, bestHd = 0, bestDir;
        const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
        for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [m, seg] of medGrid.get(cellKey(cx + a, cz + b)) ?? []){
            if (m.id === e.id || m.way.id === e.way.id || m.twin === e.id || m.id === e.prev || m.id === e.next) continue;
            const u = m.ref.pts[seg], v = m.ref.pts[seg + 1];
            const dx = v[0] - u[0], dz = v[1] - u[1], L = Math.hypot(dx, dz);
            if (L < 1e-4) continue;
            const mhx = dx / L, mhz = dz / L, mnx = -mhz, mnz = mhx;
            const den = lx * mnx + lz * mnz;
            if (Math.abs(den) < 0.35) continue;
            const tRef = ((u[0] - x) * mnx + (u[1] - z) * mnz) / den;
            const along = (x + lx * tRef - u[0]) * mhx + (z + lz * tRef - u[1]) * mhz;
            if (along < -2.0 || along > L + 2.0) continue;
            const s = m.ref.cum[seg] + Math.max(0, Math.min(L, along));
            const grade = m.ref.y[seg] + (m.ref.y[seg + 1] - m.ref.y[seg]) * (s - m.ref.cum[seg]) / L;
            if (Math.abs(y - grade) > 0.7) continue;
            const b0 = boundaryAt(m, 0, s) - 0.15, b1 = boundaryAt(m, m.lanes.length, s) + 0.15;
            const t0 = tRef + b0 / den, t1 = tRef + b1 / den;
            const tNear = Math.min(t0, t1), tFar = Math.max(t0, t1);
            if (tNear <= 0.15 && tFar >= -0.15) return;
            if (tNear > 0.15 && tNear < bestT) {
                bestT = tNear;
                bestM = m;
                bestHd = hx * mhx + hz * mhz;
                bestDir = [mhx, mhz];
            }
        }
        if (!bestM || bestT < 0.35 || bestT > 21 || /_link$/.test(bestM.way.hw) || bestHd >= -0.65 || !bestM.oneway) return;
        if (e.way.name ? bestM.way.name !== e.way.name : bestM.way.name || bestM.cls !== e.cls) return;
        // Use one carriageway as the reference for the entire divider. Opposing
        // halves otherwise leave seams where their splits and tapers differ.
        const [ux, uz] = bestDir;
        const dx = hx - ux, dz = hz - uz;
        if ((Math.abs(dx) >= Math.abs(dz) ? dx : dz) <= 0) return;
        const [from, to] = widestClearSpan(bestT, (d)=>{
            if (d < 0.13 || d > bestT - 0.13) return true;
            const px = x + lx * d, pz = z + lz * d;
            return onAnyNonServiceRoad(px, pz, y, 0.14, e.way.id, e.id) ||
                onLinkOrSvcCarriageway(px, pz, y, 0.14, e.way.id, e.id) ||
                (y < 1.5 && onConnector(px, pz, 0.2));
        });
        return { width: bestT + 0.08, from, to };
    };
    const boundaryCache = new Map();
    const laneBoundary = (e, i)=>{
        let lines = boundaryCache.get(e.id);
        if (!lines) boundaryCache.set(e.id, lines = []);
        return lines[i] ??= boundaryLine(e, i);
    };
    const atStation = (e, line, d)=>sample(line, offsetStation(e.ref, line, d));
    const sliceStations = (e, line, from, to)=>slice(line.pts, offsetStation(e.ref, line, from), offsetStation(e.ref, line, to), line.y);
    const crossingPaint = planCrossingPaint(data, g, plan, laneBoundary, stripSlipEdges);
    const markFits = (e, d, half)=>!crossingPaint.gaps.get(e.id)?.some(([start, end])=>d + half > start && d - half < end);
    const paintRibbon = (e, line, from, to, half, target, yOff = null)=>{
        const draw = (start, end)=>{
            const piece = sliceStations(e, line, start, end);
            if (piece.pts.length < 2) return;
            target.at(piece.pts[0][0], piece.pts[0][1]).ribbon(piece.pts, -half, half,
                yOff === null ? 0 : piece.y.map(v=>roadHeight(v) + yOff));
        };
        if (to - from < 0.02) return;
        const gaps = crossingPaint.gaps.get(e.id);
        if (!gaps) return draw(from, to);
        for (const [start, end] of paintSpans(from, to, gaps)){
            if (end - start >= Math.min(0.55, to - from)) draw(start, end);
        }
    };
    const laneSample = (e, i, d)=>{
        const left = laneBoundary(e, i), right = laneBoundary(e, i + 1);
        const a = atStation(e, left, d), b = atStation(e, right, d);
        const c = atStation(e, left, d - 1.25), f = atStation(e, right, d - 1.25);
        const j = atStation(e, left, d + 1.25), k = atStation(e, right, d + 1.25);
        const dx = j.x + k.x - c.x - f.x, dz = j.z + k.z - c.z - f.z, length = Math.hypot(dx, dz) || 1;
        return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: a.y, hx: dx / length, hz: dz / length, width: Math.hypot(b.x - a.x, b.z - a.z) };
    };
    const clearSpans = (from, to, step, keep)=>{
        if (to - from <= 0.2) return [];
        const spans = [];
        const n = Math.max(1, Math.ceil((to - from) / step));
        const ds = (to - from) / n;
        let curStart = null;
        for(let k = 0; k <= n; k++){
            const s = from + k * ds;
            if (keep(s)) {
                if (curStart === null) curStart = s;
            } else if (curStart !== null) {
                const end = s - ds * 0.5;
                if (end - curStart >= 0.8) spans.push([
                    curStart,
                    end
                ]);
                curStart = null;
            }
        }
        if (curStart !== null && to - curStart >= 0.8) spans.push([
            curStart,
            to
        ]);
        return spans;
    };
    const dashStart = new Map();
    for (const e of g.edges){
        if (e.prev !== undefined) continue;
        let at = hash(e.id) * 12, cur = e, guard = 0;
        while(cur && !dashStart.has(cur.id) && guard++ < 500){
            dashStart.set(cur.id, at);
            at = (at + cur.ref.length) % 12;
            cur = cur.next !== undefined ? g.edges[cur.next] : undefined;
        }
    }
    let sliceStart = performance.now();
    for (const e of g.edges){
        if (pause && performance.now() - sliceStart > 28) {
            await pause();
            sliceStart = performance.now();
        }
        const [l0, l1] = extents(e);
        const air = isAir(e.ref);
        const stripApproach = !air && stripStreets.approaches.has(e.id);
        const W = e.lanes.length * e.laneWidth;
        const isLink = /_link$/.test(e.way.hw);
        const isLinkOrRamp = isLink || e.cls === 'ramp';
        const surface = surfaceFor(e);
        const leftRoad = deckRims.get(e.id) ?? edgeLine(e, (at)=>boundaryAt(e, 0, at) + l0);
        const rightRoad = edgeLine(e, (at)=>boundaryAt(e, e.lanes.length, at) + l1 - W);
        if (air) {
            const sp = e.ref.pts;
            const bridgeSw = !e.internal && (e.cls === 'arterial' || e.cls === 'collector' || e.cls === 'local') && !isLink ? sidewalkWidth(e) : 0;
            const elevTaper = (at)=>{
                const y = sample(e.ref, at).y;
                return Math.min(1, Math.max(0, (y - 0.08) / 2.2));
            };
            const rightDeck = bridgeSw ? edgeLine(e, (at)=>boundaryAt(e, e.lanes.length, at) + l1 - W + bridgeSw * elevTaper(at)) : rightRoad;
            const s = (surface === freeway ? freewayDeckTop : deckTop).at(sp[0][0], sp[0][1]);
            ribbonSplit(surface.at(sp[0][0], sp[0][1]), s, leftRoad, rightDeck);
            deckUnderside(deckSide, leftRoad, rightDeck);
            if (e.twin === undefined) {
                for (const [from, to] of paintSpans(0, leftRoad.length, bridgePlan.joined.get(e.id) ?? [])) {
                    deckWall(deckSide, deckCoping, slice(leftRoad.pts, from, to, leftRoad.y), -1, e, onElevatedDeck, blocksSupport);
                }
            }
            deckWall(deckSide, deckCoping, rightDeck, 1, e, onElevatedDeck, blocksSupport);
            if (e.oneway || e.twin === undefined || e.id < e.twin) {
                pillarsAlong(pillars, e, leftRoad, rightDeck, blocksSupport);
            }
        } else {
            ribbonY(surface.at(e.ref.pts[0][0], e.ref.pts[0][1]), leftRoad, rightRoad, null);
        }
        if (!e.internal && (e.cls === 'arterial' || e.cls === 'collector' || e.cls === 'local')) {
            const sw = sidewalkWidth(e);
            const cut0 = edgeCut(e, true), cut1 = e.ref.length - edgeCut(e, false);
            const outer = rightRoad;
            const byRamp = e.rampJoin || g.edges[e.prev]?.joinAcross || g.edges[e.next]?.joinAcross;
            const outerClear = (d)=>{
                const q = atStation(e, outer, d), nx = -q.hz, nz = q.hx;
                if (onAnyNonServiceRoad(q.x + nx * 0.42, q.z + nz * 0.42, q.y, 0.10, e.way.id, e.id)) return 0;
                if (onLinkOrSvcCarriageway(q.x + nx * 0.85, q.z + nz * 0.85, q.y, 0.10, e.way.id, e.id)) return 0;
                if (q.y <= 1.5 && onConnector(q.x + nx * 0.65, q.z + nz * 0.65, 0.08)) return 0;
                if (air) return sw;
                // Trim sidewalk width smoothly so slabs never jut over angled driveways, plazas or ramps
                for (let w = 0.5; w <= sw + 0.15; w += 0.35) {
                    const px = q.x + nx * w, pz = q.z + nz * w;
                    if (onAnyNonServiceRoad(px, pz, q.y, 0.18, e.way.id, e.id) ||
                        onLinkOrSvcCarriageway(px, pz, q.y, 0.22, e.way.id, e.id) ||
                        onConnector(px, pz, 0.18)) {
                        return Math.max(0.25, w - 0.35);
                    }
                }
                return sw;
            };
            const oSpans = clearSpans(cut0, cut1, 0.9, (d)=>outerClear(d) > 0.2);
            for (const [s0, s1] of oSpans){
                const piece = sliceStations(e, outer, s0, s1);
                if (isLink) {
                    sidewalkPiece(piece, 0, 0.25, 0, air);
                } else {
                    const taperStart = s0 > cut0 + 0.15 ? (byRamp ? 6 : 3.2) : 0;
                    const taperEnd = s1 < cut1 - 0.15 ? (byRamp ? 6 : 3.2) : 0;
                    if (air) {
                        const taper = taperStart || taperEnd ? [taperStart, taperEnd] : undefined;
                        sidewalkPiece(piece, 0, 0.25, sw, air, taper);
                    } else {
                        const line = makeLine(piece.pts, piece.y);
                        const rawW = line.cum.map((d)=>{
                            const t = Math.min(1, taperStart ? d / taperStart : 1, taperEnd ? (line.length - d) / taperEnd : 1);
                            const ease = t * t * (3 - 2 * t);
                            const qD = s0 + (s1 - s0) * (d / (line.length || 1));
                            return Math.max(0.25, outerClear(qD) * ease);
                        });
                        // Smooth outer sidewalk transitions to prevent faceted curb steps
                        const smW = rawW.slice();
                        for (let pass = 0; pass < 2; pass++) {
                            const prev = smW.slice();
                            for (let k = 1; k < prev.length - 1; k++) smW[k] = 0.25 * prev[k - 1] + 0.5 * prev[k] + 0.25 * prev[k + 1];
                        }
                        sidewalkPiece(piece, 0, 0.25, sw, air, undefined, smW);
                    }
                }
            }
            if (e.oneway && isLink) {
                const left = leftRoad;
                const lSpans = clearSpans(cut0, cut1, 1.1, (d)=>{
                    const q = atStation(e, left, d), nx = -q.hz, nz = q.hx;
                    return !onAnyNonServiceRoad(q.x - nx * 0.42, q.z - nz * 0.42, q.y, 0.1, e.way.id, e.id) && (q.y > 1.5 || !onConnector(q.x - nx * 0.6, q.z - nz * 0.6, 0.08));
                });
                for (const [s0, s1] of lSpans) sidewalkPiece(sliceStations(e, left, s0, s1), 0, -0.25, 0, air);
            }
        }
        if (!e.internal && !air && e.cls === 'service' && e.way.svc !== 'parking_aisle' && e.ref.length > 4) {
            const cut0 = edgeCut(e, true), cut1 = e.ref.length - edgeCut(e, false);
            for (const [line, sign] of [[rightRoad, 1], ...(e.oneway ? [[leftRoad, -1]] : [])]) {
                const cSpans = clearSpans(cut0, cut1, 0.9, (d)=>{
                    const q = atStation(e, line, d), nx = -q.hz * sign, nz = q.hx * sign;
                    return !onAnyNonServiceRoad(q.x + nx * 0.35, q.z + nz * 0.35, q.y, 0.08, e.way.id, e.id) &&
                        !onLinkOrSvcCarriageway(q.x + nx * 0.55, q.z + nz * 0.55, q.y, 0.08, e.way.id, e.id) &&
                        !onConnector(q.x + nx * 0.5, q.z + nz * 0.5, 0.08);
                });
                for (const [s0, s1] of cSpans) sidewalkPiece(sliceStations(e, line, s0, s1), 0, sign * 0.18, 0, false);
            }
        }
        if (!air && !e.internal) for (const id of e.lanes){
            const lane = g.lanes[id];
            if (!lane.raw) continue;
            for (const run of departures(lane.line, lane.raw, lane.width / 2))surfaceFor(e).at(run[0][0], run[0][1]).ribbon(run, -lane.width / 2 - 0.3, lane.width / 2 + 0.3, 0);
        }
        if (!e.internal && e.oneway && (e.cls === 'arterial' || e.cls === 'collector' || e.cls === 'local' && e.way.name) && !isLink && e.ref.length > 5) {
            const startMouth = mouthStart.get(e.id), endMouth = mouthEnd.get(e.id);
            const cut0 = Math.min((stripApproach ? startMouth?.band?.[0] : undefined) ?? startMouth?.clear ?? edgeCut(e, true), e.ref.length / 2);
            const cut1 = Math.min((stripApproach ? endMouth?.band?.[0] : undefined) ?? endMouth?.stop ?? edgeCut(e, false), e.ref.length / 2);
            const left = leftRoad;
            const profiles = new Map();
            const profileAt = (d)=>{
                if (!profiles.has(d)) {
                    const q = atStation(e, left, d);
                    const joined = !air || q.y < 0.03 || bridgePlan.joined.get(e.id)?.some(([a, b])=>{
                        const s = offsetStation(e.ref, left, d);
                        return a <= s && s <= b;
                    });
                    profiles.set(d, joined ? medianProfileAt(e, q.x, q.z, q.hx, q.hz, q.y, stripApproach || e.rampJoin) : undefined);
                }
                return profiles.get(d);
            };
            const mSpans = clearSpans(cut0, e.ref.length - cut1, 1.2, (d)=>!!profileAt(d));
            for (const [s0, s1] of mSpans){
                const length = s1 - s0, steps = Math.max(2, Math.ceil(length / 0.65));
                const stations = Array.from({ length: steps + 1 }, (_, i)=>i === steps ? s1 : s0 + length * i / steps);
                for (const d of e.ref.cum) if (d > s0 + 0.01 && d < s1 - 0.01) stations.push(d);
                stations.sort((a,b)=>a-b);
                const pts = [], widths = [], heights = [], dists = [], crowns = [];
                for (const d of stations){
                    const q = atStation(e, left, d), previous = pts.at(-1);
                    if (previous && Math.hypot(previous[0] - q.x, previous[1] - q.z) < 0.005) continue;
                    const profile = profileAt(d);
                    pts.push([q.x, q.z]);
                    widths.push(profile?.width ?? 0);
                    crowns.push(profile && profile.to - profile.from >= (stripApproach ? 0.52 : 0.85) ? { ...profile } : null);
                    heights.push(air ? roadHeight(q.y) : 0);
                    dists.push(d);
                }
                if (pts.length < 2) continue;
                const [x, z] = pts[0], ns = normals(pts);
                const across = (i, w)=>[pts[i][0] - ns[i][0] * w, pts[i][1] - ns[i][1] * w];
                const opposite = widths.map((w, i)=>across(i, w));
                // Pavement spans the matched gap, including any opening used by a turn.
                if (!air) ribbonY(surface.at(x, z), {pts: opposite, y: heights}, {pts, y: heights}, null);
                for (let start = 0; start < pts.length - 1; start++){
                    if (!crowns[start]) continue;
                    let end = start + 1;
                    while(end < pts.length && crowns[end] &&
                        Math.min(crowns[end - 1].to, crowns[end].to) - Math.max(crowns[end - 1].from, crowns[end].from) > 0.25) end++;
                    const last = end - 1, len = dists[last] - dists[start];
                    if (len >= 2){
                        // Smooth minor local sampling jitter along continuous median runs without blurring nose tapers.
                        for (let pass = 0; pass < 2; pass++) {
                            const orig = crowns.slice(start, end).map(c=>({ ...c }));
                            for (let k = 1; k < orig.length - 1; k++) {
                                const df = Math.max(Math.abs(orig[k].from - orig[k - 1].from), Math.abs(orig[k].from - orig[k + 1].from));
                                const dt = Math.max(Math.abs(orig[k].to - orig[k - 1].to), Math.abs(orig[k].to - orig[k + 1].to));
                                if (df < 0.7) crowns[start + k].from = 0.25 * orig[k - 1].from + 0.5 * orig[k].from + 0.25 * orig[k + 1].from;
                                if (dt < 0.7) crowns[start + k].to = 0.25 * orig[k - 1].to + 0.5 * orig[k].to + 0.25 * orig[k + 1].to;
                            }
                        }
                        const maxWidth = Math.max(...crowns.slice(start, end).map(({from, to})=>to - from));
                        const radius = Math.min(len * 0.4, Math.max(2.2, maxWidth * 0.58));
                        const taperStart = dists[start] > 0.1 || e.prev === undefined;
                        const taperEnd = dists[last] < e.ref.length - 0.1 || e.next === undefined;
                        const near = [], far = [];
                        for (let i = start; i < end; i++){
                            const d = dists[i], {from, to} = crowns[i];
                            const t = Math.max(0, Math.min(1, taperStart ? (d - dists[start]) / radius : 1, taperEnd ? (dists[last] - d) / radius : 1));
                            const inset = Math.max(0.04, (to - from - 0.14) * (1 - Math.sqrt(t * (2 - t))) / 2);
                            near.push(across(i, from + inset));
                            far.push(across(i, to - inset));
                        }
                        const y = heights.slice(start, end);
                        const planted = len >= 7 && maxWidth >= 1.7;
                        const target = air ? deckMedianPaving : stripApproach ? concreteMedians : planted ? medians : medianPaving;
                        ribbonY(target.at(x, z), {pts: far, y}, {pts: near, y}, WALK_HEIGHT);
                        if (stripApproach && len >= 5 && maxWidth >= 2.8 && !hasPavedStripMedian(e)) {
                            const inner = [[], []];
                            for (let i = 0; i < near.length; i++){
                                const [nx, nz] = near[i], [fx, fz] = far[i];
                                const width = Math.hypot(nx - fx, nz - fz);
                                const d = dists[start + i] - dists[start];
                                const tip = Math.min(taperStart ? d : Infinity, taperEnd ? len - d : Infinity);
                                const fill = Math.max(0, Math.min(1, (width - 2.4) / 0.8, (tip - 2.8) / 2));
                                const growth = fill * fill * (3 - 2 * fill);
                                const t = 0.5 - 0.5 * growth * Math.max(0, 1 - 0.84 / Math.max(0.84, width));
                                inner[0].push([fx + (nx - fx) * t, fz + (nz - fz) * t]);
                                inner[1].push([nx + (fx - nx) * t, nz + (fz - nz) * t]);
                            }
                            ribbonY(medianPlanting.at(x, z), {pts: inner[0], y}, {pts: inner[1], y}, WALK_HEIGHT + 0.012);
                        }
                        const curbWidth = stripApproach ? 0.12 : 0.19;
                        sidewalkPiece({pts: near, y}, 0, -curbWidth, 0, air);
                        sidewalkPiece({pts: far, y}, 0, curbWidth, 0, air);
                    }
                    start = last;
                }
            }
        }
        const internal = !!e.internal || !stripApproach && e.ref.length < 48 && setback.has(e.fromNode) && setback.has(e.toNode);
        if (e.cls === 'service' && !air && e.way.svc !== 'parking_aisle') {
            const s0 = setback.has(e.fromNode) ? endSetback(e, e.fromNode) : 2.5;
            const s1 = e.ref.length - (setback.has(e.toNode) ? endSetback(e, e.toNode) : 2.5);
            const svcClear = (d)=>{
                const q = sample(e.ref, d), nx = -q.hz, nz = q.hx;
                const lOff = boundaryAt(e, 0, d), rOff = boundaryAt(e, e.lanes.length, d);
                return !onAnyNonServiceRoad(q.x + nx * lOff, q.z + nz * lOff, q.y, 0.3, e.way.id) && !onAnyNonServiceRoad(q.x + nx * rOff, q.z + nz * rOff, q.y, 0.3, e.way.id);
            };
            const spans = clearSpans(s0, s1, 1.0, svcClear);
            for (const [c0, c1] of spans){
                const span = c1 - c0;
                if (e.oneway && span >= 6.5) {
                    const positions = [];
                    if (span < 22) positions.push((c0 + c1) * 0.5);
                    else for(let d = c0 + 9; d <= c1 - 5.5; d += 22)positions.push(d);
                    for (const d of positions){
                        if (!markFits(e, d, 1.95)) continue;
                        const q = sample(e.ref, d);
                        const inValet = valetZones.some((z)=>Math.abs(z.x - q.x) < z.r && Math.abs(z.z - q.z) < z.r);
                        const target = inValet ? paint : paintDim;
                        const midIdx = Math.floor(e.lanes.length / 2);
                        if (e.lanes[midIdx] !== undefined) {
                            const lq = laneSample(e, midIdx, d);
                            arrow(target.at(lq.x, lq.z), lq, [
                                'through'
                            ], null);
                        }
                    }
                }
                if (span >= 8 && e.lanes.length >= 2) {
                    for(let i = 1; i < e.lanes.length; i++){
                        const line = laneBoundary(e, i);
                        for (const [d0, d1] of dashRuns(c0, c1, 2.4, 6.6, 0)){
                            paintRibbon(e, line, d0, d1, 0.06, paintDim);
                        }
                    }
                }
            }
        }
        if (internal || e.cls === 'service') continue;
        const a0 = isLinkOrRamp && !setback.has(e.fromNode) ? 0 : mouthStart.get(e.id)?.clear ?? endSetback(e, e.fromNode);
        const a1 = e.ref.length - (isLinkOrRamp && !setback.has(e.toNode) ? 0 : mouthEnd.get(e.id)?.stop ?? endSetback(e, e.toNode));
        const hasPrev = e.prev !== undefined && g.edges[e.prev]?.lanes.length === e.lanes.length;
        const prevLen = hasPrev ? g.edges[e.prev].ref.length : 0;
        if (a1 - a0 < (setback.has(e.fromNode) && setback.has(e.toNode) ? 9 : hasPrev ? 0.8 : 4)) continue;
        const P = air ? deckPaint : paint;
        const PY = air ? deckPaintYellow : paintYellow;
        const yOff = air ? 0.075 : null;
        const at = (s, x, z)=>s.at(x, z);
        const strip = (line, from, to, half, target)=>paintRibbon(e, line, from, to, half, target, yOff);
        const stripFiltered = (line, from, to, half, target, keep)=>{
            if (!keep) {
                strip(line, from, to, half, target);
                return;
            }
            for (const [s0, s1] of clearSpans(from, to, 1.0, keep))strip(line, s0, s1, half, target);
        };
        const crossSectionClear = (d, margin = 0.25)=>{
            const q = sample(e.ref, d), nx = -q.hz, nz = q.hx;
            const lOff = boundaryAt(e, 0, d), rOff = boundaryAt(e, e.lanes.length, d), mOff = (lOff + rOff) * 0.5;
            return !onMainCarriageway(q.x + nx * lOff, q.z + nz * lOff, q.y, margin, e.way.id) && !onMainCarriageway(q.x + nx * mOff, q.z + nz * mOff, q.y, margin, e.way.id) && !onMainCarriageway(q.x + nx * rOff, q.z + nz * rOff, q.y, margin, e.way.id);
        };
        for(let i = 1; i < e.lanes.length; i++){
            const line = laneBoundary(e, i);
            if (stripApproach) {
                const only = (t, m)=>!!t && t.length === 1 && t[0] === m;
                const turnDiv = only(e.turns[i - 1], 'left') && !only(e.turns[i], 'left') || only(e.turns[i], 'right') && !only(e.turns[i - 1], 'right');
                const stripTail = !isLinkOrRamp && intersectionAt(e.toNode)?.control === 'signal' && e.cls === 'arterial' ? Math.min(18, Math.max(0, (a1 - a0) * 0.42)) : 0;
                const dashEnd = turnDiv ? a0 : Math.max(a0, a1 - stripTail);
                // Crisp Apple Maps dashes along Strip approaches, transitioning to solid pocket/stop-bar channelization.
                for (const [d0, d1] of dashRuns(a0, dashEnd, 2.4, 4.6, dashStart.get(e.id) ?? 0)){
                    const d = (d0 + d1) * 0.5, mid = boundaryAt(e, i, d);
                    if (Math.min(mid - boundaryAt(e, i - 1, d), boundaryAt(e, i + 1, d) - mid) < 1.15) continue;
                    if (isLinkOrRamp && !crossSectionClear(d)) continue;
                    strip(line, d0, d1, 0.072, P);
                }
                if (dashEnd < a1 - 0.5) {
                    const keepStrip = isLinkOrRamp ? (d)=>crossSectionClear(d, 0.25) : undefined;
                    stripFiltered(line, dashEnd, a1, turnDiv ? 0.085 : 0.072, P, (d)=>{
                        const mid = boundaryAt(e, i, d);
                        if (Math.min(mid - boundaryAt(e, i - 1, d), boundaryAt(e, i + 1, d) - mid) < 1.15) return false;
                        return !keepStrip || keepStrip(d);
                    });
                }
                continue;
            }
            const closes = (j)=>!!j && (Math.abs(j[i] - j[i - 1]) < 0.5 || Math.abs(j[i + 1] - j[i]) < 0.5);
            const from = closes(e.jointStart) ? Math.max(a0, e.taperStart ?? 0) : a0;
            const to = closes(e.jointEnd) ? Math.min(a1, e.ref.length - (e.taperEnd ?? 0)) : a1;
            const keepDiv = isLinkOrRamp ? (d)=>crossSectionClear(d, 0.25) : undefined;
            const only = (t, m)=>!!t && t.length === 1 && t[0] === m;
            if (only(e.turns[i - 1], 'left') && !only(e.turns[i], 'left') || only(e.turns[i], 'right') && !only(e.turns[i - 1], 'right')) {
                if (to - from > 1) stripFiltered(line, from, to, 0.09, P, keepDiv);
                continue;
            }
            const solidTail = intersectionAt(e.toNode)?.control === 'signal' && e.cls === 'arterial' ? Math.min(28, Math.max(0, (to - from) * 0.65)) : 0;
            const tail = to === a1 ? solidTail : 0;
            if (to - from - tail > 1) {
                for (const [d0, d1] of dashRuns(from, to - tail, 2.6, 9.4, dashStart.get(e.id) ?? 0)){
                    if (keepDiv && !keepDiv((d0 + d1) * 0.5)) continue;
                    strip(line, d0, d1, 0.065, P);
                }
            }
            if (tail > 1) stripFiltered(line, a1 - tail, a1, 0.075, P, keepDiv);
        }
        if (e.oneway) {
            if (e.cls !== 'local') {
                const leftEdge = edgeLine(e, (at)=>boundaryAt(e, 0, at) + 0.3);
                const leftTarget = e.cls === 'motorway' || e.cls === 'ramp' ? PY : air ? deckPaint : paintDim;
                stripFiltered(leftEdge, a0, a1, 0.075, leftTarget, isLinkOrRamp ? (d)=>{
                    const q = atStation(e, leftEdge, d);
                    return !onMainCarriageway(q.x, q.z, q.y, 0.2, e.way.id);
                } : undefined);
            }
        } else {
            const hasCenterTurn = !e.way.ow && (e.way.lanes ?? 0) % 2 === 1 && (e.way.lanes ?? 0) >= 3 && !e.way.lf;
            if (hasCenterTurn) {
                const outerY = edgeLine(e, (at)=>boundaryAt(e, 0, at) + 0.12);
                const innerY = edgeLine(e, (at)=>boundaryAt(e, 0, at) - 0.12);
                strip(outerY, a0, a1, 0.065, PY);
                for (const [d0, d1] of dashRuns(a0, a1, 2.6, 5.4, 0)){
                    strip(innerY, d0, d1, 0.06, PY);
                }
            } else if (e.twin === undefined || e.id < e.twin) {
                strip(edgeLine(e, (at)=>boundaryAt(e, 0, at) - 0.13), a0, a1, 0.068, PY);
                strip(edgeLine(e, (at)=>boundaryAt(e, 0, at) + 0.13), a0, a1, 0.068, PY);
            }
        }
        if (e.cls === 'motorway' || e.cls === 'ramp' || e.cls === 'arterial' || isLink) {
            const rightEdge = edgeLine(e, (at)=>boundaryAt(e, e.lanes.length, at) - 0.3);
            stripFiltered(rightEdge, a0, a1, 0.08, P, isLinkOrRamp ? (d)=>{
                const q = atStation(e, rightEdge, d);
                return !onMainCarriageway(q.x, q.z, q.y, 0.2, e.way.id);
            } : (d)=>{
                const q = atStation(e, rightEdge, d), nx = -q.hz, nz = q.hx;
                return !onLinkOrSvcCarriageway(q.x + nx * 0.75, q.z + nz * 0.75, q.y, 0.15, e.way.id);
            });
        }
        const ix = intersectionAt(e.toNode);
        const controlled = setback.has(e.toNode) && !!ix && (ix.control === 'signal' || (e.cls === 'collector' || e.cls === 'local' && e.explicitTurns) && ix.legs.length >= 3);
        const nxtLink = e.next !== undefined ? g.edges[e.next] : null;
        const downstreamControlled = !!nxtLink && /_link$/.test(nxtLink.way.hw) && nxtLink.ref.length < 26 && setback.has(nxtLink.toNode) && !!intersectionAt(nxtLink.toNode);
        if (e.oneway && isLink && !controlled && !downstreamControlled) {
            const cSpans = clearSpans(a0, a1, 1.0, d=>crossSectionClear(d, 0.35) && markFits(e, d, 1.95));
            for (const [c0, c1] of cSpans){
                const span = c1 - c0;
                if (span < 11) continue;
                const d = (c0 + c1) * 0.5;
                e.lanes.forEach((_, i)=>{
                    const q = laneSample(e, i, d);
                    const mv = (!stripApproach || e.explicitTurns) && e.turns[i]?.length ? e.turns[i] : ['through'];
                    arrow(at(P, q.x, q.z), q, mv, yOff);
                });
            }
        }
        const chainSpan = a1 - a0 + prevLen;
        if (controlled && e.cls !== 'motorway' && e.cls !== 'ramp' && chainSpan > 14 && a1 - a0 > 0.8) {
            const sL = a1 + 0.2;
            const p = sample(e.ref, sL);
            const left = atStation(e, laneBoundary(e, 0), sL);
            const right = atStation(e, laneBoundary(e, e.lanes.length), sL);
            const s = at(P, p.x, p.z);
            const bar = [[left, -0.22], [right, -0.22], [right, 0.22], [left, 0.22]].map(([q, d])=>
                s.vert(q.x + p.hx * d, paintHeight(q.y, yOff), q.z + p.hz * d));
            s.quad(...bar);
            const chainLaneSample = (laneIdx, d, half)=>{
                if (d >= a0 && markFits(e, d, half)) return laneSample(e, laneIdx, d);
                if (d < 0 && hasPrev) {
                    const pe = g.edges[e.prev], pd = pe.ref.length + d;
                    if (pd >= 3.5 && markFits(pe, pd, half)) return laneSample(pe, laneIdx, pd);
                }
                return null;
            };
            const laneMoves = e.lanes.map((lid, i)=>{
                const connMoves = new Set();
                for (const cid of g.lanes[lid].next){
                    const c = g.lanes[cid], toLane = g.lanes[c?.next?.[0]];
                    const toEdge = toLane ? g.edges[toLane.edge] : null;
                    if (!toEdge) continue;
                    if (e.cls !== 'service' && toEdge.cls === 'service' && !e.explicitTurns) continue;
                    if (c.movement === 'left' || c.movement === 'right' || c.movement === 'through' ||
                        stripApproach && (c.movement === 'uturn' || c.movement === 'merge')) connMoves.add(c.movement);
                }
                if (stripApproach) return [...connMoves];
                if (e.explicitTurns) {
                    const t = e.turns[i] ?? [
                        'through'
                    ];
                    if (t.length === 1) return t;
                    const filt = t.filter((m)=>connMoves.has(m));
                    return filt.length ? filt : t;
                }
                if (ix.legs.length < 3) return [];
                return [
                    ...connMoves
                ];
            });
            const anyTurn = e.explicitTurns || laneMoves.some((mv)=>mv.some(m=>m !== 'through'));
            if (anyTurn && (e.lanes.length >= 2 || e.explicitTurns)) {
                e.lanes.forEach((_, i)=>{
                    const mv = laneMoves[i];
                    if (!mv || !mv.length) return;
                    const q = chainLaneSample(i, a1 - 7.5, stripApproach ? 1.5 : 1.95);
                    if (!q) return;
                    const arrowS = a1 - 7.5;
                    const qPrev = chainLaneSample(i, arrowS - 3.5, 0.5), qNext = chainLaneSample(i, arrowS + 3.5, 0.5);
                    const flatCurve = !qPrev || !qNext || qPrev.hx * qNext.hx + qPrev.hz * qNext.hz > 0.94;
                    const showArrow = flatCurve && e.ref.length >= 13 && (ix.control === 'signal' || e.cls !== 'local' || e.explicitTurns);
                    if (showArrow) {
                        arrow(at(P, q.x, q.z), q, mv, yOff, stripApproach ? 0.88 : 1);
                        if (mv.length === 1 && (mv[0] === 'left' || mv[0] === 'right') && e.cls !== 'local') {
                            const q2 = chainLaneSample(i, a1 - 16.5, stripApproach ? 1.5 : 0.9);
                            if (q2 && q2.width >= 2.55) {
                                const straight = q.hx * q2.hx + q.hz * q2.hz > 0.93;
                                if (straight && (ix.control === 'signal' || e.explicitTurns || e.cls === 'arterial' || e.cls === 'collector')) {
                                    onlyText(at(P, q2.x, q2.z), q2, yOff);
                                }
                            }
                        }
                    }
                });
            }
        }
    }
    for (const chain of stripStreets.slips){
        if (chain.some(e=>isAir(e.ref))) continue;
        // Sweep left of the turn lane only as far as the adjoining road or turn connector.
        const points = [];
        for (const e of chain) for (const p of laneBoundary(e, 0).pts) {
            const last = points.at(-1);
            if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.02) points.push(p);
        }
        const line = makeLine(points, points.map(()=>0));
        const shoulder = 0.34;
        const across = (q, d)=>[q.x + q.hz * d, q.z - q.hx * d];
        const widthAt = (s)=>{
            const q = sample(line, s);
            for (let d = shoulder; d <= 17; d += 0.25) {
                const [x, z] = across(q, d);
                if (!onAnyNonServiceRoad(x, z, 0, 0.17) && !onConnector(x, z, 0.22)) continue;
                let lo = Math.max(shoulder, d - 0.25), hi = d;
                for (let k = 0; k < 5; k++) {
                    const mid = (lo + hi) * 0.5;
                    const [mx2, mz2] = across(q, mid);
                    if (!onAnyNonServiceRoad(mx2, mz2, 0, 0.17) && !onConnector(mx2, mz2, 0.22)) lo = mid;
                    else hi = mid;
                }
                const bounded = [0, 2, 4].some(delta=>{
                    const [mx, mz] = across(q, lo + delta);
                    return onMainCarriageway(mx, mz, 0, 0.17);
                });
                return bounded ? Math.max(0, lo - shoulder - 0.22) : 0;
            }
            return 0;
        };
        const islandOutlines = [];
        for (const [s0, s1] of clearSpans(1, line.length - 1, 0.65, s=>widthAt(s) > 1.05)){
            const length = s1 - s0;
            if (length < 4.5) continue;
            const sections = Math.max(3, Math.ceil(length / 0.65)), near = [], far = [], y = [];
            const rawWidths = Array.from({ length: sections + 1 }, (_, i)=>widthAt(s0 + length * i / sections));
            const smoothWidths = rawWidths.slice();
            for (let pass = 0; pass < 2; pass++) {
                const prev = smoothWidths.slice();
                for (let k = 1; k < prev.length - 1; k++) smoothWidths[k] = 0.25 * prev[k - 1] + 0.5 * prev[k] + 0.25 * prev[k + 1];
            }
            for (let i = 0; i <= sections; i++){
                const d = length * i / sections, s = s0 + d;
                const q = sample(line, s), width = smoothWidths[i];
                const t = Math.max(0, Math.min(1, Math.min(d, length - d) / 2.2));
                const inset = width * (1 - Math.sqrt(t * (2 - t))) / 2;
                near.push(across(q, shoulder + inset));
                far.push(across(q, shoulder + width - inset));
                y.push(0);
            }
            const [x, z] = near[0];
            islandOutlines.push(...near, ...far);
            ribbonY(concreteMedians.at(x, z), {pts: far, y}, {pts: near, y}, WALK_HEIGHT);
            sidewalkPiece({pts: near, y}, 0, -0.1, 0);
            sidewalkPiece({pts: far, y}, 0, 0.1, 0);
        }
        // Use the local pavement beneath gaps left open for vehicle paths between islands.
        const base = convexHull(islandOutlines);
        if (base.length >= 3) slipPavement.at(...base[0]).polygon(base, 0);
    }
    for (const A of g.edges){
        if (A.next === undefined || A.internal) continue;
        const B = g.edges[A.next];
        const pa = sample(A.ref, A.ref.length), pb = sample(B.ref, 0);
        const [al0] = extents(A), [bl0] = extents(B);
        const m = A.mitreEnd;
        const corners = (p, l, r)=>[
                [
                    p.x + m[0] * l,
                    p.z + m[1] * l
                ],
                [
                    p.x + m[0] * r,
                    p.z + m[1] * r
                ]
            ];
        const ra = boundaryAt(A, A.lanes.length, A.ref.length), rb = boundaryAt(B, B.lanes.length, 0);
        const la = boundaryAt(A, 0, A.ref.length) + al0, lb = boundaryAt(B, 0, 0) + bl0;
        const hull = convexHull([
            ...corners(pa, la, ra + 0.15),
            ...corners(pb, lb, rb + 0.15)
        ]);
        if (pa.y > 0.03 || pb.y > 0.03) {
            const target = surfaceFor(A) === freeway && surfaceFor(B) === freeway ? freewayDeckTop : deckTop;
            if (hull.length >= 3) target.at(pa.x, pa.z).polygon(hull, 0.5 * (pa.y + pb.y));
            continue;
        }
        if (hull.length >= 3) surfaceFor(A.cls === 'motorway' ? A : B).at(pa.x, pa.z).polygon(hull, 0);
        if ((A.cls === 'arterial' || A.cls === 'collector' || A.cls === 'local') && !((/_link$/.test(A.way.hw) || /_link$/.test(B.way.hw)) && onMainCarriageway(pa.x, pa.z, pa.y, 2.0, A.way.id))) {
            const swA = sidewalkWidth(A), swB = sidewalkWidth(B);
            const walk = convexHull([
                ...corners(pa, ra + 0.15, ra + 0.15 + swA),
                ...corners(pb, rb + 0.15, rb + 0.15 + swB)
            ]);
            const blocked = (px, pz)=>onAnyNonServiceRoad(px, pz, pa.y, 0.25, A.way.id, A.id) ||
                onLinkOrSvcCarriageway(px, pz, pa.y, 0.35, A.way.id, A.id) ||
                onConnector(px, pz, 0.25);
            const walkClear = walk.length >= 3 && !walk.some(([wx, wz], idx)=>{
                const nx = walk[(idx + 1) % walk.length];
                return blocked(wx, wz) || blocked((wx + nx[0]) * 0.5, (wz + nx[1]) * 0.5);
            });
            if (walkClear) sidewalk.at(pa.x, pa.z).polygon(walk, WALK_HEIGHT);
        }
    }
    for (const [id, r] of setback){
        const node = g.nodes.get(id);
        const pts = [], rims = [];
        let air = false;
        let surf = asphalt;
        let freewayOnly = true;
        let minEdgeY = Infinity, maxEdgeY = -Infinity, hasNonService = false;
        const connected = [
            ...node.inEdges,
            ...node.outEdges
        ];
        for (const ei of connected){
            const e = g.edges[ei];
            const [l0, l1] = extents(e);
            const atStart = e.fromNode === id;
            const s = atStart ? Math.min(e.ref.length, r + 1) : Math.max(0, e.ref.length - r - 1);
            const p = sample(e.ref, s);
            const nx = -p.hz, nz = p.hx;
            pts.push([
                p.x + nx * l0,
                p.z + nz * l0
            ], [
                p.x + nx * l1,
                p.z + nz * l1
            ]);
            const q = sample(e.ref, atStart ? 0 : e.ref.length);
            const [qx, qz] = (atStart ? e.mitreStart : e.mitreEnd) ?? [-q.hz, q.hx];
            const end = atStart ? 0 : e.ref.length;
            const lo = boundaryAt(e, 0, end) + l0;
            const hi = boundaryAt(e, e.lanes.length, end) + l1 - e.lanes.length * e.laneWidth;
            rims.push([q.x + qx * lo, q.z + qz * lo], [q.x + qx * hi, q.z + qz * hi]);
            pts.push([
                q.x + nx * l0,
                q.z + nz * l0
            ], [
                q.x + nx * l1,
                q.z + nz * l1
            ]);
            minEdgeY = Math.min(minEdgeY, p.y, q.y);
            maxEdgeY = Math.max(maxEdgeY, p.y, q.y);
            if (p.y > ELEV) air = true;
            if (e.cls === 'arterial') surf = major;
            if (e.cls !== 'service') hasNonService = true;
            if (surfaceFor(e) !== freeway) freewayOnly = false;
        }
        // The raised approach ribbons already cover sloped decks. Never emit a flat horizontal pad
        // across an inclined viaduct split (causes slicing cliff steps).
        const raised = air || node.y > ELEV;
        if (raised && maxEdgeY - minEdgeY > 0.28) continue;
        const hull = convexHull(raised ? rims : pts);
        if (hull.length < 3) continue;
        const span = Math.max(...hull.map((p)=>Math.hypot(p[0] - node.x, p[1] - node.z)));
        const maxSpan = hasNonService ? r * 2.4 + 14 : r * 1.85 + 8;
        if (span > maxSpan) continue;
        if (raised) (freewayOnly ? freewayDeckTop : deckTop).at(node.x, node.z).polygon(hull, Math.max(0, node.y - 0.015));
        else surf.at(node.x, node.z).polygon(hull, 0);
    }
    {
        const byCtr = new Map();
        for (const leg of legs){
            const k = `${leg.ctr[0].toFixed(2)},${leg.ctr[1].toFixed(2)}`;
            if (!byCtr.has(k)) byCtr.set(k, []);
            byCtr.get(k).push(leg);
        }
        const mouthOf = (leg)=>{
            const pts = [];
            let air = false, y = 0;
            for (const { e, atStart } of leg.entries){
                const m = (atStart ? mouthStart : mouthEnd).get(e.id);
                if (!m) continue;
                const [l0, l1] = extents(e), station = atStart ? m.inner : e.ref.length - m.inner;
                const q = sample(e.ref, station), nx = -q.hz, nz = q.hx;
                const left = atStation(e, laneBoundary(e, 0), station);
                const right = atStation(e, laneBoundary(e, e.lanes.length), station);
                const outer = l1 - e.lanes.length * e.laneWidth;
                pts.push([left.x + nx * l0, left.z + nz * l0], [right.x + nx * outer, right.z + nz * outer]);
                if (q.y > ELEV) {
                    air = true;
                    y = Math.max(y, q.y);
                }
            }
            if (!pts.length) return null;
            const mx = pts.reduce((t, p)=>t + p[0], 0) / pts.length, mz = pts.reduce((t, p)=>t + p[1], 0) / pts.length;
            const sign = (mx - leg.ctr[0]) * leg.a[0] + (mz - leg.ctr[1]) * leg.a[1] >= 0 ? 1 : -1;
            return {
                pts,
                dir: [
                    leg.a[0] * sign,
                    leg.a[1] * sign
                ],
                air,
                y
            };
        };
        for (const list of byCtr.values()){
            if (list.length < 2) continue;
            const mouths = list.map((leg)=>({
                    leg,
                    m: mouthOf(leg)
                })).filter((o)=>o.m).map((o)=>({
                    leg: o.leg,
                    ...o.m
                }));
            mouths.sort((a, b)=>Math.atan2(a.dir[1], a.dir[0]) - Math.atan2(b.dir[1], b.dir[0]));
            for(let i = 0; i < mouths.length; i++){
                const A = mouths[i], B = mouths[(i + 1) % mouths.length];
                if (A === B) continue;
                const cross = A.dir[0] * B.dir[1] - A.dir[1] * B.dir[0], dot = A.dir[0] * B.dir[0] + A.dir[1] * B.dir[1];
                if (cross < 0.35 || dot > 0.7) continue;
                const edgeToward = (pts, d, o)=>pts.reduce((best, p)=>{
                        const side = (p[0] - A.leg.ctr[0]) * o[0] + (p[1] - A.leg.ctr[1]) * o[1] - ((p[0] - A.leg.ctr[0]) * d[0] + (p[1] - A.leg.ctr[1]) * d[1]) * (d[0] * o[0] + d[1] * o[1]);
                        return side > best.side ? {
                            side,
                            p
                        } : best;
                    }, {
                        side: -Infinity,
                        p: pts[0]
                    }).p;
                const pa = edgeToward(A.pts, A.dir, B.dir), pb = edgeToward(B.pts, B.dir, A.dir);
                const dx = pb[0] - pa[0], dz = pb[1] - pa[1];
                const t = (dx * B.dir[1] - dz * B.dir[0]) / cross;
                const X = [
                    pa[0] + A.dir[0] * t,
                    pa[1] + A.dir[1] * t
                ];
                if (Math.hypot(X[0] - pa[0], X[1] - pa[1]) > 45 || Math.hypot(X[0] - pb[0], X[1] - pb[1]) > 45) continue;
                const big = [
                    ...A.leg.entries,
                    ...B.leg.entries
                ].some(({ e })=>e.cls === 'arterial');
                const R = big ? 11 : 6;
                const aOut = (pa[0] - X[0]) * A.dir[0] + (pa[1] - X[1]) * A.dir[1];
                const bOut = (pb[0] - X[0]) * B.dir[0] + (pb[1] - X[1]) * B.dir[1];
                const joins = aOut >= 1 && bOut >= 1 && aOut <= 20 && bOut <= 20;
                const p0 = joins ? pa : [
                    X[0] + A.dir[0] * R,
                    X[1] + A.dir[1] * R
                ], p2 = joins ? pb : [
                    X[0] + B.dir[0] * R,
                    X[1] + B.dir[1] * R
                ];
                const curve = [];
                for(let k = 0; k <= 12; k++){
                    const u = k / 12, v = 1 - u;
                    curve.push([
                        v * v * p0[0] + 2 * v * u * X[0] + u * u * p2[0],
                        v * v * p0[1] + 2 * v * u * X[1] + u * u * p2[1]
                    ]);
                }
                if (A.air || B.air) {
                    deckTop.at(X[0], X[1]).polygon([
                        X,
                        ...curve
                    ], Math.max(A.y, B.y) + 0.01);
                    continue;
                }
                const mid = curve[6], nC = normals(curve);
                const away = (mid[0] - X[0]) * nC[6][0] + (mid[1] - X[1]) * nC[6][1] > 0 ? 1 : -1;
                (big ? major : asphalt).at(X[0], X[1]).polygon([
                    X,
                    ...curve
                ], 0);
                const curveBlocked = curve.some((p, k)=>k > 0 && k < curve.length - 1 && (
                    onMainCarriageway(p[0], p[1], 0, 0.25) ||
                    onLinkOrSvcCarriageway(p[0], p[1], 0, 0.25) ||
                    onConnector(p[0], p[1], 0.25) ||
                    onAnyNonServiceRoad(p[0] + nC[k][0] * away * 0.9, p[1] + nC[k][1] * away * 0.9, 0, 0.25)
                ));
                if (!curveBlocked) sidewalkPiece({pts: curve, y: curve.map(()=>0)}, 0, away * 0.25, big ? 3.2 : 2.6);
            }
        }
    }
    // Smooth tangent-arc corner fillets at ALL minor / valet / T-junction nodes (replaces jagged convexHull cornerFillets)
    {
        const legCoveredNodes = new Set(legs.flatMap(l=>l.entries.map(en=>en.node)));
        for (const [id, node] of g.nodes) {
            if (legCoveredNodes.has(id) || node.y > ELEV) continue;
            const rays = [];
            for (const ei of [...node.inEdges, ...node.outEdges]) {
                const e = g.edges[ei];
                if (e.internal || e.cls === 'motorway' || e.cls === 'ramp' || e.way.svc === 'parking_aisle') continue;
                const atStart = e.fromNode === id;
                if (e.twin !== undefined && e.twin < e.id && !e.oneway) continue;
                const d = Math.min(8, e.ref.length * 0.6);
                if (d < 1.5) continue;
                const q = sample(e.ref, atStart ? 0 : e.ref.length);
                if (q.y > ELEV) continue;
                const pEnd = sample(e.ref, atStart ? d : e.ref.length - d);
                let ax = pEnd.x - q.x, az = pEnd.z - q.z;
                const L = Math.hypot(ax, az) || 1;
                ax /= L; az /= L;
                const nx = -az, nz = ax;
                const [l0, l1] = extents(e), W = e.lanes.length * e.laneWidth;
                const latRight = atStart ? boundaryAt(e, e.lanes.length, 0) + l1 - W : -(boundaryAt(e, 0, e.ref.length) + l0);
                const latLeft = atStart ? -(boundaryAt(e, 0, 0) + l0) : boundaryAt(e, e.lanes.length, e.ref.length) + l1 - W;
                rays.push({ e, ax, az, nx, nz, q, latRight: Math.max(0.8, latRight), latLeft: Math.max(0.8, latLeft), ang: Math.atan2(az, ax) });
            }
            if (rays.length < 2) continue;
            rays.sort((a, b)=>a.ang - b.ang);
            for (let i = 0; i < rays.length; i++) {
                const A = rays[i], B = rays[(i + 1) % rays.length];
                const cross = A.ax * B.az - A.az * B.ax, dot = A.ax * B.ax + A.az * B.az;
                if (cross < 0.28 || dot > 0.78) continue;
                // Curb edge of A facing toward B (+A.nx), and curb edge of B facing toward A (-B.nx)
                const pa = [A.q.x + A.nx * A.latRight, A.q.z + A.nz * A.latRight];
                const pb = [B.q.x - B.nx * B.latLeft, B.q.z - B.nz * B.latLeft];
                const t = ((pb[0] - pa[0]) * B.az - (pb[1] - pa[1]) * B.ax) / cross;
                const u = ((pb[0] - pa[0]) * A.az - (pb[1] - pa[1]) * A.ax) / cross;
                if (t < 0.2 || u < 0.2 || t > 32 || u > 32) continue;
                const X = [pa[0] + A.ax * t, pa[1] + A.az * t];
                const maxR = Math.min(A.e.ref.length, B.e.ref.length) * 0.45;
                const hasArt = A.e.cls === 'arterial' || B.e.cls === 'arterial';
                const hasLoc = A.e.cls === 'collector' || B.e.cls === 'local' || /_link$/.test(A.e.way.hw) || /_link$/.test(B.e.way.hw);
                const R = Math.min(maxR, hasArt ? 10.5 : hasLoc ? 6.5 : 4.2);
                if (R < 1.8) continue;
                const p0 = [X[0] + A.ax * R, X[1] + A.az * R];
                const p2 = [X[0] + B.ax * R, X[1] + B.az * R];
                const curve = [];
                for (let k = 0; k <= 10; k++) {
                    const s = k / 10, w = 1 - s;
                    curve.push([w * w * p0[0] + 2 * w * s * X[0] + s * s * p2[0], w * w * p0[1] + 2 * w * s * X[1] + s * s * p2[1]]);
                }
                const mid = curve[5];
                if (curve.some((p, k)=>k > 0 && k < curve.length - 1 && (onMainCarriageway(p[0], p[1], 0, 0.2) || onLinkOrSvcCarriageway(p[0], p[1], 0, 0.2) || onConnector(p[0], p[1], 0.2)))) continue;
                const surf = hasArt ? major : (A.e.cls === 'service' && B.e.cls === 'service' ? service : asphalt);
                surf.at(X[0], X[1]).polygon([X, ...curve], 0);
                const nC = normals(curve);
                const away = (mid[0] - X[0]) * nC[5][0] + (mid[1] - X[1]) * nC[5][1] > 0 ? 1 : -1;
                const bothWalk = dot < 0.40 && A.e.ref.length >= 15 && B.e.ref.length >= 15 &&
                    A.e.cls !== 'service' && B.e.cls !== 'service' && !/_link$/.test(A.e.way.hw) && !/_link$/.test(B.e.way.hw);
                if (bothWalk) {
                    const walkOutOk = !curve.some((p, k)=>{
                        for (const d of [0.35, 1.35, 2.1]) {
                            const wx = p[0] + nC[k][0] * away * d, wz = p[1] + nC[k][1] * away * d;
                            if (onAnyNonServiceRoad(wx, wz, 0, 0.2) || onLinkOrSvcCarriageway(wx, wz, 0, 0.2) || onConnector(wx, wz, 0.2)) return true;
                        }
                        return false;
                    });
                    if (walkOutOk) sidewalkPiece({pts: curve, y: curve.map(()=>0)}, 0, away * 0.20, 2.1);
                }
            }
        }
    }
    for (const leg of legs){
        const [ax, az] = leg.a, [px, pz] = leg.perp, [cx, cz] = leg.ctr;
        const crossings = [];
        for (const { road, station } of crossingPaint.junctions.get(leg) ?? []){
            const left = atStation(road, laneBoundary(road, 0), station);
            const right = atStation(road, laneBoundary(road, road.lanes.length), station);
            const across = (q)=>(q.x - cx) * px + (q.z - cz) * pz;
            const a = across(left), b = across(right);
            if (Math.abs(a - b) < 0.9) continue;
            const air = isAir(road.ref);
            crossings.push({ lo: Math.min(a, b), hi: Math.max(a, b), air, y: paintHeight(left.y, air ? 0.075 : null) });
        }
        crossings.sort((a, b)=>a.lo - b.lo);
        const bands = [];
        for (const crossing of crossings){
            const previous = bands.at(-1);
            if (previous && previous.air === crossing.air && Math.abs(previous.y - crossing.y) < 0.2 && crossing.lo <= previous.hi + 0.28) {
                previous.hi = Math.max(previous.hi, crossing.hi);
            } else {
                bands.push(crossing);
            }
        }
        const distance = leg.d + CROSSWALK_OFFSET;
        const crossing = { x: cx + ax * distance, z: cz + az * distance };
        for (const { lo, hi, air, y } of bands){
            const s = (air ? deckPaint : paint).at(crossing.x, crossing.z);
            for (const [from, to] of zebraBars(lo + 0.22, hi - 0.22)) {
                const v = (u, w)=>s.vert(crossing.x + px * u + ax * w, y, crossing.z + pz * u + az * w);
                s.quad(v(from, -CROSSWALK_HALF), v(to, -CROSSWALK_HALF), v(to, CROSSWALK_HALF), v(from, CROSSWALK_HALF));
            }
        }
        const pts = [];
        let major2 = false, legAir = false, legY = 0;
        for (const { e, atStart } of leg.entries){
            const m = (atStart ? mouthStart : mouthEnd).get(e.id);
            if (!m) continue;
            const [l0, l1] = extents(e), W2 = l1;
            const q = sample(e.ref, atStart ? m.inner : e.ref.length - m.inner), nx = -q.hz, nz = q.hx;
            pts.push([
                q.x + nx * l0,
                q.z + nz * l0
            ], [
                q.x + nx * W2,
                q.z + nz * W2
            ], [
                q.x + nx * l0 - ax * m.inner,
                q.z + nz * l0 - az * m.inner
            ], [
                q.x + nx * W2 - ax * m.inner,
                q.z + nz * W2 - az * m.inner
            ]);
            if (e.cls === 'arterial') major2 = true;
            if (q.y > ELEV) {
                legAir = true;
                legY = Math.max(legY, q.y);
            }
        }
        if (pts.length >= 4) {
            const hull = convexHull(pts);
            if (hull.length >= 3) {
                if (legAir) deckTop.at(cx, cz).polygon(hull, legY + 0.01);
                else (major2 ? major : asphalt).at(cx, cz).polygon(hull, 0);
            }
        }
    }
    for (const { road: e, point: p } of crossingPaint.standalone.values()){
        const nx = -p.hz, nz = p.hx;
        const [l0, l1] = extents(e);
        const twin = e.twin !== undefined ? g.edges[e.twin] : null;
        const from = e.oneway ? l0 : -(twin ? twin.lanes.length * twin.laneWidth : 0) + l0;
        const s = paint.at(p.x, p.z);
        for (const [lo, hi] of zebraBars(from + 0.28, l1 - 0.28)) quadAt(s, p, nx, nz, lo, hi, -CROSSWALK_HALF, CROSSWALK_HALF, null);
    }
    for (const k of g.lanes){
        if (!k.connector || !k.next.length || !k.prev.length || k.movement === 'through' || k.line.y.some((v)=>v > 1)) continue;
        const from = g.edges[g.lanes[k.prev[0]].edge], to = g.edges[g.lanes[k.next[0]].edge];
        if (!from || !to || from.cls !== 'service' && to.cls !== 'service' && from.cls !== 'local' && to.cls !== 'local') continue;
        const a = g.lanes[k.prev[0]].line, b = g.lanes[k.next[0]].line, mid = k.line.pts[k.line.pts.length >> 1];
        const pa = a.pts[a.pts.length - 1], pb = b.pts[0], reach = Math.max(k.width * 1.2, Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) * 0.28);
        const bow = Math.abs((mid[0] - pa[0]) * (pb[1] - pa[1]) - (mid[1] - pa[1]) * (pb[0] - pa[0])) / (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1);
        if (k.line.length < 5 || bow < reach * 0.5) continue;
        const surface = from.cls === 'arterial' || to.cls === 'arterial' ? major : from.cls === 'service' && to.cls === 'service' ? service : asphalt;
        const pts = k.line.pts;
        const pad = from.cls === 'service' || to.cls === 'service' ? 0.16 : 0.22;
        surface.at(pts[0][0], pts[0][1]).ribbon(pts, -k.width / 2 - pad, k.width / 2 + pad, 0);
    }
    {
        const drawnGuides = new Set();
        for (const k of g.lanes){
            if (!k.connector || k.movement !== 'left' || !k.prev.length || !k.next.length) continue;
            if (k.line.length < 11 || k.line.y.some((v)=>v > ELEV)) continue;
            const fromLane = g.lanes[k.prev[0]], toLane = g.lanes[k.next[0]];
            const fromEdge = fromLane ? g.edges[fromLane.edge] : null;
            const toEdge = toLane ? g.edges[toLane.edge] : null;
            if (!fromEdge || !toEdge || fromEdge.cls === 'service' || toEdge.cls === 'service') continue;
            const ix = intersectionAt(fromEdge.toNode);
            if (!ix || ix.control !== 'signal' || stripStreets.junctions.has(ix.id)) continue;
            const isPocket = /_link$/.test(fromEdge.way.hw) || (fromEdge.turns[fromLane.index]?.length === 1 && fromEdge.turns[fromLane.index][0] === 'left');
            if (!isPocket) continue;
            const guideKey = `${fromLane.id}->${toEdge.id}`;
            if (drawnGuides.has(guideKey)) continue;
            drawnGuides.add(guideKey);
            const arrival = crossingPaint.arrivals.get(fromEdge.id), departure = crossingPaint.departures.get(toEdge.id);
            const drawGuide = (guide)=>{
                const s0 = Math.min(3.2, guide.length * 0.18), s1 = Math.max(s0, guide.length - 3.2);
                if (s1 - s0 < 5.5) return;
                for (const [d0, d1] of dashRuns(s0, s1, 1.1, 2.2, 0)){
                    const piece = slice(guide.pts, d0, d1);
                    if (piece.pts.length < 2 || arrival && !guideClearsCrossing(piece.pts, arrival) ||
                        departure && !guideClearsCrossing(piece.pts, departure)) continue;
                    paintDim.at(piece.pts[0][0], piece.pts[0][1]).ribbon(piece.pts, -0.06, 0.06, 0);
                }
            };
            drawGuide(offset(k.line, -k.width * 0.5));
            if (fromLane.index > 0 && fromEdge.turns[fromLane.index - 1]?.includes('left')) drawGuide(offset(k.line, k.width * 0.5));
        }
    }
    const add = (arr)=>arr.forEach((m)=>group.add(m));
    const roadMat = surfaceMaterial('road', { grain: 0.16, weathering: 0.08, corridor: STRIP_PAVEMENT });
    const serviceMat = surfaceMaterial('service', {
        grain: 0.13, weathering: 0.05,
        corridor: { ...STRIP_PAVEMENT, innerRadius: 36, outerRadius: 94 }
    });
    const freewayMat = surfaceMaterial('freeway', { grain: 0.13, weathering: 0.08 });
    const walkMat = surfaceMaterial('sidewalk', { grain: 0.22, weathering: 0.04 });
    const curbMat = surfaceMaterial('curb', { grain: 0, weathering: 0 });
    const faceMat = surfaceMaterial('curb', { grain: 0, weathering: 0, tone: 0.59 });
    const medianMat = surfaceMaterial('median', { grain: 0.18, weathering: 0.06, texture: 'park' });
    add(slipPavement.meshes(roadMat, 'slip-pavement', ORDER.sidewalk - 1));
    add(sidewalk.meshes(walkMat, 'sidewalk', ORDER.sidewalk));
    add(service.meshes(serviceMat, 'service', ORDER.road));
    add(aisle.meshes(surfaceMaterial('parking', { grain: 0.12, weathering: 0.07 }), 'aisles', ORDER.road - 1));
    add(asphalt.meshes(roadMat, 'asphalt', ORDER.road + 1));
    add(major.meshes(roadMat, 'major', ORDER.road + 2));
    add(freeway.meshes(freewayMat, 'freeway', ORDER.road + 3));
    add(medians.meshes(medianMat, 'medians', ORDER.road + 4));
    add(medianPaving.meshes(walkMat, 'median-paving', ORDER.road + 4));
    add(concreteMedians.meshes(surfaceMaterial('medianConcrete', { texture: 'sidewalk', grain: 0.12, weathering: 0.02 }), 'concrete-medians', ORDER.road + 4));
    add(medianPlanting.meshes(medianMat, 'median-planting', ORDER.road + 4.1));
    add(curbFaces.meshes(faceMat, 'curb-faces', ORDER.road + 5));
    add(curb.meshes(curbMat, 'curb', ORDER.road + 6));
    add(paintDim.meshes(flatMaterial('paintDim'), 'paint-dim', ORDER.paint));
    add(paint.meshes(flatMaterial('paint'), 'paint', ORDER.paint + 1));
    add(paintYellow.meshes(flatMaterial('paintYellow'), 'paint-yellow', ORDER.paint + 1));
    const deckMat = surfaceMaterial('road', {
        grain: 0.16,
        weathering: 0.08,
        corridor: STRIP_PAVEMENT,
        deckTint: 'bridgeRoad',
        depthWrite: true,
        polygonOffset: -1
    });
    const freewayDeckMat = surfaceMaterial('freeway', {
        grain: 0.13, weathering: 0.08, deckTint: 'bridgeRoad', depthWrite: true, polygonOffset: -1
    });
    const bridgeDecks = [...deckTop.meshes(deckMat, 'deck', ORDER.solid),
        ...freewayDeckTop.meshes(freewayDeckMat, 'freeway-deck', ORDER.solid)];
    add(bridgeDecks);
    add(deckMedianPaving.meshes(walkMat, 'deck-median-paving', ORDER.solid + 0.1));
    add(deckWalk.meshes(walkMat, 'deck-sidewalk', ORDER.solid + 0.2));
    add(deckCurbFaces.meshes(faceMat, 'deck-curb-faces', ORDER.solid + 0.3));
    add(deckCurb.meshes(curbMat, 'deck-curb', ORDER.solid + 0.4));
    const deckPaintMat = surfaceMaterial('paint', {
        depthWrite: true,
        polygonOffset: -3
    });
    add(deckPaint.meshes(deckPaintMat, 'deck-paint', ORDER.solid + 1));
    const deckPaintYellowMat = surfaceMaterial('paintYellow', {
        depthWrite: true,
        polygonOffset: -3
    });
    add(deckPaintYellow.meshes(deckPaintYellowMat, 'deck-paint-yellow', ORDER.solid + 1));
    const side = new THREE.Mesh(deckSide.geometry(), litMaterial('bridgeSide'));
    side.name = 'deck-sides';
    const coping = new THREE.Mesh(deckCoping.geometry(), litMaterial('freewayEdge'));
    coping.name = 'deck-parapets';
    const pil = new THREE.Mesh(pillars.geometry(), litMaterial('pillar'));
    pil.name = 'pillars';
    group.add(side, coping, pil);
    return {
        group,
        bridgeDecks,
        setback,
        majorEdges: g.edges.filter((e)=>e.cls === 'arterial')
    };
}
function ribbonY(s, left, right, yAdd) {
    let pa = -1, pb = -1;
    for(let i = 0; i < left.pts.length; i++){
        const a = left.pts[i], b = right.pts[i];
        const ya = yAdd === null ? 0 : left.y[i] + yAdd, yb = yAdd === null ? 0 : right.y[i] + yAdd;
        const va = s.vert(a[0], ya, a[1]), vb = s.vert(b[0], yb, b[1]);
        if (pa >= 0) s.idx.push(pa, va, pb, pb, va, vb);
        pa = va;
        pb = vb;
    }
}
function ribbonSplit(ground, deck, left, right) {
    for (let i = 0; i < left.pts.length - 1; i++){
        const a0 = left.pts[i], b0 = right.pts[i], a1 = left.pts[i + 1], b1 = right.pts[i + 1];
        const ya0 = left.y[i], yb0 = right.y[i], ya1 = left.y[i + 1], yb1 = right.y[i + 1];
        // The deck and lane graph use the same grade between vertices.
        const target = Math.max(ya0, yb0, ya1, yb1) <= 0.03 ? ground : deck;
        const v0 = target.vert(a0[0], roadHeight(ya0), a0[1]), v1 = target.vert(b0[0], roadHeight(yb0), b0[1]);
        const v2 = target.vert(a1[0], roadHeight(ya1), a1[1]), v3 = target.vert(b1[0], roadHeight(yb1), b1[1]);
        target.idx.push(v0, v2, v1, v1, v2, v3);
    }
}
function deckUnderside(s, left, right) {
    const underside = (line, k)=>{
        const slab = Math.min(BRIDGE_SLAB_DEPTH, Math.max(0.32, line.y[k] * 0.48));
        return s.vert(line.pts[k][0], Math.max(0, line.y[k] - slab), line.pts[k][1], [0, -1, 0]);
    };
    for (let i = 0; i < left.pts.length - 1; i++){
        if (Math.max(left.y[i], left.y[i + 1], right.y[i], right.y[i + 1]) < 0.65) continue;
        s.quad(underside(left, i), underside(right, i), underside(right, i + 1), underside(left, i + 1));
    }
}
function deckWall(s, coping, line, sign, e, onElevDeck, blocksSupport) {
    const n = normals(line.pts);
    const parapetHeight = y=>y + Math.min(0.85, Math.max(0, (y - 0.12) * 0.42));
    const isValetRamp = e.cls === 'service' || e.cls === 'local';
    for (let i = 0; i < line.pts.length - 1; i++) {
        const a = line.pts[i], b = line.pts[i + 1], ya = line.y[i], yb = line.y[i + 1];
        if (Math.max(ya, yb) <= 0.12) continue;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 1e-4) continue;
        const nx = (a[1] - b[1]) * sign / length, nz = (b[0] - a[0]) * sign / length;
        const nn = [nx, 0, nz];
        const count = Math.max(1, Math.ceil(length / 4));
        const at = (t)=>({
            x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, y: ya + (yb - ya) * t,
            nx: (n[i][0] + (n[i + 1][0] - n[i][0]) * t) * sign,
            nz: (n[i][1] + (n[i + 1][1] - n[i][1]) * t) * sign
        });
        const top = (p, y, inset)=>coping.vert(p.x - p.nx * inset, y + 0.005, p.z - p.nz * inset, [0, 1, 0]);
        for (let j = 0; j < count; j++) {
            const p = at(j / count), q = at((j + 1) / count), m = at((j + 0.5) / count);
            if ([0.75, 1.35, 2.0].some(d=>onElevDeck(m.x + nx * d, m.z + nz * d, m.y, 0.9, undefined, e.id))) continue;
            const bottom = (v)=>{
                const slab = Math.min(BRIDGE_SLAB_DEPTH, Math.max(0.32, v.y * 0.48));
                const overRoad = blocksSupport(v.x + nx * 0.8, v.z + nz * 0.8, 0, Math.max(0, v.y - 0.5), 2.2, e);
                const open = overRoad ? 1 : isValetRamp ? Math.max(0, Math.min(1, (v.y - 0.65) / 0.85)) : Math.max(0, Math.min(1, (v.y - 2.8) / 1.4));
                return Math.max(0, v.y - slab) * open;
            };
            const ta = parapetHeight(p.y), tb = parapetHeight(q.y);
            const v0 = s.vert(p.x, bottom(p), p.z, nn), v1 = s.vert(q.x, bottom(q), q.z, nn);
            const v2 = s.vert(q.x, tb, q.z, nn), v3 = s.vert(p.x, ta, p.z, nn);
            if (sign > 0) s.quad(v0, v1, v2, v3);
            else s.quad(v1, v0, v3, v2);
            coping.quad(top(p, ta, 0), top(q, tb, 0), top(q, tb, 0.18), top(p, ta, 0.18));
        }
    }
}
function pillarsAlong(s, e, left, right, blocksSupport) {
    const step = 32;
    for (let d = step * 0.45 + hash(e.id) * 6; d < e.ref.length; d += step){
        const p = sample(e.ref, d);
        if (p.y < 4.8) continue;
        const l = sample(left, offsetStation(e.ref, left, d)), r = sample(right, offsetStation(e.ref, right, d));
        const w = Math.hypot(r.x - l.x, r.z - l.z) || 1;
        const nx = (r.x - l.x) / w, nz = (r.z - l.z) / w;
        const cx = (l.x + r.x) / 2, cz = (l.z + r.z) / 2, top = p.y - BRIDGE_SLAB_DEPTH;
        const offset = [0, -w * 0.21, w * 0.21].find(t=>!blocksSupport(cx + nx * t, cz + nz * t, 0, top, 2.2, e));
        if (offset === undefined) continue;
        const x = cx + nx * offset, z = cz + nz * offset, yaw = Math.atan2(-nz, nx);
        box(s, x, z, 1.5, 1.5, 0, top, yaw);
        const beam = Math.min(w * 0.78, w - 2 * Math.abs(offset) - 0.4);
        const count = Math.max(2, Math.ceil(beam / 1.4)), bottom = top - 0.65;
        let beamClear = true;
        for (let k = 0; k <= count; k++){
            const t = beam * (k / count - 0.5);
            if (blocksSupport(x + nx * t, z + nz * t, Math.max(0, bottom - 4.5), top, 0.9, e)) {
                beamClear = false;
                break;
            }
        }
        if (beamClear && beam >= 1.5) box(s, x, z, beam, 1.7, bottom, top, yaw);
    }
}
export function box(s, cx, cz, w, d, y0, y1, yaw) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (u, v)=>[
            cx + u * c + v * sn,
            cz - u * sn + v * c
        ];
    const corners = [
        P(-w / 2, -d / 2),
        P(w / 2, -d / 2),
        P(w / 2, d / 2),
        P(-w / 2, d / 2)
    ];
    for(let i = 0; i < 4; i++){
        const a = corners[i], b = corners[(i + 1) % 4];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        const n = [
            dz / L,
            0,
            -dx / L
        ];
        const v0 = s.vert(a[0], y0, a[1], n), v1 = s.vert(b[0], y0, b[1], n), v2 = s.vert(b[0], y1, b[1], n), v3 = s.vert(a[0], y1, a[1], n);
        s.quad(v0, v3, v2, v1);
    }
    const t = corners.map((p)=>s.vert(p[0], y1, p[1], [
            0,
            1,
            0
        ]));
    s.quad(t[0], t[1], t[2], t[3]);
}
function quadAt(s, p, nx, nz, u0, u1, v0, v1, yOff) {
    const y = paintHeight(p.y, yOff);
    const P = (u, v)=>s.vert(p.x + nx * u + p.hx * v, y, p.z + nz * u + p.hz * v);
    const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1);
    s.quad(a, b, c, d);
}
function paintHeight(y, offset) {
    return offset === null ? 0 : roadHeight(y) + offset;
}
function arrow(s, p, movements, yOff, scale = 1) {
    const nx = -p.hz, nz = p.hx, y = paintHeight(p.y, yOff);
    for (const polygon of arrowMarking(movements, p.width)){
        const base = s.count;
        for (const [u, v] of polygon) s.vert(p.x + (nx * u + p.hx * v) * scale, y, p.z + (nz * u + p.hz * v) * scale);
        for(let i = 1; i < polygon.length - 1; i++) s.tri(base, base + i, base + i + 1);
    }
}
const ONLY_GLYPHS = [
    [[0, 0], [0.43, 0], [0.43, 1.6], [0, 1.6], [0, 0]],
    [[0, 0], [0, 1.6], [0.43, 0], [0.43, 1.6]],
    [[0, 1.6], [0, 0], [0.43, 0]],
    [[0, 1.6], [0.215, 0.77], [0.43, 1.6]],
    [[0.215, 0], [0.215, 0.77]]
];
function onlyText(s, p, yOff) {
    const nx = -p.hz, nz = p.hx, y = paintHeight(p.y, yOff);
    const sc = Math.min(0.84, Math.max(0.45, ((p.width ?? 3.2) - 0.65) / 2.15));
    const sw = 0.068 * Math.max(0.75, sc);
    for (let i = 0; i < ONLY_GLYPHS.length; i++){
        const x = (-1.07 + Math.min(i, 3) * 0.57) * sc;
        const points = ONLY_GLYPHS[i].map(([u, v])=>[
            p.x + nx * (x + u * sc) + p.hx * (v - 0.8) * sc,
            p.z + nz * (x + u * sc) + p.hz * (v - 0.8) * sc
        ]);
        s.ribbon(points, -sw, sw, y);
    }
}
function addCurb(top, sides, points, heights, from, to) {
    const lo = Math.min(from, to), hi = Math.max(from, to);
    top.ribbon(points, lo, hi, heights.map((y)=>y + CURB_HEIGHT));
    const edge = from === 0 ? points : offsetLine(points, from);
    let previous = -1;
    for (let i = 0; i < edge.length; i++){
        const [x, z] = edge[i], height = heights[i];
        const vertex = sides.vert(x, height, z);
        sides.vert(x, height + CURB_HEIGHT, z);
        if (previous >= 0) sides.quad(previous, vertex, vertex + 1, previous + 1);
        previous = vertex;
    }
}
function departures(line, raw, half) {
    const out = [];
    let run = [];
    const P = line.pts;
    const off = (p)=>{
        let best = Infinity;
        for(let i = 0; i + 1 < raw.pts.length; i++){
            const a = raw.pts[i], b = raw.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
            best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t));
        }
        return best;
    };
    for(let i = 0; i < P.length; i += 3){
        if (off(P[i]) > half * 0.5) run.push(P[i]);
        else {
            if (run.length >= 2) out.push(run);
            run = [];
        }
    }
    if (run.length >= 2) out.push(run);
    return out;
}
