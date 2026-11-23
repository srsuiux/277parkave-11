import * as THREE from 'three';

const TYPES = [
  ['fix', 'Fix existing'],
  ['add', 'Add new object here'],
  ['remove', 'Remove'],
  ['move', 'Move / resize'],
  ['other', 'Other'],
];
const PIN_COLOR = { fix: 0xffb020, add: 0x35d07f, remove: 0xff4d4d, move: 0x4da3ff, other: 0xb07cff };
const STORE = 'apartment-feedback-notes';

const CSS = `
#fb-btn{position:fixed;top:12px;right:12px;z-index:30;background:rgba(20,20,20,.8);color:#eee;border:1px solid #555;border-radius:6px;padding:6px 10px;cursor:pointer;font:13px system-ui}
#fb-btn.on{background:#b8860b;border-color:#e0a82e}
#fb-btn kbd,#fb kbd{background:#2b2b2b;border:1px solid #555;border-radius:4px;padding:0 5px;font-size:11px}
#fb{position:fixed;top:48px;right:12px;bottom:12px;width:320px;z-index:30;background:rgba(18,18,18,.92);color:#eee;border-radius:8px;padding:12px;display:none;flex-direction:column;gap:8px;font:13px system-ui;overflow:auto}
#fb h3{margin:0;font-size:14px}
#fb .hint{color:#999;font-size:12px;line-height:1.5}
#fb .sel{background:#222;border-radius:6px;padding:8px;font-size:12px;line-height:1.5;word-break:break-word}
#fb .sel b{color:#ffcc33}
#fb select,#fb textarea,#fb button{font:13px system-ui;background:#2b2b2b;color:#eee;border:1px solid #484848;border-radius:5px;padding:6px}
#fb textarea{min-height:90px;resize:vertical}
#fb button{cursor:pointer}#fb button:hover{background:#3a3a3a}
#fb button.primary{background:#2d6a4f;border-color:#40916c}
#fb .row{display:flex;gap:6px}#fb .row>*{flex:1}
#fb .note{background:#222;border-radius:6px;padding:6px 8px;font-size:12px;display:grid;gap:2px}
#fb .note .t{color:#aaa}#fb .note button{padding:1px 6px;justify-self:end}
#fb .status{font-size:12px;color:#8fd19e;word-break:break-word}
`;

