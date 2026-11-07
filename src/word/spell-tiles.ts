/**
 * Spell tile runtime helpers: tray set, colors (docs/art.md), slot layout,
 * snap distance, cast sentence. Pure — XR wiring lives in word-system.ts.
 * Article tiles use Parchment (little words); other colors = part of speech.
 */
import { articleTile, tileFor, type Tile, type TileKind } from './spell.js';
import { wordById } from './pack.js';

export const TILE_COLORS: Record<TileKind, number> = {
  verb: 0x7c9eff, phrasalVerb: 0x7c9eff, noun: 0x2ec4b6,
  adjective: 0xff9f1c, preposition: 0x9b5de5, article: 0xfff4e0,
};

/** Tray words: two verbs, two articles, adjective, nouns (incl. door for the
 * onboarding spell and table as placement landmark), one preposition. */
export const TILE_IDS = ['open', 'put', 'article-the', 'article-a', 'big', 'cup', 'apple', 'door', 'on', 'table'] as const;

export function buildTiles(): Tile[] {
  const out: Tile[] = [];
  for (const id of TILE_IDS) {
    if (id.startsWith('article-')) { out.push(articleTile(id.slice(8) as 'a' | 'an' | 'the')); continue; }
    const e = wordById(id);
    if (e) out.push(tileFor(e));
  }
  return out;
}

export const TILE_W = 0.105;
export const TILE_GAP = 0.018;
export const SNAP_RADIUS_M = 0.14; // release within this of next slot -> trySnap
export const STRETCH_RATIO = 1.4; // hands spread 40% wider while holding -> plural

/** Tray home: row along table front edge, centered, index left->right. */
export function homeOffset(index: number, count: number): { x: number; y: number; z: number } {
  return { x: (index - (count - 1) / 2) * (TILE_W + TILE_GAP), y: 0.035, z: 0.26 };
}

/** Spell slot: row on table center, grows right from centered start. */
export function slotOffset(index: number, spellLength: number): { x: number; y: number; z: number } {
  return { x: (index - Math.max(0, spellLength - 1) / 2) * (TILE_W + TILE_GAP), y: 0.035, z: -0.02 };
}

export function withinSnap(distanceM: number): boolean { return distanceM <= SNAP_RADIUS_M; }

/** Snapped tiles display in snap order, never tray order. */
export function orderBySnap<T extends { snapSeq: number }>(recs: T[]): T[] {
  return recs.filter((r) => r.snapSeq >= 0).sort((a, b) => a.snapSeq - b.snapSeq);
}

/** Pinch-stretch arms only when hands start close (both pinching the tile). */
export const STRETCH_ARM_MAX_M = 0.35;
export function stretchArmed(startDistM: number | null): boolean {
  return startDistM !== null && startDistM <= STRETCH_ARM_MAX_M;
}

/** Cast line shown/spoken on flick-cast: "open the door!" */
export function castSentence(text: string): string {
  const t = text.trim();
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}!` : '';
}
