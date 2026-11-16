import { theme } from '../landmarks/vendor/core/theme.js';
import { letterRun } from './architectural-signs.js';
import { paintVegasCampaign, vegasCampaigns } from './vegas-campaigns.js';

const THREE = window.THREE;
const SANS = '800 "Helvetica Neue", Arial, sans-serif';
const SERIF = '500 Georgia, serif';

const campaigns = {
  waymo: { brand: 'Waymo', lines: ["The world’s most", 'experienced driver'], colors: ['#d6e9ff', '#97b5ff', '#132a52'], icon: 'waymo' },
  zoox: { brand: 'ZOOX', lines: ['All squad.'], colors: ['#c6e0e6', '#8cbfd1', '#25434f'], icon: 'zoox' },
  shows: { brand: 'VEGAS AFTER DARK', lines: ['THE SHOW', 'STARTS HERE'], colors: ['#103cb6', '#3f0b75', '#fff4e5'], icon: 'rays' },
  zouk: { brand: 'ZOUK NIGHTCLUB', lines: ['AFTER', 'MIDNIGHT'], colors: ['#401048', '#0e152c', '#ecd9ff'], icon: 'rays' },
  fashion: { brand: 'FASHION SHOW', lines: ['Fueled by', 'Fashion'], colors: ['#311c52', '#931e54', '#fff4ea'], icon: 'fashion' },
  delilah: { brand: 'Delilah', lines: ['LATE NIGHT', 'SECRET'], colors: ['#36413c', '#202520', '#ffead6'], icon: 'rays' },
  wynn: { brand: 'WYNN LAS VEGAS', lines: ['LIVE', 'ON STAGE'], colors: ['#4f2d38', '#251943', '#f7ddae'], icon: 'rays' },
  encore: { brand: 'ENCORE', lines: ['AFTER', 'DARK'], colors: ['#1e2950', '#53263f', '#ffdfb7'], icon: 'rays' },
  caesars: { brand: 'CAESARS PALACE', lines: ['SIPS', 'ON THE STRIP'], colors: ['#20272e', '#6b3037', '#fff2de'], icon: 'rays' },
};

