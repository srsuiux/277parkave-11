import * as THREE from 'three';

/**
 * The study monitor's "computer": a wallpaper desktop shown on the 3D screen, plus a media player.
 * Press E at the monitor to sit at it (overlay): pick a wallpaper (presets / image URL / upload) and paste a
 * YouTube, Spotify, SoundCloud or direct .mp3/.mp4 link to play it. Sound keeps playing in the room and gets
 * quieter as you walk away from the monitor.
 */
const KEY = 'apartment-monitor';
const W = 1280, H = 720;

// ---------- procedural wallpapers ----------
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const lin = (g, w, h, stops, vertical = true) => { const gr = g.createLinearGradient(0, 0, vertical ? 0 : w, vertical ? h : 0); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
const PRESETS = [
  { id: 'aurora', name: 'Aurora', draw(g, w, h) {
    lin(g, w, h, [[0, '#03101c'], [1, '#0c3140']]);
    seed = 3; for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`; g.fillRect(rnd() * w, rnd() * h * 0.6, 1.5, 1.5); }
    [['rgba(60,255,170,', 0.5], ['rgba(70,200,255,', 0.38], ['rgba(190,110,255,', 0.3]].forEach(([c, a], k) => {
      const gr = g.createLinearGradient(0, h * 0.2, 0, h * 0.75); gr.addColorStop(0, c + '0)'); gr.addColorStop(0.5, c + a + ')'); gr.addColorStop(1, c + '0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.42 + k * 0.08) + Math.sin(x / (170 + k * 60) + k * 2) * 60 + Math.sin(x / 61 + k) * 18);
      g.lineTo(w, h); g.closePath(); g.fill();
    });
  } },
  { id: 'sunset', name: 'Sunset', draw(g, w, h) {
    lin(g, w, h, [[0, '#2b1055'], [0.45, '#c8456d'], [0.62, '#ff9a5a'], [0.63, '#2a1233'], [1, '#12061c']]);
    g.fillStyle = '#ffd08a'; g.beginPath(); g.arc(w * 0.5, h * 0.55, h * 0.13, 0, 7); g.fill();
    [['#3a1840', 0.66], ['#26102f', 0.74], ['#160a1f', 0.84]].forEach(([c, y], k) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 10) g.lineTo(x, h * y + Math.sin(x / (140 - k * 20) + k * 3) * 22 + Math.sin(x / 47 + k) * 8); g.lineTo(w, h); g.fill(); });
  } },
  { id: 'mountains', name: 'Mountains', draw(g, w, h) {
    lin(g, w, h, [[0, '#8fb8f0'], [1, '#eef5ff']]);
    ['#7f9cc4', '#5a7aa6', '#365577', '#1d3350'].forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, h); seed = 11 + k * 5; let x = 0; while (x < w + 80) { g.lineTo(x, h * (0.45 + k * 0.12) - rnd() * h * 0.18); x += 50 + rnd() * 70; } g.lineTo(w, h); g.fill(); });
  } },
  { id: 'bloom', name: 'Bloom', draw(g, w, h) {
    g.fillStyle = '#0b1230'; g.fillRect(0, 0, w, h);
    [[0.2, 0.3, '#3a6bff'], [0.75, 0.25, '#ff5fa8'], [0.6, 0.8, '#7a4dff'], [0.1, 0.9, '#24d1c5']].forEach(([x, y, c]) => { const r = g.createRadialGradient(w * x, h * y, 0, w * x, h * y, w * 0.45); r.addColorStop(0, c + 'cc'); r.addColorStop(1, c + '00'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  } },
  { id: 'dark', name: 'Midnight', draw(g, w, h) {
    lin(g, w, h, [[0, '#101319'], [1, '#05060a']]);
    g.strokeStyle = 'rgba(120,140,180,.08)'; g.lineWidth = 1; for (let x = 0; x < w; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  } },
];

// ---------- shared state ----------
export const monitor = {
  open: false, hooks: {}, wp: { type: 'preset', id: 'aurora' }, img: null,
  media: null, playing: false, el: null, tick: 0, vol: 1, status: '',
};
const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');
export const screenTexture = new THREE.CanvasTexture(canvas);
screenTexture.colorSpace = THREE.SRGBColorSpace; screenTexture.anisotropy = 8;

function drawWallpaper(g, w, h, wp = monitor.wp, img = monitor.img) {
  if (wp.type === 'preset') (PRESETS.find((p) => p.id === wp.id) ?? PRESETS[0]).draw(g, w, h);
  else if (img) { const s = Math.max(w / img.width, h / img.height); g.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s); }
  else PRESETS[0].draw(g, w, h);
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
export function redraw() {
  drawWallpaper(ctx, W, H);
  ctx.fillStyle = 'rgba(10,12,18,.55)'; ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = '#fff'; ctx.font = '600 17px system-ui'; ctx.textBaseline = 'middle'; ctx.fillText('  ◆  Apartment', 8, 17);
  const t = new Date(); ctx.textAlign = 'right'; ctx.fillText(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '  ', W - 8, 17); ctx.textAlign = 'left';
  if (monitor.media) {
    const x = W - 420, y = H - 140;
    ctx.fillStyle = 'rgba(12,14,20,.78)'; rr(ctx, x, y, 390, 108, 16); ctx.fill();
    ctx.fillStyle = monitor.playing ? '#3ddc84' : '#c9ccd4'; ctx.font = '600 20px system-ui'; ctx.fillText(monitor.playing ? '▶  Now playing' : '⏸  Paused', x + 22, y + 32);
    ctx.fillStyle = '#fff'; ctx.font = '500 22px system-ui'; ctx.fillText(monitor.media.title.slice(0, 30), x + 22, y + 68);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '16px system-ui'; ctx.fillText(monitor.media.host.slice(0, 40), x + 22, y + 92);
    ctx.fillStyle = '#3ddc84'; for (let i = 0; i < 6; i++) { const bh = monitor.playing ? 8 + Math.random() * 34 : 8; ctx.fillRect(x + 320 + i * 11, y + 66 - bh, 7, bh); }
  }
  screenTexture.needsUpdate = true;
  paintBackdrop();
}

// ---------- persistence ----------
function save() { try { localStorage.setItem(KEY, JSON.stringify({ wp: monitor.wp, url: monitor.media?.url ?? '' })); } catch { /* quota */ } }
function loadSaved() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)); if (!d) return;
    if (d.wp) setWallpaper(d.wp, false);
    if (d.url) { const el = document.getElementById('mon-url'); if (el) el.value = d.url; }
  } catch { /* ignore */ }
}

export function setWallpaper(wp, persist = true) {
  if (wp.type === 'preset') { monitor.wp = wp; monitor.img = null; redraw(); if (persist) save(); return; }
  const src = wp.type === 'data' ? wp.data : wp.url;
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    monitor.img = img;
    if (wp.type === 'url' || wp.type === 'data') {
      // normalise uploads to a small jpeg so they can be remembered
      if (wp.type === 'data' && !wp.small) { const c = document.createElement('canvas'); c.width = 1280; c.height = 720; drawWallpaper(c.getContext('2d'), 1280, 720, { type: 'data' }, img); try { wp = { type: 'data', data: c.toDataURL('image/jpeg', 0.8), small: true }; } catch { /* tainted */ } }
    }
    monitor.wp = wp; setStatus('Wallpaper set.'); redraw(); if (persist) save();
  };
  img.onerror = () => setStatus(wp.type === 'url' ? "Couldn't load that image (the site may block it). Try \"Upload image…\" instead." : "Couldn't read that file.");
  img.src = src;
}

// ---------- media ----------
function parseMedia(raw) {
  const u = raw.trim(); if (!u) return null;
  let url; try { url = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); } catch { return null; }
  const h = url.hostname.replace(/^(www|m|music)\./, ''), p = url.pathname, list = url.searchParams.get('list');
  let id = null;
  if (h === 'youtu.be') id = p.slice(1).split('/')[0];
  else if (h.endsWith('youtube.com')) id = p.startsWith('/watch') ? url.searchParams.get('v') : (p.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/) ?? [])[1] ?? null;
  const base = { url: u, host: h };
  if (id) return { ...base, kind: 'yt', title: 'YouTube video', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&enablejsapi=1&rel=0&playsinline=1${list ? '&list=' + list : ''}` };
  if (list && h.endsWith('youtube.com')) return { ...base, kind: 'yt', title: 'YouTube playlist', src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&autoplay=1&enablejsapi=1` };
  const sp = p.match(/^\/(track|album|playlist|episode|show|artist)\/([\w]+)/);
  if (h === 'open.spotify.com' && sp) return { ...base, kind: 'embed', title: 'Spotify ' + sp[1], src: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}` };
  if (h === 'soundcloud.com') return { ...base, kind: 'embed', title: 'SoundCloud', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}&auto_play=true` };
  if (/\.(mp3|m4a|aac|ogg|oga|wav|flac|opus)$/i.test(p)) return { ...base, kind: 'audio', title: decodeURIComponent(p.split('/').pop()), src: url.href };
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(p)) return { ...base, kind: 'video', title: decodeURIComponent(p.split('/').pop()), src: url.href };
  return null;
}
function holder() { return document.getElementById('mon-player'); }
function clearPlayer() { const h = holder(); if (h) h.innerHTML = ''; monitor.el = null; }
export function play(raw) {
  const m = parseMedia(raw);
  if (!m) { setStatus('Paste a YouTube / Spotify / SoundCloud link, or a direct .mp3 / .mp4 link.'); return; }
  clearPlayer();
  const h = holder(); let el;
  if (m.kind === 'yt' || m.kind === 'embed') { el = document.createElement('iframe'); el.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; el.src = m.src; el.style.cssText = 'width:100%;height:100%;border:0;background:#000'; }
  else { el = document.createElement(m.kind); el.src = m.src; el.controls = true; el.autoplay = true; el.playsInline = true; el.style.cssText = `width:100%;height:${m.kind === 'audio' ? '54px' : '100%'};background:#000`; el.onplay = () => { monitor.playing = true; redraw(); }; el.onpause = () => { monitor.playing = false; redraw(); }; el.onerror = () => setStatus("That link wouldn't play (it may block other sites)."); }
  h.appendChild(el); monitor.el = el; monitor.media = m; monitor.playing = true; monitor.vol = 1;
  setStatus(m.kind === 'embed' ? 'Loaded. Press play inside the player if it does not start (Spotify needs a login for full tracks).' : 'Playing.');
  placeHolder(); redraw(); save();
}
function yt(cmd) { const f = monitor.el; if (f && f.tagName === 'IFRAME' && monitor.media?.kind === 'yt') f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*'); }
function togglePause() {
  const m = monitor.media; if (!m) return;
  if (m.kind === 'yt') { yt(monitor.playing ? 'pauseVideo' : 'playVideo'); monitor.playing = !monitor.playing; }
  else if (monitor.el && (m.kind === 'audio' || m.kind === 'video')) { monitor.playing ? monitor.el.pause() : monitor.el.play(); return; }
  else setStatus('Use the controls inside the player.');
  redraw();
}
function stop() { clearPlayer(); monitor.media = null; monitor.playing = false; setStatus('Stopped.'); redraw(); }
function setVolume(v) {
  const m = monitor.media; if (!m || Math.abs(v - monitor.vol) < 0.04) return; monitor.vol = v;
  if (m.kind === 'yt') monitor.el?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [Math.round(v * 100)] }), '*');
  else if (monitor.el && 'volume' in monitor.el) monitor.el.volume = v;
}

