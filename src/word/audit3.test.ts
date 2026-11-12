import { describe, expect, it } from 'vitest';
import { validatePack } from './pack-validate.js';
import { validateRoomPack } from './ai-schema.js';
import { fetchRoomPack } from './room-pack-client.js';
import { load, emptySave, type StorageLike } from './store.js';
import { articleTile, emptySpell, tileFor, trySnap } from './spell.js';
import { wordById } from './pack.js';
import { clientKey } from '../../api/_shared.js';

const mem = (init: Record<string, string> = {}): StorageLike => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
};

describe('audit3: pack validation never throws on untrusted types', () => {
  it('non-string ipa/example/word/helper fields rejected, no throw', () => {
    const bad = [{ id: 'x', word: 5, ipa: 5, partOfSpeech: 'noun', plural: 'xs', article: 'a', cefr: 'A1', example: 123, helper: 7, propId: 'x', wakeFx: 'bloom', rarity: 'common', audio: 9 }];
    expect(() => validatePack(bad as never)).not.toThrow();
    expect(validatePack(bad as never).length).toBeGreaterThan(0);
    expect(validateRoomPack({ words: bad })).toBeNull();
  });
  it('example present but word missing: rejected, no throw', () => {
    const bad = [{ id: 'x', ipa: '/x/', partOfSpeech: 'noun', cefr: 'A1', example: 'The x is here.', helper: { es: 'a', vi: 'b' }, propId: 'x', audio: 'a.mp3' }];
    expect(() => validatePack(bad as never)).not.toThrow();
    expect(validatePack(bad as never).join(' ')).toContain('id and word required');
  });
});

describe('audit3: room-pack fetch timeout reaches fallback', () => {
  it('hung fetch (abort-aware) falls back to seed within timeout', async () => {
    const hanging = (_url: string, init: { signal: AbortSignal }) => new Promise((_res, rej) => {
      init.signal.addEventListener('abort', () => rej(new Error('aborted')));
    });
    const r = await fetchRoomPack(['table'], mem(), hanging as never, 10);
    expect(r.source).toBe('seed');
    expect(r.words.length).toBeGreaterThan(0);
  });
});

describe('audit3: corrupt save optional fields sanitized', () => {
  it('string rushBest/petals, malformed streak, non-array cosmetics dropped', () => {
    const raw = JSON.stringify({ ...emptySave(), rushBest: 'fast', petals: 'many', streak: { lastDay: 5, count: 'x' }, ownedCosmetics: 'petal-hat' });
    const s = load(mem({ 'word-save-v1': raw }));
    expect(s.rushBest).toBeUndefined();
    expect(s.petals).toBeUndefined();
    expect(s.streak).toBeUndefined();
    expect(s.ownedCosmetics).toBeUndefined();
  });
  it('valid optional fields normalized, not dropped', () => {
    const raw = JSON.stringify({ ...emptySave(), rushBest: 120, petals: 7.9, streak: { lastDay: '2026-11-10', count: 3, freezesLeft: 9, weekKey: '2026-W46' }, ownedCosmetics: ['petal-hat', 4] });
    const s = load(mem({ 'word-save-v1': raw }));
    expect(s.rushBest).toBe(120);
    expect(s.petals).toBe(7);
    expect(s.streak).toEqual({ lastDay: '2026-11-10', count: 3, freezesLeft: 2, weekKey: '2026-W46' });
    expect(s.ownedCosmetics).toEqual(['petal-hat']);
  });
});

describe('audit3: article-less nouns take "the", never a/an', () => {
  it('"a milk" repels, "the milk" snaps', () => {
    const milk = tileFor(wordById('milk')!);
    const withA = trySnap(emptySpell(), articleTile('a'));
    expect(withA.ok).toBe(true);
    if (withA.ok) expect(trySnap(withA.spell, milk).ok).toBe(false);
    const withThe = trySnap(emptySpell(), articleTile('the'));
    expect(withThe.ok).toBe(true);
    if (withThe.ok) expect(trySnap(withThe.spell, milk).ok).toBe(true);
  });
});

describe('audit3: rate-limit client key is first forwarded hop only', () => {
  it('strips proxy chain so trailing IPs cannot rotate buckets', () => {
    expect(clientKey({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4');
    expect(clientKey({ headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' } })).toBe('1.2.3.4');
    expect(clientKey({ headers: {} })).toBe('local');
  });
});
