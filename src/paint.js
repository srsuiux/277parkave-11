/**
 * Colour editing for any object: look at it and press X -> a small modal with one colour per part
 * (colour picker + swatches). "Save" writes the colours into layout.json together with the positions.
 * An object opts in with paintable(obj, [{ label, mats: [material, ...] }]).
 */
export const paintUI = { open: false, hooks: {}, save: null };

const SWATCHES = ['#f4f1ea', '#d9c7a3', '#9c6b43', '#6b3f26', '#3d2a1e', '#c0392b', '#e08a3c', '#e0c040', '#5a8f5a', '#4b8fc7', '#3f4f8a', '#8a5aa8', '#e0a0b0', '#8a8d92', '#2b2d31'];

export function paintable(obj, parts) {
  const def = parts.map((p) => p.mats.map((m) => m.color.clone()));
  const get = () => Object.fromEntries(parts.map((p) => [p.label, '#' + p.mats[0].color.getHexString()]));
  const set = (v) => parts.forEach((p) => { if (v?.[p.label]) p.mats.forEach((m) => m.color.set(v[p.label])); });
  const reset = () => parts.forEach((p, i) => p.mats.forEach((m, j) => m.color.copy(def[i][j])));
  obj.userData.paint = { parts, get, set, reset };
  const prev = obj.userData.interact;
  obj.userData.interact = {
    ...prev,
    prompt: () => (prev ? prev.prompt() + ' &nbsp; ' : '') + '<kbd>X</kbd> colours',
    run: prev?.run ?? (() => {}),
    keys: { ...prev?.keys, KeyX: () => openPaint(obj) },
  };
  return obj;
}

let panel = null, body = null, titleEl = null, statusEl = null, current = null, snapshot = null;
const css = (el, t) => { el.style.cssText = t; return el; };
const BTN = 'padding:7px 14px;border:1px solid #555;border-radius:7px;background:#2a2a2e;color:#fff;cursor:pointer;font:13px system-ui';

function build() {
  panel = css(document.createElement('div'), 'position:fixed;inset:0;display:none;place-items:center;background:rgba(0,0,0,.45);z-index:60;font:13px/1.5 system-ui;color:#eee');
  panel.innerHTML = `<div style="width:380px;max-height:80vh;overflow:auto;background:#17181c;border:1px solid #3a3b42;border-radius:12px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.6)">
    <div id="pt-title" style="font-size:15px;font-weight:600;margin-bottom:2px"></div>
    <div style="color:#8a8d95;margin-bottom:10px">Pick a colour for each part. Changes show live in the room.</div>
    <div id="pt-body" style="display:flex;flex-direction:column;gap:12px"></div>
    <div id="pt-status" style="min-height:18px;color:#8fd19e;margin-top:10px"></div>
    <div style="display:flex;gap:8px;margin-top:6px"><button id="pt-save" style="${BTN};background:#1f6feb;border-color:#1f6feb">Save</button><button id="pt-reset" style="${BTN}">Reset to default</button><button id="pt-cancel" style="${BTN}">Cancel</button></div></div>`;
  document.body.appendChild(panel);
  body = panel.querySelector('#pt-body'); titleEl = panel.querySelector('#pt-title'); statusEl = panel.querySelector('#pt-status');
  panel.querySelector('#pt-save').onclick = async () => {
    statusEl.textContent = 'Saving…';
    let msg = 'Saved';
    try { if (paintUI.save) await paintUI.save(); } catch { msg = 'Saved in this browser only'; }
    statusEl.textContent = msg; setTimeout(() => close(), 450);
  };
  panel.querySelector('#pt-reset').onclick = () => { current.userData.paint.reset(); render(); };
  panel.querySelector('#pt-cancel').onclick = () => { current.userData.paint.set(snapshot); close(); };
  panel.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Escape') panel.querySelector('#pt-cancel').click(); });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
}

function render() {
  body.innerHTML = '';
  const cur = current.userData.paint.get();
  for (const p of current.userData.paint.parts) {
    const row = css(document.createElement('div'), 'display:flex;flex-direction:column;gap:6px');
    const head = css(document.createElement('div'), 'display:flex;align-items:center;justify-content:space-between');
    const lab = document.createElement('span'); lab.textContent = p.label; lab.style.fontWeight = '600';
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = cur[p.label]; inp.style.cssText = 'width:54px;height:28px;border:none;background:none;cursor:pointer';
    inp.oninput = () => current.userData.paint.set({ [p.label]: inp.value });
    head.append(lab, inp); row.append(head);
    const sw = css(document.createElement('div'), 'display:flex;flex-wrap:wrap;gap:5px');
    for (const c of SWATCHES) {
      const b = css(document.createElement('button'), `width:22px;height:22px;border-radius:50%;border:2px solid #555;background:${c};cursor:pointer;padding:0`);
      b.onclick = () => { inp.value = c; current.userData.paint.set({ [p.label]: c }); };
      sw.append(b);
    }
    row.append(sw); body.append(row);
  }
}

export function openPaint(obj) {
  if (paintUI.open || !obj.userData.paint) return;
  if (!panel) build();
  current = obj; snapshot = obj.userData.paint.get();
  titleEl.textContent = 'Colours: ' + (obj.userData.label ?? obj.name).replace(/ \(.*/, '').replace(/ - .*/, '');
  statusEl.textContent = ''; render();
  panel.style.display = 'grid'; paintUI.open = true; paintUI.hooks.onOpen?.();
}
function close() { panel.style.display = 'none'; paintUI.open = false; current = null; paintUI.hooks.onClose?.(true); }
