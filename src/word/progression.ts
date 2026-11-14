/** Progression: districts, streak+freezes, petals, cosmetics, Atlas, Mural. Pure. */
import { CAFE_PROPS } from './pack.js';
export interface District { id: string; name: string; wordIds: string[] }
export const DISTRICTS: District[] = [
  { id: 'home', name: 'Home Room', wordIds: ['table', 'wall', 'floor', 'ceiling', 'door', 'window', 'couch', 'lamp', 'plant', 'screen', 'bed', 'shelf'] },
  { id: 'kitchen', name: 'Kitchen', wordIds: ['cup', 'plate', 'apple', 'chair', 'book'] },
  { id: 'cafe', name: 'Café', wordIds: CAFE_PROPS.map((w) => w.id) },
  { id: 'market', name: 'Market', wordIds: [] },
];
/** Text Atlas summary (PLAN palm Atlas, text-only v1): per-district % + mastered. */
export function atlasSummary(awake: Set<string>, mastered: Set<string>): { total: number; awakeCount: number; masteredCount: number; lines: string[] } {
  const all = DISTRICTS.flatMap((d) => d.wordIds);
  const lines = DISTRICTS.filter((d) => d.wordIds.length).map((d) => `${d.name.replace('Café', 'Cafe')} ${Math.round(districtProgress(d, awake) * 100)}%`);
  return { total: all.length, awakeCount: all.filter((id) => awake.has(id)).length, masteredCount: all.filter((id) => mastered.has(id)).length, lines };
}
export function districtProgress(d: District, awake: Set<string>): number {
  return d.wordIds.length ? d.wordIds.filter((id) => awake.has(id)).length / d.wordIds.length : 0;
}
/** Unlock next district at 80% of previous awake. Home always open. */
export function unlockedDistricts(awake: Set<string>): string[] {
  const out = ['home'];
  for (let i = 1; i < DISTRICTS.length; i++) {
    if (DISTRICTS[i - 1].wordIds.length === 0) { out.push(DISTRICTS[i].id); continue; } // empty district never blocks chain
    if (districtProgress(DISTRICTS[i - 1], awake) >= 0.8) out.push(DISTRICTS[i].id); else break;
  }
  return out;
}
export function muralPercent(awake: Set<string>): number {
  const all = DISTRICTS.flatMap((d) => d.wordIds);
  return all.length ? Math.round((all.filter((id) => awake.has(id)).length / all.length) * 100) : 0;
}
export function atlasEntry(awake: boolean, mastered: boolean, rarity: string) {
  return { awake, border: mastered ? 'gold' as const : 'plain' as const, rarity };
}
export function echoForm(atlasAwakeCount: number): 1 | 2 | 3 {
  return atlasAwakeCount >= 20 ? 3 : atlasAwakeCount >= 8 ? 2 : 1;
}

export interface Streak { lastDay: string; count: number; freezesLeft: number; weekKey: string }
const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const week = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-W${Math.ceil(((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7)}`; };
export function newStreak(now: number): Streak { return { lastDay: '', count: 0, freezesLeft: 2, weekKey: week(now) }; }
/** Daily visit: same day no-op; consecutive +1; 1 missed day consumes freeze if left; else reset to 1. 2 freezes/week. */
export function visitStreak(s: Streak, now: number): Streak {
  const today = day(now); const wk = week(now);
  const freezesLeft = wk === s.weekKey ? s.freezesLeft : 2;
  if (s.lastDay === today) return { ...s, freezesLeft, weekKey: wk };
  if (!s.lastDay) return { lastDay: today, count: 1, freezesLeft, weekKey: wk };
  const gap = Math.round((Date.parse(today) - Date.parse(s.lastDay)) / 864e5);
  if (gap < 0) return { ...s, freezesLeft, weekKey: wk }; // clock rollback / future save: never wipe streak
  if (gap === 1) return { lastDay: today, count: s.count + 1, freezesLeft, weekKey: wk };
  if (gap === 2 && freezesLeft > 0) return { lastDay: today, count: s.count + 1, freezesLeft: freezesLeft - 1, weekKey: wk };
  return { lastDay: today, count: 1, freezesLeft, weekKey: wk };
}

export const COSMETICS = [
  { id: 'petal-hat', name: 'Petal Hat', cost: 10 }, { id: 'star-hat', name: 'Star Hat', cost: 25 },
  { id: 'leaf-decor', name: 'Leaf Decor', cost: 15 },
] as const;
export function buyCosmetic(petals: number, owned: Set<string>, id: string): { ok: boolean; petals: number; owned: Set<string> } {
  const c = COSMETICS.find((x) => x.id === id);
  if (!c || owned.has(id) || petals < c.cost) return { ok: false, petals, owned };
  const next = new Set(owned); next.add(id);
  return { ok: true, petals: petals - c.cost, owned: next };
}
