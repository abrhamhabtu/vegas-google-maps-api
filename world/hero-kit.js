/**
 * Shared kit for hand-built "hero" resorts (see docs/landmark-rebuild-playbook.md).
 * Geometry soup with battlements, the facade shader and its modes, night light spill,
 * sign panels and storybook turrets. Resort modules in world/ import from here.
 */
import { hash, ringArea } from '../landmarks/vendor/map/geom.js';
import { theme } from '../landmarks/vendor/core/theme.js';
import { SHADOW_PARS, shadowUniforms } from '../landmarks/vendor/core/shadows.js';
import { sheen, textPanel } from '../landmarks/vendor/landmarks/sheen.js';

const THREE = window.THREE;
export const WHITE = new THREE.Color(1, 1, 1);
export const SANS = '"Helvetica Neue", Arial, sans-serif';
export const SERIF = 'Georgia, "Times New Roman", serif';
/** Pass to bakeStatic so signs, halos and spill planes survive baking. */
export const keep = o => o.userData.keep === true;

// ───────────────────────────── geometry helpers ─────────────────────────────
export const centroid = ring => {
  let x = 0, z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
};
export const area = ring => Math.abs(ringArea(ring));
export const bounds = ring => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { x0, x1, z0, z1 };
};
/** Counter-clockwise, without the near-duplicate vertices the decimetre snapshot leaves behind. */
export function clean(ring) {
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3) out.push(p);
  }
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.3) out.pop();
  return ringArea(out) > 0 ? out : out.reverse();
}
/** Mitred polygon offset; positive grows the outline, negative shrinks it. Expects a clean() ring. */
export function offset(ring, d) {
  const n = ring.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = ring[(i + n - 1) % n], p = ring[i], b = ring[(i + 1) % n];
    const l0 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, l1 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const n0 = [(p[1] - a[1]) / l0, -(p[0] - a[0]) / l0], n1 = [(b[1] - p[1]) / l1, -(b[0] - p[0]) / l1];
    let mx = n0[0] + n1[0], mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-5) { mx = n0[0]; mz = n0[1]; } else { mx /= ml; mz /= ml; }
    const k = d / Math.max(0.45, mx * n0[0] + mz * n0[1]);
    out.push([p[0] + mx * k, p[1] + mz * k]);
  }
  return out;
}
/** A setback only when the shrunken outline is still a sane polygon. */
export function inset(ring, d) {
  const r = offset(ring, -d);
  const a = ringArea(r), a0 = ringArea(ring);
  return a > a0 * 0.25 && a < a0 ? r : null;
}

export class Soup {
  pos = []; nrm = []; uv = []; col = []; aux = []; idx = [];
  vert(x, y, z, n, u, c, a) {
    this.pos.push(x, y, z); this.nrm.push(n[0], n[1], n[2]); this.uv.push(u, 0);
    this.col.push(c.r, c.g, c.b); this.aux.push(a[0], a[1], a[2], a[3]);
    return this.pos.length / 3 - 1;
  }
  walls(ring, y0, y1, c = WHITE, a = [y1, 0, 0, 0]) {
    let u = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      const n = [dz / L, 0, -dx / L];
      const v0 = this.vert(p[0], y0, p[1], n, u, c, a), v1 = this.vert(q[0], y0, q[1], n, u + L, c, a);
      const v2 = this.vert(q[0], y1, q[1], n, u + L, c, a), v3 = this.vert(p[0], y1, p[1], n, u, c, a);
      this.idx.push(v0, v2, v1, v0, v3, v2);
      u += L;
    }
  }
  cap(ring, y, c = WHITE, a = [y, 0, 0, 0]) {
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p[0], p[1])), []); } catch { return; }
    const base = this.pos.length / 3;
    for (const p of ring) this.vert(p[0], y, p[1], [0, 1, 0], 0, c, a);
    for (const t of tris) this.idx.push(base + t[0], base + t[2], base + t[1]);
  }
  prism(ring, y0, y1, c, a) { this.walls(ring, y0, y1, c, a); this.cap(ring, y1, c, a); }
  /** Upright box; (ax, az) is the unit direction of its width. */
  box(cx, y0, cz, w, h, d, ax = 1, az = 0, c = WHITE, a = [y0 + h, 0, 0, 0]) {
    const px = -az, pz = ax, hw = w / 2, hd = d / 2;
    const ring = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([s, t]) => [cx + ax * s + px * t, cz + az * s + pz * t]);
    this.prism(ringArea(ring) > 0 ? ring : ring.reverse(), y0, y0 + h, c, a);
  }
  /** Battlements: a low parapet with merlons marching along every edge. */
  battlements(ring, y, c, a, { pitch = 3.1, w = 1.7, h = 1.5, t = 0.9, rail = 0.8 } = {}) {
    this.walls(ring, y, y + rail, c, a);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
      if (L < pitch * 0.9) continue;
      const count = Math.max(1, Math.floor(L / pitch)), ax = dx / L, az = dz / L;
      for (let k = 0; k < count; k++) {
        const s = (k + 0.5) * L / count;
        this.box(p[0] + ax * s - az * t * 0.5, y + rail, p[1] + az * s + ax * t * 0.5, w, h, t, ax, az, c, a);
      }
    }
  }
  mesh(material, name) {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(this.aux, 4));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.name = name;
    return m;
  }
}

