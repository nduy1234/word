/** SM-2 spaced repetition (FSRS-lite alternative, PLAN choice). Pure, unit-tested. */
export interface CardState {
  wordId: string;
  reps: number; // consecutive correct
  ease: number; // >= 1.3, starts 2.5
  intervalDays: number;
  dueAt: number; // epoch ms
  lapses: number;
}

export function newCard(wordId: string, now: number): CardState {
  return { wordId, reps: 0, ease: 2.5, intervalDays: 0, dueAt: now, lapses: 0 };
}

/** grade: 0-2 wrong, 3 hard, 4 good, 5 easy. Returns new state (no mutation). */
export function gradeCard(card: CardState, grade: number, now: number): CardState {
  const g = Math.max(0, Math.min(5, Math.round(grade)));
  let { reps, ease, intervalDays, lapses } = card;
  ease = Math.max(1.3, ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));
  if (g < 3) {
    reps = 0;
    intervalDays = 0; // relearn today
    lapses += 1;
    return { wordId: card.wordId, reps, ease, intervalDays, dueAt: now + 10 * 60_000, lapses };
  }
  reps += 1;
  intervalDays = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(intervalDays * ease);
  return { wordId: card.wordId, reps, ease, intervalDays, dueAt: now + intervalDays * 86_400_000, lapses };
}

export function isDue(card: CardState, now: number): boolean {
  return card.dueAt <= now;
}

/** Fade amount 0..1 for fade-as-review: 0 fresh, 1 fully due/overdue by fadeWindowMs. */
export function fadeAmount(card: CardState, now: number, fadeWindowMs = 3 * 86_400_000): number {
  const overdue = now - card.dueAt;
  if (overdue <= 0) return 0;
  return Math.min(1, overdue / fadeWindowMs);
}
