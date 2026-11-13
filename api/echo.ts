/** Echo agent: Muse Spark (docs/tooling.md verified muse-spark-1.3). Strict JSON out, scripted fallback. */
import { cached, clientKey, metaChat, parseJson, putCache, rateLimited } from './_shared.js';
import { isValidId, spellFromIds, validateEchoResponse } from '../src/word/ai-schema.js';
import { scriptedEcho } from '../src/word/echo.js';
import { wordById } from '../src/word/pack.js';

export const config = { runtime: 'nodejs' };
export const maxDuration = 60; // upstream chat can take ~15s + one retry
type Req = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Res = { status(c: number): { json(b: unknown): void } };

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }
  if (rateLimited(`echo:${clientKey(req)}`)) { res.status(429).json({ error: 'rate-limited' }); return; }
  const body = (typeof req.body === 'string' ? parseJson(req.body) : req.body) as { knownIds?: unknown; justWokeId?: unknown; cefr?: unknown } | null;
  const knownIds = Array.isArray(body?.knownIds) ? body.knownIds.filter((x): x is string => typeof x === 'string').slice(0, 100) : [];
  const cacheKey = `echo:${knownIds.sort().join(',')}:${String(body?.justWokeId ?? '')}:${body?.cefr === 'A2' ? 'A2' : 'A1'}`;
  const hit = cached(cacheKey);
  if (hit) { res.status(200).json(hit); return; }
  const system = 'You are Echo, a kind spirit for English learners age 10+, CEFR A1-A2. Reply ONLY strict JSON {"line":string,"newWordId":string|null,"spell":string[]}. line: one short simple English sentence, only known words plus at most 1 new word. spell: tile ids forming a valid English spell (verb, article-a/an/the, adjective, noun, preposition, noun). Never add explanation.';
  const user = `Known word ids: ${knownIds.join(', ') || 'none'}. Just woke: ${String(body?.justWokeId ?? 'none')}. Level: ${body?.cefr === 'A2' ? 'A2' : 'A1'}.`;
  const raw = parseJson(await metaChat(system, user, 12_000, 1000)); // 300-token cap truncated to empty content upstream (2026-11-13 replica)
  let valid = validateEchoResponse(raw, new Set(knownIds));
  if (!valid && raw && typeof raw === 'object') {
    // Salvage: line stays strict-validated; aux fields coerce instead of
    // killing a good line (model often emits word text / bad-case ids here).
    const o = raw as Record<string, unknown>;
    const nid = typeof o.newWordId === 'string' ? o.newWordId.trim().toLowerCase() : null;
    valid = validateEchoResponse({ line: o.line, newWordId: isValidId(nid) ? nid : null, spell: Array.isArray(o.spell) ? o.spell.filter((t): t is string => typeof t === 'string' && t.length <= 30).slice(0, 8) : [] }, new Set(knownIds));
  }
  if (valid && valid.spell.length && !spellFromIds(valid.spell, wordById)) valid = { ...valid, spell: [] }; // model lacks pack tile list; invalid spell drops, line survives
  const out = valid ?? scriptedEcho(0, knownIds);
  // Cache only real AI results: caching a transient-failure fallback would
  // serve scripted lines long after the upstream recovers.
  if (valid) putCache(cacheKey, out);
  res.status(200).json(out);
}
