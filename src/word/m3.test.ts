import { describe, expect, it } from 'vitest';
import handlerEcho from '../../api/echo.js';
import handlerPack from '../../api/room-pack.js';
import { sanitizeLabels, validateEchoResponse, validateRoomPack, spellFromIds } from './ai-schema.js';
import { askEcho, scriptedEcho } from './echo.js';
import { checkPreposition, classifyRelation, frameFromTablePlane, makeTableFrame, type BoxLike } from './preposition-check.js';
import { buyCosmetic, districtProgress, echoForm, muralPercent, unlockedDistricts, visitStreak, newStreak, DISTRICTS } from './progression.js';
import { hitRush, newRush, pauseRush, resumeRush, startRush, tickRush } from './hush-rush.js';
import { fetchRoomPack, seedPackForLabels } from './room-pack-client.js';
import { wordById } from './pack.js';

function mockRes() { let code = 0; let body: unknown; return { status(c: number) { code = c; return { json(b: unknown) { body = b; } }; }, get code() { return code; }, get body() { return body as Record<string, unknown>; } }; }
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe('AI schemas', () => {
  it('labels: names only, deduped, capped, rejects geometry-ish input', () => {
    expect(sanitizeLabels(['Table', ' wall ', 'table', 'couch; DROP', 42, 'door'])).toEqual(['table', 'wall', 'door']);
    expect(sanitizeLabels('table')).toEqual([]);
    expect(sanitizeLabels(Array.from({ length: 50 }, (_, i) => `label${''}`)).length).toBeLessThanOrEqual(32);
  });
  it('echo schema rejects bad shapes, accepts valid', () => {
    expect(validateEchoResponse({ line: 'Hello!', newWordId: null, spell: [] }, new Set())).toBeTruthy();
    expect(validateEchoResponse({ line: '<script>', newWordId: null, spell: [] }, new Set())).toBeNull();
    expect(validateEchoResponse({ line: 'Hi', newWordId: 'Bad Id!', spell: [] }, new Set())).toBeNull();
    expect(validateEchoResponse({ line: 'x'.repeat(200), newWordId: null, spell: [] }, new Set())).toBeNull();
    expect(validateEchoResponse(null, new Set())).toBeNull();
  });
  it('spellFromIds validates grammar via trySnap', () => {
    expect(spellFromIds(['open', 'article-the', 'window'], wordById)).toBeTruthy();
    expect(spellFromIds(['window', 'open'], wordById)).toBeNull();
    expect(spellFromIds(['nope'], wordById)).toBeNull();
  });
  it('room pack schema rejects invalid packs', () => {
    expect(validateRoomPack({ words: seedPackForLabels(['table']) })).toBeTruthy();
    expect(validateRoomPack({ words: [{ id: 'x' }] })).toBeNull();
    expect(validateRoomPack({ words: [] })).toBeNull();
  });
});

describe('Echo client + API fallback (network off)', () => {
  it('scripted fallback when fetch fails; thinking toggles', async () => {
    let thinking: boolean[] = [];
    const r = await askEcho({ knownIds: [] }, { fetchFn: async () => { throw new Error('off'); }, onThinking: (t) => thinking.push(t) });
    expect(r.source).toBe('scripted'); expect(r.data.line).toBeTruthy(); expect(thinking).toEqual([true, false]);
    expect(scriptedEcho(0, []).newWordId).toBe('window');
  });
  it('askEcho: grammar-invalid spell drops tiles, AI line survives (not scripted)', async () => {
    const fetchFn = async () => ({ ok: true, json: async () => ({ line: 'The table is awake!', newWordId: null, spell: ['window', 'open'] }) }) as never;
    const r = await askEcho({ knownIds: ['table'] }, { fetchFn });
    expect(r.source).toBe('ai'); expect(r.data.line).toBe('The table is awake!'); expect(r.data.spell).toEqual([]);
  });
  it('/api/echo returns scripted JSON without key', async () => {
    const res = mockRes();
    await handlerEcho({ method: 'POST', body: { knownIds: ['cup'] }, headers: {} }, res as never);
    expect(res.code).toBe(200); expect(typeof res.body.line).toBe('string');
  });
  it('/api/room-pack returns seed pack without key; labels sanitized', async () => {
    const res = mockRes();
    await handlerPack({ method: 'POST', body: { labels: ['table', 'evil;rm'] }, headers: {} }, res as never);
    expect(res.code).toBe(200); expect((res.body.words as unknown[]).length).toBeGreaterThan(0);
  });
  it('room-pack client: seed offline, then cache', async () => {
    const s = mem();
    const r = await fetchRoomPack(['table'], s, async () => { throw new Error('off'); });
    expect(r.source).toBe('seed'); expect(r.words.some((w) => w.id === 'table')).toBe(true);
  });
});

