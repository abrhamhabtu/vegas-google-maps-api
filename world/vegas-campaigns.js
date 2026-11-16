import { letterRun } from './architectural-signs.js';

const SANS = '800 "Helvetica Neue", Arial, sans-serif';
const DISPLAY = '900 "Arial Black", "Helvetica Neue", sans-serif';
const SERIF = '600 Georgia, serif';
const TAU = 2 * Math.PI;

// Original mock campaigns. Each artwork is composed for both portrait LED panels and the Exosphere.
export const vegasCampaigns = {
  'city-afterglow': { brand: 'AFTERGLOW', lines: ['THE CITY', 'IS THE SHOW'], colors: ['#100a36', '#4922a5', '#eeedff', '#71f2ff'], draw: orbit },
  'ghostbar': { brand: 'GHOSTBAR', lines: ['ABOVE IT', 'ALL'], colors: ['#060f25', '#173d5a', '#e4fcff', '#8af6df'], draw: skyline },
  'pit-lights': { brand: 'VEGAS RACE WEEK', lines: ['LIGHTS', 'OUT'], colors: ['#2a0713', '#a80e30', '#fff1e8', '#ff9b74'], draw: circuit },
  'neon-dive': { brand: 'PALMS POOL', lines: ['MAKE A', 'SPLASH'], colors: ['#056274', '#139a9f', '#fbfff2', '#b8ff5b'], draw: splash },
  'desert-miles': { brand: 'RED ROCK', lines: ['THE SCENIC', 'ROUTE'], colors: ['#30213b', '#9c4739', '#fff1cf', '#ffa75e'], draw: desert },
  'second-set': { brand: 'LIVE JAZZ', lines: ['THE', 'SECOND SET'], colors: ['#241032', '#732d63', '#fff3d8', '#ffa3c4'], draw: vinyl },
  'neon-market': { brand: 'MIDNIGHT MARKET', lines: ['THE NIGHT', 'MENU'], colors: ['#142e1c', '#355531', '#fbffe5', '#daff78'], draw: noodles },
  'late-checkout': { brand: 'LATE CHECKOUT', lines: ['SLOW', 'MORNINGS'], colors: ['#56322c', '#a16846', '#fff1c8', '#ffd995'], draw: sunburst },
};

export const sphereCampaignIds = Object.keys(vegasCampaigns);

function stroke(ctx, width, path) {
  ctx.beginPath();
  path(ctx);
  ctx.lineWidth = width;
  ctx.stroke();
}

function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x - r * 0.1, y - r * 0.1, x, y - r);
  ctx.quadraticCurveTo(x + r * 0.1, y - r * 0.1, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.1, y + r * 0.1, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.1, y + r * 0.1, x - r, y);
  ctx.fill();
}

function orbit(ctx) {
  for (let i = 0; i < 11; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 11);
    ctx.globalAlpha = 0.37 + i * 0.043;
    stroke(ctx, 0.9, c => c.ellipse(0, 0, 46, 17 + i * 0.8, 0, 0, TAU));
    ctx.restore();
  }
  diamond(ctx, 0, 0, 13);
  diamond(ctx, 37, -32, 9);
  diamond(ctx, -43, 22, 6);
}

function skyline(ctx) {
  ctx.globalAlpha = 0.61;
  for (let i = 0; i < 16; i++) {
    const x = i * 5.7 - 45, h = 13 + i * 43 % 32;
    ctx.fillRect(x, 24 - h, 4, h);
  }
  ctx.globalAlpha = 1;
  stroke(ctx, 1.35, c => { c.moveTo(-48, 27); c.lineTo(48, 27); c.moveTo(-3, 23); c.lineTo(-3, -32); });
  stroke(ctx, 1, c => c.ellipse(-3, -26, 5, 1.5, 0, 0, TAU));
  for (const [x, y, r] of [[-38, -30, 6], [29, -37, 5], [16, -27, 2.8]]) diamond(ctx, x, y, r);
}

function circuit(ctx) {
  const lap = c => {
    c.moveTo(-43, 24); c.bezierCurveTo(-37, 37, -18, 36, -17, 27);
    c.lineTo(-19, 13); c.quadraticCurveTo(-18, 3, -7, 11);
    c.lineTo(9, 23); c.quadraticCurveTo(18, 32, 25, 24);
    c.lineTo(45, 0); c.quadraticCurveTo(54, -11, 45, -20);
    c.lineTo(35, -29); c.quadraticCurveTo(29, -35, 20, -28);
    c.lineTo(-35, 9); c.quadraticCurveTo(-49, 18, -43, 24);
  };
  ctx.globalAlpha = 0.32;
  stroke(ctx, 9, lap);
  ctx.globalAlpha = 1;
  stroke(ctx, 2.8, lap);
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 3; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * 3 - 43, y * 3 - 25, 3, 3);
  }
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(23 + i * 6, 36, 1.9, 0, TAU);
    ctx.fill();
  }
}

function splash(ctx) {
  for (let y = -34; y <= 36; y += 10) {
    ctx.globalAlpha = 0.33 + (y + 34) * 0.008;
    stroke(ctx, 1.6, c => {
      c.moveTo(-47, y);
      c.bezierCurveTo(-22, y - 21, -1, y + 17, 24, y - 2);
      c.quadraticCurveTo(37, y - 11, 47, y);
    });
  }
  ctx.globalAlpha = 1;
  for (const [x, y, r] of [[9, -25, 7], [25, -35, 4], [33, -19, 3]]) diamond(ctx, x, y, r);
}

