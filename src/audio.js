// tiny shared UI sounds (Web Audio, created on first use after a user gesture)
let ctx = null;
export function click(freq = 1800, vol = 0.08) {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.45, t + 0.04);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.07);
  } catch { /* no audio */ }
}
