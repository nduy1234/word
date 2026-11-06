/**
 * Vercel API route: proxy to Meta Model API Muse Voice Transcribe.
 * META_API_KEY server-only (env), never client. Voice: opt-in at client, transcribed,
 * never stored/logged — audio is forwarded in-memory only, transcript returned only.
 * Verified 2026-11-05 (docs/tooling.md): muse-voice-transcribe-1.0, POST /v1/asr/transcribe.
 */
export const config = { runtime: 'nodejs' };

const META_ASR = 'https://api.meta.ai/v1/asr/transcribe';
const TIMEOUT_MS = 5000;

export default async function handler(req: { method?: string; body?: unknown }, res: {
  status(code: number): { json(body: unknown): void };
}): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }
  const key = process.env.META_API_KEY;
  if (!key) { res.status(503).json({ error: 'transcription-unavailable', fallback: 'gaze-pinch' }); return; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(META_ASR, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: req.body as BodyInit,
      signal: controller.signal,
    });
    if (!upstream.ok) { res.status(502).json({ error: 'transcription-failed', fallback: 'gaze-pinch' }); return; }
    const data = (await upstream.json()) as { text?: string; transcript?: string };
    res.status(200).json({ text: data.text ?? data.transcript ?? '' });
  } catch {
    res.status(504).json({ error: 'transcription-timeout', fallback: 'gaze-pinch' });
  } finally {
    clearTimeout(timer);
  }
}
