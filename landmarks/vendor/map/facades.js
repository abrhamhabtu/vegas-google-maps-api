// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
const SIZE = 512;
export const FLOOR_H = 3.6;
export const STORE_H = 4.6;
export const TILE_U = [
    12,
    12.8,
    12,
    13.6,
    14.4,
    16,
    12.8,
    16
];
export const TILE_V = FLOOR_H * 4;
export var Layer = /*#__PURE__*/ function(Layer) {
    Layer[Layer["Glass"] = 0] = "Glass";
    Layer[Layer["Brick"] = 1] = "Brick";
    Layer[Layer["Office"] = 2] = "Office";
    Layer[Layer["Modern"] = 3] = "Modern";
    Layer[Layer["Residential"] = 4] = "Residential";
    Layer[Layer["Store"] = 5] = "Store";
    Layer[Layer["Masonry"] = 6] = "Masonry";
    Layer[Layer["Curtain"] = 7] = "Curtain";
    return Layer;
}({});
export const CURTAIN_V = 16;
let seed = 7331;
const r = ()=>{
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
};
function noise(x, n, a0, a1, light) {
    const v = light ? 255 : 0;
    for(let i = 0; i < n; i++){
        x.fillStyle = `rgba(${v},${v},${v},${a0 + r() * (a1 - a0)})`;
        x.fillRect(r() * SIZE, r() * SIZE, 1 + r() * 2, 1 + r() * 2);
    }
}
const BAYS = 4, BW = SIZE / BAYS, FH = SIZE / BAYS;
const glass = (c, lit)=>{
    const g = c.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, '#4f7fb8');
    g.addColorStop(1, '#2f5a8e');
    c.fillStyle = g;
    c.fillRect(0, 0, SIZE, SIZE);
    for(let i = 0; i < BAYS; i++)for(let j = 0; j < BAYS; j++){
        const v = (r() - 0.5) * 26;
        c.fillStyle = `rgba(${120 + v},${170 + v},${220 + v},${0.18 + r() * 0.2})`;
        c.fillRect(i * BW + 3, j * FH + 10, BW - 6, FH - 16);
        const sky = c.createLinearGradient(0, j * FH, 0, j * FH + FH);
        sky.addColorStop(0, 'rgba(255,255,255,.18)');
        sky.addColorStop(0.5, 'rgba(255,255,255,0)');
        c.fillStyle = sky;
        c.fillRect(i * BW + 3, j * FH + 10, BW - 6, FH - 16);
        lit(i * BW + 3, j * FH + 10, BW - 6, FH - 16);
    }
    c.fillStyle = '#c9d4de';
    for(let i = 0; i <= BAYS; i++)c.fillRect(i * BW - 2, 0, 4, SIZE);
    c.fillStyle = '#26466b';
    for(let j = 0; j <= BAYS; j++)c.fillRect(0, j * FH - 5, SIZE, 12);
};
const brick = (c, lit)=>{
    c.fillStyle = '#8e4a36';
    c.fillRect(0, 0, SIZE, SIZE);
    for(let y = 0; y < SIZE; y += 8)for(let x = y / 8 % 2 * 9; x < SIZE; x += 18){
        const v = (r() - 0.5) * 34;
        c.fillStyle = `rgb(${142 + v},${74 + v * 0.6},${54 + v * 0.5})`;
        c.fillRect(x, y, 16, 6);
    }
    for(let i = 0; i < BAYS; i++)for(let j = 0; j < BAYS; j++){
        const x0 = i * BW + BW * 0.22, y0 = j * FH + FH * 0.2, w = BW * 0.56, h = FH * 0.58;
        c.fillStyle = '#e8e2d6';
        c.fillRect(x0 - 5, y0 - 5, w + 10, h + 12);
        c.fillStyle = '#1f2a33';
        c.fillRect(x0, y0, w, h);
        c.fillStyle = 'rgba(160,190,215,.25)';
        c.fillRect(x0, y0, w, h * 0.45);
        c.fillStyle = '#e8e2d6';
        c.fillRect(x0 + w / 2 - 2, y0, 4, h);
        c.fillRect(x0, y0 + h * 0.48, w, 4);
        c.fillStyle = '#cfc6b6';
        c.fillRect(x0 - 8, y0 + h + 6, w + 16, 6);
        lit(x0, y0, w, h);
    }
};
const office = (c, lit)=>{
    c.fillStyle = '#d8d3c8';
    c.fillRect(0, 0, SIZE, SIZE);
    noise(c, 5000, 0.03, 0.08, false);
    for(let j = 0; j < BAYS; j++){
        const y0 = j * FH + FH * 0.3, h = FH * 0.5;
        c.fillStyle = '#2b3a48';
        c.fillRect(0, y0, SIZE, h);
        const g = c.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, 'rgba(180,210,235,.35)');
        g.addColorStop(1, 'rgba(180,210,235,0)');
        c.fillStyle = g;
        c.fillRect(0, y0, SIZE, h);
        c.fillStyle = '#9aa3aa';
        for(let i = 0; i <= BAYS * 2; i++)c.fillRect(i * BW / 2 - 1.5, y0, 3, h);
        c.fillStyle = 'rgba(0,0,0,.18)';
        c.fillRect(0, y0 + h, SIZE, 4);
        for(let i = 0; i < BAYS * 2; i++)lit(i * BW / 2 + 2, y0, BW / 2 - 4, h);
    }
};
const modern = (c, lit)=>{
    c.fillStyle = '#34373c';
    c.fillRect(0, 0, SIZE, SIZE);
    noise(c, 4000, 0.03, 0.08, true);
    c.fillStyle = 'rgba(0,0,0,.25)';
    for(let i = 0; i <= BAYS; i++)c.fillRect(i * BW - 1, 0, 2, SIZE);
    for(let i = 0; i < BAYS; i++)for(let j = 0; j < BAYS; j++){
        const x0 = i * BW + BW * 0.2, y0 = j * FH + FH * 0.16, w = BW * 0.6, h = FH * 0.64;
        c.fillStyle = '#f2f2f0';
        c.fillRect(x0 - 6, y0 - 6, w + 12, h + 12);
        c.fillStyle = '#17202a';
        c.fillRect(x0, y0, w, h);
        c.fillStyle = 'rgba(170,200,230,.22)';
        c.fillRect(x0, y0, w * 0.5, h);
        c.fillStyle = '#f2f2f0';
        c.fillRect(x0 + w / 2 - 2.5, y0, 5, h);
        lit(x0, y0, w, h);
    }
};
const residential = (c, lit)=>{
    c.fillStyle = '#e3d6bf';
    c.fillRect(0, 0, SIZE, SIZE);
    noise(c, 6000, 0.02, 0.07, false);
    for(let i = 0; i < BAYS; i++)for(let j = 0; j < BAYS; j++){
        const x0 = i * BW + BW * 0.18, y0 = j * FH + FH * 0.14, w = BW * 0.64, h = FH * 0.62;
        c.fillStyle = '#243240';
        c.fillRect(x0, y0, w, h);
        c.fillStyle = 'rgba(190,215,235,.2)';
        c.fillRect(x0, y0, w, h * 0.5);
        c.fillStyle = '#fafafa';
        c.fillRect(x0 + w / 2 - 2, y0, 4, h);
        if ((i + j) % 2 === 0) {
            c.fillStyle = '#8b8f94';
            c.fillRect(x0 - 8, y0 + h - 4, w + 16, 12);
            c.fillStyle = 'rgba(40,40,40,.6)';
            for(let k = 0; k < 9; k++)c.fillRect(x0 - 6 + k * (w + 12) / 8, y0 + h * 0.72, 2, h * 0.28);
            c.fillRect(x0 - 8, y0 + h * 0.7, w + 16, 3);
        }
        lit(x0, y0, w, h);
    }
};
const masonry = (c, lit)=>{
    c.fillStyle = '#e6dfd0';
    c.fillRect(0, 0, SIZE, SIZE);
    noise(c, 6000, 0.02, 0.06, false);
    for(let i = 0; i < BAYS * 2; i++)for(let j = 0; j < BAYS; j++){
        const bw = BW / 2, x0 = i * bw + bw * 0.24, y0 = j * FH + FH * 0.18, w = bw * 0.52, h = FH * 0.6;
        c.fillStyle = '#3f545c';
        c.fillRect(x0, y0, w, h);
        c.fillStyle = '#f7f1e4';
        c.fillRect(x0 - 3, y0 + h, w + 6, 5);
        lit(x0, y0, w, h);
    }
};
const curtain = (c, lit)=>{
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, SIZE, SIZE);
    for(let row = 0; row < 4; row++)for(let col = 0; col < 8; col++){
        const k = (row * 13 + col * 7) % 11;
        c.fillStyle = k < 5 ? 'rgba(180,220,237,.22)' : 'rgba(0,12,22,.2)';
        c.fillRect(col * 64 + 2, row * 128 + 2, 61, 122);
        c.fillStyle = 'rgba(8,20,29,.6)';
        c.fillRect(col * 64, row * 128, 2, 128);
        c.fillStyle = 'rgba(213,222,214,.7)';
        c.fillRect(col * 64, row * 128 + 123, 64, 3);
        lit(col * 64 + 3, row * 128 + 25, 58, 72);
    }
};
function storefront(c, e) {
    const sy = SIZE / 160;
    for (const x of [
        c,
        e
    ])x.setTransform(1, 0, 0, sy, 0, 0);
    c.fillStyle = '#2d2f33';
    c.fillRect(0, 0, SIZE, 160);
    const awn = [
        '#b91c1c',
        '#0f766e',
        '#1d4ed8',
        '#a16207',
        '#374151',
        '#be185d'
    ];
    for(let i = 0; i < 4; i++){
        const x0 = i * BW;
        c.fillStyle = '#d9d6cf';
        c.fillRect(x0, 0, BW, 30);
        c.fillStyle = awn[Math.floor(r() * awn.length)];
        c.fillRect(x0 + 6, 30, BW - 12, 16);
        c.fillStyle = 'rgba(255,255,255,.35)';
        for(let k = 0; k < 8; k++)c.fillRect(x0 + 6 + k * (BW - 12) / 8, 30, (BW - 12) / 16, 16);
        const g = c.createLinearGradient(0, 48, 0, 160);
        g.addColorStop(0, '#3b5268');
        g.addColorStop(1, '#1b2530');
        c.fillStyle = g;
        c.fillRect(x0 + 8, 50, BW - 16, 104);
        c.fillStyle = 'rgba(255,230,190,.18)';
        c.fillRect(x0 + 8, 90, BW - 16, 64);
        c.fillStyle = '#9aa0a6';
        c.fillRect(x0 + BW / 2 - 2, 50, 4, 104);
        e.fillStyle = `rgba(255,${200 + Math.floor(r() * 40)},150,${0.5 + r() * 0.4})`;
        e.fillRect(x0 + 8, 50, BW - 16, 104);
        e.fillStyle = 'rgba(255,255,255,.2)';
        e.fillRect(x0 + 6, 30, BW - 12, 16);
    }
}
function arrayTexture(data, layers) {
    const t = new THREE.DataArrayTexture(data, SIZE, SIZE, layers);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
}
let made = null;
export function facadeTextures() {
    if (made) return made;
    const painters = [
        glass,
        brick,
        office,
        modern,
        residential
    ];
    const layers = painters.length + 3;
    const colorData = new Uint8Array(SIZE * SIZE * 4 * layers), nightData = new Uint8Array(SIZE * SIZE * 4 * layers);
    const make = ()=>{
        const cv = document.createElement('canvas');
        cv.width = cv.height = SIZE;
        return cv.getContext('2d', {
            willReadFrequently: true
        });
    };
    for(let i = 0; i < layers; i++){
        const c = make(), e = make();
        e.fillStyle = '#000';
        e.fillRect(0, 0, SIZE, SIZE);
        const lit = (x, y, w, h)=>{
            if (r() >= 0.62) return;
            const k = 0.55 + r() * 0.45;
            e.fillStyle = r() < 0.75 ? `rgba(255,${190 + Math.floor(r() * 40)},${120 + Math.floor(r() * 40)},${k})` : `rgba(190,220,255,${k})`;
            e.fillRect(x, y, w, h);
        };
        if (i < painters.length) painters[i](c, lit);
        else if (i === 5) storefront(c, e);
        else if (i === 6) masonry(c, lit);
        else curtain(c, lit);
        colorData.set(c.getImageData(0, 0, SIZE, SIZE).data, i * SIZE * SIZE * 4);
        nightData.set(e.getImageData(0, 0, SIZE, SIZE).data, i * SIZE * SIZE * 4);
    }
    made = {
        color: arrayTexture(colorData, layers),
        night: arrayTexture(nightData, layers)
    };
    return made;
}
