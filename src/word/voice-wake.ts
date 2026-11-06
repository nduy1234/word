/**
 * Voice wake client: 3s clip -> POST /api/transcribe -> intelligibility match.
 * Every failure path returns { result: 'fallback' } = use gaze-pinch choice.
 * Opt-in consent checked by caller before record(); mic never requested at launch.
 * Recorder/fetcher injected for unit tests + offline behavior.
 */
import { matchTranscript, type MatchResult } from './matching.js';

export interface Recorder {
  record(ms: number): Promise<Blob>;
}
export type Fetcher = (url: string, init: { method: string; body: FormData; signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<{ text?: string }> }>;

export type VoiceOutcome =
  | (MatchResult & { via: 'voice' })
  | { result: 'fallback'; reason: 'offline' | 'timeout' | 'mic-denied' | 'server' | 'no-recorder' };

export const TRANSCRIBE_TIMEOUT_MS = 5000;

export async function voiceWake(opts: {
  targetWord: string;
  targetIpa?: string;
  recorder?: Recorder;
  fetcher?: Fetcher;
  timeoutMs?: number;
}): Promise<VoiceOutcome> {
  const { recorder } = opts;
  if (!recorder) return { result: 'fallback', reason: 'no-recorder' };
  const fetcher: Fetcher = opts.fetcher ?? ((url, init) => fetch(url, init));
  let clip: Blob;
  try {
    clip = await recorder.record(3000);
  } catch {
    return { result: 'fallback', reason: 'mic-denied' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TRANSCRIBE_TIMEOUT_MS);
  try {
    const body = new FormData();
    body.append('audio', clip, 'clip.webm');
    const res = await fetcher('/api/transcribe', { method: 'POST', body, signal: controller.signal });
    if (!res.ok) return { result: 'fallback', reason: 'server' };
    const data = await res.json();
    if (!data.text) return { result: 'fallback', reason: 'server' };
    return { ...matchTranscript(data.text, opts.targetWord, opts.targetIpa), via: 'voice' };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { result: 'fallback', reason: aborted ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Browser recorder (getUserMedia). Verify on Quest Browser before relying on it (PLAN). */
export function browserRecorder(): Recorder | undefined {
  try {
    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return undefined;
    return {
      async record(ms: number): Promise<Blob> {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        try {
          const rec = new MediaRecorder(stream);
          const chunks: BlobPart[] = [];
          rec.ondataavailable = (e) => chunks.push(e.data);
          const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
          rec.start();
          await new Promise((r) => setTimeout(r, ms));
          rec.stop();
          await done;
          return new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        } finally {
          stream.getTracks().forEach((t) => t.stop());
        }
      },
    };
  } catch {
    return undefined;
  }
}
