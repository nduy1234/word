/** Pure head-follow math for in-world panels. Uses fov.ts cone + lazy follow. */
import { clampToCone, lazyFollow, degToRad } from './fov.js';

export interface Vec3Like { x: number; y: number; z: number }

/** Head yaw (deg) from camera forward vector. Forward = (-sin yaw, 0, -cos yaw). */
export function yawFromForward(f: Vec3Like): number {
  return (Math.atan2(-f.x, -f.z) * 180) / Math.PI;
}
export function forwardFromYaw(yawDeg: number): Vec3Like {
  const r = degToRad(yawDeg);
  return { x: -Math.sin(r), y: 0, z: -Math.cos(r) };
}
/** Next panel yaw: clamp head offset into ±25° cone, then lazy-follow with deadband. */
export function nextPanelYaw(panelYawDeg: number, headYawDeg: number): number {
  let diff = headYawDeg - panelYawDeg;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  const target = panelYawDeg + clampToCone(diff);
  return lazyFollow(panelYawDeg, target, 10, 0.15);
}
/** Panel world position: head + forward(panelYaw)*distance + vertical offset. */
export function panelPosition(head: Vec3Like, panelYawDeg: number, distanceM: number, verticalOffsetM: number): Vec3Like {
  const f = forwardFromYaw(panelYawDeg);
  return { x: head.x + f.x * distanceM, y: head.y + verticalOffsetM, z: head.z + f.z * distanceM };
}
/** Panel Y rotation (rad) so its +Z face points back toward head. */
export function panelRotationY(panelYawDeg: number): number { return degToRad(panelYawDeg); }
