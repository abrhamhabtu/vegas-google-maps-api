// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { signalState } from '../map/intersections.js';
import { roadMask, sample } from '../map/lanegraph.js';
import { minRadius } from '../map/movements.js';
export const MIN_TURN_RADIUS = 5.2;
export const PROFILES = {
    sloth: {
        key: 'sloth',
        label: 'Sloth',
        speed: 0.85,
        accel: 2.2,
        brake: 2.2,
        side: 3.0,
        jerk: 3.5,
        headway: 2.4,
        minGap: 4.5,
        passFront: 16,
        passRear: 22,
        passHold: 6,
        passGain: 6,
        laneTime: 4.2,
        amberGo: false
    },
    normal: {
        key: 'normal',
        label: 'Normal',
        speed: 1,
        accel: 3.6,
        brake: 2.8,
        side: 4.2,
        jerk: 5,
        headway: 1.5,
        minGap: 3,
        passFront: 10,
        passRear: 12,
        passHold: 3,
        passGain: 3,
        laneTime: 3,
        amberGo: false
    },
    hurry: {
        key: 'hurry',
        label: 'Hurry',
        speed: 1.14,
        accel: 4.8,
        brake: 3.6,
        side: 5,
        jerk: 7,
        headway: 1.1,
        minGap: 2.4,
        passFront: 6,
        passRear: 6,
        passHold: 1.4,
        passGain: 1.5,
        laneTime: 2.1,
        amberGo: true
    },
    madmax: {
        key: 'madmax',
        label: 'Mad Max',
        speed: 1.32,
        accel: 6.2,
        brake: 4.6,
        side: 6,
        jerk: 10,
        headway: 0.6,
        minGap: 1.6,
        passFront: 3,
        passRear: 2.2,
        passHold: 0.5,
        passGain: 0.5,
        laneTime: 1.3,
        amberGo: true
    }
};
const LANE_W = 3.5;
export function routeIndex(g) {
    const phaseOf = new Map(), approachOf = new Map();
    for (const i of g.intersections ?? []){
        if (i.control !== 'signal') continue;
        for (const p of i.phases)for (const c of p.greens)phaseOf.set(c, i);
        for (const l of i.legs)for (const a of l.approaches)if (a.inbound) approachOf.set(a.edge, a);
    }
    const L = g.lanes, costs = new Float64Array(L.length);
    for (const l of L){
        const e = g.edges[l.edge], mps = (e?.mph ?? 25) * 0.447;
        const freeway = e?.cls === 'motorway' || e?.cls === 'ramp';
        const dislike = freeway ? 1.5 : e?.cls === 'service' ? 3.2 : e?.cls === 'local' ? 1.6 : 1;
        costs[l.id] = l.line.length / Math.max(mps, 3) * dislike + (l.connector && phaseOf.has(l.id) ? 12 : 0);
        if ((l.connector ? l.next.length > 0 : !!l.raw) && minRadius(l.line) < MIN_TURN_RADIUS * 0.9) costs[l.id] += 300;
        if (l.connector && l.prev.length && l.next.length) {
            const a = L[l.prev[0]].line.pts, b = L[l.next[0]].line.pts, p0 = a[Math.max(0, a.length - 2)], p1 = a[a.length - 1], q0 = b[0], q1 = b[1] ?? b[0];
            const ax = p1[0] - p0[0], az = p1[1] - p0[1], bx = q1[0] - q0[0], bz = q1[1] - q0[1];
            if ((ax * bx + az * bz) / ((Math.hypot(ax, az) || 1) * (Math.hypot(bx, bz) || 1)) < -0.3) costs[l.id] += 300;
        }
    }
    return {
        phaseOf,
        approachOf,
        costs
    };
}
function findRoute(g, idx, from, goal, heur, banned, allow) {
    const L = g.lanes, n = L.length, best = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    const heap = [];
    const push = (f, v)=>{
        heap.push([
            f,
            v
        ]);
        for(let i = heap.length - 1; i > 0;){
            const p = i - 1 >> 1;
            if (heap[p][0] <= heap[i][0]) break;
            [heap[p], heap[i]] = [
                heap[i],
                heap[p]
            ];
            i = p;
        }
    };
    const pop = ()=>{
        const top = heap[0], last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            for(let i = 0;;){
                const a = 2 * i + 1, b = a + 1;
                let m = i;
                if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
                if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
                if (m === i) break;
                [heap[m], heap[i]] = [
                    heap[i],
                    heap[m]
                ];
                i = m;
            }
        }
        return top;
    };
    const h = (v)=>{
        if (!heur) return 0;
        const p = L[v].line.pts[0];
        return Math.hypot(p[0] - heur[0], p[1] - heur[1]) / 30;
    };
    const home = L[from[0] ?? 0].line.pts[0];
    const cutThrough = (w)=>{
        const l = L[w];
        if (g.edges[l.edge]?.cls !== 'service' || !heur) return 1;
        const p = l.line.pts[0];
        return Math.hypot(p[0] - home[0], p[1] - home[1]) > 220 && Math.hypot(p[0] - heur[0], p[1] - heur[1]) > 220 ? 6 : 1;
    };
    for (const s of from)if (!banned.has(s)) {
        best[s] = 0;
        push(h(s), s);
    }
    while(heap.length){
        const [, v] = pop();
        if (done[v]) continue;
        done[v] = 1;
        const lane = L[v];
        if (goal(lane)) {
            const out = [];
            for(let c = v; c >= 0; c = prev[c])out.push(c);
            return out.reverse();
        }
        const relax = (w, extra)=>{
            if (banned.has(w) || allow && !allow(L[w])) return;
            const d = best[v] + extra * cutThrough(w);
            if (d < best[w]) {
                best[w] = d;
                prev[w] = v;
                push(d + h(w), w);
            }
        };
        for (const c of lane.next)relax(c, idx.costs[c]);
        const e = g.edges[lane.edge];
        if (e && !lane.connector) {
            const k = e.lanes.indexOf(v);
            for (const o of [
                k - 1,
                k + 1
            ])if (o >= 0 && o < e.lanes.length) relax(e.lanes[o], 6);
        }
    }
    return null;
}
function assemble(g, idx, edges, startLane, endEdgeS) {
    const L = g.lanes, E = g.edges;
    const raw = {
        xs: [],
        zs: [],
        ys: [],
        mps: [],
        cum: [],
        laneIds: [],
        turns: [],
        signals: [],
        changes: []
    };
    let curLane = -1;
    const push = (x, z, y, mps)=>{
        const n = raw.xs.length;
        if (n) {
            const d = Math.hypot(raw.xs[n - 1] - x, raw.zs[n - 1] - z);
            if (d < 0.15) return;
            raw.cum.push(raw.cum[n - 1] + d);
        } else raw.cum.push(0);
        raw.xs.push(x);
        raw.zs.push(z);
        raw.ys.push(y);
        raw.mps.push(mps);
        raw.laneIds.push(curLane);
    };
    const atEnd = ()=>raw.cum[raw.cum.length - 1] ?? 0;
    const edgeOf = (k)=>E[edges[k]];
    const reach = new Map(), fewest = new Map();
    const reachKey = (k, l)=>k * 400000 + l;
    const through = (k, l)=>{
        if (k >= edges.length - 1) return 0;
        let best = Infinity;
        for (const c of L[l].next){
            const t = L[c].next[0];
            if (t !== undefined && L[t].edge === edges[k + 1]) best = Math.min(best, fewest.get(reachKey(k + 1, t)) ?? Infinity);
        }
        return best;
    };
    for(let k = edges.length - 1; k >= 0; k--){
        const here = edgeOf(k).lanes;
        for (const l of here){
            let most = 0;
            if (k < edges.length - 1) for (const c of L[l].next){
                const t = L[c].next[0];
                if (t !== undefined && L[t].edge === edges[k + 1]) most = Math.max(most, 1 + (reach.get(reachKey(k + 1, t)) ?? 0));
            }
            reach.set(reachKey(k, l), most);
        }
        here.forEach((l, q)=>{
            let best = Infinity;
            here.forEach((o, w)=>{
                best = Math.min(best, Math.abs(w - q) + through(k, o));
            });
            fewest.set(reachKey(k, l), best);
        });
    }
    const onward = (l, k)=>{
        const nextEdge = edges[k + 1];
        if (nextEdge === undefined) return null;
        const here = edgeOf(k), at = here.lanes.indexOf(l);
        let best = null, low = Infinity, top = -1, score = Infinity;
        for (const c of L[l].next){
            const t = L[L[c].next[0]];
            if (!t || t.edge !== nextEdge) continue;
            const n = fewest.get(reachKey(k + 1, t.id)) ?? Infinity, r = reach.get(reachKey(k + 1, t.id)) ?? 0;
            const s = Math.abs(E[nextEdge].lanes.indexOf(t.id) - at) + (L[c].movement === 'through' ? 0 : 0.5);
            if (n < low || n === low && (r > top || r === top && s < score)) {
                low = n;
                top = r;
                score = s;
                best = c;
            }
        }
        return best;
    };
    const horizon = (l, k, s)=>{
        let lane = l, j = k, dist = L[l].line.length - s;
        for(; j < edges.length - 1; j++){
            const c = onward(lane, j);
            if (c === null) {
                const edge = edgeOf(j), me = edge.lanes.indexOf(lane);
                let low = Infinity, bestD = Infinity, top = -1, dir = 0;
                edge.lanes.forEach((o, q)=>{
                    const n = through(j, o);
                    if (n === Infinity) return;
                    const d = Math.abs(q - me), total = d + n, r = reach.get(reachKey(j, o)) ?? 0;
                    if (total < low || total === low && (d < bestD || d === bestD && r > top)) {
                        low = total;
                        bestD = d;
                        top = r;
                        dir = Math.sign(q - me);
                    }
                });
                return low === Infinity ? null : {
                    dist,
                    at: j,
                    dir,
                    lanes: bestD
                };
            }
            dist += L[c].line.length;
            lane = L[c].next[0];
            dist += L[lane].line.length;
        }
        return null;
    };
    const walk = (from, len, visit, onSignal)=>{
        let { lane, k, s } = from, walked = 0;
        for(;;){
            if (onSignal) curLane = lane;
            const l = L[lane], line = l.line, room = line.length - s, mps = edgeOf(k).mph * 0.447;
            const end = Math.min(line.length, s + (len - walked));
            const lift = line.y.some((v)=>v > 2.5) ? 1000 : 0;
            for(let i = 0; i < line.pts.length; i++){
                const c = line.cum[i];
                if (c > s + 0.02 && c < end - 0.02) visit(line.pts[i][0], line.pts[i][1], lift + line.y[i], mps, walked + c - s);
            }
            const q = sample(line, end);
            visit(q.x, q.z, lift + q.y, mps, walked + end - s);
            walked += end - s;
            if (walked >= len - 1e-3 || room > len + 1e6) return {
                lane,
                k,
                s: end,
                walked,
                ended: false
            };
            const c = onward(lane, k);
            if (c === null) return {
                lane,
                k,
                s: line.length,
                walked,
                ended: true
            };
            const conn = L[c], target = conn.next[0];
            onSignal?.(c, walked, edgeOf(k).id);
            if (onSignal) curLane = -1;
            const clen = conn.line.length, cMps = Math.min(mps, edgeOf(k + 1).mph * 0.447);
            for(let i = 0; i < conn.line.pts.length; i++){
                const cc = conn.line.cum[i];
                if (cc > 0.01) visit(conn.line.pts[i][0], conn.line.pts[i][1], (lift || conn.line.y.some((v)=>v > 2.5) ? 1000 : 0) + conn.line.y[i], cMps, walked + cc);
            }
            walked += clen;
            lane = target;
            k += 1;
            s = 0;
            if (walked >= len) return {
                lane,
                k,
                s: 0,
                walked,
                ended: false
            };
        }
    };
    const toSignal = (from)=>{
        let lane = from.lane, k = from.k, d = L[lane].line.length - from.s;
        for(let n = 0; n < 40; n++){
            const c = onward(lane, k);
            if (c === null) return Infinity;
            if (idx.phaseOf.has(c)) return d;
            d += L[c].line.length + L[L[c].next[0]].line.length;
            lane = L[c].next[0];
            k++;
        }
        return Infinity;
    };
    const add = (x, z, y, mps)=>push(x, z, y, mps);
    const signal = (c, edge)=>{
        if (idx.phaseOf.has(c)) raw.signals.push({
            c,
            i: idx.phaseOf.get(c),
            s: atEnd(),
            edge
        });
        const mv = L[c].movement, to = E[L[L[c].next[0]].edge];
        if (mv === 'left' || mv === 'right' || mv === 'uturn') raw.turns.push({
            s: atEnd(),
            movement: mv,
            onto: to?.way.name ?? ''
        });
    };
    let startBest = startLane, startLow = through(0, startLane), startReach = reach.get(reachKey(0, startLane)) ?? 0;
    for (const l of edgeOf(0).lanes){
        const n = through(0, l), r = reach.get(reachKey(0, l)) ?? 0;
        if (n < startLow || n === startLow && r > startReach) {
            startLow = n;
            startReach = r;
            startBest = l;
        }
    }
    let spot = {
        lane: startBest,
        k: 0,
        s: 0
    };
    {
        const p = sample(L[startBest].line, 0);
        push(p.x, p.z, p.y, edgeOf(0).mph * 0.447);
    }
    for(let guard = 0; guard < 400; guard++){
        const h0 = horizon(spot.lane, spot.k, spot.s);
        const h = h0;
        if (!h) {
            const r = walk(spot, 1e7, add, (c, _w, edge)=>signal(c, edge));
            spot = r;
            break;
        }
        const lead = 170 + 95 * Math.max(1, fewest.get(reachKey(spot.k, spot.lane)) ?? h.lanes);
        const wait = h.dist - lead;
        if (wait > 0.5) {
            const r = walk(spot, wait, add, (c, _w, edge)=>signal(c, edge));
            spot = r;
            if (r.ended) return null;
        }
        const here = edgeOf(spot.k), me = here.lanes.indexOf(spot.lane), stay = through(spot.k, spot.lane);
        const moveTo = (q)=>{
            const o = here.lanes[q];
            return o === undefined ? Infinity : 1 + (fewest.get(reachKey(spot.k, o)) ?? Infinity);
        };
        const up = moveTo(me - 1), down = moveTo(me + 1), best = Math.min(up, down);
        const dir = up === down ? h.dir : up < down ? -1 : 1;
        const other = best === Infinity || best > stay ? undefined : here.lanes[me + dir];
        const left = L[spot.lane].line.length - spot.s;
        const deadEnd = other !== undefined && left < 4 && onward(spot.lane, spot.k) === null;
        if (other === undefined || left < 4 && !deadEnd) {
            if (spot.k >= h.at && other === undefined) return null;
            const r = walk(spot, left + 0.5, add, (c, _w, edge)=>signal(c, edge));
            spot = r;
            if (r.ended) return null;
            continue;
        }
        const mps = here.mph * 0.447, hNow = horizon(spot.lane, spot.k, spot.s);
        const toDeadline = hNow ? hNow.dist : 1e6, sigGap = toSignal(spot);
        let room = Math.min(sigGap - 8, toDeadline - 32);
        if (room < 20) room = Math.min(sigGap - 5, toDeadline - 13);
        if (room < 12) room = Math.min(sigGap - 5, toDeadline - 8);
        if (room < 12) {
            if (spot.k < h.at) {
                const r = walk(spot, left + 0.5, add, (c, _w, edge)=>signal(c, edge));
                spot = r;
                if (r.ended) return null;
                continue;
            }
            room = Math.max(room, Math.min(Math.max(left - 1, deadEnd ? 12 : 0), 10));
            if (room < 3) return null;
        }
        const length = deadEnd ? Math.min(14, Math.max(room, 8)) : Math.min(Math.max(32, mps * 4), room);
        const startS = atEnd(), deadlineS = startS + toDeadline;
        const trace = (from)=>{
            const px = [], pz = [], py = [], pw = [], pm = [];
            const r = walk(from, length, (x, z, y, m, w)=>{
                px.push(x);
                pz.push(z);
                py.push(y);
                pm.push(m);
                pw.push(w);
            });
            return {
                px,
                pz,
                py,
                pw,
                pm,
                r
            };
        };
        const sB = Math.min(L[other].line.length - 0.5, spot.s / (L[spot.lane].line.length || 1) * L[other].line.length);
        const A = trace(spot), B = trace({
            lane: other,
            k: spot.k,
            s: sB
        });
        if (B.r.ended && B.r.walked < length - 1) {
            const r = walk(spot, left + 0.5, add, (c, _w, edge)=>signal(c, edge));
            spot = r;
            if (r.ended) return null;
            continue;
        }
        const lerp = (T, w)=>{
            let i = 0;
            while(i + 1 < T.pw.length && T.pw[i + 1] < w)i++;
            const j = Math.min(i + 1, T.pw.length - 1), f = T.pw[j] > T.pw[i] ? (w - T.pw[i]) / (T.pw[j] - T.pw[i]) : 0;
            return [
                T.px[i] + (T.px[j] - T.px[i]) * f,
                T.pz[i] + (T.pz[j] - T.pz[i]) * f,
                T.py[i] + (T.py[j] - T.py[i]) * f,
                T.pm[i]
            ];
        };
        curLane = -1;
        for(let d = 1.5; d <= length; d += 1.5){
            const a = lerp(A, d), b = lerp(B, d), t = d / length, w = t * t * t * (t * (6 * t - 15) + 10);
            push(a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2], a[3]);
        }
        const settled = atEnd();
        for(let i = 0; i < B.pw.length; i++)if (B.pw[i] > length) push(B.px[i], B.pz[i], B.py[i], B.pm[i]);
        {
            const q = sample(L[B.r.lane].line, B.r.s);
            push(q.x, q.z, q.y, A.pm[0]);
        }
        raw.changes.push({
            start: startS,
            end: settled,
            deadline: deadlineS,
            lanes: h.lanes
        });
        spot = {
            lane: B.r.lane,
            k: B.r.k,
            s: B.r.s
        };
    }
    if (endEdgeS !== null) {
        const line = L[spot.lane].line, overshoot = Math.max(0, line.length - endEdgeS);
        if (overshoot > 1 && raw.cum.length) {
            const stop = atEnd() - overshoot;
            while(raw.cum.length > 2 && raw.cum[raw.cum.length - 1] > stop){
                raw.cum.pop();
                raw.xs.pop();
                raw.zs.pop();
                raw.ys.pop();
                raw.mps.pop();
                raw.laneIds.pop();
            }
        }
    }
    return raw;
}
function finish(g, idx, raw, edges, lanes) {
    const total = raw.cum[raw.cum.length - 1] ?? 0, n = Math.max(2, Math.ceil(total));
    let xs = new Float64Array(n + 1), zs = new Float64Array(n + 1);
    const mps = new Float64Array(n + 1), raised = new Uint8Array(n + 1), heights = new Float64Array(n + 1), laneOf = new Int32Array(n + 1);
    let j = 0;
    for(let i = 0; i <= n; i++){
        const s = total * i / n;
        while(j + 1 < raw.cum.length - 1 && raw.cum[j + 1] < s)j++;
        const f = (s - raw.cum[j]) / (raw.cum[j + 1] - raw.cum[j] || 1);
        xs[i] = raw.xs[j] + (raw.xs[j + 1] - raw.xs[j]) * f;
        zs[i] = raw.zs[j] + (raw.zs[j + 1] - raw.zs[j]) * f;
        mps[i] = Math.max(raw.mps[j], 9);
        laneOf[i] = raw.laneIds[j] ?? -1;
        raised[i] = raw.ys[j] >= 500 ? 1 : 0;
        {
            const h0 = raw.ys[j] % 1000, h1 = raw.ys[Math.min(j + 1, raw.ys.length - 1)] % 1000;
            heights[i] = h0 + (h1 - h0) * f;
        }
    }
    const rx = xs.slice(), rz = zs.slice();
    const TARGET = MIN_TURN_RADIUS + 0.5;
    const radiusAt = (i)=>{
        const ax = xs[i - 3], az = zs[i - 3], bx = xs[i], bz = zs[i], cx = xs[i + 3], cz = zs[i + 3];
        const ab = Math.hypot(bx - ax, bz - az), bc = Math.hypot(cx - bx, cz - bz), ca = Math.hypot(ax - cx, az - cz), area = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
        return area < 1e-5 ? Infinity : ab * bc * ca / (4 * area);
    };
    const relax = (hot)=>{
        const ax = xs.slice(), az = zs.slice();
        for(let i = 1; i < n; i++){
            if (hot && !hot[i]) continue;
            ax[i] = 0.25 * xs[i - 1] + 0.5 * xs[i] + 0.25 * xs[i + 1];
            az[i] = 0.25 * zs[i - 1] + 0.5 * zs[i] + 0.25 * zs[i + 1];
        }
        xs = ax;
        zs = az;
    };
    relax(null);
    const spread = (hot)=>{
        for(let a = 1; a < n; a++){
            if (!hot[a]) continue;
            let b = a;
            while(b + 1 < n && hot[b + 1])b++;
            const lo = a - 1, hi = b + 1, run = [
                0
            ];
            for(let i = lo + 1; i <= hi; i++)run.push(run[run.length - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]));
            const nx = xs.slice(lo, hi + 1), nz = zs.slice(lo, hi + 1), len = run[run.length - 1], m = hi - lo;
            let q = 0;
            for(let i = 1; i < m; i++){
                const want = len * i / m;
                while(q + 1 < m && run[q + 1] < want)q++;
                const f = (want - run[q]) / (run[q + 1] - run[q] || 1);
                xs[lo + i] = nx[q] + (nx[q + 1] - nx[q]) * f;
                zs[lo + i] = nz[q] + (nz[q + 1] - nz[q]) * f;
            }
            a = b;
        }
    };
    let touched = null;
    for(let k = 0; k < 800 && n > 8; k++){
        const hot = new Uint8Array(n + 1);
        let any = false;
        for(let i = 3; i <= n - 3; i++)if (radiusAt(i) < TARGET) {
            any = true;
            for(let q = Math.max(1, i - 8); q <= Math.min(n - 1, i + 8); q++)hot[q] = 1;
        }
        if (!any) {
            if (!touched) break;
            spread(touched);
            touched = null;
            continue;
        }
        relax(hot);
        touched = hot;
        if (k % 12 === 11) spread(hot);
    }
    let maxShift = 0;
    for(let i = 0; i <= n; i++)maxShift = Math.max(maxShift, Math.hypot(xs[i] - rx[i], zs[i] - rz[i]));
    const cum = new Float64Array(n + 1), heading = new Float64Array(n + 1);
    for(let i = 1; i <= n; i++)cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
    for(let i = 0; i <= n; i++){
        const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
        heading[i] = Math.atan2(xs[b] - xs[a], zs[b] - zs[a]);
    }
    const curve = new Float64Array(n + 1);
    let tightest = {
        r: Infinity,
        x: xs[0],
        z: zs[0]
    };
    for(let i = 2; i <= n - 2; i++){
        const d = Math.atan2(Math.sin(heading[i + 2] - heading[i - 2]), Math.cos(heading[i + 2] - heading[i - 2]));
        const ds = Math.max(cum[i + 2] - cum[i - 2], 0.5);
        curve[i] = d / ds;
        const r = Math.abs(curve[i]) > 1e-4 ? 1 / Math.abs(curve[i]) : Infinity;
        if (r < tightest.r) tightest = {
            r,
            x: xs[i],
            z: zs[i]
        };
    }
    {
        const c0 = curve.slice(), w = 3;
        for(let i = w; i <= n - w; i++){
            let t = 0;
            for(let q = -w; q <= w; q++)t += c0[i + q];
            curve[i] = t / (2 * w + 1);
        }
    }
    const speed = new Float64Array(n + 1);
    const remap = (s)=>{
        const f = Math.max(0, Math.min(n, s / (total || 1) * n)), lo = Math.floor(f), hi = Math.min(n, lo + 1);
        return cum[lo] + (cum[hi] - cum[lo]) * (f - lo);
    };
    const signals = raw.signals.map(({ c, i, s, edge })=>{
        const app = idx.approachOf.get(edge), e = g.edges[edge];
        let line = s;
        if (app && e) {
            const q = sample(e.ref, Math.max(0, e.ref.length - app.stopAt)), f = Math.max(0, Math.min(n, s / (total || 1) * n)) | 0;
            line = s + (q.x - rx[f]) * q.hx + (q.z - rz[f]) * q.hz;
        }
        return {
            i,
            connector: c,
            lineS: remap(line)
        };
    });
    const changes = raw.changes.map((q)=>({
            startS: remap(q.start),
            endS: remap(q.end),
            deadlineS: remap(q.deadline),
            lanes: q.lanes
        }));
    return {
        xs,
        zs,
        heading,
        curve,
        speed,
        cum,
        length: cum[n],
        signals,
        changes,
        edges,
        lanes,
        tightest,
        maxShift,
        raised,
        heights,
        limit: mps,
        laneOf,
        turns: raw.turns.map((q)=>({
                ...q,
                s: remap(q.s)
            }))
    };
}
export function planPath(g, idx, req) {
    const L = g.lanes, banned = new Set(), onRoad = roadMask(g, true);
    let best = null, bestBad = Infinity;
    for(let attempt = 0; attempt < 6; attempt++){
        const lanes = findRoute(g, idx, req.from, req.goal, req.heur, banned, req.allow);
        if (!lanes) break;
        const edges = [];
        for (const id of lanes){
            const l = L[id];
            if (l.connector) continue;
            if (edges[edges.length - 1] !== l.edge) edges.push(l.edge);
        }
        const last = L[lanes[lanes.length - 1]];
        const stopS = req.stopS ? req.stopS(last) : null;
        const raw = (edges.length ? assemble(g, idx, edges, firstRealLane(g, lanes), stopS) : null) ?? literal(g, idx, lanes, stopS);
        if (raw.cum.length < 2) break;
        const path = finish(g, idx, raw, edges, lanes);
        const spots = [];
        if (path.tightest.r < 4.5) spots.push([
            path.tightest.x,
            path.tightest.z
        ]);
        for(let i = 0; i < path.xs.length; i += 3)if (!path.raised[i] && !onRoad(path.xs[i], path.zs[i], 0.45)) {
            spots.push([
                path.xs[i],
                path.zs[i]
            ]);
            i += 40;
        }
        if (spots.length < bestBad) {
            best = path;
            bestBad = spots.length;
        }
        if (!spots.length) return path;
        let struck = 0;
        for (const id of lanes){
            const l = L[id];
            if (req.from.includes(id) || req.goal(l)) continue;
            const near = !l.connector && l.line.length > 12 ? 5 : 14;
            if (spots.some(([x, z])=>l.line.pts.some((p)=>Math.hypot(p[0] - x, p[1] - z) < near))) {
                banned.add(id);
                struck++;
            }
        }
        if (!struck) break;
    }
    return best;
}
function literal(g, idx, lanes, stopS) {
    const L = g.lanes, raw = {
        xs: [],
        zs: [],
        ys: [],
        mps: [],
        cum: [],
        laneIds: [],
        turns: [],
        signals: [],
        changes: []
    };
    let curLane = -1;
    const push = (x, z, y, mps)=>{
        const n = raw.xs.length;
        if (n) {
            const d = Math.hypot(raw.xs[n - 1] - x, raw.zs[n - 1] - z);
            if (d < 0.15) return;
            raw.cum.push(raw.cum[n - 1] + d);
        } else raw.cum.push(0);
        raw.xs.push(x);
        raw.zs.push(z);
        raw.ys.push(y);
        raw.mps.push(mps);
        raw.laneIds.push(curLane);
    };
    let carried = 0;
    lanes.forEach((id, k)=>{
        const l = L[id], before = L[lanes[k - 1]], after = L[lanes[k + 1]], mps = (g.edges[l.edge]?.mph ?? 25) * 0.447, line = l.line;
        const lift = line.y.some((v)=>v > 2.5) ? 1000 : 0;
        curLane = l.connector ? -1 : id;
        if (l.connector && (l.movement === 'left' || l.movement === 'right' || l.movement === 'uturn')) raw.turns.push({
            s: raw.cum[raw.cum.length - 1] ?? 0,
            movement: l.movement,
            onto: g.edges[L[l.next[0]].edge]?.way.name ?? ''
        });
        if (l.connector && idx.phaseOf.has(id)) raw.signals.push({
            c: id,
            i: idx.phaseOf.get(id),
            s: raw.cum[raw.cum.length - 1] ?? 0,
            edge: before?.edge ?? -1
        });
        const changedIn = !!before && !before.connector && !l.connector && before.edge === l.edge, changesOut = !!after && !after.connector && !l.connector && after.edge === l.edge;
        const from = changedIn ? Math.min(carried + 12, line.length) : 0, to = changesOut ? Math.min(from + 2, line.length) : line.length;
        const start = raw.cum[raw.cum.length - 1] ?? 0;
        for (const s of [
            from,
            ...line.cum.filter((c)=>c > from + 0.05 && c < to - 0.05),
            to
        ]){
            const q = sample(line, s);
            push(q.x, q.z, lift + q.y, mps);
        }
        if (changedIn) raw.changes.push({
            start: start - 2,
            end: start + 12,
            deadline: start + (line.length - from),
            lanes: 1
        });
        carried = to;
    });
    if (stopS !== null) {
        const line = L[lanes[lanes.length - 1]].line, over = Math.max(0, line.length - stopS), stop = (raw.cum[raw.cum.length - 1] ?? 0) - over;
        while(raw.cum.length > 2 && raw.cum[raw.cum.length - 1] > stop){
            raw.cum.pop();
            raw.xs.pop();
            raw.zs.pop();
            raw.ys.pop();
            raw.mps.pop();
            raw.laneIds.pop();
        }
    }
    return raw;
}
function firstRealLane(g, lanes) {
    const L = g.lanes;
    const first = L[lanes[0]].edge;
    for (const id of lanes){
        const l = L[id];
        if (!l.connector && l.edge === first) return id;
    }
    return lanes[0];
}
export class Driver {
    path;
    dims;
    x;
    z;
    yaw;
    v = 0;
    steer = 0;
    progress = 0;
    accel = 0;
    off = 0;
    offTarget = 0;
    brakeOn = false;
    waitingAtLight = false;
    aebOn = false;
    done = false;
    tactic = 'Cruising';
    profile = PROFILES.normal;
    log = {
        redLights: 0,
        overruns: 0,
        worstOverrun: 0,
        maxError: 0,
        maxErrorAt: [
            0,
            0
        ],
        offRoad: 0,
        offAt: [],
        stops: 0,
        waited: 0,
        stuck: false,
        aeb: 0,
        hardStops: 0
    };
    speed;
    offRate = 0;
    nextSig = 0;
    committed = false;
    stoppedHere = false;
    overrun = false;
    passedLine = false;
    idle = 0;
    check = 0;
    lastAeb = -99;
    clock = 0;
    wasHard = false;
    constructor(path, dims, pose, profile = PROFILES.normal){
        this.path = path;
        this.dims = dims;
        this.x = pose?.x ?? path.xs[0];
        this.z = pose?.z ?? path.zs[0];
        this.yaw = pose?.yaw ?? path.heading[Math.min(3, path.heading.length - 1)];
        this.v = pose?.v ?? 0;
        this.speed = new Float64Array(path.xs.length);
        this.setProfile(profile);
        if (pose) {
            let best = Infinity;
            for(let i = 0; i < Math.min(path.xs.length, 500); i++){
                const d = Math.hypot(path.xs[i] - this.x, path.zs[i] - this.z);
                if (d < best) {
                    best = d;
                    this.progress = path.cum[i];
                }
            }
        }
    }
    setProfile(profile) {
        this.profile = profile;
        const { limit, curve, cum } = this.path, sp = this.speed, n = sp.length - 1;
        for(let i = 0; i <= n; i++)sp[i] = Math.min(limit[i] * profile.speed, Math.sqrt(profile.side / Math.max(Math.abs(curve[i]), 1e-4)));
        sp[n] = 0;
        for(let i = n - 1; i >= 0; i--)sp[i] = Math.min(sp[i], Math.sqrt(sp[i + 1] * sp[i + 1] + 2 * profile.brake * (cum[i + 1] - cum[i])));
    }
    get limit() {
        return this.path.limit[this.indexAt(this.progress)] ?? 0;
    }
    get remaining() {
        return this.path.length - this.progress;
    }
    height() {
        return this.path.heights[this.indexAt(this.progress)] ?? 0;
    }
    nextTurn() {
        return this.path.turns.find((t)=>t.s > this.progress) ?? null;
    }
    get signalAhead() {
        const q = this.path.signals[this.nextSig];
        return q ? q.lineS - this.progress - this.dims.nose : Infinity;
    }
    indexAt(s) {
        const c = this.path.cum;
        let lo = 0, hi = c.length - 1;
        while(hi - lo > 1){
            const m = lo + hi >> 1;
            if (c[m] <= s) lo = m;
            else hi = m;
        }
        return lo;
    }
    lineAt(i) {
        const p = this.path, h = p.heading[i];
        return [
            p.xs[i] + Math.cos(h) * this.off,
            p.zs[i] - Math.sin(h) * this.off
        ];
    }
    laneBeside(dir, metres, g) {
        const p = this.path, end = Math.min(p.length - 25, this.progress + metres);
        if (end <= this.progress + 5) return false;
        for(let s = this.progress; s < end; s += 3){
            const id = p.laneOf[this.indexAt(s)];
            if (id < 0) return false;
            const lane = g.lanes[id], e = g.edges[lane.edge];
            if (!e || e.internal) return false;
            const at = e.lanes.indexOf(id) + (dir > 0 ? -1 : 1);
            if (at < 0 || at >= e.lanes.length) return false;
        }
        return this.signalAhead > metres;
    }
    movesOn(sig, t) {
        const st = signalState(sig.i, t);
        if (st.phase < 0) return 'go';
        if (!sig.i.phases[st.phase].greens.includes(sig.connector)) return 'stop';
        return st.state === 'green' ? 'go' : st.state === 'yellow' ? 'amber' : 'stop';
    }
    rearStop(lineS) {
        return lineS - this.dims.nose - 0.9;
    }
    step(dt, t, gapAhead = Infinity, onRoad, leadSpeed = 0) {
        if (this.done) return;
        this.clock += dt;
        const p = this.path, P = this.profile;
        const i = this.indexAt(this.progress);
        let tactic = 'Cruising';
        let brakeFor = Infinity;
        this.waitingAtLight = false;
        while(this.nextSig < p.signals.length && this.progress + this.dims.nose > p.signals[this.nextSig].lineS + 1.2){
            this.nextSig++;
            this.committed = false;
            this.stoppedHere = false;
            this.overrun = false;
            this.passedLine = false;
        }
        const sig = p.signals[this.nextSig];
        if (sig) {
            const nose = this.progress + this.dims.nose, toLine = sig.lineS - nose;
            const stop = this.rearStop(sig.lineS) - this.progress;
            const brakingDist = this.v * this.v / (2 * P.brake);
            const state = this.movesOn(sig, t);
            if (state === 'go' && stop < 2) this.committed = true;
            if (state === 'amber' && (this.committed || this.v * this.v / (2 * 3.4) > stop || P.amberGo && this.v * 1.6 > stop - 2)) this.committed = true;
            if (state === 'amber' && this.committed) tactic = 'Going through on amber';
            if (state !== 'go' && !this.committed) {
                if (stop < brakingDist * 1.25 + 8) {
                    brakeFor = Math.max(stop, 0);
                    this.waitingAtLight = this.v < 1;
                    tactic = this.waitingAtLight ? 'Waiting for green' : 'Stopping for the signal';
                }
                if (toLine < 0) {
                    if (!this.overrun) {
                        this.overrun = true;
                        this.log.overruns++;
                    }
                    this.log.worstOverrun = Math.max(this.log.worstOverrun, -toLine);
                    if (state === 'stop' && toLine < -1.5 && !this.passedLine) {
                        this.log.redLights++;
                        this.passedLine = true;
                    }
                }
            }
        }
        const preview = this.indexAt(this.progress + this.v * 0.6);
        const planned = Math.min(this.speed[Math.min(i + 1, this.speed.length - 1)], this.speed[preview] + 1);
        let want = planned;
        if (tactic === 'Cruising' && planned < p.limit[i] * P.speed - 2) tactic = 'Slowing for a curve';
        const remaining = p.length - this.progress;
        if (remaining < 50) tactic = 'Arriving';
        want = Math.min(want, Math.sqrt(2 * P.brake * Math.max(remaining, 0)));
        if (brakeFor !== Infinity) want = brakeFor < 0.12 ? 0 : Math.min(want, Math.sqrt(2 * P.brake * brakeFor));
        let aeb = false;
        if (gapAhead !== Infinity) {
            const room = Math.max(gapAhead - P.minGap, 0);
            const follow = leadSpeed + (room - this.v * P.headway) * 0.45;
            const before = want;
            want = Math.min(want, Math.max(0, follow), Math.sqrt(2 * 4.5 * room) + leadSpeed);
            if (room < 0.15) want = 0;
            if (want < before - 0.2 && tactic !== 'Waiting for green' && tactic !== 'Stopping for the signal') tactic = 'Following';
            const closing = this.v - leadSpeed, ttc = closing > 0.5 ? gapAhead / closing : Infinity;
            if (ttc < 1.15 && gapAhead < 22) aeb = true;
        }
        const dv = want - this.v;
        let wantAccel = dv > 0 ? Math.min(P.accel, dv * 1.3) : Math.max(-P.brake * 2, dv * 2.2);
        let exact = false;
        if (brakeFor !== Infinity && this.v > 0.05) {
            const need = -(this.v * this.v) / (2 * Math.max(brakeFor, 0.25));
            if (need < -0.3) {
                wantAccel = Math.max(-7, Math.min(wantAccel, need));
                exact = wantAccel < this.accel;
            }
        }
        if (aeb) {
            wantAccel = -9.5;
            exact = true;
            tactic = 'Emergency braking';
            if (this.clock - this.lastAeb > 2) this.log.aeb++;
            this.lastAeb = this.clock;
        }
        this.aebOn = aeb;
        const jerk = P.jerk * dt, hard = wantAccel < this.accel - 3;
        this.accel += exact || hard ? wantAccel - this.accel : Math.max(-jerk, Math.min(jerk, wantAccel - this.accel));
        this.brakeOn = this.accel < -0.5 || this.v < 0.1 && want < 0.1;
        this.v = Math.max(0, this.v + this.accel * dt);
        if (this.v === 0) this.accel = Math.max(0, this.accel);
        const isHard = this.accel < -5;
        if (isHard && !this.wasHard) this.log.hardStops++;
        this.wasHard = isHard;
        if (this.v < 0.06 && brakeFor !== Infinity) {
            if (!this.stoppedHere) {
                this.stoppedHere = true;
                this.log.stops++;
            }
            this.log.waited += dt;
        }
        const fullRate = LANE_W / P.laneTime, gapOff = this.offTarget - this.off;
        const rateWant = Math.max(-fullRate, Math.min(fullRate, gapOff * 1.8));
        this.offRate += Math.max(-fullRate * 2 * dt, Math.min(fullRate * 2 * dt, rateWant - this.offRate));
        if (this.v < 0.5) this.offRate = 0;
        this.off += this.offRate * dt;
        if (Math.abs(this.offTarget - this.off) > 0.3) {
            if (tactic === 'Cruising' || tactic === 'Following') tactic = 'Passing';
        }
        const a = Math.min(i, p.xs.length - 1);
        const tx = Math.sin(p.heading[a]), tz = Math.cos(p.heading[a]);
        const nx = tz, nz = -tx;
        const ex = this.x - p.xs[a], ez = this.z - p.zs[a];
        const error = ex * nx + ez * nz - this.off;
        const slope = this.v > 1 ? Math.atan2(this.offRate, this.v) : 0;
        const headErr = Math.atan2(Math.sin(this.yaw - p.heading[a] - slope), Math.cos(this.yaw - p.heading[a] - slope));
        const speedish = Math.max(this.v, 2);
        const ahead = this.indexAt(this.progress + speedish * 0.22);
        const k = p.curve[ahead] - 1.1 / (speedish * speedish * 0.1 + 2) * error - 1.9 / (speedish * 0.3 + 1.2) * headErr;
        const maxK = 1 / MIN_TURN_RADIUS;
        const steerWant = Math.atan(this.dims.wheelbase * Math.max(-maxK, Math.min(maxK, k)));
        const rate = 2.2 * dt;
        this.steer += Math.max(-rate, Math.min(rate, steerWant - this.steer));
        this.yaw += this.v / this.dims.wheelbase * Math.tan(this.steer) * dt;
        this.x += Math.sin(this.yaw) * this.v * dt;
        this.z += Math.cos(this.yaw) * this.v * dt;
        let bestD = Infinity, bestS = this.progress;
        const ox = nx * this.off, oz = nz * this.off;
        for(let s = Math.max(0, this.progress - 1); s <= Math.min(p.length, this.progress + 6); s += 0.2){
            const q = this.indexAt(s), f = (s - p.cum[q]) / (p.cum[q + 1] - p.cum[q] || 1), hx = q + 1 < p.xs.length ? p.xs[q] + (p.xs[q + 1] - p.xs[q]) * f : p.xs[q], hz = q + 1 < p.zs.length ? p.zs[q] + (p.zs[q + 1] - p.zs[q]) * f : p.zs[q];
            const d = Math.hypot(hx + ox - this.x, hz + oz - this.z);
            if (d < bestD) {
                bestD = d;
                bestS = s;
            }
        }
        this.progress = Math.max(this.progress, bestS);
        if (this.progress > 10 && bestD > this.log.maxError) {
            this.log.maxError = bestD;
            this.log.maxErrorAt = [
                this.x,
                this.z
            ];
        }
        this.check += dt;
        if (onRoad && this.check > 0.5) {
            this.check = 0;
            if (!p.raised[i] && !onRoad(this.x, this.z, 0.4)) {
                this.log.offRoad++;
                if (this.log.offAt.length < 3) this.log.offAt.push([
                    this.x,
                    this.z
                ]);
            }
        }
        this.tactic = tactic;
        this.idle = this.v > 0.3 || gapAhead !== Infinity ? 0 : this.idle + dt;
        if (this.idle > 400) {
            this.log.stuck = true;
            this.done = true;
        }
        if (remaining < 0.7 && this.v < 0.3) this.done = true;
    }
}
export function wanderPath(g, idx, start, metres, rng) {
    const L = g.lanes, E = g.edges, startEdge = L[start]?.edge;
    if (startEdge === undefined || !E[startEdge]) return null;
    const edges = [
        startEdge
    ], seen = new Set([
        startEdge
    ]);
    let e = E[startEdge], total = e.ref.length;
    while(total < metres && edges.length < 80){
        const options = new Map();
        for (const l of e.lanes)for (const c of L[l].next){
            const conn = L[c], t = L[conn.next[0]];
            if (!t || conn.movement === 'uturn') continue;
            const te = E[t.edge];
            if (!te || te.internal || seen.has(te.id) || te.elevated || te.cls !== 'arterial' && te.cls !== 'collector') continue;
            const w = (conn.movement === 'through' ? 12 : 1) * (te.cls === 'arterial' ? 3 : 1);
            options.set(te.id, Math.max(options.get(te.id) ?? 0, w));
        }
        if (!options.size) break;
        let sum = 0;
        for (const w of options.values())sum += w;
        let pick = rng() * sum, next = -1;
        for (const [id, w] of options){
            pick -= w;
            if (pick <= 0) {
                next = id;
                break;
            }
        }
        if (next < 0) next = [
            ...options.keys()
        ][0];
        edges.push(next);
        seen.add(next);
        e = E[next];
        total += e.ref.length;
    }
    if (total < 120) return null;
    const raw = assemble(g, idx, edges, start, null);
    if (!raw || raw.cum.length < 2) return null;
    return finish(g, idx, raw, edges, []);
}
export function laneAt(g, x, z, yaw, reach = 12) {
    const out = [];
    const hx = Math.sin(yaw), hz = Math.cos(yaw);
    for (const l of g.lanes){
        if (l.connector || !l.next.length || g.edges[l.edge]?.internal) continue;
        const P = l.line.pts, a0 = P[0];
        if (Math.abs(a0[0] - x) > 500 || Math.abs(a0[1] - z) > 500) continue;
        for(let i = 0; i + 1 < P.length; i++){
            const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
            const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
            if (d > reach) continue;
            const align = (dx * hx + dz * hz) / Math.sqrt(L2);
            if (align < 0.45) continue;
            out.push([
                l.id,
                d - align * 2
            ]);
            break;
        }
    }
    return out.sort((a, b)=>a[1] - b[1]).slice(0, 6).map((o)=>o[0]);
}
