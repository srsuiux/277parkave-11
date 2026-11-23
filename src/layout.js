import * as THREE from 'three';
import { KITCHEN as K, BATHROOM as BATH, BEDROOM as BED } from './config.js';

/**
 * Layout mode (press L): drag any movable object across the floor, rotate it, resize it, and save.
 * - left-drag an object: move on the floor (1 cm snap)  - right-drag: look around  - WASD still walks
 * - [ ] rotate 5°, - = shrink/grow 5%, or type exact numbers in the panel
 * Saved to layout.json (via the dev server) and re-applied on every load.
 */
const KEY = 'apartment-layout';
const r2 = (n) => Math.round(n * 1000) / 1000;

// ---- placement rules ----
// 1. Nothing may poke through a wall or into another solid object (touching is fine, overlapping is not).
// 2. Near a wall (or another object) a dragged object snaps flush against it, so it sits exactly on the wall.
const GAP = 0.02;    // stand-off from the wall plane (clears the baseboard)
const SNAP = 0.08;   // snap distance (m)
const EPS = 0.002;   // tolerance
const W = K.width, D = K.depth;
const _cz0 = BED.z0 + BED.closet.dz0;
const RECTS = [[0, K.width, 0, K.depth], [BATH.x0, BATH.x1, BATH.z0, BATH.z1], [BED.x0, BED.x1, BED.z0, BED.z1], [BED.x1 + BED.wallT, BED.x1 + BED.wallT + BED.closet.w, _cz0, _cz0 + BED.closet.d]];   // x0, x1, z0, z1 of each room
const rectAt = (x, z) => RECTS.find((r) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) ?? RECTS[0];

