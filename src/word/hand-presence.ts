/** Hand-presence producer for PauseGate 'hands-lost'. Pure tracker, unit-tested.
 * Source (verified in @iwsdk/xr-input typings): world.input.xr.getPrimaryInputSource(side)
 * returns XRInputSource|undefined; `.hand` set only for hand-tracked sources.
 * Grace 1s: brief tracking flicker never pauses. Only judged while immersive. */
export const HAND_GRACE_MS = 1000;
export class HandLossTracker {
  private missingSince: number | null = null;
  private lost = false;
  /** Returns 'lost' | 'back' | null on transitions only. */
  update(handsPresent: boolean, immersive: boolean, nowMs: number): 'lost' | 'back' | null {
    if (!immersive) { this.missingSince = null; if (this.lost) { this.lost = false; return 'back'; } return null; }
    if (handsPresent) {
      this.missingSince = null;
      if (this.lost) { this.lost = false; return 'back'; }
      return null;
    }
    this.missingSince ??= nowMs;
    if (!this.lost && nowMs - this.missingSince >= HAND_GRACE_MS) { this.lost = true; return 'lost'; }
    return null;
  }
  get isLost(): boolean { return this.lost; }
}
/** Structural read of an XRInputSource-like: hand set => hand-tracked. */
export function sourceIsHand(src: { hand?: unknown } | undefined | null): boolean { return Boolean(src?.hand); }
