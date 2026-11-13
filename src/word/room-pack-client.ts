/** Room-pack client: sends ONLY label names to /api/room-pack. Cache offline, seed fallback. */
import { sanitizeLabels, validateRoomPack } from './ai-schema.js';
import type { WordEntry } from './pack.js';
import { ROOM_WORDS, wordForSceneLabel } from './pack.js';
import type { StorageLike } from './store.js';

const KEY = 'word-room-pack-v1';
function keyFor(labels: string[]): string { return `${KEY}:${[...labels].sort().join(',')}`; }
export function seedPackForLabels(labels: string[]): WordEntry[] {
  const words = sanitizeLabels(labels).map((l) => wordForSceneLabel(l)).filter((w): w is WordEntry => Boolean(w));
  const unique = [...new Map(words.map((w) => [w.id, w])).values()];
  return unique.length ? unique : ROOM_WORDS;
}
/** Room-aware curriculum drives quest order: first quest whose word is in the pack. */
export function preferPackQuest<T extends { wordId: string }>(quests: T[], packWordIds: string[]): T | undefined {
  if (!packWordIds.length) return undefined;
  const set = new Set(packWordIds);
  return quests.find((q) => set.has(q.wordId));
}
export async function fetchRoomPack(labels: string[], storage: StorageLike, fetchFn: typeof fetch = fetch, timeoutMs = 15000): Promise<{ words: WordEntry[]; source: 'ai' | 'cache' | 'seed' }> {
  const clean = sanitizeLabels(labels);
  const cacheKey = keyFor(clean);
  // Cap (PLAN latency rule): a hung fetch must still reach cache/seed fallback.
  // 15s: Muse Spark upstream measured ~6.6s (2026-11-12), 5s always fell back.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn('/api/room-pack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labels: clean }), signal: ctrl.signal });
    if (res.ok) {
      const valid = validateRoomPack(await res.json());
      if (valid) { try { storage.setItem(cacheKey, JSON.stringify(valid.words)); } catch { /* ignore */ } return { words: valid.words, source: 'ai' }; }
    }
    throw new Error('room-pack');
  } catch {
    try {
      const cached = storage.getItem(cacheKey);
      if (cached) { const valid = validateRoomPack({ words: JSON.parse(cached) }); if (valid) return { words: valid.words, source: 'cache' }; }
    } catch { /* fall through */ }
    return { words: seedPackForLabels(clean), source: 'seed' };
  } finally { clearTimeout(timer); }
}
