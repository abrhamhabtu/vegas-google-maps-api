// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
import { sameRoadLevel } from '../../../world/road-surface.mjs';
const THREE = window.THREE;
import { theme } from '../core/theme.js';
import { beamMaterial, buildPedestrian, buildVehicle, CAR_NAMES } from '../cars/vehicles.js';
import { roadMask } from '../map/lanegraph.js';
import { Driver, laneAt, MIN_TURN_RADIUS, planPath, PROFILES, routeIndex, wanderPath } from './driver.js';
import { arrivesAt, ridePlaces, stopOn } from './places.js';
export const SCENARIOS = {
    city: 'Open city',
    blocked: 'Blocked lane',
    phantom: 'Phantom brake',
    tailgater: 'Tailgater',
    intrusion: 'Lane intrusion',
    crossing: 'Crossing traffic',
    runner: 'Red-light runner',
    pedestrian: 'Pedestrian'
};
const ROBOTAXIS = [
    'zoox',
    'waymo',
    'tesla',
    'waymo',
    'zoox',
    'tesla'
];
const DWELL = 5;
export class FleetCar {
    kind;
    vehicle;
    role;
    driver = null;
    phase = 'cruising';
    x = 0;
    y = 0;
    z = 0;
    yaw = 0;
    v = 0;
    steer = 0;
    pickup = null;
    dropoff = null;
    dwell = 0;
    profile = PROFILES.normal;
    gap = Infinity;
    gapSpeed = 0;
    gapFrom = null;
    sinceChange = 0;
    passStarted = 0;
    lastX = 0;
    lastZ = 0;
    lastV = 0;
    script = null;
    constructor(kind, vehicle, role){
        this.kind = kind;
        this.vehicle = vehicle;
        this.role = role;
    }
    get name() {
        return CAR_NAMES[this.kind] ?? this.kind;
    }
    get dims() {
        const s = this.vehicle.size;
        return {
            wheelbase: s.wheelbase,
            nose: s.nose,
            length: s.length,
            width: s.width
        };
    }
    get cx() {
        return this.x + Math.sin(this.yaw) * (this.dims.nose - this.dims.length / 2);
    }
    get cz() {
        return this.z + Math.cos(this.yaw) * (this.dims.nose - this.dims.length / 2);
    }
    place(x, z, yaw) {
        this.x = x;
        this.z = z;
        this.yaw = yaw;
        this.lastX = x;
        this.lastZ = z;
        this.vehicle.root.visible = true;
        this.sync(0, 0);
    }
    sync(night, dt) {
        const root = this.vehicle.root;
        root.position.set(this.x, this.y + 0.02, this.z);
        root.rotation.y = this.yaw - Math.PI / 2;
        root.updateMatrix();
        const moved = Math.hypot(this.x - this.lastX, this.z - this.lastZ);
        this.lastX = this.x;
        this.lastZ = this.z;
        const accel = dt > 0 ? (this.v - this.lastV) / dt : 0;
        this.lastV = this.v;
        this.vehicle.animate(moved, this.steer, accel, this.v * this.v / this.dims.wheelbase * Math.tan(this.steer));
        this.vehicle.beams.visible = night > 0.15;
        root.traverse((o)=>{
            if (o.matrixAutoUpdate) o.updateMatrix();
        });
        root.updateMatrixWorld(true);
    }
}
const blankTelemetry = ()=>({
        seconds: 0,
        metres: 0,
        collisions: 0,
        redLights: 0,
        aeb: 0,
        hardStops: 0,
        passes: 0,
        yields: 0,
        lane: 0,
        samples: 0
    });
