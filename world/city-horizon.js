import { theme } from '../landmarks/vendor/core/theme.js';

const THREE = window.THREE;

/** Land behind the last raster tile, so extended streets don't float against the sky. */
export function createCityHorizon() {
  const bands = new THREE.Vector2();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uRange: { value: bands },
      uLand: { value: theme.c('sidewalk') },
      uSky: { value: theme.c('skyHorizon') },
      uHaze: { value: 0.00035 },
    },
    vertexShader: `
      varying float vDepth;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec2 uRange;
      uniform vec3 uLand, uSky;
      uniform float uHaze;
      varying float vDepth;
      void main() {
        float blend = smoothstep(uRange.x * 0.9, uRange.x * 1.16, vDepth);
        if (blend < 0.002) discard;
        float haze = 1.0 - exp(-pow(vDepth * uHaze, 2.0));
        float edge = 1.0 - smoothstep(uRange.y * 0.75, uRange.y, vDepth);
        gl_FragColor = vec4(mix(uLand, uSky, haze), blend * edge);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(42000, 42000).rotateX(-Math.PI / 2), material);
  mesh.name = 'Distant ground and haze';
  mesh.position.y = -0.8;
  mesh.frustumCulled = false;
  return {
    mesh,
    update(visible, rasterFar, cityFar, haze, x, z) {
      mesh.visible = visible;
      if (!visible) return;
      bands.set(rasterFar, cityFar);
      material.uniforms.uHaze.value = haze;
      mesh.position.set(x, -0.8, z);
    },
  };
}
