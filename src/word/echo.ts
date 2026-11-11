/** Echo agent client: /api/echo, 5s timeout, schema-validated, scripted fallback. Thinking callback for animation. */
import { validateEchoResponse, spellFromIds, type EchoResponse } from './ai-schema.js';
import { wordById } from './pack.js';

export const SCRIPTED_ECHO: EchoResponse[] = [
  { line: 'Hello! Look - the window is sleeping. Say its name!', newWordId: 'window', spell: ['open', 'article-the', 'window'] },
  { line: 'Great job! The cup wants to wake up too.', newWordId: 'cup', spell: ['article-a', 'cup'] },
  { line: 'Wow! Put the cup on the table. You can do it!', newWordId: null, spell: ['put', 'article-the', 'cup', 'on', 'article-the', 'table'] },
];
export function scriptedEcho(index = 0, awakeIds: string[] = []): EchoResponse {
  const fresh = SCRIPTED_ECHO.find((e) => e.newWordId && !awakeIds.includes(e.newWordId));
  return fresh ?? SCRIPTED_ECHO[Math.abs(index) % SCRIPTED_ECHO.length];
}

export interface EchoDeps { fetchFn?: typeof fetch; onThinking?: (thinking: boolean) => void; timeoutMs?: number }
export async function askEcho(input: { knownIds: string[]; justWokeId?: string; cefr?: 'A1' | 'A2' }, deps: EchoDeps = {}): Promise<{ data: EchoResponse; source: 'ai' | 'scripted' }> {
  const fetchFn = deps.fetchFn ?? fetch;
  deps.onThinking?.(true);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 5000);
  try {
    const res = await fetchFn('/api/echo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: ctrl.signal });
    if (!res.ok) throw new Error('echo-http');
    const valid = validateEchoResponse(await res.json(), new Set(input.knownIds));
    if (!valid) throw new Error('echo-schema');
    if (valid.spell.length && !spellFromIds(valid.spell, wordById)) throw new Error('echo-spell'); // grammar-invalid spell: never trust model output
    if (valid.newWordId && !wordById(valid.newWordId) && !input.knownIds.includes(valid.newWordId)) { /* id checked server-side too; keep line, drop unknown new word */ valid.newWordId = null; }
    return { data: valid, source: 'ai' };
  } catch {
    return { data: scriptedEcho(0, input.knownIds), source: 'scripted' };
  } finally { clearTimeout(timer); deps.onThinking?.(false); }
}
