/** Accessibility settings. Pure. Awake indicator never color alone: icon + label + outline flag. */
export interface A11y { highContrast: boolean; captionScale: 1 | 1.25 | 1.5; reducedMotion: boolean; colorblindSafe: boolean }
export const DEFAULT_A11Y: A11y = { highContrast: false, captionScale: 1, reducedMotion: false, colorblindSafe: true };
export function captionPx(a: A11y): number { return Math.round(22 * a.captionScale); } // >=22px base, Quest 3S readable
/** High contrast swaps palette to max-luminance pairs (docs/art.md roles kept). */
export function palette(a: A11y) {
  return a.highContrast
    ? { hush: 0x3a4550, wake: 0xffd23f, awake: 0x00e676, ink: '#000000', bg: '#ffffff' }
    : { hush: 0x7a8794, wake: 0xffb43a, awake: 0x57c98a, ink: '#2d2438', bg: '#fff4e0' };
}
/** Colorblind-safe awake marker: check icon + text + outline, works in grayscale. */
export function awakeMarker(a: A11y, awake: boolean): { icon: string; label: string; outline: boolean } {
  if (!awake) return { icon: '◌', label: 'sleeping', outline: false };
  return a.colorblindSafe ? { icon: '✓', label: 'awake', outline: true } : { icon: '★', label: 'awake', outline: false };
}
export function cycleCaption(a: A11y): A11y { return { ...a, captionScale: a.captionScale === 1 ? 1.25 : a.captionScale === 1.25 ? 1.5 : 1 }; }
