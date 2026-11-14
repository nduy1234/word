/** Word audio chain: pre-generated clip -> speechSynthesis -> caption only.
 * Pure ordering logic unit-tested; browser player injected in word-audio-player.ts. */
export type AudioStep = 'clip' | 'tts' | 'caption';
export function audioChain(hasClip: boolean, hasTts: boolean): AudioStep[] {
  const steps: AudioStep[] = [];
  if (hasClip) steps.push('clip');
  if (hasTts) steps.push('tts');
  steps.push('caption');
  return steps;
}
/** Clip URL for pack audio field ("assets/audio/en-US/cup.wav") under public/. */
export function clipUrl(audioField: string): string {
  return audioField.startsWith('/') ? audioField : `/${audioField}`;
}
