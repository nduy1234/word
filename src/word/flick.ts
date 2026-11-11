/** Flick gesture math: hand speed detection + sprite flight path. Pure.
 * A flick = pinch while the hand moves fast; the Word Sprite then flies on a
 * slightly arced path to the aim-assisted target and wakes it on arrival. */
import type { Vec3Like } from './aim-assist.js';

export const FLICK_MIN_SPEED_MS = 1.0; // m/s: forgiving for hand-tracking noise
export const FLICK_FLIGHT_MS = 280;

export function handSpeedMs(prev: Vec3Like, cur: Vec3Like, dtMs: number): number {
  if (dtMs <= 0) return 0;
  return Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z) / (dtMs / 1000);
}

export function isFlick(speedMs: number, minMs: number = FLICK_MIN_SPEED_MS): boolean {
  return speedMs >= minMs;
}

/** Point along the flick flight: lerp + upward arc, t clamped 0..1. */
export function spritePoint(from: Vec3Like, to: Vec3Like, t: number, arcM = 0.05): Vec3Like {
  const k = Math.max(0, Math.min(1, t));
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * arcM,
    z: from.z + (to.z - from.z) * k,
  };
}
