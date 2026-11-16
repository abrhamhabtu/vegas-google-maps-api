import { theme } from '../landmarks/vendor/core/theme.js';

const THREE = window.THREE;
const SANS = '"Helvetica Neue", Arial, sans-serif';

export function signMaterial(name, aspect, paint, dayTint = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(64, Math.round(canvas.width / aspect));
  paint(canvas.getContext('2d'), canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({
    name, map: texture, transparent: true, alphaTest: 0.07, depthWrite: false, toneMapped: false,
  });
  const unlit = new THREE.Color(dayTint), illuminated = new THREE.Color('#ffffff');
  const sync = () => material.color.copy(unlit).lerp(illuminated, theme.uniforms.uNight.value);
  theme.onChange(sync);
  sync();
  return material;
}

// Size from the ink bounds so short ascenders, wide lettering and gaps retain their proportions.
export function letterRun(ctx, text, x, y, width, height, color, style = `600 ${SANS}`, tracking = 0) {
  const [weight, ...family] = style.split(' ');
  ctx.font = `${weight} 100px ${family.join(' ')}`;
  const bounds = ctx.measureText(text);
  const advances = Array.from(text, c => [c, ctx.measureText(c).width]);
  const advance = advances.reduce((sum, [, w]) => sum + w, 0) + tracking * (advances.length - 1);
  const scale = Math.min(width / advance, height / (bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent));
  ctx.save();
  ctx.translate(x - advance * scale / 2, y + (bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) * scale / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  let offset = 0;
  for (const [glyph, w] of advances) {
    ctx.fillText(glyph, offset, 0);
    offset += w + tracking;
  }
  ctx.restore();
}

export function signMesh(material, width, height, x, y, z, nx, nz) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = material.name;
  mesh.position.set(x, y, z);
  mesh.rotation.y = Math.atan2(nx, nz);
  return mesh;
}

export function paintAria(ctx, w, h) {
  // White script channel letters, drawn at a fixed aspect ratio.
  const scale = Math.min(w / 153, h / 61);
  ctx.translate((w - 144 * scale) / 2, (h - 56 * scale) / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#fff4dc';
  ctx.lineWidth = 4.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M 6 52 C 13 34 22 5 31 5 C 39 5 42 34 54 53 M 12 35 C 24 32 39 31 52 34 M 64 50 L 64 27 M 65 34 C 68 26 77 25 83 30 M 94 29 L 94 50 M 127 30 C 119 24 108 30 108 41 C 108 52 120 54 128 45 M 128 28 L 128 50 C 132 55 138 52 141 48'));
  ctx.beginPath();
  ctx.arc(94, 21, 1.65, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

export function paintPark(ctx, w, h) {
  letterRun(ctx, 'PARK MGM', w / 2, h / 2, w * 0.96, h * 0.82, '#ffe5ad', `500 ${SANS}`, 3.6);
}
