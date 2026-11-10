// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
export class Soup {
    pos = [];
    nrm = [];
    col = [];
    ext = [];
    uv = [];
    aux = [];
    idx = [];
    flatN = false;
    get count() {
        return this.pos.length / 3;
    }
    vert(x, y, z, n, c, e) {
        this.pos.push(x, y, z);
        if (n) this.nrm.push(n[0], n[1], n[2]);
        if (c) this.col.push(c[0], c[1], c[2]);
        if (e) this.ext.push(e[0], e[1], e[2], e[3]);
        return this.count - 1;
    }
    tri(a, b, c) {
        this.idx.push(a, b, c);
    }
    quad(a, b, c, d) {
        this.idx.push(a, b, c, a, c, d);
    }
    polygon(ring, y, holes = [], c) {
        if (ring.length < 3) return;
        const contour = ring.map((p)=>new THREE.Vector2(p[0], p[1]));
        const hs = holes.map((h)=>h.map((p)=>new THREE.Vector2(p[0], p[1])));
        let tris;
        try {
            tris = THREE.ShapeUtils.triangulateShape(contour, hs);
        } catch  {
            return;
        }
        const base = this.count;
        const all = [
            ...ring,
            ...holes.flat()
        ];
        for (const p of all)this.vert(p[0], y, p[1], this.flatN ? [
            0,
            1,
            0
        ] : undefined, c);
        for (const t of tris)this.idx.push(base + t[0], base + t[2], base + t[1]);
    }
    ribbon(line, left, right, y, c) {
        if (line.length < 2) return;
        const n = normals(line);
        let prevA = -1, prevB = -1;
        for(let i = 0; i < line.length; i++){
            const [x, z] = line[i], [nx, nz] = n[i];
            const yy = typeof y === 'number' ? y : y[i];
            const a = this.vert(x + nx * left, yy, z + nz * left, this.flatN ? [
                0,
                1,
                0
            ] : undefined, c);
            const b = this.vert(x + nx * right, yy, z + nz * right, this.flatN ? [
                0,
                1,
                0
            ] : undefined, c);
            if (prevA >= 0) this.idx.push(prevA, a, prevB, prevB, a, b);
            prevA = a;
            prevB = b;
        }
    }
    geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        if (this.nrm.length === this.pos.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
        if (this.col.length === this.pos.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        if (this.ext.length === this.pos.length / 3 * 4) g.setAttribute('ext', new THREE.Float32BufferAttribute(this.ext, 4));
        if (this.aux.length === this.pos.length / 3 * 4) g.setAttribute('aux', new THREE.Float32BufferAttribute(this.aux, 4));
        if (this.uv.length === this.pos.length / 3 * 2) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
        g.computeBoundingSphere();
        g.computeBoundingBox();
        return g;
    }
}
export class Chunked {
    size;
    m = new Map();
    constructor(size = 600){
        this.size = size;
    }
    at(x, z) {
        const k = `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`;
        let s = this.m.get(k);
        if (!s) this.m.set(k, s = new Soup());
        return s;
    }
    meshes(mat, name, renderOrder = 0) {
        const out = [];
        for (const [k, s] of this.m){
            if (!s.idx.length) continue;
            const mesh = new THREE.Mesh(s.geometry(), mat);
            mesh.name = `${name}:${k}`;
            mesh.renderOrder = renderOrder;
            mesh.matrixAutoUpdate = false;
            out.push(mesh);
        }
        return out;
    }
}
export function normals(line) {
    const n = [];
    for(let i = 0; i < line.length; i++){
        let nx = 0, nz = 0;
        const acc = (a, b)=>{
            const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
            nx += -dz / L;
            nz += dx / L;
        };
        if (i > 0) acc(line[i - 1], line[i]);
        if (i < line.length - 1) acc(line[i], line[i + 1]);
        let L = Math.hypot(nx, nz) || 1;
        nx /= L;
        nz /= L;
        if (i > 0 && i < line.length - 1) {
            const a = line[i], b = line[i + 1];
            const dx = b[0] - a[0], dz = b[1] - a[1];
            L = Math.hypot(dx, dz) || 1;
            const cos = nx * (-dz / L) + nz * (dx / L);
            const s = Math.min(2.2, 1 / Math.max(0.45, cos));
            nx *= s;
            nz *= s;
        }
        n.push([
            nx,
            nz
        ]);
    }
    return n;
}
export function offsetLine(line, d) {
    const n = normals(line);
    return line.map((p, i)=>[
            p[0] + n[i][0] * d,
            p[1] + n[i][1] * d
        ]);
}
export function lineLength(line) {
    let L = 0;
    for(let i = 1; i < line.length; i++)L += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    return L;
}
export function slice(line, a, b, ys) {
    const pts = [], y = [];
    let s = 0;
    for(let i = 0; i < line.length - 1; i++){
        const p = line[i], q = line[i + 1];
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const s0 = s, s1 = s + L;
        const yp = ys ? ys[i] : 0, yq = ys ? ys[i + 1] : 0;
        if (s1 >= a && s0 <= b && L > 1e-6) {
            const t0 = Math.max(0, (a - s0) / L), t1 = Math.min(1, (b - s0) / L);
            if (!pts.length) {
                pts.push([
                    p[0] + (q[0] - p[0]) * t0,
                    p[1] + (q[1] - p[1]) * t0
                ]);
                y.push(yp + (yq - yp) * t0);
            }
            pts.push([
                p[0] + (q[0] - p[0]) * t1,
                p[1] + (q[1] - p[1]) * t1
            ]);
            y.push(yp + (yq - yp) * t1);
        }
        s = s1;
    }
    return {
        pts,
        y
    };
}
export function dashes(L, on, off, phase = 0) {
    const out = [];
    for(let s = phase; s < L; s += on + off)out.push([
        Math.max(0, s),
        Math.min(L, s + on)
    ]);
    return out.filter(([a, b])=>b - a > 0.2);
}
export function ringArea(r) {
    let a = 0;
    for(let i = 0; i < r.length; i++){
        const p = r[i], q = r[(i + 1) % r.length];
        a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
}
export function convexHull(pts) {
    const p = pts.slice().sort((a, b)=>a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cross = (o, a, b)=>(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p){
        while(lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0)lo.pop();
        lo.push(q);
    }
    for(let i = p.length - 1; i >= 0; i--){
        const q = p[i];
        while(hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0)hi.pop();
        hi.push(q);
    }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
}
export function hash(n) {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
}
export class SegIndex {
    cell;
    cells = new Map();
    segs = [];
    constructor(cell = 40){
        this.cell = cell;
    }
    add(a, b, half) {
        const i = this.segs.length / 5;
        this.segs.push(a[0], a[1], b[0], b[1], half);
        const minX = Math.floor((Math.min(a[0], b[0]) - half) / this.cell), maxX = Math.floor((Math.max(a[0], b[0]) + half) / this.cell);
        const minZ = Math.floor((Math.min(a[1], b[1]) - half) / this.cell), maxZ = Math.floor((Math.max(a[1], b[1]) + half) / this.cell);
        for(let x = minX; x <= maxX; x++)for(let z = minZ; z <= maxZ; z++){
            const k = `${x},${z}`;
            let arr = this.cells.get(k);
            if (!arr) this.cells.set(k, arr = []);
            arr.push(i);
        }
    }
    clearance(x, z, skip) {
        const arr = this.cells.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`);
        if (!arr) return Infinity;
        let best = Infinity;
        for (const i of arr){
            if (skip?.(i)) continue;
            const o = i * 5, ax = this.segs[o], az = this.segs[o + 1], bx = this.segs[o + 2], bz = this.segs[o + 3], h = this.segs[o + 4];
            const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
            best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t) - h);
        }
        return best;
    }
    get size() {
        return this.segs.length / 5;
    }
}
