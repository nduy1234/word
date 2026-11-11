import { describe, expect, it } from 'vitest';
import { gradeCard, type CardState } from './scheduler.js';
import { wordForSceneLabel } from './pack.js';
import { SCRIPTED_ECHO } from './echo.js';
import { MINIMAL_PAIRS, matchTranscript } from './matching.js';
import { emptySpell, trySnap, articleTile } from './spell.js';
import { load } from './store.js';

const ASCII = /^[\x20-\x7E]*$/;
const mem = (init: Record<string, string>) => ({ getItem: (k: string) => init[k] ?? null, setItem: () => { /* read-only */ } });

describe('audit fixes', () => {
  it('scheduler: corrupt zero-interval card cannot stay due forever', () => {
    const card: CardState = { wordId: 'cup', reps: 4, ease: 2.5, intervalDays: 0, dueAt: 0, lapses: 0 };
    const next = gradeCard(card, 4, 1_000_000);
    expect(next.intervalDays).toBeGreaterThanOrEqual(1);
    expect(next.dueAt).toBeGreaterThan(1_000_000);
  });
  it('scene label lookup is case-insensitive', () => {
    expect(wordForSceneLabel('Table')?.id).toBe('table');
    expect(wordForSceneLabel('DOOR')?.id).toBe('door');
    expect(wordForSceneLabel('spaceship')).toBeUndefined();
  });
  it('caption-bound strings stay ASCII (UIKit font atlas)', () => {
    for (const e of SCRIPTED_ECHO) expect(e.line).toMatch(ASCII);
    for (const [, , hint] of MINIMAL_PAIRS) expect(hint).toMatch(ASCII);
    expect(matchTranscript('dog', 'door').result).toBe('almost');
    const s1 = trySnap(emptySpell(), articleTile('a'));
    expect(s1.ok).toBe(true);
    if (s1.ok) {
      const adj = { entryId: 'big', kind: 'adjective' as const, text: 'big', form: 'base' as const };
      const a1 = trySnap(s1.spell, adj);
      if (a1.ok) { const a2 = trySnap(a1.spell, { ...adj, entryId: 'red', text: 'red' }); expect(a2.ok).toBe(false); if (!a2.ok) expect(a2.hint).toMatch(ASCII); }
    }
  });
  it('store: corrupt table-relative offsets dropped, valid kept', () => {
    const save = JSON.stringify({ version: 1, cards: [], awake: [], tableRelative: { door: { x: 1, y: 2, z: 3 }, wall: { x: 'a', y: 0, z: 0 }, floor: null } });
    const s = load(mem({ 'word-save-v1': save }));
    expect(s.tableRelative).toEqual({ door: { x: 1, y: 2, z: 3 } });
  });
});
