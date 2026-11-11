/** First-five-minutes onboarding. Ghost-hand demos, captions only, no text walls. Pure. */
export type OnbStep = 'fog' | 'poke-table' | 'ghost-flick' | 'first-spell' | 'place-cup' | 'done';
export interface GhostDemo { gesture: 'poke' | 'pinch-flick' | 'snap' | 'place'; targetId: string; durationMs: number }
export const ONBOARDING: { step: OnbStep; caption: string; ghost: GhostDemo | null; goal: string }[] = [
  { step: 'fog', caption: 'The Hush is here...', ghost: null, goal: 'watch' },
  { step: 'poke-table', caption: 'table', ghost: { gesture: 'poke', targetId: 'table', durationMs: 2000 }, goal: 'poke:table' },
  { step: 'ghost-flick', caption: 'Pinch... and flick!', ghost: { gesture: 'pinch-flick', targetId: 'window', durationMs: 3000 }, goal: 'wake:window' },
  { step: 'first-spell', caption: 'open the door', ghost: { gesture: 'snap', targetId: 'door', durationMs: 3000 }, goal: 'spell:open-door' },
  { step: 'place-cup', caption: 'Put the cup on the table', ghost: { gesture: 'place', targetId: 'cup', durationMs: 3000 }, goal: 'place:cup-on-table' },
  { step: 'done', caption: 'Your room is waking up!', ghost: null, goal: 'free-play' },
];
export function nextOnboarding(current: OnbStep, eventGoal: string): OnbStep {
  const i = ONBOARDING.findIndex((s) => s.step === current);
  if (i < 0) return 'done';
  if (current === 'fog') return 'poke-table'; // timed intro advances itself
  return ONBOARDING[i].goal === eventGoal ? (ONBOARDING[i + 1]?.step ?? 'done') : current;
}
export function onboardingCaption(step: OnbStep): string { return ONBOARDING.find((s) => s.step === step)?.caption ?? ''; }
