// The source snapshot uses east/up/south metres at this WGS84 origin.
export const ORIGIN = Object.freeze({ lat: 36.11624, lon: -115.17455 });
const R = 6378137;
const D = Math.PI / 180;
const COS = Math.cos(ORIGIN.lat * D);
const TAN = Math.tan(ORIGIN.lat * D);
const A = -TAN / (2 * R);
const B = (1 + 2 * TAN * TAN) / (6 * R * R);

export function toLocal(lat, lng) {
  return [(lng - ORIGIN.lon) * D * R * COS, -(lat - ORIGIN.lat) * D * R];
}

export function toLngLat(x, z) {
  return [ORIGIN.lon + x / (D * R * COS), ORIGIN.lat - z / (D * R)];
}

// Third-order Mercator expansion avoids catastrophic cancellation in float GLSL.
// Error is below 1mm over +/-10km. X already matches Mercator exactly at this scale.
export function mercatorSouth(z) {
  return z + A * z * z + B * z * z * z;
}

export const projectionGLSL = `
vec4 vegasProject(vec4 world) {
  float z = world.z;
  world.z = z + ${A.toPrecision(16)} * z * z + ${B.toPrecision(16)} * z * z * z;
  return world;
}
`;

// Preserve model dimensions, animation frames, UVs and shader world coordinates;
// correct only the position sent to the map camera. Also covers instanced jets.
export function adaptVertexShader(shader, projectChunk = '') {
  let result = shader.replace('#include <project_vertex>', projectChunk || `
    vec4 mvPosition = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      mvPosition = instanceMatrix * mvPosition;
    #endif
    mvPosition = viewMatrix * vegasProject(modelMatrix * mvPosition);
    gl_Position = projectionMatrix * mvPosition;
  `);
  result = result
    .replace(/viewMatrix\s*\*\s*modelMatrix\s*\*\s*instanceMatrix\s*\*\s*(vec4\([^;]+?\))/g,
      'viewMatrix * vegasProject(modelMatrix * instanceMatrix * $1)')
    .replace(/modelViewMatrix\s*\*\s*(vec4\([^;]+?\))/g,
      'viewMatrix * vegasProject(modelMatrix * $1)')
    .replace(/viewMatrix\s*\*\s*wp\b/g, 'viewMatrix * vegasProject(wp)')
    .replace(/viewMatrix\s*\*\s*(vec4\([^;]+?\))/g, 'viewMatrix * vegasProject($1)')
    .replace(/mvPosition\s*=\s*modelViewMatrix\s*\*\s*mvPosition;/g,
      'mvPosition = viewMatrix * vegasProject(modelMatrix * mvPosition);');
  return projectionGLSL + result;
}