export class Fleet {
    engine;
    controls;
    g;
    cars = [];
    group = new THREE.Group();
    places;
    selected;
    following = false;
    cameraMode = 'chase';
    telemetry = blankTelemetry();
    scenario = null;
    lastResult = null;
    onChange = ()=>{};
    traffic = [];
    density = 14;
    idx = null;
    keys = new Set();
    ribbon;
    ribbonPos;
    ribbonAlpha;
    planning = 0;
    blocks = new Map();
    lastDrag = -1e9;
    dragging = false;
    downAt = [
        0,
        0
    ];
    spawnLanes = [];
    frame = 0;
    tacticClock = 0;
    touching = new Set();
    seen = new WeakMap();
    rng = Math.random;
    constructor(engine, controls, g, data){
        this.engine = engine;
        this.controls = controls;
        this.g = g;
        this.group.name = 'road users';
        this.places = ridePlaces(g, data);
        roadMask(g, true);
        for (const k of ROBOTAXIS)this.cars.push(this.make(k, 'robotaxi'));
        this.selected = this.cars[2];
        this.indexBuildings(data);
        for (const e of g.edges)if ((e.cls === 'arterial' || e.cls === 'collector') && !e.internal && !e.elevated && e.oneway && e.ref.length > 60) for (const l of e.lanes)this.spawnLanes.push(l);
        const N = 44;
        this.ribbonPos = new Float32Array(N * 6);
        this.ribbonAlpha = new Float32Array(N * 2);
        const idx = [];
        for(let i = 0; i < N - 1; i++){
            const a = i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.ribbonPos, 3));
        geo.setAttribute('alpha', new THREE.BufferAttribute(this.ribbonAlpha, 1));
        geo.setIndex(idx);
        this.ribbon = new THREE.Mesh(geo, new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            toneMapped: false,
            uniforms: {
                col: {
                    value: new THREE.Color('#3fa2ff')
                }
            },
            vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
            fragmentShader: `varying float vA; uniform vec3 col; void main(){ gl_FragColor = vec4(col * 1.4, vA); }`
        }));
        this.ribbon.frustumCulled = false;
        this.ribbon.renderOrder = 53;
        this.ribbon.visible = false;
        this.group.add(this.ribbon);
        this.engine.listen(window, 'keydown', (e)=>{
            if (!this.controls.driving || this.paused || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName) || e.target?.isContentEditable || document.querySelector('[aria-modal="true"]:not(.hidden)')?.closest('.modal-backdrop:not(.hidden)')) return;
            const k = e.key.toLowerCase();
            if ([
                'w',
                'a',
                's',
                'd',
                ' ',
                'arrowup',
                'arrowdown',
                'arrowleft',
                'arrowright'
            ].includes(k)) {
                this.keys.add(k);
                e.preventDefault();
                this.engine.invalidate(true);
            }
        });
        this.engine.listen(window, 'keyup', (e)=>this.keys.delete(e.key.toLowerCase()));
        this.engine.listen(window, 'blur', ()=>this.keys.clear());
        const canvas = engine.canvas;
        this.engine.listen(canvas, 'pointerdown', (e)=>{
            this.downAt = [
                e.clientX,
                e.clientY
            ];
            this.dragging = true;
        });
        this.engine.listen(canvas, 'pointermove', (e)=>{
            if (this.dragging && Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 6) this.lastDrag = performance.now();
        });
        this.engine.listen(window, 'pointerup', ()=>{
            this.dragging = false;
        });
        this.engine.listen(canvas, 'wheel', ()=>{
            this.lastDrag = Math.max(this.lastDrag, performance.now() - 2600);
        }, {
            passive: true
        });
        engine.animate(this.group, (f)=>this.step(f.dt, f.t), new THREE.Sphere(new THREE.Vector3(0, 0, 0), 30000));
    }
    make(kind, role, tint = 0) {
        const v = kind === 'person' ? buildPedestrian() : buildVehicle(kind, tint);
        v.root.visible = false;
        v.root.traverse((o)=>{
            o.matrixAutoUpdate = true;
        });
        this.group.add(v.root);
        return new FleetCar(kind, v, role);
    }
    start() {
        this.engine.schedule(()=>{
            this.idx = routeIndex(this.g);
            this.cars.forEach((car, i)=>this.engine.schedule(()=>this.seed(car, i), 80 + i * 280));
            this.engine.schedule(()=>this.setDensity(this.density), 2200);
        }, 150);
    }
    seed(car, i) {
        const strip = this.g.edges.filter((e)=>/^South Las Vegas Boulevard$/.test(e.way.name ?? '') && !e.internal && !e.elevated && e.oneway && e.ref.length > 70 && e.lanes.length >= 2);
        const e = strip[Math.floor((i + 0.5) / ROBOTAXIS.length * strip.length)];
        const lane = e?.lanes[Math.floor(e.lanes.length / 2)];
        if (!e || lane === undefined) return;
        const q = this.g.lanes[lane].line, a = q.pts[0], b = q.pts[1] ?? a;
        car.place(a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1]));
        this.cruise(car);
        if (car === this.selected) this.onChange();
    }
    route(car, to) {
        if (!this.idx) this.idx = routeIndex(this.g);
        const start = laneAt(this.g, car.x, car.z, car.yaw);
        if (!start.length) return null;
        return planPath(this.g, this.idx, {
            from: start,
            goal: arrivesAt(this.g, to),
            heur: [
                to.x,
                to.z
            ],
            stopS: stopOn(to)
        });
    }
    take(car, path) {
        const pose = {
            x: car.x,
            z: car.z,
            yaw: car.yaw,
            v: car.v
        };
        car.driver = new Driver(path, car.dims, pose, car.profile);
    }
    cruise(car) {
        const near = this.places.filter((p)=>{
            const d = Math.hypot(p.x - car.x, p.z - car.z);
            return d > 500 && d < 5000;
        });
        for(let tries = 0; tries < 4 && near.length; tries++){
            const to = near[Math.floor(Math.random() * near.length)], path = this.route(car, to);
            if (path) {
                this.take(car, path);
                car.phase = 'cruising';
                car.dropoff = to;
                car.pickup = null;
                return;
            }
        }
        car.driver = null;
    }
    book(pickup, dropoff) {
        const car = this.selected;
        this.setManual(false);
        const path = this.route(car, pickup);
        if (!path) return false;
        car.pickup = pickup;
        car.dropoff = dropoff;
        this.take(car, path);
        car.phase = 'to-pickup';
        this.follow(car);
        this.onChange();
        return true;
    }
    cancel() {
        const car = this.selected;
        car.pickup = null;
        car.dropoff = null;
        this.cruise(car);
        this.onChange();
    }
    select(kind) {
        const driving = this.controls.driving;
        if (driving) {
            this.selected.phase = 'cruising';
            this.cruise(this.selected);
        }
        const car = this.cars.find((c)=>c.kind === kind && c.role === 'robotaxi');
        this.selected = car;
        this.telemetry = blankTelemetry();
        if (driving) {
            car.driver = null;
            car.phase = 'manual';
        }
        this.follow(car);
        this.onChange();
    }
    setManual(on) {
        const car = this.selected;
        this.controls.driving = on;
        this.keys.clear();
        if (on) {
            car.driver = null;
            car.phase = 'manual';
            car.pickup = null;
            car.dropoff = null;
            this.follow(car);
        } else if (car.phase === 'manual') {
            car.phase = 'cruising';
            this.cruise(car);
        }
        this.onChange();
    }
    setProfile(key) {
        const car = this.selected;
        car.profile = PROFILES[key];
        car.driver?.setProfile(car.profile);
        this.onChange();
    }
    setCamera(mode) {
        this.cameraMode = mode;
        this.follow(this.selected);
        this.onChange();
    }
    follow(car) {
        const was = this.following;
        this.following = true;
        this.lastDrag = -1e9;
        this.controls.minDist = 9;
        this.controls.maxPitch = 1.42;
        const view = this.cameraMode === 'chase' ? {
            dist: 15,
            pitch: 1.33
        } : this.cameraMode === 'high' ? {
            dist: 42,
            pitch: 1.12
        } : {
            dist: 85,
            pitch: 0.35
        };
        this.controls.flyTo({
            ...this.controls.goal,
            x: car.x,
            z: car.z,
            ...view,
            yaw: car.yaw + Math.PI
        }, was ? 0.8 : 1.2);
    }
    recentre() {
        this.follow(this.selected);
        this.onChange();
    }
    setDensity(n) {
        this.density = Math.max(0, Math.min(40, Math.round(n)));
        const mix = [
            'sedan',
            'taxi',
            'suv',
            'sedan',
            'van',
            'taxi',
            'suv',
            'sedan'
        ];
        while(this.traffic.length < this.density){
            const i = this.traffic.length, car = this.make(mix[i % mix.length], 'traffic', i * 3 + 1);
            car.profile = car.kind === 'taxi' ? PROFILES.hurry : i % 7 === 3 ? PROFILES.sloth : PROFILES.normal;
            this.traffic.push(car);
            this.cars.push(car);
        }
        this.traffic.forEach((car, i)=>{
            if (i >= this.density) {
                car.vehicle.root.visible = false;
                car.driver = null;
            }
        });
        this.onChange();
    }
    get trafficCount() {
        return this.density;
    }
    focus() {
        return this.following ? [
            this.selected.x,
            this.selected.z
        ] : [
            this.controls.cur.x,
            this.controls.cur.z
        ];
    }
    respawn(car) {
        if (!this.idx || !this.spawnLanes.length) return;
        const [fx, fz] = this.focus();
        for(let tries = 0; tries < 60; tries++){
            const id = this.spawnLanes[Math.floor(this.rng() * this.spawnLanes.length)], line = this.g.lanes[id].line, a = line.pts[0];
            const d = Math.hypot(a[0] - fx, a[1] - fz);
            if (d < 180 || d > 900) continue;
            if (this.cars.some((o)=>o !== car && o.vehicle.root.visible && Math.hypot(o.x - a[0], o.z - a[1]) < 30)) continue;
            const path = wanderPath(this.g, this.idx, id, 1400, this.rng);
            if (!path) continue;
            car.place(path.xs[0], path.zs[0], path.heading[2] ?? 0);
            car.v = 8;
            car.y = 0;
            car.driver = new Driver(path, car.dims, undefined, car.profile);
            car.driver.v = 8;
            return;
        }
        car.vehicle.root.visible = false;
        car.driver = null;
    }
    lookAhead(car) {
        const d = car.driver;
        car.gap = Infinity;
        car.gapSpeed = 0;
        car.gapFrom = null;
        if (!d) return;
        const p = d.path;
        for (const o of this.cars){
            if (o === car || !o.vehicle.root.visible || !sameRoadLevel(car, o)) continue;
            const dx = o.cx - car.x, dz = o.cz - car.z;
            if (dx * dx + dz * dz > 110 * 110) continue;
            if (dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw) < -2) continue;
            const sn = Math.sin(o.yaw), cs = Math.cos(o.yaw), halfL = o.dims.length / 2 + 1, halfW = o.dims.width / 2 + car.dims.width / 2 + 0.15;
            const crossing = o.role === 'actor' && !o.driver && o.v > 0.5;
            for(let s = d.progress + car.dims.nose; s < d.progress + 95; s += 2){
                if (s >= p.length) break;
                const i = d.indexAt(s), h = p.heading[i], blend = d.off + (d.offTarget - d.off) * Math.min(1, (s - d.progress) / 14);
                const q = [
                    p.xs[i] + Math.cos(h) * blend,
                    p.zs[i] - Math.sin(h) * blend
                ];
                const hit = (ox, oz)=>{
                    const ex = q[0] - ox, ez = q[1] - oz, along = ex * sn + ez * cs, lat = ex * cs - ez * sn;
                    return Math.abs(along) < halfL && Math.abs(lat) < halfW;
                };
                const ahead = s - d.progress, when = Math.min(3.5, ahead / Math.max(d.v, 3));
                let met = hit(o.cx, o.cz);
                if (!met && crossing) {
                    for (const k of [
                        0.5,
                        1
                    ])if (hit(o.cx + sn * o.v * when * k, o.cz + cs * o.v * when * k)) {
                        met = true;
                        break;
                    }
                }
                if (met) {
                    const g = Math.max(0, ahead - car.dims.nose);
                    if (g < car.gap) {
                        car.gap = g;
                        car.gapFrom = o;
                        car.gapSpeed = Math.max(0, o.v * Math.cos(o.yaw - p.heading[i]));
                    }
                    break;
                }
            }
        }
    }
    clearBeside(car, side, front, rear) {
        const hx = Math.sin(car.yaw), hz = Math.cos(car.yaw), nx = hz, nz = -hx;
        for (const o of this.cars){
            if (o === car || !o.vehicle.root.visible || !sameRoadLevel(car, o)) continue;
            const dx = o.cx - car.x, dz = o.cz - car.z;
            if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
            const along = dx * hx + dz * hz, lat = dx * nx + dz * nz;
            if (Math.abs(lat - side * 3.5) > 2.1) continue;
            const closing = Math.max(0, o.v - car.v) * 2;
            if (along > -rear - closing && along < front + car.dims.nose + Math.max(0, car.v - o.v) * 2) return false;
        }
        return true;
    }
    tactics(car, dt) {
        const d = car.driver;
        car.sinceChange += dt;
        if (!d || car.role === 'actor') return;
        const P = car.profile;
        if (d.offTarget !== 0) {
            const dir = Math.sign(d.offTarget);
            if (!d.laneBeside(dir, 30 + d.v * 2, this.g)) {
                d.offTarget = 0;
                car.sinceChange = 0;
                return;
            }
            if (car.sinceChange > 2 + P.passHold && this.clearBeside(car, -dir, P.passFront, P.passRear * 0.6)) {
                d.offTarget = 0;
                car.sinceChange = 0;
            }
            return;
        }
        if (Math.abs(d.off) > 0.4 || car.sinceChange < P.passHold) return;
        const want = d.limit * P.speed, slow = car.gap < Math.max(26, d.v * 3) && car.gapSpeed < want - P.passGain;
        if (!slow || d.waitingAtLight || d.signalAhead < car.gap + 28 || d.remaining < 90) return;
        for (const dir of [
            1,
            -1
        ]){
            if (!d.laneBeside(dir, Math.max(30, Math.min(car.gap, 40) + 12 + d.v * 2), this.g) || !this.clearBeside(car, dir, P.passFront, P.passRear)) continue;
            d.offTarget = dir * 3.5;
            car.sinceChange = 0;
            if (car === this.selected) this.telemetry.passes++;
            return;
        }
    }
    indexBuildings(data) {
        for (const b of data.buildings){
            if (b.h < 3 || /canopy|roof|bridge|carport/i.test(b.b ?? '')) continue;
            const seen = new Set();
            for (const p of b.pts){
                const k = `${Math.floor(p[0] / 50)},${Math.floor(p[1] / 50)}`;
                if (seen.has(k)) continue;
                seen.add(k);
                const l = this.blocks.get(k);
                if (l) l.push(b.pts);
                else this.blocks.set(k, [
                    b.pts
                ]);
            }
        }
    }
    hitsBuilding(x, z) {
        const cx = Math.floor(x / 50), cz = Math.floor(z / 50);
        for(let i = -1; i <= 1; i++)for(let j = -1; j <= 1; j++)for (const ring of this.blocks.get(`${cx + i},${cz + j}`) ?? []){
            let inside = false;
            for(let a = 0, b = ring.length - 1; a < ring.length; b = a++){
                const p = ring[a], q = ring[b];
                if (p[1] > z !== q[1] > z && x < (q[0] - p[0]) * (z - p[1]) / (q[1] - p[1]) + p[0]) inside = !inside;
            }
            if (inside) return true;
        }
        return false;
    }
    manualStep(car, dt) {
        const k = this.keys;
        const up = k.has('w') || k.has('arrowup'), down = k.has('s') || k.has('arrowdown'), left = k.has('a') || k.has('arrowleft'), right = k.has('d') || k.has('arrowright'), brake = k.has(' ');
        let accel = 0;
        if (up) accel = car.v < 0 ? 7 : 4.2 * Math.max(0.15, 1 - car.v / 30);
        if (down) accel = car.v > 0.2 ? -7.5 : -2.4;
        if (brake) accel = car.v > 0 ? -9 : 9;
        if (!up && !down && !brake) accel = -0.5 * Math.sign(car.v) - 0.012 * car.v * Math.abs(car.v);
        const before = car.v;
        car.v += accel * dt;
        if (!up && !down && before * car.v < 0) car.v = 0;
        if (brake && before * car.v < 0) car.v = 0;
        car.v = Math.max(-6, Math.min(38, car.v));
        const s = Math.abs(car.v), lock = Math.atan(car.dims.wheelbase / MIN_TURN_RADIUS), most = lock / (1 + s * s * 0.0035);
        const want = left === right ? 0 : left ? most : -most;
        const rate = (want === 0 ? 3 : 1.8) * dt;
        car.steer += Math.max(-rate, Math.min(rate, want - car.steer));
        const yaw = car.yaw + car.v / car.dims.wheelbase * Math.tan(car.steer) * dt;
        const nx = car.x + Math.sin(yaw) * car.v * dt, nz = car.z + Math.cos(yaw) * car.v * dt;
        const reach = car.v >= 0 ? car.dims.nose : -(car.dims.length - car.dims.nose);
        if (this.hitsBuilding(nx + Math.sin(yaw) * reach, nz + Math.cos(yaw) * reach)) {
            car.v = -car.v * 0.2;
            return;
        }
        car.yaw = yaw;
        car.x = nx;
        car.z = nz;
        car.vehicle.brake.visible = down || brake;
    }
    measure(dt, night) {
        const car = this.selected, t = this.telemetry, d = car.driver;
        void night;
        t.seconds += dt;
        t.metres += Math.abs(car.v) * dt;
        if (d) {
            const was = this.seen.get(d) ?? {
                red: 0,
                aeb: 0,
                hard: 0
            };
            t.redLights += d.log.redLights - was.red;
            t.aeb += d.log.aeb - was.aeb;
            t.hardStops += d.log.hardStops - was.hard;
            this.seen.set(d, {
                red: d.log.redLights,
                aeb: d.log.aeb,
                hard: d.log.hardStops
            });
        }
        const hx = Math.sin(car.yaw), hz = Math.cos(car.yaw);
        for (const o of this.cars){
            if (o === car || !o.vehicle.root.visible || !sameRoadLevel(car, o)) continue;
            const dx = o.cx - car.cx, dz = o.cz - car.cz;
            if (Math.abs(dx) > 8 || Math.abs(dz) > 8) {
                this.touching.delete(o);
                continue;
            }
            const along = dx * hx + dz * hz, lat = dx * hz - dz * hx;
            const c = Math.abs(o.yaw - car.yaw) % Math.PI, cross = Math.min(c, Math.PI - c) > 0.7;
            const a2 = (cross ? o.dims.width : o.dims.length) / 2, b2 = (cross ? o.dims.length : o.dims.width) / 2;
            const hit = Math.abs(along) < car.dims.length / 2 + a2 - 0.1 && Math.abs(lat) < car.dims.width / 2 + b2 - 0.1;
            if (hit && !this.touching.has(o)) {
                this.touching.add(o);
                t.collisions++;
                if (this.scenario?.armed) this.scenario.hit = true;
            } else if (!hit) this.touching.delete(o);
        }
        const s = this.scenario;
        if (s?.armed) {
            if (car.gapFrom?.role === 'actor' && car.gap < s.closest) s.closest = car.gap;
            if (d) {
                s.peakBrake = Math.max(s.peakBrake, -d.accel);
                if (d.aebOn) s.aeb = 1;
            }
        }
    }
    runScenario(key) {
        this.endScenario(false);
        this.lastResult = null;
        if (key !== 'city') {
            const car = this.selected;
            if (this.controls.driving) this.setManual(false);
            if (!car.pickup && (!car.driver || car.driver.remaining < 280)) this.cruise(car);
            this.follow(car);
            this.scenario = {
                key,
                ends: 110,
                armed: false,
                closest: Infinity,
                peakBrake: 0,
                aeb: 0,
                hit: false,
                actors: []
            };
        }
        this.onChange();
    }
    stage(run) {
        const car = this.selected, d = car.driver;
        if (!d || d.v < 4 || d.waitingAtLight || d.remaining < 170 || Math.abs(d.off) > 0.3) return false;
        const p = d.path, nose = d.progress + car.dims.nose, key = run.key;
        const at = (s)=>{
            const i = d.indexAt(s), h = p.heading[i];
            return {
                x: p.xs[i],
                z: p.zs[i],
                h,
                nx: Math.cos(h),
                nz: -Math.sin(h)
            };
        };
        const actor = (kind)=>{
            const a = this.make(kind, 'actor', 4);
            a.phase = 'script';
            this.cars.push(a);
            run.actors.push(a);
            return a;
        };
        const follower = (kind, s, v, profile, off = 0)=>{
            const a = actor(kind), q = at(s);
            a.place(q.x + q.nx * off, q.z + q.nz * off, q.h);
            a.v = v;
            a.driver = new Driver(p, a.dims, {
                x: a.x,
                z: a.z,
                yaw: q.h,
                v
            }, profile);
            a.driver.off = off;
            a.driver.offTarget = off;
            a.driver.progress = s;
            return a;
        };
        const steady = car.gap > 45 && (d.tactic === 'Cruising' || d.tactic === 'Following');
        let elapsed = 0;
        if (key === 'blocked') {
            const passable = (q)=>{
                const lane = p.laneOf[d.indexAt(q)], e = lane >= 0 ? this.g.edges[this.g.lanes[lane].edge] : null;
                return !!e && !e.internal && e.lanes.length >= 2;
            };
            for(let q = nose + Math.max(55, d.v * 5); q < nose + 200; q += 10){
                let ok = !p.signals.some((g)=>g.lineS > q - 35 && g.lineS < q + 45);
                for(let w = q - 45; ok && w < q + 22; w += 6)if (!passable(w)) ok = false;
                if (!ok) continue;
                const a = actor('van'), v = at(q);
                a.place(v.x, v.z, v.h);
                a.vehicle.brake.visible = true;
                run.ends = 35;
                return true;
            }
            return false;
        }
        if (key === 'phantom') {
            if (!steady || d.signalAhead < 70) return false;
            const a = follower('sedan', nose + 26, d.v, PROFILES.normal);
            a.script = (dt)=>{
                elapsed += dt;
                a.gap = elapsed > 3 && elapsed < 5.5 ? 0.1 : Infinity;
                a.gapSpeed = 0;
            };
            run.ends = 16;
            return true;
        }
        if (key === 'tailgater') {
            follower('taxi', Math.max(0, d.progress - 8), d.v, PROFILES.madmax);
            run.ends = 22;
            return true;
        }
        if (key === 'intrusion') {
            const side = d.laneBeside(1, 80, this.g) ? 1 : d.laneBeside(-1, 80, this.g) ? -1 : 0;
            if (!side || !steady || !this.clearBeside(car, side, 30, 12)) return false;
            const a = follower('suv', nose + 13, d.v, PROFILES.normal, side * 3.5);
            a.script = (dt)=>{
                elapsed += dt;
                if (a.driver) a.driver.offTarget = elapsed > 1.5 && elapsed < 6 ? side * 1.1 : side * 3.5;
            };
            run.ends = 15;
            return true;
        }
        if (key === 'crossing' || key === 'runner') {
            const sig = p.signals.find((g)=>g.lineS > nose - 6);
            if (!sig) return false;
            const s = sig.lineS + 14, when = (s - nose) / d.v;
            if (when > 3.4 || d.brakeOn && d.tactic !== 'Slowing for a curve' || !(d.tactic === 'Cruising' || d.tactic === 'Following' || d.tactic === 'Slowing for a curve')) return false;
            const speed = key === 'runner' ? 17 : 9, a = actor(key === 'runner' ? 'taxi' : 'sedan'), q = at(s);
            a.place(q.x + q.nx * speed * when, q.z + q.nz * speed * when, Math.atan2(-q.nx, -q.nz));
            a.v = speed;
            a.script = (dt)=>{
                a.x -= q.nx * speed * dt;
                a.z -= q.nz * speed * dt;
            };
            run.ends = 11;
            return true;
        }
        if (!steady || d.signalAhead < 80) return false;
        const s = nose + Math.max(30, d.v * 5), q = at(s), a = actor('person');
        a.place(q.x + q.nx * 7.5, q.z + q.nz * 7.5, Math.atan2(-q.nx, -q.nz));
        a.v = 1.5;
        let walked = 0;
        a.script = (dt)=>{
            walked += a.v * dt;
            a.x -= q.nx * a.v * dt;
            a.z -= q.nz * a.v * dt;
            if (walked > 22) a.vehicle.root.visible = false;
        };
        run.ends = 17;
        return true;
    }
    endScenario(report = true) {
        const s = this.scenario;
        if (!s) return;
        for (const a of s.actors){
            a.vehicle.root.visible = false;
            this.group.remove(a.vehicle.root);
            this.cars.splice(this.cars.indexOf(a), 1);
            this.touching.delete(a);
        }
        if (report) {
            const name = SCENARIOS[s.key], closest = s.closest === Infinity ? '' : ` · closest ${Math.max(0, s.closest).toFixed(1)} m`;
            this.lastResult = !s.armed ? `${name}: no fair spot on this route, try again` : !s.hit && s.closest === Infinity && s.key !== 'tailgater' ? `${name}: it never got in the way, try again` : s.hit ? `${name}: contact` : `${name}: passed${closest} · peak braking ${s.peakBrake.toFixed(1)} m/s²${s.aeb ? ' · emergency brake used' : ''}`;
        }
        this.scenario = null;
        this.onChange();
    }
    step(rawDt, t) {
        const dt = Math.min(rawDt, 0.1);
        const night = theme.uniforms.uNight.value;
        beamMaterial().opacity = night * 0.55;
        this.frame++;
        this.tacticClock += dt;
        const thinkNow = this.tacticClock > 0.2;
        if (thinkNow) this.tacticClock = 0;
        const [fx, fz] = this.focus();
        let budget = 1;
        this.cars.forEach((car, n)=>{
            if (!car.vehicle.root.visible && car.role !== 'traffic') return;
            if (car.role === 'traffic' && !car.vehicle.root.visible) {
                if (this.traffic.indexOf(car) < this.density && budget > 0) {
                    budget--;
                    this.respawn(car);
                }
                return;
            }
            if (car.phase === 'manual') {
                this.manualStep(car, dt);
                car.sync(night, dt);
                return;
            }
            if (car.script) car.script(dt);
            const d = car.driver;
            if (d) {
                if (car === this.selected || (n + this.frame) % 2 === 0) {
                    if (car.role !== 'actor' || !car.script) this.lookAhead(car);
                }
                if (thinkNow) this.tactics(car, 0.2);
                const steps = Math.min(5, Math.max(1, Math.ceil(dt / 0.04)));
                for(let k = 0; k < steps; k++)d.step(dt / steps, t - dt + dt * (k + 1) / steps, car.gap, undefined, car.gapSpeed);
                car.x = d.x;
                car.z = d.z;
                car.yaw = d.yaw;
                car.v = d.v;
                car.steer = d.steer;
                car.y = d.height();
                car.vehicle.brake.visible = d.brakeOn;
                if (car.role === 'traffic') {
                    if (d.remaining < 170 && budget > 0 && this.idx) {
                        const here = d.path.laneOf[d.indexAt(d.progress)];
                        if (here >= 0) {
                            budget--;
                            const next = wanderPath(this.g, this.idx, here, 1400, this.rng);
                            if (next) {
                                car.driver = new Driver(next, car.dims, {
                                    x: car.x,
                                    z: car.z,
                                    yaw: car.yaw,
                                    v: car.v
                                }, car.profile);
                            }
                        }
                    }
                    if (d.done || Math.hypot(car.x - fx, car.z - fz) > 1300) {
                        car.vehicle.root.visible = false;
                        car.driver = null;
                        return;
                    }
                } else if (d.done) this.arrived(car);
            } else if (car.script) {} else if (car.phase === 'boarding' || car.phase === 'arriving') {
                car.dwell -= dt;
                car.vehicle.brake.visible = true;
                if (car.dwell <= 0) this.afterDwell(car);
            } else if (car.role === 'robotaxi' && performance.now() > this.planning && car.phase === 'cruising') {
                this.planning = performance.now() + 500;
                this.cruise(car);
            }
            car.sync(night, dt);
        });
        this.measure(dt, night);
        const s = this.scenario;
        if (s) {
            if (!s.armed && thinkNow && this.stage(s)) s.armed = true;
            s.ends -= dt;
            if (s.ends <= 0) this.endScenario();
        }
        this.camera(dt);
        this.drawRibbon();
    }
    arrived(car) {
        car.driver = null;
        car.v = 0;
        if (car.phase === 'to-pickup') {
            car.phase = 'boarding';
            car.dwell = DWELL;
        } else if (car.phase === 'to-dropoff') {
            car.phase = 'arriving';
            car.dwell = DWELL;
        } else car.phase = 'cruising';
        if (car === this.selected) this.onChange();
    }
    afterDwell(car) {
        if (car.phase === 'boarding' && car.dropoff) {
            const path = this.route(car, car.dropoff);
            if (path) {
                this.take(car, path);
                car.phase = 'to-dropoff';
            } else car.phase = 'arrived';
        } else if (car === this.selected) car.phase = 'arrived';
        else car.phase = 'cruising';
        if (car === this.selected) this.onChange();
    }
    camera(dt) {
        const car = this.selected;
        if (!car.vehicle.root.visible || !this.following) return;
        const sinceDrag = performance.now() - this.lastDrag;
        if (this.dragging && sinceDrag < 300 && !this.controls.driving) {
            this.following = false;
            this.controls.minDist = 25;
            this.controls.maxPitch = THREE.MathUtils.degToRad(76);
            this.onChange();
            return;
        }
        const g = this.controls.goal, ahead = 1.5 + Math.abs(car.v) * 0.12;
        g.x = car.x + Math.sin(car.yaw) * ahead;
        g.z = car.z + Math.cos(car.yaw) * ahead;
        if (sinceDrag > 3000 && this.cameraMode !== 'top') {
            let want = car.yaw + Math.PI;
            while(want - g.yaw > Math.PI)want -= Math.PI * 2;
            while(want - g.yaw < -Math.PI)want += Math.PI * 2;
            g.yaw += (want - g.yaw) * Math.min(1, dt * 1.4);
        }
        this.engine.invalidate(true);
    }
    drawRibbon() {
        const car = this.selected, d = car.driver, N = this.ribbonAlpha.length / 2;
        const show = !!d && this.following && car.phase !== 'manual';
        this.ribbon.visible = show;
        if (!show || !d) return;
        const reach = Math.max(28, d.v * 3.6), h0 = d.path;
        for(let i = 0; i < N; i++){
            const f = i / (N - 1), s = Math.min(h0.length, d.progress + car.dims.nose + 0.4 + f * reach), q = d.indexAt(s), h = h0.heading[q];
            const w = 0.72 * (1 - f * 0.35), nx = Math.cos(h) * w, nz = -Math.sin(h) * w, c = d.lineAt(q), y = h0.heights[q] + 0.1;
            this.ribbonPos.set([
                c[0] + nx,
                y,
                c[1] + nz,
                c[0] - nx,
                y,
                c[1] - nz
            ], i * 6);
            this.ribbonAlpha[i * 2] = this.ribbonAlpha[i * 2 + 1] = Math.min(1, f * 7) * (1 - f) ** 1.2 * 0.62;
        }
        this.ribbon.geometry.attributes.position.needsUpdate = true;
        this.ribbon.geometry.attributes.alpha.needsUpdate = true;
    }
}