// ───────────────────────────── facade material ─────────────────────────────
export const VERT = `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec4 aux; // top height, seed, variant, flood base height
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vC;
  varying vec2 vUv;
  varying vec4 vAux;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vW = wp.xyz;
    vUv = uv;
    vAux = aux;
    #ifdef USE_COLOR
      vC = color;
    #else
      vC = vec3(1.0);
    #endif
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
export const FRAG = `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor, uGlow, uFlood, uRoof, uWinLit, uWinDark, uSunDir, uSunTint, uAmbientTint, uHorizon, uTop;
  uniform float uSun, uAmbient, uNight, uMode, uFloodK, uSelf, uRoofGlow;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vC;
  varying vec2 vUv;
  varying vec4 vAux;
  ${SHADOW_PARS}
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  // anti-aliased band that settles on its own coverage once it is smaller than a pixel
  float band(float x, float a, float b, float fw) {
    float f = fract(x);
    float s = smoothstep(a - fw, a + fw, f) * (1.0 - smoothstep(b - fw, b + fw, f));
    return mix(b - a, s, clamp(1.0 - fw * 2.5, 0.0, 1.0));
  }
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vW);
    if (dot(n, v) < 0.0) n = -n;
    float night = uNight;
    float topH = vAux.x, seed = vAux.y, variant = vAux.z;
    float y = vW.y, u = vUv.x;
    vec3 base = uColor * vC;
    float hemi = 0.72 + 0.28 * n.y;
    float key = max(dot(n, uSunDir), 0.0);
    vec3 light = (uAmbient * hemi * uAmbientTint + uSun * key * uSunTint) * shadowAt(vW);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float ao = mix(0.7, 1.0, smoothstep(0.0, 11.0, y));
    vec3 c;
    vec3 e = vec3(0.0);

    if (n.y > 0.5) {
      // roofs: membrane panels by day, a dim slab catching the building's own glow at night
      vec3 rc = mix(uRoof, base, 0.16);
      vec2 q = vW.xz;
      float near = clamp(1.0 - (fwidth(q.x) + fwidth(q.y)) * 0.35, 0.0, 1.0);
      rc *= mix(1.0, 0.94 + 0.12 * h21(floor(q / 5.0) + seed), near);
      c = rc * light * mix(1.0, 0.8, night);
      e = rc * uFlood * uRoofGlow * night + uGlow * 0.03 * night;
    } else if (uMode < 0.5) {
      // MGM Grand: emerald curtain wall, every floor a continuous lit spandrel
      float fy = y / 3.3;
      float fw = fwidth(fy);
      float line = band(fy, 0.06, 0.5, fw);
      float fu = u / 1.55;
      float mull = band(fu, 0.0, 0.13, fwidth(fu));
      float row = floor(fy);
      c = mix(base * mix(0.52, 0.34, night), base * 1.08, line) * light;
      c = mix(c, c * 0.78, mull * (1.0 - line) * 0.7);
      c = mix(c, mix(uHorizon, uTop, 0.35), fres * 0.5 * (1.0 - line * 0.6) * (1.0 - night * 0.8));
      c *= mix(1.0, 0.55, night);
      float rowK = 0.84 + 0.16 * h21(vec2(row, seed));
      float faceK = 0.8 + 0.2 * dot(n, normalize(vec3(-0.5, 0.0, 0.86)));
      float rise = mix(1.0, 0.78, smoothstep(0.0, max(topH, 1.0), y));
      e += uGlow * line * rowK * faceK * rise * night * (1.0 - mull * 0.22);
      float bay = u / 3.4;
      float room = step(h21(vec2(floor(bay), row) + seed), 0.085) * (1.0 - line) * band(bay, 0.07, 0.93, fwidth(bay));
      e += mix(uGlow, vec3(1.0, 0.97, 0.82), 0.45) * room * night * 0.5;
      e += base * uSelf * night * faceK;
    } else if (uMode < 1.5) {
      // Excalibur towers: pale stucco with recessed vertical window bays, floodlit from the moat
      float fu = u / 3.6, fy = y / 3.25;
      vec2 fw = vec2(fwidth(fu), fwidth(fy));
      float strip = band(fu, 0.27, 0.73, fw.x);
      float win = strip * band(fy, 0.2, 0.8, fw.y) * step(5.0, y) * step(y, topH - 2.4);
      float aa = clamp(1.0 - max(fw.x, fw.y) * 1.6, 0.0, 1.0);
      vec2 cell = floor(vec2(fu, fy));
      c = base * light * ao;
      c = mix(c, c * 0.78, strip * 0.85);
      c = mix(c, uWinDark * (0.55 + 0.45 * (uAmbient + uSun * key)), win * 0.82 * (1.0 - night));
      c *= mix(1.0, 0.62, night);
      c = mix(c, c * 0.4, win * night);
      float lit = mix(0.11, step(h21(cell + seed * 7.0), 0.11), aa);
      e += mix(uWinLit, vec3(1.0, 0.95, 0.86), step(0.6, h21(cell.yx + seed))) * (0.55 + 0.45 * h21(cell * 1.7 + 3.0)) * win * lit * night * 0.95;
      e += base * uFlood * uFloodK * night * (0.06 + 0.6 * exp(-y / 17.0));
      e += base * uSelf * night;
    } else if (uMode < 2.5) {
      // New York-New York: masonry piers, punched windows, floodlit crowns
      float bayW = 2.9 + 0.9 * fract(seed * 3.7);
      float fu = u / bayW, fy = y / 3.4;
      vec2 fw = vec2(fwidth(fu), fwidth(fy));
      float pier = band(fu, 0.0, 0.24, fw.x);
      float body = step(5.0, y) * step(y, topH - 1.6);
      float win = band(fu, 0.32, 0.92, fw.x) * (variant > 0.5 ? band(fy, 0.08, 0.88, fw.y) : band(fy, 0.24, 0.8, fw.y)) * body;
      float aa = clamp(1.0 - max(fw.x, fw.y) * 1.6, 0.0, 1.0);
      vec2 cell = floor(vec2(fu, fy));
      c = base * light * ao;
      c = mix(c, c * 1.12, pier * 0.6);
      c *= 1.0 - 0.1 * band(fy, 0.0, 0.1, fw.y) * (1.0 - pier);
      c = mix(c, uWinDark * (0.5 + 0.5 * (uAmbient + uSun * key)), win * 0.85 * (1.0 - night));
      c = mix(c, uHorizon, fres * 0.22 * win * (1.0 - night));
      c *= mix(1.0, 0.44, night);
      c = mix(c, c * 0.3, win * night);
      float rate = 0.17 + 0.12 * fract(seed * 5.3);
      float lit = mix(rate, step(h21(cell + seed * 11.0), rate), aa);
      vec3 wl = mix(uWinLit, vec3(0.78, 0.88, 1.0), step(0.82, h21(cell.yx + seed * 2.0)));
      e += wl * (0.5 + 0.5 * h21(cell * 1.7 + 3.0)) * win * lit * night * mix(0.6, 1.0, aa);
      float crown = smoothstep(topH * 0.8, topH, y);
      e += base * uFlood * night * uFloodK * (crown * 0.85 + 0.2 * exp(-y / 16.0));
      e += base * uSelf * night;
    } else {
      // dressed stone: turrets, keeps and gatehouses, washed warm from below
      float fy = y / 2.3;
      c = base * light * ao;
      c *= 1.0 - 0.08 * band(fy, 0.0, 0.08, fwidth(fy));
      c *= mix(1.0, 0.6, night);
      e += base * uFlood * uFloodK * night * (0.2 + 0.62 * exp(-max(y - vAux.w, 0.0) / 26.0));
      e += base * uSelf * night;
    }
    gl_FragColor = vec4(c + e, 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;
export const MODE = { glass: 0, stucco: 1, masonry: 2, stone: 3 };
export function facade(mode, o = {}) {
  const u = theme.uniforms;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...shadowUniforms,
      uMode: { value: mode },
      uColor: { value: new THREE.Color(o.color ?? '#ffffff') },
      uGlow: { value: new THREE.Color(o.glow ?? '#000000') },
      uFlood: { value: new THREE.Color(o.flood ?? '#ffe2b8') },
      uFloodK: { value: o.floodK ?? 0 },
      uSelf: { value: o.self ?? 0 },
      uRoof: { value: new THREE.Color(o.roof ?? '#3a4150') },
      uRoofGlow: { value: o.roofGlow ?? 0 },
      uWinLit: { value: theme.c('windowLit') },
      uWinDark: { value: theme.c('windowDark') },
      uHorizon: { value: theme.c('skyHorizon') },
      uTop: { value: theme.c('skyTop') },
      uSunDir: u.uSunDir, uSun: u.uSun, uAmbient: u.uAmbient,
      uSunTint: u.uSunTint, uAmbientTint: u.uAmbientTint, uNight: u.uNight,
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: !!o.vertexColors,
    fog: true,
    side: THREE.DoubleSide,
  });
}

