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
  let recordTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Recorder must not hang forever: race its fixed-length record against a cap.
    clip = await Promise.race([
      recorder.record(3000),
      new Promise<never>((_, reject) => { recordTimer = setTimeout(() => reject(new Error('record-timeout')), 6000); }),
    ]);
  } catch {
    return { result: 'fallback', reason: 'mic-denied' };
  } finally { if (recordTimer) clearTimeout(recordTimer); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TRANSCRIBE_TIMEOUT_MS);
  try {
    const body = new FormData();
    body.append('audio', clip, 'clip.wav');
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

/** Downsample mono PCM to the ASR-friendly rate (simple averaging). */
export function downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate <= toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** Encode mono Float32 PCM as a 16-bit WAV blob (upstream audioEncoding 'WAV'). */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); wstr(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); wstr(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Browser recorder (getUserMedia -> WebAudio -> 16kHz WAV). MediaRecorder's
 * webm/opus is not accepted upstream; WAV path live-verified 2026-11-12.
 * Verify on Quest Browser before relying on it (PLAN).
 */
export function browserRecorder(): Recorder | undefined {
  try {
    if (!navigator?.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') return undefined;
    return {
      async record(ms: number): Promise<Blob> {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        try {
          const ctx = new AudioContext();
          const source = ctx.createMediaStreamSource(stream);
          const proc = ctx.createScriptProcessor(4096, 1, 1);
          const chunks: Float32Array[] = [];
          proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
          source.connect(proc); proc.connect(ctx.destination);
          await new Promise((r) => setTimeout(r, ms));
          proc.disconnect(); source.disconnect();
          const rate = ctx.sampleRate;
          await ctx.close();
          const total = chunks.reduce((n, c) => n + c.length, 0);
          const merged = new Float32Array(total);
          let off = 0;
          for (const c of chunks) { merged.set(c, off); off += c.length; }
          return encodeWav(downsample(merged, rate, 16000), 16000);
        } finally {
          stream.getTracks().forEach((t) => t.stop());
        }
      },
    };
  } catch {
    return undefined;
  }
}
