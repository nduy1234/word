/**
 * Spatial preposition checks: deterministic geometry, unit-tested (PLAN).
 * Relations judged in a table frame: origin at table center, +z toward the
 * player, +y up — so "in front of" means the player side of the landmark.
 * Supported v1: on, under, next to, in front of, behind. "in" is excluded:
 * containment needs cavity geometry the room mesh does not guarantee.
 * Boxes are axis-aligned approximations; frame is yaw-only so footprint
 * extents are projected, never exact for rotated props. Assumption noted.
 */

export interface Vec3Like { x: number; y: number; z: number }
export interface BoxLike { center: Vec3Like; size: Vec3Like }

export interface TableFrame {
  origin: Vec3Like;
  right: Vec3Like;
  forward: Vec3Like; // toward player, horizontal
  up: Vec3Like;
}

export const SUPPORTED_PREPOSITIONS = ['on', 'under', 'next-to', 'in-front-of', 'behind'] as const;
export type PrepositionId = (typeof SUPPORTED_PREPOSITIONS)[number];

const ON_GAP_M = 0.03; // resting contact tolerance
const ON_OVERLAP = 0.6; // subject footprint over target
const UNDER_OVERLAP = 0.5;
const NEXT_TO_MIN_M = 0.02;
const NEXT_TO_MAX_M = 0.3;
const LEVEL_BAND_M = 0.3; // next-to: roughly same height as landmark
const FRONT_MAX_M = 0.6; // in-front/behind: max gap along view axis — across-room is not "in front of"
const HYSTERESIS_M = 0.02; // within this outside a threshold = 'almost'
export const SETTLE_MS = 300; // no grading while held or still moving

/**
 * Frame from detected table plane. Tilted normal OK: up projected from plane
 * normal, forward = player direction projected onto plane-horizontal.
 * Returns null when plane missing/degenerate (vertical normal-less, player
 * directly overhead) — caller must fall back to virtual tabletop, never guess.
 */
export function frameFromTablePlane(center: Vec3Like | null | undefined, normal: Vec3Like | null | undefined, playerPos: Vec3Like): TableFrame | null {
  if (!center || !normal) return null;
  const nLen = Math.hypot(normal.x, normal.y, normal.z);
  if (nLen < 1e-6 || Math.abs(normal.y) / nLen < 0.3) return null; // not a horizontal-ish surface
  return makeTableFrame(center, playerPos);
}

export function makeTableFrame(tableCenter: Vec3Like, playerPos: Vec3Like): TableFrame {
  const dx = playerPos.x - tableCenter.x;
  const dz = playerPos.z - tableCenter.z;
  const len = Math.hypot(dx, dz);
  const forward = len < 1e-6 ? { x: 0, y: 0, z: 1 } : { x: dx / len, y: 0, z: dz / len };
  const up = { x: 0, y: 1, z: 0 };
  // right = up x forward
  const right = {
    x: up.y * forward.z - up.z * forward.y,
    y: up.z * forward.x - up.x * forward.z,
    z: up.x * forward.y - up.y * forward.x,
  };
  return { origin: { ...tableCenter }, right, forward, up };
}

/** World point -> table-frame coords (x right, y up, z toward player). */
export function toTableFrame(p: Vec3Like, frame: TableFrame): Vec3Like {
  const d = { x: p.x - frame.origin.x, y: p.y - frame.origin.y, z: p.z - frame.origin.z };
  const dot = (a: Vec3Like, b: Vec3Like) => a.x * b.x + a.y * b.y + a.z * b.z;
  return { x: dot(d, frame.right), y: dot(d, frame.up), z: dot(d, frame.forward) };
}

interface LocalBox { cx: number; cy: number; cz: number; hx: number; hy: number; hz: number }

function localBox(box: BoxLike, frame: TableFrame): LocalBox {
  const c = toTableFrame(box.center, frame);
  const hx = box.size.x / 2;
  const hy = box.size.y / 2;
  const hz = box.size.z / 2;
  return {
    cx: c.x, cy: c.y, cz: c.z, hy,
    hx: Math.abs(frame.right.x) * hx + Math.abs(frame.forward.x) * hz,
    hz: Math.abs(frame.right.z) * hx + Math.abs(frame.forward.z) * hz,
  };
}

export type Relation = PrepositionId | 'none';

