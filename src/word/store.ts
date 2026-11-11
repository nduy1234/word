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
  voiceConsent?: boolean;
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
    // Sanitize: a corrupt/hand-edited save must never poison runtime math.
    const cards = p.cards.filter((c) => c && typeof c.wordId === 'string' && Number.isFinite(c.dueAt) && Number.isFinite(c.ease))
      .map((c) => ({ ...c, reps: Math.max(0, Math.floor(c.reps) || 0), lapses: Math.max(0, Math.floor(c.lapses) || 0), intervalDays: Math.max(0, c.intervalDays || 0), ease: Math.max(1.3, c.ease) }));
    const awake = Array.isArray(p.awake) ? p.awake.filter((x): x is string => typeof x === 'string') : [];
    const rawTable = p.tableRelative && typeof p.tableRelative === 'object' && !Array.isArray(p.tableRelative) ? p.tableRelative : {};
    const tableRelative: Record<string, Vec3Like> = {};
    for (const [k, v] of Object.entries(rawTable)) { // drop corrupt offsets: NaN positions must never restore
      if (v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) tableRelative[k] = { x: v.x, y: v.y, z: v.z };
    }
    return { ...emptySave(), ...p, cards, awake, tableRelative };
  } catch { return emptySave(); }
}

/** World -> table-relative (store) and back (restore / re-place on anchor drift). */
export function toTableRelative(world: Vec3Like, tableOrigin: Vec3Like): Vec3Like {
  return { x: world.x - tableOrigin.x, y: world.y - tableOrigin.y, z: world.z - tableOrigin.z };
}
export function fromTableRelative(rel: Vec3Like, tableOrigin: Vec3Like): Vec3Like {
  return { x: rel.x + tableOrigin.x, y: rel.y + tableOrigin.y, z: rel.z + tableOrigin.z };
}
