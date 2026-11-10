// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { latLonToXZ } from '../core/data.js';
import { MAIN_VALET, nearestDrive } from '../map/valetstops.js';
import { ORIGIN, PLACES } from '../places.js';
const EXTRA_POIS = [
    [
        'Planet Hollywood',
        /^planet hollywood$/i
    ],
    [
        'The LINQ',
        /^the linq hotel \+ experience$/i
    ],
    [
        "Harrah's",
        /^harrah's las vegas$/i
    ]
];
const FROM_PLACES = [
    [
        'Sphere',
        'Sphere'
    ],
    [
        'T-Mobile Arena',
        'T-Mobile Arena'
    ],
    [
        'Allegiant Stadium',
        'Allegiant Stadium'
    ],
    [
        'Fremont Street',
        'Fremont Street Experience'
    ],
    [
        'Convention Center',
        'Las Vegas Convention Center'
    ],
    [
        'Welcome Sign',
        'Welcome to Fabulous Las Vegas'
    ]
];
export function ridePlaces(g, data) {
    const out = [];
    const linked = (edge)=>{
        const flood = (dir)=>{
            const seen = new Set(g.edges[edge].lanes), stack = [
                ...seen
            ];
            while(stack.length && seen.size < 600)for (const w of g.lanes[stack.pop()][dir])if (!seen.has(w)) {
                seen.add(w);
                stack.push(w);
            }
            return seen.size >= 600;
        };
        return flood('next') && flood('prev');
    };
    const add = (name, c, reach)=>{
        const hit = nearestDrive(g, c, reach);
        if (hit && linked(hit.edge)) {
            out.push({
                name,
                x: hit.x,
                z: hit.z,
                edge: hit.edge,
                s: hit.s
            });
            return;
        }
        let best = Infinity, found = null;
        for (const e of g.edges){
            if (e.internal || e.elevated || !e.lanes.length || e.cls !== 'service' && e.cls !== 'collector' && e.cls !== 'local') continue;
            const p = e.ref.pts[0];
            if (Math.abs(p[0] - c[0]) > reach * 2 || Math.abs(p[1] - c[1]) > reach * 2) continue;
            for (const q of e.ref.pts){
                const d = Math.hypot(q[0] - c[0], q[1] - c[1]);
                if (d < best && linked(e.id)) {
                    best = d;
                    found = {
                        name,
                        x: q[0],
                        z: q[1],
                        edge: e.id,
                        s: 0
                    };
                }
            }
        }
        if (found) out.push(found);
    };
    for (const [name, c] of Object.entries(MAIN_VALET))add(name, c, 40);
    for (const [name, re] of EXTRA_POIS){
        const p = data.pois.find((q)=>re.test(q.n));
        if (p) add(name, [
            p.x,
            p.z
        ], 160);
    }
    for (const [name, id] of FROM_PLACES){
        const p = PLACES.find((q)=>q.name === id);
        if (p) add(name, latLonToXZ(ORIGIN, p.lat, p.lon), 220);
    }
    return out.sort((a, b)=>a.name.replace(/^The /, '').localeCompare(b.name.replace(/^The /, '')));
}
export function arrivesAt(g, p) {
    const e = g.edges[p.edge];
    return (l)=>{
        if (l.connector) return false;
        if (l.edge === p.edge || e.twin !== undefined && l.edge === e.twin) return true;
        const edge = g.edges[l.edge];
        if (!edge || edge.internal || edge.elevated || edge.cls !== 'service' && edge.cls !== 'local' && edge.cls !== 'collector') return false;
        return l.line.pts.some((q)=>Math.hypot(q[0] - p.x, q[1] - p.z) < 16);
    };
}
export function stopOn(p) {
    return (l)=>{
        let best = Infinity, at = null;
        for(let i = 0; i < l.line.pts.length; i++){
            const q = l.line.pts[i], d = Math.hypot(q[0] - p.x, q[1] - p.z);
            if (d < best) {
                best = d;
                at = l.line.cum[i];
            }
        }
        return at;
    };
}
