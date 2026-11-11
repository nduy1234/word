import { describe, expect, it } from 'vitest';
import { gradeCard, isDue, newCard, fadeAmount } from './scheduler.js';
import { matchTranscript, stressHint } from './matching.js';
import { validatePack } from './pack-validate.js';
import { ADJECTIVES, KITCHEN_PROPS, PHRASAL_VERBS, PREPOSITIONS, ROOM_WORDS, VERBS } from './pack.js';
import { buildDeck } from './deck.js';
import { emptySave, fromTableRelative, load, save, toTableRelative } from './store.js';
import { aimAssist, assistedDirection } from './aim-assist.js';
import { cycleHelper, detectHelper, helperText } from './helper.js';
import { voiceWake } from './voice-wake.js';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

describe('scheduler SM-2', () => {
  it('new card due now; good grades grow interval 1d, 6d, then ease-scaled', () => {
    let c = newCard('table', T0);
    expect(isDue(c, T0)).toBe(true);
    c = gradeCard(c, 4, T0); expect(c.dueAt).toBe(T0 + DAY);
    c = gradeCard(c, 4, T0); expect(c.dueAt).toBe(T0 + 6 * DAY);
    c = gradeCard(c, 4, T0); expect(c.intervalDays).toBeGreaterThan(6);
  });
  it('wrong grade relearns in 10 min, ease floors at 1.3', () => {
    let c = newCard('cup', T0);
    for (let i = 0; i < 10; i++) c = gradeCard(c, 0, T0);
    expect(c.dueAt).toBe(T0 + 600_000); expect(c.ease).toBe(1.3); expect(c.lapses).toBe(10);
  });
  it('fade grows after due', () => {
    const c = { ...newCard('door', T0), dueAt: T0 };
    expect(fadeAmount(c, T0)).toBe(0);
    expect(fadeAmount(c, T0 + 3 * DAY)).toBe(1);
  });
});

describe('pack validation', () => {
  it('all seed packs valid', () => {
    expect(validatePack(ROOM_WORDS, 'room')).toEqual([]);
    expect(validatePack(KITCHEN_PROPS, 'kitchen')).toEqual([]);
    expect(validatePack([...VERBS, ...PHRASAL_VERBS, ...PREPOSITIONS, ...ADJECTIVES], 'grammar')).toEqual([]);
  });
  it('catches duplicate, missing article, bad binding', () => {
    const bad = [{ ...ROOM_WORDS[0] }, { ...ROOM_WORDS[0], article: undefined as never }];
    expect(validatePack(bad).length).toBeGreaterThanOrEqual(2);
  });
});

describe('word matching', () => {
  it('exact ignores article/case', () => {
    expect(matchTranscript('The Window!', 'window').result).toBe('exact');
  });
  it('minimal pairs give almost + hint', () => {
    const r = matchTranscript('sheep', 'ship');
    expect(r.result).toBe('almost'); if (r.result === 'almost') expect(r.kind).toBe('minimal-pair');
    expect(matchTranscript('right', 'light').result).toBe('almost');
    expect(matchTranscript('light', 'light').result).toBe('exact');
  });
  it('close typo almost, unrelated wrong; stress dots', () => {
    expect(matchTranscript('tabel', 'table').result).toBe('almost');
    expect(matchTranscript('banana', 'table').result).toBe('wrong');
    expect(stressHint('table', '/ˈteɪbəl/', 2)).toContain('BIG-small');
  });
});

describe('deck, store, aim, helper', () => {
  it('due reviews before new, capped', () => {
    const cards = new Map([['table', { ...newCard('table', T0), dueAt: T0 - DAY }]]);
    const deck = buildDeck(cards, ['table', 'cup', 'door'], T0, { maxNew: 1 });
    expect(deck.map((q) => q.wordId)).toEqual(['table', 'cup']);
    expect(deck[0].kind).toBe('review');
  });
  it('save survives restart; table-relative round trip', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const s = emptySave(); s.awake = ['table']; s.tableRelative['window'] = toTableRelative({ x: 3, y: 2, z: 1 }, { x: 1, y: 1, z: 1 });
    save(storage, s);
    const back = load(storage);
    expect(back.awake).toEqual(['table']);
    expect(fromTableRelative(back.tableRelative['window'], { x: 1, y: 1, z: 1 })).toEqual({ x: 3, y: 2, z: 1 });
    expect(load({ getItem: () => '{bad', setItem: () => {} }).version).toBe(1);
  });
  it('aim assist snaps within 15 deg only', () => {
    const o = { x: 0, y: 0, z: 0 };
    const near = { id: 'a', position: { x: 0.1, y: 0, z: -1 } };
    const far = { id: 'b', position: { x: 1, y: 0, z: -0.2 } };
    expect(aimAssist(o, { x: 0, y: 0, z: -1 }, [near, far])?.id).toBe('a');
    expect(aimAssist(o, { x: 0, y: 0, z: -1 }, [far])).toBeUndefined();
    expect(assistedDirection(o, { x: 0, y: 0, z: -1 }, [near]).z).toBeLessThan(0);
  });
  it('helper detect/cycle/immersion', () => {
    expect(detectHelper('es-MX')).toBe('es'); expect(detectHelper('vi-VN')).toBe('vi'); expect(detectHelper('fr-FR')).toBe('none');
    expect(cycleHelper('es')).toBe('vi');
    const cup = KITCHEN_PROPS[0];
    expect(helperText(cup, 'es', false)).toBe(cup.helper.es);
    expect(helperText(cup, 'es', true)).toBe('');
  });
});

describe('voice wake', () => {
  const recorder = { record: async () => new Blob(['x']) };
  it('online exact', async () => {
    const fetcher = async () => ({ ok: true, json: async () => ({ text: 'window' }) });
    const r = await voiceWake({ targetWord: 'window', recorder, fetcher });
    expect(r.result).toBe('exact');
  });
  it('offline falls back cleanly', async () => {
    const fetcher = async () => { throw new Error('network'); };
    expect(await voiceWake({ targetWord: 'window', recorder, fetcher })).toEqual({ result: 'fallback', reason: 'offline' });
  });
  it('timeout falls back; mic denied falls back', async () => {
    const slow = (_url: string, init: { signal: AbortSignal }) => new Promise<{ ok: boolean; json(): Promise<{ text?: string }> }>((_res, rej) => {
      init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); });
    });
    const r = await voiceWake({ targetWord: 'window', recorder, fetcher: slow as never, timeoutMs: 20 });
    expect(r).toEqual({ result: 'fallback', reason: 'timeout' });
    const denied = { record: async () => { throw new Error('denied'); } };
    expect((await voiceWake({ targetWord: 'window', recorder: denied })).result).toBe('fallback');
  });
});