/** per-frame: animate the "now playing" bars, and fade the sound with distance to the monitor */
export function tickMonitor(dt, camera, worldPos) {
  monitor.tick += dt;
  if (monitor.tick > 0.22) { monitor.tick = 0; if (monitor.playing && !monitor.open) redraw(); }
  if (monitor.media) setVolume(monitor.open ? 1 : Math.min(1, Math.max(0.1, 1 - (camera.position.distanceTo(worldPos) - 1) / 7)));
}

// ---------- overlay UI ----------
function setStatus(t) { monitor.status = t; const e = document.getElementById('mon-status'); if (e) e.textContent = t; }
function paintBackdrop() {
  const el = document.getElementById('mon-desk'); if (!el) return;
  const c = document.createElement('canvas'); c.width = 960; c.height = 540;
  try { drawWallpaper(c.getContext('2d'), 960, 540); el.style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.85)})`; } catch { /* tainted */ }
}
function placeHolder() {
  const h = holder(), ph = document.getElementById('mon-ph'); if (!h) return;
  if (monitor.open && ph && monitor.media) { const r = ph.getBoundingClientRect(); Object.assign(h.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }
  else Object.assign(h.style, { left: '-10000px', top: '0px', width: '480px', height: '270px' });
}
function openUI() {
  if (monitor.open) return; monitor.open = true;
  document.getElementById('mon-ov').style.display = 'grid'; monitor.hooks.onOpen?.();
  document.getElementById('mon-url').focus(); placeHolder(); setStatus(monitor.status); redraw();
}
function closeUI(relock) { if (!monitor.open) return; monitor.open = false; document.getElementById('mon-ov').style.display = 'none'; placeHolder(); monitor.hooks.onClose?.(relock); }
export const openMonitor = openUI;

export function initMonitorUI() {
  const BTN = 'padding:6px 12px;border:1px solid #556;border-radius:8px;background:#242a38;color:#fff;cursor:pointer;font:13px system-ui';
  const IN = 'flex:1;min-width:0;padding:7px 10px;border-radius:8px;border:1px solid #556;background:#0f1320;color:#fff;font:13px system-ui';
  const ov = document.createElement('div'); ov.id = 'mon-ov';
  ov.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;background:rgba(0,0,0,.72);z-index:30;font:13px system-ui;color:#eee';
  ov.innerHTML = `
    <div id="mon-desk" style="position:relative;width:min(1000px,94vw);height:min(600px,86vh);border-radius:14px;border:10px solid #111;box-shadow:0 20px 80px #000;background:#0b1020 center/cover;overflow:hidden">
      <div style="position:absolute;left:0;right:0;top:0;height:30px;background:rgba(10,12,18,.6);display:flex;align-items:center;padding:0 12px;gap:10px"><b>◆ Apartment</b><span style="flex:1"></span><span id="mon-clock"></span><button id="mon-close" style="${BTN};padding:2px 10px">✕ Leave monitor (Esc)</button></div>
      <div style="position:absolute;left:18px;top:46px;bottom:18px;width:58%;background:rgba(16,20,30,.9);border:1px solid #445;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px">
        <b>▶ Media player</b>
        <div style="display:flex;gap:6px"><input id="mon-url" placeholder="Paste a YouTube, Spotify, SoundCloud or .mp3 / .mp4 link" style="${IN}"><button id="mon-play" style="${BTN};background:#1f6feb">Play</button></div>
        <div id="mon-ph" style="flex:1;border-radius:8px;background:#000 center/contain no-repeat;display:grid;place-items:center;color:#667;min-height:120px">Nothing playing</div>
        <div style="display:flex;gap:6px"><button id="mon-pause" style="${BTN}">⏯ Pause / resume</button><button id="mon-stop" style="${BTN}">⏹ Stop</button></div>
        <div id="mon-status" style="color:#9ab;min-height:30px;font-size:12px"></div>
      </div>
      <div style="position:absolute;right:18px;top:46px;bottom:18px;width:34%;background:rgba(16,20,30,.9);border:1px solid #445;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;overflow:auto">
        <b>🖼 Wallpaper</b>
        <div id="mon-presets" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
        <div style="display:flex;gap:6px"><input id="mon-wpurl" placeholder="Image URL" style="${IN}"><button id="mon-wpapply" style="${BTN}">Set</button></div>
        <button id="mon-wpup" style="${BTN}">⬆ Upload image…</button><input id="mon-wpfile" type="file" accept="image/*" style="display:none">
      </div>
    </div>`;
  document.body.appendChild(ov);
  const hold = document.createElement('div'); hold.id = 'mon-player';
  hold.style.cssText = 'position:fixed;left:-10000px;top:0;width:480px;height:270px;z-index:31;background:#000;border-radius:8px;overflow:hidden';
  document.body.appendChild(hold);
  const $ = (id) => document.getElementById(id);
  const pr = $('mon-presets');
  for (const p of PRESETS) {
    const b = document.createElement('button'); b.style.cssText = 'border:2px solid #556;border-radius:8px;padding:0;background:#000;cursor:pointer;color:#fff;font:12px system-ui;overflow:hidden';
    const c = document.createElement('canvas'); c.width = 240; c.height = 135; p.draw(c.getContext('2d'), 240, 135); c.style.cssText = 'width:100%;display:block';
    b.append(c, Object.assign(document.createElement('div'), { textContent: p.name, style: 'padding:3px' }));
    b.onclick = () => setWallpaper({ type: 'preset', id: p.id }); pr.appendChild(b);
  }
  $('mon-play').onclick = () => play($('mon-url').value);
  $('mon-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') play($('mon-url').value); });
  $('mon-pause').onclick = togglePause; $('mon-stop').onclick = stop;
  $('mon-wpapply').onclick = () => { const u = $('mon-wpurl').value.trim(); if (u) setWallpaper({ type: 'url', url: /^https?:\/\//i.test(u) ? u : 'https://' + u }); };
  $('mon-wpup').onclick = () => $('mon-wpfile').click();
  $('mon-wpfile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setWallpaper({ type: 'data', data: r.result }); r.readAsDataURL(f); e.target.value = ''; };
  $('mon-close').onclick = () => closeUI(true);
  addEventListener('keydown', (e) => { if (monitor.open && e.code === 'Escape') closeUI(false); });
  addEventListener('resize', placeHolder);
  setInterval(() => { const c = $('mon-clock'); if (c) c.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }, 5000);
  loadSaved(); redraw();
}