export function initLayout({ scene, camera, renderer, roots, fb, wallPaints = [], extraObstacles, onChange, onEnter, onExit }) {
  const cv = renderer.domElement;
  const state = { on: false, sel: null, saved: {} };
  const movables = [];
  for (const r of roots) r.traverse((o) => { if (o.userData.movable) movables.push(o); });
  const defaults = new Map(movables.map((o) => [o, { x: o.position.x, y: o.position.y, z: o.position.z, rot: o.rotation.y, sx: o.scale.x, sy: o.scale.y, sz: o.scale.z }]));

  const read = (o) => ({ x: r2(o.position.x), y: r2(o.position.y), z: r2(o.position.z), rot: r2(THREE.MathUtils.radToDeg(o.rotation.y)), sx: r2(o.scale.x), sy: r2(o.scale.y), sz: r2(o.scale.z) });
  const write = (o, v) => {
    o.position.set(v.x, v.y, v.z); o.rotation.y = THREE.MathUtils.degToRad(v.rot); o.scale.set(v.sx, v.sy, v.sz);
  };
  const solidMeshes = (o) => { const l = []; o.traverse((m) => { if (m.isMesh && m.userData.collider) l.push(m); }); return l; };
  const isSolid = (o) => solidMeshes(o).length > 0;
  function boxOf(o) {
    o.updateMatrixWorld(true);
    const b = new THREE.Box3(), s = solidMeshes(o);
    if (s.length) s.forEach((m) => b.union(new THREE.Box3().setFromObject(m))); else b.setFromObject(o);
    return b;
  }
  function obstaclesFor(o) {
    scene.updateMatrixWorld(true);
    const out = [];
    for (const r of roots) r.traverse((m) => {
      if (!m.isMesh || !m.userData.collider) return;
      for (let p = m; p; p = p.parent) if (p === o) return;
      for (let p = m.parent; p; p = p.parent) if (!p.visible) return;
      const bb = new THREE.Box3().setFromObject(m);
      let lab = 'a wall'; for (let p = m; p; p = p.parent) if (p.userData.label) { lab = p.userData.label; break; }
      bb.label = lab; out.push(bb);
    });
    if (!o.userData.wallMount) out.push(...(extraObstacles?.() ?? []));   // door swing areas stay clear
    return out;
  }
  const hits = (a, b) => a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS && a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS && a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS;
  const inRoom = (b) => RECTS.some(([x0, x1, z0, z1]) => b.min.x >= x0 + GAP - EPS && b.max.x <= x1 - GAP + EPS && b.min.z >= z0 + GAP - EPS && b.max.z <= z1 - GAP + EPS);
  /** human-readable reason a spot is refused */
  function whyNot(o, obst) {
    const b = boxOf(o);
    if (!inRoom(b)) return 'that is outside the room';
    const ob = obst.find((x) => hits(b, x));
    return ob ? `${ob.label ?? 'something'} is in the way` : 'something is in the way';
  }
  /** true when the object currently respects the rules (inside the room, not overlapping any solid) */
  function allowed(o, obst) {
    if (o.userData.wallMount) return true;
    const b = boxOf(o);
    if (!inRoom(b)) return false;
    return !isSolid(o) || !obst.some((ob) => hits(b, ob));
  }
  /** move to (x,z), clamp into the room, then snap flush to nearby walls / objects. */
  function placeSnapped(o, x, z, obst, rect = RECTS[0]) {
    const [rx0, rx1, rz0, rz1] = rect;
    o.position.x = x; o.position.z = z;
    let b = boxOf(o);
    const solid = isSolid(o);
    const shift = (dx, dz) => { o.position.x += dx; o.position.z += dz; b.translate(new THREE.Vector3(dx, 0, dz)); };
    shift(b.min.x < rx0 + GAP ? rx0 + GAP - b.min.x : b.max.x > rx1 - GAP ? rx1 - GAP - b.max.x : 0, b.min.z < rz0 + GAP ? rz0 + GAP - b.min.z : b.max.z > rz1 - GAP ? rz1 - GAP - b.max.z : 0);
    for (const axis of ['x', 'z']) {
      const other = axis === 'x' ? 'z' : 'x', hi = axis === 'x' ? rx1 - GAP : rz1 - GAP, lo = axis === 'x' ? rx0 + GAP : rz0 + GAP;
      const cand = [lo - b.min[axis], hi - b.max[axis]];
      if (solid) for (const ob of obst) {
        if (!(b.min[other] < ob.max[other] - EPS && b.max[other] > ob.min[other] + EPS && b.min.y < ob.max.y && b.max.y > ob.min.y)) continue;
        cand.push(ob.max[axis] - b.min[axis], ob.min[axis] - b.max[axis]);
      }
      let best = null;
      for (const d of cand) if (Math.abs(d) <= SNAP && (best === null || Math.abs(d) < Math.abs(best))) best = d;
      if (best) { if (axis === 'x') shift(best, 0); else shift(0, best); }
    }
    return { x: o.position.x, z: o.position.z };
  }
  /** pairs that currently break the rules (for checking the default layout) */
  function audit() {
    const out = [];
    for (const o of movables.filter((m) => m.visible)) {
      const b = boxOf(o);
      if (!o.userData.wallMount && !inRoom(b)) out.push(`${o.name}: outside the room`);
      if (!isSolid(o)) continue;
      for (const p of movables) if (p.visible && p !== o && p.name > o.name && isSolid(p) && hits(b, boxOf(p))) out.push(`${o.name} overlaps ${p.name}`);
      scene.updateMatrixWorld(true);
      for (const ob of obstaclesFor(o)) if (hits(b, ob) && !movables.some((m) => m !== o && isSolid(m) && new THREE.Box3().setFromObject(m, true).containsBox(ob))) out.push(`${o.name} overlaps fixed geometry`);
    }
    return [...new Set(out)];
  }
  const all = () => ({ ...Object.fromEntries(movables.map((o) => [o.name, { ...read(o), visible: o.visible, ...(o.userData.paint ? { paint: o.userData.paint.get() } : {}) }])), ...Object.fromEntries(wallPaints.map((w) => ['wall:' + w.userData.paintId, { paint: w.userData.paint.get() }]))   });

  async function load() {
    let data = null;
    try { const r = await fetch('/layout.json', { cache: 'no-store' }); if (r.ok) data = await r.json(); } catch { /* none yet */ }
    if (!data || typeof data !== 'object') { try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; } }
    if (!data) return;
    state.saved = data;
    for (const o of movables) if (data[o.name]) { write(o, { ...read(o), ...data[o.name] }); o.visible = data[o.name].visible !== false; if (data[o.name].paint) o.userData.paint?.set(data[o.name].paint); }
    for (const w of wallPaints) { const d = data['wall:' + w.userData.paintId]; if (d?.paint) w.userData.paint.set(d.paint); }
    renderList();
    onChange?.();
  }

  // ---------- UI: small help card (bottom-left) + floating toolbar on the selected object ----------
  const css = (el, t) => { el.style.cssText = t; return el; };
  const BTN = 'padding:5px 9px;border:1px solid #555;border-radius:6px;background:#2a2a2e;color:#fff;cursor:pointer;font:12px system-ui';
  const card = css(document.createElement('div'), 'position:fixed;left:12px;bottom:12px;width:285px;background:rgba(15,15,18,.92);border:1px solid #333;border-radius:10px;padding:12px;display:none;flex-direction:column;gap:8px;font:12px/1.5 system-ui;color:#ddd;z-index:20');
  card.innerHTML = `
    <div style="font-size:14px;font-weight:600">Layout mode <span style="font-weight:400;color:#888">· press L to exit</span></div>
    <div><b>1.</b> Click an object &nbsp; <b>2.</b> drag it to move<br><b>3.</b> drag the dots on it to resize or turn it:</div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 8px">
      <span style="color:#ffb020">●</span><span>orange = width</span>
      <span style="color:#3aa0ff">●</span><span>blue = depth (front / back)</span>
      <span style="color:#3ddc84">●</span><span>green = height</span>
      <span style="color:#c07cff">●</span><span>purple = rotate</span>
    </div>
    <div style="color:#9aa">Objects snap flush to walls and each other, and can't overlap.<br>Walk with WASD · right-drag to look around.</div>
    <div style="display:flex;gap:6px"><button id="ly-save" style="${BTN};background:#1f6feb">Save layout</button><button id="ly-resetall" style="${BTN}">Reset all</button><button id="ly-exit" style="${BTN}">Exit</button></div>
    <div style="display:flex;gap:6px"><button id="ly-undo" style="${BTN}" title="Undo the last Reset all / Revert">↩ Undo</button><button id="ly-revert" style="${BTN}" title="Reload the last SAVED layout (throws away unsaved changes)">Revert to saved</button></div>
    <div id="ly-status" style="color:#9aa;min-height:16px"></div>
    <details><summary style="cursor:pointer;color:#9ab">Type exact numbers…</summary>
      <select id="ly-pick" style="width:100%;margin:6px 0;padding:4px;background:#222;color:#eee;border:1px solid #444"></select>
      <div id="ly-fields" style="display:grid;grid-template-columns:80px 1fr;gap:4px 8px;align-items:center"></div>
    </details>`;
  document.body.appendChild(card);
  const $ = (id) => card.querySelector('#' + id);
  const FIELDS = [['x', 'x (m)'], ['y', 'height off floor'], ['z', 'z (m)'], ['rot', 'rotate °'], ['sx', 'width ×'], ['sy', 'height ×'], ['sz', 'depth ×']];
  $('ly-fields').innerHTML = FIELDS.map(([k, l]) => `<label>${l}</label><input data-k="${k}" type="number" step="${k.startsWith('s') ? 0.05 : k === 'rot' ? 5 : 0.01}" style="width:100%;box-sizing:border-box;background:#222;color:#eee;border:1px solid #444;padding:3px">`).join('');
  $('ly-pick').innerHTML = '<option value="">— pick an object —</option>' + movables.map((o, i) => `<option value="${i}">${o.userData.label ?? o.name}</option>`).join('');

  const bar = css(document.createElement('div'), 'position:fixed;display:none;z-index:21;transform:translate(-50%,-100%);background:rgba(15,15,18,.94);border:1px solid #444;border-radius:10px;padding:6px 8px;gap:6px;align-items:center;font:12px system-ui;color:#eee;white-space:nowrap');
  bar.innerHTML = `<span id="tb-name" style="color:#7dd3fc;max-width:210px;overflow:hidden;text-overflow:ellipsis"></span><span id="tb-dim" style="color:#9aa"></span>
    <button id="tb-l" title="Rotate 90° left" style="${BTN}">⟲ 90°</button><button id="tb-r" title="Rotate 90° right" style="${BTN}">⟳ 90°</button>
    <button id="tb-reset" title="Put this object back where it started" style="${BTN}">Reset</button><button id="tb-done" title="Deselect" style="${BTN}">✕</button>`;
  document.body.appendChild(bar);
  const tip = css(document.createElement('div'), 'position:fixed;display:none;z-index:22;pointer-events:none;background:rgba(0,0,0,.8);color:#fff;font:12px system-ui;padding:3px 8px;border-radius:6px');
  document.body.appendChild(tip);
  const $b = (id) => bar.querySelector('#' + id);

  // ---------- sidebar: every object, with show / hide toggles ----------
  const side = css(document.createElement('div'), 'position:fixed;top:80px;right:12px;width:290px;max-height:calc(100vh - 100px);display:none;flex-direction:column;background:rgba(15,15,18,.92);border:1px solid #333;border-radius:10px;font:12px system-ui;color:#ddd;z-index:20;overflow:hidden');
  side.innerHTML = `<div style="padding:10px 12px;border-bottom:1px solid #333;display:flex;align-items:center;gap:6px"><b style="font-size:13px">Objects</b><span id="sd-count" style="color:#9aa;white-space:nowrap;font-size:11px"></span><span style="flex:1"></span><button id="sd-all" style="${BTN};padding:3px 6px;white-space:nowrap;font-size:11px">Show all</button><button id="sd-none" style="${BTN};padding:3px 6px;white-space:nowrap;font-size:11px">Hide all</button></div><div id="sd-list" style="overflow:auto;padding:4px 6px"></div>
    <div style="padding:6px 12px;border-top:1px solid #333;color:#9aa">Tick = in the room. Untick = removed (also no collision).</div>`;
  side.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(side);
  function renderList() {
    const list = side.querySelector('#sd-list');
    list.innerHTML = '';
    for (const o of movables) {
      const row = css(document.createElement('div'), `display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;${state.sel === o ? 'background:#1d3a4a;' : ''}${o.visible ? '' : 'opacity:.5;'}`);
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = o.visible; cb.title = o.visible ? 'Remove from room' : 'Add to room';
      cb.onclick = (e) => { e.stopPropagation(); setVisible(o, cb.checked); };
      const name = document.createElement('span'); name.textContent = o.userData.label ?? o.name; name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      row.append(cb, name);
      row.onclick = () => { if (!o.visible) setVisible(o, true); select(o); };
      list.appendChild(row);
    }
    side.querySelector('#sd-count').textContent = `${movables.filter((m) => m.visible).length}/${movables.length} in room`;
  }
  function setVisible(o, v) {
    o.visible = v;
    if (!v && state.sel === o) select(null);
    renderList(); onChange?.();
    if (v && !allowed(o, obstaclesFor(o))) say(`${o.userData.label ?? o.name} was added but overlaps something - drag it to a free spot.`);
  }
  side.querySelector('#sd-all').onclick = () => { movables.forEach((o) => { o.visible = true; }); renderList(); onChange?.(); };
  side.querySelector('#sd-none').onclick = () => { select(null); movables.forEach((o) => { o.visible = false; }); renderList(); onChange?.(); };

  // ---------- on-object handles ----------
  const HANDLES = [
    { id: 'w+', kind: 'size', axis: 'x', sign: 1, color: 0xffb020, tip: '↔ Drag to change width' },
    { id: 'w-', kind: 'size', axis: 'x', sign: -1, color: 0xffb020, tip: '↔ Drag to change width' },
    { id: 'd+', kind: 'size', axis: 'z', sign: 1, color: 0x3aa0ff, tip: '⇅ Drag to change depth' },
    { id: 'd-', kind: 'size', axis: 'z', sign: -1, color: 0x3aa0ff, tip: '⇅ Drag to change depth' },
    { id: 'h', kind: 'size', axis: 'y', sign: 1, color: 0x3ddc84, tip: '↕ Drag to change height' },
    { id: 'rot', kind: 'rot', color: 0xc07cff, tip: '⟳ Drag to rotate' },
  ];
  const handleGroup = new THREE.Group(); handleGroup.visible = false; scene.add(handleGroup);
  for (const h of HANDLES) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color: h.color, depthTest: false, transparent: true }));
    const ring = new THREE.Mesh(new THREE.SphereGeometry(1.28, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, depthTest: false, transparent: true }));
    m.add(ring); m.renderOrder = 999; ring.renderOrder = 998; m.userData.handle = h; h.mesh = m; handleGroup.add(m);
  }
  const lbCache = new Map();
  function localBox(o) {
    if (lbCache.has(o)) return lbCache.get(o);
    const p = o.position.clone(), r = o.rotation.clone(), s = o.scale.clone();
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    o.position.copy(p); o.rotation.copy(r); o.scale.copy(s); o.updateMatrixWorld(true);
    lbCache.set(o, b); return b;
  }
  const tmp = new THREE.Vector3();
  function handleLocal(h, lb) {
    const c = lb.getCenter(new THREE.Vector3());
    if (h.id === 'w+') return new THREE.Vector3(lb.max.x, c.y, c.z);
    if (h.id === 'w-') return new THREE.Vector3(lb.min.x, c.y, c.z);
    if (h.id === 'd+') return new THREE.Vector3(c.x, c.y, lb.max.z);
    if (h.id === 'd-') return new THREE.Vector3(c.x, c.y, lb.min.z);
    return new THREE.Vector3(c.x, lb.max.y, c.z); // 'h'
  }
  let hover = null;
  function placeHandles() {
    const o = state.sel;
    const wm = !!o?.userData.wallMount;
    handleGroup.visible = !!o && state.on && (!wm || !!o.userData.resizable);
    if (!handleGroup.visible) return;
    o.updateMatrixWorld(true);
    const lb = localBox(o);
    for (const h of HANDLES) {
      h.mesh.visible = !wm || h.id === 'w+' || h.id === 'w-';   // wall fixtures: only the width handles
      if (h.kind === 'rot') {
        const front = o.localToWorld(new THREE.Vector3((lb.min.x + lb.max.x) / 2, lb.min.y, lb.max.z));
        const dir = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld);
        h.mesh.position.copy(front).addScaledVector(dir, 0.32); h.mesh.position.y = 0.05;
      } else h.mesh.position.copy(o.localToWorld(handleLocal(h, lb)));
      const k = camera.position.distanceTo(h.mesh.position) * 0.017 * (hover === h || drag?.h === h ? 1.45 : 1);
      h.mesh.scale.setScalar(k);
    }
  }

  let helper = null;
  function select(o) {
    state.sel = o;
    if (helper) { scene.remove(helper); helper = null; }
    $('ly-pick').value = o ? String(movables.indexOf(o)) : '';
    if (o) { helper = new THREE.BoxHelper(o, 0x00e5ff); helper.renderOrder = 997; scene.add(helper); }
    bar.style.display = o && state.on ? 'flex' : 'none';
    refresh(); renderList();
  }
  function dims() {
    const o = state.sel; if (!o) return '';
    const s = new THREE.Box3().setFromObject(o, true).getSize(new THREE.Vector3());
    return `${s.x.toFixed(2)} × ${s.y.toFixed(2)} × ${s.z.toFixed(2)} m`;
  }
  function refresh() {
    const o = state.sel;
    card.querySelectorAll('input[data-k]').forEach((i) => { i.disabled = !o; if (o && document.activeElement !== i) i.value = read(o)[i.dataset.k]; });
    if (o) { $b('tb-name').textContent = o.userData.label ?? o.name; $b('tb-dim').textContent = dims(); }
  }
  const changed = () => { refresh(); helper?.update(); onChange?.(); };
  const say = (t) => { $('ly-status').textContent = t; };
  const resetObj = (o) => { const d = defaults.get(o); write(o, { x: d.x, y: d.y, z: d.z, rot: THREE.MathUtils.radToDeg(d.rot), sx: d.sx, sy: d.sy, sz: d.sz }); };
  const tryChange = (o, apply, msg = 'Blocked: that would overlap a wall or another object.') => {
    const prev = read(o); apply(); 
    if (!allowed(o, obstaclesFor(o))) { write(o, prev); say(msg); return false; }
    say(''); changed(); return true;
  };

  card.addEventListener('input', (e) => {
    const k = e.target.dataset?.k; if (!k || !state.sel) return;
    const v = parseFloat(e.target.value); if (Number.isNaN(v)) return;
    tryChange(state.sel, () => { const cur = read(state.sel); cur[k] = k.startsWith('s') ? Math.max(0.1, v) : v; write(state.sel, cur); });
  });
  $('ly-pick').onchange = (e) => select(e.target.value === '' ? null : movables[+e.target.value]);
  let undoSnap = null;
  const applySnap = (data) => { for (const o of movables) if (data[o.name]) { write(o, { ...read(o), ...data[o.name] }); o.visible = data[o.name].visible !== false; } renderList(); changed(); };
  $('ly-resetall').onclick = () => { undoSnap = all(); for (const o of movables) { resetObj(o); o.visible = true; } renderList(); changed(); say('All objects back to defaults (not saved yet). Press ↩ Undo to get your layout back.'); };
  $('ly-undo').onclick = () => { if (!undoSnap) { say('Nothing to undo.'); return; } applySnap(undoSnap); undoSnap = null; say('Undone - your layout is back (not saved yet).'); };
  $('ly-revert').onclick = async () => {
    undoSnap = all();
    try { const r = await fetch('/layout.json', { cache: 'no-store' }); const d = await r.json(); applySnap(d); say('Reloaded the last saved layout. (↩ Undo goes back to what you had.)'); }
    catch { say('No saved layout.json found.'); }
  };
  $('ly-exit').onclick = () => toggle(false);
  $b('tb-l').onclick = () => state.sel && tryChange(state.sel, () => { const c = read(state.sel); c.rot -= 90; write(state.sel, c); }, 'Blocked: no room to turn here. Move it away from the wall first.');
  $b('tb-r').onclick = () => state.sel && tryChange(state.sel, () => { const c = read(state.sel); c.rot += 90; write(state.sel, c); }, 'Blocked: no room to turn here. Move it away from the wall first.');
  $b('tb-reset').onclick = () => { if (state.sel) { resetObj(state.sel); changed(); say('Object reset (not saved yet).'); } };
  $b('tb-done').onclick = () => select(null);
  async function save() {
    const data = all();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
    try {
      const r = await fetch('/__layout', { method: 'POST', body: JSON.stringify(data) });
      const j = await r.json(); say(j.ok ? `Saved ${j.count} objects to layout.json` : 'Save failed: ' + j.error);
    } catch (e) { say('Dev server not reachable; saved in this browser only.'); }
  }
  $('ly-save').onclick = save;
  for (const el of [card, bar]) el.addEventListener('pointerdown', (e) => e.stopPropagation());

  // ---------- picking / dragging ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let drag = null, looking = false, last = [0, 0], pending = null;
  const setNdc = (e) => { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  const ownerOf = (obj) => { for (let o = obj; o; o = o.parent) if (o.userData.movable) return o; return null; };
  const handleAt = () => {
    if (!handleGroup.visible) return null;
    const hs = ray.intersectObjects(handleGroup.children.filter((c) => c.visible), false);
    return hs.length ? hs[0].object.userData.handle : null;
  };

  cv.addEventListener('contextmenu', (e) => { if (state.on) e.preventDefault(); });
  cv.addEventListener('pointerdown', (e) => {
    if (!state.on) return;
    last = [e.clientX, e.clientY];
    if (e.button === 2) { looking = true; cv.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    setNdc(e);
    const h = handleAt();
    const o = state.sel;
    if (h && o) {
      const obst = obstaclesFor(o);
      if (h.kind === 'rot') {
        plane.constant = 0;
        if (ray.ray.intersectPlane(plane, hit)) drag = { kind: 'rot', o, h, obst, off: o.rotation.y - Math.atan2(hit.x - o.position.x, hit.z - o.position.z) };
      } else {
        const lb = localBox(o), c = lb.getCenter(new THREE.Vector3());
        const ext = lb.max[h.axis] - lb.min[h.axis];
        const Floc = c.clone(); Floc[h.axis] = h.axis === 'y' ? lb.min.y : (h.sign > 0 ? lb.min[h.axis] : lb.max[h.axis]);
        const axisDir = new THREE.Vector3(h.axis === 'x' ? 1 : 0, h.axis === 'y' ? 1 : 0, h.axis === 'z' ? 1 : 0).transformDirection(o.matrixWorld);
        drag = { kind: 'size', o, h, obst, ext, Floc, Fworld: o.localToWorld(Floc.clone()), axisDir, hy: h.mesh.position.y };
      }
      cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; return;
    }
    // Selection only ever changes on a deliberate CLICK on another object (press + release without moving).
    // While something is selected, pressing on it (or on anything right behind it) always grabs THAT object, so
    // editing never jumps to a neighbour, and clicking empty floor / wall does not deselect.
    const hits = ray.intersectObjects(movables.filter((m) => m.visible), true).filter((h) => h.object.visible !== false);
    let picked = hits.length ? ownerOf(hits[0].object) : null;
    if (o && picked !== o) {
      const mine = hits.find((h) => ownerOf(h.object) === o);
      if (mine && mine.distance - hits[0].distance < 0.6) picked = o;
    }
    if (picked && picked === o) {
      plane.constant = -picked.position.y;
      if (picked.userData.wallMount === 'any' || ray.ray.intersectPlane(plane, hit)) drag = { kind: 'move', o: picked, dx: hit.x - picked.position.x, dz: hit.z - picked.position.z, obst: obstaclesFor(picked), rect: rectAt(picked.position.x, picked.position.z) };
      cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
    } else if (picked) {
      pending = { o: picked, x: e.clientX, y: e.clientY };      // select on release if it was a click
      cv.setPointerCapture(e.pointerId);
    }
  });

  function dragSize(d) {
    const o = d.o, h = d.h, axis = h.axis;
    let t;
    if (axis === 'y') {
      const v = new THREE.Vector3(0, 1, 0), w0 = d.Fworld.clone().sub(ray.ray.origin), dd = ray.ray.direction;
      const b = v.dot(dd), dv = v.dot(w0), e = dd.dot(w0), den = 1 - b * b;
      if (Math.abs(den) < 1e-4) return;
      t = (b * e - dv) / den;
    } else {
      plane.constant = -d.hy;
      if (!ray.ray.intersectPlane(plane, hit)) return;
      t = h.sign * hit.clone().sub(d.Fworld).dot(d.axisDir);
    }
    const want = Math.min(o.userData.maxScaleX && axis === 'x' ? o.userData.maxScaleX : 5, Math.max(0.2, t / d.ext));
    const prevScale = o.scale[axis], prevPos = o.position.clone();
    const set = (s) => {
      o.scale[axis] = s; o.updateMatrixWorld(true);
      o.position.add(d.Fworld.clone().sub(o.localToWorld(d.Floc.clone()))); o.updateMatrixWorld(true);
    };
    set(want);
    if (allowed(o, d.obst)) { say(''); return; }
    // too big: grow as far as it fits (ends up flush against the wall / neighbour)
    let lo = prevScale, hi = want;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; set(mid); if (allowed(o, d.obst)) lo = mid; else hi = mid; }
    set(lo);
    if (!allowed(o, d.obst)) { o.scale[axis] = prevScale; o.position.copy(prevPos); o.updateMatrixWorld(true); }
    say('Stopped: something is in the way.');
  }
  function dragRot(d) {
    plane.constant = 0;
    if (!ray.ray.intersectPlane(plane, hit)) return;
    const o = d.o, prev = o.rotation.y;
    let deg = THREE.MathUtils.radToDeg(Math.atan2(hit.x - o.position.x, hit.z - o.position.z) + d.off);
    const m = Math.round(deg / 90) * 90;
    deg = Math.abs(deg - m) < 6 ? m : Math.round(deg / 5) * 5;   // magnetic 90° stops, otherwise 5° steps
    o.rotation.y = THREE.MathUtils.degToRad(deg); o.updateMatrixWorld(true);
    if (!allowed(o, d.obst)) { o.rotation.y = prev; o.updateMatrixWorld(true); say('Blocked: no room to turn here.'); } else say('');
  }

  cv.addEventListener('pointermove', (e) => {
    if (!state.on) return;
    if (looking) {
      camera.rotation.y -= (e.clientX - last[0]) * 0.004;
      camera.rotation.x = Math.max(-1.4, Math.min(1.4, camera.rotation.x - (e.clientY - last[1]) * 0.004));
      last = [e.clientX, e.clientY]; return;
    }
    setNdc(e);
    if (!drag) {
      hover = handleAt();
      if (hover) { tip.textContent = hover.tip; tip.style.display = 'block'; tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px'; cv.style.cursor = 'pointer'; }
      else { tip.style.display = 'none'; const hh = ray.intersectObjects(movables.filter((m) => m.visible), true); cv.style.cursor = hh.length ? 'grab' : ''; }
      return;
    }
    tip.style.display = 'none';
    if (drag.kind === 'size') dragSize(drag);
    else if (drag.kind === 'rot') dragRot(drag);
    else if (drag.o.userData.wallMount === 'any') {   // free wall fixture: follows the pointer over any wall (any height, any room), turning to face the room
      const o = drag.o, hh = ray.intersectObjects(wallPaints, true).find((h) => h.face);
      if (!hh) return;
      const n = hh.face.normal.clone().transformDirection(hh.object.matrixWorld).normalize();
      if (Math.abs(n.y) > 0.5) return;
      const gap = o.userData.wallGap ?? 0.006, anchor = o.userData.wallAnchorY ?? 0, r2 = (v) => Math.round(v * 100) / 100;
      o.position.set(r2(hh.point.x + n.x * gap), Math.min(2.25 - anchor, Math.max(0.03, r2(hh.point.y - anchor))), r2(hh.point.z + n.z * gap));
      o.rotation.y = Math.atan2(n.x, n.z); o.updateMatrixWorld(true); changed(); return;
    }
    else if (ray.ray.intersectPlane(plane, hit)) {
      const o = drag.o, cx = o.position.x, cz = o.position.z;
      const tx = hit.x - drag.dx, tz = hit.z - drag.dz;
      const rc = rectAt(o.position.x, o.position.z);
      if (o.userData.wallMount === 'x') { o.position.x = Math.min(rc[1] - 0.4, Math.max(rc[0] + 0.4, Math.round(tx * 100) / 100)); o.updateMatrixWorld(true); changed(); return; }
      if (o.userData.wallMount) { o.position.z = Math.min(rc[3] - 0.15, Math.max(rc[2] + 0.15, Math.round(tz * 100) / 100)); o.updateMatrixWorld(true); changed(); return; }  // wall fixtures only slide along their wall
      let ok = false, reason = '';
      for (const [x, z] of [[tx, tz], [tx, cz], [cx, tz]]) {   // try the full move, then slide along whatever blocks us
        placeSnapped(o, x, z, drag.obst, drag.rect);
        if (allowed(o, drag.obst)) { ok = true; break; }
        if (!reason) reason = whyNot(o, drag.obst);            // why the move you actually asked for was refused
      }
      if (!ok) { o.position.x = cx; o.position.z = cz; }
      say(reason ? `Can't go further: ${reason}.` : '');
    }
    changed();
  });
  const up = (e) => {
    if (pending && e.type === 'pointerup' && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < 6) select(pending.o);
    pending = null; drag = null; looking = false; if (state.on) cv.style.cursor = '';
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  addEventListener('keydown', (e) => {
    if (fb.isTyping(e) || e.repeat && e.code === 'KeyL') return;
    if (e.code === 'KeyL') { toggle(); return; }
    if (!state.on || !state.sel) return;
    if (e.code === 'Escape') { select(null); return; }
    const o = state.sel;
    const apply = e.code === 'BracketLeft' ? (c) => { c.rot -= 5; } : e.code === 'BracketRight' ? (c) => { c.rot += 5; }
      : e.code === 'Minus' ? (c) => { c.sx *= 0.95; c.sy *= 0.95; c.sz *= 0.95; } : e.code === 'Equal' ? (c) => { c.sx *= 1.05; c.sy *= 1.05; c.sz *= 1.05; } : null;
    if (!apply) return;
    tryChange(o, () => { const c = read(o); apply(c); write(o, c); });
  });

  function toggle(force) {
    const next = force ?? !state.on;
    if (next === state.on) return;
    if (next && fb.state.edit) fb.toggle(false);
    state.on = next;
    card.style.display = next ? 'flex' : 'none'; side.style.display = next ? 'flex' : 'none';
    document.getElementById('dot').style.display = next ? 'none' : '';
    cv.style.cursor = '';
    if (next) onEnter?.(); else { select(null); tip.style.display = 'none'; onExit?.(); }
  }

  const btn = document.createElement('button');
  btn.innerHTML = '⤧ Layout mode <kbd>L</kbd>';
  btn.style.cssText = 'position:fixed;top:44px;right:12px;z-index:19;padding:5px 9px;border:1px solid #444;border-radius:6px;background:rgba(20,20,24,.8);color:#ddd;font:12px system-ui;cursor:pointer';
  btn.onclick = () => toggle();
  document.body.appendChild(btn);

  renderList();
  const proj = new THREE.Vector3();
  function placeBar() {
    const o = state.sel;
    if (!o || !state.on) { bar.style.display = 'none'; return; }
    const b = new THREE.Box3().setFromObject(o, true);
    proj.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).project(camera);
    if (proj.z > 1) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const x = Math.min(innerWidth - 220, Math.max(220, (proj.x * 0.5 + 0.5) * innerWidth));
    bar.style.left = x + 'px';
    bar.style.top = Math.max(60, (-proj.y * 0.5 + 0.5) * innerHeight - 46) + 'px';
  }

  const ready = load();
  return { ready, state, toggle, movables, audit, save, update() { if (state.on && fb.state.edit) toggle(false); helper?.update(); placeHandles(); placeBar(); } };
}
