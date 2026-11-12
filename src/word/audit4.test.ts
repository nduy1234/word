import { afterEach, describe, expect, it, vi } from 'vitest';
import transcribeHandler, { buildUpstreamForm, extractAudioPart } from '../../api/transcribe.js';
import { downsample, encodeWav } from './voice-wake.js';

const clientMultipart = (audio: Buffer, boundary = 'test-boundary-1'): { body: Buffer; contentType: string } => {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="clip.wav"\r\nContent-Type: audio/wav\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat([head, audio, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
};

describe('audit4: transcribe upstream form (live-verified 2026-11-12)', () => {
  it('extractAudioPart pulls exact audio bytes from client multipart', () => {
    const audio = Buffer.from([0, 1, 2, 3, 250, 251, 10, 13]);
    const { body, contentType } = clientMultipart(audio);
    expect(extractAudioPart(body, contentType)?.equals(audio)).toBe(true);
    expect(extractAudioPart(body, 'audio/wav')).toBeNull();
    expect(extractAudioPart(Buffer.from('nope'), contentType)).toBeNull();
  });

  it('buildUpstreamForm sends request JSON (WAV) + audio part', async () => {
    const form = buildUpstreamForm(Buffer.from([1, 2, 3]));
    const req = JSON.parse(String(form.get('request')));
    expect(req.audioEncoding).toBe('WAV');
    expect(req.model).toBe('muse-voice-transcribe-1.0');
    const audio = form.get('audio') as Blob;
    expect(audio.type).toBe('audio/wav');
    expect(audio.size).toBe(3);
  });

  it('handler rebuilds form and returns transcript text', async () => {
    const prevKey = process.env.META_API_KEY;
    process.env.META_API_KEY = 'test-key';
    let sentBody: unknown;
    vi.stubGlobal('fetch', async (_url: string, init: { body: unknown }) => {
      sentBody = init.body;
      return { ok: true, json: async () => ({ transcript: 'table', audioDurationMs: 900, turns: [] }) };
    });
    try {
      const { body, contentType } = clientMultipart(Buffer.from([9, 8, 7, 6]));
      const req = {
        method: 'POST',
        headers: { 'content-type': contentType },
        async *[Symbol.asyncIterator]() { yield new Uint8Array(body); },
      };
      const res = { code: 0, body: undefined as unknown, status(c: number) { res.code = c; return { json(b: unknown) { res.body = b; } }; } };
      await transcribeHandler(req as never, res as never);
      expect(res.code).toBe(200);
      expect(res.body).toEqual({ text: 'table' });
      expect(sentBody).toBeInstanceOf(FormData);
      expect(JSON.parse(String((sentBody as FormData).get('request'))).audioEncoding).toBe('WAV');
    } finally {
      vi.unstubAllGlobals();
      if (prevKey === undefined) delete process.env.META_API_KEY; else process.env.META_API_KEY = prevKey;
    }
  });
});

describe('audit4: WAV recorder helpers', () => {
  it('encodeWav writes RIFF header and 16-bit PCM size', async () => {
    const blob = encodeWav(new Float32Array([0, 0.5, -0.5]), 16000);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 6);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(36, 40))).toBe('data');
  });
  it('downsample halves length at 2:1 and is identity below target', () => {
    expect(downsample(new Float32Array(4800), 48000, 16000).length).toBe(1600);
    const s = new Float32Array([1, 2, 3]);
    expect(downsample(s, 16000, 16000)).toBe(s);
  });
});

afterEach(() => { vi.unstubAllGlobals(); });
