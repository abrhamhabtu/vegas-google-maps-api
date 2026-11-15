import { GLTFExporter } from 'https://unpkg.com/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';
import { MODE } from './hero-kit.js';

const THREE = window.THREE;

function windowPattern(mode, color, glass) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const fill = (c, x, y, w, h) => { ctx.fillStyle = c.getStyle(THREE.SRGBColorSpace); ctx.fillRect(x, y, w, h); };
  fill(color, 0, 0, 128, 128);
  if (mode === MODE.palazzo || mode === MODE.masonry || mode === MODE.stucco) {
    fill(glass.clone().multiplyScalar(0.8), 36, 22, 32, 79);
    fill(glass, 76, 22, 34, 79);
  } else if (mode === MODE.flamingo) {
    fill(color.clone().lerp(glass, 0.72), 7, 5, 121, 123);
  } else {
    fill(color.clone().lerp(glass, 0.43), 7, 9, 121, 119);
    fill(color.clone().lerp(glass, 0.68), 17, 9, 90, 95);
  }
  const pattern = new THREE.CanvasTexture(canvas);
  pattern.colorSpace = THREE.SRGBColorSpace;
  pattern.wrapS = pattern.wrapT = THREE.RepeatWrapping;
  return pattern;
}

function compatibleMaterial(source, textured) {
  const u = source.uniforms;
  if (!source.isShaderMaterial) return { wall: source, roof: source };
  const color = (u.uColor?.value?.isColor ? u.uColor.value : u.uDay?.value)?.clone() ?? new THREE.Color('#aeb6be');
  const map = u.uMap?.value?.image ? u.uMap.value : null;
  const mode = u.uMode?.value;
  const isGlass = [MODE.glass, MODE.curtainWall, MODE.slopedGlass, MODE.goldGlass, MODE.flamingo, MODE.ribbon].includes(mode);
  const pattern = textured && mode !== undefined && mode !== MODE.stone
    ? windowPattern(mode, color, u.uWinDark?.value ?? new THREE.Color('#576773')) : null;
  const wall = new THREE.MeshStandardMaterial({
    color: pattern ? 0xffffff : color, map: map || pattern, vertexColors: source.vertexColors,
    side: source.side, roughness: isGlass ? 0.43 : 0.78, metalness: isGlass ? 0.15 : 0.02,
  });
  wall.name = source.name || 'Exterior finish';
  const roof = u.uRoof?.value && textured
    ? new THREE.MeshStandardMaterial({ color: u.uRoof.value, side: source.side, roughness: 0.85 }) : wall;
  roof.name ||= 'Roof finish';
  return { wall, roof, pattern };
}

function portableGeometry(source, sourceMaterial, materials) {
  const geo = source.clone(), position = geo.getAttribute('position'), normal = geo.getAttribute('normal');
  if (materials.pattern) {
    const uniform = sourceMaterial.uniforms, mode = uniform.uMode.value;
    const columns = { [MODE.curtainWall]: 2.85, [MODE.goldGlass]: 1.77, [MODE.slopedGlass]: 1.74, [MODE.glass]: 2.6 };
    const pitch = columns[mode] ?? Math.max(1, uniform.uBay.value);
    const rise = [MODE.curtainWall, MODE.goldGlass, MODE.slopedGlass].includes(mode) ? uniform.uBay.value : 3.23;
    const uv = geo.getAttribute('uv'), aux = geo.getAttribute('aux');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / pitch, (position.getY(i) - aux.getW(i)) / rise);
  }
  if (materials.roof !== materials.wall && normal && geo.index && !geo.groups.length) {
    const walls = [], roof = [], index = geo.index;
    for (let i = 0; i < index.count; i += 3) {
      const vertices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      (vertices.every(v => normal.getY(v) > 0.69) ? roof : walls).push(...vertices);
    }
    const all = new index.array.constructor(walls.length + roof.length);
    all.set(walls); all.set(roof, walls.length);
    geo.setIndex(new THREE.BufferAttribute(all, 1));
    if (walls.length) geo.addGroup(0, walls.length, 0);
    if (roof.length) geo.addGroup(walls.length, roof.length, 1);
  }
  for (const attr of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(attr)) geo.deleteAttribute(attr);
  return geo;
}

export async function landmarkGLB(source) {
  const root = new THREE.Group();
  root.name = source.name;
  root.userData = { ...source.userData };
  source.updateWorldMatrix(true, true);
  const materials = new Map(), geometries = new Set();
  const getMaterial = (m, textured) => {
    if (!materials.has(m)) materials.set(m, []);
    return materials.get(m)[Number(textured)] ??= compatibleMaterial(m, textured);
  };
  source.traverseVisible(object => {
    if (!object.isMesh || Array.isArray(object.material) || object.material.blending === THREE.AdditiveBlending) return;
    const { material } = object;
    const converted = getMaterial(material, Boolean(object.geometry.getAttribute('aux')));
    const geo = portableGeometry(object.geometry, material, converted);
    geometries.add(geo);
    const finish = geo.groups.some(group => group.materialIndex === 1) && converted.roof !== converted.wall
      ? [converted.wall, converted.roof] : converted.wall;
    let mesh;
    if (object.isInstancedMesh) {
      mesh = new THREE.InstancedMesh(geo, finish, object.count);
      mesh.instanceMatrix.copy(object.instanceMatrix);
      if (object.instanceColor) mesh.instanceColor = object.instanceColor.clone();
      object.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    } else {
      // Bake the whole transform into vertices, including the Veer towers' shear.
      geo.applyMatrix4(object.matrixWorld);
      mesh = new THREE.Mesh(geo, finish);
    }
    mesh.name = object.name || object.parent.name || source.name;
    root.add(mesh);
  });
  try {
    if (!root.children.length) throw new Error('No exportable building meshes.');
    return await new GLTFExporter().parseAsync(root, {
      binary: true, maxTextureSize: 1024, copyright: 'Footprints © OpenStreetMap contributors (ODbL)',
    });
  } finally {
    for (const geo of geometries) geo.dispose();
    for (const [source, conversions] of materials) if (source.isShaderMaterial) {
      for (const { wall, roof, pattern } of conversions.filter(Boolean)) {
        pattern?.dispose();
        wall.dispose();
        if (roof !== wall) roof.dispose();
      }
    }
  }
}
