/** Browser clip player: preload current-room clips, play clip -> TTS -> caption.
 * Every failure advances chain silently; game never depends on audio loading. */
import { clipUrl } from './word-audio.js';
import type { WordEntry } from './pack.js';

const cache = new Map<string, HTMLAudioElement>();
let failed = new Set<string>();

export function preloadClips(entries: WordEntry[]): void {
  for (const e of entries) {
    if (!e.audio || cache.has(e.id)) continue;
    try {
      const a = new Audio(clipUrl(e.audio));
      a.preload = 'auto';
      a.addEventListener('error', () => failed.add(e.id), { once: true });
      cache.set(e.id, a);
    } catch { failed.add(e.id); }
  }
}

/** Speak word: try clip, then speechSynthesis(en-US), else caller caption only. Returns step used. */
export async function speakWord(entry: WordEntry): Promise<'clip' | 'tts' | 'caption'> {
  const clip = cache.get(entry.id) ?? (() => { try { const a = new Audio(clipUrl(entry.audio)); cache.set(entry.id, a); return a; } catch { return undefined; } })();
  if (clip && !failed.has(entry.id)) {
    try {
      clip.currentTime = 0;
      await clip.play();
      return 'clip';
    } catch { failed.add(entry.id); }
  }
  try {
    const synth = globalThis.speechSynthesis;
    if (synth) {
      const u = new SpeechSynthesisUtterance(entry.word);
      u.lang = 'en-US';
      synth.speak(u);
      return 'tts';
    }
  } catch { /* caption only */ }
  return 'caption';
}
