// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
let seed = 1337;
const r = ()=>{
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
};
function canvas(s = 512) {
    const c = document.createElement('canvas');
    c.width = c.height = s;
    return [
        c,
        c.getContext('2d', {
            willReadFrequently: true
        })
    ];
}
function noise(x, n, a0, a1, light) {
    const v = light ? 255 : 0;
    for(let i = 0; i < n; i++){
        x.fillStyle = `rgba(${v},${v},${v},${a0 + r() * (a1 - a0)})`;
        x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
    }
}
function finish(c, x, tile) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const avg = new THREE.Color(0, 0, 0), px = new THREE.Color();
    for(let i = 0; i < d.length; i += 40){
        px.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace);
        avg.add(px);
    }
    avg.multiplyScalar(1 / Math.ceil(d.length / 40));
    return {
        map: t,
        tile,
        avg
    };
}
function asphalt() {
    const [c, x] = canvas();
    x.fillStyle = '#4a4d52';
    x.fillRect(0, 0, 512, 512);
    for(let i = 0; i < 40; i++){
        const g = x.createRadialGradient(r() * 512, r() * 512, 0, r() * 512, r() * 512, 60 + r() * 120);
        const dark = r() < 0.5;
        g.addColorStop(0, dark ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.04)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 512, 512);
    }
    noise(x, 26000, 0.03, 0.16, false);
    noise(x, 14000, 0.02, 0.1, true);
    x.strokeStyle = 'rgba(20,20,22,.35)';
    x.lineWidth = 1.2;
    for(let i = 0; i < 7; i++){
        let px = r() * 512, py = r() * 512;
        x.beginPath();
        x.moveTo(px, py);
        for(let k = 0; k < 12; k++){
            px += (r() - 0.5) * 40;
            py += (r() - 0.5) * 40;
            x.lineTo(px, py);
        }
        x.stroke();
    }
    return finish(c, x, 8);
}
function pavement() {
    const [c, x] = canvas();
    x.fillStyle = '#b9b7b1';
    x.fillRect(0, 0, 512, 512);
    for(let i = 0; i < 2; i++)for(let j = 0; j < 2; j++){
        const v = (r() - 0.5) * 3;
        x.fillStyle = `rgb(${185 + v},${183 + v},${177 + v})`;
        x.fillRect(i * 256 + 2, j * 256 + 2, 252, 252);
    }
    noise(x, 12000, 0.03, 0.1, false);
    noise(x, 6000, 0.03, 0.1, true);
    x.fillStyle = 'rgba(80,80,80,.55)';
    for(let k = 0; k <= 2; k++){
        x.fillRect(k * 256 - 1.5, 0, 3, 512);
        x.fillRect(0, k * 256 - 1.5, 512, 3);
    }
    return finish(c, x, 4);
}
function grass() {
    const [c, x] = canvas();
    x.fillStyle = '#6f8f4e';
    x.fillRect(0, 0, 512, 512);
    for(let i = 0; i < 30000; i++){
        const g = 110 + r() * 60;
        x.fillStyle = `rgba(${g * 0.55 | 0},${g | 0},${g * 0.4 | 0},${0.15 + r() * 0.3})`;
        x.fillRect(r() * 512, r() * 512, 1, 2 + r() * 3);
    }
    return finish(c, x, 8);
}
function desert() {
    const [c, x] = canvas();
    x.fillStyle = '#c9ab82';
    x.fillRect(0, 0, 512, 512);
    for(let i = 0; i < 60; i++){
        const g = x.createRadialGradient(r() * 512, r() * 512, 0, r() * 512, r() * 512, 40 + r() * 120);
        g.addColorStop(0, r() < 0.5 ? 'rgba(120,90,60,.12)' : 'rgba(240,220,190,.10)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 512, 512);
    }
    noise(x, 30000, 0.04, 0.16, false);
    noise(x, 12000, 0.03, 0.12, true);
    return finish(c, x, 24);
}
const makers = {
    asphalt,
    pavement,
    grass,
    desert
};
const WHICH = {
    road: 'asphalt',
    roadMajor: 'asphalt',
    freeway: 'asphalt',
    service: 'asphalt',
    parking: 'asphalt',
    runway: 'asphalt',
    sand: 'desert',
    ground: 'pavement',
    lot: 'pavement',
    block: 'pavement',
    residential: 'pavement',
    commercial: 'pavement',
    industrial: 'pavement',
    resort: 'pavement',
    airport: 'pavement',
    plaza: 'pavement',
    sidewalk: 'pavement',
    curb: 'pavement',
    park: 'grass',
    golf: 'grass',
    pitch: 'grass',
    median: 'pavement'
};
const made = new Map();
export function surfaceFor(key) {
    const name = WHICH[key];
    if (!name) return null;
    let s = made.get(name);
    if (!s) made.set(name, s = makers[name]());
    return s;
}
