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
  x: 'M18 6 6 18 M6 6l12 12', plus: 'M5 12h14 M12 5v14', minus: 'M5 12h14',
  power: 'M12 2v10 M18.4 6.6a9 9 0 1 1-12.77.04', clock: 'M12 6v6l4 2 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
};
const svg = (n, cls = '') => `<svg class="cc-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${(I[n] ?? I.box).split(' M').map((d, i) => `<path d="${i ? 'M' : ''}${d}"/>`).join('')}</svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CATS = [
  ['Bathroom fixtures', /toilet|bath|vanity|shower|mirror|plug|towel/i],
  ['Kitchen appliances', /stove|fridge|oven|counter|microwave|kettle|toaster/i],
  ['Electronics', /monitor|laptop|phone|tv|speaker|\bac\b|fan|heater|clock|switch|strip|outlet|socket|light|lamp/i],
  ['Furniture', /bed|sofa|chair|table|dresser|bookshelf|shelf|desk|closet|radiator|cabinet|bin|nightstand/i],
  ['Personal belongings', /diary|suitcase|rug|curtain|book|bag|clothes|towel/i],
];
const catOf = (o) => { const t = o.name + ' ' + (o.userData.label ?? ''); return CATS.find(([, re]) => re.test(t))?.[0] ?? 'Other assets'; };
const CAT_ICON = { 'Bathroom fixtures': 'drops', 'Kitchen appliances': 'flame', Electronics: 'laptop', Furniture: 'sofa', 'Personal belongings': 'box', 'Other assets': 'box' };
const POWERISH = ['power_toggle', 'fan_speed', 'water_flow', 'connection'];

export function initDashboard({ devices, cameras, layout, renderer, scene, weatherInfo, clock, hooks }) {
  const $ = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
  const root = $(`<div id="cc" class="g-scrim" role="dialog" aria-label="Smart Home Command Center"></div>`);
  const win = $(`<div class="g-glass g-strong cc-win"></div>`);
  root.append(win); document.body.append(root);
  const openBtn = $(`<button id="cc-open" class="g-glass g-pill" title="Open the Command Center (Tab)">${svg('home')}<span>Command Center</span><kbd>Tab</kbd></button>`);
  document.body.append(openBtn);

  const PAGES = [['overview', 'Overview', 'home'], ['cameras', 'Cameras', 'camera'], ['rooms', 'Rooms', 'rooms'], ['inventory', 'My Inventory', 'box'], ['environment', 'Environment', 'therm']];
  let page = 'overview', roomSel = ROOM_ORDER[0], big = null, binds = [], lastSnap = '', lastEnv = '', lastInv = '', toastT = 0;
  const api = { open: false, hooks: hooks ?? {} };

  const nav = $(`<nav class="cc-nav"><div class="cc-brand"><div class="cc-logo">${svg('home', 'lg')}</div><div class="g-head">277 Park Ave #11<div class="g-faint g-small" style="font-weight:400">Command Center</div></div></div></nav>`);
  for (const [id, label, icon] of PAGES) { const b = $(`<button class="cc-tab" data-page="${id}">${svg(icon)}<span class="lbl">${label}</span></button>`); b.onclick = () => go(id); nav.append(b); }
  nav.append($('<div class="cc-spacer"></div>'));
  const closeB = $(`<button class="cc-tab">${svg('x')}<span class="lbl">Close <kbd>Esc</kbd></span></button>`); closeB.onclick = () => close(true); nav.append(closeB);
  const main = $(`<main class="cc-main"><div class="cc-head"><h2 class="g-title" id="cc-title"></h2><span class="g-glass g-pill g-static" id="cc-time" style="padding:5px 14px"></span></div><div class="cc-body" id="cc-body"></div></main>`);
  win.append(nav, main);
  const body = main.querySelector('#cc-body'), title = main.querySelector('#cc-title'), timePill = main.querySelector('#cc-time');
  const toast = (t) => { let el = win.querySelector('.cc-toast'); if (!el) { el = $('<div class="g-glass g-pill cc-toast" style="position:absolute;left:50%;bottom:20px;transform:translateX(-50%);z-index:9"></div>'); win.append(el); } el.textContent = t; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { el.style.display = 'none'; }, 2600); };

  // ---------- device UI ----------
  const sdev = (d) => d.state();
  function deviceCard(d, { details = false } = {}) {
    const c0 = d.controls[0];
    const el = $(`<div class="cc-dev" data-dev="${d.id}"><div class="top">${svg(d.icon)}<div class="nm" tabindex="0" role="button" aria-label="Details for ${esc(d.name)}">${esc(d.name)}</div></div><div class="top"><div class="st"><i></i><span></span></div><span style="flex:1"></span><span class="ctl"></span></div>${details ? '<div class="det"></div>' : ''}</div>`);
    const ctl = el.querySelector('.ctl'), st = el.querySelector('.st span'), det = el.querySelector('.det');
    const sw = [];
    d.controls.forEach((c, i) => {
      let b;
      if (c.kind === 'toggle') { b = $(`<button class="cc-sw" role="switch" aria-label="${esc(d.name + ' ' + c.label)}"></button>`); }
      else if (c.kind === 'step') { b = $(`<button class="sm">${c.label} ›</button>`); }
      else { b = $(`<button class="sm">${esc(c.label)}</button>`); }
      b.onclick = () => { const err = devices.run(d.id, i); if (err) { toast(err === 'sealed' ? 'This door is sealed' : err); el.classList.add('err'); setTimeout(() => el.classList.remove('err'), 320); } refresh(true); };
      ctl.append(b); sw.push(b);
    });
    const toggleDet = () => { const x = el.querySelector('.det') ?? el.appendChild($('<div class="det"></div>')); x.hidden = !x.hidden; if (!x.hidden) fillDet(x); };
    const fillDet = (x) => { x.innerHTML = `${esc(d.category)} · ${d.capabilities.map(esc).join(', ') || 'no controls'}<br><code>${esc(JSON.stringify(sdev(d)))}</code>`; };
    el.querySelector('.nm').onclick = toggleDet; el.querySelector('.nm').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDet(); } };
    binds.push(() => {
      const s = sdev(d), on = c0.on?.(s) ?? false;
      el.classList.toggle('on', !!on);
      const text = d.controls.map((c) => c.text(s)).join(' · ');
      if (st.textContent !== text) st.textContent = text;
      d.controls.forEach((c, i) => { if (c.kind === 'toggle') sw[i].setAttribute('aria-pressed', c.on(s) ? 'true' : 'false'); });
      const x = el.querySelector('.det'); if (x && !x.hidden) fillDet(x);
    });
    return el;
  }
  const roomDevices = (r) => devices.active().filter((d) => d.room === r);

  // ---------- pages ----------
  const feedEls = []; // { feed, canvas, size }
  function feedCard(f, mini = false) {
    const el = $(`<div class="cc-feed${mini ? ' mini' : ''}"><div class="view"><canvas></canvas><span class="badge">${f.kind === 'simulated' ? 'SIMULATED 3D' : 'LIVE HARDWARE'}</span><div class="off">CAMERA OFF</div></div><div class="meta"><div class="g-grow"><b>${esc(f.name)}</b><span class="g-small g-sub">${esc(f.room)}</span></div><span class="cc-pill"></span><button class="sm" aria-label="Turn ${esc(f.name)} on or off">${svg('power')}</button>${mini ? '' : `<button class="sm" aria-label="Expand ${esc(f.name)}">${svg('expand')}</button>`}</div></div>`);
    const cv = el.querySelector('canvas'), off = el.querySelector('.off'), pill = el.querySelector('.cc-pill'); const [pw, ex] = el.querySelectorAll('button');
    feedEls.push({ feed: f, canvas: cv, size: 'small', el });
    pw.onclick = () => { cameras.setActive(f.id, !f.active); refresh(true); };
    if (ex) ex.onclick = () => openBig(f); el.querySelector('.view').onclick = (e) => { if (!mini && e.target.closest('.view')) openBig(f); };
    binds.push(() => { off.style.display = f.active ? 'none' : 'grid'; pill.textContent = f.active ? '● ACTIVE' : '○ INACTIVE'; pill.classList.toggle('ok', f.active); });
    return el;
  }
  function openBig(f) {
    big?.remove(); feedEls.splice(0, feedEls.length, ...feedEls.filter((x) => x.size !== 'big'));
    const el = $(`<div class="cc-big"><div class="g-row"><div class="g-title" style="flex:1">${esc(f.name)} <span class="g-sub g-small" style="font-weight:400">· ${esc(f.room)} · <b>SIMULATED 3D VIEW</b>, not hardware footage</span></div><span class="g-seg"></span><button aria-label="Close expanded view">${svg('x')}</button></div><div class="view"><canvas></canvas></div></div>`);
    const seg = el.querySelector('.g-seg'); let cur = f; const cv = el.querySelector('canvas');
    const entry = { feed: f, canvas: cv, size: 'big', el }; feedEls.push(entry);
    for (const ff of cameras.feeds) { const b = $(`<button class="${ff === f ? 'on' : ''}">${esc(ff.room)}</button>`); b.onclick = () => { entry.feed = cur = ff; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); el.querySelector('.g-title').firstChild.textContent = ff.name + ' '; }; seg.append(b); }
    el.querySelector('button[aria-label]').onclick = () => { el.remove(); big = null; feedEls.splice(0, feedEls.length, ...feedEls.filter((x) => x !== entry)); };
    win.append(el); big = el; void cur;
  }

  function envData() {
    const w = weatherInfo(); const out = [];
    out.push(['Outdoor temperature', w.live ? `${Math.round((w.tempF - 32) * 5 / 9)}°C <span class="g-sub g-small">/ ${Math.round(w.tempF)}°F</span>` : '<span class="un">Unavailable</span>', w.live ? 'Live weather service' : 'Weather service not connected']);
    out.push(['Indoor temperature', '<span class="un">Unavailable</span>', 'No indoor sensor is connected']);
    out.push(['Weather', w.live ? esc(w.label) : '<span class="un">Unavailable</span>', w.live ? 'Source: Open-Meteo' : 'Showing a default scene, not a measurement']);
    out.push(['Time', esc(w.clock), `${esc(w.zone)}${w.simulated ? ' · simulated time' : ''}`]);
    out.push(['Day / night', `${w.day ? svg('sun') : svg('moon')} ${esc(w.phase)}`, 'From the sun position at the apartment']);
    return out;
  }
  const envTile = ([k, v, n]) => `<div class="g-glass g-static cc-stat"><span>${k}</span><b>${v}</b><span class="g-faint">${n}</span></div>`;

  function overview() {
    const ds = devices.active(), powerish = ds.filter((d) => d.capabilities.some((c) => POWERISH.includes(c)));
    const stats = $(`<div class="cc-stats"></div>`);
    const tile = (label, fn) => { const el = $(`<div class="g-glass g-static cc-stat"><b></b><span>${label}</span></div>`); const b = el.querySelector('b'); binds.push(() => { const v = fn(); if (b.textContent !== v) b.textContent = v; }); stats.append(el); };
    tile('Registered devices', () => ds.length);
    tile('Powered on', () => powerish.filter((d) => devices.isOn(d)).length);
    tile('Powered off', () => powerish.filter((d) => !devices.isOn(d)).length);
    tile('Doors open', () => ds.filter((d) => d.icon === 'door' && d.state().open).length);
    tile('Active cameras', () => `${cameras.feeds.filter((f) => f.active).length}/${cameras.feeds.length}`);
    const envT = $(`<div class="g-glass g-static cc-stat"><b></b><span>Outdoor · Indoor</span></div>`); const eb = envT.querySelector('b');
    binds.push(() => { const w = weatherInfo(); const t = w.live ? `${Math.round((w.tempF - 32) * 5 / 9)}°C` : 'n/a'; if (eb.textContent !== t + ' · n/a') eb.textContent = t + ' · n/a'; }); stats.append(envT);
    const status = $(`<div class="g-glass g-static cc-stat" style="grid-column:1/-1;display:flex;align-items:center;gap:12px">${svg('shield', 'lg')}<div><b style="font-size:16px"></b><span>Apartment status</span></div></div>`); const sb = status.querySelector('b');
    binds.push(() => { const e = devices.get('north_door'), s = e?.state(); const lights = ds.filter((d) => d.category === 'lighting' && devices.isOn(d)).length; const v = `${s ? (s.open ? 'Entrance door open' : s.locked ? 'Entrance locked' : 'Entrance door closed') : 'Entrance n/a'} · ${lights} light${lights === 1 ? '' : 's'} on`; if (sb.textContent !== v) sb.textContent = v; });
    const rooms = $(`<div class="cc-rooms"></div>`);
    for (const r of ROOM_ORDER) {
      const list = roomDevices(r); if (!list.length) continue;
      const card = $(`<section class="g-glass g-static cc-room"><header>${svg('rooms')}<span class="g-head">${ROOM_LABEL[r]}</span><span class="cc-pill"></span></header><div class="cc-devs"></div></section>`);
      const pill = card.querySelector('.cc-pill'); binds.push(() => { const n = list.filter((d) => devices.isOn(d)).length; const t = `${n}/${list.length} on`; if (pill.textContent !== t) pill.textContent = t; });
      const g = card.querySelector('.cc-devs'); list.forEach((d) => g.append(deviceCard(d))); rooms.append(card);
    }
    const strip = $(`<div class="cc-feeds"></div>`); cameras.feeds.slice(0, 3).forEach((f) => strip.append(feedCard(f, true)));
    const dev = $(`<details class="g-glass g-static g-pad"><summary class="g-head">Developer info</summary><div class="cc-kv" id="cc-dev" style="margin-top:10px"></div></details>`);
    const kv = dev.querySelector('#cc-dev'); let dt = 0;
    binds.push(() => { if (!dev.open || performance.now() - dt < 500) return; dt = performance.now(); kv.innerHTML = devInfo().map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join(''); });
    return [stats, status, sec('Rooms', 'rooms', rooms), sec('Camera monitoring', 'camera', strip), sec('Environment', 'therm', $(`<div class="cc-env" id="cc-env-ov"></div>`)), dev];
  }
  const sec = (h, icon, el) => { const s = $(`<section class="cc-sec"><h3>${svg(icon)}${h}</h3></section>`); s.append(el); return s; };
  function devInfo() {
    const info = renderer.info; let meshes = 0; scene.traverse((o) => { if (o.isMesh) meshes++; });
    return [['Application', pkg.name + ' · 277 Park Ave #11'], ['Developer', 'Personal project (built with Claude Code)'], ['Application version', pkg.version], ['Three.js', 'r' + THREE.REVISION],
      ['Scene', 'Loaded · ' + layout.movables.length + ' registered objects, ' + meshes + ' meshes'], ['Rendering', `${renderer.getContext() ? 'WebGL active' : 'no context'} · ${clock.fps()} fps · ${info.render.calls} draw calls`],
      ['Active devices', devices.devices.filter((d) => devices.isOn(d)).length + ' of ' + devices.devices.length], ['Camera system', `${cameras.feeds.filter((f) => f.active).length}/${cameras.feeds.length} active · all simulated (no hardware linked)`]];
  }
  function camerasPage() {
    const g = $(`<div class="cc-feeds"></div>`); cameras.feeds.forEach((f) => g.append(feedCard(f)));
    return [$(`<p class="cc-hint">These are <b>simulated</b> views rendered from the 3D model of your apartment by virtual cameras. They are not hardware footage. Click a feed to expand it. Your first-person view is not affected.</p>`), g];
  }
  function roomsPage() {
    const seg = $(`<div class="g-seg" role="tablist"></div>`);
    for (const r of ROOM_ORDER) { const b = $(`<button role="tab" class="${r === roomSel ? 'on' : ''}">${ROOM_LABEL[r]} <span class="g-faint">${roomDevices(r).length}</span></button>`); b.onclick = () => { roomSel = r; render(); }; seg.append(b); }
    const g = $(`<div class="cc-devs" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))"></div>`); roomDevices(roomSel).forEach((d) => g.append(deviceCard(d, { details: false })));
    if (!roomDevices(roomSel).length) g.append($('<p class="cc-hint">No controllable devices in this room.</p>'));
    return [seg, g, $(`<p class="cc-hint">Click a device name for its details. Everything here is the same state as the objects in the apartment: switch it here or walk up and use it, both stay in step.</p>`)];
  }
  const invObjs = () => layout.movables.filter((o) => !/^(wall|rocker|switch)/.test(o.name));
  function inventoryPage() {
    const objs = invObjs(), added = objs.filter((o) => o.visible).length;
    const stats = $(`<div class="cc-stats"><div class="g-glass g-static cc-stat"><b>${objs.length}</b><span>Registered assets</span></div><div class="g-glass g-static cc-stat"><b>${added}</b><span>Added to apartment</span></div><div class="g-glass g-static cc-stat"><b>${objs.length - added}</b><span>Available, not added</span></div></div>`);
    const cats = {}; objs.forEach((o) => { cats[catOf(o)] = (cats[catOf(o)] ?? 0) + 1; });
    const chips = $(`<div class="cc-chips">${Object.entries(cats).map(([k, v]) => `<span class="cc-pill ok">${esc(k)} · ${v}</span>`).join('')}</div>`);
    const grid = $(`<div class="cc-inv"></div>`); const V = new THREE.Vector3();
    for (const o of objs.sort((a, b) => catOf(a).localeCompare(catOf(b)) || a.name.localeCompare(b.name))) {
      o.getWorldPosition(V); const dv = devices.devices.find((d) => d.object === o || (d.object && o.getObjectById(d.object.id))); const st = dv ? dv.controls.map((c) => c.text(dv.state())).join(' · ') : o.visible ? 'In place' : '—';
      const cat = catOf(o), t = $(`<div class="cc-tile ${o.visible ? '' : 'gone'}"><div class="pic">${svg(CAT_ICON[cat])}</div><b>${esc((o.userData.label ?? o.name).replace(/ - .*$/, ''))}</b><div class="g-small g-sub">${esc(cat)}<br>${o.visible ? esc(ROOM_LABEL[roomAt(V.x, V.z)]) + ' · ' + esc(st) : 'Not in apartment'}</div><span class="cc-pill ${o.visible ? 'ok' : ''}">${o.visible ? '✓ ADDED' : '○ AVAILABLE'}</span><button class="sm ${o.visible ? '' : 'primary'}" aria-label="${o.visible ? 'Remove' : 'Add'} ${esc(o.name)}">${svg(o.visible ? 'minus' : 'plus')} ${o.visible ? 'Remove' : 'Add'}</button></div>`);
      t.querySelector('button').onclick = () => { layout.setVisible(o, !o.visible); layout.save?.(); toast(`${o.userData.label?.split(' - ')[0] ?? o.name} ${o.visible ? 'added to' : 'removed from'} the apartment. The model is kept.`); render(); };
      grid.append(t);
    }
    return [stats, chips, grid, $(`<p class="cc-hint">Removing an asset only takes it out of the apartment (it stops being drawn and no longer blocks you). Its model and position are kept, so you can add it back at any time. Nothing is deleted.</p>`)];
  }
  function environmentPage() { return [$(`<div class="cc-env" id="cc-env-pg"></div>`), $(`<p class="cc-hint">Values marked Unavailable have no connected source. Nothing here is estimated.</p>`)]; }

  // ---------- render / refresh ----------
  function render() {
    binds = []; feedEls.splice(0, feedEls.length, ...feedEls.filter((x) => x.size === 'big'));
    const [, label] = PAGES.find((p) => p[0] === page); title.textContent = label;
    nav.querySelectorAll('.cc-tab[data-page]').forEach((b) => { if (b.dataset.page === page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const parts = { overview, cameras: camerasPage, rooms: roomsPage, inventory: inventoryPage, environment: environmentPage }[page]();
    body.replaceChildren(...parts); body.scrollTop = 0; lastEnv = ''; refresh(true);
  }
  function refresh(force) {
    const snap = devices.snapshot(); const camSnap = cameras.feeds.map((f) => +f.active).join('');
    if (force || snap !== lastSnap + camSnap) { lastSnap = snap; for (const b of binds) b(); lastSnap = snap; }
    else for (const b of binds) b();
    const w = envData(); const e = JSON.stringify(w);
    if (e !== lastEnv) { lastEnv = e; for (const id of ['cc-env-ov', 'cc-env-pg']) { const t = body.querySelector('#' + id); if (t) t.innerHTML = w.map(envTile).join(''); } }
    timePill.textContent = weatherInfo().clock;
    if (page === 'inventory') { const k = invObjs().map((o) => +o.visible).join(''); const changed = lastInv && k !== lastInv; lastInv = k; if (changed) render(); }
  }
  function go(p) { page = p; big?.remove(); big = null; lastInv = ''; render(); }
  let poll = 0;
  function open() { if (api.open) return; api.open = true; api.hooks.onOpen?.(); glassShow(root, 'grid'); render(); poll = setInterval(refresh, 250); }
  function close(relock) { if (!api.open) return; api.open = false; clearInterval(poll); big?.remove(); big = null; feedEls.length = 0; glassHide(root); api.hooks.onClose?.(relock); }
  openBtn.onclick = open;
  root.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === root) close(false); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab' && !e.repeat) { if (document.activeElement?.closest('input,textarea') ) return; e.preventDefault(); api.open ? close(true) : open(); }
    else if (e.code === 'Escape' && api.open) { if (big) { big.remove(); big = null; feedEls.splice(0, feedEls.length, ...feedEls.filter((x) => x.size !== 'big')); } else close(false); }
  });
  api.close = close; api.openDash = open; api.openBtn = openBtn;
  /** Called every frame by the main loop. */
  api.frame = () => { if (!api.open) return; cameras.tick(feedEls.filter((f) => f.canvas.isConnected)); };
  return api;
}
