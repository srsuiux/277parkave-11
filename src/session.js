/**
 * Session persistence: the state of every interactive thing (doors, lights, taps, curtain, laptop, bulbs) and the
 * visitor's position survive page reloads, but live only in this browser tab's session (sessionStorage), so a fresh
 * session always starts clean with every door closed. Objects opt in with `userData.persist = { get(), set(v) }`.
 */
const KEY = 'apartment-session-v1';
const pathOf = (o) => { const p = []; for (let n = o; n && n.type !== 'Scene'; n = n.parent) p.unshift(n.name || n.type); return p.join('/'); };

export function initSession({ scene, doors, lightState, player, camera }) {
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(KEY)) ?? {}; } catch { saved = {}; }
  const objs = [];
  scene.traverse((o) => { if (o.userData.persist) objs.push([pathOf(o), o.userData.persist]); });

  // ---- restore ----
  for (const [k, p] of objs) if (saved.objects?.[k] !== undefined) { try { p.set(saved.objects[k]); } catch { /* stale entry */ } }
  for (const d of doors) { const a = saved.doors?.[d.name]; if (a !== undefined && !d.userData.locked) d.userData.angle = d.userData.target = a; }
  if (saved.light) { lightState.ceilingOn = !!saved.light.on; lightState.level = lightState.ceilingOn ? 1 : 0; }
  if (saved.player) { player.x = saved.player.x; player.z = saved.player.z; camera.rotation.y = saved.player.yaw; camera.rotation.x = saved.player.pitch; }

  // ---- save (cheap: only writes when something changed) ----
  let last = '';
  const snapshot = () => JSON.stringify({
    objects: Object.fromEntries(objs.map(([k, p]) => [k, p.get()])),
    doors: Object.fromEntries(doors.map((d) => [d.name, Math.round(d.userData.target)])),
    light: { on: lightState.ceilingOn },
    player: { x: +player.x.toFixed(3), z: +player.z.toFixed(3), yaw: +camera.rotation.y.toFixed(3), pitch: +camera.rotation.x.toFixed(3) },
  });
  const save = () => { const s = snapshot(); if (s !== last) { last = s; try { sessionStorage.setItem(KEY, s); } catch { /* storage full or blocked */ } } };
  setInterval(save, 500);
  addEventListener('pagehide', save);
  return { save, clear: () => { sessionStorage.removeItem(KEY); } };
}
