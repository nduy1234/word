/** Palm-up menu detection. Pure geometry; runtime supplies palm normal/pos. */
import type { Vec3Like } from './panel-follow.js';

export function norm(v: Vec3Like): Vec3Like {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
/** True when palm normal points toward head and hand is within reach of face. */
export function palmFacingHead(palmNormal: Vec3Like, handPos: Vec3Like, headPos: Vec3Like, minDot = 0.7, maxDistM = 0.75): boolean {
  const toHead = norm({ x: headPos.x - handPos.x, y: headPos.y - handPos.y, z: headPos.z - handPos.z });
  const n = norm(palmNormal);
  const dot = toHead.x * n.x + toHead.y * n.y + toHead.z * n.z;
  const dist = Math.hypot(headPos.x - handPos.x, headPos.y - handPos.y, headPos.z - handPos.z);
  return dot >= minDot && dist <= maxDistM;
}
/** Rotate vector by quaternion (v + 2*cross(qv, cross(qv,v) + w*v)). */
export function rotateByQuat(v: Vec3Like, q: { x: number; y: number; z: number; w: number }): Vec3Like {
  const cx1 = q.y * v.z - q.z * v.y;
  const cy1 = q.z * v.x - q.x * v.z;
  const cz1 = q.x * v.y - q.y * v.x;
  const ix = cx1 + q.w * v.x, iy = cy1 + q.w * v.y, iz = cz1 + q.w * v.z;
  const cx2 = q.y * iz - q.z * iy;
  const cy2 = q.z * ix - q.x * iz;
  const cz2 = q.x * iy - q.y * ix;
  return { x: v.x + 2 * cx2, y: v.y + 2 * cy2, z: v.z + 2 * cz2 };
}
/** Palm normal: local palm axis (0,-1,0) of grip space rotated to world. */
export function palmNormalFromQuat(q: { x: number; y: number; z: number; w: number }): Vec3Like {
  return rotateByQuat({ x: 0, y: -1, z: 0 }, q);
}
