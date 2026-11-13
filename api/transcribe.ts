/**
 * Vercel API route: proxy to Meta Model API Muse Voice Transcribe.
 * META_API_KEY server-only (env), never client. Voice: opt-in at client, transcribed,
 * never stored/logged — audio is forwarded in-memory only, transcript returned only.
 * Client sends multipart field 'audio' (WAV clip). Upstream (live-verified
 * 2026-11-12) rejects raw audio (415) and single-part forms (400): it requires
 * multipart with a 'request' JSON part ({model, audioEncoding:'WAV'}) plus the
 * 'audio' part. This route rebuilds that form server-side.
 * Raw body streamed through: Vercel does not parse multipart, so req.body is
 * not the audio — forwarding it would send nothing/garbage upstream.
 */
import { clientKey, rateLimited } from './_shared.js';

export const config = { runtime: 'nodejs', api: { bodyParser: false } };

const META_ASR = 'https://api.meta.ai/v1/asr/transcribe';
const TIMEOUT_MS = 9000;
const MAX_AUDIO_BYTES = 1_000_000; // 3s clip is far below this; cap abuse

type Req = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
};

async function readBody(req: Req): Promise<Buffer | null> {
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body instanceof Uint8Array) return Buffer.from(req.body);
  if (!req[Symbol.asyncIterator]) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > MAX_AUDIO_BYTES) return null;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Extract the 'audio' part bytes from a client multipart body. Null when absent. */
export function extractAudioPart(body: Buffer, contentType: string | undefined): Buffer | null {
  const boundary = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean);
  if (!boundary) return null;
  const marker = Buffer.from(`--${boundary}`);
  let pos = body.indexOf(marker);
  while (pos !== -1) {
    const headerEnd = body.indexOf('\r\n\r\n', pos);
    if (headerEnd === -1) return null;
    const headers = body.subarray(pos, headerEnd).toString('latin1');
    const dataStart = headerEnd + 4;
    const next = body.indexOf(marker, dataStart);
    if (next === -1) return null;
    if (/name="audio"/.test(headers)) {
      // Part data ends at the CRLF before the next boundary.
      return body.subarray(dataStart, Math.max(dataStart, next - 2));
    }
    pos = next;
  }
  return null;
}

/** Upstream form: 'request' JSON part + 'audio' WAV part (live-verified shape). */
export function buildUpstreamForm(audio: Buffer): FormData {
  const form = new FormData();
  form.append('request', JSON.stringify({ model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV' }));
  form.append('audio', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'clip.wav');
  return form;
}

export default async function handler(req: Req, res: {
  status(code: number): { json(body: unknown): void };
}): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }
  if (rateLimited(`transcribe:${clientKey(req)}`, 20)) { res.status(429).json({ error: 'rate-limited', fallback: 'gaze-pinch' }); return; }
  const key = process.env.META_API_KEY;
  if (!key) { res.status(503).json({ error: 'transcription-unavailable', fallback: 'gaze-pinch' }); return; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const raw = await readBody(req);
    const ct = req.headers?.['content-type'];
    const audio = raw && extractAudioPart(raw, typeof ct === 'string' ? ct : undefined);
    if (!audio || audio.length === 0) { res.status(400).json({ error: 'audio-required', fallback: 'gaze-pinch' }); return; }
    const upstream = await fetch(META_ASR, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: buildUpstreamForm(audio),
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
