/** FoV comfort: essential UI within ±25° cone, lazy head-follow. Pure math. */
export const FOV_HALF_DEG = 25;
const rad = (d: number) => (d * Math.PI) / 180;
/** Clamp target yaw offset (deg, relative head) into central cone. */
export function clampToCone(yawDeg: number): number { return Math.max(-FOV_HALF_DEG, Math.min(FOV_HALF_DEG, yawDeg)); }
export function inCone(yawDeg: number, pitchDeg = 0): boolean { return Math.abs(yawDeg) <= FOV_HALF_DEG && Math.abs(pitchDeg) <= FOV_HALF_DEG; }
/** Lazy follow: panel moves a fraction toward head yaw only when head leaves deadband. */
export function lazyFollow(panelYawDeg: number, headYawDeg: number, deadbandDeg = 10, rate = 0.08): number {
  const diff = headYawDeg - panelYawDeg;
  if (Math.abs(diff) <= deadbandDeg) return panelYawDeg;
  return panelYawDeg + (diff - Math.sign(diff) * deadbandDeg) * rate;
}
/** Panel distance for readable text at Quest 3S min size (m). */
export const PANEL_DISTANCE_M = 1.2;
export { rad as degToRad };
