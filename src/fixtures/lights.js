import { markGlow } from '../glowmarks.js';
import * as THREE from 'three';
import { rBox } from '../rbox.js';
import { KITCHEN as K } from '../config.js';
import { click } from '../audio.js';

/**
 * Working lights.
 *  - Ceiling light (bare bulb in a porcelain socket) in the middle of the ceiling.
 *  - Wall switch on the south wall above the wooden dresser: flip up = on, down = off.
 *  - Screw-in bulb for the porcelain sink-side wall light: hover it, scroll (or press E) to rotate.
 *    Clockwise screws it in: it lights at the contact point and gets brighter; anticlockwise dims it out.
 */
export const lightState = { ceilingOn: true, level: 1, onLevel: null };
const ease = (a, b, k) => a + (b - a) * k;
const mat = (c, r = 0.5, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
const porcelain = mat(0xf2efe6, 0.3);

function glassBulb(radius = 0.032) {
  const m = new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.15, emissive: 0xffd9a0, emissiveIntensity: 0, transparent: true, opacity: 0.92 });
  const g = new THREE.Group();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), m); globe.scale.y = 1.2; globe.position.y = radius * 1.35; globe.name = 'bulb-glass'; g.add(globe);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.42, radius * 0.7, radius * 0.9, 16), m); neck.position.y = radius * 0.45; neck.name = 'bulb-neck'; g.add(neck);
  const fil = new THREE.MeshStandardMaterial({ color: 0x806030, emissive: 0xffa040, emissiveIntensity: 0 });
  const coil = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.22, radius * 0.035, 6, 14), fil); coil.position.set(radius * 0.12, radius * 1.35, 0); coil.rotation.y = Math.PI / 2; coil.name = 'bulb-filament'; g.add(coil);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.03, radius * 0.03, radius * 0.9, 6), fil); stem.position.set(0, radius * 0.9, 0); g.add(stem);
  // a printed band on the glass so the turning is visible
  const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.005, radius * 1.005, radius * 0.1, 16, 1, true, 0, 1.2), mat(0x303030, 0.8, { side: THREE.DoubleSide })); band.position.y = radius * 1.35; g.add(band);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, radius * 0.7, 16), mat(0xb9b9b2, 0.35, { metalness: 0.9 })); base.position.y = -radius * 0.1; base.name = 'bulb-screw-base'; g.add(base);
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.57, radius * 0.06, 6, 16), mat(0x9a9a94, 0.4, { metalness: 0.9 })); r.rotation.x = Math.PI / 2; r.position.y = -radius * 0.32 + i * radius * 0.18; g.add(r); }
  return { group: g, glass: m, fil };
}

/** Bare bulb hanging from a porcelain socket in the middle of the ceiling. */
export function buildCeilingLight() {
  const g = new THREE.Group(); g.name = 'ceiling-light'; g.userData.label = 'Ceiling light (bulb + porcelain socket)';
  const H = K.height;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.02, 28), porcelain); plate.position.y = H - 0.01; plate.name = 'ceiling-plate'; g.add(plate);
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.08, 18), porcelain); sock.position.y = H - 0.06; sock.name = 'ceiling-socket'; g.add(sock);
  const b = glassBulb(0.036); b.group.rotation.x = Math.PI; b.group.position.y = H - 0.095 + 0.004; b.group.name = 'ceiling-bulb'; g.add(b.group);
  const light = new THREE.PointLight(0xffd9a0, 10, 0, 2);
  light.position.y = H - 0.2; light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048); light.shadow.bias = -0.0004; light.shadow.normalBias = 0.02; light.shadow.radius = 3;
  g.add(light);
  g.position.set(K.width / 2, 0, K.depth / 2);
  g.userData.update = (dt) => {
    lightState.level = ease(lightState.level, lightState.ceilingOn ? 1 : 0, Math.min(1, dt * 9));
    const l = lightState.level < 0.003 ? 0 : lightState.level;
    light.intensity = 10 * l; light.visible = l > 0;
    b.glass.emissiveIntensity = 2.2 * l; b.fil.emissiveIntensity = 3 * l;
    lightState.onLevel?.(l);
  };
  return g;
}

