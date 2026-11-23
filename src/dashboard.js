/**
 * Smart Home Command Center UI. Pure view over three things that already exist:
 *   devices  - src/devices.js (reads/writes the 3D objects' own state)
 *   cameras  - src/cameras.js (virtual cameras rendered from the same scene)
 *   layout   - src/layout.js  (the object registry: `movables`, with `visible` = "added to the apartment")
 * It owns no device or inventory state of its own.
 */
import './ui/dashboard.css';
import { glassShow, glassHide } from './ui/glass.js';
import { ROOM_LABEL, ROOM_ORDER, roomAt } from './devices.js';
import pkg from '../package.json';
import * as THREE from 'three';

const I = {
  home: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  rooms: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  box: 'm7.5 4.27 9 5.15 M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z m3.3 7 8.7 5 8.7-5 M12 22V12',
  therm: 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z',
  code: 'm16 18 6-6-6-6 m8 6-6 6 6 6',
  bulb: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5 M9 18h6 M10 22h4',
  fan: 'M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z M12 12v.01',
  door: 'M13 4h3a2 2 0 0 1 2 2v14 M2 20h3 M13 20h9 M10 12v.01 M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z',
  laptop: 'M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16',
  drops: 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97',
  plug: 'M12 22v-5 M9 8V2 M15 8V2 M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z',
  flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  snow: 'M2 12h20 M12 2v20 m20 16-4-4 4-4 M4 8l4 4-4 4 M16 4l-4 4-4-4 M8 20l4-4 4 4',
  blinds: 'M3 3h18 M20 7H8 M20 11H8 M10 19h10 M8 15h12 M4 3v14',
  window: 'M3 3h18v18H3z M12 3v18 M3 12h18',
  valve: 'M12 3v6 M8 3h8 M4 14h16 M7 11h10v6H7z M4 14v0',
  archive: 'M21 8v13H3V8 M1 3h22v5H1z M10 12h4',
  toilet: 'M7 12h10a0 0 0 0 1 0 0 5 5 0 0 1-5 5 5 5 0 0 1-5-5 M8 12V4h8v8 M9 21h6 M12 17v4',
  sofa: 'M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3 M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z M5 18v2 M19 18v2',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 m4.93 4.93 1.41 1.41 m17.66 17.66 1.41 1.41 M2 12h2 M20 12h2',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
  expand: 'M8 3H5a2 2 0 0 0-2 2v3 M21 8V5a2 2 0 0 0-2-2h-3 M3 16v3a2 2 0 0 0 2 2h3 M16 21h3a2 2 0 0 0 2-2v-3',
  search: 'm21 21-4.34-4.34 M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6',
  x: 'M18 6 6 18 M6 6l12 12', plus: 'M5 12h14 M12 5v14', minus: 'M5 12h14',
  power: 'M12 2v10 M18.4 6.6a9 9 0 1 1-12.77.04', clock: 'M12 6v6l4 2 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
};
export const svg = (n, cls = '') => `<svg class="cc-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${(I[n] ?? I.box).split(' M').map((d, i) => `<path d="${i ? 'M' : ''}${d}"/>`).join('')}</svg>`;
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CATS = [
  ['Bathroom fixtures', /toilet|bath|vanity|shower|mirror|plug|towel/i],
  ['Kitchen appliances', /stove|fridge|oven|counter|microwave|kettle|toaster/i],
  ['Electronics', /monitor|laptop|phone|tv|speaker|\bac\b|fan|heater|clock|switch|strip|outlet|socket|light|lamp/i],
  ['Furniture', /bed|sofa|chair|table|dresser|bookshelf|shelf|desk|closet|radiator|cabinet|bin|nightstand/i],
  ['Personal belongings', /diary|suitcase|rug|curtain|book|bag|clothes|towel/i],
];
export const catOf = (o) => { const t = o.name + ' ' + (o.userData.label ?? ''); return CATS.find(([, re]) => re.test(t))?.[0] ?? 'Other assets'; };
export const CAT_ICON = { 'Bathroom fixtures': 'drops', 'Kitchen appliances': 'flame', Electronics: 'laptop', Furniture: 'sofa', 'Personal belongings': 'box', 'Other assets': 'box' };
const POWERISH = ['power_toggle', 'fan_speed', 'water_flow', 'connection'];