describe('progression', () => {
  it('district unlock at 80%, mural, echo form', () => {
    const home = DISTRICTS[0];
    const awake = new Set(home.wordIds.slice(0, 10)); // 10/12 = 83%
    expect(districtProgress(home, awake)).toBeGreaterThanOrEqual(0.8);
    expect(unlockedDistricts(awake)).toContain('kitchen');
    expect(unlockedDistricts(new Set(['table']))).toEqual(['home']);
    expect(muralPercent(new Set(['table']))).toBeGreaterThan(0);
    expect(echoForm(0)).toBe(1); expect(echoForm(8)).toBe(2); expect(echoForm(20)).toBe(3);
  });
  it('streak: consecutive, freeze saves 1 missed day, reset otherwise, weekly refill', () => {
    const d = (s: string) => Date.parse(`${s}T12:00:00Z`);
    let s = visitStreak(newStreak(d('2026-11-02')), d('2026-11-02'));
    s = visitStreak(s, d('2026-11-03')); expect(s.count).toBe(2);
    s = visitStreak(s, d('2026-11-05')); expect(s.count).toBe(3); expect(s.freezesLeft).toBe(1); // freeze used
    s = visitStreak(s, d('2026-11-09')); expect(s.count).toBe(1); // gap > freeze
    const same = visitStreak(s, d('2026-11-09')); expect(same.count).toBe(1);
  });
  it('petals buy cosmetics only when affordable/not owned', () => {
    const ok = buyCosmetic(20, new Set(), 'petal-hat'); expect(ok.ok).toBe(true); expect(ok.petals).toBe(10);
    expect(buyCosmetic(5, new Set(), 'petal-hat').ok).toBe(false);
    expect(buyCosmetic(50, ok.owned, 'petal-hat').ok).toBe(false);
  });
});

describe('Hush Rush', () => {
  it('60s timer, combo scoring, pause freezes timer, best kept', () => {
    let s = startRush(newRush(100));
    s = hitRush(s, true); s = hitRush(s, true); expect(s.score).toBeGreaterThan(20); expect(s.combo).toBe(2);
    s = hitRush(s, false); expect(s.combo).toBe(0);
    s = pauseRush(s); expect(tickRush(s, 5000).leftMs).toBe(60_000);
    s = resumeRush(s); s = tickRush(s, 60_000); expect(s.phase).toBe('done'); expect(s.best).toBe(100);
  });
});

describe('preposition edge cases', () => {
  const frame = makeTableFrame({ x: 0, y: 0.75, z: -1.15 }, { x: 0, y: 1.6, z: 0 });
  const tableBox: BoxLike = { center: { x: 0, y: 0.75, z: -1.15 }, size: { x: 1.1, y: 0.05, z: 0.7 } };
  const cupAt = (x: number, y: number, z: number): BoxLike => ({ center: { x, y, z }, size: { x: 0.07, y: 0.09, z: 0.07 } });
  it('missing table plane -> null frame, never guesses', () => {
    expect(frameFromTablePlane(null, { x: 0, y: 1, z: 0 }, { x: 0, y: 1.6, z: 0 })).toBeNull();
    expect(frameFromTablePlane({ x: 0, y: 0.75, z: 0 }, null, { x: 0, y: 1.6, z: 0 })).toBeNull();
    expect(frameFromTablePlane({ x: 0, y: 0.75, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1.6, z: 0 })).toBeNull(); // wall, not table
  });
  it('tilted table plane (normal off-axis) still frames + grades on', () => {
    const tilted = frameFromTablePlane({ x: 0, y: 0.75, z: -1.15 }, { x: 0.1, y: 0.98, z: 0.05 }, { x: 0, y: 1.6, z: 0 });
    expect(tilted).toBeTruthy();
    expect(checkPreposition('on', cupAt(0, 0.82, -1.15), tableBox, tilted!, { stillMs: 1000 }).result).toBe('correct');
  });
  it('object at table edge: partial overlap not "on", classified next-to/none honestly', () => {
    const edge = cupAt(0.58, 0.82, -1.15); // footprint half off right edge (table hx .55, cup hx .035)
    expect(classifyRelation(edge, tableBox, frame)).not.toBe('on');
    const r = checkPreposition('on', edge, tableBox, frame, { stillMs: 1000 });
    expect(['almost', 'wrong']).toContain(r.result);
  });
});
