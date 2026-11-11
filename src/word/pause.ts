/** Pause/resume gate: visibility loss, system menu (blur), hand-tracking loss. Pure. */
export type PauseReason = 'hidden' | 'blur' | 'hands-lost' | 'session-end';
export class PauseGate {
  private reasons = new Set<PauseReason>();
  add(r: PauseReason): boolean { const was = this.paused; this.reasons.add(r); return !was && this.paused; }
  remove(r: PauseReason): boolean { const was = this.paused; this.reasons.delete(r); return was && !this.paused; }
  get paused(): boolean { return this.reasons.size > 0; }
  get active(): PauseReason[] { return [...this.reasons]; }
  clear(): void { this.reasons.clear(); }
}
/** Ghost shown when hands lost; timers (incl Hush Rush) freeze while paused. */
export function pauseHint(reasons: PauseReason[]): string {
  if (reasons.includes('hands-lost')) return 'Show your hands';
  if (reasons.includes('hidden') || reasons.includes('session-end')) return 'Paused - your room is saved';
  return 'Paused';
}