function desert(ctx) {
  ctx.beginPath();
  ctx.arc(15, -10, 26, Math.PI, 0);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const y = i * 7;
    ctx.globalAlpha = 0.43 + i * 0.12;
    stroke(ctx, 1.6, c => {
      c.moveTo(-49, y + 5); c.lineTo(-30, y - 14); c.lineTo(-12, y - 10);
      c.lineTo(-4, y + 4); c.lineTo(18, y + 7); c.lineTo(28, y); c.lineTo(48, y + 4);
    });
  }
}

function vinyl(ctx) {
  for (let r = 22; r < 43; r += 3.3) {
    ctx.globalAlpha = 0.27 + (r - 22) * 0.028;
    stroke(ctx, 1.18, c => c.arc(0, 0, r, 0.42, TAU - 0.85));
  }
  ctx.globalAlpha = 0.89;
  stroke(ctx, 2.1, c => c.arc(0, 0, 17, 0, TAU));
  stroke(ctx, 2.9, c => {
    c.moveTo(44, -43); c.lineTo(42, -16); c.lineTo(18, 7); c.lineTo(11, 5);
  });
  diamond(ctx, 0, 0, 6);
}

function noodles(ctx) {
  stroke(ctx, 2.45, c => {
    c.moveTo(-38, 1); c.bezierCurveTo(-32, 35, 32, 35, 38, 1); c.closePath();
    c.moveTo(-14, 30); c.lineTo(14, 30);
    c.moveTo(18, -1); c.lineTo(36, -41);
    c.moveTo(26, -1); c.lineTo(47, -34);
  });
  for (const x of [-17, -5, 7]) {
    stroke(ctx, 1.7, c => { c.moveTo(x, -7); c.quadraticCurveTo(x - 9, -16, x, -20); c.quadraticCurveTo(x + 10, -26, x, -34); });
  }
}

function sunburst(ctx) {
  ctx.beginPath();
  ctx.arc(0, 4, 26, Math.PI, TAU);
  ctx.fill();
  stroke(ctx, 1, c => { for (let y = 10; y <= 27; y += 4) { c.moveTo(-30 - y * 0.34, y); c.lineTo(30 + y * 0.34, y); } });
  stroke(ctx, 1.5, c => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 + 1) * Math.PI;
      c.moveTo(Math.cos(a) * 32, 4 + Math.sin(a) * 32);
      c.lineTo(Math.cos(a) * 44, 4 + Math.sin(a) * 44);
    }
  });
}

function artwork(ctx, draw, x, y, width, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / 100, width / 100);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  ctx.restore();
}

export function paintVegasCampaign(ctx, w, h, campaign, layout) {
  const { brand, lines, colors: [dark, mid, ink, accent], draw } = campaign;
  const isSphere = layout === 'sphere';
  const bg = ctx.createLinearGradient(0, 0, w * 0.76, h);
  bg.addColorStop(0, dark);
  bg.addColorStop(0.60, mid);
  bg.addColorStop(1, dark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.13;
  for (let i = 0; i < 28; i++) {
    diamond(ctx, w * (i * 43 % 97) / 97, h * (i * 37 % 97) / 97, Math.min(w, h) * (i % 4 + 1) / 190);
  }
  ctx.globalAlpha = 1;

  if (layout === 'slit' || layout === 'ribbons') {
    artwork(ctx, draw, w * 0.101, h * 0.51, Math.min(w * 0.18, h * 0.84), accent);
    letterRun(ctx, lines.join(' '), w * 0.54, h * 0.154, w * 0.66, h * 0.12, accent, SANS, 2);
    letterRun(ctx, brand, w * 0.54, h * 0.82, w * 0.67, h * 0.22, ink, DISPLAY, 2);
    return;
  }
  const horizontal = w / h > 1.33;
  const x = horizontal ? w * 0.36 : w * 0.5;
  const copyWidth = w * (horizontal ? 0.46 : 0.86);
  letterRun(ctx, brand, x, h * (horizontal ? 0.29 : 0.17), copyWidth, h * 0.085, accent, SANS, 4.2);
  const type = draw === vinyl || draw === sunburst || draw === desert ? SERIF : DISPLAY;
  lines.forEach((line, i) => letterRun(ctx, line, x, h * ((horizontal ? 0.46 : 0.34) + 0.15 * i),
    copyWidth, h * 0.128, ink, type));
  artwork(ctx, draw, w * (horizontal ? 0.728 : 0.50), h * (horizontal ? 0.51 : 0.75),
    Math.min(w * (horizontal ? 0.26 : 0.91), h * (horizontal ? 0.54 : 0.36)), accent);
  if (!isSphere) {
    ctx.fillStyle = accent;
    ctx.fillRect(w * 0.13, h * 0.913, w * 0.74, Math.max(1, h * 0.004));
  }
}

// Eight 768 × 384 tiles. Rows are flipped when sampled by the Sphere shader.
export const SPHERE_AD_COLUMNS = 4;
export const SPHERE_AD_ROWS = 2;

export function makeSphereCampaignTexture(THREE) {
  const tileWidth = 768, tileHeight = 384;
  const canvas = document.createElement('canvas');
  canvas.width = SPHERE_AD_COLUMNS * tileWidth;
  canvas.height = SPHERE_AD_ROWS * tileHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  sphereCampaignIds.forEach((id, index) => {
    ctx.save();
    ctx.translate(index % SPHERE_AD_COLUMNS * tileWidth, Math.floor(index / SPHERE_AD_COLUMNS) * tileHeight);
    ctx.beginPath();
    ctx.rect(0, 0, tileWidth, tileHeight);
    ctx.clip();
    paintVegasCampaign(ctx, tileWidth, tileHeight, vegasCampaigns[id], 'sphere');
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}
