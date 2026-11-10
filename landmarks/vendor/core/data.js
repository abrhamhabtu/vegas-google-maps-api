// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const pts = (p)=>{
    const out = new Array(p.length / 2);
    for(let i = 0; i < p.length; i += 2)out[i / 2] = [
        p[i] / 10,
        p[i + 1] / 10
    ];
    return out;
};
function solveRoadElevations(roads) {
    const isRampOrSvc = (r)=>r.hw.endsWith('_link') || r.hw === 'service';
    const DECK1 = 6.5, DECK2 = 12.5;
    const segCross = (a, b, c, d)=>{
        const dx1 = b[0] - a[0], dz1 = b[1] - a[1], dx2 = d[0] - c[0], dz2 = d[1] - c[1];
        const den = dx1 * dz2 - dz1 * dx2;
        if (Math.abs(den) <= 1e-6) return null;
        const t = ((c[0] - a[0]) * dz2 - (c[1] - a[1]) * dx2) / den;
        const u = ((c[0] - a[0]) * dz1 - (c[1] - a[1]) * dx1) / den;
        if (t >= -0.05 && t <= 1.05 && u >= -0.05 && u <= 1.05) {
            return [
                a[0] + dx1 * Math.max(0, Math.min(1, t)),
                a[1] + dz1 * Math.max(0, Math.min(1, t))
            ];
        }
        return null;
    };
    const GCELL = 80;
    const roadGrid = new Map();
    for (const r of roads){
        if (r.tn || r.hw === 'service') continue;
        for(let i = 0; i < r.pts.length - 1; i++){
            const a = r.pts[i], b = r.pts[i + 1];
            const x0 = Math.floor(Math.min(a[0], b[0]) / GCELL), x1 = Math.floor(Math.max(a[0], b[0]) / GCELL);
            const z0 = Math.floor(Math.min(a[1], b[1]) / GCELL), z1 = Math.floor(Math.max(a[1], b[1]) / GCELL);
            for(let gx = x0; gx <= x1; gx++)for(let gz = z0; gz <= z1; gz++){
                const k = `${gx},${gz}`;
                let list = roadGrid.get(k);
                if (!list) roadGrid.set(k, list = []);
                list.push([
                    r,
                    a,
                    b
                ]);
            }
        }
    }
    const crossL1 = [], crossL2 = [];
    for (const r of roads){
        if (!r.br || r.tn) continue;
        const rl = r.layer ?? 1;
        for(let i = 0; i < r.pts.length - 1; i++){
            const a = r.pts[i], b = r.pts[i + 1];
            const x0 = Math.floor(Math.min(a[0], b[0]) / GCELL), x1 = Math.floor(Math.max(a[0], b[0]) / GCELL);
            const z0 = Math.floor(Math.min(a[1], b[1]) / GCELL), z1 = Math.floor(Math.max(a[1], b[1]) / GCELL);
            for(let gx = x0; gx <= x1; gx++)for(let gz = z0; gz <= z1; gz++){
                for (const [o, c, d] of roadGrid.get(`${gx},${gz}`) ?? []){
                    if (o === r) continue;
                    const ol = o.br ? o.layer ?? 1 : 0;
                    if (ol >= rl) continue;
                    const hit = segCross(a, b, c, d);
                    if (hit) {
                        if (ol >= 1) crossL2.push(hit);
                        else crossL1.push(hit);
                    }
                }
            }
        }
    }
    const linkTo = (g, a, b, d, grade)=>{
        let la = g.get(a);
        if (!la) g.set(a, la = []);
        let lb = g.get(b);
        if (!lb) g.set(b, lb = []);
        la.push({
            to: b,
            d,
            grade
        });
        lb.push({
            to: a,
            d,
            grade
        });
    };
    const heap = [];
    const pushMax = (n, h)=>{
        heap.push([
            h,
            n
        ]);
        let i = heap.length - 1;
        while(i > 0){
            const p = i - 1 >> 1;
            if (heap[p][0] >= heap[i][0]) break;
            const tmp = heap[p];
            heap[p] = heap[i];
            heap[i] = tmp;
            i = p;
        }
    };
    const popMax = ()=>{
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let i = 0;
            for(;;){
                const l = 2 * i + 1, r = l + 1;
                let m = i;
                if (l < heap.length && heap[l][0] > heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] > heap[m][0]) m = r;
                if (m === i) break;
                const tmp = heap[m];
                heap[m] = heap[i];
                heap[i] = tmp;
                i = m;
            }
        }
        return top;
    };
    const onBridgeNode = new Set();
    const mainNodeNames = new Map();
    const stripNodes = new Set();
    for (const r of roads){
        if (r.tn) continue;
        if (r.br) for (const nd of r.n)onBridgeNode.add(nd);
        if (!r.br && /Las Vegas Boulevard/i.test(r.name ?? '')) {
            for (const nd of r.n)stripNodes.add(nd);
        }
        if (!r.br && !isRampOrSvc(r)) {
            const label = r.name ?? `${r.hw}:${r.id}`;
            for (const nd of r.n){
                let s = mainNodeNames.get(nd);
                if (!s) mainNodeNames.set(nd, s = new Set());
                s.add(label);
            }
        }
    }
    const atGradeCrossNode = new Set();
    for (const nd of stripNodes)if (!onBridgeNode.has(nd)) atGradeCrossNode.add(nd);
    for (const [nd, names] of mainNodeNames){
        if (names.size >= 2 && !onBridgeNode.has(nd)) atGradeCrossNode.add(nd);
    }
    const mainGraph = new Map();
    const H = new Map();
    for (const r of roads){
        if (r.tn || isRampOrSvc(r)) continue;
        const grade = r.hw === 'motorway' || r.hw === 'trunk' ? 0.048 : 0.056;
        for(let i = 0; i < r.n.length - 1; i++){
            const d = Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
            linkTo(mainGraph, r.n[i], r.n[i + 1], d, grade);
        }
        if (r.br) {
            const isL2 = (r.layer ?? 1) >= 2;
            const roadMinD1 = Math.min(...r.pts.map((p)=>{
                let md = Infinity;
                for (const cp of crossL1){
                    const d = Math.hypot(p[0] - cp[0], p[1] - cp[1]);
                    if (d < md) md = d;
                }
                for (const cp of crossL2){
                    const d = Math.hypot(p[0] - cp[0], p[1] - cp[1]);
                    if (d < md) md = d;
                }
                return md;
            }));
            if (roadMinD1 <= 160) {
                for(let i = 0; i < r.n.length; i++){
                    const p = r.pts[i], nd = r.n[i];
                    let target = DECK1;
                    if (isL2) {
                        let minD = Infinity;
                        for (const cp of crossL2){
                            const d = Math.hypot(p[0] - cp[0], p[1] - cp[1]);
                            if (d < minD) minD = d;
                        }
                        if (minD <= 45) target = DECK2;
                        else if (minD < 45 + (DECK2 - DECK1) / 0.05) target = DECK2 - (minD - 45) * 0.05;
                    }
                    H.set(nd, Math.max(H.get(nd) ?? 0, target));
                }
            }
        }
    }
    for (const [n, h] of H)pushMax(n, h);
    while(heap.length){
        const [h, n] = popMax();
        if ((H.get(n) ?? 0) > h + 1e-6) continue;
        for (const { to, d, grade } of mainGraph.get(n) ?? []){
            if (atGradeCrossNode.has(to)) continue;
            const nh = h - grade * d;
            if (nh > 0.05 && nh > (H.get(to) ?? 0) + 1e-4) {
                H.set(to, nh);
                pushMax(to, nh);
            }
        }
    }
    for(let pass = 0; pass < 3; pass++){
        for (const r of roads){
            if (r.tn || isRampOrSvc(r) || r.br) continue;
            const h0 = H.get(r.n[0]) ?? 0, h1 = H.get(r.n[r.n.length - 1]) ?? 0;
            if (h0 >= 4.0 && h1 >= 4.0) {
                let totalL = 0;
                const cum = [
                    0
                ];
                for(let i = 1; i < r.pts.length; i++){
                    totalL += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
                    cum.push(totalL);
                }
                if (totalL < 165 && !r.n.some((nd)=>atGradeCrossNode.has(nd))) {
                    for(let i = 1; i < r.n.length - 1; i++){
                        const want = h0 + (h1 - h0) * (cum[i] / (totalL || 1));
                        if (want > (H.get(r.n[i]) ?? 0)) H.set(r.n[i], want);
                    }
                }
            }
        }
    }
    const mainNodes = new Set(mainGraph.keys());
    const rampGraph = new Map();
    for (const r of roads){
        if (r.tn || !isRampOrSvc(r)) continue;
        const grade = r.hw === 'service' ? 0.075 : 0.056;
        for(let i = 0; i < r.n.length - 1; i++){
            const d = Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
            linkTo(rampGraph, r.n[i], r.n[i + 1], d, grade);
        }
        if (r.br) {
            const isL2 = (r.layer ?? 1) >= 2;
            for(let i = 0; i < r.n.length; i++){
                const p = r.pts[i], nd = r.n[i];
                if (mainNodes.has(nd)) continue;
                let minD2 = Infinity, minD1 = Infinity;
                if (isL2) for (const cp of crossL2){
                    const d = Math.hypot(p[0] - cp[0], p[1] - cp[1]);
                    if (d < minD2) minD2 = d;
                }
                for (const cp of crossL1){
                    const d = Math.hypot(p[0] - cp[0], p[1] - cp[1]);
                    if (d < minD1) minD1 = d;
                }
                let target = 0;
                if (isL2 && minD2 <= 50) target = DECK2;
                else if (isL2 && minD2 < 50 + (DECK2 - DECK1) / 0.052) target = DECK2 - (minD2 - 50) * 0.052;
                else if (minD1 <= 45 || minD2 <= 90) target = DECK1;
                if (target > 0) H.set(nd, Math.max(H.get(nd) ?? 0, target));
            }
        }
    }
    for (const nd of rampGraph.keys()){
        const h = H.get(nd) ?? 0;
        if (h > 0) pushMax(nd, h);
    }
    while(heap.length){
        const [h, n] = popMax();
        if ((H.get(n) ?? 0) > h + 1e-6) continue;
        for (const { to, d, grade } of rampGraph.get(n) ?? []){
            if (mainNodes.has(to)) continue;
            const nh = h - grade * d;
            if (nh > 0.05 && nh > (H.get(to) ?? 0) + 1e-4) {
                H.set(to, nh);
                pushMax(to, nh);
            }
        }
    }
    const maxH = new Map();
    const minHeap = [];
    const pushMin = (n, h)=>{
        minHeap.push([
            h,
            n
        ]);
        let i = minHeap.length - 1;
        while(i > 0){
            const p = i - 1 >> 1;
            if (minHeap[p][0] <= minHeap[i][0]) break;
            const tmp = minHeap[p];
            minHeap[p] = minHeap[i];
            minHeap[i] = tmp;
            i = p;
        }
    };
    const popMin = ()=>{
        const top = minHeap[0];
        const last = minHeap.pop();
        if (minHeap.length) {
            minHeap[0] = last;
            let i = 0;
            for(;;){
                const l = 2 * i + 1, r = l + 1;
                let m = i;
                if (l < minHeap.length && minHeap[l][0] < minHeap[m][0]) m = l;
                if (r < minHeap.length && minHeap[r][0] < minHeap[m][0]) m = r;
                if (m === i) break;
                const tmp = minHeap[m];
                minHeap[m] = minHeap[i];
                minHeap[i] = tmp;
                i = m;
            }
        }
        return top;
    };
    for (const nd of atGradeCrossNode){
        maxH.set(nd, 0);
        pushMin(nd, 0);
    }
    while(minHeap.length){
        const [h, n] = popMin();
        if ((maxH.get(n) ?? Infinity) < h - 1e-6) continue;
        for (const { to, d } of mainGraph.get(n) ?? []){
            if (onBridgeNode.has(to)) continue;
            const nh = h + 0.072 * d;
            if (nh < (maxH.get(to) ?? Infinity) - 1e-4) {
                maxH.set(to, nh);
                pushMin(to, nh);
            }
        }
    }
    for (const [nd, mh] of maxH){
        if ((H.get(nd) ?? 0) > mh) H.set(nd, mh);
    }
    for (const nd of rampGraph.keys()){
        if (mainNodes.has(nd) || (H.get(nd) ?? 0) === 0) {
            const h0 = H.get(nd) ?? 0;
            maxH.set(nd, h0);
            pushMin(nd, h0);
        }
    }
    while(minHeap.length){
        const [h, n] = popMin();
        if ((maxH.get(n) ?? Infinity) < h - 1e-6) continue;
        for (const { to, d } of rampGraph.get(n) ?? []){
            const nh = h + 0.072 * d;
            if (nh < (maxH.get(to) ?? Infinity) - 1e-4) {
                maxH.set(to, nh);
                pushMin(to, nh);
            }
        }
    }
    for (const [nd, mh] of maxH){
        if ((H.get(nd) ?? 0) > mh) H.set(nd, mh);
    }
    for (const r of roads){
        if (r.tn) {
            r.y = undefined;
            continue;
        }
        const hs = r.n.map((nd)=>Math.round((H.get(nd) ?? 0) * 100) / 100);
        if (!hs.some((v)=>v > 0.15)) {
            r.y = undefined;
            continue;
        }
        for(let pass = 0; pass < 3; pass++){
            for(let i = 1; i < hs.length - 1; i++){
                if (hs[i] <= 0.02 && hs[i - 1] <= 0.1 && hs[i + 1] <= 0.1) continue;
                hs[i] = Math.round((0.25 * hs[i - 1] + 0.5 * hs[i] + 0.25 * hs[i + 1]) * 100) / 100;
            }
        }
        r.y = hs;
    }
}
export function decode(raw) {
    const dm = (v)=>v?.map((h)=>h / 10);
    const roads = raw.roads.map((r)=>({
            ...r,
            pts: pts(r.p),
            y: r.y ? r.y.map((h)=>Math.max(0, h / 10)) : undefined,
            p: undefined
        }));
    solveRoadElevations(roads);
    return {
        origin: raw.origin,
        attribution: raw.attribution,
        roads,
        walks: raw.walks.map((r)=>({
                ...r,
                pts: pts(r.p),
                y: dm(r.y),
                p: undefined
            })),
        buildings: raw.buildings.map((b)=>({
                ...b,
                pts: pts(b.p),
                p: undefined
            })),
        areas: raw.areas.map((a)=>({
                ...a,
                pts: pts(a.p),
                p: undefined
            })),
        rail: raw.rail.map((r)=>({
                ...r,
                pts: pts(r.p)
            })),
        barriers: raw.barriers.map((b)=>({
                pts: pts(b.p),
                h: b.h
            })),
        signals: raw.signals.map((s)=>({
                id: s.id,
                x: s.p[0] / 10,
                z: s.p[1] / 10,
                dir: s.dir
            })),
        crossings: raw.crossings.map((s)=>({
                id: s.id,
                x: s.p[0] / 10,
                z: s.p[1] / 10,
                k: s.k,
                m: s.m
            })),
        trees: Float32Array.from(raw.trees, (v, i)=>i % 3 === 2 ? v : v / 10),
        pois: raw.pois.map((p)=>({
                n: p.n,
                k: p.k,
                x: p.p[0] / 10,
                z: p.p[1] / 10,
                area: p.area
            }))
    };
}
export async function loadMap(onProgress) {
    const res = await fetch(`${import.meta.env.BASE_URL}data/vegas.json`);
    if (!res.ok || !res.body) throw new Error(`map data: HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 40e6;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for(;;){
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        onProgress(Math.min(0.99, got / total));
    }
    const buf = new Uint8Array(got);
    let o = 0;
    for (const c of chunks){
        buf.set(c, o);
        o += c.length;
    }
    return decode(JSON.parse(new TextDecoder().decode(buf)));
}
const R = 6378137;
export function latLonToXZ(origin, lat, lon) {
    const k = Math.cos(origin.lat * Math.PI / 180);
    return [
        (lon - origin.lon) * Math.PI / 180 * R * k,
        -((lat - origin.lat) * Math.PI) / 180 * R
    ];
}