/** Light spilling from a resort onto the streets and podium roofs around it. Night only. */
export function spill(x, y, z, radius, color, k) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: k }, uNight: theme.uniforms.uNight },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `
      uniform vec3 uC; uniform float uK, uNight; varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(max(1.0 - d, 0.0), 2.0) * uK * smoothstep(0.1, 0.9, uNight);
        gl_FragColor = vec4(uC, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), material);
  mesh.position.set(x, y, z);
  mesh.userData.keep = true;
  mesh.name = 'light spill';
  const sync = () => { mesh.visible = theme.uniforms.uNight.value > 0.05; };
  theme.onChange(sync);
  sync();
  return mesh;
}
export function sign(text, w, h, x, y, z, dx, dz, o) {
  const panel = textPanel(text, w, h, o);
  panel.position.set(x, y, z);
  panel.rotation.y = Math.atan2(dx, dz);
  panel.userData.keep = true;
  return panel;
}

// ───────────────────────────── castle turrets ─────────────────────────────
export const ROOFS = () => ({
  red: sheen('#d2332f', { spec: 0.6, glow: '#ff4a3c', glowK: 0.42, baseGlow: 0.05 }),
  blue: sheen('#3567d0', { spec: 0.6, glow: '#4c84ff', glowK: 0.46, baseGlow: 0.05 }),
  gold: sheen('#e7b038', { refl: 0.3, spec: 1.0, glow: '#ffc94a', glowK: 0.5, baseGlow: 0.06 }),
});
export function turretKit() {
  return {
    stone: facade(MODE.stone, { color: '#f4f0e7', flood: '#ffdcae', floodK: 0.95, self: 0.06 }),
    trim: facade(MODE.stone, { color: '#d9d2c2', flood: '#ffdcae', floodK: 0.8 }),
    slit: sheen('#27303d', { glow: '#ffcf86', glowK: 1.25 }),
    finial: sheen('#f2cc58', { refl: 0.5, spec: 1.3, glow: '#ffe184', glowK: 0.8, baseGlow: 0.12 }),
    roofs: ROOFS(),
  };
}
/** One storybook turret: shaft, corbelled collar, merlons, conical roof and finial. */
export function turret(g, kit, x, z, r, y0, y1, roof, o = {}) {
  const add = (geometry, material, px, py, pz, ry = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(px, py, pz);
    m.rotation.y = ry;
    g.add(m);
  };
  add(new THREE.CylinderGeometry(r, r * 1.03, y1 - y0, 20, 1, true), kit.stone, x, (y0 + y1) / 2, z);
  if (o.corbel) add(new THREE.CylinderGeometry(r, r * 0.25, r * 1.5, 20), kit.trim, x, y0 - r * 0.75, z);
  add(new THREE.CylinderGeometry(r * 1.17, r, 1.4, 20), kit.trim, x, y1 - 0.5, z);
  add(new THREE.CylinderGeometry(r * 1.17, r * 1.17, 0.5, 20), kit.stone, x, y1 + 0.45, z);
  const merlons = Math.max(6, Math.min(14, Math.round(r * 2.3)));
  for (let k = 0; k < merlons; k++) {
    const a = k / merlons * Math.PI * 2;
    add(new THREE.BoxGeometry(Math.min(1.1, r * 0.45), 1.25, 0.7), kit.stone, x + Math.cos(a) * r * 1.08, y1 + 1.3, z + Math.sin(a) * r * 1.08, Math.PI / 2 - a);
  }
  const slits = r > 3 ? 4 : 3, phase = hash(x * 3.1 + z * 1.7) * 6.28;
  for (let k = 0; k < slits && y1 - y0 > 9; k++) {
    const a = phase + k / slits * Math.PI * 2;
    add(new THREE.BoxGeometry(Math.min(0.75, r * 0.3), 2.1, 0.35), kit.slit, x + Math.cos(a) * r * 1.0, y1 - 4.6 - (k % 2) * 3.4, z + Math.sin(a) * r * 1.0, Math.PI / 2 - a);
  }
  if (!roof) return;
  const coneH = Math.max(5.5, r * (o.tall ?? 3.1));
  add(new THREE.ConeGeometry(r * 1.24, coneH, 22), roof, x, y1 + 0.8 + coneH / 2, z);
  add(new THREE.CylinderGeometry(0.07, 0.2, 2.6, 6), kit.finial, x, y1 + 0.8 + coneH + 1.1, z);
  add(new THREE.SphereGeometry(Math.max(0.36, r * 0.11), 8, 6), kit.finial, x, y1 + 0.8 + coneH + 2.5, z);
}