/** Wall toggle switch (up = on, down = off), south wall above the dresser. */
export function buildWallSwitch() {
  const S = K.switch;
  const g = new THREE.Group(); g.name = 'wall-switch'; g.userData.label = 'Light switch (ceiling light)';
  const plate = new THREE.Mesh(rBox(0.07, 0.115, 0.007), markGlow(mat(0xf0ecdd, 0.45))); plate.position.z = 0.0035; plate.name = 'switch-plate'; g.add(plate);
  const slot = new THREE.Mesh(rBox(0.012, 0.03, 0.004), mat(0x2a2a2a, 0.7)); slot.position.z = 0.008; g.add(slot);
  for (const y of [0.046, -0.046]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.003, 10), mat(0xbdb8a6, 0.5, { metalness: 0.4 })); s.rotation.x = Math.PI / 2; s.position.set(0, y, 0.0085); g.add(s); }
  const lever = new THREE.Group(); lever.position.set(0, 0, 0.007); lever.name = 'switch-lever'; g.add(lever);
  const arm = new THREE.Mesh(rBox(0.009, 0.012, 0.03), markGlow(mat(0xf4f0e2, 0.35))); arm.position.z = 0.015; lever.add(arm);
  const hit = new THREE.Mesh(rBox(0.12, 0.16, 0.08), new THREE.MeshBasicMaterial({ visible: false })); hit.visible = false; hit.position.z = 0.03; hit.name = 'switch-hit'; g.add(hit);
  let ang = lightState.ceilingOn ? -0.45 : 0.45;
  lever.rotation.x = ang;
  g.userData.interact = {
    prompt: () => `<kbd>E</kbd> flip the switch ${lightState.ceilingOn ? 'down (lights off)' : 'up (lights on)'}`,
    run: () => { lightState.ceilingOn = !lightState.ceilingOn; click(lightState.ceilingOn ? 2100 : 1500); },
  };
  g.userData.update = (dt) => { ang = ease(ang, lightState.ceilingOn ? -0.45 : 0.45, Math.min(1, dt * 24)); lever.rotation.x = ang; };
  g.rotation.y = Math.PI;                         // faces north, into the room
  g.position.set(S.x, S.y, K.depth);
  return g;
}

/**
 * Screw-in bulb for the sink wall light. Origin = the socket mouth, bulb points up (local +y).
 * Returns a group; add it to the sconce group at the socket.
 */
/** power: optional () => 0..1 - when given the bulb is screwed in for good and only the supply (e.g. a plug) controls it. */
export function buildScrewBulb({ theta0 = 0, power = null } = {}) {
  const b = glassBulb(0.034);
  const g = new THREE.Group(); g.name = 'sconce-bulb-assembly'; g.userData.label = 'Screw-in bulb (rotate to switch on / dim)';
  const turning = new THREE.Group(); turning.name = 'bulb-turning'; turning.add(b.group); g.add(turning);
  const light = new THREE.PointLight(0xffd29a, 0, 0, 2); light.position.set(0, 0.07, 0.05); g.add(light);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.visible = false; hit.position.y = 0.045; hit.name = 'bulb-hit'; g.add(hit);

  const ON_AT = 150, FULL_AT = 330, MAX = 540;   // degrees: contact point, full brightness, end of thread
  let theta = power ? FULL_AT + 40 : theta0, shown = theta;
  const brightness = () => Math.min(1, Math.max(0, (theta - ON_AT) / (FULL_AT - ON_AT)));
  if (!power) g.userData.interact = {
    prompt: () => {
      const pct = Math.round(brightness() * 100);
      const state = pct === 0 ? (theta > 0 ? 'loose - turn further clockwise' : 'off') : `${pct}%`;
      return `<kbd>Scroll</kbd> rotate the bulb: ⟳ clockwise = on, brighter &nbsp;·&nbsp; ⟲ anticlockwise = dim &nbsp;<span style="opacity:.7">(now ${state})</span>`;
    },
    wheel: (dy) => { theta = Math.min(MAX, Math.max(0, theta - dy * 0.4)); },
    run: () => { theta = theta >= FULL_AT ? 0 : Math.min(MAX, theta + 90); click(900, 0.04); },
  };
  g.userData.persist = { get: () => Math.round(theta), set: (v) => { theta = shown = +v; } };
  g.userData.update = (dt) => {
    shown = ease(shown, theta, Math.min(1, dt * 14));
    turning.rotation.y = -THREE.MathUtils.degToRad(shown);            // clockwise seen from above
    turning.position.y = 0.012 * (1 - shown / MAX);                   // screws in as it turns
    let k = Math.min(1, Math.max(0, (shown - ON_AT) / (FULL_AT - ON_AT))); if (power) k *= power();
    const flick = k > 0 && k < 0.4 ? 0.7 + 0.3 * Math.random() : 1;  // flickers near the contact point
    k *= flick;
    light.intensity = 4.2 * k * k; light.visible = k > 0.01;
    b.glass.emissiveIntensity = 2.4 * k; b.fil.emissiveIntensity = 3.2 * k;
  };
  return g;
}
