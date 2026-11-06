/** Deck + quests. Pure, unit-tested. Due reviews first, then new words. */
import { isDue, type CardState } from './scheduler.js';

export interface Quest {
  wordId: string;
  kind: 'review' | 'new';
  prompt: string; // e.g. 'Wake the window'
}

export function buildDeck(cards: Map<string, CardState>, allWordIds: string[], now: number,
  opts: { maxReview?: number; maxNew?: number } = {}): Quest[] {
  const maxReview = opts.maxReview ?? 10;
  const maxNew = opts.maxNew ?? 5;
  const due = allWordIds.filter((id) => cards.has(id) && isDue(cards.get(id)!, now))
    .sort((a, b) => cards.get(a)!.dueAt - cards.get(b)!.dueAt)
    .slice(0, maxReview).map((wordId): Quest => ({ wordId, kind: 'review', prompt: `Wake the faded word again` }));
  const fresh = allWordIds.filter((id) => !cards.has(id)).slice(0, maxNew)
    .map((wordId): Quest => ({ wordId, kind: 'new', prompt: `Wake a new word` }));
  return [...due, ...fresh];
}

/** Daily Fog: 3 min reviews + 2 new (PLAN progression). */
export function dailyFog(cards: Map<string, CardState>, allWordIds: string[], now: number): Quest[] {
  return buildDeck(cards, allWordIds, now, { maxReview: 10, maxNew: 2 });
}
