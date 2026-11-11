// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { theme } from '../core/theme.js';
import { Soup, convexHull, lineLength, normals, ringArea } from '../map/geom.js';
import { litColor, litMaterial } from '../map/materials.js';
import { box } from '../map/roads.js';
import { ORIGIN } from '../places.js';
import { latLonToXZ } from '../core/data.js';
import { bakeStatic } from './bake.js';
import { glowPoints, halo, nightAura, sheen, textPanel } from './sheen.js';
export function footprint(data, re, near) {
    let best = null, bd = Infinity;
    for (const b of data.buildings){
        if (!b.name || !re.test(b.name)) continue;
        const c = centroid(b.pts);
        const d = near ? Math.hypot(c[0] - near[0], c[1] - near[1]) : -Math.abs(ringArea(b.pts));
        if (d < bd) {
            bd = d;
            best = {
                ring: b.pts,
                h: b.h
            };
        }
    }
    if (!best) return null;
    const c = centroid(best.ring);
    const r = Math.sqrt(Math.abs(ringArea(best.ring)) / Math.PI);
    const { yaw, w, d } = obb(best.ring);
    return {
        ring: best.ring,
        c,
        r,
        h: best.h,
        yaw,
        w,
        d
    };
}
export function centroid(r) {
    let x = 0, z = 0;
    for (const p of r){
        x += p[0];
        z += p[1];
    }
    return [
        x / r.length,
        z / r.length
    ];
}
export function obb(ring) {
    const h = convexHull(ring);
    let best = {
        yaw: 0,
        w: 0,
        d: 0,
        a: Infinity
    };
    for(let i = 0; i < h.length; i++){
        const a = h[i], b = h[(i + 1) % h.length];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const c = Math.cos(ang), s = Math.sin(ang);
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (const p of h){
            const u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c;
            minU = Math.min(minU, u);
            maxU = Math.max(maxU, u);
            minV = Math.min(minV, v);
            maxV = Math.max(maxV, v);
        }
        const area = (maxU - minU) * (maxV - minV);
        if (area < best.a) best = {
            yaw: ang,
            w: maxU - minU,
            d: maxV - minV,
            a: area
        };
    }
    return best;
}
const glow = (color, opacity = 1)=>new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: opacity >= 1,
        fog: true
    });
