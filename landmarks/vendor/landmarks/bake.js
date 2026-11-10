// Local static-baking adapter. Preserve UVs, lights and animated descendants.
const THREE = window.THREE;

function merge(geometries) {
  const output = new THREE.BufferGeometry();
  for (const name of Object.keys(geometries[0].attributes)) {
    const first = geometries[0].getAttribute(name);
    const size = geometries.reduce((sum, g) => sum + g.getAttribute(name).array.length, 0);
    const array = new first.array.constructor(size);
    let offset = 0;
    for (const geometry of geometries) {
      const values = geometry.getAttribute(name).array;
      array.set(values, offset);
      offset += values.length;
    }
    output.setAttribute(name, new THREE.BufferAttribute(array, first.itemSize, first.normalized));
  }
  output.computeBoundingSphere();
  return output;
}

export function bakeStatic(root, keep = () => false) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map();
  const retained = [];
  function visit(object) {
    if (object !== root && (keep(object) || object.isPoints || object.isSprite || object.isInstancedMesh || Array.isArray(object.material))) {
      retained.push(object);
      return; // Keep the highest matching ancestor, including its complete subtree.
    }
    if (object.isMesh) {
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      const signature = Object.entries(geometry.attributes)
        .map(([name, attr]) => `${name}:${attr.itemSize}:${attr.array.constructor.name}:${attr.normalized}`)
        .sort().join(',');
      let materialBatches = batches.get(object.material);
      if (!materialBatches) batches.set(object.material, materialBatches = new Map());
      let batch = materialBatches.get(signature);
      if (!batch) materialBatches.set(signature, batch = []);
      batch.push(geometry);
    }
    for (const child of object.children) visit(child);
  }
  visit(root);
  const out = new THREE.Group();
  out.name = root.name;
  out.position.copy(root.position);
  out.quaternion.copy(root.quaternion);
  out.scale.copy(root.scale);
  for (const [material, groups] of batches) {
    for (const geometries of groups.values()) {
      out.add(new THREE.Mesh(merge(geometries), material));
      for (const geometry of geometries) geometry.dispose();
    }
  }
  for (const object of retained) {
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
    object.removeFromParent();
    matrix.decompose(object.position, object.quaternion, object.scale);
    out.add(object);
  }
  return out;
}
