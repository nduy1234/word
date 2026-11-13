import { describe, expect, it } from 'vitest';
import { matchTranscript } from './matching.js';
import { unlockedDistricts } from './progression.js';
import { fetchRoomPack } from './room-pack-client.js';
import { askEcho } from './echo.js';
import { checkPreposition, classifyRelation, makeTableFrame, type BoxLike } from './preposition-check.js';
import { spellFromIds } from './ai-schema.js';
import { wordById } from './pack.js';
import { HandLossTracker, sourceIsHand, HAND_GRACE_MS } from './hand-presence.js';
import { validatePack } from './pack-validate.js';
import { validateRoomPack } from './ai-schema.js';
import transcribeHandler from '../../api/transcribe.js';

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
    // home 10/12 >=80% -> kitchen; kitchen 4/5 >=80% -> cafe (now a real district, blocks market until 80%)
    expect(unlockedDistricts(awake)).toContain('cafe');
    expect(unlockedDistricts(awake)).not.toContain('market');
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
  it('Echo: grammar-invalid spell from AI drops tiles, line stays AI (not scripted)', async () => {
    const bad = async () => ({ ok: true, json: async () => ({ line: 'Hi there friend', newWordId: null, spell: ['window', 'open'] }) });
    const r = await askEcho({ knownIds: [] }, { fetchFn: bad as never });
    expect(r.source).toBe('ai'); expect(r.data.line).toBe('Hi there friend'); expect(r.data.spell).toEqual([]);
    const good = async () => ({ ok: true, json: async () => ({ line: 'Open it', newWordId: null, spell: ['open', 'article-the', 'window'] }) });
    expect((await askEcho({ knownIds: [] }, { fetchFn: good as never })).source).toBe('ai');
  });
  it('preposition distance cap: across-room is not in-front-of; fake article rejected', () => {
    const frame = makeTableFrame({ x: 0, y: 0.75, z: -1.15 }, { x: 0, y: 1.6, z: 0 });
    const tableBox: BoxLike = { center: { x: 0, y: 0.75, z: -1.15 }, size: { x: 1.1, y: 0.05, z: 0.7 } };
    const farFront: BoxLike = { center: { x: 0, y: 0.82, z: 0.9 }, size: { x: 0.07, y: 0.09, z: 0.07 } }; // ~1.7m in front
    expect(classifyRelation(farFront, tableBox, frame)).not.toBe('in-front-of');
    expect(checkPreposition('in front of', farFront, tableBox, frame, { stillMs: 1000 }).result).toBe('wrong');
    const nearFront: BoxLike = { center: { x: 0, y: 0.82, z: -0.55 }, size: { x: 0.07, y: 0.09, z: 0.07 } };
    expect(classifyRelation(nearFront, tableBox, frame)).toBe('in-front-of');
    expect(spellFromIds(['article-foo', 'cup'], wordById)).toBeNull();
  });
  it('pack validation: malformed AI entries rejected, never throw', () => {
    expect(() => validatePack([null, 42, 'x'] as never)).not.toThrow();
    expect(validatePack([null] as never).length).toBeGreaterThan(0);
    expect(validateRoomPack({ words: [null] })).toBeNull();
    expect(validatePack([{ id: 'x', word: 'x', ipa: '/x/', partOfSpeech: 'adverb', cefr: 'A1', helper: { es: 'a', vi: 'b' }, audio: 'a.mp3', sceneLabel: 'x' }] as never).join(' ')).toContain('partOfSpeech');
  });
  it('/api/transcribe: method guard + no-key 503 (never forwards empty body)', async () => {
    const mk = () => { const r = { code: 0, body: undefined as unknown, status(c: number) { r.code = c; return { json(b: unknown) { r.body = b; } }; } }; return r; };
    const a = mk(); await transcribeHandler({ method: 'GET', headers: {} } as never, a as never); expect(a.code).toBe(405);
    const b = mk(); await transcribeHandler({ method: 'POST', headers: {} } as never, b as never); expect(b.code).toBe(503);
  });
  it('hand-loss tracker: grace period, immersive-only, back transition', () => {
    const t = new HandLossTracker();
    expect(sourceIsHand({ hand: {} })).toBe(true); expect(sourceIsHand({})).toBe(false); expect(sourceIsHand(undefined)).toBe(false);
    expect(t.update(false, false, 0)).toBeNull(); // desktop/non-immersive: never lost
    expect(t.update(false, true, 0)).toBeNull(); // missing, grace running
    expect(t.update(false, true, HAND_GRACE_MS - 1)).toBeNull(); // flicker tolerated
    expect(t.update(true, true, HAND_GRACE_MS)).toBeNull(); // back before grace: no event
    expect(t.update(false, true, 2000)).toBeNull();
    expect(t.update(false, true, 2000 + HAND_GRACE_MS)).toBe('lost');
    expect(t.update(false, true, 99999)).toBeNull(); // no repeat
    expect(t.update(true, true, 100000)).toBe('back');
  });
});