export function buildLandmarks(data, engine) {
    const g = new THREE.Group();
    g.name = 'landmarks';
    const add = (o)=>{
        if (o) g.add(o);
    };
    add(sphere(data, engine));
    add(highRoller(data, engine));
    // Eiffel Tower: drawn by world/four-corners.js.
    add(balloon(data));
    add(luxor(data));
    add(strat(data));
    add(fountains(data, engine));
    add(monorail(data));
    add(fremont(data, engine));
    return g;
}
const PROGRAMME = [
    [
        0
    ],
    [
        1
    ],
    [
        1
    ],
    [
        8,
        0
    ],
    [
        13
    ],
    [
        13
    ],
    [
        2
    ],
    [
        9
    ],
    [
        8,
        1
    ],
    [
        14
    ],
    [
        14
    ],
    [
        3
    ],
    [
        10
    ],
    [
        8,
        2
    ],
    [
        4
    ],
    [
        16
    ],
    [
        16
    ],
    [
        11
    ],
    [
        8,
        3
    ],
    [
        15
    ],
    [
        15
    ],
    [
        5
    ],
    [
        12
    ],
    [
        8,
        4
    ],
    [
        17
    ],
    [
        17
    ],
    [
        6
    ],
    [
        8,
        5
    ],
    [
        7
    ],
    [
        18
    ],
    [
        18
    ],
    [
        8,
        1
    ],
    [
        19
    ],
    [
        19
    ],
    [
        20
    ],
    [
        20
    ],
    [
        8,
        3
    ],
    [
        21
    ],
    [
        21
    ],
    [
        22
    ],
    [
        22
    ]
];
const ROBOTAXI_GLSL = `
  float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  vec4 titleAt(float row, vec2 p, vec2 ctr, vec2 size) {
    vec2 uv = (p - ctr) / size + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    return texture2D(uTitles, vec2(uv.x, 1.0 - (row + 1.0 - uv.y) / 18.0));
  }
  void put(inout vec3 c, vec4 t) { c = mix(c, t.rgb, t.a); }
  // a side-on car. q: x forward, y up, the car about 2 long. kind 0 Zoox pod, 1 Waymo SUV, 2 Tesla cab
  vec4 carAt(vec2 q, float kind, float spin) {
    float aa = 0.02;
    vec4 o = vec4(0.0);
    float body; vec3 paint;
    if (kind < 0.5) {
      body = rbox(q - vec2(0.0, 0.06), vec2(0.92, 0.36), 0.2); paint = vec3(0.45, 0.88, 0.74);
    } else if (kind < 1.5) {
      float low = rbox(q - vec2(0.0, -0.1), vec2(1.0, 0.2), 0.12);
      float cab = rbox(q - vec2(-0.08, 0.18), vec2(0.66 - max(q.y, 0.0) * 0.5, 0.2), 0.1);
      body = min(low, cab); paint = vec3(0.93, 0.95, 0.97);
    } else {
      float top = 0.3 - abs(q.x + 0.12) * 0.42;
      body = max(max(q.y - top, -q.y - 0.24), abs(q.x) - 1.02); paint = vec3(0.62, 0.65, 0.69);
    }
    o = vec4(paint, 1.0 - smoothstep(0.0, aa, body));
    // glass
    float glass;
    if (kind < 0.5) glass = min(rbox(q - vec2(-0.45, 0.17), vec2(0.34, 0.15), 0.06), rbox(q - vec2(0.45, 0.17), vec2(0.34, 0.15), 0.06));
    else if (kind < 1.5) glass = rbox(q - vec2(-0.08, 0.2), vec2(0.54 - max(q.y, 0.0) * 0.5, 0.11), 0.05);
    else glass = max(max(q.y - (0.25 - abs(q.x + 0.12) * 0.42), 0.04 - q.y), abs(q.x + 0.12) - 0.56);
    o.rgb = mix(o.rgb, vec3(0.04, 0.07, 0.12), (1.0 - smoothstep(0.0, aa, glass)) * o.a);
    // make-specific detail
    if (kind < 0.5) { // sensor pods on the corners and a light bar
      float s = min(length(q - vec2(-0.78, 0.46)), length(q - vec2(0.78, 0.46))) - 0.07;
      o = mix(o, vec4(0.08, 0.1, 0.12, 1.0), 1.0 - smoothstep(0.0, aa, s));
      o.rgb = mix(o.rgb, vec3(1.0), (1.0 - smoothstep(0.0, aa, abs(q.y + 0.13) - 0.022)) * step(abs(q.x), 0.9) * o.a);
    } else if (kind < 1.5) { // the spinning roof dome and blue accent
      float d = length(q - vec2(-0.08, 0.46)) - 0.1;
      o = mix(o, vec4(0.12, 0.13, 0.15, 1.0), 1.0 - smoothstep(0.0, aa, d));
      o.rgb = mix(o.rgb, vec3(0.1, 0.5, 0.95), (1.0 - smoothstep(0.0, aa, abs(q.y + 0.1) - 0.03)) * step(abs(q.x), 0.97) * o.a);
    } else { // light bar across the back
      o.rgb = mix(o.rgb, vec3(1.0, 0.1, 0.08) * 1.6, (1.0 - smoothstep(0.0, aa, abs(q.y - 0.02) - 0.03)) * step(q.x, -0.88) * o.a);
    }
    // headlight
    float h = length((q - vec2(1.0, -0.03)) * vec2(1.0, 2.4)) - 0.06;
    o = mix(o, vec4(1.0, 0.97, 0.85, 1.0), 1.0 - smoothstep(0.0, aa, h));
    // wheels, spokes turning
    for (int i = 0; i < 2; i++) {
      vec2 w = q - vec2(i == 0 ? -0.6 : 0.6, -0.3);
      float r = length(w), a = atan(w.y, w.x) + spin;
      vec3 rim = mix(vec3(0.72), vec3(0.3), step(0.0, sin(a * 5.0)));
      vec3 wc = r < 0.12 ? rim : vec3(0.05);
      o = mix(o, vec4(wc, 1.0), 1.0 - smoothstep(0.2, 0.2 + aa, r));
    }
    return o;
  }
  vec3 robotaxiShow(float mode, float lon, float lat, vec2 p, float T) {
    vec3 c = vec3(0.0);
    if (mode < 13.5 || mode > 16.5) {
      // a road banked round the whole ball, a skyline rolling behind it, cars lapping
      bool race = mode > 16.5;
      float night = race ? 1.0 : 0.0;
      float yR = -0.04 + 0.1 * sin(lon + 1.2);
      float slope = 0.1 * cos(lon + 1.2);
      vec3 top = mix(vec3(0.3, 0.55, 0.95), vec3(0.03, 0.02, 0.12), night), low = mix(vec3(1.0, 0.72, 0.45), vec3(0.42, 0.05, 0.32), night);
      c = mix(low, top, smoothstep(-0.3, 1.1, lat));
      // two layers of city, whole numbers of buildings so they close up round the back
      for (int k = 0; k < 2; k++) {
        float fk = float(k), n = k == 0 ? 34.0 : 22.0, drift = (k == 0 ? 0.015 : 0.04) * T;
        float xx = (lon + drift) / 6.2832 * n, id = floor(xx);
        float tall = (k == 0 ? 0.42 : 0.26) + (k == 0 ? 0.42 : 0.34) * h21(vec2(mod(id, n), fk + 3.0));
        float roof = yR + 0.14 + tall * 0.8;
        if (lat < roof) {
          vec3 wall = mix(k == 0 ? vec3(0.42, 0.45, 0.6) : vec3(0.22, 0.24, 0.36), k == 0 ? vec3(0.1, 0.06, 0.24) : vec3(0.05, 0.03, 0.14), night);
          c = wall;
          vec2 wg = vec2(fract(xx) * 5.0, lat * 34.0), wid = floor(wg);
          float on = step(0.5, h21(wid + id)) * step(0.15, fract(wg.x)) * step(0.3, fract(wg.y));
          c = mix(c, race ? mix(vec3(1.0, 0.25, 0.8), vec3(0.2, 0.9, 1.0), h21(wid * 0.7 + id)) : vec3(1.0, 0.85, 0.5), on * (k == 0 ? 0.45 : 0.85));
        }
      }
      // the road, its edge lines and rushing dashes
      float dy = lat - yR;
      if (abs(dy) < 0.15) c = vec3(0.09, 0.09, 0.11);
      float edge = smoothstep(0.012, 0.004, abs(abs(dy) - 0.145));
      c = mix(c, vec3(0.95), edge);
      float dash = step(0.5, fract(lon * 12.0 / 6.2832 * 3.0)) * smoothstep(0.012, 0.005, abs(dy));
      c = mix(c, vec3(1.0, 0.86, 0.3), dash);
      if (dy < -0.15) c = mix(vec3(0.18, 0.2, 0.22), vec3(0.03, 0.03, 0.05), smoothstep(-0.15, -1.2, dy));
      // cars
      for (int i = 0; i < 3; i++) {
        float fi = float(i), kind = race ? fi : 0.0;
        if (!race && i > 0) break;
        // the race: they pull ahead of each other in turn
        float speed = race ? 0.78 + 0.05 * fi : 0.72;
        float pos = T * speed + (race ? fi * -0.42 + 0.16 * sin(T * 0.7 + fi * 2.1) : -1.9);
        float dx = mod(lon - pos + 3.1416, 6.2832) - 3.1416;
        float S = race ? 0.2 : 0.38;
        float lane = race ? (fi - 1.0) * 0.012 : 0.0;
        vec2 q = vec2(dx, dy - lane - S * 0.42);
        q = vec2(q.x + q.y * slope, q.y - q.x * slope) / S;
        // beam of light ahead of the car
        if (q.x > 0.9 && q.x < 3.4 && abs(q.y + 0.03) < (q.x - 0.9) * 0.22 + 0.05) c += vec3(1.0, 0.95, 0.7) * 0.22 * (1.0 - (q.x - 0.9) / 2.5) * (0.4 + 0.6 * night);
        if (abs(q.x) < 1.2 && abs(q.y) < 0.7) { vec4 car = carAt(q, kind, -T * speed * 14.0); c = mix(c, car.rgb, car.a); }
      }
      if (race) {
        put(c, titleAt(T < 9.0 ? 9.0 : 10.0, p, vec2(0.0, 0.88), vec2(2.0, 0.34)));
      } else {
        put(c, titleAt(0.0, p, vec2(0.0, 1.02), vec2(1.15, 0.28)));
        put(c, titleAt(1.0, p, vec2(0.0, 0.72), vec2(2.0, 0.2)));
      }
    } else if (mode < 14.5) {
      // Waymo: the world as the car sees it, lidar painting a city of points around it
      vec2 world = p;
      p -= vec2(0.0, 0.28);
      float r = length(p), a = atan(p.y, p.x), sweep = mod(a - T * 1.5, 6.2832) / 6.2832;
      c = vec3(0.012, 0.03, 0.07);
      c += vec3(0.02, 0.16, 0.26) * smoothstep(0.02, 0.0, abs(fract(r * 3.6 - T * 0.25) - 0.5) - 0.48) * 0.5;
      vec2 gr = p * 26.0, id = floor(gr), f = fract(gr) - 0.5;
      float seed = h21(id), blocky = step(0.56, h21(floor(id / 5.0) + 2.0));
      float point = (1.0 - smoothstep(0.1, 0.32, length(f))) * step(0.32, r) * step(0.45, seed) * blocky;
      c += point * mix(vec3(0.05, 0.85, 0.95), vec3(0.95, 0.3, 0.75), smoothstep(0.3, 1.5, r)) * (0.16 + 1.5 * pow(1.0 - sweep, 5.0));
      // the planned path ahead, in green
      c = mix(c, vec3(0.2, 1.0, 0.55), smoothstep(0.045, 0.02, abs(p.x)) * step(p.y, -0.06) * 0.8 * step(0.5, fract(p.y * 7.0 + T * 1.6)));
      // pedestrians and cars it has picked out, boxed
      for (int i = 0; i < 6; i++) {
        float fi = float(i), A = fi * 1.05 + 0.5, R = 0.55 + 0.32 * h21(vec2(fi, 1.0));
        vec2 ctr = vec2(cos(A + 0.05 * sin(T + fi)), sin(A)) * R;
        float d = abs(rbox(p - ctr, vec2(0.09, 0.06), 0.01)) - 0.008;
        c = mix(c, i < 3 ? vec3(1.0, 0.75, 0.15) : vec3(0.2, 1.0, 0.55), 1.0 - smoothstep(0.0, 0.012, d));
      }
      // the car from above, sensor ring spinning
      if (rbox(p, vec2(0.13, 0.2), 0.07) < 0.0) c = vec3(0.93, 0.95, 0.97);
      if (rbox(p - vec2(0.0, -0.03), vec2(0.09, 0.075), 0.03) < 0.0) c = vec3(0.05, 0.08, 0.12);
      if (length(p) < 0.045) c = vec3(0.1, 0.5, 0.95);
      put(c, titleAt(2.0, world, vec2(0.0, 1.0), vec2(1.2, 0.3)));
      put(c, titleAt(3.0, world, vec2(0.0, -0.22), vec2(1.9, 0.19)));
    } else if (mode < 15.5) {
      // Tesla: black, then a blade of light sweeps along the body and picks it out of the dark
      c = vec3(0.006);
      float S = 0.56;
      vec2 q = vec2(p.x, p.y - 0.28) / S;
      vec4 car = carAt(q, 2.0, -max(T - 11.0, 0.0) * 8.0);
      float sw = mod(T * 0.42, 1.0) * 5.0 - 2.5;
      float blade = exp(-pow((p.x - sw) * 3.2, 2.0));
      float reveal = smoothstep(6.0, 10.0, T);
      vec3 lit = car.rgb * (0.05 + blade * 1.2 + reveal * 0.85);
      c = mix(c, lit, car.a);
      // the rim of the car catches first
      float rimLine = smoothstep(0.03, 0.0, abs(q.y - (0.3 - abs(q.x + 0.12) * 0.42))) * step(abs(q.x), 1.0);
      c += vec3(0.9, 0.95, 1.0) * rimLine * (0.25 + blade);
      // floor reflection
      if (q.y < -0.52) { vec4 m = carAt(vec2(q.x, -1.04 - q.y), 2.0, 0.0); c += m.rgb * m.a * (blade * 0.28 + reveal * 0.12) * smoothstep(-1.1, -0.55, q.y); }
      put(c, titleAt(4.0, p, vec2(0.0, 0.98), vec2(1.3, 0.32)) * vec4(1.0, 1.0, 1.0, smoothstep(3.0, 6.0, T)));
      put(c, titleAt(5.0, p, vec2(0.0, -0.2), vec2(1.2, 0.2)) * vec4(1.0, 1.0, 1.0, smoothstep(8.0, 11.0, T)));
    } else {
      // the credit: lines of code scroll up the ball and turn into a city as a spark turns over them
      c = mix(vec3(0.48, 0.17, 0.08), vec3(0.09, 0.05, 0.05), smoothstep(-1.2, 1.2, lat));
      vec2 g = vec2(lon * 11.0, lat * 18.0 - T * 0.8), id = floor(g), f = fract(g);
      float len = 2.0 + 12.0 * h21(vec2(id.y, 3.0)), indent = floor(3.0 * h21(vec2(id.y, 7.0)));
      float col = mod(id.x + 40.0, 26.0);
      float code = step(indent, col) * step(col, indent + len) * step(0.22, f.y) * step(f.y, 0.62) * step(0.08, f.x) * step(0.35, h21(id));
      vec3 codeC = mix(vec3(1.0, 0.72, 0.5), vec3(1.0, 0.95, 0.85), h21(id + 2.0));
      c = mix(c, codeC, code * 0.55);
      // the spark, in the middle of the ball
      vec2 sp = p - vec2(0.0, 0.84);
      float r = length(sp), a = atan(sp.y, sp.x) + T * 0.18;
      float rays = abs(fract(a / 6.2832 * 12.0) - 0.5) * 2.0;
      float reach = mod(floor(a / 6.2832 * 12.0), 2.0) < 1.0 ? 0.3 : 0.22;
      float spark = smoothstep(0.42, 0.3, rays * r * 7.0) * step(r, reach) * step(0.045, r);
      c = mix(c, vec3(1.0, 0.95, 0.88), spark);
      // the lines change halfway through
      put(c, titleAt(T < 9.0 ? 6.0 : 8.0, p, vec2(0.0, 0.42), vec2(2.1, 0.2)));
      put(c, titleAt(7.0, p, vec2(0.0, 0.14), vec2(2.1, 0.36)));
    }
    return c;
  }
`;
const EXTRA_SHOWS_GLSL = `
  float lonF(float l) { return mod(l + 1.5708, 3.1416) - 1.5708; }
  float seg(vec2 p, vec2 a, vec2 b, float w) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - w; }
  float fill(float d) { return 1.0 - smoothstep(0.0, 0.012, d); }
  // one reel symbol, q in about -0.5..0.5. 0 seven, 1 cherries, 2 bar, 3 diamond
  vec3 reelSymbol(vec2 q, float k, vec3 c) {
    if (k < 0.5) {
      float d = min(seg(q, vec2(-0.2, 0.26), vec2(0.22, 0.26), 0.07), seg(q, vec2(0.22, 0.26), vec2(-0.08, -0.3), 0.07));
      return mix(c, vec3(0.88, 0.06, 0.1), fill(d));
    }
    if (k < 1.5) {
      c = mix(c, vec3(0.1, 0.55, 0.2), fill(min(seg(q, vec2(-0.14, -0.08), vec2(0.04, 0.28), 0.018), seg(q, vec2(0.16, -0.1), vec2(0.04, 0.28), 0.018))));
      return mix(c, vec3(0.82, 0.05, 0.14), fill(min(length(q - vec2(-0.16, -0.18)) - 0.13, length(q - vec2(0.18, -0.2)) - 0.13)));
    }
    if (k < 2.5) {
      c = mix(c, vec3(0.08), fill(rbox(q, vec2(0.34, 0.14), 0.03)));
      return mix(c, vec3(0.98, 0.85, 0.3), fill(abs(rbox(q, vec2(0.28, 0.08), 0.02)) - 0.012));
    }
    return mix(c, vec3(0.32, 0.8, 1.0), fill(abs(q.x) + abs(q.y) * 0.8 - 0.3));
  }
  vec3 extraShow(float mode, float lon, float lat, vec2 p, float st, float time) {
    vec3 c;
    if (mode < 18.5) {        // an aquarium: the ball is a tank, and a shark comes by
      c = mix(vec3(0.02, 0.2, 0.45), vec3(0.08, 0.62, 0.8), smoothstep(-1.2, 1.2, lat));
      float ca = sin(lon * 11.0 + sin(lat * 13.0 + time) * 1.4 + time * 0.6) * sin(lat * 15.0 - time * 0.8 + sin(lon * 7.0));
      c += vec3(0.25, 0.4, 0.42) * smoothstep(0.55, 1.0, ca) * smoothstep(-0.6, 1.0, lat);
      c = mix(c, vec3(0.78, 0.68, 0.46), smoothstep(-0.92, -1.05, lat + 0.04 * sin(lon * 9.0)));
      for (int i = 0; i < 9; i++) {
        float fi = float(i), dir = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0, sz = 0.07 + 0.05 * h21(vec2(fi, 2.0));
        vec2 at = vec2(mod(h21(vec2(fi, 5.0)) * 6.28 + dir * time * (0.14 + 0.12 * h21(vec2(fi, 9.0))) + 3.14, 6.28) - 3.14, h21(vec2(fi, 3.0)) * 1.3 - 0.75 + 0.05 * sin(time * 1.3 + fi));
        vec2 f = (vec2(lon, lat) - at) * vec2(dir, 1.0) / sz;
        float wag = 0.25 * sin(time * 7.0 + fi);
        float body = length(f * vec2(0.55, 1.0)) - 1.0;
        float tail = max(abs(f.y + wag * (f.x + 1.6)) - (-f.x - 1.5) * 0.75, max(f.x + 1.5, -f.x - 2.5));
        vec3 skin = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + fi * 1.3);
        skin = mix(skin, vec3(1.0, 0.5, 0.1), 0.45);
        c = mix(c, skin, 1.0 - smoothstep(0.0, 0.1, min(body, tail)));
        c = mix(c, vec3(0.02), 1.0 - smoothstep(0.1, 0.18, length(f - vec2(1.1, 0.25))));
      }
      // the shark, right across the middle
      float sx = mod(st * 0.32, 8.0) - 3.2;
      vec2 sh = vec2(lon, lat - 0.28) - vec2(sx, 0.0);
      float back = sh.y - 0.2 * (1.0 - sh.x * sh.x * 1.1), belly = -sh.y - 0.12 * (1.0 - sh.x * sh.x * 1.1);
      float shark = max(max(back, belly), abs(sh.x) - 0.95);
      float fin = max(max(sh.y - 0.42 + (sh.x + 0.05) * 1.3, 0.14 - sh.y), -(sh.x + 0.22));
      float tailS = max(abs(sh.y) - (-sh.x - 0.78) * 0.9, max(sh.x + 0.78, -sh.x - 1.15));
      float all_ = min(min(shark, fin), tailS);
      c = mix(c, mix(vec3(0.3, 0.36, 0.42), vec3(0.82), smoothstep(0.0, -0.06, sh.y + 0.02)), 1.0 - smoothstep(0.0, 0.015, all_));
      c = mix(c, vec3(0.0), 1.0 - smoothstep(0.012, 0.024, length(sh - vec2(0.68, 0.04))));
      // a grin full of teeth
      float jaw = abs(sh.y + 0.06 + (sh.x - 0.68) * 0.28) - 0.012;
      if (sh.x > 0.42 && sh.x < 0.9) c = mix(c, step(0.5, fract(sh.x * 30.0)) > 0.5 ? vec3(1.0) : vec3(0.15, 0.02, 0.05), 1.0 - smoothstep(0.0, 0.016, jaw));
      for (int i = 0; i < 16; i++) {
        float fi = float(i), bx = h21(vec2(fi, 21.0)) * 6.28 - 3.14 + 0.03 * sin(time * 2.0 + fi), by = mod(h21(vec2(fi, 13.0)) * 2.6 + time * 0.18, 2.6) - 1.0;
        float r = length(vec2(lon, lat) - vec2(bx, by));
        c += vec3(0.5) * (1.0 - smoothstep(0.0, 0.012, abs(r - 0.028)));
      }
      put(c, titleAt(11.0, p, vec2(0.0, 0.82), vec2(2.3, 0.3)));
    } else if (mode < 19.5) { // a slot machine: three reels land one by one, then it pays out
      c = mix(vec3(0.42, 0.03, 0.08), vec3(0.16, 0.01, 0.05), abs(p.y - 0.3));
      vec2 r = p - vec2(0.0, 0.3);
      float wins = smoothstep(7.8, 8.2, st);
      for (int i = 0; i < 3; i++) {
        float fi = float(i), cx = (fi - 1.0) * 0.72, stopAt = 3.0 + fi * 2.0;
        vec2 q = (r - vec2(cx, 0.0));
        if (abs(q.x) < 0.33 && abs(q.y) < 0.62) {
          float spin = min(st, stopAt);
          float ease = st < stopAt ? spin * 7.0 : stopAt * 7.0;
          float pos = q.y / 0.56 + ease + (st < stopAt ? 0.0 : 0.0);
          float row = floor(pos + 0.5);
          // stops with a seven in the middle of every reel
          float k = row == floor(stopAt * 7.0 + 0.5) && st >= stopAt ? 0.0 : mod(row * (fi + 3.0) + fi * 2.0, 4.0);
          c = mix(vec3(0.99, 0.97, 0.9), vec3(0.72, 0.68, 0.6), abs(q.y) / 0.62);
          float blur = st < stopAt ? 1.0 : 0.0;
          vec2 sq = vec2(q.x / 0.72, (pos - row) * (1.0 - 0.45 * blur));
          c = reelSymbol(sq * 1.0, k, c);
          if (st < stopAt) c = mix(c, vec3(0.9), 0.2);
        }
        float frame = abs(rbox(q, vec2(0.34, 0.63), 0.03)) - 0.018;
        c = mix(c, vec3(0.98, 0.78, 0.2), 1.0 - smoothstep(0.0, 0.012, frame));
      }
      // chasing bulbs round the edge
      float ring = abs(rbox(r, vec2(1.3, 0.76), 0.08));
      float bulbs = step(0.5, fract((atan(r.y, r.x) * 12.0 + time * 6.0) / 1.0));
      c = mix(c, mix(vec3(1.0, 0.9, 0.4), vec3(0.6, 0.15, 0.05), bulbs), 1.0 - smoothstep(0.02, 0.04, ring));
      if (wins > 0.0) {
        c += vec3(0.5, 0.35, 0.05) * wins * (0.5 + 0.5 * sin(time * 16.0));
        for (int i = 0; i < 22; i++) {
          float fi = float(i), x = h21(vec2(fi, 8.0)) * 6.28 - 3.14, y = 1.3 - mod((st - 8.0) * (0.45 + h21(vec2(fi, 4.0)) * 0.45) + h21(vec2(fi, 6.0)), 2.6);
          vec2 d = vec2(lon - x, lat - y);
          float spin = abs(cos(time * 4.0 + fi));
          float coin = length(d / vec2(max(spin, 0.12), 1.0)) - 0.055;
          c = mix(c, vec3(1.0, 0.8, 0.2), 1.0 - smoothstep(0.0, 0.01, coin));
        }
        put(c, titleAt(12.0, p, vec2(0.0, 0.3), vec2(2.4, 0.5)));
      }
    } else if (mode < 20.5) { // the magic 8 ball: shake it, and it answers
      float shake = smoothstep(4.0, 5.0, st) * (1.0 - smoothstep(6.0, 6.8, st));
      vec2 q = vec2(lon, lat) - vec2(0.0, 0.18) + vec2(sin(time * 34.0), cos(time * 41.0)) * 0.05 * shake;
      c = mix(vec3(0.16), vec3(0.015), smoothstep(0.0, 1.5, length(q - vec2(-0.3, 0.45))));
      c += vec3(0.7) * (1.0 - smoothstep(0.0, 0.3, length(q - vec2(-0.45, 0.62)))) * 0.45;
      float flip = smoothstep(5.2, 6.6, st);
      vec2 w = q * vec2(1.0 / max(abs(1.0 - 2.0 * flip), 0.08), 1.0);
      float face = length(w) - 0.5;
      c = mix(c, flip < 0.5 ? vec3(0.97) : vec3(0.03, 0.05, 0.28), 1.0 - smoothstep(0.0, 0.012, face));
      if (flip < 0.5) {
        float eight = min(abs(length(w - vec2(0.0, 0.16)) - 0.13) - 0.055, abs(length(w - vec2(0.0, -0.17)) - 0.16) - 0.06);
        c = mix(c, vec3(0.02), 1.0 - smoothstep(0.0, 0.012, eight));
        put(c, titleAt(13.0, p, vec2(0.0, 0.86), vec2(2.1, 0.26)));
      } else {
        vec2 tr = w - vec2(0.0, 0.02);
        float tri = max(abs(tr.x) * 0.87 + tr.y * 0.5, -tr.y) - 0.27;
        c = mix(c, vec3(0.08, 0.2, 0.75), 1.0 - smoothstep(0.0, 0.012, tri));
        put(c, titleAt(st < 13.0 ? 14.0 : 15.0, p, vec2(0.0, 0.2), vec2(0.92, 0.12)));
      }
    } else if (mode < 21.5) { // an arcade cabinet: a chomper works round the ball, with something after it
      c = vec3(0.005, 0.005, 0.02);
      vec2 g = vec2(lon, lat) * 5.2, id = floor(g), f = fract(g) - 0.5;
      float wall = max(abs(f.x), abs(f.y));
      float hole = h21(id) > 0.35 ? 1.0 : 0.0;
      c = mix(c, vec3(0.1, 0.22, 1.0), (1.0 - smoothstep(0.05, 0.09, abs(wall - 0.44))) * hole);
      float headX = mod(st * 0.42, 6.28) - 3.14;
      float rowY = 0.34;
      float eaten = step(lon, headX);
      if (abs(lat - rowY) < 0.34) {
        float dotAt = fract(lon * 3.0) - 0.5;
        c = mix(c, vec3(1.0, 0.86, 0.6), (1.0 - smoothstep(0.03, 0.05, length(vec2(dotAt / 3.0, lat - rowY)))) * (1.0 - eaten));
        c = mix(c, vec3(0.005, 0.005, 0.02), 1.0 - smoothstep(0.24, 0.27, abs(lat - rowY)));
        c = mix(c, vec3(1.0, 0.86, 0.6), (1.0 - smoothstep(0.016, 0.03, length(vec2(dotAt / 3.0, lat - rowY)))) * (1.0 - eaten));
      }
      vec2 h = vec2(lon - headX, lat - rowY);
      float ang = abs(atan(h.y, h.x)), mouth = 0.16 + 0.55 * abs(sin(st * 9.0));
      c = mix(c, vec3(1.0, 0.88, 0.06), (1.0 - smoothstep(0.235, 0.25, length(h))) * step(mouth, ang));
      c = mix(c, vec3(0.0), 1.0 - smoothstep(0.018, 0.028, length(h - vec2(0.03, 0.13))));
      vec2 gh = vec2(lon - (headX - 0.85), lat - rowY);
      float skirt = 0.035 * sin(gh.x * 60.0 + st * 18.0);
      float ghost = max(length(gh * vec2(1.0, 1.0)) - 0.22, -(gh.y + 0.0)) ;
      ghost = min(ghost, max(abs(gh.x) - 0.22, max(gh.y, -gh.y - 0.2 + skirt)));
      c = mix(c, vec3(1.0, 0.2, 0.45), 1.0 - smoothstep(0.0, 0.012, ghost));
      for (int i = 0; i < 2; i++) {
        float sd = i == 0 ? -1.0 : 1.0;
        c = mix(c, vec3(1.0), 1.0 - smoothstep(0.052, 0.06, length(gh - vec2(sd * 0.08 + 0.0, 0.04))));
        c = mix(c, vec3(0.05, 0.1, 0.7), 1.0 - smoothstep(0.022, 0.03, length(gh - vec2(sd * 0.08 + 0.03, 0.04))));
      }
      if (fract(st * 0.8) < 0.6) put(c, titleAt(16.0, p, vec2(0.0, 0.92), vec2(1.8, 0.3)));
    } else {                  // a snow globe of the Strip, in the desert
      c = mix(vec3(0.72, 0.84, 0.96), vec3(0.3, 0.5, 0.82), smoothstep(-0.2, 1.3, lat));
      float x = lonF(lon) * 4.0;
      float b = 0.0;
      for (int i = 0; i < 7; i++) {
        float fi = float(i), f2 = 1.8 + fi * 1.3;
        b = max(b, step(0.5, fract(x * f2 * 0.28 + h21(vec2(fi, 1.0)))) * (0.2 + 0.2 * h21(vec2(floor(x * f2 * 0.28 + h21(vec2(fi, 1.0))), fi))));
      }
      float hor = -0.25 + b;
      // the tower, the wheel, and the pyramid stand out of the skyline
      vec2 fr = vec2(lonF(lon), lat);
      float strat = min(seg(fr, vec2(0.95, -0.25), vec2(0.95, 0.6), 0.016), length((fr - vec2(0.95, 0.62)) * vec2(1.0, 2.0)) - 0.07);
      float wheel = abs(length(fr - vec2(-0.75, 0.2)) - 0.3) - 0.012;
      float pyr = max(abs(fr.x - 0.2) * 1.0 + fr.y - 0.1, -fr.y - 0.3);
      float sky = min(min(strat, wheel), pyr);
      c = mix(c, vec3(0.2, 0.26, 0.4), step(lat, hor));
      c = mix(c, vec3(0.2, 0.26, 0.4), 1.0 - smoothstep(0.0, 0.008, sky));
      c = mix(c, vec3(0.97, 0.98, 1.0), smoothstep(-0.46, -0.52, lat + 0.02 * sin(lon * 13.0)));
      for (int i = 0; i < 3; i++) {
        float fi = float(i), sc = 13.0 + fi * 8.0;
        vec2 g = vec2(lon * sc + sin(time * 0.5 + fi + lat * 3.0) * 0.8, lat * sc + time * (1.6 - fi * 0.25));
        vec2 id = floor(g), ff = fract(g) - 0.5;
        float on = step(0.4, h21(id + fi * 7.0));
        c = mix(c, vec3(1.0), on * (1.0 - smoothstep(0.05, 0.2, length(ff + (vec2(h21(id), h21(id + 3.0)) - 0.5) * 0.5))));
      }
      put(c, titleAt(17.0, p, vec2(0.0, 0.86), vec2(2.4, 0.28)));
    }
    return c;
  }
`;
function sphereTitles() {
    const W = 2048, H = 256, rows = 18, c = document.createElement('canvas');
    c.width = W;
    c.height = H * rows;
    const x = c.getContext('2d');
    const SANS = '"Helvetica Neue", Arial, sans-serif';
    const put = (i, t, font, color)=>{
        x.save();
        x.translate(W / 2, i * H + H / 2);
        x.font = font;
        x.fillStyle = color;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.scale(Math.min(1, (W - 80) / x.measureText(t).width), 1);
        x.fillText(t, 0, 0);
        x.restore();
    };
    put(0, 'Z O O X', `800 200px ${SANS}`, '#07303a');
    put(1, 'NO STEERING WHEEL. NO PROBLEM.', `700 130px ${SANS}`, '#0a2a33');
    put(2, 'W A Y M O', `700 200px ${SANS}`, '#ffffff');
    put(3, 'NOBODY IN THE FRONT SEAT', `600 110px ${SANS}`, '#8fe8ff');
    put(4, 'T E S L A', `500 190px ${SANS}`, '#ffffff');
    put(5, 'ROBOTAXI', `300 170px ${SANS}`, '#ffffff');
    put(6, 'THIS WHOLE CITY WAS WRITTEN BY', `500 110px ${SANS}`, '#fff4e6');
    put(7, 'CLAUDE OPUS 5.5', `800 190px ${SANS}`, '#ffffff');
    put(8, 'EVERY ROAD. EVERY TOWER. EVERY LIGHT.', `500 100px ${SANS}`, '#fff4e6');
    put(9, 'WHO DROVE YOU HERE?', `800 170px ${SANS}`, '#ffffff');
    put(10, 'NOBODY.', `900 210px ${SANS}`, '#7df9ff');
    put(11, 'NO LIFEGUARD ON DUTY', `800 130px ${SANS}`, '#e9fbff');
    put(12, 'J A C K P O T', `900 170px ${SANS}`, '#fff2a8');
    put(13, 'ASK THE BALL ANYTHING', `700 110px ${SANS}`, '#ffffff');
    put(14, 'ALL SIGNS POINT TO BUFFET', `800 104px ${SANS}`, '#ffffff');
    put(15, 'ASK AGAIN AFTER THE SHOW', `800 104px ${SANS}`, '#ffffff');
    put(16, 'INSERT COIN', `800 170px ${SANS}`, '#ffe14d');
    put(17, 'IT HAS NEVER SNOWED THIS MUCH', `700 100px ${SANS}`, '#16324f');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}