export function classifyRelation(subject: BoxLike, target: BoxLike, frame: TableFrame, slack = 0): Relation {
  const s = localBox(subject, frame);
  const t = localBox(target, frame);
  const overlapX = Math.min(s.cx + s.hx, t.cx + t.hx) - Math.max(s.cx - s.hx, t.cx - t.hx);
  const overlapZ = Math.min(s.cz + s.hz, t.cz + t.hz) - Math.max(s.cz - s.hz, t.cz - t.hz);
  const overlapRatio = (Math.max(0, overlapX) * Math.max(0, overlapZ)) / ((2 * s.hx) * (2 * s.hz) || 1);
  const sBottom = s.cy - s.hy;
  const sTop = s.cy + s.hy;
  const tTop = t.cy + t.hy;
  const tBottom = t.cy - t.hy;

  if (Math.abs(sBottom - tTop) <= ON_GAP_M + slack && overlapRatio >= ON_OVERLAP - slack) return 'on';
  if (sTop <= tTop + slack && overlapRatio >= UNDER_OVERLAP - slack) return 'under';

  const lateralOverlap = overlapX > -slack;
  const gapFront = (s.cz - s.hz) - (t.cz + t.hz);
  const gapBehind = (t.cz - t.hz) - (s.cz + s.hz);
  if (gapFront >= -slack && gapFront <= FRONT_MAX_M + slack && lateralOverlap) return 'in-front-of';
  if (gapBehind >= -slack && gapBehind <= FRONT_MAX_M + slack && lateralOverlap) return 'behind';

  const gapX = Math.max(0, Math.abs(s.cx - t.cx) - (s.hx + t.hx));
  const gapZ = Math.max(0, Math.abs(s.cz - t.cz) - (s.hz + t.hz));
  const gap = Math.hypot(gapX, gapZ);
  const level = sBottom <= tTop + LEVEL_BAND_M && sTop >= tBottom - LEVEL_BAND_M;
  if (gap >= NEXT_TO_MIN_M - slack && gap <= NEXT_TO_MAX_M + slack && level) return 'next-to';
  return 'none';
}

const EXPECTED: Record<string, PrepositionId | 'in'> = {
  on: 'on', under: 'under', behind: 'behind',
  'next-to': 'next-to', 'next to': 'next-to',
  'in-front-of': 'in-front-of', 'in front of': 'in-front-of',
  in: 'in',
};

const READABLE: Record<Relation, string> = {
  on: 'on', under: 'under', 'next-to': 'next to',
  'in-front-of': 'in front of', behind: 'behind', none: 'not near',
};

export type PrepResult = 'correct' | 'almost' | 'wrong' | 'pending' | 'unsupported';
export interface PrepCheck { result: PrepResult; relation: Relation; hint: string }

/**
 * Grade a placed prop. held=true or stillMs<SETTLE_MS -> 'pending' (never
 * grade a moving prop). Within HYSTERESIS_M outside a threshold -> 'almost'.
 */
export function checkPreposition(
  expectedWord: string,
  subject: BoxLike,
  target: BoxLike,
  frame: TableFrame,
  opts: { held?: boolean; stillMs?: number; targetName?: string } = {},
): PrepCheck {
  const expected = EXPECTED[expectedWord.toLowerCase()];
  if (!expected) return { result: 'unsupported', relation: 'none', hint: `Echo cannot check "${expectedWord}" yet.` };
  const relation = classifyRelation(subject, target, frame);
  if (expected === 'in') {
    return { result: 'unsupported', relation, hint: 'Echo cannot check "in" yet - try "on" or "under".' };
  }
  if (opts.held || (opts.stillMs ?? 0) < SETTLE_MS) {
    return { result: 'pending', relation, hint: 'Hold still...' };
  }
  const name = opts.targetName ?? 'the table';
  if (relation === expected) {
    return { result: 'correct', relation, hint: `Yes! ${READABLE[expected]} ${name}.` };
  }
  if (classifyRelation(subject, target, frame, HYSTERESIS_M) === expected) {
    return { result: 'almost', relation, hint: `Almost - a tiny bit more ${READABLE[expected]} ${name}.` };
  }
  return {
    result: 'wrong', relation,
    hint: relation === 'none'
      ? `Echo wants it ${READABLE[expected]} ${name}.`
      : `It is ${READABLE[relation]} ${name}. Echo wants ${READABLE[expected]}.`,
  };
}
