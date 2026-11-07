/** Sound pass: synthesized SFX (docs/art.md pairing), zero assets, offline. Every failure silent. */
export type Sfx = 'pop' | 'snap' | 'whoosh' | 'wake' | 'boing' | 'click';
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try { ctx ??= new AudioContext(); return ctx; } catch { return null; }
}
function tone(freq: number, t: number, dur: number, type: OscillatorType, gain = 0.15): void {
  const a = ac(); if (!a) return;
  try {
    const o = a.createOscillator(); const g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + t);
    g.gain.setValueAtTime(gain, a.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + t + dur);
    o.connect(g).connect(a.destination); o.start(a.currentTime + t); o.stop(a.currentTime + t + dur);
  } catch { /* audio unavailable */ }
}
export function playSfx(sfx: Sfx, muted = false): void {
  if (muted) return;
  try { void ac()?.resume(); } catch { /* ignore */ }
  switch (sfx) {
    case 'pop': tone(520, 0, 0.08, 'sine', 0.2); break;
    case 'click': tone(900, 0, 0.04, 'square', 0.08); break;
    case 'snap': tone(700, 0, 0.05, 'square', 0.1); tone(1050, 0.05, 0.06, 'square', 0.1); break;
    case 'whoosh': tone(300, 0, 0.18, 'sawtooth', 0.05); break;
    case 'boing': tone(160, 0, 0.22, 'sine', 0.15); break;
    case 'wake': [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.25, 'triangle', 0.15)); break; // chord bloom
  }
}
