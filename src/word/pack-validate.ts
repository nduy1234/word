/** Pack validation for packs/en/*.json + seed data. Pure, unit-tested. */
import type { WordEntry } from './pack.js';

export function validatePack(words: WordEntry[], packId = 'pack'): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const w of words) {
    const t = `${packId}/${w.id || '?'}`;
    if (!w.id || !w.word) errors.push(`${t}: id and word required`);
    if (ids.has(w.id)) errors.push(`${t}: duplicate id`);
    ids.add(w.id);
    if (!w.ipa?.startsWith('/') || !w.ipa?.endsWith('/')) errors.push(`${t}: ipa needs /slashes/`);
    if (w.cefr !== 'A1' && w.cefr !== 'A2') errors.push(`${t}: cefr must be A1|A2`);
    if (!w.helper?.es || !w.helper?.vi) errors.push(`${t}: helper.es and helper.vi required`);
    if (!w.audio) errors.push(`${t}: audio path required`);
    if (w.example && !w.example.toLowerCase().includes(w.word.toLowerCase().split(' ')[0]))
      errors.push(`${t}: example must contain word`);
    const grammar = ['verb', 'phrasalVerb', 'preposition', 'adjective'].includes(w.partOfSpeech);
    if (grammar && (w.sceneLabel || w.propId)) errors.push(`${t}: grammar word must not bind sceneLabel/propId`);
    if (!grammar && Boolean(w.sceneLabel) === Boolean(w.propId))
      errors.push(`${t}: exactly one of sceneLabel/propId required`);
    if (w.partOfSpeech === 'noun') {
      if (w.article !== 'a' && w.article !== 'an') errors.push(`${t}: noun article must be stored as a|an`);
      if (!w.plural) errors.push(`${t}: noun plural required`);
    }
  }
  return errors;
}
