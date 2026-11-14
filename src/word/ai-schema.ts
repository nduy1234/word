/** Strict AI output schemas. Model output validated, never executed. Pure. */
import { validatePack } from './pack-validate.js';
import type { WordEntry } from './pack.js';
import { emptySpell, trySnap, tileFor, articleTile, type Spell } from './spell.js';

export interface EchoResponse { line: string; newWordId: string | null; spell: string[] }
export interface RoomPackResponse { words: WordEntry[] }

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function isValidId(v: unknown): v is string { return typeof v === 'string' && v.length <= 40 && ID_RE.test(v); }

/** Semantic label names ONLY: lowercase words/hyphens, max 32, deduped. No geometry ever. */
export function sanitizeLabels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== 'string') continue;
    const s = v.toLowerCase().trim().slice(0, 40);
    if (/^[a-z]+(?:[ -][a-z]+)*$/.test(s) && !out.includes(s)) out.push(s);
    if (out.length >= 32) break;
  }
  return out;
}

export function validateEchoResponse(v: unknown, knownIds: Set<string>): EchoResponse | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.line !== 'string' || !o.line.trim() || o.line.length > 160) return null;
  if (/[<>{}]/.test(o.line)) return null;
  const rawNew = o.newWordId === null || o.newWordId === undefined ? null : o.newWordId;
  if (rawNew !== null && !isValidId(rawNew)) return null;
  const newWordId: string | null = rawNew !== null && knownIds.has(rawNew as string) ? null : (rawNew as string | null); // already known != new
  if (!Array.isArray(o.spell) || o.spell.length > 8 || !o.spell.every((t) => typeof t === 'string' && t.length <= 30)) return null;
  return { line: o.line.trim(), newWordId, spell: o.spell as string[] };
}

/** Rebuild spell from token ids using pack entries; null if any token invalid/un-snappable. */
export function spellFromIds(ids: string[], byId: (id: string) => WordEntry | undefined): Spell | null {
  let spell = emptySpell();
  for (const id of ids) {
    if (id.startsWith('article-') && !['article-a', 'article-an', 'article-the'].includes(id)) return null;
    const tile = id.startsWith('article-') ? articleTile(id.slice(8) as 'a' | 'an' | 'the')
      : (() => { const e = byId(id); return e ? tileFor(e) : null; })();
    if (!tile) return null;
    const r = trySnap(spell, tile);
    if (!r.ok) return null;
    spell = r.spell;
  }
  return spell;
}

export function validateRoomPack(v: unknown): RoomPackResponse | null {
  if (!v || typeof v !== 'object') return null;
  const words = (v as Record<string, unknown>).words;
  if (!Array.isArray(words) || words.length === 0 || words.length > 60) return null;
  if (validatePack(words as WordEntry[], 'room-pack').length) return null;
  return { words: words as WordEntry[] };
}