function sphereAds() {
    const S = 1024, H = 512, c = document.createElement('canvas');
    c.width = S * 3;
    c.height = H * 2;
    const x = c.getContext('2d');
    const SANS = '"Helvetica Neue", Arial, sans-serif', SERIF = 'Didot, Georgia, serif';
    const card = (i, a, b, draw)=>{
        const ox = i % 3 * S, oy = Math.floor(i / 3) * H;
        const g = x.createLinearGradient(ox, oy, ox, oy + H);
        g.addColorStop(0, a);
        g.addColorStop(1, b);
        x.fillStyle = g;
        x.fillRect(ox, oy, S, H);
        x.save();
        x.beginPath();
        x.rect(ox, oy, S, H);
        x.clip();
        draw(ox, oy);
        x.restore();
    };
    const text = (t, px, py, font, color, glow = '')=>{
        x.font = font;
        x.fillStyle = color;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.shadowColor = glow;
        x.shadowBlur = glow ? 26 : 0;
        x.fillText(t, px, py, S - 120);
        x.shadowBlur = 0;
    };
    card(0, '#2a0845', '#7a0f5f', (ox, oy)=>{
        text('WHAT HAPPENS HERE', ox + S / 2, oy + 200, `900 88px ${SANS}`, '#ff6fd8', '#ff2fb8');
        text('STAYS HERE', ox + S / 2, oy + 310, `900 104px ${SANS}`, '#7df9ff', '#29d9ff');
    });
    card(1, '#04122e', '#0a3d7a', (ox, oy)=>{
        text('NO DRIVER.', ox + S / 2, oy + 165, `800 110px ${SANS}`, '#ffffff');
        text('NO JUDGMENT.', ox + S / 2, oy + 280, `800 96px ${SANS}`, '#7fd3ff');
        text('ZOOX · WAYMO · TESLA · ON THE STRIP', ox + S / 2, oy + 380, `500 34px ${SANS}`, '#c8ddf0');
    });
    card(2, '#0b3d2a', '#06241a', (ox, oy)=>{
        text("A's", ox + S / 2, oy + 190, `italic 800 190px ${SERIF}`, '#ffd23f');
        text('LAS VEGAS · OPENING 2028', ox + S / 2, oy + 330, `700 52px ${SANS}`, '#ffffff');
    });
    card(3, '#3d0303', '#a10f12', (ox, oy)=>{
        text('7 7 7', ox + S / 2, oy + 200, `900 190px ${SERIF}`, '#ffd84a', '#ff9d00');
        text('JACKPOT', ox + S / 2, oy + 345, `900 76px ${SANS}`, '#ffffff');
        for(let i = 0; i < 26; i++){
            x.fillStyle = '#ffd84a';
            x.beginPath();
            x.arc(ox + i * 137 % S, oy + 30 + i * 71 % 90 * (i % 2 ? 1 : 4.4), 9, 0, Math.PI * 2);
            x.fill();
        }
    });
    card(4, '#0a0a12', '#1e1140', (ox, oy)=>{
        text('ELVIS', ox + S / 2, oy + 170, `italic 900 170px ${SERIF}`, '#f6d36b', '#ff5ab8');
        text('HAS NOT LEFT THE BUILDING', ox + S / 2, oy + 305, `800 56px ${SANS}`, '#ffffff');
    });
    card(5, '#0e4d7a', '#07202f', (ox, oy)=>{
        x.fillStyle = 'rgba(190,235,255,.82)';
        for(let i = 0; i < 15; i++){
            const px = ox + 100 + i * 59, h = 80 + 90 * Math.abs(Math.sin(i * 0.9));
            x.beginPath();
            x.moveTo(px - 14, oy + 400);
            x.quadraticCurveTo(px, oy + 400 - h * 2.2, px + 14, oy + 400);
            x.fill();
        }
        text('THE FOUNTAINS', ox + S / 2, oy + 90, `600 84px ${SERIF}`, '#ffffff');
        text('BELLAGIO · ALL DAY, ALL NIGHT', ox + S / 2, oy + 454, `600 38px ${SANS}`, '#ffe9b8');
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}
function sphere(data, engine) {
    const f = footprint(data, /^sphere$/i);
    if (!f) return null;
    const R = 78.5, H = 112;
    const geo = new THREE.SphereGeometry(R, 96, 64, 0, Math.PI * 2, 0, Math.acos((H - R) / R * -1));
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uTime: theme.uniforms.uTime,
            uNight: theme.uniforms.uNight,
            uFace: {
                value: new THREE.Vector3(-1, 0, 0)
            },
            uAds: {
                value: sphereAds()
            },
            uTitles: {
                value: sphereTitles()
            },
            uMode: {
                value: PROGRAMME.map((p)=>p[0])
            },
            uAd: {
                value: PROGRAMME.map((p)=>p[1] ?? -1)
            },
            uStart: {
                value: PROGRAMME.map((_, i)=>{
                    let k = i;
                    while(k > 0 && PROGRAMME[k - 1][0] === PROGRAMME[i][0] && PROGRAMME[i][0] !== 8)k--;
                    return k;
                })
            }
        },
        fog: true,
        vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vN;
      void main() { vN = normalize(position);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
        fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime, uNight; uniform vec3 uFace; uniform sampler2D uAds, uTitles; varying vec3 vN;
      uniform float uMode[${PROGRAMME.length}], uAd[${PROGRAMME.length}], uStart[${PROGRAMME.length}];
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      ${ROBOTAXI_GLSL}
      ${EXTRA_SHOWS_GLSL}
      void main() {
        float time = uTime;
        vec3 up = vec3(0.0, 1.0, 0.0), right = normalize(cross(up, uFace));
        float lon = atan(dot(vN, right), dot(vN, uFace)), lat = asin(clamp(vN.y, -1.0, 1.0));
        vec2 grid = vec2(lon * 64.0, lat * 64.0);
        vec2 cell = fract(grid) - 0.5;
        float dots = 1.0 - smoothstep(0.25, 0.49, length(cell));
        float dotm = mix(dots, 0.83, smoothstep(0.2, 0.8, max(fwidth(grid.x), fwidth(grid.y))));
        vec2 q = vec2(lon, lat);
        // the programme: 9 s slots; a show that spans several keeps its own clock
        int slotI = int(mod(floor(time / 9.0), ${PROGRAMME.length.toFixed(1)}));
        float slot = float(slotI), mode = uMode[slotI], ad = uAd[slotI];
        float showT = (slot - uStart[slotI]) * 9.0 + mod(time, 9.0);
        float blend = smoothstep(0.0, 1.2, showT);
        // pictures repeat on the far hemisphere, so the Strip side and the Koval side both get the show
        float lonF = mod(lon + 1.5708, 3.1416) - 1.5708;
        vec2 p = vec2(lonF, lat);
        vec3 c;
        if (mode < 0.5) {            // the eye
          vec2 gaze = q - vec2(sin(time * 0.24) * 0.13, 0.04);
          float r = length(gaze * vec2(1.0, 1.2));
          vec3 white = vec3(0.95);
          float a = atan(gaze.y, gaze.x);
          float fibers = 0.65 + 0.18 * sin(a * 93.0 + r * 24.0) + 0.12 * sin(a * 157.0 - r * 48.0);
          vec3 iris = mix(vec3(0.05, 0.24, 0.47), vec3(0.12, 0.64, 0.82), smoothstep(0.18, 0.43, r)) * fibers;
          iris *= 1.0 - smoothstep(0.45, 0.55, r) * 0.78;
          c = r < 0.18 ? vec3(0.008, 0.014, 0.024) : r < 0.55 ? iris : white;
          c = mix(c, vec3(1.0), (1.0 - smoothstep(0.035, 0.075, length(gaze - vec2(-0.17, 0.2)))) * 0.85);
          float lid = abs(lat) > 0.75 - 0.25 * abs(sin(time * 0.7)) ? 1.0 : 0.0;
          c = mix(c, vec3(0.9, 0.7, 0.55), lid);
        } else if (mode < 1.5) {     // the smiley: glances left and right, looks up and down, pulls faces
          float st = showT;   // 0–18 s into the act
          // the whole face rolls round the ball a little as it turns its head
          vec2 head = vec2(0.42 * sin(st * 0.7) * smoothstep(0.0, 2.0, st), 0.26 + 0.14 * sin(st * 0.43));
          vec2 f = q - head;
          float r = length(f);
          c = mix(vec3(1.0, 0.8, 0.08), vec3(1.0, 0.66, 0.03), smoothstep(0.2, 1.3, r));
          c = mix(c, vec3(1.0, 0.42, 0.26), (1.0 - smoothstep(0.08, 0.2, length(abs(f) - vec2(0.56, 0.0)) )) * 0.55 * step(f.y, 0.1));
          // the eyes dart further than the head: left, right, up, down, then cross for a beat
          vec2 look = vec2(sin(st * 1.1), 0.0) * 0.06 + vec2(0.0, sin(st * 0.8 + 1.0)) * 0.05;
          float cross = smoothstep(11.5, 12.0, st) * (1.0 - smoothstep(13.5, 14.0, st));
          for (int i = 0; i < 2; i++) {
            float sd = i == 0 ? -1.0 : 1.0;
            vec2 e = f - vec2(sd * 0.34, 0.3);
            // a slow blink on both, a wink on the right eye at 6 s
            float blink = step(0.965, fract(st * 0.21));
            float wink = sd > 0.0 ? smoothstep(5.6, 5.8, st) * (1.0 - smoothstep(7.0, 7.2, st)) : 0.0;
            float open = (1.0 - blink) * (1.0 - wink);
            float rEye = length(e * vec2(1.0, mix(6.0, 0.86, open)));
            c = mix(c, vec3(0.98), 1.0 - smoothstep(0.17, 0.185, rEye));
            vec2 pupil = e - look - vec2(-sd * cross * 0.08, 0.0);
            c = mix(c, vec3(0.04, 0.03, 0.03), (1.0 - smoothstep(0.075, 0.09, length(pupil))) * step(0.3, open));
            c = mix(c, vec3(0.1, 0.06, 0.03), (1.0 - smoothstep(0.012, 0.02, abs(rEye - 0.18))) );
          }
          // the mouth: a grin, then a tongue-out at 8 s, then a big laugh
          float tongue = smoothstep(8.0, 8.3, st) * (1.0 - smoothstep(10.6, 10.9, st));
          float laugh = smoothstep(14.5, 15.0, st) * (1.0 - smoothstep(17.0, 17.5, st));
          vec2 mf = f - vec2(0.0, -0.1);
          float arc = abs(length(mf) - 0.46);
          float grin = (1.0 - smoothstep(0.03, 0.05, arc)) * step(mf.y, -0.12);
          vec2 ml = (f - vec2(0.0, -0.28)) * vec2(1.0, 1.0 + 0.9 * (1.0 - laugh));
          float mouth = max(grin * (1.0 - laugh), (1.0 - smoothstep(0.32, 0.34, length(ml))) * step(ml.y, 0.04) * laugh);
          c = mix(c, vec3(0.24, 0.05, 0.05), mouth);
          vec2 tg = (f - vec2(0.05, -0.53)) * vec2(1.0, 0.72);
          c = mix(c, vec3(0.96, 0.32, 0.42), (1.0 - smoothstep(0.13, 0.15, length(tg))) * tongue);
          c = mix(c, vec3(0.74, 0.14, 0.24), (1.0 - smoothstep(0.008, 0.016, abs(tg.x))) * step(length(tg), 0.13) * tongue);
        } else if (mode < 2.5) {     // a planet
          float l = lon + time * 0.035;
          float n = sin(l * 3.0 + sin(lat * 4.0)) * sin(lat * 6.0 + cos(l * 5.0)) + 0.35 * sin(l * 13.0 + lat * 9.0);
          c = mix(vec3(0.015, 0.13, 0.42), vec3(0.2, 0.5, 0.22), smoothstep(0.12, 0.25, n));
          float cloud = sin(l * 17.0 + sin(lat * 23.0)) * sin(lat * 31.0 - l * 7.0);
          c = mix(c, vec3(0.9, 0.95, 1.0), smoothstep(0.64, 0.9, cloud) * 0.7);
          c = mix(c, vec3(1.0), smoothstep(0.8, 0.95, abs(lat) / 1.57));
        } else if (mode < 3.5) {     // a basketball, turning
          float l = lon + time * 0.35;
          float seam = min(abs(lat), min(abs(abs(l) - 1.5708), abs(abs(lat) - (0.5 + 0.38 * cos(l * 2.0)))));
          c = mix(vec3(0.05, 0.04, 0.04), vec3(0.86, 0.38, 0.12), smoothstep(0.018, 0.05, seam));
        } else if (mode < 4.5) {     // the moon
          vec2 mp = vec2(lon + time * 0.04, lat);
          float n = 0.5 + 0.28 * sin(mp.x * 5.0 + sin(mp.y * 4.0)) + 0.16 * sin(mp.y * 9.0 - mp.x * 3.0);
          c = mix(vec3(0.26, 0.26, 0.29), vec3(0.74, 0.74, 0.77), n);
          for (int i = 0; i < 6; i++) {
            float fi = float(i);
            vec2 cp = vec2(h21(vec2(fi, 3.0)) * 6.2 - 3.1, h21(vec2(fi, 7.0)) * 2.2 - 1.1);
            float r = length((mp - cp) * vec2(1.0, 1.5));
            c = mix(c, vec3(0.17, 0.17, 0.2), (1.0 - smoothstep(0.1, 0.2, r)) * 0.75);
          }
        } else if (mode < 5.5) {     // fireworks over the valley
          c = vec3(0.03, 0.04, 0.11);
          for (int i = 0; i < 5; i++) {
            float fi = float(i), cyc = floor(time * 0.55 + fi * 0.41), k = fract(time * 0.55 + fi * 0.41);
            vec2 cp = vec2(h21(vec2(fi, cyc)) * 4.4 - 2.2, h21(vec2(fi + 11.0, cyc)) * 1.5 - 0.5);
            vec2 d = q - cp;
            float r = length(d), a = atan(d.y, d.x);
            float shell = smoothstep(0.07, 0.0, abs(r - k * 0.5)) * (0.45 + 0.55 * sin(a * 16.0 + fi));
            c += shell * (1.0 - k) * 2.2 * (0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + fi * 1.9));
          }
        } else if (mode < 6.5) {     // an equaliser wrapping the shell
          float b = floor((lon + 3.1416) / 6.2832 * 28.0);
          float amp = 0.22 + 0.72 * abs(sin(b * 1.7 + time * 2.6)) * abs(sin(b * 0.53 + time * 1.1));
          c = mix(vec3(0.03, 0.035, 0.05), mix(vec3(0.1, 1.0, 0.55), vec3(1.0, 0.25, 0.3), abs(lat) / max(amp, 0.001)), step(abs(lat), amp));
        } else if (mode < 7.5) {     // colour waves
          c = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + lon * 3.0 + lat * 2.0 + time * 1.5);
        } else if (mode < 8.5) {     // an advert, with a slow push-in
          float zoom = 1.0 - 0.06 * mod(time, 9.0) / 9.0;
          vec2 auv = ((p - vec2(0.0, 0.3)) * zoom) / vec2(2.4, 1.2) + 0.5;
          vec2 cell = vec2(mod(ad, 3.0), 1.0 - floor(ad / 3.0));
          auv = clamp(auv, 0.004, 0.996);
          c = texture2D(uAds, (auv + cell) / vec2(3.0, 2.0)).rgb;
          // a sheen sweeps across every few seconds
          c += vec3(0.3) * smoothstep(0.12, 0.0, abs(p.x + p.y * 0.4 - mod(time * 0.9, 6.0) + 3.0));
        } else if (mode < 9.5) {     // a roulette wheel, ball racing the other way
          p -= vec2(0.0, 0.3);
          float r = length(p * vec2(1.0, 1.1)), a = atan(p.y, p.x), spin = time * 0.9;
          float seg = floor(mod(a + spin, 6.2832) / 6.2832 * 38.0);
          vec3 pocket = seg < 1.5 ? vec3(0.03, 0.5, 0.2) : mod(seg, 2.0) < 1.0 ? vec3(0.72, 0.04, 0.07) : vec3(0.02);
          c = r < 1.02 ? pocket : vec3(0.3, 0.14, 0.05);
          c = mix(c, vec3(0.86, 0.68, 0.28), smoothstep(0.03, 0.01, abs(r - 1.02)) + smoothstep(0.02, 0.01, abs(r - 0.72)));
          if (r < 0.7) c = vec3(0.34, 0.18, 0.07) * (0.8 + 0.3 * sin(a * 8.0 + spin * 8.0));
          if (r < 0.14) c = vec3(0.86, 0.68, 0.28);
          float ba = -time * 2.3, br = mix(0.92, 0.86, smoothstep(5.0, 8.0, mod(time, 9.0)));
          c = mix(c, vec3(1.0), smoothstep(0.075, 0.055, length(p * vec2(1.0, 1.1) - br * vec2(cos(ba), sin(ba)))));
        } else if (mode < 10.5) {    // the jack-o'-lantern, candle flickering
          p -= vec2(0.0, 0.3);
          float rib = 0.72 + 0.28 * abs(sin(p.x * 7.0));
          c = vec3(0.72, 0.24, 0.015) * rib * (1.0 - 0.3 * abs(lat));
          float flick = 0.85 + 0.15 * sin(time * 17.0) * sin(time * 7.0);
          vec3 fire = vec3(1.0, 0.9, 0.42) * flick * 2.0;
          vec2 e = vec2(abs(p.x) - 0.42, p.y - 0.3);
          float eye = step(e.y, 0.2 - abs(e.x) * 1.2) * step(-0.12, e.y);
          float nose = step(abs(p.x), 0.1 - (p.y - 0.12) * 0.9) * step(0.0, p.y) * step(p.y, 0.12);
          vec2 m = vec2(p.x, p.y + 0.38 + 0.2 * p.x * p.x * 2.0);
          float mouth = step(abs(m.x), 0.82) * step(abs(m.y), 0.14 - step(0.5, fract(m.x * 2.6)) * -0.07 + step(fract(m.x * 2.6), 0.5) * -0.07);
          c = mix(c, fire, clamp(eye + nose + mouth, 0.0, 1.0));
          c = mix(c, vec3(0.2, 0.34, 0.08), step(1.02, lat));
        } else if (mode < 11.5) {    // a mirror ball, sparkling as it turns
          vec2 fg = vec2((lon + time * 0.22) * 16.0, lat * 16.0);
          vec2 id = floor(fg), fd = fract(fg) - 0.5;
          float seed = h21(id), tw = pow(0.5 + 0.5 * sin(time * (2.0 + seed * 5.0) + seed * 40.0), 14.0);
          float tile = smoothstep(0.5, 0.42, max(abs(fd.x), abs(fd.y)));
          c = mix(vec3(0.05), vec3(0.34, 0.37, 0.42) + 0.3 * seed, tile);
          c += (0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + seed * 6.28 + time)) * tw * 2.2 * tile;
        } else if (mode > 17.5) {    // the aquarium, the slot machine, the 8 ball, the arcade, the snow globe
          c = extraShow(mode, lon, lat, p, showT, time);
        } else if (mode > 12.5) {    // the robotaxi shows and the credit
          c = robotaxiShow(mode, lon, lat, p, showT);
        } else {                     // a beach ball, bobbing and rolling
          float l = lon + time * 0.55 + 0.4 * sin(time * 0.8);
          float pan = mod(floor((l + 3.1416) / 1.0472), 6.0);
          c = pan < 0.5 ? vec3(0.9, 0.12, 0.14) : pan < 1.5 ? vec3(0.97) : pan < 2.5 ? vec3(0.08, 0.32, 0.86) : pan < 3.5 ? vec3(0.97) : pan < 4.5 ? vec3(0.98, 0.76, 0.08) : vec3(0.97);
          c = mix(c, vec3(0.97), smoothstep(1.1, 1.14, abs(lat)));
        }
        c *= mix(0.2, 1.0, blend);
        gl_FragColor = vec4((c * dotm * 1.15 + 0.02) * mix(0.9, 0.62, uNight), 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(f.c[0], H - R, f.c[1]);
    const grp = new THREE.Group();
    grp.name = 'Sphere';
    grp.add(m);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(70, 74, 3, 64), sheen('#000000', {
        live: 'plaza'
    }));
    plinth.position.set(f.c[0], 1.5, f.c[1]);
    grp.add(plinth);
    const glowAir = halo(420, '#bcd4ff', 0.12);
    glowAir.position.set(f.c[0], H * 0.55, f.c[1]);
    grp.add(glowAir);
    const spill = new THREE.Mesh(new THREE.CircleGeometry(210, 48).rotateX(-Math.PI / 2), nightAura('#9cc0ff', 0.08));
    spill.position.set(f.c[0], 0.5, f.c[1]);
    grp.add(spill);
    engine.animate(grp, ()=>{}, new THREE.Sphere(new THREE.Vector3(f.c[0], H / 2, f.c[1]), R * 1.1));
    return grp;
}
const ROLLER_SPIN = 0.015;
function highRoller(data, engine) {
    const poi = data.pois.find((p)=>/^high roller$/i.test(p.n));
    if (!poi) return null;
    const R = 79, hub = 88;
    const grp = new THREE.Group();
    grp.name = 'High Roller';
    grp.position.set(poi.x, hub, poi.z);
    grp.rotation.y = Math.PI / 2;
    const steel = sheen('#e8ecf2', {
        refl: 0.35,
        spec: 1.2,
        glow: '#ff4fd8',
        glowK: 1.5
    });
    const spokeM = sheen('#d4dae4', {
        refl: 0.2,
        spec: 0.6,
        glow: '#ff7ae0',
        glowK: 0.5
    });
    const trim = sheen('#8b8f96', {
        refl: 0.2
    });
    const glass = sheen('#b9d9ec', {
        refl: 0.6,
        spec: 1.4,
        glow: '#8fdcff',
        glowK: 0.9
    });
    const spin = new THREE.Group();
    const add = (geo, m, x = 0, y = 0, z = 0)=>{
        const o = new THREE.Mesh(geo, m);
        o.position.set(x, y, z);
        spin.add(o);
        return o;
    };
    for (const z of [
        -3,
        3
    ])add(new THREE.TorusGeometry(R, 0.9, 8, 120), steel, 0, 0, z);
    add(new THREE.TorusGeometry(R * 0.96, 0.4, 6, 120), steel);
    add(new THREE.CylinderGeometry(3, 3, 10, 16).rotateX(Math.PI / 2), trim);
    for(let i = 0; i < 28; i++){
        const a = i / 28 * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
        for (const z of [
            -3,
            3
        ]){
            const sp = add(new THREE.CylinderGeometry(0.16, 0.16, R, 5), spokeM, x * R / 2, y * R / 2, z);
            sp.rotation.z = a - Math.PI / 2;
        }
        const cab = add(new THREE.SphereGeometry(4.6, 14, 10), glass, x * (R + 5), y * (R + 5), 0);
        cab.scale.set(1, 0.8, 1);
        add(new THREE.TorusGeometry(4.5, 0.25, 6, 16).rotateX(Math.PI / 2), trim, x * (R + 5), y * (R + 5), 0);
    }
    const wheel = bakeStatic(spin);
    wheel.userData.crane = true;
    grp.add(wheel);
    const legs = new THREE.Group();
    for (const sx of [
        -1,
        1
    ])for (const z of [
        -10,
        10
    ]){
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, hub * 1.1, 10), trim);
        leg.position.set(sx * 13, -hub / 2, z * 0.7);
        leg.rotation.z = sx * 0.29;
        leg.rotation.x = z > 0 ? -0.08 : 0.08;
        legs.add(leg);
    }
    grp.add(bakeStatic(legs));
    const glowRim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.2, 2.6, 6, 80), nightAura('#ff5fd0', 0.1));
    grp.add(glowRim);
    engine.animate(grp, (fi)=>{
        wheel.rotation.z = fi.t * ROLLER_SPIN;
        wheel.updateMatrix();
    }, new THREE.Sphere(new THREE.Vector3(poi.x, hub, poi.z), R + 12));
    return grp;
}
function eiffel(data) {
    const f = footprint(data, /^eiffel tower$/i);
    if (!f) return null;
    const grp = new THREE.Group();
    const latticeMat = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uNight: theme.uniforms.uNight,
            uCol: {
                value: new THREE.Color('#d9c7a3')
            }
        },
        fog: true,
        side: THREE.DoubleSide,
        vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv; varying float vY;
      void main() { vUv = uv; vY = position.y; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
        fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uNight; uniform vec3 uCol; varying vec2 vUv; varying float vY;
      void main() {
        // X-bracing lattice: two diagonal families + horizontal ties + edge members
        vec2 g = vUv * vec2(6.0, 40.0);
        float d1 = abs(fract(g.x + g.y) - 0.5), d2 = abs(fract(g.x - g.y) - 0.5);
        float fw = fwidth(g.y) * 1.2;
        float bar = 1.0 - smoothstep(0.08, 0.08 + fw, min(d1, d2));
        float tie = 1.0 - smoothstep(0.06, 0.06 + fw, abs(fract(g.y) - 0.5) - 0.38);
        float edge = step(vUv.x, 0.06) + step(0.94, vUv.x);
        float a = clamp(max(max(bar, tie * 0.0), edge), 0.0, 1.0);
        float far = clamp(fw * 3.0, 0.0, 1.0);
        a = mix(a, 0.75, far);
        if (a < 0.5) discard;
        vec3 c = uCol * mix(0.75, 1.0, 1.0 - uNight);
        c += vec3(1.0, 0.78, 0.4) * uNight * 0.3;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`
    });
    const H = 165, base = Math.min(f.w, f.d) * 0.5 * 0.92 || 32;
    const hw = (y)=>{
        const t = y / H;
        return base * (Math.exp(-3.1 * t) * (1 - t * 0.25)) + 1.2;
    };
    const faces = new Soup();
    const uvs = [];
    const seg = 28;
    for(let side = 0; side < 4; side++){
        const a0 = side / 4 * Math.PI * 2 + Math.PI / 4, a1 = (side + 1) / 4 * Math.PI * 2 + Math.PI / 4;
        for(let i = 0; i < seg; i++){
            const y0 = i / seg * H * 0.93, y1 = (i + 1) / seg * H * 0.93;
            const r0 = hw(y0) * Math.SQRT2, r1 = hw(y1) * Math.SQRT2;
            const P = (r, a, y)=>[
                    Math.cos(a) * r,
                    y,
                    Math.sin(a) * r
                ];
            const p0 = P(r0, a0, y0), p1 = P(r0, a1, y0), p2 = P(r1, a1, y1), p3 = P(r1, a0, y1);
            const n = [
                Math.cos((a0 + a1) / 2),
                0,
                Math.sin((a0 + a1) / 2)
            ];
            const archOpen = y1 < 40;
            if (!archOpen) {
                const v = [
                    p0,
                    p1,
                    p2,
                    p3
                ].map((p)=>faces.vert(p[0], p[1], p[2], n));
                faces.quad(v[0], v[1], v[2], v[3]);
            } else {
                const L = (t, pa, pb)=>[
                        pa[0] + (pb[0] - pa[0]) * t,
                        pa[1],
                        pa[2] + (pb[2] - pa[2]) * t
                    ];
                for (const [t0, t1] of [
                    [
                        0,
                        0.3
                    ],
                    [
                        0.7,
                        1
                    ]
                ]){
                    const q0 = L(t0, p0, p1), q1 = L(t1, p0, p1), q2 = L(t1, p3, p2), q3 = L(t0, p3, p2);
                    const vv = [
                        q0,
                        q1,
                        q2,
                        q3
                    ].map((p)=>faces.vert(p[0], p[1], p[2], n));
                    faces.quad(vv[0], vv[1], vv[2], vv[3]);
                    uvs.push(t0, i / seg, t1, i / seg, t1, (i + 1) / seg, t0, (i + 1) / seg);
                }
            }
            if (!archOpen) uvs.push(0, i / seg, 1, i / seg, 1, (i + 1) / seg, 0, (i + 1) / seg);
        }
    }
    const geo = faces.geometry();
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    grp.add(new THREE.Mesh(geo, latticeMat));
    const plat = litColor('#cdb991', {
        emissive: 0.15
    });
    for (const [y, s] of [
        [
            40,
            1.05
        ],
        [
            80,
            1.0
        ],
        [
            140,
            1.1
        ]
    ]){
        const w = hw(y) * 2 * s;
        const p = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, w), plat);
        p.position.y = y;
        grp.add(p);
    }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.6, 22, 6), plat);
    spire.position.y = H * 0.93 + 10;
    grp.add(spire);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), glow('#fff2c4'));
    beacon.position.y = H + 0.5;
    grp.add(beacon);
    grp.position.set(f.c[0], 0, f.c[1]);
    grp.rotation.y = -f.yaw;
    grp.name = 'Eiffel Tower';
    return grp;
}
function balloon(data) {
    const f = footprint(data, /^paris balloon$/i);
    if (!f) return null;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const x = c.getContext('2d');
    for(let i = 0; i < 16; i++){
        x.fillStyle = i % 2 ? '#1f3c8c' : '#d9b24c';
        x.fillRect(i * 64, 0, 64, 512);
    }
    x.fillStyle = '#b3122e';
    x.fillRect(0, 224, 1024, 88);
    x.fillStyle = '#ffffff';
    x.font = '700 72px Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for(let i = 0; i < 4; i++)x.fillText('PARIS', 128 + i * 256, 270);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    const skin = sheen('#ffffff', {
        map: tex,
        refl: 0.08,
        spec: 0.5,
        glowK: 0.75
    });
    const grp = new THREE.Group();
    grp.name = 'Paris balloon';
    grp.position.set(f.c[0], 0, f.c[1]);
    const S = 1.5, add = (geo, m, y)=>{
        const o = new THREE.Mesh(geo, m);
        o.position.y = y * S;
        o.scale.setScalar(S);
        grp.add(o);
        return o;
    };
    const env = add(new THREE.SphereGeometry(9, 40, 24), skin, 30);
    env.scale.set(S, S * 1.15, S);
    add(new THREE.CylinderGeometry(3.2, 1.6, 5, 24), skin, 18.5);
    add(new THREE.BoxGeometry(3.4, 2.6, 3.4), sheen('#7a5a34'), 13.5);
    const iron = sheen('#6f543b', {
        refl: 0.2,
        spec: 0.8,
        glow: '#ffc46b',
        glowK: 0.5
    });
    add(new THREE.CylinderGeometry(0.8, 1.1, 13, 12), iron, 6.5);
    const glowB = halo(60, '#ffd98a', 0.1);
    glowB.position.y = 30 * S;
    grp.add(glowB);
    for (const r of [
        0,
        Math.PI
    ]){
        const board = textPanel('PARIS', 21, 6, {
            color: '#f7df9b',
            font: 'italic 700 110px Georgia, serif',
            background: '#1f2f64',
            sub: 'LAS VEGAS'
        });
        board.position.set(Math.sin(r) * 1.9, 5.5 * S, Math.cos(r) * 1.9);
        board.rotation.y = r;
        grp.add(board);
    }
    return grp;
}
function luxor(data) {
    const f = footprint(data, /^luxor( las vegas)?$/i);
    if (!f) return null;
    const grp = new THREE.Group();
    const H = 107, half = Math.max(f.w, f.d) / 2 || 92;
    const geo = new THREE.ConeGeometry(half * Math.SQRT2, H, 4, 1, false, Math.PI / 4);
    geo.translate(0, H / 2, 0);
    const glass = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uNight: theme.uniforms.uNight,
            uSunDir: theme.uniforms.uSunDir
        },
        fog: true,
        vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vN; varying vec3 vL;
      void main() { vN = normalize(mat3(modelMatrix) * normal); vL = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
        fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uNight; uniform vec3 uSunDir; varying vec3 vN; varying vec3 vL;
      void main() {
        vec3 n = normalize(vN);
        float key = max(dot(n, uSunDir), 0.0);
        vec3 c = vec3(0.008, 0.011, 0.018) * (0.7 + 0.5 * key) + vec3(0.1, 0.09, 0.07) * pow(key, 6.0) * (1.0 - uNight);
        // a few warm room windows scattered across the inclined faces at night
        vec2 g = vec2(atan(vL.z, vL.x) * 60.0, vL.y / 3.6);
        float win = step(0.975, fract(sin(dot(floor(g), vec2(12.9898, 78.233))) * 43758.5453));
        float fwv = fwidth(g.y);
        win *= clamp(1.0 - fwv * 2.0, 0.0, 1.0);
        c += vec3(1.0, 0.78, 0.5) * win * 0.55 * uNight;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`
    });
    grp.add(new THREE.Mesh(geo, glass));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 0.8, 2600, 12, 1, true), new THREE.ShaderMaterial({
        uniforms: {
            uNight: theme.uniforms.uNight
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: `varying float vY; void main(){ vY = position.y / 2600.0 + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uNight; varying float vY; void main(){ float a = (1.0 - vY) * (1.0 - vY) * 0.55 * uNight; gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * a, a); }`
    }));
    beam.position.y = H + 1300;
    grp.add(beam);
    grp.position.set(f.c[0], 0, f.c[1]);
    grp.rotation.y = -f.yaw;
    grp.name = 'Luxor';
    return grp;
}
function strat(data) {
    const f = footprint(data, /^stratosphere tower$|^the strat tower$/i);
    if (!f) return null;
    const grp = new THREE.Group();
    const conc = litColor('#d9dde4');
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(7, 11, 262, 3, 1), conc);
    shaft.position.y = 131;
    grp.add(shaft);
    for(let i = 0; i < 3; i++){
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 6.5, 250, 5), conc);
        const a = i / 3 * Math.PI * 2;
        leg.position.set(Math.cos(a) * 8.5, 125, Math.sin(a) * 8.5);
        grp.add(leg);
    }
    const podGlass = litColor('#3c4e6e', {
        emissive: 0.2
    });
    const levels = [
        [
            262,
            20,
            26
        ],
        [
            270,
            26,
            27
        ],
        [
            277,
            27.5,
            27.5
        ],
        [
            284,
            27,
            25
        ],
        [
            290,
            24,
            18
        ],
        [
            296,
            16,
            10
        ]
    ];
    for (const [y, r0, r1] of levels){
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 6.4, 32), y % 2 ? conc : podGlass);
        m.position.y = y;
        grp.add(m);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(27.8, 0.6, 4, 64).rotateX(Math.PI / 2), glow('#ff5a5a'));
    ring.position.y = 277;
    grp.add(ring);
    const lit = sheen('#d9f1ff', {
        glow: '#8fd8ff',
        glowK: 1.4,
        baseGlow: 0.05
    });
    for (const [y, r] of [
        [
            266,
            24
        ],
        [
            288,
            25
        ]
    ]){
        const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.45, 4, 56).rotateX(Math.PI / 2), lit);
        band.position.y = y;
        grp.add(band);
    }
    const crownS = new THREE.Mesh(new THREE.ConeGeometry(15, 11, 40), conc);
    crownS.position.y = 304;
    grp.add(crownS);
    for(let a = 0; a < 4; a++){
        const sign = textPanel('The STRAT', 24, 5, {
            font: '700 100px "Helvetica Neue", Arial, sans-serif',
            color: '#c2eaff'
        });
        sign.position.set(Math.sin(a * Math.PI / 2) * 28.4, 274, Math.cos(a * Math.PI / 2) * 28.4);
        sign.rotation.y = a * Math.PI / 2;
        grp.add(sign);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.2, 52, 8), conc);
    mast.position.y = 325;
    grp.add(mast);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), glow('#ff3b30'));
    tip.position.y = 352;
    grp.add(tip);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(32, 2, 3), litColor('#e8c547'));
    arm.position.set(18, 300, 0);
    arm.rotation.z = -0.25;
    grp.add(arm);
    grp.position.set(f.c[0], 0, f.c[1]);
    grp.name = 'The STRAT';
    return grp;
}
function pointInRing(x, z, ring) {
    let c = false;
    for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){
        const a = ring[i], b = ring[j];
        if (a[1] > z !== b[1] > z && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
}
function fountains(data, engine) {
    const poi = data.pois.find((p)=>/fountains of bellagio/i.test(p.n));
    let lake = null, bd = Infinity;
    const ref = poi ? [
        poi.x,
        poi.z
    ] : latLonToXZ(ORIGIN, 36.1131, -115.1739);
    for (const a of data.areas){
        if (a.k !== 'water' || a.pts.length < 6) continue;
        const c = centroid(a.pts), d = Math.hypot(c[0] - ref[0], c[1] - ref[1]);
        if (d < bd && Math.abs(ringArea(a.pts)) > 20000) {
            bd = d;
            lake = a.pts;
        }
    }
    if (!lake || bd > 300) return null;
    const { yaw, w, d } = obb(lake);
    const c = centroid(lake);
    const ax = Math.cos(yaw), az = Math.sin(yaw);
    const grp = new THREE.Group();
    grp.name = 'Bellagio fountains';
    const jetsAt = [];
    const perRow = 130;
    for(let row = 0; row < 2; row++)for(let i = 0; i < perRow; i++){
        const t = i / (perRow - 1);
        const u = (t - 0.5) * w * 0.9;
        const v = (row ? -1 : 1) * (d * 0.13 + Math.cos(u / w * Math.PI * 2) * d * 0.12);
        const x = c[0] + ax * u - az * v, z = c[1] + az * u + ax * v;
        if (pointInRing(x, z, lake)) jetsAt.push({
            x,
            z,
            t,
            row
        });
    }
    const N = jetsAt.length;
    const uShow = {
        value: 0
    };
    const jets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 1.3, 1, 8, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({
        uniforms: {
            uNight: theme.uniforms.uNight,
            uTime: theme.uniforms.uTime
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: `
      varying float vY;
      void main() { vY = position.y; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
      uniform float uNight; varying float vY;
      void main() {
        vec3 day = vec3(0.93, 0.98, 1.0);
        vec3 lit = mix(vec3(1.0, 0.82, 0.5), vec3(0.92, 0.96, 1.0), smoothstep(0.0, 0.7, vY));
        vec3 c = mix(day, lit * 0.62, uNight);
        float a = mix(0.72, 0.85, uNight) * (1.0 - vY * 0.72);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`
    }), N);
    jets.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), po = new THREE.Vector3();
    const update = (time)=>{
        const cycle = time % 30, pat = Math.floor(time / 30) % 4;
        const env = Math.min(1, cycle / 1.5) * Math.min(1, Math.max(0, 24 - cycle) / 1.5);
        uShow.value = env;
        for(let i = 0; i < N; i++){
            const j = jetsAt[i];
            const idx = j.t * (perRow - 1);
            let h;
            if (pat === 0) {
                const wave = 0.5 + 0.5 * Math.sin(time * 2.2 - idx * 0.35 + j.row * 1.3);
                h = 8 + 58 * wave;
            } else if (pat === 1) {
                const k = Math.pow(Math.max(0, Math.sin(cycle * 0.9 + Math.floor(idx) % 10 * 0.63)), 6);
                h = 12 + 128 * k;
            } else if (pat === 2) {
                h = 14 + 80 * (0.5 + 0.5 * Math.sin(cycle * 1.3)) * (1 - Math.abs(j.t - 0.5) * 1.5);
            } else {
                const dist = Math.abs(j.t - 0.5) * 2;
                const pulse = Math.pow(0.5 + 0.5 * Math.sin(cycle * 3.2 - dist * 9 + j.row), 3);
                h = 10 + (cycle > 19 ? 130 * (0.55 + 0.45 * pulse) : 70 * pulse);
            }
            h = 1 + h * env;
            sc.set(1 + h * 0.018, h, 1 + h * 0.018);
            po.set(j.x, 0.25, j.z);
            jets.setMatrixAt(i, m.compose(po, q, sc));
        }
        jets.instanceMatrix.needsUpdate = true;
    };
    update(0);
    grp.add(jets);
    const surf = new Soup();
    surf.polygon(lake, 0.2);
    const water = new THREE.Mesh(surf.geometry(), new THREE.ShaderMaterial({
        uniforms: {
            uTime: theme.uniforms.uTime,
            uNight: theme.uniforms.uNight,
            uShow,
            uC: {
                value: new THREE.Vector2(c[0], c[1])
            },
            uAxis: {
                value: new THREE.Vector2(ax, az)
            },
            uSize: {
                value: new THREE.Vector2(w, d)
            }
        },
        transparent: true,
        depthWrite: false,
        vertexShader: `
      varying vec2 vP;
      void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
      uniform float uTime, uNight, uShow; uniform vec2 uC, uAxis, uSize; varying vec2 vP;
      void main() {
        vec2 r = vP - uC;
        float u = dot(r, uAxis), v = dot(r, vec2(-uAxis.y, uAxis.x));
        float rip = sin(u * 0.32 + uTime * 1.3 + sin(v * 0.21)) * sin(v * 0.41 - uTime * 0.9 + sin(u * 0.17));
        float fw = fwidth(u) * 0.32;
        rip *= clamp(1.0 - fw, 0.0, 1.0);
        float weave = abs(abs(v) - (uSize.y * 0.13 + cos(u / uSize.x * 6.2832) * uSize.y * 0.12));
        float line = exp(-weave * weave * 0.012) * uShow;
        float a = 0.1 * max(rip, 0.0) + line * mix(0.28, 0.5, uNight);
        vec3 c = mix(vec3(0.95, 0.98, 1.0), vec3(1.0, 0.82, 0.5), uNight);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`
    }));
    water.renderOrder = 25;
    grp.add(water);
    const rail = new Soup();
    const ring = lake;
    const lamps = [];
    const globe = new THREE.Color('#ffe7bd');
    let run = 0;
    for(let i = 0; i < ring.length; i++){
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        const n = [
            dz / L,
            0,
            -dx / L
        ];
        const v = [
            rail.vert(a[0], 0, a[1], n),
            rail.vert(b[0], 0, b[1], n),
            rail.vert(b[0], 1.2, b[1], n),
            rail.vert(a[0], 1.2, a[1], n)
        ];
        rail.quad(v[0], v[1], v[2], v[3]);
        run += L;
        if (run > 14) {
            run = 0;
            box(rail, a[0], a[1], 0.5, 0.5, 0, 4, 0);
            lamps.push({
                x: a[0],
                y: 4.3,
                z: a[1],
                color: globe,
                size: 3.2
            });
        }
    }
    grp.add(new THREE.Mesh(rail.geometry(), sheen('#e7dcc6', {
        glow: '#ffdca8',
        glowK: 0.5
    })), glowPoints(lamps, 'lamps', 1.8, 1));
    engine.animate(grp, (fi)=>update(fi.t), new THREE.Sphere(new THREE.Vector3(c[0], 40, c[1]), w * 0.7));
    return grp;
}
function monorail(data) {
    const s = new Soup();
    const H = 9.5;
    for (const r of data.rail){
        if (r.k !== 'monorail') continue;
        const pts = r.pts;
        if (pts.length < 2) continue;
        const n = normals(pts);
        for(let i = 0; i < pts.length - 1; i++){
            const a = pts[i], b = pts[i + 1];
            for (const side of [
                -1,
                1
            ]){
                const na = n[i], nb = n[i + 1];
                const off = side * 2.4;
                const a0 = [
                    a[0] + na[0] * off,
                    a[1] + na[1] * off
                ], b0 = [
                    b[0] + nb[0] * off,
                    b[1] + nb[1] * off
                ];
                const L = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1;
                const sx = -(b0[1] - a0[1]) / L * 0.35, sz = (b0[0] - a0[0]) / L * 0.35;
                const top = [
                    s.vert(a0[0] - sx, H, a0[1] - sz, [
                        0,
                        1,
                        0
                    ]),
                    s.vert(a0[0] + sx, H, a0[1] + sz, [
                        0,
                        1,
                        0
                    ]),
                    s.vert(b0[0] + sx, H, b0[1] + sz, [
                        0,
                        1,
                        0
                    ]),
                    s.vert(b0[0] - sx, H, b0[1] - sz, [
                        0,
                        1,
                        0
                    ])
                ];
                s.quad(top[0], top[1], top[2], top[3]);
                for (const k of [
                    -1,
                    1
                ]){
                    const nn = [
                        sx * k / 0.35,
                        0,
                        sz * k / 0.35
                    ];
                    const v = [
                        s.vert(a0[0] + sx * k, H - 1.6, a0[1] + sz * k, nn),
                        s.vert(b0[0] + sx * k, H - 1.6, b0[1] + sz * k, nn),
                        s.vert(b0[0] + sx * k, H, b0[1] + sz * k, nn),
                        s.vert(a0[0] + sx * k, H, a0[1] + sz * k, nn)
                    ];
                    s.quad(v[0], v[1], v[2], v[3]);
                }
            }
        }
        let acc = 0;
        for(let i = 0; i < pts.length - 1; i++){
            const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            for(let d = 30 - acc; d < L; d += 30){
                const t = d / L, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
                const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
                box(s, x, z, 1.4, 1.4, 0, H - 2.2, yaw);
                box(s, x, z, 6.2, 1.2, H - 2.4, H - 1.6, yaw + Math.PI / 2);
            }
            acc = (acc + L) % 30;
        }
    }
    if (!s.idx.length) return null;
    const m = new THREE.Mesh(s.geometry(), litMaterial('pillar'));
    m.name = 'Monorail';
    void lineLength;
    return m;
}
function fremont(data, engine) {
    const cand = [
        ...data.roads,
        ...data.walks
    ].filter((w)=>/^fremont street$/i.test(w.name ?? '') && /pedestrian|living_street|footway/.test(w.hw));
    if (!cand.length) return null;
    const pts = cand.sort((a, b)=>lineLength(b.pts) - lineLength(a.pts))[0].pts.slice();
    for(let guard = 0; guard < 20; guard++){
        let grew = false;
        for (const w of cand){
            const a = w.pts[0], b = w.pts[w.pts.length - 1], h = pts[0], t = pts[pts.length - 1];
            const near = (p, q)=>Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5;
            if (near(a, t) && !near(b, h)) {
                pts.push(...w.pts.slice(1));
                grew = true;
            } else if (near(b, t) && !near(a, h)) {
                pts.push(...w.pts.slice(0, -1).reverse());
                grew = true;
            } else if (near(b, h) && !near(a, t)) {
                pts.unshift(...w.pts.slice(0, -1));
                grew = true;
            } else if (near(a, h) && !near(b, t)) {
                pts.unshift(...w.pts.slice(1).reverse());
                grew = true;
            }
        }
        if (!grew || lineLength(pts) > 520) break;
    }
    const L = lineLength(pts);
    if (L < 120) return null;
    const n = normals(pts);
    const s = new Soup();
    const uv = [];
    const ARC = 14, W = 15;
    let acc = 0;
    for(let i = 0; i < pts.length; i++){
        if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        for(let k = 0; k <= ARC; k++){
            const a = k / ARC * Math.PI;
            const u = -Math.cos(a) * W, y = 20 + Math.sin(a) * 7;
            s.vert(pts[i][0] + n[i][0] * u, y, pts[i][1] + n[i][1] * u, [
                n[i][0] * -Math.cos(a),
                Math.sin(a),
                n[i][1] * -Math.cos(a)
            ]);
            uv.push(acc / L, k / ARC);
        }
        if (i) for(let k = 0; k < ARC; k++){
            const r0 = (i - 1) * (ARC + 1) + k, r1 = i * (ARC + 1) + k;
            s.quad(r0, r1, r1 + 1, r0 + 1);
        }
    }
    const geo = s.geometry();
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uTime: theme.uniforms.uTime,
            uNight: theme.uniforms.uNight,
            uLen: {
                value: L
            }
        },
        fog: true,
        side: THREE.DoubleSide,
        vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
        fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime, uNight, uLen; varying vec2 vUv;
      vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1), k, s); }
      void main() {
        float x = vUv.x * uLen / 30.0, y = vUv.y;
        float t = uTime;
        // scenes roll down the length of the vault: the neon wave, then the rainbow sweep
        float pulse = 0.5 + 0.5 * sin(vUv.x * uLen * 0.18 + t * 4.0);
        float neon = 0.5 + 0.5 * sin(y * 32.0 - t * 6.0);
        vec3 wave = mix(vec3(0.96, 0.25, 0.58), vec3(0.24, 0.54, 0.98), pulse) + vec3(0.98, 0.75, 0.18) * neon * 0.6;
        vec3 sweep = hsv(fract(x * 0.05 - t * 0.06 + 0.2 * sin(y * 6.0 + t)), 0.85, 1.0) * (0.55 + 0.45 * sin(x * 2.0 - t * 3.0 + y * 4.0));
        vec3 c = mix(wave, sweep, smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(t * 0.21 + x * 0.04))) * mix(1.1, 0.5, uNight);
        // individual LEDs up close
        vec2 led = vec2(vUv.x * uLen / 0.9, y * 40.0);
        vec2 lfw = fwidth(led);
        c *= mix(0.55 + 0.75 * smoothstep(0.5, 0.2, length(fract(led) - 0.5)), 0.95, clamp(max(lfw.x, lfw.y) * 1.5, 0.0, 1.0));
        // steel ribs every ~9 m
        float rib = smoothstep(0.92, 0.97, fract(vUv.x * uLen / 9.0));
        c = mix(c, vec3(0.15, 0.17, 0.22), rib);
        c = mix(c * 0.55 + vec3(0.1, 0.11, 0.14), c, uNight);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`
    });
    const m = new THREE.Mesh(geo, mat);
    const cols = new Soup();
    let d = 0;
    for(let i = 0; i < pts.length - 1; i++){
        const a = pts[i], b = pts[i + 1], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for(let s2 = 36 - d; s2 < seg; s2 += 36){
            const t = s2 / seg, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
            for (const side of [
                -1,
                1
            ])box(cols, x + n[i][0] * W * side, z + n[i][1] * W * side, 1.2, 1.2, 0, 20, 0);
        }
        d = (d + seg) % 36;
    }
    const grp = new THREE.Group();
    grp.add(m, new THREE.Mesh(cols.geometry(), litMaterial('pillar')));
    grp.name = 'Fremont Street Experience';
    const truss = sheen('#334155', {
        refl: 0.3,
        spec: 0.9
    });
    let along = 0;
    for(let i = 0; i < pts.length - 1; i++){
        const a = pts[i], b = pts[i + 1], seg = Math.hypot(b[0] - a[0], b[1] - a[1]), yawS = Math.atan2(b[1] - a[1], b[0] - a[0]);
        for(let s2 = (27 - along % 27) % 27; s2 < seg; s2 += 27){
            const t = s2 / seg, arch = new THREE.Mesh(new THREE.TorusGeometry(15.2, 0.45, 6, 18, Math.PI), truss);
            arch.scale.y = 0.48;
            arch.position.set(a[0] + (b[0] - a[0]) * t, 20, a[1] + (b[1] - a[1]) * t);
            arch.rotation.y = Math.PI / 2 - yawS;
            grp.add(arch);
        }
        along += seg;
    }
    for (const [end, inner, text, sub] of [
        [
            pts[pts.length - 1],
            pts[pts.length - 2],
            'FREMONT STREET',
            'EXPERIENCE'
        ],
        [
            pts[0],
            pts[1],
            'VIVA VISION',
            'FREMONT EAST'
        ]
    ]){
        const out = Math.atan2(end[0] - inner[0], end[1] - inner[1]);
        const gate = textPanel(text, 28, 8, {
            font: '800 110px "Helvetica Neue", Arial, sans-serif',
            color: '#ffd374',
            background: '#54253e',
            sub
        });
        gate.position.set(end[0], 22, end[1]);
        gate.rotation.y = out;
        grp.add(gate);
    }
    const vicAt = pts[Math.floor(pts.length * 0.5)];
    const vicN = n[Math.floor(pts.length * 0.5)];
    const vicMat = sheen('#fbbf24', {
        glow: '#ffbe2e',
        glowK: 2.2,
        baseGlow: 0.2
    });
    const vic = new THREE.Group();
    vic.position.set(vicAt[0] + vicN[0] * 22, 0, vicAt[1] + vicN[1] * 22);
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 15, 1), vicMat);
    body.position.y = 27;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 1, 16), sheen('#f4f0e6', {
        glow: '#ffffff',
        glowK: 1
    }));
    hat.position.y = 38;
    const headV = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 8), vicMat);
    headV.position.y = 36;
    const armV = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 1), vicMat);
    armV.position.set(4, 33, 0);
    armV.rotation.z = -0.7;
    const postV = new THREE.Mesh(new THREE.BoxGeometry(1.6, 20, 1.6), truss);
    postV.position.y = 10;
    vic.add(body, hat, headV, armV, postV);
    grp.add(vic);
    engine.animate(grp, ()=>{});
    return grp;
}
