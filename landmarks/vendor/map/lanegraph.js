// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { convexHull } from './geom.js';
export const CLASS = {
    motorway: 'motorway',
    motorway_link: 'ramp',
    trunk: 'arterial',
    trunk_link: 'ramp',
    primary: 'arterial',
    primary_link: 'collector',
    secondary: 'arterial',
    secondary_link: 'collector',
    tertiary: 'collector',
    tertiary_link: 'collector',
    unclassified: 'local',
    residential: 'local',
    living_street: 'local',
    service: 'service',
    busway: 'service'
};
const DEFAULT_MPH = {
    motorway: 65,
    ramp: 45,
    arterial: 45,
    collector: 35,
    local: 25,
    service: 15
};
export const LANE_W = {
    motorway: 3.7,
    ramp: 3.7,
    arterial: 3.5,
    collector: 3.4,
    local: 3.3,
    service: 3.0
};
export function makeLine(pts, y) {
    const cum = [
        0
    ];
    for(let i = 1; i < pts.length; i++)cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return {
        pts,
        y,
        cum,
        length: cum[cum.length - 1]
    };
}
export function boundaryAt(e, i, at) {
    const base = i * e.laneWidth;
    let d = 0;
    const ease = (t)=>{
        const k = Math.max(0, Math.min(1, t));
        return k * k * (3 - 2 * k);
    };
    if (e.jointStart && e.taperStart) d += (e.jointStart[i] - base) * ease(1 - at / e.taperStart);
    if (e.jointEnd && e.taperEnd) d += (e.jointEnd[i] - base) * ease(1 - (e.ref.length - at) / e.taperEnd);
    return base + d;
}
export function offsetBy(line, f, mitreStart, mitreEnd) {
    const n = line.pts.length, out = [];
    for(let i = 0; i < n; i++){
        const [x, z] = line.pts[i];
        let nx = 0, nz = 0;
        const acc = (a, b)=>{
            const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
            nx += -dz / L;
            nz += dx / L;
        };
        if (i > 0) acc(line.pts[i - 1], line.pts[i]);
        if (i < n - 1) acc(line.pts[i], line.pts[i + 1]);
        const L = Math.hypot(nx, nz) || 1;
        nx /= L;
        nz /= L;
        let k = 1;
        if (i > 0 && i < n - 1) {
            const b = line.pts[i + 1], dx = b[0] - x, dz = b[1] - z, Ld = Math.hypot(dx, dz) || 1;
            k = Math.min(2, 1 / Math.max(0.5, nx * (-dz / Ld) + nz * (dx / Ld)));
        }
        const m = i === 0 ? mitreStart : i === n - 1 ? mitreEnd : undefined;
        if (m) {
            nx = m[0];
            nz = m[1];
            k = 1;
        }
        const d = f(line.cum[i]);
        out.push([
            x + nx * d * k,
            z + nz * d * k
        ]);
    }
    return makeLine(out, line.y.slice());
}
export function boundaryLine(e, i) {
    return edgeLine(e, (at)=>boundaryAt(e, i, at));
}
export function edgeLine(e, f) {
    return offsetBy(e.ref, f, e.mitreStart, e.mitreEnd);
}
function densify(line, a, b, step) {
    const pts = [], y = [];
    for(let i = 0; i < line.pts.length - 1; i++){
        pts.push(line.pts[i]);
        y.push(line.y[i]);
        const s0 = line.cum[i], s1 = line.cum[i + 1], n = Math.ceil((s1 - s0) / step);
        for(let k = 1; k < n; k++){
            const at = s0 + (s1 - s0) * k / n;
            if (at > a && at < b) continue;
            const t = k / n, p = line.pts[i], q = line.pts[i + 1];
            pts.push([
                p[0] + (q[0] - p[0]) * t,
                p[1] + (q[1] - p[1]) * t
            ]);
            y.push(line.y[i] + (line.y[i + 1] - line.y[i]) * t);
        }
    }
    pts.push(line.pts[line.pts.length - 1]);
    y.push(line.y[line.y.length - 1]);
    return makeLine(pts, y);
}
export function offset(line, d) {
    const n = line.pts.length;
    const out = [];
    for(let i = 0; i < n; i++){
        const [x, z] = line.pts[i];
        let nx = 0, nz = 0;
        const acc = (a, b)=>{
            const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
            nx += -dz / L;
            nz += dx / L;
        };
        if (i > 0) acc(line.pts[i - 1], line.pts[i]);
        if (i < n - 1) acc(line.pts[i], line.pts[i + 1]);
        const L = Math.hypot(nx, nz) || 1;
        nx /= L;
        nz /= L;
        let s = 1;
        if (i > 0 && i < n - 1) {
            const b = line.pts[i + 1], dx = b[0] - x, dz = b[1] - z, Ld = Math.hypot(dx, dz) || 1;
            s = Math.min(2, 1 / Math.max(0.5, nx * (-dz / Ld) + nz * (dx / Ld)));
        }
        out.push([
            x + nx * d * s,
            z + nz * d * s
        ]);
    }
    return makeLine(out, line.y.slice());
}
export function sample(line, s) {
    s = Math.max(0, Math.min(line.length, s));
    let lo = 0, hi = line.cum.length - 1;
    while(hi - lo > 1){
        const m = lo + hi >> 1;
        if (line.cum[m] <= s) lo = m;
        else hi = m;
    }
    const L = line.cum[hi] - line.cum[lo];
    const t = L > 1e-6 ? (s - line.cum[lo]) / L : 0;
    const a = line.pts[lo], b = line.pts[hi];
    const dx = b[0] - a[0], dz = b[1] - a[1], D = Math.hypot(dx, dz) || 1;
    return {
        x: a[0] + dx * t,
        z: a[1] + dz * t,
        y: line.y[lo] + (line.y[hi] - line.y[lo]) * t,
        hx: dx / D,
        hz: dz / D
    };
}
function parseTurns(tag, n) {
    if (tag) {
        const parts = tag.split('|');
        while(parts.length > n && parts.filter((p)=>p === 'left').length >= 3 && parts[0] === 'left')parts.shift();
        while(parts.length > n && parts[parts.length - 1] === '')parts.pop();
        if (parts.length === n) {
            return parts.map((p)=>{
                const m = new Set();
                for (const t of p.split(';')){
                    if (/left/.test(t) && !/merge/.test(t)) m.add('left');
                    else if (/right/.test(t) && !/merge/.test(t)) m.add('right');
                    else if (t === 'reverse') m.add('uturn');
                    else if (/merge/.test(t)) m.add('merge');
                    else m.add('through');
                }
                return [
                    ...m
                ];
            });
        }
    }
    return Array.from({
        length: n
    }, (_, i)=>{
        const m = [
            'through'
        ];
        if (i === 0) m.push('left');
        if (i === n - 1) m.push('right');
        return m;
    });
}
export function isPassage(r) {
    if (!r.tn) return false;
    let L = 0;
    for(let i = 1; i < r.pts.length; i++)L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
    return L <= 150;
}
export function isDrivable(r) {
    if (r.tn && !isPassage(r) || !CLASS[r.hw]) return false;
    if (r.hw === 'service' && (r.svc === 'drive-through' || r.svc === 'emergency_access')) return false;
    if (r.access === 'no') return false;
    return true;
}
function joinDanglingEnds(ways) {
    const inflow = new Map(), outflow = new Map();
    const bump = (m, n)=>m.set(n, (m.get(n) ?? 0) + 1);
    for (const w of ways)w.n.forEach((nd, i)=>{
        const first = i === 0, last = i === w.n.length - 1;
        if (w.ow === 1 ? !first : w.ow === -1 ? !last : true) bump(inflow, nd);
        if (w.ow === 1 ? !last : w.ow === -1 ? !first : true) bump(outflow, nd);
    });
    const stranded = (w, atStart, node)=>{
        if (!w.ow) return (inflow.get(node) ?? 0) + (outflow.get(node) ?? 0) <= 2;
        const entering = w.ow === 1 ? atStart : !atStart;
        return entering ? !inflow.get(node) : !outflow.get(node);
    };
    const cell = 40, grid = new Map();
    const entriesOf = new Map();
    const put = (w, i)=>{
        const a = w.pts[i], b = w.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / cell));
        for(let k = 0; k <= n; k++){
            const key = `${Math.floor((a[0] + (b[0] - a[0]) * k / n) / cell)},${Math.floor((a[1] + (b[1] - a[1]) * k / n) / cell)}`;
            if (!grid.has(key)) grid.set(key, []);
            const entry = [
                w,
                i
            ];
            grid.get(key).push(entry);
            if (!entriesOf.has(w)) entriesOf.set(w, []);
            entriesOf.get(w).push(entry);
        }
    };
    for (const w of ways)for(let i = 0; i < w.pts.length - 1; i++)put(w, i);
    let nextId = -1, joined = 0;
    const tryEnd = (w, atStart)=>{
        const i = atStart ? 0 : w.n.length - 1, node = w.n[i];
        if (!stranded(w, atStart, node)) return;
        const p = w.pts[i];
        let best = w.hw === 'service' || w.hw.endsWith('_link') ? 34 : 16;
        let hit = null;
        const cx = Math.floor(p[0] / cell), cz = Math.floor(p[1] / cell);
        for(let a = -2; a <= 2; a++)for(let b = -2; b <= 2; b++)for (const [o, seg] of grid.get(`${cx + a},${cz + b}`) ?? []){
            if (o === w || w.layer !== o.layer) continue;
            const u = o.pts[seg], v = o.pts[seg + 1];
            if (!u || !v || o.y && (o.y[seg] > 1 || o.y[seg + 1] > 1)) continue;
            const dx = v[0] - u[0], dz = v[1] - u[1], t = Math.max(0, Math.min(1, ((p[0] - u[0]) * dx + (p[1] - u[1]) * dz) / (dx * dx + dz * dz || 1)));
            const x = u[0] + dx * t, z = u[1] + dz * t, d = Math.hypot(x - p[0], z - p[1]);
            const needIn = !w.ow || (w.ow === 1 ? atStart : !atStart);
            const L2 = Math.hypot(dx, dz), at = t * L2;
            const endNode = at < 2 ? o.n[seg] : L2 - at < 2 ? o.n[seg + 1] : null;
            if (endNode !== null && !(needIn ? inflow.get(endNode) : outflow.get(endNode))) continue;
            if (d < best) {
                best = d;
                hit = {
                    o,
                    seg,
                    t,
                    x,
                    z
                };
            }
        }
        if (!hit) return;
        const { o, seg } = hit;
        const L = Math.hypot(o.pts[seg + 1][0] - o.pts[seg][0], o.pts[seg + 1][1] - o.pts[seg][1]);
        let target;
        if (hit.t * L < 2) target = o.n[seg];
        else if ((1 - hit.t) * L < 2) target = o.n[seg + 1];
        else {
            target = nextId--;
            o.pts.splice(seg + 1, 0, [
                hit.x,
                hit.z
            ]);
            o.n.splice(seg + 1, 0, target);
            if (o.y) o.y.splice(seg + 1, 0, o.y[seg] + (o.y[seg + 1] - o.y[seg]) * hit.t);
            for (const e of entriesOf.get(o) ?? [])if (e[1] > seg) e[1]++;
            put(o, seg);
            put(o, seg + 1);
        }
        const nx = target;
        if (atStart) {
            w.n.unshift(nx);
            w.pts.unshift([
                hit.x,
                hit.z
            ]);
            if (w.y) w.y.unshift(w.y[0]);
        } else {
            w.n.push(nx);
            w.pts.push([
                hit.x,
                hit.z
            ]);
            if (w.y) w.y.push(w.y[w.y.length - 1]);
        }
        bump(inflow, node);
        bump(outflow, node);
        bump(inflow, nx);
        bump(outflow, nx);
        joined++;
    };
    for (const w of ways){
        tryEnd(w, true);
        tryEnd(w, false);
    }
    return joined;
}
export function buildLaneGraph(data) {
    const inheritedLanes = new Map();
    {
        const at = new Map();
        for (const r of data.roads)for (const n of [
            r.n[0],
            r.n[r.n.length - 1]
        ]){
            const l = at.get(n);
            if (l) l.push(r);
            else at.set(n, [
                r
            ]);
        }
        for(let pass = 0; pass < 4; pass++)for (const r of data.roads){
            if (r.lanes !== undefined || inheritedLanes.has(r.id) || !r.name) continue;
            let n = Infinity;
            for (const end of [
                r.n[0],
                r.n[r.n.length - 1]
            ])for (const o of at.get(end) ?? []){
                if (o === r || o.name !== r.name || !!o.ow !== !!r.ow) continue;
                n = Math.min(n, o.lanes ?? inheritedLanes.get(o.id) ?? Infinity);
            }
            if (n !== Infinity) inheritedLanes.set(r.id, n);
        }
    }
    const ways = data.roads.filter(isDrivable);
    joinDanglingEnds(ways);
    const use = new Map();
    for (const w of ways)w.n.forEach((nd, i)=>use.set(nd, (use.get(nd) ?? 0) + (i === 0 || i === w.n.length - 1 ? 1 : 2)));
    const edges = [];
    const lanes = [];
    const nodes = new Map();
    const nodeAt = (id, p, y)=>{
        let n = nodes.get(id);
        if (!n) nodes.set(id, n = {
            id,
            x: p[0],
            z: p[1],
            y,
            inEdges: [],
            outEdges: []
        });
        return n;
    };
    for (const w of ways){
        const cuts = [
            0
        ];
        for(let i = 1; i < w.n.length - 1; i++)if ((use.get(w.n[i]) ?? 0) > 2) cuts.push(i);
        cuts.push(w.n.length - 1);
        const cls = CLASS[w.hw];
        const mph = w.mph ?? DEFAULT_MPH[cls];
        const ys = w.y ?? w.pts.map(()=>0);
        for(let c = 0; c < cuts.length - 1; c++){
            const a = cuts[c], b = cuts[c + 1];
            const pts = w.pts.slice(a, b + 1), y = ys.slice(a, b + 1);
            if (pts.length < 2) continue;
            const rawTurn = w.ow === 1 ? w.turn ?? w.tf : w.ow === -1 ? w.turn ?? w.tb : undefined;
            const turnCount = rawTurn ? rawTurn.split('|').length : undefined;
            const known = w.lanes ?? inheritedLanes.get(w.id);
            const turnInflatedByEmptyPipe = !!(rawTurn && w.lanes !== undefined && rawTurn.endsWith('||'));
            const total = (turnCount && known && turnCount > known && !turnInflatedByEmptyPipe ? turnCount : known) ?? turnCount ?? (w.ow ? cls === 'service' ? 1 : cls === 'ramp' ? 1 : 2 : cls === 'arterial' ? 4 : 2);
            let laneW = LANE_W[cls];
            if (w.w && total > 0) laneW = Math.min(4.2, Math.max(2.8, w.w / total));
            let dirs;
            const rev = ()=>pts.slice().reverse();
            if (w.ow === 1) dirs = [
                {
                    pts,
                    y,
                    n: total,
                    turn: w.turn ?? w.tf,
                    from: w.n[a],
                    to: w.n[b]
                }
            ];
            else if (w.ow === -1) dirs = [
                {
                    pts: rev(),
                    y: y.slice().reverse(),
                    n: total,
                    turn: w.turn ?? w.tb,
                    from: w.n[b],
                    to: w.n[a]
                }
            ];
            else {
                const nf = w.lf ?? Math.max(1, Math.floor(total / 2));
                const nb = w.lb ?? Math.max(1, total - nf - (total % 2 === 1 && total >= 3 && !w.lf ? 1 : 0));
                dirs = [
                    {
                        pts,
                        y,
                        n: nf,
                        turn: w.tf,
                        from: w.n[a],
                        to: w.n[b]
                    },
                    {
                        pts: rev(),
                        y: y.slice().reverse(),
                        n: nb,
                        turn: w.tb,
                        from: w.n[b],
                        to: w.n[a]
                    }
                ];
            }
            const made = [];
            const centre = !w.ow && total % 2 === 1 && total >= 3 && !w.lf ? laneW / 2 : 0;
            for (const d of dirs){
                const oneway = !!w.ow;
                const base = makeLine(d.pts, d.y);
                const ref = oneway ? offset(base, -(d.n * laneW) / 2) : centre ? offset(base, centre) : base;
                const e = {
                    id: edges.length,
                    way: w,
                    cls,
                    fromNode: d.from,
                    toNode: d.to,
                    ref,
                    lanes: [],
                    laneWidth: laneW,
                    mph,
                    turns: parseTurns(d.turn, d.n),
                    explicitTurns: !!d.turn,
                    oneway,
                    elevated: d.y.some((v)=>v > 0.4)
                };
                edges.push(e);
                made.push(e.id);
                nodeAt(d.from, d.pts[0], d.y[0]).outEdges.push(e.id);
                nodeAt(d.to, d.pts[d.pts.length - 1], d.y[d.y.length - 1]).inEdges.push(e.id);
                for(let i = 0; i < d.n; i++){
                    const lane = {
                        id: lanes.length,
                        edge: e.id,
                        index: i,
                        line: offset(ref, (i + 0.5) * laneW),
                        width: laneW,
                        next: [],
                        prev: [],
                        connector: false,
                        movement: 'through'
                    };
                    lanes.push(lane);
                    e.lanes.push(lane.id);
                }
                e.lanes.forEach((lid, i)=>{
                    if (i > 0) lanes[lid].left = e.lanes[i - 1];
                    if (i < e.lanes.length - 1) lanes[lid].right = e.lanes[i + 1];
                });
            }
            if (made.length === 2) {
                edges[made[0]].twin = made[1];
                edges[made[1]].twin = made[0];
            }
        }
    }
    for(let pass = 0; pass < 2; pass++)for (const e of edges){
        if (e.ref.length > 45 || (e.way.turn ?? e.way.tf)) continue;
        const preds = (nodes.get(e.fromNode)?.inEdges ?? []).map((i)=>edges[i]).filter((p)=>(p.way.turn || p.way.tf) && p.lanes.length === e.lanes.length && p.twin !== e.id);
        const same = preds.filter((p)=>{
            if (p.way.name && e.way.name && p.way.name !== e.way.name) return false;
            const a = p.ref.pts, b = e.ref.pts, ax = a[a.length - 1][0] - a[a.length - 2][0], az = a[a.length - 1][1] - a[a.length - 2][1], bx = b[1][0] - b[0][0], bz = b[1][1] - b[0][1];
            return (ax * bx + az * bz) / ((Math.hypot(ax, az) || 1) * (Math.hypot(bx, bz) || 1)) > 0.7;
        });
        if (same.length === 1) {
            e.turns = same[0].turns.map((t)=>[
                    ...t
                ]);
            e.explicitTurns = true;
        }
    }
    const heading = (l, start)=>{
        const i = start ? 0 : l.pts.length - 2;
        const a = l.pts[i], b = l.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        return [
            dx / L,
            dz / L
        ];
    };
    const isSideBranch = (e, hx, hz, out, mainIsLink)=>{
        if (e.cls === 'service') return true;
        if (!mainIsLink && e.cls !== 'ramp' && /_link$/.test(e.way.hw) && e.oneway) {
            const [ex, ez] = heading(e.ref, out);
            const cross = hx * ez - hz * ex;
            return hx * ex + hz * ez > 0.35 && (out ? cross > 0.05 : cross < -0.05);
        }
        return false;
    };
    const pedSigNodes = new Set(data.crossings.filter((c)=>/traffic_signals/.test(c.k ?? '')).map((c)=>c.id));
    for (const node of nodes.values()){
        for (const inId of node.inEdges){
            const A = edges[inId];
            const outs = node.outEdges.filter((o)=>edges[o].twin !== inId);
            if (!outs.length) continue;
            let B;
            if (outs.length === 1) {
                const cand = edges[outs[0]];
                if (node.inEdges.filter((i)=>edges[i].twin !== cand.id).length === 1) B = cand;
            }
            if (!B && A.cls !== 'service' && A.cls !== 'local' && !pedSigNodes.has(node.id)) {
                const aLink = /_link$/.test(A.way.hw);
                const [ax, az] = heading(A.ref, false);
                const mainOuts = outs.filter((o)=>{
                    const eo = edges[o];
                    return eo.cls === A.cls && /_link$/.test(eo.way.hw) === aLink && eo.oneway === A.oneway;
                });
                if (mainOuts.length === 1) {
                    const cand = edges[mainOuts[0]];
                    const [bx, bz] = heading(cand.ref, true);
                    const otherOuts = outs.filter((o)=>o !== cand.id);
                    const otherIns = node.inEdges.filter((i)=>i !== A.id && edges[i].twin !== cand.id);
                    if (otherOuts.every((o)=>isSideBranch(edges[o], ax, az, true, aLink)) && otherIns.every((i)=>isSideBranch(edges[i], bx, bz, false, aLink))) {
                        B = cand;
                    }
                }
            }
            if (!B || A.id === B.id) continue;
            const [ax, az] = heading(A.ref, false), [bx, bz] = heading(B.ref, true);
            if (ax * bx + az * bz < Math.cos(32 * Math.PI / 180) || A.oneway !== B.oneway) continue;
            A.next = B.id;
            B.prev = A.id;
        }
    }
    for (const A of edges){
        if (A.next === undefined) continue;
        const B = edges[A.next];
        const [ax, az] = heading(A.ref, false), [bx, bz] = heading(B.ref, true);
        let tx = ax + bx, tz = az + bz;
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl;
        tz /= tl;
        const pa = A.ref.pts[A.ref.pts.length - 1], pb = B.ref.pts[0];
        const r = ((pb[0] - pa[0]) * tx + (pb[1] - pa[1]) * tz) / 2;
        A.ref.pts[A.ref.pts.length - 1] = [
            pa[0] + tx * r,
            pa[1] + tz * r
        ];
        B.ref.pts[0] = [
            pb[0] - tx * r,
            pb[1] - tz * r
        ];
        A.ref = makeLine(A.ref.pts, A.ref.y);
        B.ref = makeLine(B.ref.pts, B.ref.y);
        const cos = Math.max(0.85, tx * ax + tz * az);
        const m = [
            -tz / cos,
            tx / cos
        ];
        A.mitreEnd = m;
        B.mitreStart = m;
    }
    const tapered = new Set();
    const oneways = new Map();
    for (const e of edges){
        if (!e.oneway || e.cls !== 'arterial' && e.cls !== 'collector') continue;
        for (const p of e.ref.pts){
            const k = `${Math.floor(p[0] / 40)},${Math.floor(p[1] / 40)}`;
            const l = oneways.get(k);
            if (!l) oneways.set(k, [
                e
            ]);
            else if (l[l.length - 1] !== e) l.push(e);
        }
    }
    const medianRoom = (e)=>{
        let room = 40;
        for (const d of [
            0.02,
            0.25,
            0.5,
            0.75,
            0.98
        ]){
            const m = sample(e.ref, e.ref.length * d), nx = -m.hz, nz = m.hx, cx = Math.floor(m.x / 40), cz = Math.floor(m.z / 40);
            for(let i = -1; i <= 1; i++)for(let j = -1; j <= 1; j++)for (const o of oneways.get(`${cx + i},${cz + j}`) ?? []){
                if (o === e) continue;
                const pts = o.ref.pts;
                for(let k = 0; k + 1 < pts.length; k++){
                    const a = pts[k], b = pts[k + 1], sx = b[0] - a[0], sz = b[1] - a[1], L2 = sx * sx + sz * sz || 1;
                    if (sx * m.hx + sz * m.hz > -0.5 * Math.sqrt(L2)) continue;
                    const t = Math.max(0, Math.min(1, ((m.x - a[0]) * sx + (m.z - a[1]) * sz) / L2));
                    const dx = a[0] + sx * t - m.x, dz = a[1] + sz * t - m.z, side = dx * nx + dz * nz;
                    if (side < 0 && Math.abs(dx * m.hx + dz * m.hz) < 30) room = Math.min(room, -side);
                }
            }
        }
        return room;
    };
    for (const A of edges){
        if (A.next === undefined) continue;
        const B = edges[A.next];
        const nA = A.lanes.length, nB = B.lanes.length;
        const pa = sample(A.ref, A.ref.length), pb = sample(B.ref, 0);
        const wideIsA = nA > nB || nA === nB && A.ref.length >= B.ref.length;
        const W = wideIsA ? A : B, N = wideIsA ? B : A;
        const pw = wideIsA ? pa : pb, pn = wideIsA ? pb : pa;
        const nW = W.lanes.length, nN = N.lanes.length, extra = nW - nN;
        const mj = wideIsA ? A.mitreEnd : B.mitreStart;
        const mj2 = mj[0] * mj[0] + mj[1] * mj[1];
        let D = ((pn.x - pw.x) * mj[0] + (pn.z - pw.z) * mj[1]) / mj2;
        if (Math.abs(D) > 9 || extra > 3) continue;
        const right = (t)=>!!t && t.length === 1 && t[0] === 'right';
        const left = (t)=>!!t && t.length === 1 && t[0] === 'left';
        const countLeft = (e)=>{
            const idx = e.turns.findIndex((t)=>!left(t));
            return idx < 0 ? left(e.turns[0]) ? e.lanes.length : 0 : idx;
        };
        const countRight = (e)=>{
            let c = 0;
            for(let i = e.lanes.length - 1; i >= 0; i--){
                if (right(e.turns[i])) c++;
                else break;
            }
            return c;
        };
        const jNode = nodes.get(A.toNode);
        const hasSlipAtJoint = [
            ...jNode.inEdges,
            ...jNode.outEdges
        ].some((ei)=>ei !== A.id && ei !== B.id && edges[ei].twin !== A.id && edges[ei].twin !== B.id && /_link$/.test(edges[ei].way.hw));
        const onRight = !W.oneway || right(W.turns[nW - 1]) && !left(W.turns[0]);
        const leftW = countLeft(W), leftN = countLeft(N), rightW = countRight(W), rightN = countRight(N);
        const tagged = W.turns.some((t)=>left(t) || right(t));
        const nTagged = N.turns.some((t)=>left(t) || right(t));
        const skip = !W.oneway ? 0 : hasSlipAtJoint ? Math.min(extra, Math.max(0, leftW - leftN)) : tagged && nTagged ? rightW > rightN && leftW <= leftN ? 0 : Math.min(extra, Math.max(0, leftW - leftN)) : tagged ? Math.min(extra, leftW) : onRight ? 0 : extra;
        if (extra > 0 && W.oneway && pw.y < 3 && (wideIsA ? A.prev : B.next) === undefined) {
            let S = D - skip * W.laneWidth;
            if (S < 0) S = -Math.min(-S, Math.max(0, medianRoom(W) - 1));
            if (Math.abs(S) > 0.05) {
                W.ref = makeLine(offsetBy(W.ref, ()=>S, W.mitreStart, W.mitreEnd).pts, W.ref.y);
                D -= S;
            }
        } else if (extra > 0 && N.oneway && pn.y < 3) {
            const chain = [];
            let cur = N, len = 0;
            while(cur && cur.lanes.length === nN && len + cur.ref.length < 75 && chain.length < 2){
                chain.push(cur);
                len += cur.ref.length;
                const nxtId = wideIsA ? cur.next : cur.prev;
                cur = nxtId !== undefined ? edges[nxtId] : undefined;
            }
            if (!cur && chain.length) {
                let S = D - skip * W.laneWidth;
                if (-S < 0) {
                    const room = Math.min(...chain.map((e)=>Math.max(0, medianRoom(e) - 1)));
                    S = Math.min(S, room);
                }
                if (Math.abs(S) > 0.05) {
                    for (const e of chain)e.ref = makeLine(offsetBy(e.ref, ()=>-S, e.mitreStart, e.mitreEnd).pts, e.ref.y);
                    D -= S;
                }
            }
        }
        const joint = Array.from({
            length: nW + 1
        }, (_, i)=>D + Math.max(0, hasSlipAtJoint && skip === 0 ? i - skip : Math.min(nN, i - skip)) * N.laneWidth);
        const moved = joint.some((v, i)=>Math.abs(v - i * W.laneWidth) > 0.04);
        const map = Array.from({
            length: nA
        }, (_, i)=>nA >= nB ? i - skip >= 0 && i - skip < nB ? i - skip : -1 : i + skip);
        A.laneMap = map;
        if (!moved) continue;
        const move = Math.max(...joint.map((v, i)=>Math.abs(v - i * W.laneWidth)));
        const want = Math.max(36, Math.min(move * (W.cls === 'motorway' || W.cls === 'ramp' ? 28 : 16), W.cls === 'motorway' || W.cls === 'ramp' ? 400 : 110));
        const hasOtherTaper = wideIsA ? !!A.taperStart : !!B.taperEnd;
        const maxLen = W.ref.length * (hasOtherTaper ? 0.48 : 0.9);
        if ((W.cls === 'arterial' || W.cls === 'collector') && move > maxLen * 0.125) {
            const scale = maxLen * 0.125 / move;
            for(let i = 0; i <= nW; i++)joint[i] = i * W.laneWidth + (joint[i] - i * W.laneWidth) * scale;
        }
        if (wideIsA) {
            A.jointEnd = joint;
            A.taperEnd = want;
        } else {
            B.jointStart = joint;
            B.taperStart = want;
        }
        tapered.add(W);
    }
    for (const e of tapered){
        const L = e.ref.length, both = e.taperStart && e.taperEnd;
        if (e.taperStart) {
            e.taperStart = Math.min(e.taperStart, both ? L * 0.48 : L * 0.9);
            if ((e.cls === 'arterial' || e.cls === 'collector') && e.jointStart) {
                const mv = Math.max(...e.jointStart.map((v, i)=>Math.abs(v - i * e.laneWidth)));
                if (mv > e.taperStart * 0.125) {
                    const sc = e.taperStart * 0.125 / mv;
                    e.jointStart = e.jointStart.map((v, i)=>i * e.laneWidth + (v - i * e.laneWidth) * sc);
                }
            }
        }
        if (e.taperEnd) {
            e.taperEnd = Math.min(e.taperEnd, both ? L * 0.48 : L * 0.9);
            if ((e.cls === 'arterial' || e.cls === 'collector') && e.jointEnd) {
                const mv = Math.max(...e.jointEnd.map((v, i)=>Math.abs(v - i * e.laneWidth)));
                if (mv > e.taperEnd * 0.125) {
                    const sc = e.taperEnd * 0.125 / mv;
                    e.jointEnd = e.jointEnd.map((v, i)=>i * e.laneWidth + (v - i * e.laneWidth) * sc);
                }
            }
        }
        e.ref = densify(e.ref, e.taperStart ?? 0, L - (e.taperEnd ?? 0), 3);
    }
    for (const e of edges){
        if (e.next === undefined && e.prev === undefined) continue;
        e.lanes.forEach((id, i)=>{
            lanes[id].line = edgeLine(e, (at)=>(boundaryAt(e, i, at) + boundaryAt(e, i + 1, at)) / 2);
        });
    }
    const connectorLine = (a, b)=>{
        const pa = sample(a.line, a.line.length), pb = sample(b.line, 0);
        const dist = Math.hypot(pb.x - pa.x, pb.z - pa.z);
        const pts = [], y = [];
        if (dist < 0.05) {
            pts.push([
                pa.x,
                pa.z
            ], [
                pa.x + pa.hx * 0.05,
                pa.z + pa.hz * 0.05
            ]);
            y.push(pa.y, pa.y);
        } else {
            const k = dist * 0.42, steps = Math.max(2, Math.min(16, Math.ceil(dist / 2.5)));
            for(let i = 0; i <= steps; i++){
                const t = i / steps, u = 1 - t;
                const bx = (p0, p1, p2, p3)=>u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
                pts.push([
                    bx(pa.x, pa.x + pa.hx * k, pb.x - pb.hx * k, pb.x),
                    bx(pa.z, pa.z + pa.hz * k, pb.z - pb.hz * k, pb.z)
                ]);
                y.push(pa.y + (pb.y - pa.y) * t);
            }
        }
        return makeLine(pts, y);
    };
    const connect = (fromLane, toLane, mv, node)=>{
        const a = lanes[fromLane], b = lanes[toLane];
        const conn = {
            id: lanes.length,
            edge: -1,
            index: 0,
            line: connectorLine(a, b),
            width: Math.min(a.width, b.width),
            next: [
                toLane
            ],
            prev: [
                fromLane
            ],
            connector: true,
            movement: mv,
            node
        };
        lanes.push(conn);
        a.next.push(conn.id);
        b.prev.push(conn.id);
    };
    for (const node of nodes.values()){
        for (const inId of node.inEdges){
            const ein = edges[inId];
            if (!ein.lanes.length) continue;
            const [hx, hz] = heading(ein.ref, false);
            const outs = [];
            let hairpin = null;
            for (const outId of node.outEdges){
                const eo = edges[outId];
                if (eo.twin === inId) continue;
                const [ox, oz] = heading(eo.ref, true);
                const ang = Math.atan2(hx * oz - hz * ox, hx * ox + hz * oz) * 180 / Math.PI;
                const isBranchOffThru = ein.next !== undefined && eo.id !== ein.next;
                const mv = Math.abs(ang) > 155 ? 'uturn' : isBranchOffThru ? ang >= -5 ? 'right' : 'left' : Math.abs(ang) < 35 ? 'through' : ang > 0 ? 'right' : 'left';
                if (mv !== 'uturn') outs.push({
                    e: eo,
                    mv
                });
                else hairpin = eo;
            }
            if (!outs.length && hairpin) outs.push({
                e: hairpin,
                mv: 'uturn'
            });
            if (!outs.length && ein.twin !== undefined && !edges[ein.twin].elevated) outs.push({
                e: edges[ein.twin],
                mv: 'uturn'
            });
            if (!outs.length) continue;
            const single = outs.length === 1;
            const avail = new Set(outs.map((o)=>o.mv));
            for (const o of outs){
                let src = ein.lanes.filter((_, i)=>{
                    const al = ein.turns[i];
                    return single || al.includes(o.mv) || o.mv === 'through' && (al.includes('merge') || !al.some((m)=>avail.has(m)));
                });
                if (!src.length) src = [
                    o.mv === 'left' ? ein.lanes[0] : ein.lanes[ein.lanes.length - 1]
                ];
                const dst = o.e.lanes, ns = src.length, nd = dst.length;
                if (!nd) continue;
                const goesOn = (e)=>{
                    const l = e.lanes.filter((_, i)=>e.turns[i].includes('through') || e.turns[i].includes('merge'));
                    return l.length ? l : e.lanes;
                };
                const thruIn = o.mv === 'through' ? goesOn(ein) : [], thruOut = o.mv === 'through' ? goesOn(o.e) : [];
                let thruShift = 0;
                if (thruIn.length) {
                    let bestGap = Infinity;
                    const lo = Math.min(0, thruOut.length - thruIn.length), hi = Math.max(0, thruOut.length - thruIn.length);
                    for(let off = lo; off <= hi; off++){
                        let gap = 0;
                        thruIn.forEach((l, q)=>{
                            const a = lanes[l].line, b = lanes[thruOut[Math.max(0, Math.min(thruOut.length - 1, q + off))]].line, pa = a.pts[a.pts.length - 1], pb = b.pts[0];
                            gap += Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
                        });
                        if (gap < bestGap) {
                            bestGap = gap;
                            thruShift = off;
                        }
                    }
                }
                for(let k = 0; k < ns; k++){
                    let j;
                    if (o.mv === 'left') j = Math.min(k, nd - 1);
                    else if (o.mv === 'right') j = Math.max(0, nd - ns + k);
                    else if (ein.next === o.e.id && ein.laneMap) {
                        j = ein.laneMap[ein.lanes.indexOf(src[k])];
                        if (j < 0) j = ein.lanes.indexOf(src[k]) < ein.laneMap.findIndex((v)=>v >= 0) ? 0 : nd - 1;
                    } else if (o.mv === 'through' && thruIn.includes(src[k])) {
                        j = dst.indexOf(thruOut[Math.max(0, Math.min(thruOut.length - 1, thruIn.indexOf(src[k]) + thruShift))]);
                    } else if (o.mv === 'through' && thruIn.length && thruOut.length) {
                        const me = ein.lanes.indexOf(src[k]), first = ein.lanes.indexOf(thruIn[0]), last = ein.lanes.indexOf(thruIn[thruIn.length - 1]);
                        const edge = me < first ? dst.indexOf(thruOut[Math.max(0, thruShift)]) + (me - first) : dst.indexOf(thruOut[Math.min(thruOut.length - 1, thruIn.length - 1 + thruShift)]) + (me - last);
                        j = Math.max(0, Math.min(nd - 1, edge));
                    } else {
                        j = nd - (ein.lanes.length - ein.lanes.indexOf(src[k]));
                        if (j < 0) j = single || ns === 1 ? 0 : -1;
                    }
                    if (j >= 0) connect(src[k], dst[j], o.mv, node.id);
                }
            }
        }
        const tidy = ()=>{
            const groups = new Map();
            for (const inId of node.inEdges)for (const l of edges[inId].lanes)for (const c of lanes[l].next){
                const to = lanes[c].next[0];
                if (lanes[c].movement !== 'through' || lanes[to].edge < 0) continue;
                const k = `${inId},${lanes[to].edge}`;
                const g = groups.get(k);
                if (g) g.push(c);
                else groups.set(k, [
                    c
                ]);
            }
            for (const [k, list] of groups){
                if (list.length < 2) continue;
                const [inId, outId] = k.split(',').map(Number);
                const srcAt = (c)=>edges[inId].lanes.indexOf(lanes[c].prev[0]), dstAt = (c)=>edges[outId].lanes.indexOf(lanes[c].next[0]);
                const bySrc = list.slice().sort((a, b)=>srcAt(a) - srcAt(b));
                const targets = bySrc.map(dstAt).sort((a, b)=>a - b);
                bySrc.forEach((c, i)=>{
                    const was = dstAt(c), want = targets[i];
                    if (was === want) return;
                    const a = lanes[lanes[c].prev[0]], oldTo = lanes[lanes[c].next[0]], newTo = lanes[edges[outId].lanes[want]];
                    oldTo.prev = oldTo.prev.filter((v)=>v !== c);
                    newTo.prev.push(c);
                    lanes[c].next = [
                        newTo.id
                    ];
                    lanes[c].line = connectorLine(a, newTo);
                });
            }
        };
        const nearest = (list, i, has)=>{
            for(let d = 1; d < list.length; d++)for (const k of [
                i - d,
                i + d
            ])if (k >= 0 && k < list.length && has(list[k])) return list[k];
            return -1;
        };
        for (const inId of node.inEdges){
            const ls = edges[inId].lanes;
            ls.forEach((l, i)=>{
                if (lanes[l].next.length) return;
                const n = nearest(ls, i, (o)=>lanes[o].next.some((c)=>lanes[c].connector));
                if (n < 0) return;
                const via = lanes[lanes[n].next[0]], to = via.next[0];
                connect(l, to, via.movement ?? 'through', node.id);
            });
        }
        for (const outId of node.outEdges){
            const ls = edges[outId].lanes;
            ls.forEach((l, i)=>{
                if (lanes[l].prev.length) return;
                const n = nearest(ls, i, (o)=>lanes[o].prev.some((c)=>lanes[c].connector));
                if (n < 0) return;
                const via = lanes[lanes[n].prev[0]], from = via.prev[0];
                connect(from, l, via.movement ?? 'through', node.id);
            });
        }
        tidy();
    }
    return {
        edges,
        lanes,
        nodes
    };
}
const masks = new WeakMap();
const airMasks = new WeakMap();
const fillets = new WeakMap();
export function cornerFillets(g) {
    const had = fillets.get(g);
    if (had && had.n === g.lanes.length) return had.list;
    const list = [], L = g.lanes, REACH = 10, seen = new Set();
    const minor = (id)=>{
        const c = g.edges[L[id].edge]?.cls;
        return c === 'service' || c === 'local';
    };
    for (const c of L){
        if (!c.connector || !c.prev.length || !c.next.length || c.line.y.some((v)=>v > 2.5)) continue;
        const before = c.prev[0], first = c.next[0];
        if (!minor(before) && !minor(first)) continue;
        if (L[before].line.y.some((v)=>v > 2.5) || L[first].line.y.some((v)=>v > 2.5)) continue;
        const pts = [];
        const back = L[before].line;
        for(let i = back.pts.length - 1, got = 0; i >= 0 && got < REACH; i--){
            pts.unshift(back.pts[i]);
            if (i > 0) got += Math.hypot(back.pts[i][0] - back.pts[i - 1][0], back.pts[i][1] - back.pts[i - 1][1]);
        }
        pts.push(...c.line.pts);
        let lane = first, got = 0;
        for(let hops = 0; hops < 8 && got < REACH; hops++){
            const line = L[lane].line;
            for(let i = 0; i < line.pts.length && got < REACH; i++){
                const q = pts[pts.length - 1], p = line.pts[i];
                got += Math.hypot(p[0] - q[0], p[1] - q[1]);
                pts.push(p);
            }
            const on = L[lane].next[0];
            if (on === undefined) break;
            lane = on;
        }
        const a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], chord = Math.hypot(dx, dz) || 1;
        let depth = 0;
        for (const p of pts)depth = Math.max(depth, Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / chord);
        if (depth < 1 || depth > 9 || chord > 34) continue;
        const k = `${Math.round(a[0])},${Math.round(a[1])},${Math.round(b[0])},${Math.round(b[1])}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const hull = convexHull(pts);
        if (hull.length >= 3) list.push(hull);
    }
    fillets.set(g, {
        n: L.length,
        list
    });
    return list;
}
export function roadMask(g, withRaised = false) {
    const store = withRaised ? airMasks : masks, had = store.get(g);
    if (had && had.n === g.lanes.length) return had.test;
    const CELL = 24, grid = new Map();
    const key = (i, j)=>(i + 4096) * 8192 + (j + 4096);
    const ls = g.lanes;
    for(let id = 0; id < ls.length; id++){
        const l = ls[id];
        if (!withRaised && l.line.y.some((v)=>v > 2.5)) continue;
        let last = -1;
        const pts = l.raw ? [
            ...l.line.pts,
            ...l.raw.pts
        ] : l.line.pts;
        for(let k = 0; k < pts.length; k++){
            const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL * 0.5)) || 1;
            for(let t = 0; t <= n; t++){
                const c = key(Math.floor((a[0] + (b[0] - a[0]) * t / n) / CELL), Math.floor((a[1] + (b[1] - a[1]) * t / n) / CELL));
                if (c === last) continue;
                last = c;
                const cell = grid.get(c);
                if (!cell) grid.set(c, [
                    id
                ]);
                else if (cell[cell.length - 1] !== id) cell.push(id);
            }
        }
    }
    const hullGrid = new Map();
    for (const h of [
        ...g.hulls ?? [],
        ...cornerFillets(g)
    ]){
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const p of h){
            x0 = Math.min(x0, p[0]);
            x1 = Math.max(x1, p[0]);
            z0 = Math.min(z0, p[1]);
            z1 = Math.max(z1, p[1]);
        }
        for(let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)for(let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++){
            const k = key(i, j), l = hullGrid.get(k);
            if (l) l.push(h);
            else hullGrid.set(k, [
                h
            ]);
        }
    }
    const inHull = (h, x, z)=>{
        let c = false;
        for(let i = 0, j = h.length - 1; i < h.length; j = i++){
            const a = h[i], b = h[j];
            if (a[1] > z !== b[1] > z && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
        }
        return c;
    };
    const test = (x, z, margin = 0.8)=>{
        for (const h of hullGrid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [])if (inHull(h, x, z)) return true;
        const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
        for(let i = -1; i <= 1; i++)for(let j = -1; j <= 1; j++){
            const cell = grid.get(key(ci + i, cj + j));
            if (!cell) continue;
            for (const id of cell){
                const l = ls[id], r = l.width / 2 + margin;
                for (const pts of l.raw ? [
                    l.line.pts,
                    l.raw.pts
                ] : [
                    l.line.pts
                ])for(let k = 0; k + 1 < pts.length; k++){
                    const a = pts[k], b = pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
                    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
                    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < r) return true;
                }
            }
        }
        return false;
    };
    store.set(g, {
        n: g.lanes.length,
        test
    });
    return test;
}
