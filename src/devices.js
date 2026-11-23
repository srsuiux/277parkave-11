/**
 * Device registry for the Command Center.
 *
 * There is NO second copy of any device state. Every device reads and writes the 3D object that owns it:
 * `userData.persist` (the same get/set the session saver uses), the door's `userData.target`, `lightState`,
 * or a small `userData.device` hook. The dashboard just polls `snapshot()` and re-renders when it changes, so a switch
 * flipped in the apartment shows up on the dashboard and vice versa, with nothing to keep in sync.
 *
 * Device shape:  { id, name, category, room, icon, capabilities[], state(), controls[] }
 * Control shape: { cap, kind: 'toggle'|'step'|'action', label, text(state), on(state), run(state) }
 */
import * as THREE from 'three';
import { KITCHEN as K, BEDROOM as BED, BATHROOM as BATH } from './config.js';
import { lightState } from './fixtures/lights.js';

const ROOM_RECTS = [
  ['bathroom', BATH.x0, BATH.x1, BATH.z0, BATH.z1],
  ['bedroom', BED.x0, BED.x1 + BED.wallT + BED.closet.w + 0.1, BED.z0, BED.z1],
  ['kitchen', 0, K.width, 0, K.depth],
];
export const ROOM_LABEL = { entrance: 'Entrance & hallway', kitchen: 'Kitchen', bathroom: 'Bathroom', bedroom: 'Bedroom' };
export const ROOM_ORDER = ['bedroom', 'kitchen', 'bathroom', 'entrance'];
export function roomAt(x, z) { for (const [n, x0, x1, z0, z1] of ROOM_RECTS) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return n; return 'entrance'; }

