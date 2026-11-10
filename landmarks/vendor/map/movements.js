// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { convexHull } from './geom.js';
import { makeLine, sample } from './lanegraph.js';
function trim(line, s0, s1) {
    const a = sample(line, s0), b = sample(line, s1), pts = [
        [
            a.x,
            a.z
        ]
    ], y = [
        a.y
    ];
    for(let i = 0; i < line.pts.length; i++){
        if (line.cum[i] <= s0 + 0.01 || line.cum[i] >= s1 - 0.01) continue;
        pts.push(line.pts[i]);
        y.push(line.y[i]);
    }
    pts.push([
        b.x,
        b.z
    ]);
    y.push(b.y);
    return makeLine(pts, y);
}
export function movementLine(a, b) {
    const pa = sample(a.line, a.line.length), pb = sample(b.line, 0);
    const dx = pb.x - pa.x, dz = pb.z - pa.z, dist = Math.hypot(dx, dz);
    if (dist < 0.05) return makeLine([
        [
            pa.x,
            pa.z
        ],
        [
            pa.x + pa.hx * 0.05,
            pa.z + pa.hz * 0.05
        ]
    ], [
        pa.y,
        pa.y
    ]);
    const cross = pa.hx * pb.hz - pa.hz * pb.hx, dot = pa.hx * pb.hx + pa.hz * pb.hz;
    const wide = dot < -0.5 ? 0.68 : dot < 0 ? 0.5 : 0.42;
    let t1 = dist * wide, t2 = dist * wide;
    if (Math.abs(cross) > 0.08) {
        const t = (dx * pb.hz - dz * pb.hx) / cross, u = -(dx * pa.hz - dz * pa.hx) / cross;
        if (t > 0 && u > 0 && t < dist * 3 && u < dist * 3) {
            const theta = Math.atan2(Math.abs(cross), dot), T = Math.min(t, u), R = T / Math.tan(theta / 2);
            if (R >= 4.55) {
                const side = cross > 0 ? 1 : -1, nx = -pa.hz * side, nz = pa.hx * side;
                const sx = pa.x + pa.hx * (t - T), sz = pa.z + pa.hz * (t - T), cx = sx + nx * R, cz = sz + nz * R;
                const pts = [
                    [
                        pa.x,
                        pa.z
                    ]
                ];
                if (t - T > 0.05) pts.push([
                    sx,
                    sz
                ]);
                const n = Math.max(3, Math.min(24, Math.ceil(R * theta / 1.4)));
                for(let i = 1; i <= n; i++){
                    const ang = i / n * theta * side, co = Math.cos(ang), si = Math.sin(ang), rx = sx - cx, rz = sz - cz;
                    pts.push([
                        cx + rx * co - rz * si,
                        cz + rx * si + rz * co
                    ]);
                }
                if (u - T > 0.05) pts.push([
                    pb.x,
                    pb.z
                ]);
                else pts[pts.length - 1] = [
                    pb.x,
                    pb.z
                ];
                const y = pts.map((_, i)=>pa.y + (pb.y - pa.y) * i / (pts.length - 1));
                return makeLine(pts, y);
            }
            t1 = Math.max(t * 0.6, dist * 0.36);
            t2 = Math.max(u * 0.6, dist * 0.36);
        }
    }
    const steps = Math.max(3, Math.min(28, Math.ceil(dist / 1.6))), pts = [], y = [];
    for(let i = 0; i <= steps; i++){
        const t = i / steps, v = 1 - t;
        const bez = (p0, p1, p2, p3)=>v * v * v * p0 + 3 * v * v * t * p1 + 3 * v * t * t * p2 + t * t * t * p3;
        pts.push([
            bez(pa.x, pa.x + pa.hx * t1, pb.x - pb.hx * t2, pb.x),
            bez(pa.z, pa.z + pa.hz * t1, pb.z - pb.hz * t2, pb.z)
        ]);
        y.push(pa.y + (pb.y - pa.y) * t);
    }
    const candidate = makeLine(pts, y);
    if (Math.abs(cross) > 0.08 && dot > -0.8 && minRadius(candidate) < 4.55) {
        const theta = Math.atan2(Math.abs(cross), dot);
        const side = cross > 0 ? 1 : -1;
        const R = Math.max(4.65, dist / (2 * Math.sin(Math.max(0.2, Math.min(1.35, theta / 2)))));
        const half = Math.asin(Math.min(0.96, dist / (2 * R)));
        const cx0 = dx / dist, cz0 = dz / dist, nx = -cz0 * side, nz = cx0 * side;
        const h = R * Math.cos(half), mx = (pa.x + pb.x) * 0.5 + nx * h, mz = (pa.z + pb.z) * 0.5 + nz * h;
        const rx0 = pa.x - mx, rz0 = pa.z - mz;
        const n = Math.max(4, Math.min(24, Math.ceil(2 * half * R / 1.4)));
        const arcPts = [
            [
                pa.x,
                pa.z
            ]
        ];
        for(let i = 1; i < n; i++){
            const ang = i / n * (2 * half) * side, co = Math.cos(ang), si = Math.sin(ang);
            arcPts.push([
                mx + rx0 * co - rz0 * si,
                mz + rx0 * si + rz0 * co
            ]);
        }
        arcPts.push([
            pb.x,
            pb.z
        ]);
        const arcY = arcPts.map((_, i)=>pa.y + (pb.y - pa.y) * i / (arcPts.length - 1));
        return makeLine(arcPts, arcY);
    }
    return candidate;
}
const dirAt = (l, end)=>{
    const p = sample(l, end ? l.length : 0);
    return [
        p.hx,
        p.hz
    ];
};
export function rebuildMovements(g, groups, mouthStart, mouthEnd, endSetback) {
    const L = g.lanes, E = g.edges;
    const cutEnd = new Map(), cutStart = new Map();
    const needEnd = new Map(), needStart = new Map();
    const work = [];
    const plans = [];
    for (const G of groups){
        if (!G.legs.length) continue;
        const inG = new Set(G.nodes);
        const internal = (e)=>e.cls !== 'service' && inG.has(e.fromNode) && inG.has(e.toNode) && e.ref.length < 55;
        const origins = [], exits = [];
        for (const n of G.nodes){
            const node = g.nodes.get(n);
            for (const i of node.inEdges){
                const e = E[i];
                if (e.lanes.length && !internal(e)) origins.push(e);
            }
            for (const i of node.outEdges){
                const e = E[i];
                if (e.lanes.length && !internal(e)) exits.push(e);
            }
        }
        const isExit = new Set(exits.map((e)=>e.id));
        const pairs = new Map();
        const walk = (o, allow)=>{
            let found = false;
            const seen = new Set([
                `${o.id},0`
            ]), stack = [
                [
                    o,
                    0
                ]
            ];
            while(stack.length){
                const [e, turned] = stack.pop();
                for (const v of e.lanes)for (const c of L[v].next)for (const w of L[c].next){
                    const we = E[L[w].edge];
                    if (!we) continue;
                    const mv = L[c].movement, nt = turned + (mv === 'left' || mv === 'right' ? 1 : mv === 'uturn' ? 2 : 0);
                    if (nt > allow(o.cls === 'service' || we.cls === 'service') && !(mv === 'uturn' && turned === 0)) continue;
                    const key = `${we.id},${nt}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    if (isExit.has(we.id)) {
                        const k = `${o.id},${we.id}`;
                        if (we.twin !== o.id) found = true;
                        if (!pairs.has(k)) pairs.set(k, {
                            o,
                            d: we,
                            src: new Set(),
                            dst: new Set()
                        });
                    } else if (internal(we)) stack.push([
                        we,
                        nt
                    ]);
                }
            }
            return found;
        };
        for (const o of origins)if (!walk(o, (service)=>service ? 2 : 1)) walk(o, ()=>5);
        for (const n of G.nodes){
            const node = g.nodes.get(n);
            for (const i of node.inEdges){
                const e = E[i];
                if (internal(e)) e.internal = true;
                else work.push({
                    e,
                    atStart: false,
                    node: n
                });
            }
            for (const i of node.outEdges){
                const e = E[i];
                if (!internal(e)) work.push({
                    e,
                    atStart: true,
                    node: n
                });
            }
        }
        plans.push({
            group: inG,
            first: G.nodes[0],
            pairs
        });
        for (const p of pairs.values()){
            const [ax, az] = dirAt(p.o.ref, true), [bx, bz] = dirAt(p.d.ref, false);
            const ang = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));
            if (ang < 0.5 || ang > 2.65) continue;
            const left = ax * bz - az * bx < 0, R = p.o.cls === 'service' || p.d.cls === 'service' ? 4.5 : left ? 8.5 : 6.5;
            const T = R * Math.tan(ang / 2);
            const la = L[left ? p.o.lanes[0] : p.o.lanes[p.o.lanes.length - 1]].line, lb = L[left ? p.d.lanes[0] : p.d.lanes[p.d.lanes.length - 1]].line;
            const pa = sample(la, la.length), pb = sample(lb, 0), cross = pa.hx * pb.hz - pa.hz * pb.hx, dx = pb.x - pa.x, dz = pb.z - pa.z;
            const toX = Math.abs(cross) > 0.05 ? (dx * pb.hz - dz * pb.hx) / cross : 0, fromX = Math.abs(cross) > 0.05 ? -(dx * pa.hz - dz * pa.hx) / cross : 0;
            needEnd.set(p.o.id, Math.max(needEnd.get(p.o.id) ?? 0, T - toX));
            needStart.set(p.d.id, Math.max(needStart.get(p.d.id) ?? 0, T - fromX));
        }
    }
    for (const { e, atStart, node } of work){
        const m = (atStart ? mouthStart : mouthEnd).get(e.id);
        const base = m ? m.stop : endSetback(e, node), want = Math.max(base, Math.min(base + 16, (atStart ? needStart : needEnd).get(e.id) ?? 0));
        (atStart ? cutStart : cutEnd).set(e.id, Math.max(want, (atStart ? cutStart : cutEnd).get(e.id) ?? 0));
    }
    for (const e of E){
        if (e.internal || e.cls === 'ramp' || !/_link$/.test(e.way.hw)) continue;
        if (e.prev === undefined && !cutStart.has(e.id)) {
            const sb = endSetback(e, e.fromNode);
            if (sb > 0) cutStart.set(e.id, sb);
        }
        if (e.next === undefined && !cutEnd.has(e.id)) {
            const sb = endSetback(e, e.toNode);
            if (sb > 0) cutEnd.set(e.id, sb);
        }
    }
    const unlink = (c)=>{
        const k = L[c];
        for (const a of k.prev)L[a].next = L[a].next.filter((x)=>x !== c);
        for (const b of k.next)L[b].prev = L[b].prev.filter((x)=>x !== c);
        k.prev = [];
        k.next = [];
    };
    for (const P of plans)for (const n of P.group){
        const node = g.nodes.get(n);
        for (const i of node.inEdges)for (const l of E[i].lanes)for (const c of L[l].next.slice())if (L[c].connector && L[c].node !== undefined && P.group.has(L[c].node)) unlink(c);
        for (const i of node.outEdges)for (const l of E[i].lanes)for (const c of L[l].prev.slice())if (L[c].connector && L[c].node !== undefined && P.group.has(L[c].node)) unlink(c);
    }
    for (const e of E){
        if (e.internal) continue;
        const c0 = cutStart.get(e.id) ?? 0, c1 = cutEnd.get(e.id) ?? 0;
        if (!c0 && !c1) continue;
        const len = e.ref.length, both = c0 > 0 && c1 > 0;
        const s0 = Math.min(c0, len * (both ? 0.42 : 0.7)), s1 = Math.min(c1, len * (both ? 0.42 : 0.7));
        for (const l of e.lanes){
            const lane = L[l], scale = lane.line.length / (len || 1);
            lane.line = trim(lane.line, s0 * scale, lane.line.length - s1 * scale);
            lane.s0 = s0 * scale;
            for (const c of lane.next)if (L[c]?.connector && L[c].prev[0] !== undefined && L[c].next[0] !== undefined) L[c].line = movementLine(L[L[c].prev[0]], L[L[c].next[0]]);
            for (const c of lane.prev)if (L[c]?.connector && L[c].prev[0] !== undefined && L[c].next[0] !== undefined) L[c].line = movementLine(L[L[c].prev[0]], L[L[c].next[0]]);
        }
    }
    const connect = (from, to, mv, node)=>{
        const a = L[from], b = L[to];
        if (a.next.some((c)=>L[c].next[0] === to)) return;
        const conn = {
            id: L.length,
            edge: -1,
            index: 0,
            line: movementLine(a, b),
            width: Math.min(a.width, b.width),
            next: [
                to
            ],
            prev: [
                from
            ],
            connector: true,
            movement: mv,
            node
        };
        L.push(conn);
        a.next.push(conn.id);
        b.prev.push(conn.id);
    };
    for (const P of plans){
        const byOrigin = new Map();
        for (const p of P.pairs.values()){
            const [ax, az] = dirAt(p.o.ref, true), [bx, bz] = dirAt(p.d.ref, false);
            const ang = Math.atan2(ax * bz - az * bx, ax * bx + az * bz) * 180 / Math.PI;
            const mv = Math.abs(ang) < 35 ? 'through' : Math.abs(ang) > 150 ? 'uturn' : ang > 0 ? 'right' : 'left';
            if (!byOrigin.has(p.o.id)) byOrigin.set(p.o.id, []);
            const tagged = p.o.lanes.filter((_, i)=>p.o.turns[i]?.includes(mv));
            const lanes = tagged.length ? tagged : mv === 'right' ? [
                p.o.lanes[p.o.lanes.length - 1]
            ] : mv === 'through' ? p.o.lanes : [
                p.o.lanes[0]
            ];
            byOrigin.get(p.o.id).push({
                ...p,
                mv,
                src: new Set(lanes)
            });
        }
        for (const list of byOrigin.values()){
            const onward = list.filter((p)=>p.mv !== 'uturn');
            const forks = onward.filter((p)=>p.mv === 'through');
            if (forks.length > 1) {
                const o = forks[0].o, end = sample(o.ref, o.ref.length), side = (d)=>{
                    const q = sample(d.ref, d.ref.length * 0.5);
                    return (q.x - end.x) * -end.hz + (q.z - end.z) * end.hx;
                };
                forks.sort((a, b)=>side(a.d) - side(b.d));
                const all = o.lanes.filter((l)=>forks.some((f)=>f.src.has(l)));
                const total = forks.reduce((n, f)=>n + f.d.lanes.length, 0);
                let at = 0;
                forks.forEach((f, q)=>{
                    const take = q === forks.length - 1 ? all.length - at : Math.max(1, Math.round(all.length * f.d.lanes.length / total));
                    const mine = all.slice(Math.min(at, all.length - 1), Math.min(at + take, all.length));
                    f.src = new Set(mine.length ? mine : [
                        all[all.length - 1]
                    ]);
                    at += take;
                });
            }
            for (const p of onward.length ? onward : list){
                const order = (e, s)=>e.lanes.filter((l)=>s.has(l));
                let src = order(p.o, p.src), dst = p.d.lanes.slice();
                if (!src.length || !dst.length) continue;
                const carries = (e, l)=>{
                    const t = e.turns[e.lanes.indexOf(l)];
                    return !t || t.includes('through') || t.includes('merge') || t.length === 0;
                };
                if (p.mv === 'through') {
                    const st = src.filter((l)=>carries(p.o, l)), dt = dst.filter((l)=>carries(p.d, l));
                    if (st.length) src = st;
                    if (dt.length >= Math.min(src.length, dst.length)) dst = dt;
                    let best = Infinity, shift = 0;
                    for(let off = Math.min(0, dst.length - src.length); off <= Math.max(0, dst.length - src.length); off++){
                        let gap = 0;
                        src.forEach((l, q)=>{
                            const a = L[l].line.pts, b = L[dst[Math.max(0, Math.min(dst.length - 1, q + off))]].line.pts[0], e0 = a[a.length - 1];
                            gap += Math.hypot(e0[0] - b[0], e0[1] - b[1]);
                        });
                        if (gap < best) {
                            best = gap;
                            shift = off;
                        }
                    }
                    src.forEach((l, q)=>connect(l, dst[Math.max(0, Math.min(dst.length - 1, q + shift))], 'through', P.first));
                } else if (p.mv === 'right') {
                    src = src.slice().reverse();
                    dst = dst.slice().reverse();
                    src.forEach((l, q)=>connect(l, dst[Math.min(q, dst.length - 1)], 'right', P.first));
                } else {
                    src.forEach((l, q)=>connect(l, dst[Math.min(q, dst.length - 1)], p.mv, P.first));
                }
            }
        }
        const reach = (ls, i, has)=>{
            for(let d = 1; d < ls.length; d++)for (const k of [
                i - d,
                i + d
            ])if (k >= 0 && k < ls.length && has(ls[k])) return ls[k];
            return -1;
        };
        for (const n of P.group){
            const node = g.nodes.get(n);
            for (const i of node.inEdges){
                const e = E[i];
                if (e.internal) continue;
                e.lanes.forEach((l, k)=>{
                    if (L[l].next.length) return;
                    const tag = e.turns[k], wrong = tag?.length === 1 && tag[0] === 'left' ? 'right' : tag?.length === 1 && tag[0] === 'right' ? 'left' : null;
                    const fits = (o)=>L[o].next.some((c)=>L[c].movement !== wrong);
                    const nb = reach(e.lanes, k, fits) >= 0 ? reach(e.lanes, k, fits) : reach(e.lanes, k, (o)=>L[o].next.length > 0);
                    if (nb < 0) return;
                    const via = L[L[nb].next.find((c)=>L[c].movement !== wrong) ?? L[nb].next[0]];
                    connect(l, via.next[0], via.movement, P.first);
                });
            }
            for (const i of node.outEdges){
                const e = E[i];
                if (e.internal) continue;
                e.lanes.forEach((l, k)=>{
                    if (L[l].prev.length) return;
                    const nb = reach(e.lanes, k, (o)=>L[o].prev.length > 0);
                    if (nb < 0) return;
                    const via = L[L[nb].prev[0]];
                    connect(via.prev[0], l, via.movement, P.first);
                });
            }
        }
        const straight = new Map();
        for (const n of P.group)for (const i of g.nodes.get(n).inEdges){
            const e = E[i];
            if (e.internal) continue;
            for (const l of e.lanes)for (const c of L[l].next){
                const k = L[c], to = L[k.next[0]];
                if (k.movement !== 'through' || to.edge < 0) continue;
                const key = `${e.id},${to.edge}`, list = straight.get(key);
                if (list) list.push(c);
                else straight.set(key, [
                    c
                ]);
            }
        }
        for (const [key, list] of straight){
            const [oi, di] = key.split(',').map(Number);
            const srcAt = (c)=>E[oi].lanes.indexOf(L[c].prev[0]), dstAt = (c)=>E[di].lanes.indexOf(L[c].next[0]);
            const bySrc = list.slice().sort((a, b)=>srcAt(a) - srcAt(b) || dstAt(a) - dstAt(b));
            const wants = bySrc.map(dstAt).sort((a, b)=>a - b);
            bySrc.forEach((c, q)=>{
                if (dstAt(c) === wants[q]) return;
                const k = L[c], was = L[k.next[0]], now = L[E[di].lanes[wants[q]]];
                was.prev = was.prev.filter((x)=>x !== c);
                now.prev.push(c);
                k.next = [
                    now.id
                ];
                k.line = movementLine(L[k.prev[0]], now);
            });
        }
    }
    for (const l of L){
        if (l.connector || l.next.length < 2) continue;
        const seen = new Set();
        for (const c of l.next.slice()){
            const t = L[c].next[0];
            if (t === undefined) continue;
            if (seen.has(t)) unlink(c);
            seen.add(t);
        }
    }
    const easeEnd = new Map(), easeStart = new Map();
    for (const k of L){
        if (!k.connector || !k.next.length || !k.prev.length) continue;
        const a = L[k.prev[0]], b = L[k.next[0]], ea = E[a.edge], eb = E[b.edge];
        if (!ea || !eb || ea.elevated || eb.elevated) continue;
        if (k.movement !== 'through') {
            if (ea.next !== undefined && eb.prev === undefined) {
                const sb = endSetback(eb, eb.fromNode);
                if (sb > 0) easeStart.set(b.id, Math.max(easeStart.get(b.id) ?? 0, sb));
            } else if (ea.next === undefined && eb.prev !== undefined) {
                const sb = endSetback(ea, ea.toNode);
                if (sb > 0) easeEnd.set(a.id, Math.max(easeEnd.get(a.id) ?? 0, sb));
            }
            const pa = sample(a.line, a.line.length), pb = sample(b.line, 0), cross = pa.hx * pb.hz - pa.hz * pb.hx, dot = pa.hx * pb.hx + pa.hz * pb.hz;
            const ang = Math.atan2(Math.abs(cross), dot);
            if (ang >= 0.4 && ang <= 2.6 && Math.abs(cross) > 0.05) {
                const T = 6.5 * Math.tan(ang / 2), dx = pb.x - pa.x, dz = pb.z - pa.z;
                const toX = (dx * pb.hz - dz * pb.hx) / cross, fromX = -(dx * pa.hz - dz * pa.hx) / cross;
                if (T - toX > 0.3) easeEnd.set(a.id, Math.max(easeEnd.get(a.id) ?? 0, T - toX));
                if (T - fromX > 0.3) easeStart.set(b.id, Math.max(easeStart.get(b.id) ?? 0, T - fromX));
            }
            continue;
        }
        if (ea.next !== eb.id && eb.prev !== undefined) {
            const sb = endSetback(ea, ea.toNode);
            if (sb > 0) {
                easeEnd.set(a.id, Math.max(easeEnd.get(a.id) ?? 0, sb));
                continue;
            }
        }
        const p = a.line.pts[a.line.pts.length - 1], q = b.line.pts[0], h = sample(a.line, a.line.length);
        const side = Math.abs((q[0] - p[0]) * -h.hz + (q[1] - p[1]) * h.hx), along = (q[0] - p[0]) * h.hx + (q[1] - p[1]) * h.hz;
        if (side < 0.4 || along > side * 6) continue;
        const need = Math.min(side * 5, 14);
        easeEnd.set(a.id, Math.max(easeEnd.get(a.id) ?? 0, need));
        easeStart.set(b.id, Math.max(easeStart.get(b.id) ?? 0, need));
    }
    const moved = new Set();
    for (const [id, need] of easeEnd){
        const lane = L[id], cut = Math.min(need, lane.line.length * 0.42);
        if (cut > 0.2) {
            lane.line = trim(lane.line, 0, lane.line.length - cut);
            moved.add(id);
        }
    }
    for (const [id, need] of easeStart){
        const lane = L[id], cut = Math.min(need, lane.line.length * 0.42);
        if (cut > 0.2) {
            lane.line = trim(lane.line, cut, lane.line.length);
            lane.s0 = (lane.s0 ?? 0) + cut;
            moved.add(id);
        }
    }
    for (const id of moved)for (const c of [
        ...L[id].next,
        ...L[id].prev
    ]){
        const k = L[c];
        if (k.connector && k.prev.length && k.next.length) k.line = movementLine(L[k.prev[0]], L[k.next[0]]);
    }
    const isTurnOnly = (l)=>{
        const e = E[L[l].edge];
        if (!e) return false;
        const t = e.turns[e.lanes.indexOf(l)];
        return !!t && t.length === 1 && (t[0] === 'left' || t[0] === 'right');
    };
    for (const e of E){
        if (e.cls === 'service' || e.internal) continue;
        const existingPairs = [];
        e.lanes.forEach((v, idx)=>{
            for (const c of L[v].next){
                const to = L[c].next[0];
                if (L[c].movement === 'through' && L[to].edge >= 0) {
                    existingPairs.push([
                        idx,
                        L[to].edge,
                        E[L[to].edge].lanes.indexOf(to)
                    ]);
                }
            }
        });
        e.lanes.forEach((v, idx)=>{
            if (!e.turns[idx]?.includes('through')) return;
            const thruConns = L[v].next.filter((c)=>L[c].movement === 'through' && L[L[c].next[0]].edge >= 0);
            if (!thruConns.length || !thruConns.every((c)=>isTurnOnly(L[c].next[0]))) return;
            const firstConn = L[thruConns[0]], to0 = firstConn.next[0], eb = E[L[to0].edge];
            const candidates = eb.lanes.map((l, j)=>({
                    l,
                    j
                })).filter(({ l, j })=>!isTurnOnly(l) && existingPairs.every(([ia, ebId, ja])=>ebId !== eb.id || (idx - ia) * (j - ja) >= 0));
            if (!candidates.length) return;
            const j0 = eb.lanes.indexOf(to0);
            candidates.sort((a, b)=>Math.abs(a.j - j0) - Math.abs(b.j - j0));
            connect(v, candidates[0].l, 'through', firstConn.node ?? e.toNode);
            existingPairs.push([
                idx,
                eb.id,
                candidates[0].j
            ]);
        });
    }
    for (const l of L){
        if (l.connector || !E[l.edge] || E[l.edge].internal || !l.line.pts.length) continue;
        const rounded = roundCorners(l.line, E[l.edge].elevated);
        if (rounded !== l.line) {
            l.raw = l.line;
            l.line = rounded;
            for (const c of [
                ...l.next,
                ...l.prev
            ]){
                const k = L[c];
                if (k.connector && k.prev.length && k.next.length) k.line = movementLine(L[k.prev[0]], L[k.next[0]]);
            }
        }
    }
    g.hulls = [];
    for (const P of plans){
        const pts = [];
        for (const n of P.group){
            const node = g.nodes.get(n);
            for (const i of node.inEdges)for (const l of E[i].lanes)if (!E[i].internal) {
                const q = L[l].line.pts;
                pts.push(q[q.length - 1]);
            }
            for (const i of node.outEdges)for (const l of E[i].lanes)if (!E[i].internal) pts.push(L[l].line.pts[0]);
        }
        if (pts.length >= 3) {
            const h = convexHull(pts);
            if (h.length >= 3) g.hulls.push(h);
        }
    }
}
function roundCorners(line, keepHeight) {
    const P = line.pts;
    if (P.length < 3 || line.length < 4) return line;
    let sharp = false;
    for(let i = 1; i + 1 < P.length && !sharp; i++){
        const ax = P[i][0] - P[i - 1][0], az = P[i][1] - P[i - 1][1], bx = P[i + 1][0] - P[i][0], bz = P[i + 1][1] - P[i][1];
        const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1, theta = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb))));
        sharp = theta > 0.06 && Math.min(la, lb) / (2 * Math.tan(theta / 2)) < 11;
    }
    if (!sharp) return line;
    const n = Math.max(3, Math.ceil(line.length / 1.2));
    let xs = new Float64Array(n + 1), zs = new Float64Array(n + 1), tx = new Float64Array(n + 1), tz = new Float64Array(n + 1);
    const ys = [];
    for(let i = 0; i <= n; i++){
        const q = sample(line, line.length * i / n);
        xs[i] = q.x;
        zs[i] = q.z;
        ys.push(q.y);
    }
    const hold = Math.min(1, n >> 2);
    const relax = (hot)=>{
        tx.set(xs);
        tz.set(zs);
        for(let i = hold; i <= n - hold; i++){
            if (i <= 0 || i >= n || hot && !hot[i]) continue;
            tx[i] = 0.25 * xs[i - 1] + 0.5 * xs[i] + 0.25 * xs[i + 1];
            tz[i] = 0.25 * zs[i - 1] + 0.5 * zs[i] + 0.25 * zs[i + 1];
        }
        let sw = xs;
        xs = tx;
        tx = sw;
        sw = zs;
        zs = tz;
        tz = sw;
    };
    const passes = keepHeight ? 12 : 26;
    for(let k = 0; k < passes; k++)relax(null);
    const TARGET = 6.5, spacing = line.length / n, reach = Math.ceil(7 / spacing), hot = new Uint8Array(n + 1);
    for(let k = 0; k < 400; k++){
        hot.fill(0);
        let any = false;
        for(let i = hold + 2; i <= n - hold - 2; i++){
            const ax = xs[i - 2], az = zs[i - 2], bx = xs[i], bz = zs[i], cx = xs[i + 2], cz = zs[i + 2];
            const area = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
            if (area < 1e-5) continue;
            if (Math.hypot(bx - ax, bz - az) * Math.hypot(cx - bx, cz - bz) * Math.hypot(ax - cx, az - cz) / (4 * area) < TARGET) {
                any = true;
                for(let j = Math.max(1, i - reach); j <= Math.min(n - 1, i + reach); j++)hot[j] = 1;
            }
        }
        if (!any) break;
        relax(hot);
    }
    const pts = [];
    for(let i = 0; i <= n; i++)pts.push([
        xs[i],
        zs[i]
    ]);
    return makeLine(pts, ys);
}
export function minRadius(l) {
    let best = Infinity;
    const step = 1.5;
    for(let s = step; s + step <= l.length; s += step){
        const a = sample(l, s - step), b = sample(l, s), c = sample(l, s + step);
        const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ca = Math.hypot(a.x - c.x, a.z - c.z);
        const area = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
        if (area > 1e-4) best = Math.min(best, ab * bc * ca / (4 * area));
    }
    return best;
}
