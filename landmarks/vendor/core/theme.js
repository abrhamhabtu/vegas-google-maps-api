// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
export const NIGHT = {
    clear: '#0a0d1c',
    skyTop: '#050814',
    skyHorizon: '#161d36',
    fog: '#121628',
    fogDensity: 0.00011,
    ground: '#2a2f5a',
    block: '#2c315e',
    residential: '#2a2f5a',
    commercial: '#2e3362',
    industrial: '#292e58',
    resort: '#35315f',
    lot: '#2c315c',
    parking: '#303642',
    plaza: '#383e70',
    park: '#163f38',
    golf: '#16503a',
    pitch: '#1a4a3e',
    sand: '#3e3e58',
    water: '#16407a',
    waterDeep: '#123668',
    airport: '#2a2f5a',
    runway: '#14162a',
    road: '#292f3a',
    roadMajor: '#292f3a',
    roadStrip: '#2e3542',
    freeway: '#272c36',
    bridgeRoad: '#363f4e',
    freewayEdge: '#2a2d3c',
    service: '#303642',
    sidewalk: '#38485c',
    curb: '#4c5e72',
    median: '#26463e',
    medianConcrete: '#3b424f',
    paint: '#b8c3d4',
    paintDim: '#8692a6',
    paintYellow: '#dcb042',
    bridgeSide: '#1a1e38',
    pillar: '#1a1e38',
    wall: '#2f3660',
    wallLit: '#475080',
    roof: '#262b50',
    windowLit: '#ffcf96',
    windowDark: '#141a30',
    tree: '#0f3a30',
    treeTrunk: '#1a1c28',
    palm: '#104236',
    night: 1,
    sunDir: [
        0.66,
        0.64,
        -0.38
    ],
    sun: 0.32,
    ambient: 0.6,
    exposure: 1,
    lamps: 1,
    sunTint: [
        0.62,
        0.72,
        1
    ],
    ambientTint: [
        0.62,
        0.7,
        1
    ],
    shadow: 0.22,
    bloom: 0.68,
    bloomThreshold: 0.72
};
export const DAY = {
    clear: '#d6e0e8',
    skyTop: '#6ea8e8',
    skyHorizon: '#dfe9f2',
    fog: '#d6e0e8',
    fogDensity: 0.00007,
    ground: '#d8d8d6',
    block: '#d8d8d6',
    residential: '#d6d6d4',
    commercial: '#d9d9d7',
    industrial: '#d2d2d0',
    resort: '#dcdad6',
    lot: '#cfcfcc',
    parking: '#55575c',
    plaza: '#dddcd8',
    park: '#6f9a4e',
    golf: '#64a050',
    pitch: '#74a556',
    sand: '#d3bd8e',
    water: '#2c8cb0',
    waterDeep: '#237a9e',
    airport: '#d0d0ce',
    runway: '#565d66',
    road: '#4a4f57',
    roadMajor: '#4a4f57',
    roadStrip: '#4e545e',
    freeway: '#474c54',
    bridgeRoad: '#585e68',
    freewayEdge: '#c8bfb2',
    service: '#525760',
    sidewalk: '#dedad0',
    curb: '#ece9e0',
    median: '#637e4c',
    medianConcrete: '#5a5f68',
    paint: '#f5f4ee',
    paintDim: '#cfd2d8',
    paintYellow: '#f5c342',
    bridgeSide: '#b8b4aa',
    pillar: '#aba79e',
    wall: '#c8c4bc',
    wallLit: '#dedad2',
    roof: '#62666c',
    windowLit: '#ffe9c4',
    windowDark: '#33465c',
    tree: '#5a8f5c',
    treeTrunk: '#7a6a58',
    palm: '#6aa077',
    night: 0,
    sunDir: [
        0.485,
        0.788,
        0.379
    ],
    sun: 0.78,
    ambient: 0.52,
    exposure: 1,
    lamps: 0,
    sunTint: [
        1,
        0.95,
        0.88
    ],
    ambientTint: [
        0.92,
        0.96,
        1.02
    ],
    shadow: 0.42,
    bloom: 0.08,
    bloomThreshold: 0.96
};
export const GOLDEN = {
    clear: '#e9b98e',
    skyTop: '#4b6fa8',
    skyHorizon: '#ffc58a',
    fog: '#e9b98e',
    fogDensity: 0.00007,
    ground: '#8d7b70',
    block: '#8d7b70',
    residential: '#8a786e',
    commercial: '#907d72',
    industrial: '#85736a',
    resort: '#98827a',
    lot: '#7f6e64',
    parking: '#3f3836',
    plaza: '#9b887a',
    park: '#5f6e33',
    golf: '#596d30',
    pitch: '#667434',
    sand: '#a98f68',
    water: '#4b7898',
    waterDeep: '#3f6a8a',
    airport: '#857368',
    runway: '#3a3432',
    road: '#444244',
    roadMajor: '#444244',
    roadStrip: '#49474b',
    freeway: '#413f41',
    bridgeRoad: '#535156',
    freewayEdge: '#a08c7c',
    service: '#4c494b',
    sidewalk: '#c4b8aa',
    curb: '#d4c8b8',
    median: '#586a34',
    medianConcrete: '#524e4b',
    paint: '#f0e0ca',
    paintDim: '#bfb5a8',
    paintYellow: '#ebba44',
    bridgeSide: '#6f6058',
    pillar: '#6f6058',
    wall: '#b5a59c',
    wallLit: '#d8bda4',
    roof: '#6f6258',
    windowLit: '#ffc477',
    windowDark: '#2f3442',
    tree: '#4f6a3c',
    treeTrunk: '#4a3c32',
    palm: '#587a44',
    night: 0.34,
    sunDir: [
        0.338,
        0.156,
        0.928
    ],
    sun: 1.25,
    ambient: 0.72,
    exposure: 1,
    lamps: 0.45,
    sunTint: [
        1,
        0.66,
        0.38
    ],
    ambientTint: [
        0.92,
        0.72,
        0.72
    ],
    shadow: 0.46,
    bloom: 0.3,
    bloomThreshold: 0.9
};
export const THEMES = [
    'day',
    'golden',
    'night'
];
const PALETTES = {
    day: DAY,
    golden: GOLDEN,
    night: NIGHT
};
export class Theme {
    colors = {};
    uniforms = {
        uNight: {
            value: 1
        },
        uLamps: {
            value: 1
        },
        uSunDir: {
            value: new THREE.Vector3()
        },
        uSun: {
            value: 0.6
        },
        uAmbient: {
            value: 0.6
        },
        uSunTint: {
            value: new THREE.Vector3(1, 1, 1)
        },
        uAmbientTint: {
            value: new THREE.Vector3(1, 1, 1)
        },
        uShadowK: {
            value: 0
        },
        uTime: {
            value: 0
        }
    };
    current = {
        ...NIGHT
    };
    name = 'night';
    listeners = [];
    targets = {};
    from = {};
    fromP = NIGHT;
    toP = NIGHT;
    toC;
    k = 1;
    span = 0;
    constructor(){
        const keys = Object.keys(NIGHT).filter((k)=>typeof NIGHT[k] === 'string');
        for (const k of keys){
            this.colors[k] = new THREE.Color();
            this.from[k] = new THREE.Color();
        }
        for (const n of THEMES){
            this.targets[n] = {};
            for (const k of keys)this.targets[n][k] = new THREE.Color(PALETTES[n][k]);
        }
        this.apply('night');
    }
    c(key) {
        return this.colors[key];
    }
    onChange(fn) {
        this.listeners.push(fn);
    }
    apply(name, seconds = 0) {
        this.name = name;
        this.fromP = {
            ...this.current
        };
        for (const k of Object.keys(this.colors))this.from[k].copy(this.colors[k]);
        this.toP = PALETTES[name];
        this.toC = this.targets[name];
        this.span = seconds;
        this.k = seconds > 0 ? 0 : 1;
        this.blend(this.k);
    }
    step(dt) {
        if (this.k >= 1) return false;
        this.k = Math.min(1, this.k + dt / this.span);
        this.blend(this.k);
        return this.k < 1;
    }
    blend(k) {
        const e = k * k * (3 - 2 * k);
        const a = this.fromP, b = this.toP, p = this.current;
        const mix = (x, y)=>x + (y - x) * e;
        for (const key of Object.keys(this.colors))this.colors[key].lerpColors(this.from[key], this.toC[key], e);
        p.night = mix(a.night, b.night);
        p.lamps = mix(a.lamps, b.lamps);
        p.fogDensity = mix(a.fogDensity, b.fogDensity);
        p.sun = mix(a.sun, b.sun);
        p.ambient = mix(a.ambient, b.ambient);
        p.shadow = mix(a.shadow, b.shadow);
        p.bloom = mix(a.bloom, b.bloom);
        p.bloomThreshold = mix(a.bloomThreshold, b.bloomThreshold);
        const u = this.uniforms;
        u.uNight.value = p.night;
        u.uLamps.value = p.lamps;
        u.uSun.value = p.sun;
        u.uAmbient.value = p.ambient;
        u.uShadowK.value = p.shadow;
        u.uSunDir.value.set(mix(a.sunDir[0], b.sunDir[0]), mix(a.sunDir[1], b.sunDir[1]), mix(a.sunDir[2], b.sunDir[2])).normalize();
        u.uSunTint.value.set(mix(a.sunTint[0], b.sunTint[0]), mix(a.sunTint[1], b.sunTint[1]), mix(a.sunTint[2], b.sunTint[2]));
        u.uAmbientTint.value.set(mix(a.ambientTint[0], b.ambientTint[0]), mix(a.ambientTint[1], b.ambientTint[1]), mix(a.ambientTint[2], b.ambientTint[2]));
        for (const fn of this.listeners)fn(p);
    }
}
export const theme = new Theme();
