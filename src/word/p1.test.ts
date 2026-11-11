import { describe, expect, it } from 'vitest';
import { CAFE_PROPS, wordById } from './pack.js';
import { DISTRICTS, atlasSummary, muralPercent, unlockedDistricts } from './progression.js';
import { load, emptySave, type StorageLike } from './store.js';

const mem = (init: Record<string, string> = {}): StorageLike => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
};

describe('P1 cafe district', () => {
  it('cafe props exist, resolve by id, and match district list', () => {
    expect(CAFE_PROPS.length).toBe(12);
    for (const p of CAFE_PROPS) expect(wordById(p.id)?.word).toBe(p.word);
    const cafe = DISTRICTS.find((d) => d.id === 'cafe');
    expect(cafe?.wordIds).toEqual(CAFE_PROPS.map((w) => w.id));
  });
  it('cafe locked until home+kitchen 80%, then unlocks; market stays locked', () => {
    expect(unlockedDistricts(new Set(['cup', 'plate', 'apple', 'chair']))).not.toContain('cafe'); // kitchen done, home not
    const awake = new Set(['table', 'wall', 'floor', 'ceiling', 'door', 'window', 'couch', 'lamp', 'plant', 'screen', 'cup', 'plate', 'apple', 'chair']);
    expect(unlockedDistricts(awake)).toContain('cafe');
    expect(unlockedDistricts(awake)).not.toContain('market');
  });
});

describe('P1 atlas + mural', () => {
  it('atlas summary counts awake/mastered and per-district percent', () => {
    const s = atlasSummary(new Set(['table', 'cup']), new Set(['cup']));
    expect(s.awakeCount).toBe(2);
    expect(s.masteredCount).toBe(1);
    expect(s.total).toBe(29);
    expect(s.lines.some((l) => l.startsWith('Kitchen'))).toBe(true);
    expect(s.lines.some((l) => l.startsWith('Cafe'))).toBe(true);
  });
  it('mural percent spans all districts', () => {
    expect(muralPercent(new Set())).toBe(0);
    expect(muralPercent(new Set(['milk']))).toBeGreaterThan(0);
  });
});

describe('audit fix: store sanitize', () => {
  it('corrupt cards/tableRelative are dropped, ease clamped', () => {
    const raw = JSON.stringify({
      ...emptySave(),
      cards: [
        { wordId: 'cup', reps: 1, ease: 0.5, intervalDays: 1, dueAt: 5, lapses: 0 },
        { wordId: 42, reps: 0, ease: 2.5, intervalDays: 0, dueAt: 5, lapses: 0 },
        { wordId: 'door', reps: 0, ease: 2.5, intervalDays: 0, dueAt: null, lapses: 0 },
      ],
      awake: ['cup', 7],
      tableRelative: ['not-a-record'],
    } as Record<string, unknown>);
    const s = load(mem({ 'word-save-v1': raw }));
    expect(s.cards.map((c) => c.wordId)).toEqual(['cup']);
    expect(s.cards[0].ease).toBe(1.3);
    expect(s.awake).toEqual(['cup']);
    expect(s.tableRelative).toEqual({});
  });
});
