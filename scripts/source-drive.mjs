// Adapted original vegas-strip-v2 driving checks.
import { readFileSync } from 'node:fs';
import { decode } from '../landmarks/vendor/core/data.js';
import { planIntersections } from '../landmarks/vendor/map/intersections.js';
import { buildLaneGraph, roadMask } from '../landmarks/vendor/map/lanegraph.js';
import { mainValetStops } from '../landmarks/vendor/map/valetstops.js';
import { Driver, planPath, PROFILES, routeIndex } from '../landmarks/vendor/sim/driver.js';
import { arrivesAt, ridePlaces, stopOn } from '../landmarks/vendor/sim/places.js';
import { ROBOTAXI_DIMENSIONS } from '../world/robotaxi-dimensions.mjs';
const data = decode(JSON.parse(readFileSync('landmarks/footprints.json', 'utf8')));
const graph = buildLaneGraph(data);
planIntersections(data, graph);
graph.valets = mainValetStops(graph);
const idx = routeIndex(graph);
const places = ridePlaces(graph, data);
const onRoad = roadMask(graph, true);
const by = (n)=>{
    const p = places.find((q)=>q.name === n);
    if (!p) throw new Error(`no place ${n}`);
    return p;
};
const CARS = {
    Zoox: ROBOTAXI_DIMENSIONS.zoox,
    Waymo: ROBOTAXI_DIMENSIONS.waymo,
    Tesla: ROBOTAXI_DIMENSIONS.tesla,
    Robovan: ROBOTAXI_DIMENSIONS.robovan
};
const carNames = ['Zoox', 'Waymo', 'Tesla'];
const lanesAt = (p)=>{
    const g = arrivesAt(graph, p);
    return graph.lanes.filter((l)=>g(l) && l.line.length > 0).map((l)=>l.id);
};
const rows = [];
const allGaps = [];
let reversals = 0;
const perStyle = {};
let worstOver = 0;
const feel = {
    steer: [],
    top: []
};
const STYLES = [
    'normal',
    'sloth',
    'hurry',
    'madmax'
];
function ride(a, b, n, only, car = carNames[n % carNames.length]) {
    const dims = CARS[car], style = PROFILES[only ?? STYLES[n % STYLES.length]];
    const name = `${a.name} → ${b.name} (${car}, ${style.label})`;
    const goal = arrivesAt(graph, b);
    const path = planPath(graph, idx, {
        from: lanesAt(a),
        goal,
        heur: [
            b.x,
            b.z
        ],
        stopS: stopOn(b)
    });
    if (!path) {
        rows.push({
            name,
            ok: false,
            km: 0,
            mins: 0,
            signals: 0,
            stops: 0,
            red: 0,
            over: 0,
            err: 0,
            off: 0,
            late: 0,
            changes: 0,
            R: 0,
            note: 'no route'
        });
        return;
    }
    const d = new Driver(path, dims, undefined, style);
    let t = n * 41, sim = 0;
    const limit = 120 + path.length * 3;
    let lastSteer = 0, steerWork = 0, lastAccel = 0, jerkSum = 0, vSum = 0, topV = 0;
    while(!d.done && sim < limit){
        d.step(0.05, t, Infinity, onRoad);
        t += 0.05;
        sim += 0.05;
        steerWork += Math.abs(d.steer - lastSteer);
        lastSteer = d.steer;
        jerkSum += Math.abs(d.accel - lastAccel);
        lastAccel = d.accel;
        vSum += d.v;
        topV = Math.max(topV, d.v);
    }
    worstOver = Math.max(worstOver, d.log.worstOverrun);
    const row = perStyle[style.key] ??= {
        km: 0,
        sec: 0,
        red: 0,
        over: 0,
        err: 0,
        n: 0
    };
    row.km += path.length / 1000;
    row.sec += sim;
    row.red += d.log.redLights;
    row.over += d.log.overruns;
    row.err = Math.max(row.err, d.log.maxError);
    row.n++;
    feel.steer.push(steerWork / Math.max(path.length / 1000, 0.1));
    feel.top.push(topV * 2.237);
    const late = path.changes.filter((c)=>c.deadlineS - c.endS < 12).length;
    {
        let was = 0, wasEnd = -1e9;
        for (const c of path.changes){
            const i0 = Math.round(Math.min(c.startS, path.length)), i1 = Math.round(Math.min(c.endS, path.length)), h = path.heading[i0];
            const bend = Math.abs(Math.atan2(Math.sin(path.heading[i1] - h), Math.cos(path.heading[i1] - h)));
            if (bend > 0.5) continue;
            const side = (path.xs[i1] - path.xs[i0]) * Math.cos(h) - (path.zs[i1] - path.zs[i0]) * Math.sin(h) > 0 ? 1 : -1;
            if (was && side !== was && c.startS - wasEnd < 150) reversals++;
            was = side;
            wasEnd = c.endS;
        }
    }
    for (const c of path.changes)allGaps.push(c.deadlineS - c.endS);
    const unfinished = !d.done;
    const ok = !unfinished && !d.log.stuck && d.log.redLights === 0 && d.log.overruns === 0 && d.log.maxError < 1.0 && d.log.offRoad === 0 && path.tightest.r >= 4.5;
    const note = [
        unfinished ? 'unfinished' : '',
        d.log.stuck ? 'stuck' : '',
        d.log.maxError >= 1.0 ? `off line at ${d.log.maxErrorAt.map((v)=>v.toFixed(0))}` : '',
        d.log.offRoad ? `off pavement x${d.log.offRoad} at ${d.log.offAt.map((q)=>q.map((v)=>v.toFixed(0)).join(',')).join(' ')}` : '',
        late ? `${late} late changes` : '',
        path.tightest.r < 4.5 ? `tight R${path.tightest.r.toFixed(1)} at ${path.tightest.x.toFixed(0)},${path.tightest.z.toFixed(0)}` : ''
    ].filter(Boolean).join(', ');
    rows.push({
        name,
        ok,
        km: path.length / 1000,
        mins: sim / 60,
        signals: path.signals.length,
        stops: d.log.stops,
        red: d.log.redLights,
        over: d.log.overruns,
        err: d.log.maxError,
        off: d.log.offRoad,
        late,
        changes: path.changes.length,
        R: path.tightest.r,
        note
    });
}
const CLASSIC = [
    [
        'Caesars Palace',
        'Bellagio'
    ],
    [
        'Bellagio',
        'Fontainebleau'
    ],
    [
        'Planet Hollywood',
        'Wynn Las Vegas'
    ],
    [
        'MGM Grand',
        'Caesars Palace'
    ],
    [
        'The Cosmopolitan',
        'The Venetian'
    ],
    [
        'Mandalay Bay',
        'Resorts World'
    ],
    [
        'The STRAT',
        'Luxor'
    ],
    [
        'New York-New York',
        'Sphere'
    ],
    [
        'Sphere',
        'T-Mobile Arena'
    ],
    [
        'Allegiant Stadium',
        'ARIA'
    ],
    [
        'Fremont Street',
        'Bellagio'
    ],
    [
        'Encore',
        'Paris Las Vegas'
    ],
    [
        'Flamingo Las Vegas',
        'The LINQ'
    ],
    [
        'Treasure Island',
        'Excalibur'
    ],
    [
        'Convention Center',
        'Wynn Las Vegas'
    ]
];
let n = 0;
for (const [a, b] of CLASSIC)ride(by(a), by(b), n++);
for(let i = 0; i < places.length; i++)ride(places[i], places[(i + 7) % places.length], n++);
const sameRoute = [];
for (const key of STYLES){
    for (const k of Object.keys(perStyle))delete perStyle[k];
    for (const [a, b] of CLASSIC.slice(0, 6))ride(by(a), by(b), 2, key);
    const v = perStyle[key];
    sameRoute.push(`  ${key.padEnd(7)} ${(v.sec / 60).toFixed(1)} min for ${v.km.toFixed(1)} km · ${(v.km / v.sec * 2237).toFixed(1)} mph average · red lights ${v.red} · nose over line ${v.over} · worst off line ${v.err.toFixed(2)} m`);
}
ride(by('ARIA'), by('Bellagio'), 0, 'normal', 'Robovan');
ride(by('MGM Grand'), by('The Venetian'), 1, 'normal', 'Robovan');
ride(by('Mandalay Bay'), by('Resorts World'), 2, 'normal', 'Robovan');
for (const r of rows)console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(62)} ${r.km.toFixed(2).padStart(5)} km ${r.mins.toFixed(1).padStart(4)} min  signals ${String(r.signals).padStart(2)} stopped ${String(r.stops).padStart(2)}  off line ${r.err.toFixed(2)} m  lane changes ${r.changes}  tightest ${r.R.toFixed(1)} m${r.note ? `   ${r.note}` : ''}`);
const sum = (f)=>rows.reduce((t, r)=>t + f(r), 0);
const bad = rows.filter((r)=>!r.ok);
const errs = rows.map((r)=>r.err).sort((a, b)=>a - b);
console.log(`\n${places.length} places · ${rows.length} rides · ${rows.length - bad.length} clean · ${sum((r)=>r.km).toFixed(1)} km · ${sum((r)=>r.signals)} signals, ${sum((r)=>r.stops)} stops`);
console.log(`red lights ${sum((r)=>r.red)} · nose over a stop line ${sum((r)=>r.over)} (worst ${worstOver.toFixed(2)} m) · late lane changes ${sum((r)=>r.late)} of ${sum((r)=>r.changes)} · off pavement ${sum((r)=>r.off)}`);
const settle = rows.length ? allGaps.slice().sort((a, b)=>a - b) : [];
console.log(`lane changes finish a median ${settle[settle.length >> 1]?.toFixed(0)} m before the turn they're for`);
const med = (a)=>a.slice().sort((x, y)=>x - y)[a.length >> 1] ?? 0;
console.log(`steering movement ${med(feel.steer).toFixed(2)} rad per km (median) · top speed ${med(feel.top).toFixed(0)} mph (median ride)`);
console.log(`off the lane line: median ride worst ${errs[errs.length >> 1]?.toFixed(2)} m, worst of all ${errs[errs.length - 1]?.toFixed(2)} m`);
console.log(`lane reversals (one way and back within 150 m): ${reversals}`);
console.log('\nThe same six rides in each style:');
for (const l of sameRoute)console.log(l);
if (bad.length) {
    console.error(`\nFAILED: ${bad.length} rides`);
    process.exit(1);
}
console.log('\nOK');
