// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { Chunked, Soup, convexHull, dashes, hash, lineLength, normals, slice } from './geom.js';
import { boundaryAt, boundaryLine, cornerFillets, edgeLine, offset, roadMask, sample } from './lanegraph.js';
import { planIntersections } from './intersections.js';
import { flatMaterial, litMaterial, ORDER, surfaceMaterial } from './materials.js';
const ELEV = 0.4;
export function buildRoads(data, g, valetZones = []) {
    const group = new THREE.Group();
    group.name = 'roads';
    const C = 1400;
    const sidewalk = new Chunked(C), curb = new Chunked(C), medians = new Chunked(C);
    const oppGrid = new Map();
    for (const e of g.edges){
        if (!e.oneway || e.cls !== 'arterial' && e.cls !== 'collector') continue;
        for (const p of e.ref.pts){
            const k = `${Math.floor(p[0] / 50)},${Math.floor(p[1] / 50)}`;
            const l = oppGrid.get(k);
            if (!l) oppGrid.set(k, [
                e
            ]);
            else if (l[l.length - 1] !== e) l.push(e);
        }
    }
    const medianGap = (e)=>{
        const mid = sample(e.ref, e.ref.length / 2), nx = -mid.hz, nz = mid.hx;
        let best = Infinity;
        const cx = Math.floor(mid.x / 50), cz = Math.floor(mid.z / 50);
        for(let i = -1; i <= 1; i++)for(let j = -1; j <= 1; j++)for (const o of oppGrid.get(`${cx + i},${cz + j}`) ?? []){
            if (o === e) continue;
            for (const p of o.ref.pts){
                const dx = p[0] - mid.x, dz = p[1] - mid.z, side = dx * nx + dz * nz, along = dx * mid.hx + dz * mid.hz;
                if (side >= 0 || Math.abs(along) > 60) continue;
                const k = o.ref.pts.indexOf(p), q = o.ref.pts[Math.min(k + 1, o.ref.pts.length - 1)], r = o.ref.pts[Math.max(k - 1, 0)];
                const hd = (q[0] - r[0]) * mid.hx + (q[1] - r[1]) * mid.hz;
                if (hd >= 0) continue;
                best = Math.min(best, -side);
            }
        }
        return best;
    };
    const asphalt = new Chunked(C), major = new Chunked(C), freeway = new Chunked(C), service = new Chunked(C), aisle = new Chunked(C);
    const paint = new Chunked(C), paintDim = new Chunked(C), paintYellow = new Chunked(C);
    const deckTop = new Chunked(C), deckPaint = new Chunked(C), deckPaintYellow = new Chunked(C);
    const deckSide = new Soup();
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
    const isAir = (l)=>l.y.some((v)=>v > ELEV);
    const plan = planIntersections(data, g);
    const { legs, mouthStart, mouthEnd, usedCrossings, setback, endSetback, intersectionAt } = plan;
    const onGroundRoad = roadMask(g);
    const buildCarriagewayTest = (pred)=>{
        const cell = 25, grid = new Map();
        for (const m of g.edges){
            if (!pred(m)) continue;
            const [ml0, ml1] = extents(m), mW = m.lanes.length * m.laneWidth;
            const lAdd = ml0, rAdd = ml1 - mW;
            for(let i = 0; i < m.ref.pts.length - 1; i++){
                const a = m.ref.pts[i], b = m.ref.pts[i + 1];
                const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (cell * 0.5)));
                for(let k = 0; k <= n; k++){
                    const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
                    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
                    let list = grid.get(key);
                    if (!list) grid.set(key, list = []);
                    if (!list.length || list[list.length - 1][0] !== m || list[list.length - 1][1] !== i) list.push([
                        m,
                        i,
                        lAdd,
                        rAdd
                    ]);
                }
            }
        }
        return (x, z, y, margin, excludeWayId, excludeEdgeId)=>{
            const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
            for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [m, seg, lAdd, rAdd] of grid.get(`${cx + a},${cz + b}`) ?? []){
                if (m.id === excludeEdgeId) continue;
                if (excludeWayId !== undefined && (m.way.id === excludeWayId || m.twin !== undefined && g.edges[m.twin].way.id === excludeWayId)) continue;
                const u = m.ref.pts[seg], v = m.ref.pts[seg + 1];
                const dx = v[0] - u[0], dz = v[1] - u[1], L = Math.hypot(dx, dz);
                if (L < 1e-4) continue;
                const hx = dx / L, hz = dz / L, nx = -hz, nz = hx;
                const along = (x - u[0]) * hx + (z - u[1]) * hz;
                if (along < -1.2 || along > L + 1.2) continue;
                const t = Math.max(0, Math.min(1, along / L));
                const my = m.ref.y[seg] + (m.ref.y[seg + 1] - m.ref.y[seg]) * t;
                if (Math.abs(y - my) > 2.5) continue;
                const lat = (x - u[0]) * nx + (z - u[1]) * nz;
                const s = m.ref.cum[seg] + t * L;
                const leftB = boundaryAt(m, 0, s) + lAdd - margin;
                const rightB = boundaryAt(m, m.lanes.length, s) + rAdd + margin;
                if (lat >= leftB && lat <= rightB) return true;
            }
            return false;
        };
    };
    const onMainCarriageway = buildCarriagewayTest((m)=>!m.internal && m.cls !== 'service' && m.cls !== 'ramp' && !/_link$/.test(m.way.hw));
    const onLinkOrSvcCarriageway = buildCarriagewayTest((m)=>!m.internal && (/_link$/.test(m.way.hw) || m.cls === 'ramp' || m.cls === 'service' && m.way.svc !== 'parking_aisle'));
    const onAnyNonServiceRoad = buildCarriagewayTest((m)=>m.cls !== 'service');
    const onElevatedDeck = buildCarriagewayTest((m)=>!m.internal && isAir(m.ref));
    const onConnector = (()=>{
        const cell = 25, grid = new Map();
        for (const k of g.lanes){
            if (!k.connector || k.line.pts.length < 2 || k.line.y.some((v)=>v > 2.0)) continue;
            const hw = (k.width ?? 3.5) * 0.5;
            for(let i = 0; i < k.line.pts.length - 1; i++){
                const a = k.line.pts[i], b = k.line.pts[i + 1];
                const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (cell * 0.5)));
                for(let j = 0; j <= n; j++){
                    const x = a[0] + (b[0] - a[0]) * j / n, z = a[1] + (b[1] - a[1]) * j / n;
                    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
                    let list = grid.get(key);
                    if (!list) grid.set(key, list = []);
                    if (!list.length || list[list.length - 1][0] !== k || list[list.length - 1][1] !== i) list.push([
                        k,
                        i,
                        hw
                    ]);
                }
            }
        }
        return (x, z, margin = 0.2)=>{
            const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
            for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [k, seg, hw] of grid.get(`${cx + a},${cz + b}`) ?? []){
                const u = k.line.pts[seg], v = k.line.pts[seg + 1];
                const dx = v[0] - u[0], dz = v[1] - u[1], L2 = dx * dx + dz * dz || 1;
                const t = Math.max(0, Math.min(1, ((x - u[0]) * dx + (z - u[1]) * dz) / L2));
                if (Math.hypot(x - (u[0] + dx * t), z - (u[1] + dz * t)) <= hw + margin) return true;
            }
            return false;
        };
    })();
    const medGrid = new Map();
    for (const m of g.edges){
        if (m.internal || m.cls === 'service' || isAir(m.ref)) continue;
        for(let i = 0; i < m.ref.pts.length - 1; i++){
            const a = m.ref.pts[i], b = m.ref.pts[i + 1];
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 20));
            for(let k = 0; k <= n; k++){
                const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
                const key = `${Math.floor(x / 40)},${Math.floor(z / 40)}`;
                let list = medGrid.get(key);
                if (!list) medGrid.set(key, list = []);
                if (!list.length || list[list.length - 1][0] !== m || list[list.length - 1][1] !== i) list.push([
                    m,
                    i
                ]);
            }
        }
    }
    const medianWidthAt = (e, x, z, hx, hz, y)=>{
        const lx = hz, lz = -hx;
        if (onAnyNonServiceRoad(x + lx * 0.35, z + lz * 0.35, y, 0.15, e.way.id, e.id)) return 0;
        if (onConnector(x + lx * 0.6, z + lz * 0.6, 0.15)) return 0;
        let bestT = 34, bestM = null, bestHd = 0;
        const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
        for(let a = -1; a <= 1; a++)for(let b = -1; b <= 1; b++)for (const [m, seg] of medGrid.get(`${cx + a},${cz + b}`) ?? []){
            if (m.id === e.id || m.way.id === e.way.id || m.twin === e.id) continue;
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
            const b0 = boundaryAt(m, 0, s) - 0.15, b1 = boundaryAt(m, m.lanes.length, s) + 0.15;
            const t0 = tRef + b0 / den, t1 = tRef + b1 / den;
            const tNear = Math.min(t0, t1), tFar = Math.max(t0, t1);
            if (tNear <= 0.15 && tFar >= -0.15) return 0;
            if (tNear > 0.15 && tNear < bestT) {
                bestT = tNear;
                bestM = m;
                bestHd = hx * mhx + hz * mhz;
            }
        }
        if (!bestM || bestT < 0.55 || bestT >= 33.5) return 0;
        const mIsLink = /_link$/.test(bestM.way.hw);
        let w = 0;
        if (mIsLink) {
            w = bestT - 0.08;
        } else if (bestHd < -0.35 && bestM.oneway && (bestM.cls === 'arterial' || bestM.cls === 'collector')) {
            w = bestT * 0.5 + 0.15;
        } else {
            return 0;
        }
        for(let step = 1.2; step < w - 0.2; step += 1.8){
            const px = x + lx * step, pz = z + lz * step;
            if (onAnyNonServiceRoad(px, pz, y, 0.15, e.way.id, e.id) || onConnector(px, pz, 0.15)) return 0;
        }
        return w;
    };
    const laneSample = (ed, laneIdx, d)=>{
        const s = Math.max(0, Math.min(ed.ref.length, d));
        const p = sample(ed.ref, s);
        const u = 0.5 * (boundaryAt(ed, laneIdx, s) + boundaryAt(ed, laneIdx + 1, s));
        const nx = -p.hz, nz = p.hx;
        return {
            x: p.x + nx * u,
            z: p.z + nz * u,
            y: p.y,
            hx: p.hx,
            hz: p.hz
        };
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
    for (const e of g.edges){
        const [l0, l1] = extents(e);
        const air = isAir(e.ref);
        const W = e.lanes.length * e.laneWidth;
        const isLink = /_link$/.test(e.way.hw);
        const isLinkOrRamp = isLink || e.cls === 'ramp';
        if (air) {
            const sp = e.ref.pts;
            const bridgeSw = !e.internal && (e.cls === 'arterial' || e.cls === 'collector' || e.cls === 'local') && !isLink ? 2.2 : 0;
            const medGap = !e.internal && e.oneway && (e.cls === 'arterial' || e.cls === 'collector') && !isLink ? medianGap(e) : Infinity;
            const medHalf = medGap > 0.4 && medGap < 30 ? medGap * 0.5 + 0.35 : 0;
            const elevTaper = (at)=>{
                const y = sample(e.ref, at).y;
                return Math.min(1, Math.max(0, (y - 0.08) / 2.2));
            };
            const leftDeck = edgeLine(e, (at)=>boundaryAt(e, 0, at) + l0 - medHalf * elevTaper(at));
            const rightDeck = edgeLine(e, (at)=>boundaryAt(e, e.lanes.length, at) + l1 - W + bridgeSw * elevTaper(at));
            const s = deckTop.at(sp[0][0], sp[0][1]);
            const sg = surfaceFor(e).at(sp[0][0], sp[0][1]);
            ribbonSplit(sg, s, leftDeck, rightDeck);
            if (e.oneway || e.twin === undefined || e.id < e.twin) {
                deckSides(deckSide, leftDeck, rightDeck, e, onGroundRoad, onElevatedDeck, medHalf > 0, onAnyNonServiceRoad, onConnector);
            }
            pillarsAlong(pillars, e, leftDeck, rightDeck, onGroundRoad, onAnyNonServiceRoad, onConnector);
        } else {
            const s = surfaceFor(e).at(e.ref.pts[0][0], e.ref.pts[0][1]);
            ribbonY(s, edgeLine(e, (at)=>boundaryAt(e, 0, at) + l0), edgeLine(e, (at)=>boundaryAt(e, e.lanes.length, at) + l1 - W), null);
            if (!e.internal && (e.cls === 'arterial' || e.cls === 'collector' || e.cls === 'local')) {
                const sw = e.cls === 'arterial' ? 4.2 : e.cls === 'collector' ? 3.2 : 2.4;
                const cut0 = isLink && !setback.has(e.fromNode) ? 0 : Math.min(mouthStart.get(e.id)?.inner ?? endSetback(e, e.fromNode) * 0.9, e.ref.length / 2);
                const cut1 = isLink && !setback.has(e.toNode) ? 0 : Math.min(mouthEnd.get(e.id)?.inner ?? endSetback(e, e.toNode) * 0.9, e.ref.length / 2);
                const outer = boundaryLine(e, e.lanes.length);
                const oSpans = clearSpans(cut0, outer.length - cut1, 1.2, (d)=>{
                    const q = sample(outer, d), nx = -q.hz, nz = q.hx;
                    if (onAnyNonServiceRoad(q.x + nx * 0.35, q.z + nz * 0.35, q.y, 0.2, e.way.id, e.id)) return false;
                    if (!isLink && (onAnyNonServiceRoad(q.x + nx * (sw * 0.6), q.z + nz * (sw * 0.6), q.y, 0.2, e.way.id, e.id) || onLinkOrSvcCarriageway(q.x + nx * 1.2, q.z + nz * 1.2, q.y, 0.2, e.way.id, e.id))) return false;
                    return !onConnector(q.x + nx * 0.5, q.z + nz * 0.5, 0.15);
                });
                for (const [s0, s1] of oSpans){
                    const piece = slice(outer.pts, s0, s1);
                    if (piece.pts.length >= 2) {
                        if (!isLink) sidewalk.at(piece.pts[0][0], piece.pts[0][1]).ribbon(piece.pts, 0, sw, 0);
                        curb.at(piece.pts[0][0], piece.pts[0][1]).ribbon(piece.pts, 0.08, 0.38, 0);
                    }
                }
                if (e.oneway && isLink) {
                    const left = boundaryLine(e, 0);
                    const lSpans = clearSpans(cut0, left.length - cut1, 1.2, (d)=>{
                        const q = sample(left, d), nx = -q.hz, nz = q.hx;
                        return !onAnyNonServiceRoad(q.x - nx * 0.35, q.z - nz * 0.35, q.y, 0.2, e.way.id, e.id) && !onConnector(q.x - nx * 0.4, q.z - nz * 0.4, 0.15);
                    });
                    for (const [s0, s1] of lSpans){
                        const lPiece = slice(left.pts, s0, s1);
                        if (lPiece.pts.length >= 2) {
                            curb.at(lPiece.pts[0][0], lPiece.pts[0][1]).ribbon(lPiece.pts, -0.38, -0.08, 0);
                        }
                    }
                }
            }
        }
        if (!air && !e.internal) for (const id of e.lanes){
            const lane = g.lanes[id];
            if (!lane.raw) continue;
            for (const run of departures(lane.line, lane.raw, lane.width / 2))surfaceFor(e).at(run[0][0], run[0][1]).ribbon(run, -lane.width / 2 - 0.3, lane.width / 2 + 0.3, 0);
        }
        if (!air && !e.internal && e.oneway && (e.cls === 'arterial' || e.cls === 'collector') && !isLink && e.ref.length > 12) {
            const cut0 = Math.min(mouthStart.get(e.id)?.clear ?? mouthStart.get(e.id)?.inner ?? endSetback(e, e.fromNode), e.ref.length / 2);
            const cut1 = Math.min(mouthEnd.get(e.id)?.stop ?? mouthEnd.get(e.id)?.inner ?? endSetback(e, e.toNode), e.ref.length / 2);
            const left = boundaryLine(e, 0);
            const mSpans = clearSpans(cut0, left.length - cut1, 1.5, (d)=>{
                const q = sample(left, d);
                return medianWidthAt(e, q.x, q.z, q.hx, q.hz, q.y) >= 0.55;
            });
            for (const [s0, s1] of mSpans){
                const len = s1 - s0, steps = Math.max(2, Math.ceil(len / 2.0));
                const pts = [], widths = [];
                for(let k = 0; k <= steps; k++){
                    const d = s0 + len * k / steps;
                    const q = sample(left, d);
                    const w = medianWidthAt(e, q.x, q.z, q.hx, q.hz, q.y);
                    pts.push([
                        q.x,
                        q.z
                    ]);
                    widths.push(Math.max(0.45, w));
                }
                if (pts.length >= 2) {
                    const first = pts[0], nN = normals(pts);
                    const m = medians.at(first[0], first[1]);
                    const cTarget = curb.at(first[0], first[1]);
                    let pa = -1, pb = -1;
                    const leftWall = [];
                    for(let i = 0; i < pts.length; i++){
                        const p = pts[i], n = nN[i], w = widths[i];
                        const lx = p[0] - n[0] * w, lz = p[1] - n[1] * w;
                        leftWall.push([
                            lx,
                            lz
                        ]);
                        const va = m.vert(lx, 0, lz);
                        const vb = m.vert(p[0] + n[0] * 0.08, 0, p[1] + n[1] * 0.08);
                        if (pa >= 0) m.idx.push(pa, va, pb, pb, va, vb);
                        pa = va;
                        pb = vb;
                    }
                    cTarget.ribbon(pts, -0.38, -0.08, 0);
                    if (leftWall.length >= 2) {
                        const qMid = sample(left, (s0 + s1) * 0.5), mwMid = widths[widths.length >> 1];
                        const ox = qMid.x + qMid.hz * mwMid, oz = qMid.z - qMid.hx * mwMid;
                        if (onLinkOrSvcCarriageway(ox, oz, qMid.y, 1.8, e.way.id, e.id)) {
                            cTarget.ribbon(leftWall, 0.02, 0.32, 0);
                        }
                    }
                    const addNoseCap = (endPt, nVec, wEnd, dirSign)=>{
                        if (wEnd < 0.9 || wEnd > 14) return;
                        const halfW = (wEnd + 0.08) * 0.5;
                        const rAlong = Math.min(2.4, halfW * 0.95);
                        const cx = endPt[0] - nVec[0] * (wEnd * 0.5 - 0.04);
                        const cz = endPt[1] - nVec[1] * (wEnd * 0.5 - 0.04);
                        const tx = -nVec[1] * dirSign, tz = nVec[0] * dirSign;
                        const tipX = cx + tx * rAlong, tipZ = cz + tz * rAlong;
                        if (onAnyNonServiceRoad(tipX, tipZ, 0, 0.25, e.way.id, e.id) || onConnector(tipX, tipZ, 0.25)) return;
                        const stepsCap = 8, arcPts = [];
                        const vc = m.vert(cx, 0, cz);
                        let prevV = -1;
                        for(let j = 0; j <= stepsCap; j++){
                            const a = -Math.PI * 0.5 + Math.PI * (j / stepsCap);
                            const ca = Math.cos(a), sa = Math.sin(a) * dirSign;
                            const px = cx + tx * ca * rAlong + nVec[0] * sa * halfW;
                            const pz = cz + tz * ca * rAlong + nVec[1] * sa * halfW;
                            arcPts.push([
                                px,
                                pz
                            ]);
                            const v = m.vert(px, 0, pz);
                            if (prevV >= 0) m.idx.push(vc, prevV, v);
                            prevV = v;
                        }
                        cTarget.ribbon(arcPts, -0.28, 0.04, 0);
                    };
                    addNoseCap(pts[0], nN[0], widths[0], -1);
                    addNoseCap(pts[pts.length - 1], nN[pts.length - 1], widths[widths.length - 1], 1);
                }
            }
        }
        const internal = !!e.internal || e.ref.length < 48 && setback.has(e.fromNode) && setback.has(e.toNode);
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
                        const line = boundaryLine(e, i);
                        for (const [d0, d1] of dashes(span, 2.4, 6.6, c0)){
                            const piece = slice(line.pts, c0 + d0, c0 + d1, line.y);
                            if (piece.pts.length >= 2) paintDim.at(piece.pts[0][0], piece.pts[0][1]).ribbon(piece.pts, -0.06, 0.06, 0);
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
        const PD = air ? deckPaint : paintDim;
        const PY = air ? deckPaintYellow : paintYellow;
        const yOff = air ? 0.06 : null;
        const at = (s, x, z)=>s instanceof Chunked ? s.at(x, z) : s;
        const strip = (line, from, to, half, target)=>{
            const piece = slice(line.pts, from, to, line.y);
            if (piece.pts.length < 2) return;
            at(target, piece.pts[0][0], piece.pts[0][1]).ribbon(piece.pts, -half, half, yOff === null ? 0 : piece.y.map((v)=>v + yOff));
        };
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
            const line = boundaryLine(e, i);
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
                const phase = (dashStart.get(e.id) ?? 0) + from;
                for (const [d0, d1] of dashes(to - from - tail, 3, 9, phase)){
                    if (keepDiv && !keepDiv(from + (d0 + d1) * 0.5)) continue;
                    strip(line, from + d0, from + d1, 0.075, P);
                }
            }
            if (tail > 1) stripFiltered(line, a1 - tail, a1, 0.075, P, keepDiv);
        }
        if (e.oneway) {
            if (e.cls !== 'local') {
                const leftEdge = edgeLine(e, (at)=>boundaryAt(e, 0, at) + 0.3);
                const leftTarget = e.cls === 'motorway' || e.cls === 'ramp' ? PY : PD;
                stripFiltered(leftEdge, a0, a1, 0.075, leftTarget, isLinkOrRamp ? (d)=>{
                    const q = sample(leftEdge, d);
                    return !onMainCarriageway(q.x, q.z, q.y, 0.2, e.way.id);
                } : undefined);
            }
        } else {
            const hasCenterTurn = !e.way.ow && (e.way.lanes ?? 0) % 2 === 1 && (e.way.lanes ?? 0) >= 3 && !e.way.lf;
            if (hasCenterTurn) {
                const outerY = edgeLine(e, (at)=>boundaryAt(e, 0, at) + 0.12);
                const innerY = edgeLine(e, (at)=>boundaryAt(e, 0, at) - 0.12);
                strip(outerY, a0, a1, 0.065, PY);
                for (const [d0, d1] of dashes(a1 - a0, 2.6, 5.4, a0)){
                    strip(innerY, a0 + d0, a0 + d1, 0.06, PY);
                }
            } else if (e.twin === undefined || e.id < e.twin) {
                strip(edgeLine(e, (at)=>boundaryAt(e, 0, at) - 0.13), a0, a1, 0.068, PY);
                strip(edgeLine(e, (at)=>boundaryAt(e, 0, at) + 0.13), a0, a1, 0.068, PY);
            }
        }
        if (e.cls === 'motorway' || e.cls === 'ramp' || e.cls === 'arterial' || isLink) {
            const rightEdge = edgeLine(e, (at)=>boundaryAt(e, e.lanes.length, at) - 0.3);
            stripFiltered(rightEdge, a0, a1, 0.08, P, isLinkOrRamp ? (d)=>{
                const q = sample(rightEdge, d);
                return !onMainCarriageway(q.x, q.z, q.y, 0.2, e.way.id);
            } : (d)=>{
                const q = sample(rightEdge, d), nx = -q.hz, nz = q.hx;
                return !onLinkOrSvcCarriageway(q.x + nx * 0.75, q.z + nz * 0.75, q.y, 0.15, e.way.id);
            });
        }
        if (e.oneway && isLink) {
            const cSpans = clearSpans(a0, a1, 1.0, (d)=>crossSectionClear(d, 0.35));
            for (const [c0, c1] of cSpans){
                const span = c1 - c0;
                if (span < 9) continue;
                const pts = span < 34 ? [
                    (c0 + c1) * 0.5
                ] : [
                    c0 + span * 0.3,
                    c0 + span * 0.72
                ];
                for (const d of pts){
                    e.lanes.forEach((_, i)=>{
                        const q = laneSample(e, i, d);
                        const mv = e.turns[i]?.length ? e.turns[i] : [
                            'through'
                        ];
                        arrow(at(P, q.x, q.z), q, mv, yOff);
                    });
                }
            }
        }
        const ix = intersectionAt(e.toNode);
        const controlled = setback.has(e.toNode) && !!ix && (ix.control === 'signal' || (e.cls === 'local' || e.cls === 'collector') && ix.legs.length >= 3);
        const chainSpan = a1 - a0 + prevLen;
        if (controlled && e.cls !== 'motorway' && e.cls !== 'ramp' && chainSpan > 14 && a1 - a0 > 0.8) {
            const sL = a1 + 0.25;
            const p = sample(e.ref, Math.min(sL, e.ref.length));
            const mouth = mouthEnd.get(e.id);
            if (mouth) {
                p.hx = -mouth.leg.a[0];
                p.hz = -mouth.leg.a[1];
            }
            const nx = -p.hz, nz = p.hx;
            const s = at(P, p.x, p.z);
            quadAt(s, p, nx, nz, 0, W, -0.3, 0.3, yOff);
            const chainLaneSample = (laneIdx, d)=>{
                if (d >= a0) return laneSample(e, laneIdx, d);
                if (hasPrev) {
                    const pe = g.edges[e.prev], pd = pe.ref.length + (d - a0);
                    if (pd >= 3.5) return laneSample(pe, laneIdx, pd);
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
                    if (c.movement === 'left' || c.movement === 'right' || c.movement === 'through') connMoves.add(c.movement);
                }
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
            const anyTurn = e.explicitTurns || laneMoves.some((mv)=>mv.includes('left') || mv.includes('right'));
            if (anyTurn && (e.lanes.length >= 2 || e.explicitTurns)) {
                e.lanes.forEach((_, i)=>{
                    const mv = laneMoves[i];
                    if (!mv || !mv.length) return;
                    const q = chainLaneSample(i, a1 - 7.5);
                    if (!q) return;
                    arrow(at(P, q.x, q.z), q, mv, yOff);
                    if (mv.length === 1 && (mv[0] === 'left' || mv[0] === 'right')) {
                        const q2 = chainLaneSample(i, a1 - 16.5);
                        if (q2) onlyText(at(P, q2.x, q2.z), q2, yOff);
                        if (!e.taperEnd || 25.0 <= e.taperEnd - 4) {
                            const q3 = chainLaneSample(i, a1 - 25.0);
                            if (q3) arrow(at(P, q3.x, q3.z), q3, mv, yOff);
                        }
                    }
                });
            }
        }
        if (e.oneway && (e.cls === 'arterial' || e.cls === 'collector') && !isLink) {
            const endLim = controlled ? a1 - 28 : a1 - 8;
            const thruIndices = e.lanes.map((_, i)=>i).filter((i)=>(e.turns[i] ?? [
                    'through'
                ]).includes('through'));
            const pick = thruIndices.length ? thruIndices[Math.floor(thruIndices.length / 2)] : Math.floor(e.lanes.length / 2);
            if (e.lanes[pick] !== undefined && endLim - a0 >= 22) {
                for(let d = a0 + 22; d <= endLim; d += 62){
                    const q = laneSample(e, pick, d);
                    if (onLinkOrSvcCarriageway(q.x, q.z, q.y, 2.5, e.way.id)) continue;
                    arrow(at(PD, q.x, q.z), q, [
                        'through'
                    ], yOff);
                }
            }
        }
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
        if (pa.y > ELEV || pb.y > ELEV) {
            if (hull.length >= 3) deckTop.at(pa.x, pa.z).polygon(hull, Math.max(0.06, 0.5 * (pa.y + pb.y)));
            continue;
        }
        if (hull.length >= 3) surfaceFor(A.cls === 'motorway' ? A : B).at(pa.x, pa.z).polygon(hull, 0);
        if ((A.cls === 'arterial' || A.cls === 'collector' || A.cls === 'local') && !((/_link$/.test(A.way.hw) || /_link$/.test(B.way.hw)) && onMainCarriageway(pa.x, pa.z, pa.y, 2.0, A.way.id))) {
            const sw = A.cls === 'arterial' ? 4.5 : A.cls === 'collector' ? 3.4 : 2.6;
            const walk = convexHull([
                ...corners(pa, ra, ra + sw),
                ...corners(pb, rb, rb + sw)
            ]);
            if (walk.length >= 3) sidewalk.at(pa.x, pa.z).polygon(walk, 0);
        }
    }
    for (const [id, r] of setback){
        const node = g.nodes.get(id);
        const pts = [];
        let air = false;
        let surf = asphalt;
        for (const ei of [
            ...node.inEdges,
            ...node.outEdges
        ]){
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
            pts.push([
                q.x + nx * l0,
                q.z + nz * l0
            ], [
                q.x + nx * l1,
                q.z + nz * l1
            ]);
            if (p.y > ELEV) air = true;
            if (e.cls === 'arterial') surf = major;
        }
        const hull = convexHull(pts);
        if (hull.length < 3) continue;
        const span = Math.max(...hull.map((p)=>Math.hypot(p[0] - node.x, p[1] - node.z)));
        if (span > r * 3 + 25) continue;
        if (air) deckTop.at(node.x, node.z).polygon(hull, node.y + 0.01);
        else surf.at(node.x, node.z).polygon(hull, 0);
    }
    for (const hull of cornerFillets(g))service.at(hull[0][0], hull[0][1]).polygon(hull, 0);
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
                const [l0, l1] = extents(e), q = sample(e.ref, atStart ? m.inner : e.ref.length - m.inner), nx = -q.hz, nz = q.hx;
                for (const v of [
                    l0,
                    l1
                ])pts.push([
                    q.x + nx * v,
                    q.z + nz * v
                ]);
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
                const p0 = [
                    X[0] + A.dir[0] * R,
                    X[1] + A.dir[1] * R
                ], p2 = [
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
                const walk = big ? 4.5 : 3.2, span = (n0, n1)=>away > 0 ? [
                        n0,
                        n1
                    ] : [
                        -n1,
                        -n0
                    ];
                sidewalk.at(mid[0], mid[1]).ribbon(curve, ...span(0, walk), 0);
                curb.at(mid[0], mid[1]).ribbon(curve, ...span(0, 0.4), 0);
            }
        }
    }
    for (const leg of legs){
        const [ax, az] = leg.a, [px, pz] = leg.perp, [cx, cz] = leg.ctr;
        for (const { e, atStart } of leg.entries){
            const m = (atStart ? mouthStart : mouthEnd).get(e.id);
            if (!m?.band) continue;
            const [l0, l1] = extents(e);
            const q = sample(e.ref, atStart ? m.band[0] : e.ref.length - m.band[0]);
            const nx = -q.hz, nz = q.hx, dn = nx * px + nz * pz;
            if (Math.abs(dn) < 0.5) continue;
            const t0 = (q.x - cx) * px + (q.z - cz) * pz;
            const tA = t0 + dn * (l0 + 0.3), tB = t0 + dn * (l1 - 0.3);
            const lo = Math.ceil(Math.min(tA, tB) / 1.25), hi = Math.floor(Math.max(tA, tB) / 1.25);
            const legAir = q.y > ELEV;
            const s = (legAir ? deckPaint : paint).at(q.x, q.z);
            const yBar = legAir ? q.y + 0.06 : 0;
            for(let k = lo; k <= hi; k++){
                const v = (k * 1.25 - t0) / dn, bx = q.x + nx * v, bz = q.z + nz * v;
                const shift = leg.d + 2.2 - ((bx - cx) * ax + (bz - cz) * az), mx = bx + ax * shift, mz = bz + az * shift;
                const c = [
                    [
                        -0.3,
                        -1.6
                    ],
                    [
                        0.3,
                        -1.6
                    ],
                    [
                        0.3,
                        1.6
                    ],
                    [
                        -0.3,
                        1.6
                    ]
                ].map(([u, w])=>s.vert(mx + px * u + ax * w, yBar, mz + pz * u + az * w));
                s.quad(c[0], c[1], c[2], c[3]);
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
    const nodeWay = new Map();
    for (const pass of [
        0,
        1
    ]){
        for (const e of g.edges){
            if (e.cls === 'motorway' || e.cls === 'ramp') continue;
            if (pass === 0 && e.cls === 'service') continue;
            if (pass === 1 && (e.cls !== 'service' || e.way.svc === 'parking_aisle')) continue;
            const w = e.way;
            if (e.twin !== undefined && e.id > e.twin) continue;
            for(let i = 0; i < w.n.length; i++)if (!nodeWay.has(w.n[i])) nodeWay.set(w.n[i], {
                e,
                s: -1
            });
        }
    }
    for (const c of data.crossings){
        if (c.k === 'unmarked' || c.k === 'no' || usedCrossings.has(c.id)) continue;
        const hit = nodeWay.get(c.id);
        if (!hit) continue;
        const e = hit.e;
        if (e.cls === 'arterial' && !/traffic_signals/.test(c.k ?? '')) continue;
        let best = Infinity, bs = 0;
        for(let s = 0; s <= e.ref.length; s += 1){
            const p = sample(e.ref, s);
            const d = Math.hypot(p.x - c.x, p.z - c.z);
            if (d < best) {
                best = d;
                bs = s;
            }
        }
        if (best > 25) continue;
        const s0 = endSetback(e, e.fromNode), s1 = e.ref.length - endSetback(e, e.toNode);
        if ((e.cls === 'service' || /_link$/.test(e.way.hw)) && (bs < s0 + 1.0 || bs > s1 - 1.0)) continue;
        const p = sample(e.ref, bs);
        if (p.y > ELEV) continue;
        const nx = -p.hz, nz = p.hx;
        const [l0, l1] = extents(e);
        const twin = e.twin !== undefined ? g.edges[e.twin] : null;
        const from = e.oneway ? l0 : -(twin ? twin.lanes.length * twin.laneWidth : 0) + l0;
        const s = paint.at(p.x, p.z);
        for(let v = from + 0.4; v < l1 - 0.4; v += 1.2)quadAt(s, p, nx, nz, v, v + 0.6, -1.6, 1.6, null);
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
        const pts = k.line.pts.filter((_, i)=>i % 2 === 0 || i === k.line.pts.length - 1);
        surface.at(pts[0][0], pts[0][1]).ribbon(pts, -k.width / 2 - 0.4, k.width / 2 + 0.4, 0);
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
            if (!ix || ix.control !== 'signal') continue;
            const isPocket = /_link$/.test(fromEdge.way.hw) || (fromEdge.turns[fromLane.index]?.length === 1 && fromEdge.turns[fromLane.index][0] === 'left');
            if (!isPocket) continue;
            const guideKey = `${fromLane.id}->${toEdge.id}`;
            if (drawnGuides.has(guideKey)) continue;
            drawnGuides.add(guideKey);
            const leftGuide = offset(k.line, -k.width * 0.5);
            const s0 = Math.min(3.2, leftGuide.length * 0.18), s1 = Math.max(s0, leftGuide.length - 3.2);
            if (s1 - s0 >= 5.5) {
                for (const [d0, d1] of dashes(s1 - s0, 1.1, 2.2, 0)){
                    const piece = slice(leftGuide.pts, s0 + d0, s0 + d1);
                    if (piece.pts.length >= 2) paintDim.at(piece.pts[0][0], piece.pts[0][1]).ribbon(piece.pts, -0.06, 0.06, 0);
                }
            }
            if (fromLane.index > 0 && fromEdge.turns[fromLane.index - 1]?.includes('left')) {
                const rightGuide = offset(k.line, k.width * 0.5);
                const r0 = Math.min(3.2, rightGuide.length * 0.18), r1 = Math.max(r0, rightGuide.length - 3.2);
                if (r1 - r0 >= 5.5) {
                    for (const [d0, d1] of dashes(r1 - r0, 1.1, 2.2, 0)){
                        const piece = slice(rightGuide.pts, r0 + d0, r0 + d1);
                        if (piece.pts.length >= 2) paintDim.at(piece.pts[0][0], piece.pts[0][1]).ribbon(piece.pts, -0.06, 0.06, 0);
                    }
                }
            }
        }
    }
    const add = (arr)=>arr.forEach((m)=>group.add(m));
    add(medians.meshes(flatMaterial('median'), 'medians', ORDER.sidewalk - 1));
    add(sidewalk.meshes(flatMaterial('sidewalk'), 'sidewalk', ORDER.sidewalk));
    add(curb.meshes(flatMaterial('curb'), 'curb', ORDER.sidewalk + 1));
    add(service.meshes(flatMaterial('service'), 'service', ORDER.road));
    add(aisle.meshes(flatMaterial('parking'), 'aisles', ORDER.road - 1));
    add(asphalt.meshes(flatMaterial('road'), 'asphalt', ORDER.road + 1));
    add(major.meshes(flatMaterial('roadMajor'), 'major', ORDER.road + 2));
    add(freeway.meshes(flatMaterial('freeway'), 'freeway', ORDER.road + 3));
    add(paintDim.meshes(flatMaterial('paintDim'), 'paint-dim', ORDER.paint));
    add(paint.meshes(flatMaterial('paint'), 'paint', ORDER.paint + 1));
    add(paintYellow.meshes(flatMaterial('paintYellow'), 'paint-yellow', ORDER.paint + 1));
    const deckMat = surfaceMaterial('freeway', {
        depthWrite: true,
        polygonOffset: -1
    });
    add(deckTop.meshes(deckMat, 'deck', ORDER.solid));
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
    const pil = new THREE.Mesh(pillars.geometry(), litMaterial('pillar'));
    pil.name = 'pillars';
    group.add(side, pil);
    return {
        group,
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
    for(let i = 0; i < left.pts.length - 1; i++){
        const a0 = left.pts[i], b0 = right.pts[i], a1 = left.pts[i + 1], b1 = right.pts[i + 1];
        const ya0 = left.y[i], yb0 = right.y[i], ya1 = left.y[i + 1], yb1 = right.y[i + 1];
        if (Math.max(ya0, yb0, ya1, yb1) <= 0.03) {
            const v0 = ground.vert(a0[0], 0, a0[1]), v1 = ground.vert(b0[0], 0, b0[1]);
            const v2 = ground.vert(a1[0], 0, a1[1]), v3 = ground.vert(b1[0], 0, b1[1]);
            ground.idx.push(v0, v2, v1, v1, v2, v3);
        } else {
            const L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
            const steps = Math.abs(ya1 - ya0) > 0.15 && L > 6 ? Math.min(14, Math.ceil(L / 4.5)) : 1;
            for(let k = 0; k < steps; k++){
                const t0 = k / steps, t1 = (k + 1) / steps;
                const u0 = ya0 < 0.15 || ya1 < 0.15 ? t0 * t0 * (3 - 2 * t0) * 0.45 + t0 * 0.55 : t0;
                const u1 = ya0 < 0.15 || ya1 < 0.15 ? t1 * t1 * (3 - 2 * t1) * 0.45 + t1 * 0.55 : t1;
                const la0x = a0[0] + (a1[0] - a0[0]) * t0, la0z = a0[1] + (a1[1] - a0[1]) * t0, lya0 = ya0 + (ya1 - ya0) * u0;
                const rb0x = b0[0] + (b1[0] - b0[0]) * t0, rb0z = b0[1] + (b1[1] - b0[1]) * t0, ryb0 = yb0 + (yb1 - yb0) * u0;
                const la1x = a0[0] + (a1[0] - a0[0]) * t1, la1z = a0[1] + (a1[1] - a0[1]) * t1, lya1 = ya0 + (ya1 - ya0) * u1;
                const rb1x = b0[0] + (b1[0] - b0[0]) * t1, rb1z = b0[1] + (b1[1] - b0[1]) * t1, ryb1 = yb0 + (yb1 - yb0) * u1;
                if (Math.max(lya0, ryb0, lya1, ryb1) <= 0.03) {
                    const v0 = ground.vert(la0x, 0, la0z), v1 = ground.vert(rb0x, 0, rb0z);
                    const v2 = ground.vert(la1x, 0, la1z), v3 = ground.vert(rb1x, 0, rb1z);
                    ground.idx.push(v0, v2, v1, v1, v2, v3);
                } else {
                    const v0 = deck.vert(la0x, Math.max(0.02, lya0), la0z), v1 = deck.vert(rb0x, Math.max(0.02, ryb0), rb0z);
                    const v2 = deck.vert(la1x, Math.max(0.02, lya1), la1z), v3 = deck.vert(rb1x, Math.max(0.02, ryb1), rb1z);
                    deck.idx.push(v0, v2, v1, v1, v2, v3);
                }
            }
        }
    }
}
function deckSides(s, left, right, e, onRoad, onElevDeck, skipLeftWall = false, onAnyRoad = null, onConn = null) {
    for (const [line, sign] of [
        [
            left,
            -1
        ],
        [
            right,
            1
        ]
    ]){
        if (sign < 0 && skipLeftWall) continue;
        const n = normals(line.pts);
        for(let i = 0; i < line.pts.length - 1; i++){
            const a = line.pts[i], b = line.pts[i + 1], ya = line.y[i], yb = line.y[i + 1];
            const yMax = Math.max(ya, yb), yMin = Math.min(ya, yb), yMid = 0.5 * (ya + yb);
            if (yMax <= 0.12) continue;
            const mx = (a[0] + b[0]) * 0.5, mz = (a[1] + b[1]) * 0.5;
            const nx = n[i][0] * sign, nz = n[i][1] * sign;
            if (onElevDeck?.(mx + nx * 1.35, mz + nz * 1.35, yMid, 0.9, undefined, e.id)) continue;
            const overGroundRoad = onRoad?.(mx + nx * 1.0, mz + nz * 1.0, 2.2) || onAnyRoad?.(mx + nx * 0.8, mz + nz * 0.8, 0, 1.8, e.way.id, e.id) || onConn?.(mx + nx * 0.8, mz + nz * 0.8, 1.5);
            if (yMin < 4.5 && overGroundRoad) continue;
            const nn = [
                nx,
                0,
                nz
            ];
            const ba = ya < 4.2 && !overGroundRoad ? 0 : Math.max(0, ya - 1.25);
            const bb = yb < 4.2 && !overGroundRoad ? 0 : Math.max(0, yb - 1.25);
            const pa = Math.min(0.85, Math.max(0, (ya - 0.12) * 0.42));
            const pb = Math.min(0.85, Math.max(0, (yb - 0.12) * 0.42));
            const v0 = s.vert(a[0], ba, a[1], nn), v1 = s.vert(b[0], bb, b[1], nn);
            const v2 = s.vert(b[0], yb + pb, b[1], nn), v3 = s.vert(a[0], ya + pa, a[1], nn);
            if (sign > 0) s.quad(v0, v1, v2, v3);
            else s.quad(v1, v0, v3, v2);
            if (ya >= 4.2 && sign > 0) {
                const o = left.pts[i], p = left.pts[i + 1];
                const u0 = s.vert(a[0], ba, a[1], [
                    0,
                    -1,
                    0
                ]), u1 = s.vert(b[0], bb, b[1], [
                    0,
                    -1,
                    0
                ]);
                const u2 = s.vert(p[0], Math.max(0, left.y[i + 1] - 1.25), p[1], [
                    0,
                    -1,
                    0
                ]), u3 = s.vert(o[0], Math.max(0, left.y[i] - 1.25), o[1], [
                    0,
                    -1,
                    0
                ]);
                s.quad(u0, u3, u2, u1);
            }
        }
    }
}
function pillarsAlong(s, e, left, right, onRoad, onAnyRoad = null, onConn = null) {
    const step = 32;
    for(let d = step * 0.45 + hash(e.id) * 6; d < e.ref.length; d += step){
        const p = sample(e.ref, d);
        if (p.y < 4.8) continue;
        const l = sample(left, d), r = sample(right, d);
        const cx = (l.x + r.x) / 2, cz = (l.z + r.z) / 2;
        if (onRoad?.(cx, cz, 4.2) || onAnyRoad?.(cx, cz, 0, 3.8, e.way.id, e.id) || onConn?.(cx, cz, 3.5)) continue;
        box(s, cx, cz, 1.5, 1.5, 0, p.y - 1.35, Math.atan2(p.hx, p.hz));
        const w = Math.hypot(r.x - l.x, r.z - l.z);
        box(s, cx, cz, w * 0.78, 1.7, Math.max(0, p.y - 2.1), p.y - 1.35, Math.atan2(p.hx, p.hz) + Math.PI / 2);
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
    const y = yOff === null ? 0 : p.y + yOff;
    const P = (u, v)=>s.vert(p.x + nx * u + p.hx * v, y, p.z + nz * u + p.hz * v);
    const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1);
    s.quad(a, b, c, d);
}
function arrow(s, p, mv, yOff) {
    const nx = -p.hz, nz = p.hx;
    const y = yOff === null ? 0 : p.y + yOff;
    const poly = (pts)=>{
        const base = s.count;
        for (const [u, v] of pts)s.vert(p.x + nx * u + p.hx * v, y, p.z + nz * u + p.hz * v);
        for(let i = 1; i < pts.length - 1; i++)s.tri(base, base + i + 1, base + i);
    };
    const shaft = (u, v0, v1)=>poly([
            [
                u - 0.09,
                v0
            ],
            [
                u + 0.09,
                v0
            ],
            [
                u + 0.09,
                v1
            ],
            [
                u - 0.09,
                v1
            ]
        ]);
    const head = (u, v, du, dv)=>{
        const L = Math.hypot(du, dv), a = du / L, b = dv / L;
        poly([
            [
                u + a * 0.9,
                v + b * 0.9
            ],
            [
                u - b * 0.42,
                v + a * 0.42
            ],
            [
                u + b * 0.42,
                v - a * 0.42
            ]
        ].map(([x, z])=>[
                x,
                z
            ]));
    };
    const thru = mv.includes('through') || mv.includes('merge');
    const left = mv.includes('left'), right = mv.includes('right');
    shaft(0, -2.6, thru ? 1.2 : 0.2);
    if (thru) head(0, 1.2, 0, 1);
    if (left) {
        poly([
            [
                -0.09,
                0.0
            ],
            [
                -0.09,
                0.2
            ],
            [
                -1.0,
                0.2
            ],
            [
                -1.0,
                0.0
            ]
        ].map(([u, v])=>[
                u,
                v + 0.1
            ]));
        head(-1.0, 0.2, -1, 0);
    }
    if (right) {
        poly([
            [
                0.09,
                0.0
            ],
            [
                1.0,
                0.0
            ],
            [
                1.0,
                0.2
            ],
            [
                0.09,
                0.2
            ]
        ].map(([u, v])=>[
                u,
                v + 0.1
            ]));
        head(1.0, 0.2, 1, 0);
    }
    if (mv.includes('uturn')) {
        shaft(-0.7, -1.2, 0.2);
        head(-0.7, -1.2, 0, -1);
    }
}
function onlyText(s, p, yOff) {
    const nx = -p.hz, nz = p.hx;
    const y = yOff === null ? 0 : p.y + yOff;
    const W = 0.5, H = 2.2, t = 0.12, tv = 0.26;
    const rects = [];
    const R = (u0, v0, u1, v1, off)=>rects.push([
            off + u0,
            v0 - H / 2,
            off + u1,
            v1 - H / 2
        ]);
    const glyph = (ch, o)=>{
        if (ch === 'O') {
            R(0, 0, W, tv, o);
            R(0, H - tv, W, H, o);
            R(0, 0, t, H, o);
            R(W - t, 0, W, H, o);
        }
        if (ch === 'N') {
            R(0, 0, t, H, o);
            R(W - t, 0, W, H, o);
            for(let k = 0; k < 6; k++){
                const f = k / 6;
                R(t + f * (W - 2 * t) - 0.02, H - (f + 1 / 6) * H, t + (f + 1 / 6) * (W - 2 * t) + 0.02, H - f * H, o);
            }
        }
        if (ch === 'L') {
            R(0, 0, t, H, o);
            R(0, 0, W, tv, o);
        }
        if (ch === 'Y') {
            R(W / 2 - t / 2, 0, W / 2 + t / 2, H * 0.52, o);
            R(0, H * 0.5, t, H, o);
            R(W - t, H * 0.5, W, H, o);
            R(0, H * 0.48, W, H * 0.48 + tv, o);
        }
    };
    const gap = 0.16, total = 4 * W + 3 * gap;
    [
        'O',
        'N',
        'L',
        'Y'
    ].forEach((ch, i)=>glyph(ch, -total / 2 + i * (W + gap)));
    for (const [u0, v0, u1, v1] of rects){
        const P = (u, v)=>s.vert(p.x + nx * u + p.hx * v, y, p.z + nz * u + p.hz * v);
        const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1);
        s.quad(a, b, c, d);
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
