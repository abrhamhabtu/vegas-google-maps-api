// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { mercatorSouth } from '../../georeference.mjs';
import { PLACES, placeXZ } from '../places.js';
const KIND = {
    resort: {
        c: '#d58cff',
        prio: 2,
        icon: 'bed',
        maxDist: 2600
    },
    hotel: {
        c: '#bf8cff',
        prio: 4,
        icon: 'bed',
        maxDist: 1300
    },
    attraction: {
        c: '#ff5fa2',
        prio: 3,
        icon: 'star',
        maxDist: 2200
    },
    entertainment: {
        c: '#ff5fa2',
        prio: 4,
        icon: 'mask',
        maxDist: 1300
    },
    food: {
        c: '#ff9f0a',
        prio: 6,
        icon: 'fork',
        maxDist: 900
    },
    cafe: {
        c: '#ff9f0a',
        prio: 7,
        icon: 'cup',
        maxDist: 750
    },
    bar: {
        c: '#ff9f0a',
        prio: 7,
        icon: 'glass',
        maxDist: 750
    },
    shop: {
        c: '#ffd60a',
        prio: 7,
        icon: 'bag',
        maxDist: 750
    },
    health: {
        c: '#ff453a',
        prio: 7,
        icon: 'cross',
        maxDist: 900
    },
    fuel: {
        c: '#0a84ff',
        prio: 7,
        icon: 'fuel',
        maxDist: 900
    },
    parking: {
        c: '#0a84ff',
        prio: 9,
        icon: 'p',
        maxDist: 500
    },
    school: {
        c: '#a2845e',
        prio: 8,
        icon: 'cap',
        maxDist: 1200
    },
    park: {
        c: '#30d158',
        prio: 5,
        icon: 'leaf',
        maxDist: 1800
    },
    service: {
        c: '#8e8e93',
        prio: 9,
        icon: 'dot',
        maxDist: 600
    }
};
const ICON = {
    bed: '<path d="M2 11V5h1.5v3.2H7V6.2h4.5A2.5 2.5 0 0 1 14 8.7V11h-1.5V9.7h-9V11z" fill="#fff"/>',
    star: '<path d="M8 2.2l1.7 3.6 3.9.4-2.9 2.6.8 3.9L8 10.8l-3.5 1.9.8-3.9-2.9-2.6 3.9-.4z" fill="#fff"/>',
    mask: '<path d="M3 4h10v3.5a5 5 0 0 1-10 0z" fill="#fff"/><circle cx="6" cy="7" r=".9" fill="#ff5fa2"/><circle cx="10" cy="7" r=".9" fill="#ff5fa2"/>',
    fork: '<path d="M5 2v4.5a1.3 1.3 0 0 0 1 1.3V14h1V7.8a1.3 1.3 0 0 0 1-1.3V2H7.2v3.6h-.6V2h-.9v3.6h-.6V2zm6.5 0c-1.2.6-1.8 2.2-1.8 4.3V9h1.1v5h1V2z" fill="#fff"/>',
    cup: '<path d="M3.5 5h7v3.7a3.5 3.5 0 0 1-7 0zm7 .8h1a1.7 1.7 0 0 1 0 3.4h-1.2" stroke="#fff" fill="none" stroke-width="1.3"/>',
    glass: '<path d="M3.5 3h9L8.8 8v4.5h2v1H5.2v-1h2V8z" fill="#fff"/>',
    bag: '<path d="M4 6h8l-.6 7.5H4.6zM6 6V5a2 2 0 0 1 4 0v1" stroke="#fff" fill="none" stroke-width="1.3"/>',
    cross: '<path d="M6.7 3h2.6v3.7H13v2.6H9.3V13H6.7V9.3H3V6.7h3.7z" fill="#fff"/>',
    fuel: '<path d="M4 3h5v10H4zm5 3h1.5l1 1.2V11a.8.8 0 0 0 1.6 0V6l-1.3-1.5" stroke="#fff" fill="none" stroke-width="1.2"/>',
    p: '<text x="8" y="12" font-size="10" text-anchor="middle" fill="#fff" font-weight="800" font-family="-apple-system,system-ui">P</text>',
    cap: '<path d="M1.5 6.5L8 3.5l6.5 3L8 9.5zM4.5 8v3c2 1.5 5 1.5 7 0V8" fill="#fff"/>',
    leaf: '<path d="M3.5 12.5c0-5 3-8.5 9-9 .3 6-3 9.3-8 9zm0 0l5-5" stroke="#fff" fill="#fff" stroke-width=".6"/>',
    dot: '<circle cx="8" cy="8" r="2.4" fill="#fff"/>'
};
const DISTRICTS = [
    {
        text: 'The Strip',
        lat: 36.1135,
        lon: -115.1728,
        min: 2500,
        max: 14000
    },
    {
        text: 'Paradise',
        lat: 36.1175,
        lon: -115.1500,
        min: 1800,
        max: 14000
    },
    {
        text: 'Downtown',
        lat: 36.1690,
        lon: -115.1430,
        min: 1800,
        max: 14000
    },
    {
        text: 'Spring Valley',
        lat: 36.1150,
        lon: -115.2010,
        min: 2500,
        max: 14000
    },
    {
        text: 'Arts District',
        lat: 36.1590,
        lon: -115.1530,
        min: 1500,
        max: 9000
    }
];
export class Labels {
    engine;
    controls;
    items = [];
    root = document.getElementById('labels');
    v = new THREE.Vector3();
    enabled = true;
    constructor(engine, controls, data, heightAt){
        this.engine = engine;
        this.controls = controls;
        for (const p of PLACES){
            if (!p.badge) continue;
            const [x, z] = placeXZ(p);
            const top = heightAt(x, z, 70);
            const el = document.createElement('div');
            el.className = 'lbl resort';
            el.innerHTML = `<div class="badge" style="--bg:${gradient(p.badge.bg)}">${badgeSvg(p.badge)}</div><div class="t">${esc(p.name)}</div>`;
            this.add({
                x,
                y: top + 8,
                z,
                text: p.name,
                kind: 'resort',
                prio: 0,
                maxDist: 9000,
                minDist: top < 30 ? 110 : 60,
                el
            });
        }
        const taken = PLACES.map((p)=>placeXZ(p));
        for (const p of data.pois){
            const k = KIND[p.k];
            if (!k) continue;
            if (p.n.length > 34 || /^las vegas strip$/i.test(p.n)) continue;
            if (taken.some(([x, z])=>Math.hypot(x - p.x, z - p.z) < 90 && (p.k === 'resort' || p.k === 'hotel'))) continue;
            const el = document.createElement('div');
            el.className = 'lbl poi';
            el.style.setProperty('--c', k.c);
            el.innerHTML = `<div class="dot"><svg viewBox="0 0 16 16" width="11" height="11">${ICON[k.icon]}</svg></div><div class="t">${wrap(esc(p.n))}</div>`;
            const big = (p.area ?? 0) > 20000;
            this.add({
                x: p.x,
                y: 2,
                z: p.z,
                text: p.n,
                kind: 'poi',
                prio: k.prio - (big ? 2 : 0),
                maxDist: k.maxDist * (big ? 2 : 1),
                el
            });
        }
        for (const d of DISTRICTS){
            const [x, z] = placeXZ({
                lat: d.lat,
                lon: d.lon
            });
            const el = document.createElement('div');
            el.className = 'lbl area';
            el.innerHTML = `<div class="t">${esc(d.text)}</div>`;
            this.add({
                x,
                y: 0,
                z,
                text: d.text,
                kind: 'area',
                prio: 1,
                maxDist: d.max,
                minDist: d.min,
                el
            });
        }
        engine.afterRender.push(()=>this.update());
    }
    add(i) {
        const it = {
            ...i,
            w: 0,
            h: 0,
            shown: false
        };
        it.el.style.opacity = '0';
        it.el.style.display = 'none';
        this.root.append(it.el);
        this.items.push(it);
    }
    lastKey = '';
    settling = false;
    settleTimer = 0;
    update() {
        const c = this.controls.cur;
        const key = `${c.x.toFixed(1)},${c.z.toFixed(1)},${c.dist.toFixed(1)},${c.yaw.toFixed(3)},${c.pitch.toFixed(3)},${innerWidth}`;
        if (key === this.lastKey && !this.settling) return;
        const moving = key !== this.lastKey;
        this.lastKey = key;
        this.settling = false;
        if (moving) {
            clearTimeout(this.settleTimer);
            this.settleTimer = window.setTimeout(()=>{
                this.settling = true;
                this.update();
            }, 400);
        }
        const cam = this.engine.camera;
        const W = innerWidth, H = innerHeight;
        const camPos = cam.position;
        const cand = [];
        for (const it of this.items){
            const dGround = Math.hypot(it.x - c.x, it.z - c.z);
            const ref = c.dist;
            const slack = it.shown ? 1.12 : 1;
            let ok = this.enabled && ref < it.maxDist * slack && (it.minDist === undefined || ref > it.minDist / slack);
            if (ok && it.kind !== 'area') ok = dGround < Math.max(ref * 2.4, 400);
            if (ok) {
                this.v.set(it.x, it.y, mercatorSouth(it.z)).project(cam);
                if (this.v.z > 1 || this.v.x < -1.15 || this.v.x > 1.15 || this.v.y < -1.15 || this.v.y > 1.15) ok = false;
                else cand.push({
                    it,
                    sx: (this.v.x * 0.5 + 0.5) * W,
                    sy: (-this.v.y * 0.5 + 0.5) * H,
                    d: Math.hypot(it.x - camPos.x, it.y - camPos.y, it.z - camPos.z)
                });
            }
            if (!ok && it.shown) this.hide(it);
        }
        cand.sort((a, b)=>a.it.prio - b.it.prio || a.d - b.d);
        const placed = [];
        let n = 0;
        for (const { it, sx, sy } of cand){
            if (moving && !it.shown) continue;
            if (!it.w) {
                it.el.style.display = 'flex';
                it.w = it.el.offsetWidth || 80;
                it.h = it.el.offsetHeight || 20;
            }
            const box = it.kind === 'poi' ? [
                sx - 9,
                sy - it.h / 2,
                sx - 9 + it.w,
                sy + it.h / 2
            ] : [
                sx - it.w / 2,
                sy - it.h,
                sx + it.w / 2,
                sy
            ];
            const hit = !moving && (n > 140 || placed.some((b)=>box[0] < b[2] + 4 && box[2] > b[0] - 4 && box[1] < b[3] + 2 && box[3] > b[1] - 2));
            if (hit) {
                if (it.shown) this.hide(it);
                continue;
            }
            placed.push(box);
            n++;
            clearTimeout(it.fade);
            it.el.style.display = 'flex';
            it.el.style.transform = `translate(${box[0].toFixed(1)}px, ${box[1].toFixed(1)}px)`;
            if (!it.shown) {
                it.shown = true;
                it.el.style.opacity = '1';
            }
        }
    }
    hide(it) {
        it.shown = false;
        it.el.style.opacity = '0';
        clearTimeout(it.fade);
        it.fade = window.setTimeout(()=>{
            if (!it.shown) it.el.style.display = 'none';
        }, 200);
    }
}
function esc(s) {
    return s.replace(/[&<>"]/g, (c)=>({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
        })[c]);
}
function wrap(s) {
    if (s.length < 16) return s;
    const mid = s.lastIndexOf(' ', Math.ceil(s.length / 2) + 3);
    return mid > 4 ? s.slice(0, mid) + '<br>' + s.slice(mid + 1) : s;
}
function gradient(bg) {
    return `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${bg} 70%, white) 0%, ${bg} 55%, color-mix(in srgb, ${bg} 60%, black) 100%)`;
}
function badgeSvg(b) {
    const fs = b.glyph.length >= 3 ? 13 : b.glyph.length === 2 ? 16 : 22;
    const serif = /^[BCPVW]$/.test(b.glyph) ? "Georgia, 'Times New Roman', serif" : '-apple-system, system-ui, sans-serif';
    return `<svg viewBox="0 0 46 46"><path d="M0 46V36h5v-6h4v8h4V26h5v12h3v-16h5v16h4v-9h4v9h4v-5h8v13z" fill="rgba(0,0,0,.22)"/>` + `<text x="23" y="${23 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${b.fg}" font-family="${serif}" letter-spacing=".5">${esc(b.glyph)}</text></svg>`;
}