const TINT = { teal: ['#2f8591', 'tint-teal'], coral: ['#cf4b4b', 'tint-coral'], salmon: ['#c76b57', 'tint-salmon'], sage: ['#2d8a64', 'tint-sage'] };
export const CAT_COLOR = { lighting: '#d98a3d', climate: '#cf4b4b', plumbing: '#2f8591', openings: '#5a6fa8', electronics: '#5a6fa8', furniture: '#c0794a', 'Kitchen appliances': '#cf4b4b', 'Bathroom fixtures': '#2f8591', Electronics: '#5a6fa8', Furniture: '#c0794a', 'Personal belongings': '#7d62b0', 'Other assets': '#6b7280' };

export function initDashboard({ devices, cameras, layout, renderer, scene, weatherInfo, clock, hooks }) {
  const $ = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
  const root = $(`<div id="cc" class="g-scrim" role="dialog" aria-label="Smart Home Command Center"></div>`);
  const app = $(`<div class="cc-app"></div>`);
  root.append(app); document.body.append(root);
  const openBtn = $(`<button id="cc-open" class="g-glass g-pill" title="Open the Command Center (Tab)">${svg('home')}<span>Command Center</span><kbd>Tab</kbd></button>`);
  document.body.append(openBtn);

  const PAGES = [['overview', 'Home', 'home'], ['cameras', 'Cameras', 'camera'], ['rooms', 'Rooms', 'rooms'], ['inventory', 'My Inventory', 'box'], ['environment', 'Environment', 'therm']];
  let page = 'overview', roomSel = 'all', invCat = 'all', camIdx = 0, query = '', big = null, binds = [], lastSnap = '', lastEnv = '', lastInv = '', toastT = 0;
  const api = { open: false, hooks: hooks ?? {} };
  const q = () => query.trim().toLowerCase();
  const hit = (s) => !q() || String(s).toLowerCase().includes(q());

  // ---------- frame: top bar, nav panel, content ----------
  const top = $(`<header class="cc-panel cc-top"><div class="cc-brand">${svg('home', 'lg')}<div><b>Command Center</b><span>277 Park Ave #11</span></div></div><label class="cc-search">${svg('search')}<input type="search" placeholder="Search devices and assets" aria-label="Search devices and assets"></label><span class="cc-grow"></span><span class="cc-chip" id="cc-wx"></span><span class="cc-chip" id="cc-time"></span></header>`);
  const nav = $(`<nav class="cc-panel cc-nav" aria-label="Sections"></nav>`);
  for (const [id, label, icon] of PAGES) { const b = $(`<button class="cc-tab" data-page="${id}">${svg(icon)}<span class="lbl">${label}</span></button>`); b.onclick = () => go(id); nav.append(b); }
  const main = $(`<main class="cc-main"></main>`);
  const closePill = $(`<button class="cc-closepill g-glass g-pill" aria-label="Close the Command Center">Close ${svg('x')}<kbd>Esc</kbd></button>`);
  app.append(top, nav, main); root.append(closePill);
  const search = top.querySelector('input'), wx = top.querySelector('#cc-wx'), timeChip = top.querySelector('#cc-time');
  search.oninput = () => { query = search.value; render(); };
  search.onkeydown = (e) => e.stopPropagation();
  closePill.onclick = () => close(true);
  const toast = (t) => { let el = app.querySelector('.cc-toast'); if (!el) { el = $('<div class="cc-toast cc-chip"></div>'); app.append(el); } el.textContent = t; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { el.style.display = 'none'; }, 2600); };
  const panel = (title, ...kids) => { const p = $(`<section class="cc-panel cc-box"><div class="cc-ph"><h2>${title}</h2><span class="cc-grow"></span><span class="cc-actions"></span></div><div class="cc-pb"></div></section>`); p.querySelector('.cc-pb').append(...kids); return p; };
  const pills = (items, cur, set) => { const w = $(`<div class="cc-pills" role="tablist"></div>`); for (const [id, label] of items) { const b = $(`<button role="tab" class="${id === cur ? 'on' : ''}">${esc(label)}</button>`); b.onclick = () => { set(id); render(); }; w.append(b); } return w; };

  // ---------- activity log (derived from real device state changes) ----------
  const log = []; const prev = new Map(); let logReady = false;
  function logTick() {
    for (const d of devices.devices) {
      let t; try { const s = d.state(); t = d.controls.map((c) => c.text(s)).join(' · '); } catch { continue; }
      const was = prev.get(d.id); prev.set(d.id, t);
      if (logReady && was !== undefined && was !== t) log.unshift({ at: new Date(), text: `${d.name}: ${t.toLowerCase()}`, on: d.controls.some((c) => c.on?.(d.state())) });
    }
    logReady = true; if (log.length > 40) log.length = 40;
  }
  logTick(); setInterval(logTick, 700);

  // ---------- cards ----------
  const icTile = (icon, color) => `<span class="cc-ic" style="--ic:${color}">${svg(icon)}</span>`;
  function deviceCard(d) {
    const c0 = d.controls[0];
    const el = $(`<div class="cc-card cc-dev" data-dev="${d.id}">${icTile(d.icon, CAT_COLOR[d.category] ?? '#5a6fa8')}<div class="cc-dtxt"><div class="nm" tabindex="0" role="button" aria-label="Details for ${esc(d.name)}">${esc(d.name)}</div><div class="st"><i></i><span></span></div></div><span class="ctl"></span></div>`);
    const ctl = el.querySelector('.ctl'), st = el.querySelector('.st span'), sw = [];
    d.controls.forEach((c, i) => {
      const b = c.kind === 'toggle' ? $(`<button class="cc-sw" role="switch" aria-label="${esc(d.name + ' ' + c.label)}"></button>`) : $(`<button class="cc-btn">${esc(c.label)}${c.kind === 'step' ? ' ›' : ''}</button>`);
      b.onclick = () => { const err = devices.run(d.id, i); if (err) { toast(err === 'sealed' ? 'This door is sealed' : err); el.classList.add('err'); setTimeout(() => el.classList.remove('err'), 320); } refresh(true); };
      ctl.append(b); sw.push(b);
    });
    const showDet = () => { let x = el.querySelector('.det'); if (!x) { x = $('<div class="det"></div>'); el.append(x); } else { x.remove(); return; } x.innerHTML = `${esc(d.category)} · ${d.capabilities.map(esc).join(', ') || 'no controls'}`; };
    el.querySelector('.nm').onclick = showDet; el.querySelector('.nm').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDet(); } };
    binds.push(() => {
      const s = d.state(); el.classList.toggle('on', !!c0.on?.(s));
      const text = d.controls.map((c) => c.text(s)).join(' · '); if (st.textContent !== text) st.textContent = text;
      d.controls.forEach((c, i) => { if (c.kind === 'toggle') sw[i].setAttribute('aria-pressed', c.on(s) ? 'true' : 'false'); });
    });
    return el;
  }
  const roomDevices = (r) => devices.active().filter((d) => d.room === r && hit(d.name + ' ' + ROOM_LABEL[r]));
  const feedEls = [];
  function feedCard(f, mini = false) {
    const el = $(`<div class="cc-card cc-feed${mini ? ' mini' : ''}"><div class="view"><canvas></canvas><span class="badge">${f.kind === 'simulated' ? 'Simulated 3D view' : 'Live hardware'}</span><div class="off">Camera off</div></div><div class="meta"><div class="g-grow"><b>${esc(f.name)}</b><span>${esc(f.room)}</span></div><span class="cc-tag"></span><button class="cc-btn ico" aria-label="Turn ${esc(f.name)} on or off">${svg('power')}</button>${mini ? '' : `<button class="cc-btn ico" aria-label="Expand ${esc(f.name)}">${svg('expand')}</button>`}</div></div>`);
    const cv = el.querySelector('canvas'), off = el.querySelector('.off'), tag = el.querySelector('.cc-tag'); const [pw, ex] = el.querySelectorAll('button');
    feedEls.push({ feed: f, canvas: cv, size: 'small', el });
    pw.onclick = () => { cameras.setActive(f.id, !f.active); refresh(true); };
    if (ex) ex.onclick = () => openBig(f);
    el.querySelector('.view').onclick = () => { if (!mini) openBig(f); };
    binds.push(() => { off.style.display = f.active ? 'none' : 'grid'; tag.textContent = f.active ? 'Active' : 'Inactive'; tag.classList.toggle('on', f.active); });
    return el;
  }
  function openBig(f) {
    big?.remove(); feedEls.splice(0, feedEls.length, ...feedEls.filter((x) => x.size !== 'big'));
    const el = $(`<div class="cc-big cc-panel"><div class="cc-ph"><h2>${esc(f.name)}</h2><span class="cc-note">Simulated 3D view, not hardware footage</span><span class="cc-grow"></span><span class="cc-pills"></span><button class="cc-btn ico" aria-label="Close expanded view">${svg('x')}</button></div><div class="view"><canvas></canvas></div></div>`);
    const seg = el.querySelector('.cc-pills'); const cv = el.querySelector('canvas'), entry = { feed: f, canvas: cv, size: 'big', el }; feedEls.push(entry);
    for (const ff of cameras.feeds) { const b = $(`<button class="${ff === f ? 'on' : ''}">${esc(ff.room)}</button>`); b.onclick = () => { entry.feed = ff; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); el.querySelector('h2').textContent = ff.name; }; seg.append(b); }
    el.querySelector('button[aria-label]').onclick = () => { el.remove(); big = null; feedEls.splice(0, feedEls.length, ...feedEls.filter((x) => x !== entry)); };
    app.append(el); big = el;
  }

  function envData() {
    const w = weatherInfo();
    return [
      ['Outdoor temperature', w.live ? `${Math.round((w.tempF - 32) * 5 / 9)}°C <small>${Math.round(w.tempF)}°F</small>` : '<em>Unavailable</em>', w.live ? 'Live weather service' : 'Weather service not connected', 'therm', 'teal'],
      ['Indoor temperature', '<em>Unavailable</em>', 'No indoor sensor is connected', 'therm', 'salmon'],
      ['Weather', w.live ? esc(w.label) : '<em>Unavailable</em>', w.live ? 'Source: Open-Meteo' : 'Showing a default scene, not a measurement', 'cloud', 'coral'],
      ['Time', esc(w.clock), esc(w.zone) + (w.simulated ? ' (simulated time)' : ''), 'clock', 'sage'],
      ['Day or night', esc(w.phase), 'From the sun position at the apartment', w.day ? 'sun' : 'moon', 'teal'],
    ];
  }
  const statCard = (label, tint, icon, fn) => { const [col, cls] = TINT[tint]; const el = $(`<div class="cc-card cc-stat ${cls}">${icTile(icon, col)}<div><b></b><span>${label}</span></div></div>`); const b = el.querySelector('b'); binds.push(() => { const v = String(fn()); if (b.textContent !== v) b.textContent = v; }); return el; };

  // ---------- pages ----------
  function roomsPanel(wide) {
    const items = [['all', 'All'], ...ROOM_ORDER.map((r) => [r, ROOM_LABEL[r].split(' ')[0]])];
    const grid = $(`<div class="cc-grid${wide ? ' wide' : ''}"></div>`);
    for (const r of ROOM_ORDER.filter((x) => roomSel === 'all' || x === roomSel)) {
      const list = roomDevices(r); if (!list.length) continue;
      const head = $(`<div class="cc-gh">${svg('rooms')}<b>${ROOM_LABEL[r]}</b><span class="cc-tag"></span></div>`); const tag = head.querySelector('.cc-tag');
      binds.push(() => { const n = list.filter((d) => devices.isOn(d)).length, t = `${n} of ${list.length} on`; if (tag.textContent !== t) tag.textContent = t; });
      grid.append(head); list.forEach((d) => grid.append(deviceCard(d)));
    }
    if (!grid.children.length) grid.append($(`<p class="cc-empty">No devices match "${esc(query)}". Clear the search to see all devices.</p>`));
    const p = panel(wide ? 'Rooms' : 'Rooms and devices', grid); p.querySelector('.cc-actions').append(pills(items, roomSel, (v) => { roomSel = v; })); return p;
  }
  function overview() {
    const ds = devices.active(), powerish = ds.filter((d) => d.capabilities.some((c) => POWERISH.includes(c)));
    const stats = $(`<div class="cc-stats"></div>`);
    stats.append(statCard('Registered devices', 'teal', 'plug', () => ds.length), statCard('Powered on', 'coral', 'power', () => powerish.filter((d) => devices.isOn(d)).length),
      statCard('Doors open', 'salmon', 'door', () => ds.filter((d) => d.icon === 'door' && d.state().open).length), statCard('Active cameras', 'sage', 'camera', () => `${cameras.feeds.filter((f) => f.active).length} of ${cameras.feeds.length}`));
    const center = $(`<div class="cc-col"></div>`); center.append(stats, roomsPanel(false));

    // right column: ring gauge, one camera, activity log, developer info
    const R = 54, C = 2 * Math.PI * R;
    const ring = panel('Home status', $(`<div class="cc-ring"><svg viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="${R}" class="trk"/><circle cx="70" cy="70" r="${R}" class="val" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 70 70)"/></svg><div class="mid"><b></b><span>devices on</span></div></div>`), $(`<p class="cc-sub"></p>`));
    const rb = ring.querySelector('.mid b'), rv = ring.querySelector('.val'), rs = ring.querySelector('.cc-sub');
    binds.push(() => { const on = powerish.filter((d) => devices.isOn(d)).length, pct = powerish.length ? Math.round(100 * on / powerish.length) : 0; rb.textContent = pct + '%'; rv.setAttribute('stroke-dashoffset', C * (1 - pct / 100)); const e = devices.get('north_door')?.state(); const t = `${on} of ${powerish.length} powered devices on. ${e ? (e.open ? 'Entrance door is open.' : e.locked ? 'Entrance is locked.' : 'Entrance door is closed.') : ''}`; if (rs.textContent !== t) rs.textContent = t; });
    const cam = cameras.feeds[camIdx % cameras.feeds.length]; const camP = panel('Cameras', feedCard(cam, true));
    const nb = $(`<span class="cc-pills"><button class="on" aria-label="Previous camera">${svg('left')}</button><button class="on" aria-label="Next camera">${svg('right')}</button></span>`); nb.children[0].onclick = () => { camIdx = (camIdx + cameras.feeds.length - 1) % cameras.feeds.length; render(); }; nb.children[1].onclick = () => { camIdx = (camIdx + 1) % cameras.feeds.length; render(); }; camP.querySelector('.cc-actions').append(nb);
    const list = $(`<ol class="cc-log"></ol>`); const logP = panel('Activity', list); let lastLog = -1;
    binds.push(() => { const k = log.length + '|' + (log[0]?.at.getTime() ?? 0); if (k === lastLog) return; lastLog = k; list.innerHTML = log.length ? log.slice(0, 12).map((l) => `<li class="${l.on ? 'on' : ''}"><i></i><div><b>${esc(l.text)}</b><span>${l.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span></div></li>`).join('') : '<li class="none">Changes to lights, doors and appliances will appear here.</li>'; });
    const dev = $(`<details class="cc-panel cc-dev-info"><summary>Developer info</summary><div class="cc-kv"></div></details>`); const kv = dev.querySelector('.cc-kv'); let dt = 0;
    binds.push(() => { if (!dev.open || performance.now() - dt < 500) return; dt = performance.now(); kv.innerHTML = devInfo().map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join(''); });
    const side = $(`<div class="cc-col side"></div>`); side.append(ring, camP, logP, dev);
    return [center, side];
  }
  function devInfo() {
    const info = renderer.info; let meshes = 0; scene.traverse((o) => { if (o.isMesh) meshes++; });
    return [['Application', pkg.name], ['Developer', 'Personal project, built with Claude Code'], ['Version', pkg.version], ['Three.js', 'r' + THREE.REVISION],
      ['Scene', `Loaded, ${layout.movables.length} registered objects, ${meshes} meshes`], ['Rendering', `${renderer.getContext() ? 'WebGL active' : 'no context'}, ${clock.fps()} fps, ${info.render.calls} draw calls`],
      ['Active devices', devices.devices.filter((d) => devices.isOn(d)).length + ' of ' + devices.devices.length], ['Cameras', `${cameras.feeds.filter((f) => f.active).length} of ${cameras.feeds.length} active, all simulated`]];
  }
  function camerasPage() {
    const g = $(`<div class="cc-grid feeds"></div>`); cameras.feeds.filter((f) => hit(f.name + ' ' + f.room)).forEach((f) => g.append(feedCard(f)));
    return [panel('Cameras', $(`<p class="cc-sub">These are simulated views of the 3D model of your apartment, rendered by virtual cameras. They are not hardware footage. Select a feed to expand it. Your first-person view is not affected.</p>`), g)];
  }
  const invObjs = () => layout.movables.filter((o) => !/^(wall|rocker|switch)/.test(o.name));
  function inventoryPage() {
    const all = invObjs(), added = all.filter((o) => o.visible).length;
    const stats = $(`<div class="cc-stats three"></div>`); stats.append(
      Object.assign($(`<div class="cc-card cc-stat tint-teal">${icTile('box', '#2f8591')}<div><b>${all.length}</b><span>Registered assets</span></div></div>`)),
      $(`<div class="cc-card cc-stat tint-sage">${icTile('home', '#2d8a64')}<div><b>${added}</b><span>Added to the apartment</span></div></div>`),
      $(`<div class="cc-card cc-stat tint-salmon">${icTile('plus', '#c76b57')}<div><b>${all.length - added}</b><span>Available, not added</span></div></div>`));
    const cats = {}; all.forEach((o) => { cats[catOf(o)] = (cats[catOf(o)] ?? 0) + 1; });
    const objs = all.filter((o) => (invCat === 'all' || catOf(o) === invCat) && hit((o.userData.label ?? o.name) + ' ' + catOf(o)));
    const grid = $(`<div class="cc-grid tiles"></div>`); const V = new THREE.Vector3();
    for (const o of objs.sort((a, b) => catOf(a).localeCompare(catOf(b)) || a.name.localeCompare(b.name))) {
      o.getWorldPosition(V); const dv = devices.devices.find((d) => d.object === o || (d.object && o.getObjectById(d.object.id)));
      const st = dv ? dv.controls.map((c) => c.text(dv.state())).join(' · ').toLowerCase() : 'in place'; const cat = catOf(o);
      const t = $(`<div class="cc-card cc-tile ${o.visible ? '' : 'gone'}">${icTile(CAT_ICON[cat], CAT_COLOR[cat])}<div class="cc-dtxt"><div class="nm static">${esc((o.userData.label ?? o.name).replace(/ - .*$/, ''))}</div><div class="st2">${esc(cat)}<br>${o.visible ? esc(ROOM_LABEL[roomAt(V.x, V.z)]) + ', ' + esc(st) : 'Not in the apartment'}</div></div><div class="foot"><span class="cc-tag ${o.visible ? 'on' : ''}">${o.visible ? 'Added' : 'Available'}</span><button class="cc-btn ${o.visible ? '' : 'go'}" aria-label="${o.visible ? 'Remove' : 'Add'} ${esc(o.name)}">${svg(o.visible ? 'minus' : 'plus')}${o.visible ? 'Remove' : 'Add'}</button></div></div>`);
      t.querySelector('button').onclick = () => { layout.setVisible(o, !o.visible); layout.save?.(); toast(`${o.userData.label?.split(' - ')[0] ?? o.name} ${o.visible ? 'added to' : 'removed from'} the apartment. The model is kept.`); render(); };
      grid.append(t);
    }
    if (!objs.length) grid.append($(`<p class="cc-empty">No assets match. Clear the search or pick another category.</p>`));
    const p = panel('My Inventory', stats, $(`<p class="cc-sub">Removing an asset only takes it out of the apartment: it stops being drawn and no longer blocks you. Its model and position are kept, so you can add it back at any time. Nothing is deleted.</p>`), grid);
    p.querySelector('.cc-actions').append(pills([['all', 'All'], ...Object.entries(cats).map(([k, v]) => [k, `${k} ${v}`])], invCat, (v) => { invCat = v; })); return [p];
  }
  function environmentPage() {
    const g = $(`<div class="cc-grid env" id="cc-env"></div>`);
    return [panel('Environment', g, $(`<p class="cc-sub">Values marked Unavailable have no connected source. Nothing here is estimated.</p>`))];
  }

  // ---------- render / refresh ----------
  function render() {
    binds = []; feedEls.splice(0, feedEls.length, ...feedEls.filter((x) => x.size === 'big'));
    nav.querySelectorAll('.cc-tab').forEach((b) => { if (b.dataset.page === page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const parts = { overview, cameras: camerasPage, rooms: () => [roomsPanel(true)], inventory: inventoryPage, environment: environmentPage }[page]();
    main.className = 'cc-main' + (page === 'overview' ? ' two' : ''); main.replaceChildren(...parts); lastEnv = ''; refresh(true);
  }
  function refresh() {
    for (const b of binds) b();
    const w = envData(), e = JSON.stringify(w);
    if (e !== lastEnv) { lastEnv = e; const t = main.querySelector('#cc-env'); if (t) t.innerHTML = w.map(([k, v, n, ic, tint]) => `<div class="cc-card cc-stat ${TINT[tint][1]}">${icTile(ic, TINT[tint][0])}<div><b>${v}</b><span>${k}<br><small>${n}</small></span></div></div>`).join(''); }
    const wi = weatherInfo(); timeChip.textContent = wi.clock; wx.innerHTML = `${svg(wi.day ? 'sun' : 'moon')} ${wi.live ? Math.round((wi.tempF - 32) * 5 / 9) + '°C, ' + esc(wi.label) : 'Weather unavailable'}`;
    if (page === 'inventory') { const k = invObjs().map((o) => +o.visible).join(''); const changed = lastInv && k !== lastInv; lastInv = k; if (changed) render(); }
  }
  function go(p) { page = p; big?.remove(); big = null; lastInv = ''; render(); }
  let poll = 0;
  function open() { if (api.open) return; api.open = true; api.hooks.onOpen?.(); glassShow(root, 'grid'); closePill.style.display = 'flex'; render(); poll = setInterval(refresh, 250); }
  function close(relock) { if (!api.open) return; api.open = false; clearInterval(poll); big?.remove(); big = null; feedEls.length = 0; glassHide(root); closePill.style.display = 'none'; api.hooks.onClose?.(relock); }
  closePill.style.display = 'none';
  openBtn.onclick = open;
  root.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === root) close(false); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab' && !e.repeat) { if (document.activeElement === search) return; e.preventDefault(); api.open ? close(true) : open(); }
    else if (e.code === 'Escape' && api.open) { if (big) { big.remove(); big = null; feedEls.splice(0, feedEls.length, ...feedEls.filter((x) => x.size !== 'big')); } else if (query) { query = ''; search.value = ''; render(); } else close(false); }
  });
  api.close = close; api.openDash = open; api.openBtn = openBtn;
  /** Called every frame by the main loop. */
  api.frame = () => { if (!api.open) return; cameras.tick(feedEls.filter((f) => f.canvas.isConnected)); };
  return api;
}
