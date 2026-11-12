/** Room-aware curriculum: ONLY semantic label names received/sent upstream. Validated pack, seed fallback. */
import { cached, clientKey, metaChat, parseJson, putCache, rateLimited } from './_shared.js';
import { sanitizeLabels, validateRoomPack } from '../src/word/ai-schema.js';
import { seedPackForLabels } from '../src/word/room-pack-client.js';

export const config = { runtime: 'nodejs' };
type Req = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Res = { status(c: number): { json(b: unknown): void } };

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }
  if (rateLimited(`pack:${clientKey(req)}`, 10)) { res.status(429).json({ error: 'rate-limited' }); return; }
  const body = (typeof req.body === 'string' ? parseJson(req.body) : req.body) as { labels?: unknown } | null;
  const labels = sanitizeLabels(body?.labels);
  const cacheKey = `pack:${[...labels].sort().join(',')}`;
  const hit = cached(cacheKey, 3_600_000);
  if (hit) { res.status(200).json(hit); return; }
  const system = 'Return ONLY strict JSON {"words":[...]}. Each word: id, word, ipa (/.../), partOfSpeech (noun|verb|phrasalVerb|preposition|adjective), plural+article(a|an) for nouns, cefr A1|A2, example containing the word, helper {es,vi}, sceneLabel or propId (exactly one, nouns only), wakeFx "bloom", rarity common|rare|gold, audio "audio/en-US/<id>.mp3". English only targets. Ages 10+. No brands.';
  const valid = validateRoomPack(parseJson(await metaChat(system, `Room labels (names only): ${labels.join(', ') || 'table'}`)));
  const out = valid ?? { words: seedPackForLabels(labels) };
  // Cache only real AI results: caching a seed fallback (e.g. no-key window)
  // would shadow a working upstream for the full 1h TTL.
  if (valid) putCache(cacheKey, out);
  res.status(200).json(out);
}
