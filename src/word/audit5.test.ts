import { describe, expect, it } from 'vitest';
import { load, save, type StorageLike } from './store.js';
import { validateEchoResponse } from './ai-schema.js';
import { validatePack } from './pack-validate.js';
import { gradeCard, newCard, fadeAmount } from './scheduler.js';
import { tickRush, startRush, newRush } from './hush-rush.js';
import { visitStreak } from './progression.js';
import { assessPerf } from './perf.js';
import { angleDeg, aimAssist } from './aim-assist.js';
import { ROOM_WORDS, KITCHEN_PROPS, CAFE_PROPS, VERBS, PHRASAL_VERBS, PREPOSITIONS, ADJECTIVES } from './pack.js';

const mem = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
};

describe('audit5: corrupt save reconciliation', () => {
  it('awake id without card gets a due-now synthesized card; a11y/helper sanitized', () => {
    const s = mem();
    s.setItem('word-save-v1', JSON.stringify({
      version: 1,
      cards: [{ wordId: 'cup', reps: 1, ease: 2.5, intervalDays: 1, dueAt: 1000, lapses: 0 }],
      awake: ['cup', 'ghost'],
      helperLang: 'fr', immersion: 'yes', voiceConsent: 'yes', onboardingDone: 'yes',
      tableRelative: {},
      a11y: { highContrast: 'yes', captionScale: 99, reducedMotion: true, colorblindSafe: 'no' },
    }));
    const out = load(s);
    expect(out.awake).toEqual(['cup', 'ghost']);
    const ghost = out.cards.find((c) => c.wordId === 'ghost');
    expect(ghost).toBeTruthy();
    expect(ghost!.dueAt).toBeLessThanOrEqual(Date.now());
    expect(out.helperLang).toBe('auto');
    expect(out.immersion).toBe(false);
    expect(out.voiceConsent).toBe(false);
    expect(out.onboardingDone).toBe(false);
    expect(out.a11y).toEqual({ highContrast: false, captionScale: 1, reducedMotion: true, colorblindSafe: true });
  });
  it('round-trips a clean save', () => {
    const s = mem();
    save(s, { version: 1, cards: [newCard('cup', 0)], awake: ['cup'], helperLang: 'es', immersion: false, tableRelative: {} });
    expect(load(s).awake).toEqual(['cup']);
  });
});

describe('audit5: validator hardening', () => {
  it('echo newWordId already known becomes null, line survives', () => {
    expect(validateEchoResponse({ line: 'Great job!', newWordId: 'cup', spell: [] }, new Set(['cup']))?.newWordId).toBeNull();
    expect(validateEchoResponse({ line: 'Great job!', newWordId: 'door', spell: [] }, new Set(['cup']))?.newWordId).toBe('door');
  });
  it('pack rejects non-string plural, bad rarity, missing wakeFx', () => {
    const base = { id: 'x', word: 'x', ipa: '/x/', partOfSpeech: 'noun', plural: 'xs', article: 'a', cefr: 'A1', example: 'The x is here.', helper: { es: 'x', vi: 'y' }, propId: 'x', wakeFx: 'bloom', rarity: 'common', audio: 'a.mp3' };
    expect(validatePack([base] as never)).toEqual([]);
    expect(validatePack([{ ...base, plural: 5 }] as never).join(' ')).toContain('plural');
    expect(validatePack([{ ...base, rarity: 'epic' }] as never).join(' ')).toContain('rarity');
    expect(validatePack([{ ...base, wakeFx: '' }] as never).join(' ')).toContain('wakeFx');
  });
});

describe('audit5: numeric guards', () => {
  it('gradeCard recovers from NaN card fields', () => {
    const c = gradeCard({ wordId: 'x', reps: NaN, ease: NaN, intervalDays: NaN, dueAt: 0, lapses: NaN }, 4, 0);
    expect(Number.isFinite(c.ease)).toBe(true);
    expect(c.dueAt).toBeGreaterThan(0);
  });
  it('fadeAmount with bad window is 1 when overdue', () => {
    expect(fadeAmount(newCard('x', 0), 1000, 0)).toBe(1);
    expect(fadeAmount(newCard('x', 5000), 1000, 0)).toBe(0);
  });
  it('tickRush ignores NaN/negative dt', () => {
    const r = startRush(newRush(0));
    expect(tickRush(r, NaN).leftMs).toBe(60_000);
    expect(tickRush(r, -5000).leftMs).toBe(60_000);
    expect(tickRush(r, 1000).leftMs).toBe(59_000);
  });
  it('assessPerf flags NaN sample', () => {
    expect(assessPerf({ fps: NaN, drawCalls: 10, triangles: 10 }).ok).toBe(false);
  });
  it('angleDeg handles non-unit and zero vectors', () => {
    expect(angleDeg({ x: 2, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(0);
    expect(angleDeg({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(180);
    expect(aimAssist({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, [{ id: 'a', position: { x: 0, y: 0, z: -1 } }])).toBeUndefined();
  });
  it('visitStreak with future lastDay keeps streak', () => {
    const s = visitStreak({ lastDay: '2999-01-02', count: 7, freezesLeft: 2, weekKey: '2999-W1' }, Date.parse('2026-11-13T00:00:00Z'));
    expect(s.count).toBe(7);
    expect(s.lastDay).toBe('2999-01-02');
  });
  it('seed audio paths match generate_audio output (public/assets/audio/*.wav)', () => {
    const all = [...ROOM_WORDS, ...KITCHEN_PROPS, ...CAFE_PROPS, ...VERBS, ...PHRASAL_VERBS, ...PREPOSITIONS, ...ADJECTIVES];
    for (const w of all) {
      expect(w.audio).toBe(`assets/audio/en-US/${w.id}.wav`);
      expect(validatePack([w], 'seed')).toEqual([]);
    }
  });
});