export function initFeedback({ scene, camera, renderer, roots, onEnter, onExit }) {
  const state = { edit: false, selected: null, point: null, normal: null, notes: load() };

  function persist() { try { localStorage.setItem(STORE, JSON.stringify(state.notes)); } catch { /* quota: notes stay in memory */ } }

  // ---------- DOM ----------
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const btn = document.createElement('div');
  btn.id = 'fb-btn'; btn.innerHTML = '✎ Feedback mode <kbd>F</kbd>';
  const panel = document.createElement('div');
  panel.id = 'fb';
  panel.innerHTML = `
    <h3>Feedback <span id="fb-count"></span></h3>
    <div class="hint">Click anything to select it. <b>Right-drag</b> to look, <kbd>WASD</kbd> to move, <kbd>F</kbd> to leave.</div>
    <div class="sel" id="fb-sel">Nothing selected yet.</div>
    <div class="row"><button id="fb-parent">Select parent ↑</button><button id="fb-clear">Deselect</button></div>
    <select id="fb-type">${TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    <textarea id="fb-text" placeholder="What should change? (for a new object: what it is, size, material…)"></textarea>
    <button id="fb-add" class="primary">Add note <kbd>Ctrl+Enter</kbd></button>
    <div id="fb-list"></div>
    <button id="fb-save">Save all to file</button>
    <div class="status" id="fb-status"></div>`;
  document.body.append(btn, panel);
  const $ = (id) => panel.querySelector('#' + id);

  // ---------- 3D helpers ----------
  const pins = new THREE.Group(); pins.name = 'feedback-pins'; pins.visible = false; scene.add(pins);
  let helper = null;
  const ray = new THREE.Raycaster();

  function pinFor(note) {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12),
      new THREE.MeshBasicMaterial({ color: PIN_COLOR[note.type] ?? 0xffffff, depthTest: false }));
    s.renderOrder = 999;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#000'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(note.n), 32, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sp.scale.set(0.09, 0.09, 1); sp.renderOrder = 1000;
    g.add(s, sp);
    g.position.set(...note.point);
    g.userData.noteId = note.id;
    return g;
  }
  function rebuildPins() {
    pins.clear();
    for (const n of state.notes) if (n.point) pins.add(pinFor(n));
  }

  function select(obj, point = state.point, normal = state.normal) {
    state.selected = obj; state.point = point; state.normal = normal;
    if (helper) { scene.remove(helper); helper.geometry.dispose(); helper = null; }
    if (obj) {
      helper = new THREE.BoxHelper(obj, 0xffcc00);
      helper.material.depthTest = false; helper.renderOrder = 998;
      scene.add(helper);
    }
    renderSel();
  }

  function pathOf(o) {
    const names = [];
    for (let p = o; p && p !== scene; p = p.parent) {
      if (p.name) names.unshift(p.name);
      else if (p === o) names.unshift(p.isMesh ? 'mesh' : p.type.toLowerCase());
    }
    return names;
  }
  function describe(o) {
    const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const path = pathOf(o);
    const mat = o.isMesh ? (Array.isArray(o.material) ? o.material[0] : o.material) : null;
    let label = null;
    for (let p = o; p; p = p.parent) if (p.userData?.label) { label = p.userData.label; break; }
    return {
      label,
      name: o.name || null,
      path: path.join(' / '),
      room: path[0] ?? null,
      kind: o.isMesh ? 'mesh' : 'group',
      sizeMeters: size.toArray().map((v) => +v.toFixed(3)),
      material: mat ? { type: mat.type, color: mat.color ? '#' + mat.color.getHexString() : null } : null,
    };
  }
  function renderSel() {
    const el = $('fb-sel');
    if (!state.selected) { el.textContent = 'Nothing selected yet.'; return; }
    const d = describe(state.selected);
    const p = state.point?.map((v) => v.toFixed(2)).join(', ');
    el.innerHTML = `${d.label ? `<b>${escapeHtml(d.label)}</b><br>` : ''}<span style="color:#ffcc33">${d.path || d.kind}</span><br>size ${d.sizeMeters.join(' × ')} m` +
      (p ? `<br>clicked at (${p})` : '');
  }
  function renderList() {
    $('fb-count').textContent = state.notes.length ? `(${state.notes.length})` : '';
    $('fb-list').innerHTML = state.notes.map((n) => `
      <div class="note"><span><b>#${n.n}</b> · ${TYPES.find((t) => t[0] === n.type)[1]}</span>
      <span class="t">${n.target?.path ?? ''}</span><span>${escapeHtml(n.comment)}</span>
      <button data-del="${n.id}">delete</button></div>`).join('');
    $('fb-list').querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => { state.notes = state.notes.filter((n) => n.id !== b.dataset.del); persist(); rebuildPins(); renderList(); };
    });
  }

  // ---------- hover label ----------
  const tip = document.createElement('div');
  tip.style.cssText = 'position:fixed;z-index:40;pointer-events:none;background:rgba(0,0,0,.78);color:#fff;font:12px system-ui;padding:3px 8px;border-radius:5px;display:none;max-width:320px';
  document.body.appendChild(tip);
  let lastHover = 0;
  function hover(ev) {
    const now = performance.now();
    if (now - lastHover < 60) return;
    lastHover = now;
    const hit = hitAt(ev);
    if (!hit) { tip.style.display = 'none'; return; }
    const d = describe(hit.object);
    tip.textContent = d.label ? `${d.label} · ${d.name ?? 'part'}` : d.path;
    tip.style.left = ev.clientX + 14 + 'px'; tip.style.top = ev.clientY + 14 + 'px'; tip.style.display = 'block';
  }
  function hitAt(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(roots, true).find((h) => {
      for (let o = h.object; o; o = o.parent) if (!o.visible) return false;
      return true;
    });
  }

  // ---------- picking ----------
  function pick(ev) {
    const h = hitAt(ev);
    if (!h) return;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    select(h.object, h.point.toArray(), n.toArray());
  }
  let down = null, looking = false;
  const cv = renderer.domElement;
  cv.addEventListener('contextmenu', (e) => { if (state.edit) e.preventDefault(); });
  cv.addEventListener('pointerdown', (e) => {
    if (!state.edit) return;
    if (e.button === 2) { looking = true; cv.setPointerCapture(e.pointerId); } else down = [e.clientX, e.clientY];
  });
  cv.addEventListener('pointermove', (e) => {
    if (state.edit && !looking) hover(e);
    if (!looking) return;
    camera.rotation.y -= e.movementX * 0.0025;
    camera.rotation.x = Math.max(-1.45, Math.min(1.45, camera.rotation.x - e.movementY * 0.0025));
  });
  cv.addEventListener('pointerup', (e) => {
    if (e.button === 2) { looking = false; return; }
    if (state.edit && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) pick(e);
    down = null;
  });

  // ---------- notes ----------
  function shot() {
    if (window.__ao?.enabled) window.__ao.composer.render(); else renderer.render(scene, camera);
    const src = renderer.domElement;
    const w = Math.min(1280, src.width), h = Math.round((src.height * w) / src.width);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.82);
  }
  function addNote() {
    const text = $('fb-text').value.trim();
    if (!text) { $('fb-status').textContent = 'Write a comment first.'; return; }
    if (!state.selected) { $('fb-status').textContent = 'Click something in the scene first.'; return; }
    const note = {
      id: Math.random().toString(36).slice(2, 10),
      n: (state.notes.at(-1)?.n ?? 0) + 1,
      type: $('fb-type').value,
      comment: text,
      createdAt: new Date().toISOString(),
      target: describe(state.selected),
      point: state.point,
      normal: state.normal,
      camera: {
        position: camera.position.toArray().map((v) => +v.toFixed(3)),
        yaw: +camera.rotation.y.toFixed(3), pitch: +camera.rotation.x.toFixed(3), fov: camera.fov,
      },
      screenshot: shot(),
    };
    state.notes.push(note);
    persist(); rebuildPins(); renderList();
    $('fb-text').value = ''; $('fb-status').textContent = `Added note #${note.n}.`;
  }
  async function save() {
    if (!state.notes.length) { $('fb-status').textContent = 'No notes to save.'; return; }
    $('fb-status').textContent = 'Saving…';
    try {
      const res = await fetch('/__feedback', {
        method: 'POST',
        body: JSON.stringify({ project: 'apartment', savedAt: new Date().toISOString(), units: 'metres; x=east, y=up, z=south', notes: state.notes }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      state.notes = []; persist(); rebuildPins(); renderList(); select(null);
      $('fb-status').textContent = `Saved ${j.count} note(s) → ${j.file}`;
    } catch (e) {
      $('fb-status').textContent = 'Save failed: ' + e.message + ' (notes are kept; is the dev server running?)';
    }
  }

  // ---------- mode ----------
  function toggle(force) {
    state.edit = force ?? !state.edit;
    panel.style.display = state.edit ? 'flex' : 'none';
    pins.visible = state.edit;
    if (!state.edit) tip.style.display = 'none';
    btn.classList.toggle('on', state.edit);
    document.getElementById('dot').style.display = state.edit ? 'none' : '';
    cv.style.cursor = state.edit ? 'crosshair' : '';
    if (state.edit) onEnter?.(); else { select(null); onExit?.(); }
  }
  btn.onclick = () => toggle();
  $('fb-add').onclick = addNote;
  $('fb-save').onclick = save;
  $('fb-clear').onclick = () => select(null);
  $('fb-parent').onclick = () => {
    const p = state.selected?.parent;
    if (p && p !== scene && !roots.includes(state.selected)) select(p);
  };
  $('fb-text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); });

  const typing = (e) => ['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target?.tagName);
  addEventListener('keydown', (e) => { if (!typing(e) && e.code === 'KeyF' && !e.repeat) toggle(); });

  rebuildPins(); renderList();
  return { state, toggle, isTyping: typing, update() { if (helper) helper.update(); } };
}

function escapeHtml(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function load() { try { return JSON.parse(localStorage.getItem(STORE)) ?? []; } catch { return []; } }
