// Physics/road modules use geometry's pure helpers, never its Three.js mesh methods.
// The alias makes the same browser module graph usable for headless driving checks.
globalThis.window = { THREE: {} };
await import('./source-drive.mjs');
