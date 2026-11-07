import { describe, expect, it } from 'vitest';
import { matchTranscript } from './matching.js';
import { unlockedDistricts } from './progression.js';
import { fetchRoomPack } from './room-pack-client.js';
import { askEcho } from './echo.js';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const packJson = (id: string) => ({ words: [{ id, word: id, ipa: '/t/', partOfSpeech: 'noun', plural: `${id}s`, article: 'a', cefr: 'A1', example: `The ${id} is here.`, helper: { es: 'x', vi: 'y' }, sceneLabel: id, wakeFx: 'bloom', rarity: 'common', audio: `audio/en-US/${id}.mp3` }] });

describe('bugfix guards', () => {
  it('phrasal verb matches as phrase; "in" never substring-matches "window"', () => {
    expect(matchTranscript('turn on the lamp', 'turn on').result).toBe('exact');
    expect(matchTranscript('the window', 'in').result).not.toBe('exact');
    expect(matchTranscript('window', 'window').result).toBe('exact');
  });
  it('empty district never blocks unlock chain', () => {
    expect(unlockedDistricts(new Set())).toEqual(['home']); // kitchen still locked by home
    const awake = new Set(['table', 'wall', 'floor', 'ceiling', 'door', 'window', 'couch', 'lamp', 'plant', 'screen', 'cup', 'plate', 'apple', 'chair']);
    // home 10/12 >=80% -> kitchen; kitchen 4/5 >=80% -> cafe; cafe empty -> market pass-through
    expect(unlockedDistricts(awake)).toContain('market');
  });
  it('room-pack offline cache is per-label-set', async () => {
    const s = mem();
    const okFetch = (words: unknown) => async () => ({ ok: true, json: async () => words });
    const a = await fetchRoomPack(['table'], s, okFetch(packJson('table')) as never);
    expect(a.source).toBe('ai');
    const off = async () => { throw new Error('off'); };
    const b = await fetchRoomPack(['table'], s, off as never);
    expect(b.source).toBe('cache'); expect(b.words[0].id).toBe('table');
    const c = await fetchRoomPack(['wall'], s, off as never);
    expect(c.source).toBe('seed'); // different labels: must not reuse table cache
  });
  it('Echo: grammar-invalid spell from AI falls back to scripted', async () => {
    const bad = async () => ({ ok: true, json: async () => ({ line: 'Hi there friend', newWordId: null, spell: ['window', 'open'] }) });
    const r = await askEcho({ knownIds: [] }, { fetchFn: bad as never });
    expect(r.source).toBe('scripted');
    const good = async () => ({ ok: true, json: async () => ({ line: 'Open it', newWordId: null, spell: ['open', 'article-the', 'window'] }) });
    expect((await askEcho({ knownIds: [] }, { fetchFn: good as never })).source).toBe('ai');
  });
});