function motif(ctx, icon, x, y, w, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 100, w / 100);
  ctx.fillStyle = color;
  if (icon === 'waymo' || icon === 'zoox') {
    ctx.beginPath();
    if (icon === 'zoox') {
      ctx.roundRect(-46, -24, 92, 53, 17);
    } else {
      ctx.moveTo(-47, 16); ctx.quadraticCurveTo(-51, 1, -38, -4); ctx.lineTo(-25, -21);
      ctx.quadraticCurveTo(-20, -27, 12, -25); ctx.quadraticCurveTo(32, -25, 40, -9);
      ctx.quadraticCurveTo(52, -5, 48, 20); ctx.lineTo(-47, 20); ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = icon === 'zoox' ? '#89d5d0' : '#e5f4ff';
    ctx.beginPath(); ctx.roundRect(icon === 'zoox' ? -39 : -27, -18, icon === 'zoox' ? 78 : 58, 16, 6); ctx.fill();
    ctx.fillStyle = color;
    for (const p of [-28, 29]) { ctx.beginPath(); ctx.arc(p, 24, 9, 0, Math.PI * 2); ctx.fill(); }
    if (icon === 'waymo') { ctx.beginPath(); ctx.roundRect(-18, -33, 36, 4.6, 2); ctx.fill(); }
  } else if (icon === 'fashion') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(-44, -7); ctx.quadraticCurveTo(-4, -15, 44, -5); ctx.stroke();
    for (const x of [-24, 24]) { ctx.beginPath(); ctx.roundRect(x - 21, -6, 42, 25, [4, 6, 15, 15]); ctx.stroke(); }
  } else {
    ctx.globalAlpha = 0.22;
    for (let i = -4; i <= 4; i++) {
      ctx.rotate(0.23);
      ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(-5, -60); ctx.lineTo(6, -63); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.arc(1, 3, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function paintFrame(ctx, width, height, id, layout) {
  if (Object.hasOwn(vegasCampaigns, id)) {
    paintVegasCampaign(ctx, width, height, vegasCampaigns[id], layout);
    return;
  }
  const { brand, lines, colors: [a, b, ink], icon } = campaigns[id];
  const bg = ctx.createLinearGradient(0, 0, width * 0.86, height);
  bg.addColorStop(0, a);
  bg.addColorStop(1, b);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  if (layout === 'slit' || layout === 'ribbons') {
    // The copy stays above and below the architectural opening as the art wraps the corner.
    const x = width * (layout === 'slit' ? 0.465 : 0.58);
    const right = width * (layout === 'slit' ? 0.49 : 0.73);
    letterRun(ctx, lines.join(' '), x, height * 0.155, right, height * 0.108, ink, SANS);
    letterRun(ctx, brand, x, height * 0.83, right, height * 0.21, ink, SANS, 3.2);
    motif(ctx, icon, width * 0.105, height * 0.57, Math.min(width * 0.19, height * 0.66), ink);
  } else {
    const portrait = width < height;
    const type = icon === 'fashion' || id === 'delilah' ? SERIF : SANS;
    const iconW = Math.min(width, height) * (portrait ? 0.68 : 0.56);
    letterRun(ctx, brand, width * 0.5, height * 0.155, width * 0.82,
      height * (portrait ? 0.10 : 0.13), ink, SANS, 2.3);
    lines.forEach((line, i) => letterRun(ctx, line, width * 0.5, height * (0.36 + i * 0.155),
      width * 0.85, height * 0.136, ink, type));
    motif(ctx, icon, width * 0.5, height * (portrait ? 0.75 : 0.80), iconW, ink);
  }
  ctx.fillStyle = '#0d152815';
  for (let y = 2; y < height; y += 5) ctx.fillRect(0, y, width, 1);
}

/** One texture per display, repainted only when its ad changes while it is visible. */
export function displayMaterial(group, engine, name, aspect, playlist, { duration = 8.5, layout = '', repeats = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(Math.min(1024, 1024 * aspect));
  canvas.height = Math.round(Math.min(1024, 1024 / aspect));
  const ctx = canvas.getContext('2d', { alpha: false });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = repeats > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.repeat.x = repeats;
  const mat = new THREE.MeshBasicMaterial({ name, map: texture, toneMapped: false, side: THREE.DoubleSide });
  const day = new THREE.Color('#c5c9cc'), night = new THREE.Color('#ffffff');
  const sync = () => mat.color.copy(day).lerp(night, theme.uniforms.uNight.value);
  theme.onChange(sync);
  sync();

  let active = -1;
  const set = index => {
    if (active === index) return;
    active = index;
    paintFrame(ctx, canvas.width, canvas.height, playlist[index], layout);
    texture.needsUpdate = true;
  };
  set(0);
  if (playlist.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    engine?.animate(group, ({ t }) => set(Math.floor(t / duration) % playlist.length));
  }
  return mat;
}

/** Ordered perimeter samples keep the same U along straight runs and around corners. */
export function displayRibbon(group, mat, path, bottom, top, { u0 = 0, u1 = 1, v0 = 0, v1 = 1 } = {}) {
  const length = [0], position = [], uv = [], index = [];
  for (let i = 1; i < path.length; i++) {
    length.push(length[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }
  for (const [i, [x, z]] of path.entries()) {
    const u = THREE.MathUtils.lerp(u0, u1, length[i] / length.at(-1));
    position.push(x, bottom, z, x, top, z);
    uv.push(u, v0, u, v1);
    if (i) index.push(2 * i - 2, 2 * i, 2 * i + 1, 2 * i - 2, 2 * i + 1, 2 * i - 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = mat.name;
  group.add(mesh);
  return mesh;
}
