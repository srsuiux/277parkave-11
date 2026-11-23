import { env, PRESETS, setHour, persist, clockText, phaseName, nextPreset } from './daycycle.js';

/** Small clock bar (bottom centre): time + phase, slider, presets, play / pause, speed. Keys: T next time of day, [ ] -/+ 1 hour. */
const SPEEDS = [['Slow', 20], ['Normal', 10], ['Fast', 4], ['Very fast', 1.5]];
export function initClockUI({ toast, isBusy }) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:7px 12px;background:rgba(15,15,18,.78);border:1px solid #333;border-radius:12px;color:#ddd;font:12px system-ui;z-index:12;backdrop-filter:blur(6px)';
  const B = 'padding:4px 8px;border:1px solid #444;border-radius:6px;background:#26262b;color:#ddd;cursor:pointer;font:12px system-ui';
  el.innerHTML = `<span id="ck-icon" style="font-size:16px;width:18px;text-align:center"></span>
    <span style="min-width:92px"><b id="ck-time" style="font-size:14px;color:#fff"></b><br><span id="ck-phase" style="color:#8a8d95"></span></span>
    <input id="ck-slider" type="range" min="0" max="24" step="0.05" style="width:170px">
    ${PRESETS.map(([n, h]) => `<button data-h="${h}" style="${B}">${n}</button>`).join('')}
    <button id="ck-play" style="${B};min-width:44px"></button>
    <select id="ck-speed" style="${B}">${SPEEDS.map(([n, s]) => `<option value="${s}">${n}</option>`).join('')}</select>`;
  document.body.appendChild(el);
  const $ = (id) => el.querySelector('#' + id), slider = $('ck-slider'), speed = $('ck-speed');
  speed.value = String(env.secPerHour); if (speed.value !== String(env.secPerHour)) speed.value = '10';
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('keydown', (e) => e.stopPropagation());
  slider.oninput = () => { setHour(+slider.value); slider.blur(); };
  el.querySelectorAll('button[data-h]').forEach((b) => { b.onclick = () => { setHour(+b.dataset.h); b.blur(); }; });
  $('ck-play').onclick = (e) => { env.playing = !env.playing; persist(); e.target.blur(); };
  speed.onchange = () => { env.secPerHour = +speed.value; persist(); speed.blur(); };
  addEventListener('keydown', (e) => {
    if (e.repeat || isBusy()) return;
    if (e.code === 'KeyT') toast(nextPreset() + ' · ' + clockText(), 1.6);
    else if (e.code === 'BracketRight') setHour(env.hour + 1);
    else if (e.code === 'BracketLeft') setHour(env.hour - 1);
  });
  return { refresh() {
    $('ck-time').textContent = clockText(); $('ck-phase').textContent = phaseName() + (env.playing ? '' : ' · paused');
    $('ck-icon').textContent = env.sunElev > -2 ? '☀' : '☾'; $('ck-play').textContent = env.playing ? 'Pause' : 'Play';
    if (document.activeElement !== slider) slider.value = env.hour;
    persist(false);
  } };
}
