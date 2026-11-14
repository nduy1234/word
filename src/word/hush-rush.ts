/** Hush Rush: 60s arcade. Pure state machine; timers pause on hidden/hand-loss. */
export interface RushState { phase: 'idle' | 'running' | 'paused' | 'done'; leftMs: number; score: number; combo: number; best: number; hits: number }
export function newRush(best = 0): RushState { return { phase: 'idle', leftMs: 60_000, score: 0, combo: 0, best, hits: 0 }; }
export function startRush(s: RushState): RushState { return { ...newRush(s.best), phase: 'running' }; }
export function tickRush(s: RushState, dtMs: number): RushState {
  if (s.phase !== 'running') return s;
  const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
  const leftMs = Math.max(0, s.leftMs - dt);
  return leftMs === 0 ? { ...s, leftMs, phase: 'done', best: Math.max(s.best, s.score) } : { ...s, leftMs };
}
export function pauseRush(s: RushState): RushState { return s.phase === 'running' ? { ...s, phase: 'paused' } : s; }
export function resumeRush(s: RushState): RushState { return s.phase === 'paused' ? { ...s, phase: 'running' } : s; }
/** Correct flick: combo multiplier x1..x5. Wrong: combo resets. */
export function hitRush(s: RushState, correct: boolean): RushState {
  if (s.phase !== 'running') return s;
  if (!correct) return { ...s, combo: 0 };
  const combo = Math.min(5, s.combo + 1);
  return { ...s, combo, hits: s.hits + 1, score: s.score + 10 * Math.max(1, combo) };
}
