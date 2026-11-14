/** Aim assist for flicked sprites: curve toward nearest valid target within 15°. Pure. */
export interface Vec3Like { x: number; y: number; z: number }

function norm(v: Vec3Like): Vec3Like {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
function sub(a: Vec3Like, b: Vec3Like): Vec3Like { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function angleDeg(a: Vec3Like, b: Vec3Like): number {
  const denom = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z);
  if (!denom) return 180; // zero vector has no direction: never aim-assist to it
  const d = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / denom));
  return (Math.acos(d) * 180) / Math.PI;
}

export interface AimTarget { id: string; position: Vec3Like }

/** Returns target to snap to, or undefined. maxAngleDeg default 15 (PLAN). */
export function aimAssist(origin: Vec3Like, direction: Vec3Like, targets: AimTarget[], maxAngleDeg = 15): AimTarget | undefined {
  const dir = norm(direction);
  let best: AimTarget | undefined;
  let bestAngle = maxAngleDeg;
  for (const t of targets) {
    const ang = angleDeg(dir, norm(sub(t.position, origin)));
    if (ang <= bestAngle) { bestAngle = ang; best = t; }
  }
  return best;
}

/** Corrected flick direction toward assisted target (or original if none). */
export function assistedDirection(origin: Vec3Like, direction: Vec3Like, targets: AimTarget[], maxAngleDeg = 15): Vec3Like {
  const t = aimAssist(origin, direction, targets, maxAngleDeg);
  return t ? norm(sub(t.position, origin)) : norm(direction);
}
