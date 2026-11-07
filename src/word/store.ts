/** Persistence + table-relative anchor fallback. Pure storage logic, unit-tested.
 * Persistent XR anchors attempted at runtime layer; this module is the guaranteed
 * fallback: positions stored relative to table origin, survives restart/re-localize. */
import type { CardState } from './scheduler.js';

export interface Vec3Like { x: number; y: number; z: number }
export interface SaveState {
  version: 1;
  cards: CardState[];
  awake: string[];
  helperLang: string;
  immersion: boolean;
  tableRelative: Record<string, Vec3Like>; // wordId -> offset from table origin
  petals?: number;
  ownedCosmetics?: string[];
  rushBest?: number;
  streak?: { lastDay: string; count: number; freezesLeft: number; weekKey: string };
  a11y?: { highContrast: boolean; captionScale: number; reducedMotion: boolean; colorblindSafe: boolean };
  onboarding?: string;
  onboardingDone?: boolean;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const KEY = 'word-save-v1';

export function emptySave(): SaveState {
  return { version: 1, cards: [], awake: [], helperLang: 'auto', immersion: false, tableRelative: {} };
}

export function save(storage: StorageLike, state: SaveState): void {
  try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full/blocked: session continues */ }
}

export function load(storage: StorageLike): SaveState {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptySave();
    const p = JSON.parse(raw) as SaveState;
    if (p.version !== 1 || !Array.isArray(p.cards)) return emptySave();
    return { ...emptySave(), ...p };
  } catch { return emptySave(); }
}

/** World -> table-relative (store) and back (restore / re-place on anchor drift). */
export function toTableRelative(world: Vec3Like, tableOrigin: Vec3Like): Vec3Like {
  return { x: world.x - tableOrigin.x, y: world.y - tableOrigin.y, z: world.z - tableOrigin.z };
}
export function fromTableRelative(rel: Vec3Like, tableOrigin: Vec3Like): Vec3Like {
  return { x: rel.x + tableOrigin.x, y: rel.y + tableOrigin.y, z: rel.z + tableOrigin.z };
}
