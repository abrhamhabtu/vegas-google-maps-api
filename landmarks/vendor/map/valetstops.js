// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { sample } from './lanegraph.js';
export const MAIN_VALET = {
    'MGM Grand': [
        556,
        1626
    ],
    'Mandalay Bay': [
        47,
        2676
    ],
    'New York-New York': [
        -12,
        1652
    ],
    'Bellagio': [
        -66,
        470
    ],
    'Caesars Palace': [
        8,
        11
    ],
    'ARIA': [
        -122,
        989
    ],
    'The Cosmopolitan': [
        -30,
        854
    ],
    'Luxor': [
        23,
        2311
    ],
    'Excalibur': [
        18,
        1853
    ],
    'Paris Las Vegas': [
        365,
        351
    ],
    'Flamingo Las Vegas': [
        419,
        32
    ],
    'The Venetian': [
        460,
        -441
    ],
    'Treasure Island': [
        133,
        -924
    ],
    'Wynn Las Vegas': [
        703,
        -1202
    ],
    'Encore': [
        917,
        -1468
    ],
    'Resorts World': [
        801,
        -2113
    ],
    'Fontainebleau': [
        1244,
        -2229
    ],
    'The STRAT': [
        1588,
        -3527
    ]
};
export function nearestDrive(g, c, reach = 40) {
    let best = reach, hit = null;
    for (const e of g.edges){
        if (e.cls !== 'service' && e.cls !== 'collector' && e.cls !== 'local') continue;
        const p = e.ref.pts[0];
        if (Math.abs(p[0] - c[0]) > 400 || Math.abs(p[1] - c[1]) > 400) continue;
        for(let at = 0; at <= e.ref.length; at += 3){
            const q = sample(e.ref, at), d = Math.hypot(q.x - c[0], q.z - c[1]);
            if (d < best) {
                best = d;
                hit = {
                    edge: e.id,
                    s: at,
                    x: q.x,
                    z: q.z
                };
            }
        }
    }
    return hit;
}
export function mainValetStops(g) {
    const out = [];
    for (const [name, c] of Object.entries(MAIN_VALET)){
        const h = nearestDrive(g, c);
        if (h) out.push({
            name,
            main: true,
            ...h
        });
    }
    return out;
}
