// Adapted from abrhamhabtu/vegas-strip-v2; see landmarks/PROVENANCE.md.
const THREE = window.THREE;
import { sheen } from '../landmarks/sheen.js';
import { buildCar, buildRobotaxi, buildTaxi, buildWaymo, buildZoox, compactCar } from './models.js';
const PAINTS = [
    '#e9e9e6',
    '#17181b',
    '#8d9299',
    '#5b6068',
    '#8c1f24',
    '#1f3f73',
    '#c9c4b6',
    '#2d4a3e'
];
export const CAR_NAMES = {
    zoox: 'Zoox',
    waymo: 'Waymo',
    tesla: 'Tesla'
};
export const CAR_DOT = {
    zoox: '#7fd8c0',
    waymo: '#27b6d6',
    tesla: '#c9ced6'
};
const translated = new Map();
function dressed(m) {
    let out = translated.get(m);
    if (out) return out;
    const s = m;
    if (s.map || s.transparent || !s.color) {
        translated.set(m, m);
        return m;
    }
    const glows = !!s.emissive && (s.emissiveIntensity ?? 0) > 0.3 && s.emissive.getHex() !== 0;
    const metal = s.metalness ?? 0, coat = s.clearcoat ?? 0, rough = s.roughness ?? 0.5;
    const col = new THREE.Color(s.color), lum = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
    if (lum < 0.02) col.lerp(new THREE.Color('#3a3d42'), 0.75);
    out = sheen(col, {
        refl: Math.min(0.6, metal * 0.35 + coat * 0.25 + (1 - rough) * 0.12),
        spec: 0.4 + coat * 1.1,
        ...glows ? {
            glow: s.emissive,
            glowK: 1.3,
            baseGlow: 0.55 * s.emissiveIntensity
        } : {
            glow: col,
            glowK: 0.2,
            baseGlow: 0
        }
    });
    out.side = THREE.DoubleSide;
    translated.set(m, out);
    return out;
}
const shadowTex = (()=>{
    let t = null;
    return ()=>{
        if (t) return t;
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 6, 32, 32, 32);
        g.addColorStop(0, 'rgba(0,0,0,0.6)');
        g.addColorStop(0.72, 'rgba(0,0,0,0.42)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 64, 64);
        t = new THREE.CanvasTexture(c);
        return t;
    };
})();
let beamMat = null;
export const beamMaterial = ()=>{
    if (beamMat) return beamMat;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(255,240,205,0.85)');
    g.addColorStop(1, 'rgba(255,240,205,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(24, 128);
    x.lineTo(40, 128);
    x.lineTo(64, 0);
    x.lineTo(0, 0);
    x.fill();
    beamMat = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });
    return beamMat;
};
export function buildVehicle(kind, tint = 0) {
    const paint = PAINTS[tint % PAINTS.length];
    const car = kind === 'zoox' ? buildZoox() : kind === 'waymo' ? buildWaymo() : kind === 'tesla' ? compactCar(buildRobotaxi()) : kind === 'taxi' ? compactCar(buildTaxi()) : compactCar(buildCar(kind, kind === 'van' ? '#e6e6e2' : paint));
    car.traverse((o)=>{
        const m = o;
        if (!m.isMesh) return;
        m.material = Array.isArray(m.material) ? m.material.map(dressed) : dressed(m.material);
        m.castShadow = m.receiveShadow = false;
    });
    const box = new THREE.Box3().setFromObject(car), wheels = car.userData.wheels;
    const xs = wheels.map((w)=>w.position.x), front = Math.max(...xs), rear = Math.min(...xs);
    const length = box.max.x - box.min.x, wheelbase = front - rear;
    const radius = car.userData.P?.r ?? 0.36;
    const bodyPart = car.userData.body, bodyBox = new THREE.Box3().setFromObject(bodyPart);
    if (bodyBox.min.y < 0.1) bodyPart.position.y += 0.1 - bodyBox.min.y;
    car.position.x = -rear;
    const root = new THREE.Group();
    root.add(car);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
        map: shadowTex(),
        transparent: true,
        depthWrite: false,
        toneMapped: false
    }));
    shadow.scale.set(length * 1.1, 1, (box.max.z - box.min.z) * 1.18);
    shadow.position.set(-rear + (box.max.x + box.min.x) / 2, -0.012, 0);
    shadow.renderOrder = 54;
    root.add(shadow);
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, (box.max.z - box.min.z) * 0.72), new THREE.MeshBasicMaterial({
        color: new THREE.Color(3.2, 0.12, 0.08),
        toneMapped: false
    }));
    brake.position.set(-rear + box.min.x - 0.02, kind === 'waymo' ? 1.5 : 0.95, 0);
    brake.visible = false;
    root.add(brake);
    const beams = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 20).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2), beamMaterial());
    beams.position.set(-rear + box.max.x + 10, 0.08, 0);
    beams.renderOrder = 55;
    root.add(beams);
    let spin = 0, pitch = 0, roll = 0;
    const body = car.userData.body;
    return {
        root,
        brake,
        beams,
        size: {
            length,
            wheelbase,
            width: box.max.z - box.min.z,
            nose: -rear + box.max.x,
            radius
        },
        animate: (dist, steer, accel, side)=>{
            spin -= dist / radius;
            for (const w of wheels){
                const u = w.userData;
                u.spin.rotation.z = spin * (u.side < 0 ? -1 : 1);
                if (u.front) w.rotation.y = steer;
                else if (kind === 'zoox') w.rotation.y = -steer;
            }
            pitch += (THREE.MathUtils.clamp(accel * 0.0075, -0.03, 0.022) - pitch) * 0.12;
            roll += (THREE.MathUtils.clamp(side * 0.0085, -0.032, 0.032) - roll) * 0.12;
            body.rotation.z = pitch;
            body.rotation.x = roll;
        }
    };
}
export function buildPedestrian() {
    const root = new THREE.Group();
    const coat = sheen('#c2492f', {
        glow: '#c2492f',
        glowK: 0.5
    }), skin = sheen('#d9b392', {
        glow: '#d9b392',
        glowK: 0.3
    }), legs = sheen('#2c3440', {
        glow: '#2c3440',
        glowK: 0.3
    });
    const part = (g, m, y)=>{
        const o = new THREE.Mesh(g, m);
        o.position.y = y;
        root.add(o);
    };
    part(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), coat, 1.15);
    part(new THREE.SphereGeometry(0.13, 12, 10), skin, 1.68);
    part(new THREE.CapsuleGeometry(0.14, 0.62, 4, 8), legs, 0.45);
    const none = new THREE.Mesh();
    none.visible = false;
    return {
        root,
        brake: none,
        beams: none,
        size: {
            length: 0.8,
            wheelbase: 1,
            width: 0.8,
            nose: 0.4,
            radius: 0.3
        },
        animate: ()=>{}
    };
}
