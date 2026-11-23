import * as THREE from 'three';
import { std, wood, mk, bx, rb, cyl } from './furniture.js';
import { click } from '../audio.js';

/**
 * Wooden bathroom vanity cabinet that sits under the wall-hung sink. One bottom-hinged door: the hinge runs along the door's
 * bottom edge and the top edge swings out toward you and down until the door lies flat, like a flip-down front.
 * Local frame matches the sink: origin centre of the footprint on the floor, +z towards the room.
 * Cabinet back is flush with the sink's back (z = -sinkD/2).
 */
export function buildVanityCabinet({ sinkW, sinkD, top }) {
  const g = new THREE.Group(); g.name = 'bath-vanity'; g.userData.label = 'Wooden vanity cupboard (bottom-hinged door)';
  const W = sinkW - 0.018, D = 0.44, H = top - 0.038, kick = 0.08, t = 0.02, cz = -sinkD / 2 + D / 2, front = cz + D / 2;
  const oak = wood('#a8743f', '#4d2d12'), oakDark = wood('#8f5e30', '#3d230f'), inner = std(0xc79a62, 0.8), nickel = std(0xb8bbbd, 0.3, 0.85);
  const P = (w, h, d, m, name, x, y, z) => bx(g, w, h, d, m, name, x, y, z);

  // carcass
  for (const s of [-1, 1]) P(t, H - kick, D, oak, 'vanity-side', s * (W / 2 - t / 2), kick + (H - kick) / 2, cz);
  P(W, kick, D - 0.06, oakDark, 'vanity-plinth', 0, kick / 2, cz - 0.03);
  P(W - 2 * t, t, D - 0.02, inner, 'vanity-floor', 0, kick + t / 2, cz - 0.01);
  P(W - 2 * t, H - kick, 0.008, inner, 'vanity-back', 0, kick + (H - kick) / 2, cz - D / 2 + 0.004);
  // no solid top: the sink itself is the top, and its basin + skirt hang down into the cupboard
  P(W - 2 * t, 0.05, t, oak, 'vanity-top-rail-back', 0, H - t - 0.025, cz - D / 2 + t / 2 + 0.008);
  P(W - 2 * t, 0.06, t, oak, 'vanity-top-rail', 0, H - t - 0.03, front - t / 2);
  P(W - 2 * t, 0.012, 0.3, inner, 'vanity-shelf-lip', 0, kick + t + 0.006, cz + 0.02);
  for (const s of [-1, 1]) P(0.012, H - kick - 2 * t, D - 0.05, inner, 'vanity-lining', s * (W / 2 - t - 0.006), kick + (H - kick) / 2, cz - 0.005);

  // door, hinged on its bottom edge
  const hingeY = kick + 0.014, dh = H - t - 0.06 - hingeY - 0.004, dw = W - 2 * t - 0.006, dt = 0.02, rail = 0.05;
  const door = new THREE.Group(); door.name = 'vanity-door'; door.position.set(0, hingeY, front); g.add(door);
  const D_ = (w, h, d, m, name, x, y, z) => bx(door, w, h, d, m, name, x, y, z);
  D_(dw, rail, dt, oak, 'door-rail-bottom', 0, rail / 2, -dt / 2); D_(dw, rail, dt, oak, 'door-rail-top', 0, dh - rail / 2, -dt / 2);
  for (const s of [-1, 1]) D_(rail, dh - 2 * rail, dt, oak, 'door-stile', s * (dw / 2 - rail / 2), dh / 2, -dt / 2);
  D_(dw - 2 * rail + 0.01, dh - 2 * rail + 0.01, 0.008, oakDark, 'door-panel', 0, dh / 2, -dt / 2 - 0.004);
  D_(dw - 2 * rail - 0.012, dh - 2 * rail - 0.012, 0.004, oak, 'door-panel-raised', 0, dh / 2, -dt / 2 + 0.002);
  D_(0.14, 0.012, 0.012, nickel, 'door-pull', 0, dh - rail / 2, 0.006);
  for (const s of [-1, 1]) { D_(0.012, 0.012, 0.014, nickel, 'door-pull-post', s * 0.06, dh - rail / 2, 0.0); }
  // hinges: barrel on the pivot line, leaf on the door, leaf on the carcass floor
  for (const s of [-1, 1]) {
    mk(g, new THREE.CylinderGeometry(0.0055, 0.0055, 0.036, 12), nickel, 'hinge-barrel', s * (dw / 2 - 0.05), hingeY, front + 0.001, [0, 0, Math.PI / 2]);
    bx(door, 0.036, 0.03, 0.002, nickel, 'hinge-leaf-door', s * (dw / 2 - 0.05), 0.016, 0.001);
    bx(g, 0.036, 0.002, 0.03, nickel, 'hinge-leaf-frame', s * (dw / 2 - 0.05), hingeY - 0.006, front - 0.014);
  }

  // things kept inside (contained within the compartment)
  const fy = kick + t, items = new THREE.Group(); items.name = 'vanity-contents'; g.add(items);
  for (const [x, z] of [[-0.15, cz + 0.02], [-0.15, cz - 0.1], [-0.07, cz + 0.02]]) cyl(items, 0.05, 0.05, 0.1, std(0xf7f7f3, 0.9), 'toilet-roll', x, fy + 0.05, z, null, 20);
  const tw = rb(items, 0.2, 0.12, 0.17, 0.02, std(0x4d7fa8, 0.95), 'towel-stack', 0.1, fy + 0.06, cz - 0.08);
  rb(items, 0.2, 0.012, 0.17, 0.005, std(0xe6e0d0, 0.95), 'towel-stack-top', 0.1, fy + 0.126, cz - 0.08); void tw;
  cyl(items, 0.032, 0.036, 0.2, std(0x4da36b, 0.4), 'cleaner-bottle', 0.17, fy + 0.1, cz + 0.07, null, 16);
  cyl(items, 0.016, 0.016, 0.05, std(0xeeeeee, 0.5), 'cleaner-trigger', 0.17, fy + 0.225, cz + 0.07, null, 10);
  rb(items, 0.1, 0.09, 0.08, 0.01, std(0xd9822b, 0.6), 'sponge-caddy', -0.02, fy + 0.045, cz + 0.12);

  // behaviour
  const OPEN = Math.PI / 2 - 0.02;
  let open = false, ang = 0;
  const zone = { x: W / 2 + 0.12, z0: front - 0.05, z1: front + dh + 0.12 };   // where the door lies / where you must not stand while it opens
  const probe = new THREE.Vector3();
  g.userData.interact = {
    reach: 'grab',
    prompt: () => `<kbd>E</kbd> ${open ? 'close' : 'open'} the vanity cupboard`,
    guard: (wx, wz) => {
      if (open) return null;
      g.updateWorldMatrix(true, false); probe.set(wx, 0, wz); g.worldToLocal(probe);
      return Math.abs(probe.x) < zone.x && probe.z > zone.z0 && probe.z < zone.z1 ? 'Step back first - the cupboard door folds down in front of you' : null;
    },
    run: () => { open = !open; click(open ? 700 : 520, 0.05); },
  };
  // while open the door lies out in front of the cabinet: a collider the walking code treats as solid ('dyn' = recomputed every frame)
  const col = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, dh), new THREE.MeshBasicMaterial({ visible: false }));
  col.visible = false; col.name = 'vanity-door-collider'; col.position.set(0, hingeY + 0.03, front + dh / 2); col.userData.collider = 'dyn'; col.userData.active = () => ang > 0.35; g.add(col);
  g.userData.update = (dt) => { ang += ((open ? OPEN : 0) - ang) * Math.min(1, dt * 5.5); if (Math.abs(ang - (open ? OPEN : 0)) < 0.002) ang = open ? OPEN : 0; door.rotation.x = ang; };
  g.userData.persist = { get: () => open, set: (v) => { open = !!v; ang = open ? OPEN : 0; door.rotation.x = ang; } };
  return g;
}
