// Index the finished render triangles so planting follows the same islands and
// sidewalks as the camera, including after parking aisles and turns are cut out.
export function surfaceMask(layer) {
  const cells = new Map();
  const size = 12;
  const key = (x, z) => `${x},${z}`;
  for (const { pos, idx } of layer.m.values()) {
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ax = pos[a], az = pos[a + 2], bx = pos[b], bz = pos[b + 2], cx = pos[c], cz = pos[c + 2];
      const ux = bx - ax, uz = bz - az, vx = cx - ax, vz = cz - az;
      const det = ux * vz - uz * vx;
      if (Math.abs(det) < 1e-6) continue;
      const triangle = [ax, az, ux, uz, vx, vz, 1 / det];
      for (let x = Math.floor(Math.min(ax, bx, cx) / size); x <= Math.floor(Math.max(ax, bx, cx) / size); x++) {
        for (let z = Math.floor(Math.min(az, bz, cz) / size); z <= Math.floor(Math.max(az, bz, cz) / size); z++) {
          const cell = key(x, z);
          if (!cells.has(cell)) cells.set(cell, []);
          cells.get(cell).push(triangle);
        }
      }
    }
  }
  return (x, z) => {
    for (const [ax, az, ux, uz, vx, vz, invDet] of cells.get(key(Math.floor(x / size), Math.floor(z / size))) ?? []) {
      const dx = x - ax, dz = z - az;
      const u = (dx * vz - dz * vx) * invDet, v = (ux * dz - uz * dx) * invDet;
      if (u >= -1e-5 && v >= -1e-5 && u + v <= 1 + 1e-5) return true;
    }
    return false;
  };
}

export function supportsTree(surface, x, z, radius) {
  return surface(x, z) && surface(x - radius, z) && surface(x + radius, z) &&
    surface(x, z - radius) && surface(x, z + radius);
}