export function initDevices({ scene, doors, operateDoor }) {
  const byName = (name, pred) => { let r = null; scene.traverse((o) => { if (!r && o.name === name && (!pred || pred(o))) r = o; }); return r; };
  const V = new THREE.Vector3();
  const roomOf = (o) => { o.getWorldPosition(V); return roomAt(V.x, V.z); };
  const devices = [];
  const add = (d) => { devices.push({ capabilities: [], controls: [], ...d }); };

  // ---- helpers -------------------------------------------------------------------------------------------------
  /** A device whose state is the persist value of one scene object. */
  const persisted = (obj, spec) => {
    if (!obj?.userData.persist) return;
    const p = obj.userData.persist;
    add({ ...spec, room: spec.room ?? roomOf(obj), object: obj, state: () => spec.read(p.get()), _set: (v) => p.set(v), _get: () => p.get() });
  };
  const toggle = (cap, label, on, run, text) => ({ cap, kind: 'toggle', label, on, run, text: text ?? ((s) => (on(s) ? 'ON' : 'OFF')) });

  // ---- kitchen light (shared with the switch on the wall) -----------------------------------------------------
  add({
    id: 'kitchen_light', name: 'Kitchen Light', category: 'lighting', room: 'kitchen', icon: 'bulb', capabilities: ['power_toggle'],
    state: () => ({ powered: !!lightState.ceilingOn }),
    controls: [toggle('power_toggle', 'Power', (s) => s.powered, (s) => { lightState.ceilingOn = !s.powered; })],
  });

  // ---- taps / sinks -----------------------------------------------------------------------------------------------
  const tapDevice = (objName, id, name, room, pred) => persisted(byName(objName, pred), {
    id, name, category: 'plumbing', room, icon: 'drops', capabilities: ['water_flow'],
    read: (v) => ({ running: !!(v[0] || v[1]), hot: !!v[0], cold: !!v[1] }),
    controls: [toggle('water_flow', 'Water', (s) => s.running, null, (s) => (s.running ? (s.hot && s.cold ? 'RUNNING' : s.hot ? 'HOT' : 'COLD') : 'OFF'))],
  });
  tapDevice('sink', 'kitchen_sink', 'Kitchen Sink', 'kitchen');
  tapDevice('bath-sink', 'bathroom_sink', 'Bathroom Sink', 'bathroom');

  // ---- laptop -------------------------------------------------------------------------------------------------------
  persisted(byName('laptop'), { id: 'laptop', name: 'Laptop', category: 'electronics', icon: 'laptop', capabilities: ['open_close'], read: (v) => ({ open: !!v }),
    controls: [toggle('open_close', 'Lid', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });

  // ---- bedroom -------------------------------------------------------------------------------------------------------
  const fan = byName('ceiling-fan');
  persisted(fan, { id: 'bedroom_light', name: 'Bedroom Light', category: 'lighting', room: 'bedroom', icon: 'bulb', capabilities: ['power_toggle'], read: (v) => ({ powered: !!v[1] }),
    controls: [toggle('power_toggle', 'Power', (s) => s.powered, null)] });
  const FAN = ['OFF', 'LOW', 'MEDIUM', 'HIGH'];
  persisted(fan, { id: 'bedroom_fan', name: 'Ceiling Fan', category: 'climate', room: 'bedroom', icon: 'fan', capabilities: ['power_toggle', 'fan_speed'], read: (v) => ({ powered: v[0] > 0, speed: v[0] }),
    controls: [{ cap: 'fan_speed', kind: 'step', label: 'Speed', steps: FAN, text: (s) => FAN[s.speed], on: (s) => s.speed > 0 }] });
  persisted(byName('bedroom-curtains'), { id: 'bedroom_curtains', name: 'Bedroom Curtains', category: 'openings', room: 'bedroom', icon: 'blinds', capabilities: ['open_close'], read: (v) => ({ open: v > 0.5 }),
    controls: [toggle('open_close', 'Curtains', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });
  persisted(byName('bedroom-window'), { id: 'bedroom_window', name: 'Bedroom Window', category: 'openings', room: 'bedroom', icon: 'window', capabilities: ['open_close'], read: (v) => ({ open: v.some((t) => t > 0.5) }),
    controls: [toggle('open_close', 'Sashes', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });
  persisted(byName('bedroom-ac'), { id: 'bedroom_ac', name: 'Air Conditioner', category: 'climate', room: 'bedroom', icon: 'snow', capabilities: ['power_toggle'], read: (v) => ({ powered: !!v }),
    controls: [toggle('power_toggle', 'Power', (s) => s.powered, null)] });
  persisted(byName('wall-heater'), { id: 'bedroom_heater', name: 'Gas Wall Heater', category: 'climate', room: 'bedroom', icon: 'flame', capabilities: ['power_toggle'], read: (v) => ({ powered: !!v }),
    controls: [toggle('power_toggle', 'Power', (s) => s.powered, null)] });
  persisted(byName('heater-pipes'), { id: 'gas_valve', name: 'Heater Gas Valve', category: 'plumbing', room: 'bedroom', icon: 'valve', capabilities: ['open_close'], read: (v) => ({ open: v !== false }),
    controls: [toggle('open_close', 'Valve', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });
  persisted(byName('closet-switch'), { id: 'closet_light', name: 'Closet Light', category: 'lighting', room: 'bedroom', icon: 'bulb', capabilities: ['power_toggle'], read: (v) => ({ powered: !!v }),
    controls: [toggle('power_toggle', 'Power', (s) => s.powered, null)] });
  persisted(byName('bedside-storage-table'), { id: 'bedside_table', name: 'Bedside Storage Table', category: 'furniture', room: 'bedroom', icon: 'archive', capabilities: ['open_close'], read: (v) => ({ open: !!v }),
    controls: [toggle('open_close', 'Lid', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });

  // ---- bathroom ----------------------------------------------------------------------------------------------------
  const sconce = scene.getObjectByName('light-plug')?.parent;
  if (sconce?.userData.device) {
    const dv = sconce.userData.device;
    add({
      id: 'bathroom_light', name: 'Bathroom Light', category: 'lighting', room: 'bathroom', icon: 'bulb', capabilities: ['power_toggle', 'connection'],
      state: () => ({ powered: dv.power() > 0.5, connected: dv.plugged() }),
      controls: [toggle('connection', 'Power plug', (s) => s.connected, (s) => dv.setPlugged(!s.connected), (s) => (s.connected ? 'CONNECTED' : 'DISCONNECTED'))],
    });
  }
  const stall = byName('shower-stall');
  persisted(stall, { id: 'shower', name: 'Shower', category: 'plumbing', room: 'bathroom', icon: 'drops', capabilities: ['water_flow'], read: (v) => ({ running: !!(v.hot || v.cold), hot: !!v.hot, cold: !!v.cold }),
    controls: [toggle('water_flow', 'Water', (s) => s.running, null, (s) => (s.running ? (s.hot && s.cold ? 'RUNNING' : s.hot ? 'HOT' : 'COLD') : 'OFF'))] });
  persisted(stall, { id: 'shower_curtain', name: 'Shower Curtain', category: 'openings', room: 'bathroom', icon: 'blinds', capabilities: ['open_close'], read: (v) => ({ open: v.c > 0.5 }),
    controls: [toggle('open_close', 'Curtain', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });
  const toilet = byName('toilet');
  persisted(toilet, { id: 'toilet_lid', name: 'Toilet Lid', category: 'plumbing', room: 'bathroom', icon: 'toilet', capabilities: ['open_close'], read: (v) => ({ open: !!v[0] }),
    controls: [toggle('open_close', 'Lid', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });
  persisted(toilet, { id: 'toilet_seat', name: 'Toilet Seat', category: 'plumbing', room: 'bathroom', icon: 'toilet', capabilities: ['open_close'], read: (v) => ({ open: !!v[1] }),
    controls: [toggle('open_close', 'Seat', (s) => s.open, null, (s) => (s.open ? 'UP' : 'DOWN'))] });
  if (toilet) {
    const lever = byName('flush-lever');
    add({ id: 'toilet_flush', name: 'Toilet Flush', category: 'plumbing', room: 'bathroom', icon: 'drops', capabilities: ['flush'], object: toilet,
      state: () => ({ flushing: !!toilet.userData.flushing?.() }),
      controls: [{ cap: 'flush', kind: 'action', label: 'Flush', text: (s) => (s.flushing ? 'FLUSHING' : 'READY'), on: (s) => s.flushing, run: () => lever?.userData.interact?.run?.() }] });
  }
  persisted(byName('bath-vanity'), { id: 'vanity_cupboard', name: 'Sink Cupboard', category: 'furniture', room: 'bathroom', icon: 'archive', capabilities: ['open_close'], read: (v) => ({ open: !!v }),
    controls: [toggle('open_close', 'Door', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });

  for (const [nm, id, label] of [['fridge-door-lower', 'fridge_door', 'Refrigerator Door'], ['fridge-door-freezer', 'freezer_door', 'Freezer Door']])
    persisted(byName(nm), { id, name: label, category: 'appliance', room: 'kitchen', icon: 'archive', capabilities: ['open_close'], read: (v) => ({ open: !!v }),
      controls: [toggle('open_close', 'Door', (s) => s.open, null, (s) => (s.open ? 'OPEN' : 'CLOSED'))] });

  // ---- doors -----------------------------------------------------------------------------------------------------------
  const DOOR_META = { 'north-door': ['Entrance Door', 'entrance'], 'living-room-door': ['Bedroom Door', 'bedroom'], 'bathroom-door': ['Bathroom Door', 'bathroom'], 'closet-door': ['Closet Door', 'bedroom'] };
  for (const d of doors) {
    const m = DOOR_META[d.name]; if (!m || d.userData.locked) continue;
    add({
      id: d.name.replace(/-/g, '_'), name: m[0], category: 'openings', room: m[1], icon: 'door', capabilities: ['open_close', 'lock'], object: d,
      state: () => ({ open: d.userData.angle > 5 || d.userData.target > 5, angle: Math.round(d.userData.angle), locked: !!d.userData.bolt }),
      controls: [{ cap: 'open_close', kind: 'toggle', label: 'Door', on: (s) => s.open, text: (s) => (s.locked ? 'LOCKED' : s.open ? 'OPEN' : 'CLOSED'),
        run: (s) => { if (s.locked) return 'Locked - unlock it in the apartment first'; if (s.open === (d.userData.target > 5)) return operateDoor(d); return null; } }],
    });
  }

  // ---- generic toggle/step execution for persisted devices ---------------------------------------------------
  const WRITE = {
    // (current persist value, wanted) -> new persist value
    bedroom_light: (v, on) => [v[0], on], bedroom_fan: (v, step) => [step, v[1]],
    bedroom_curtains: (v, on) => (on ? 1 : 0), bedroom_window: (v, on) => v.map(() => (on ? 1 : 0)),
    bedroom_ac: (v, on) => on, bedroom_heater: (v, on) => on, gas_valve: (v, on) => on, closet_light: (v, on) => on, bedside_table: (v, on) => on,
    kitchen_sink: (v, on) => [on, on], bathroom_sink: (v, on) => [on, on],
    laptop: (v, on) => on, vanity_cupboard: (v, on) => on, fridge_door: (v, on) => on, freezer_door: (v, on) => on,
    shower: (v, on) => ({ ...v, hot: on, cold: on }), shower_curtain: (v, on) => ({ ...v, c: on ? 1 : 0 }),
    toilet_lid: (v, on) => [on, v[1]], toilet_seat: (v, on) => [v[0], on],
  };
  for (const d of devices) {
    if (!d._set) continue;
    const w = WRITE[d.id]; const c = d.controls[0];
    if (!c || c.run) continue;
    if (c.kind === 'step') c.run = (s) => { d._set(w(d._get(), (s.speed + 1) % c.steps.length)); };
    else c.run = (s) => { d._set(w(d._get(), !c.on(s))); };
  }
  // a few devices should show a different name/state when asked about power: the fan's bulbs share the object with the fan
  for (const d of devices) d.available = true;

  // ---- API -----------------------------------------------------------------------------------------------------------------
  const get = (id) => devices.find((d) => d.id === id);
  /** Perform the control; returns an error string if refused, else null. */
  function run(id, i = 0) { const d = get(id); const c = d?.controls[i]; if (!c) return 'Unavailable'; try { return c.run(d.state()) ?? null; } catch (e) { return 'Unsupported: ' + e.message; } }
  const snapshotOf = (d) => JSON.stringify([d.id, d.room, d.state()]);
  function snapshot() { return devices.map(snapshotOf).join('|'); }
  /** Devices whose object is currently in the apartment (a removed asset keeps its model but drops off the dashboard). */
  const active = () => devices.filter((d) => { for (let o = d.object; o; o = o.parent) if (o.visible === false) return false; return true; });
  const isOn = (d) => d.controls.some((c) => c.on?.(d.state()));
  return { devices, active, get, run, snapshot, isOn, byName };
}
