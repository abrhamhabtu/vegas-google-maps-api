// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { sample } from './lanegraph.js';
import { rebuildMovements } from './movements.js';
export function planIntersections(data, g) {
    const waysAt = new Map();
    for (const e of g.edges)for (const n of [
        e.fromNode,
        e.toNode
    ]){
        if (!waysAt.has(n)) waysAt.set(n, new Set());
        waysAt.get(n).add(e.way.id);
    }
    const isJunction = (n)=>{
        const node = g.nodes.get(n);
        const ws = waysAt.get(n);
        if (node.inEdges.length && node.inEdges.every((i)=>g.edges[i].next !== undefined)) return false;
        if (node.outEdges.length && node.outEdges.every((o)=>g.edges[o].prev !== undefined)) return false;
        if (node.inEdges.some((i)=>g.edges[i].next !== undefined)) {
            const others = [
                ...node.inEdges.filter((i)=>g.edges[i].next === undefined),
                ...node.outEdges.filter((o)=>g.edges[o].prev === undefined)
            ];
            if (others.every((ei)=>g.edges[ei].cls === 'service' || g.edges[ei].cls !== 'ramp' && /_link$/.test(g.edges[ei].way.hw))) {
                return false;
            }
        }
        if (ws.size >= 3) return true;
        if (ws.size === 2) {
            const names = new Set([
                ...node.inEdges,
                ...node.outEdges
            ].map((i)=>g.edges[i].way.name ?? i));
            return names.size > 1 && node.inEdges.length + node.outEdges.length > 2;
        }
        return false;
    };
    const halfW = (e)=>e.lanes.length * e.laneWidth / (e.oneway ? 2 : 1);
    const setback = new Map();
    for (const [id, node] of g.nodes){
        if (!isJunction(id)) continue;
        let r = 0;
        for (const ei of [
            ...node.inEdges,
            ...node.outEdges
        ])r = Math.max(r, halfW(g.edges[ei]));
        setback.set(id, r);
    }
    const endSetback = (e, node)=>{
        if (node === e.toNode && e.next !== undefined || node === e.fromNode && e.prev !== undefined) return 0;
        if (!setback.has(node)) {
            const n = g.nodes.get(node);
            if (!n || !n.inEdges.some((i)=>g.edges[i].next !== undefined)) return 0;
            let r = 0;
            for (const ei of [
                ...n.inEdges,
                ...n.outEdges
            ]){
                const o = g.edges[ei];
                if (o.next !== undefined || o.prev !== undefined) r = Math.max(r, halfW(o));
            }
            return r > 0 ? Math.min(e.ref.length * 0.45, r + 2.5) : 0;
        }
        const n = g.nodes.get(node);
        let r = 0;
        for (const ei of [
            ...n.inEdges,
            ...n.outEdges
        ]){
            const o = g.edges[ei];
            if (o.way.id === e.way.id) continue;
            r = Math.max(r, halfW(o));
        }
        return r + 1.2;
    };
    const sigGrid = new Map();
    for (const s of data.signals){
        const k = `${Math.floor(s.x / 50)},${Math.floor(s.z / 50)}`;
        if (!sigGrid.has(k)) sigGrid.set(k, []);
        sigGrid.get(k).push([
            s.x,
            s.z
        ]);
    }
    const nearSignal = (x, z, r)=>{
        const cx = Math.floor(x / 50), cz = Math.floor(z / 50);
        for(let i = -1; i <= 1; i++)for(let j = -1; j <= 1; j++)for (const p of sigGrid.get(`${cx + i},${cz + j}`) ?? [])if (Math.hypot(p[0] - x, p[1] - z) < r) return true;
        return false;
    };
    const crossesRoad = (nodes)=>{
        const names = new Set();
        for (const n of nodes){
            const node = g.nodes.get(n);
            if (!node) continue;
            for (const ei of [
                ...node.inEdges,
                ...node.outEdges
            ]){
                const e = g.edges[ei];
                if (e.cls !== 'service' && e.cls !== 'motorway' && e.cls !== 'ramp') names.add(e.way.name ?? `way ${e.way.id}`);
            }
        }
        return names.size >= 2;
    };
    const spans = data.walks.filter((w)=>w.br && w.hw !== 'steps' && !w.conv && !w.tn && !w.indoor && w.y && Math.max(...w.y) > 4).map((w)=>{
        const a = w.pts[0], b = w.pts[w.pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return {
            x: (a[0] + b[0]) / 2,
            z: (a[1] + b[1]) / 2,
            hx: (b[0] - a[0]) / L,
            hz: (b[1] - a[1]) / L,
            L
        };
    }).filter((sp)=>sp.L > 15);
    const signalCrossings = data.crossings.filter((c)=>/traffic_signals/.test(c.k ?? ''));
    const pedSignalAt = (x, z, r)=>signalCrossings.some((c)=>Math.abs(c.x - x) < r && Math.abs(c.z - z) < r);
    const mouthStart = new Map(), mouthEnd = new Map();
    const legs = [];
    const usedCrossings = new Set();
    const groupsOut = [];
    {
        const clusters = new Map([
            [
                0,
                [
                    ...setback.keys()
                ]
            ]
        ]);
        const crossPts = data.crossings.filter((c)=>c.k !== 'unmarked' && c.k !== 'no');
        const cellOf = (x, z)=>`${Math.floor(x / 60)},${Math.floor(z / 60)}`;
        const crossGrid = new Map();
        for (const c of crossPts){
            const k = cellOf(c.x, c.z);
            if (!crossGrid.has(k)) crossGrid.set(k, []);
            crossGrid.get(k).push(c);
        }
        for (const members of clusters.values()){
            const links = [];
            for (const m of members)for (const ei of g.nodes.get(m).outEdges){
                let e = g.edges[ei], len = e.ref.length;
                const via = [];
                while(len < 55 && !setback.has(e.toNode) && via.length < 6){
                    const node = g.nodes.get(e.toNode);
                    const on = node.outEdges.map((i)=>g.edges[i]).filter((o)=>o.twin !== e.id);
                    if (on.length !== 1) break;
                    via.push(e.toNode);
                    e = on[0];
                    len += e.ref.length;
                }
                if (len < 55 && setback.has(e.toNode) && e.toNode !== m) links.push({
                    from: m,
                    to: e.toNode,
                    len,
                    via
                });
            }
            links.sort((x, y)=>x.len - y.len);
            const blob = new Map(members.map((m)=>[
                    m,
                    [
                        m
                    ]
                ]));
            for (const l of links){
                const A = blob.get(l.from), B = blob.get(l.to);
                if (A !== B) {
                    const both = [
                        ...A,
                        ...B
                    ];
                    let ax = 0, az = 0;
                    for (const id of both){
                        const n = g.nodes.get(id);
                        ax += n.x;
                        az += n.z;
                    }
                    ax /= both.length;
                    az /= both.length;
                    if (both.some((id)=>{
                        const n = g.nodes.get(id);
                        return Math.hypot(n.x - ax, n.z - az) > 36;
                    })) continue;
                    for (const id of both)blob.set(id, both);
                }
                const merged = blob.get(l.from);
                for (const v of l.via)if (!blob.has(v)) {
                    merged.push(v);
                    blob.set(v, merged);
                }
            }
            const groups = [
                ...new Set(blob.values())
            ];
            for (const group of groups){
                let gx = 0, gz = 0;
                for (const id of group){
                    const n = g.nodes.get(id);
                    gx += n.x;
                    gz += n.z;
                }
                const ctr = [
                    gx / group.length,
                    gz / group.length
                ];
                const inGroup = new Set(group), mine = [], real = crossesRoad(group);
                groupsOut.push({
                    nodes: group,
                    ctr,
                    legs: mine
                });
                for (const id of group){
                    const node = g.nodes.get(id);
                    for (const ei of [
                        ...node.inEdges,
                        ...node.outEdges
                    ]){
                        const e = g.edges[ei], atStart = e.fromNode === id;
                        if (inGroup.has(atStart ? e.toNode : e.fromNode) && e.ref.length < 55) continue;
                        if (e.cls === 'motorway' || e.cls === 'ramp' || e.cls === 'service') continue;
                        const at = (d)=>sample(e.ref, atStart ? d : e.ref.length - d);
                        const p0 = at(0), p1 = at(Math.min(24, e.ref.length));
                        if (p0.y > 0.4 || p1.y > 0.4) continue;
                        let ax = p1.x - p0.x, az = p1.z - p0.z;
                        const L = Math.hypot(ax, az) || 1;
                        ax /= L;
                        az /= L;
                        let leg = mine.find((l)=>l.a[0] * ax + l.a[1] * az > 0.88);
                        if (!leg) {
                            mine.push(leg = {
                                ctr,
                                a: [
                                    ax,
                                    az
                                ],
                                perp: [
                                    -az,
                                    ax
                                ],
                                d: 0,
                                cross: false,
                                entries: []
                            });
                        }
                        leg.entries.push({
                            e,
                            node: id,
                            atStart
                        });
                    }
                }
                for (const leg of mine){
                    let d = 0;
                    for (const { e, node, atStart } of leg.entries){
                        const q = sample(e.ref, atStart ? endSetback(e, node) : e.ref.length - endSetback(e, node));
                        d = Math.max(d, (q.x - ctr[0]) * leg.a[0] + (q.z - ctr[1]) * leg.a[1]);
                    }
                    leg.d = Math.min(d, 80);
                    const mx = ctr[0] + leg.a[0] * leg.d, mz = ctr[1] + leg.a[1] * leg.d;
                    for(let i = -1; i <= 1; i++)for(let j = -1; j <= 1; j++){
                        for (const c of crossGrid.get(`${Math.floor(mx / 60) + i},${Math.floor(mz / 60) + j}`) ?? []){
                            const along = (c.x - mx) * leg.a[0] + (c.z - mz) * leg.a[1], across = (c.x - mx) * leg.perp[0] + (c.z - mz) * leg.perp[1];
                            if (along > -14 && along < 34 && Math.abs(across) < 34) {
                                usedCrossings.add(c.id);
                                if (real || /traffic_signals/.test(c.k ?? '') || /marked|zebra/.test(c.k ?? '') && !leg.entries.some(({ e })=>e.cls === 'arterial')) leg.cross = true;
                            }
                        }
                    }
                    if (leg.entries.some(({ e })=>e.cls === 'arterial' || e.cls === 'collector') && real && nearSignal(mx, mz, 45)) leg.cross = true;
                    if (leg.cross && leg.entries.some(({ e })=>e.cls === 'arterial') && !nearSignal(ctr[0], ctr[1], 40) && !nearSignal(mx, mz, 35) && !pedSignalAt(ctr[0], ctr[1], 25)) leg.cross = false;
                    if (leg.cross && spans.some((sp)=>Math.hypot(sp.x - mx, sp.z - mz) < 42 && Math.abs(sp.hx * leg.a[0] + sp.hz * leg.a[1]) < 0.45)) leg.cross = false;
                    if (leg.cross && leg.entries.some(({ e })=>e.cls === 'arterial') && spans.filter((sp)=>Math.hypot(sp.x - ctr[0], sp.z - ctr[1]) < 95).length >= 2) leg.cross = false;
                    const target = (t, e, atStart)=>{
                        const max = e.ref.length * 0.5;
                        for(let dd = 0; dd < max; dd += 0.5){
                            const q = sample(e.ref, atStart ? dd : e.ref.length - dd);
                            if ((q.x - ctr[0]) * leg.a[0] + (q.z - ctr[1]) * leg.a[1] >= t) return dd;
                        }
                        return max;
                    };
                    for (const { e, atStart } of leg.entries){
                        const inner = target(leg.d, e, atStart);
                        const room = e.ref.length * 0.5 > inner + 8;
                        const cross = leg.cross && room;
                        const band = [
                            target(leg.d + 0.6, e, atStart),
                            target(leg.d + 3.8, e, atStart)
                        ];
                        const stopWith = target(leg.d + 5.0, e, atStart);
                        const fits = cross && stopWith > band[1];
                        const m = {
                            inner,
                            stop: fits ? stopWith : target(leg.d + 0.6, e, atStart),
                            clear: fits ? target(leg.d + 4.4, e, atStart) : target(leg.d + 0.6, e, atStart),
                            band: fits ? band : undefined,
                            leg
                        };
                        (atStart ? mouthStart : mouthEnd).set(e.id, m);
                    }
                    legs.push(leg);
                }
            }
        }
    }
    rebuildMovements(g, groupsOut, mouthStart, mouthEnd, endSetback);
    const intersections = [];
    const connsOf = new Map();
    const nodeToIntersection = new Map();
    const connectorsAt = new Map();
    for (const l of g.lanes)if (l.connector && l.node !== undefined && l.next.length) {
        if (!connectorsAt.has(l.node)) connectorsAt.set(l.node, []);
        connectorsAt.get(l.node).push(l.id);
    }
    const rank = (e)=>({
            motorway: 5,
            arterial: 4,
            ramp: 3,
            collector: 3,
            local: 2,
            service: 1
        })[e.cls];
    for (const G of groupsOut){
        if (!G.legs.length) continue;
        const id = intersections.length;
        for (const n of G.nodes)nodeToIntersection.set(n, id);
        const legsOut = G.legs.map((leg)=>({
                axis: leg.a,
                name: leg.entries[0].e.way.name,
                approaches: leg.entries.map(({ e, atStart })=>{
                    const m = (atStart ? mouthStart : mouthEnd).get(e.id);
                    return {
                        edge: e.id,
                        inbound: !atStart,
                        stopAt: m.stop,
                        crosswalk: m.band,
                        lanes: e.lanes
                    };
                })
            }));
        const signal = crossesRoad(G.nodes) ? nearSignal(G.ctr[0], G.ctr[1], 32) || G.legs.some((l)=>nearSignal(G.ctr[0] + l.a[0] * l.d, G.ctr[1] + l.a[1] * l.d, 30)) : pedSignalAt(G.ctr[0], G.ctr[1], 10);
        const top = Math.max(...G.legs.flatMap((l)=>l.entries.map((en)=>rank(en.e))));
        const low = Math.min(...G.legs.flatMap((l)=>l.entries.map((en)=>rank(en.e))));
        const control = signal ? 'signal' : top > low ? 'stop' : 'priority';
        const conns = G.nodes.flatMap((n)=>connectorsAt.get(n) ?? []);
        connsOf.set(id, conns);
        const yieldTo = new Map();
        let conflicts = 0;
        const segCross = (a, b, c, d)=>{
            const s1x = b[0] - a[0], s1z = b[1] - a[1], s2x = d[0] - c[0], s2z = d[1] - c[1], den = -s2x * s1z + s1x * s2z;
            if (Math.abs(den) < 1e-6) return false;
            const s = (-s1z * (a[0] - c[0]) + s1x * (a[1] - c[1])) / den, t = (s2x * (a[1] - c[1]) - s2z * (a[0] - c[0])) / den;
            return s > 0.02 && s < 0.98 && t > 0.02 && t < 0.98;
        };
        const cross = (p, q)=>{
            for(let i = 0; i < p.length - 1; i++)for(let j = 0; j < q.length - 1; j++)if (segCross(p[i], p[i + 1], q[j], q[j + 1])) return true;
            return false;
        };
        const list = conns.length <= 220 ? conns : [];
        const prio = (lane)=>{
            const m = g.lanes[lane].movement;
            return m === 'through' ? 3 : m === 'right' ? 2 : 1;
        };
        for(let i = 0; i < list.length; i++)for(let j = i + 1; j < list.length; j++){
            const a = g.lanes[list[i]], b = g.lanes[list[j]];
            if (a.prev[0] === b.prev[0] || a.next[0] === b.next[0]) continue;
            if (!cross(a.line.pts, b.line.pts)) continue;
            conflicts++;
            const [lo, hi] = prio(a.id) <= prio(b.id) ? [
                a.id,
                b.id
            ] : [
                b.id,
                a.id
            ];
            if (!yieldTo.has(lo)) yieldTo.set(lo, []);
            yieldTo.get(lo).push(hi);
        }
        const phases = [];
        if (signal) {
            const used = new Set();
            const greenFor = (ls, left)=>conns.filter((c)=>{
                    const l = g.lanes[c], from = g.lanes[l.prev[0]];
                    if (from.edge < 0) return false;
                    const fromEdge = g.edges[from.edge];
                    return ls.some((leg)=>leg.entries.some((en)=>en.e.id === fromEdge.id && !en.atStart)) && (left ? l.movement === 'left' : l.movement !== 'left');
                });
            for (const leg of G.legs){
                if (used.has(leg)) continue;
                used.add(leg);
                const opp = G.legs.find((o)=>!used.has(o) && o.a[0] * leg.a[0] + o.a[1] * leg.a[1] < -0.8);
                if (opp) used.add(opp);
                const pair = opp ? [
                    leg,
                    opp
                ] : [
                    leg
                ];
                const major = pair.some((l)=>l.entries.some((en)=>en.e.cls === 'arterial'));
                const name = pair[0].entries[0].e.way.name ?? 'phase';
                const lefts = greenFor(pair, true);
                const hasPocket = pair.some((l)=>l.entries.some((en)=>!en.atStart && en.e.turns.some((t)=>t.length === 1 && t[0] === 'left')));
                if (lefts.length && hasPocket) phases.push({
                    name: `${name} protected left`,
                    greens: lefts,
                    seconds: 14,
                    axis: leg.a,
                    left: true
                });
                phases.push({
                    name: `${name} through`,
                    greens: hasPocket ? greenFor(pair, false) : [
                        ...greenFor(pair, false),
                        ...lefts
                    ],
                    seconds: major ? 42 : 24,
                    axis: leg.a
                });
            }
        }
        intersections.push({
            id,
            x: G.ctr[0],
            z: G.ctr[1],
            control,
            legs: legsOut,
            phases,
            yellow: 3.6,
            allRed: 1.2,
            conflicts,
            yieldTo,
            estimated: true
        });
    }
    const junctions = intersections.filter((i)=>i.control === 'signal' && i.legs.length >= 3);
    for (const i of intersections){
        if (i.control !== 'signal' || i.legs.length >= 3) continue;
        if (junctions.some((o)=>Math.hypot(o.x - i.x, o.z - i.z) < 90)) {
            i.control = 'priority';
            i.phases = [];
        }
    }
    const streets = (i)=>{
        const n = new Set();
        for (const l of i.legs)for (const a of l.approaches){
            const w = g.edges[a.edge].way.name;
            if (w) n.add(w.replace(/^(North|South|East|West)\s/, ''));
        }
        return n;
    };
    const signals = intersections.filter((i)=>i.control === 'signal' && i.phases.length);
    const named = new Map(signals.map((i)=>[
            i,
            streets(i)
        ]));
    const done = new Set();
    for (const seed of signals){
        if (done.has(seed)) continue;
        const team = [
            seed
        ], mine = named.get(seed);
        done.add(seed);
        for(let k = 0; k < team.length; k++)for (const o of signals){
            if (done.has(o)) continue;
            const d = Math.hypot(o.x - seed.x, o.z - seed.z);
            if (d > 110) continue;
            let shared = 0;
            for (const n of named.get(o))if (mine.has(n)) shared++;
            if (Math.hypot(o.x - team[k].x, o.z - team[k].z) < 30 || shared >= 2 && d <= 72) {
                done.add(o);
                team.push(o);
            }
        }
        const buckets = [];
        const aligned = (x, y)=>Math.abs(x[0] * y[0] + x[1] * y[1]) > 0.82;
        const bucketFor = (axis, left, proto)=>{
            let b = buckets.find((q)=>!!q.left === left && aligned(q.axis, axis));
            if (!b) buckets.push(b = {
                name: proto?.name ?? `${left ? 'protected left' : 'through'}`,
                greens: [],
                seconds: proto?.seconds ?? (left ? 14 : 24),
                axis,
                left
            });
            return b;
        };
        const home = new Map();
        for (const i of team)for (const ph of i.phases){
            const b = bucketFor(ph.axis ?? [
                1,
                0
            ], !!ph.left, ph);
            b.seconds = Math.max(b.seconds, ph.seconds);
            for (const c of ph.greens)if (!home.has(c)) {
                home.set(c, b);
                b.greens.push(c);
            }
        }
        const all = team.flatMap((i)=>connsOf.get(i.id) ?? []);
        const axisOf = (c)=>{
            const pts = g.lanes[g.lanes[c].prev[0]].line.pts, a = pts[Math.max(0, pts.length - 2)], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            return [
                (b[0] - a[0]) / L,
                (b[1] - a[1]) / L
            ];
        };
        const leftOnly = (c)=>{
            const from = g.lanes[g.lanes[c].prev[0]], e = g.edges[from.edge];
            if (!e || g.lanes[c].movement !== 'left') return false;
            const t = e.turns[e.lanes.indexOf(from.id)];
            return !!t && t.length === 1 && t[0] === 'left';
        };
        const place = (c, b)=>{
            home.set(c, b);
            b.greens.push(c);
        };
        for(let pass = 0; pass < 5; pass++)for (const c of all){
            if (home.has(c)) continue;
            if (leftOnly(c) && g.edges[g.lanes[g.lanes[c].prev[0]].edge].cls !== 'local') {
                place(c, bucketFor(axisOf(c), true));
                continue;
            }
            const up = g.lanes[g.lanes[c].prev[0]].prev.map((u)=>home.get(u)).find((b)=>b);
            if (up) place(c, up);
        }
        for (const c of all)if (!home.has(c)) place(c, bucketFor(axisOf(c), false));
        const first = buckets[0].axis;
        const rank = (q)=>(aligned(q.axis, first) ? 0 : 2) + (q.left ? 0 : 1);
        const plan = buckets.filter((q)=>q.greens.length).sort((x, y)=>rank(x) - rank(y));
        const yields = new Map();
        for (const i of team)for (const [k, v] of i.yieldTo)yields.set(k, [
            ...yields.get(k) ?? [],
            ...v
        ]);
        const originOf = (c)=>g.lanes[g.lanes[c].prev[0]].edge;
        const heading = (c)=>{
            const a = g.lanes[c].line.pts, p0 = a[0], p1 = a[a.length - 1], n = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
            return [
                (p1[0] - p0[0]) / n,
                (p1[1] - p0[1]) / n
            ];
        };
        const clash = (c, y)=>streamsClash(g, c, y);
        const clashes = (c, ph)=>{
            const on = new Set(ph.greens);
            return (yields.get(c) ?? []).some((y)=>on.has(y) && clash(c, y));
        };
        for(let k = 0; k < plan.length; k++){
            const ph = plan[k];
            for(let guard = 0; guard < 64; guard++){
                let mover = -1;
                for (const c of ph.greens)if (clashes(c, ph) || ph.greens.some((y)=>(yields.get(y) ?? []).includes(c) && clash(c, y))) {
                    mover = originOf(c);
                    break;
                }
                if (mover < 0) break;
                const moving = ph.greens.filter((c)=>originOf(c) === mover);
                ph.greens = ph.greens.filter((c)=>originOf(c) !== mover);
                let to = plan.find((q)=>q !== ph && !moving.some((c)=>clashes(c, q) || q.greens.some((y)=>(yields.get(y) ?? []).includes(c) && clash(c, y))));
                if (!to) plan.push(to = {
                    name: `${g.edges[mover].way.name ?? 'side road'} through`,
                    greens: [],
                    seconds: 18,
                    axis: heading(moving[0]),
                    left: false
                });
                to.greens.push(...moving);
            }
        }
        for(let k = plan.length - 1; k >= 0; k--)if (!plan[k].greens.length) plan.splice(k, 1);
        for (const i of team){
            i.phases = plan;
            i.offset = seed.id * 7.3;
        }
    }
    g.intersections = intersections;
    const intersectionAt = (n)=>{
        const k = nodeToIntersection.get(n);
        return k === undefined ? undefined : intersections[k];
    };
    return {
        legs,
        mouthStart,
        mouthEnd,
        usedCrossings,
        setback,
        endSetback,
        nearSignal,
        intersectionAt
    };
}
export function streamsClash(g, c, y) {
    const lc = g.lanes[c], ly = g.lanes[y];
    if (lc.prev[0] === ly.prev[0] || lc.next[0] === ly.next[0]) return false;
    const ec = g.lanes[lc.prev[0]].edge, ey = g.lanes[ly.prev[0]].edge;
    if (ec === ey) return false;
    const facing = (k)=>{
        const a = g.lanes[k.prev[0]].line.pts, p = a[a.length - 2] ?? a[0], q = a[a.length - 1], n = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
        return [
            (q[0] - p[0]) / n,
            (q[1] - p[1]) / n
        ];
    };
    const fc = facing(lc), fy = facing(ly), dot = fc[0] * fy[0] + fc[1] * fy[1];
    if (dot > 0.8) return false;
    if (dot < -0.7) return lc.movement === 'through' && ly.movement === 'through' ? false : !(lc.movement === 'left' || ly.movement === 'left');
    return true;
}
export function signalState(i, t) {
    if (!i.phases.length) return {
        phase: -1,
        state: 'green',
        left: 0
    };
    const cycle = i.phases.reduce((n, p)=>n + p.seconds + i.yellow + i.allRed, 0);
    let at = (t + (i.offset ?? i.id * 7.3)) % cycle;
    for(let k = 0; k < i.phases.length; k++){
        const p = i.phases[k];
        if (at < p.seconds) return {
            phase: k,
            state: 'green',
            left: p.seconds - at
        };
        at -= p.seconds;
        if (at < i.yellow) return {
            phase: k,
            state: 'yellow',
            left: i.yellow - at
        };
        at -= i.yellow;
        if (at < i.allRed) return {
            phase: k,
            state: 'red',
            left: i.allRed - at
        };
        at -= i.allRed;
    }
    return {
        phase: 0,
        state: 'green',
        left: 0
    };
}
