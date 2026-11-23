/**
 * Add from first person: aim at a spot, press N, pick an asset from the inventory (the same registry as the dashboard's My Inventory),
 * and it is placed where you were aiming. Nothing new is stored: "added" is just the asset's `visible` flag in the layout registry.
 */
import * as THREE from 'three';
import { glassShow, glassHide } from './ui/glass.js';
import { svg, esc, catOf, CAT_ICON, CAT_COLOR } from './dashboard.js';
import { roomAt, ROOM_LABEL } from './devices.js';

export function initPlacer({ scene, camera, layout, hooks, toast }) {
  const root = document.createElement('div'); root.className = 'g-scrim'; root.id = 'pl'; root.style.zIndex = 64;
  root.innerHTML = `<div class="cc-panel cc-box" style="position:relative;width:min(760px,92vw);height:min(600px,84vh);animation:g-pop var(--g-slow) var(--g-ease) both;color:var(--cc-text,#fff)">
    <div class="cc-ph"><h2>Add to the apartment</h2><span class="cc-note" id="pl-where"></span><span class="cc-grow"></span><label class="cc-search" style="width:220px">${svg('search')}<input type="search" placeholder="Search assets" aria-label="Search assets"></label><button class="cc-btn ico" id="pl-x" aria-label="Close">${svg('x')}</button></div>
    <div class="cc-pb"><div class="cc-grid tiles" id="pl-grid"></div></div></div>`;
  document.body.append(root);
  const grid = root.querySelector('#pl-grid'), where = root.querySelector('#pl-where'), search = root.querySelector('input');
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5be39a, transparent: true, opacity: 0.9, depthTest: false }));
  marker.renderOrder = 999; marker.visible = false; scene.add(marker);
  const api = { open: false }; let spot = null;
  const ray = new THREE.Raycaster(); ray.far = 8;

  function aim() {
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = ray.intersectObjects(scene.children, true).filter((h) => h.object.isMesh && h.object.visible && h.object !== marker && h.object.material?.opacity !== 0 && !h.object.userData.isGlassPane);
    for (const h of hits) {
      let hidden = false; for (let o = h.object; o; o = o.parent) if (o.visible === false) hidden = true;
      if (hidden || !h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      return { point: h.point.clone(), normal: n };
    }
    return null;
  }
  const mine = () => layout.movables.filter((o) => !/^(wall|rocker|switch)/.test(o.name));
  function render() {
    const q = search.value.trim().toLowerCase(); grid.replaceChildren();
    const list = mine().filter((o) => !o.visible && (!q || ((o.userData.label ?? o.name) + ' ' + catOf(o)).toLowerCase().includes(q)));
    for (const o of list) {
      const cat = catOf(o), t = document.createElement('div'); t.className = 'cc-card cc-tile';
      t.innerHTML = `<span class="cc-ic" style="--ic:${CAT_COLOR[cat]}">${svg(CAT_ICON[cat])}</span><div class="cc-dtxt"><div class="nm static">${esc((o.userData.label ?? o.name).replace(/ - .*$/, ''))}</div><div class="st2">${esc(cat)}</div></div><div class="foot"><span class="cc-tag">Available</span><button class="cc-btn go">${svg('plus')}Add here</button></div>`;
      t.querySelector('button').onclick = () => place(o); grid.append(t);
    }
    if (!list.length) grid.innerHTML = `<p class="cc-empty">${mine().some((o) => !o.visible) ? 'No assets match your search.' : 'Every registered asset is already in the apartment. Remove one from My Inventory to add it back here.'}</p>`;
  }
  function place(o) {
    const { point: p, normal: n } = spot;
    const upish = n.y > 0.7;
    o.position.x = p.x + (upish ? 0 : n.x * 0.3); o.position.z = p.z + (upish ? 0 : n.z * 0.3);
    if (upish || o.userData.wallMount) o.position.y = p.y;
    layout.setVisible(o, true); layout.save?.();
    toast?.(`${(o.userData.label ?? o.name).split(' - ')[0]} added in the ${ROOM_LABEL[roomAt(o.position.x, o.position.z)]}. Press L to fine-tune its position.`, 3.4);
    close(true);
  }
  function open() {
    if (api.open) return; spot = aim(); if (!spot) { toast?.('Aim at the floor or a surface, then press N', 2.2); return; }
    api.open = true; hooks.onOpen?.(); marker.position.copy(spot.point).addScaledVector(spot.normal, 0.01); marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spot.normal); marker.visible = true;
    where.textContent = `Placing at the ${ROOM_LABEL[roomAt(spot.point.x, spot.point.z)]}`; search.value = ''; render(); glassShow(root, 'grid'); setTimeout(() => search.focus(), 50);
  }
  function close(relock) { if (!api.open) return; api.open = false; marker.visible = false; glassHide(root); hooks.onClose?.(relock); }
  root.querySelector('#pl-x').onclick = () => close(true);
  root.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === root) close(false); });
  search.oninput = render; search.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') close(false); };
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && api.open) close(false); });
  api.openPicker = open; api.close = close;
  return api;
}
