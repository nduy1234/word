/** Shared server helpers: rate limit + cache. Server-only. META_API_KEY never client. */
const hits = new Map<string, number[]>();
const cache = new Map<string, { at: number; value: unknown }>();
export function rateLimited(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > limit;
}
export function cached<T>(key: string, ttlMs = 300_000): T | undefined {
  const e = cache.get(key);
  return e && Date.now() - e.at < ttlMs ? (e.value as T) : undefined;
}
export function putCache(key: string, value: unknown): void { cache.set(key, { at: Date.now(), value }); }
export function clientKey(req: { headers?: Record<string, string | string[] | undefined> }): string {
  const fwd = req.headers?.['x-forwarded-for'];
  // First hop only: full chain varies per proxy hop, so keying on it lets
  // one client rotate rate-limit buckets by adding fake trailing IPs.
  const first = (Array.isArray(fwd) ? fwd[0] : fwd ?? 'local').split(',')[0].trim() || 'local';
  return first.slice(0, 64);
}
/** Meta Model API chat call. Returns null on any failure — caller falls back, never claims model.
 * Upstream measured ~6.6s and intermittently 503/>15s from Vercel (2026-11-12):
 * cap output tokens for speed, retry once on 5xx/abort within the attempt budget. */
export async function metaChat(system: string, user: string, timeoutMs = 12000, maxTokens = 300): Promise<string | null> {
  const key = process.env.META_API_KEY;
  if (!key) return null;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch('https://api.meta.ai/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'muse-spark-1.3', temperature: 0.4, max_tokens: maxTokens, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!res.ok) {
        console.error(`metaChat upstream status ${res.status}`);
        if (res.status !== 429 && res.status < 500) return null;
        if (attempt === 2) return null;
        // 429 = shared-egress throttling (local calls succeed): honor Retry-After, else back off.
        const ra = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 10) * 1000 : 2000 * (attempt + 1));
        continue;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
      const content = data.choices?.[0]?.message?.content ?? null;
      if (!content?.trim()) {
        // Upstream 200 with empty content (observed 2026-11-13, token cap
        // truncation): parse/validate downstream would script-fallback. Retry.
        console.error(`metaChat empty content finish=${data.choices?.[0]?.finish_reason ?? 'unknown'}`);
        if (attempt === 2) return null;
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return content;
    } catch (err) {
      console.error(`metaChat fetch failed: ${err instanceof Error ? err.name : 'unknown'}`);
      if (attempt === 2) return null;
      await sleep(1000 * (attempt + 1));
    } finally { clearTimeout(timer); }
  }
  return null;
}
export function parseJson(text: string | null): unknown {
  if (!text) return null;
  try { return JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } }
}
