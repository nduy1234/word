/** Pack validation for packs/en/*.json + seed data. Pure, unit-tested. */
import type { WordEntry } from './pack.js';

export function validatePack(words: WordEntry[], packId = 'pack'): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const w of words) {
    if (!w || typeof w !== 'object') { errors.push(`${packId}/?: entry must be an object`); continue; }
    const t = `${packId}/${w.id || '?'}`;
    // Untrusted input (AI room packs): every field may be a non-string.
    // Type-guard before any string op — this validator must never throw.
    if (typeof w.id !== 'string' || !w.id || typeof w.word !== 'string' || !w.word) errors.push(`${t}: id and word required`);
    if (!['noun', 'verb', 'phrasalVerb', 'preposition', 'adjective'].includes(w.partOfSpeech))
      errors.push(`${t}: partOfSpeech invalid`);
    if (typeof w.example !== 'string' || !w.example) errors.push(`${t}: example required`);
    if (ids.has(w.id)) errors.push(`${t}: duplicate id`);
    ids.add(w.id);
    if (typeof w.ipa !== 'string' || !w.ipa.startsWith('/') || !w.ipa.endsWith('/')) errors.push(`${t}: ipa needs /slashes/`);
    if (w.cefr !== 'A1' && w.cefr !== 'A2') errors.push(`${t}: cefr must be A1|A2`);
    if (typeof w.helper?.es !== 'string' || !w.helper.es || typeof w.helper?.vi !== 'string' || !w.helper.vi) errors.push(`${t}: helper.es and helper.vi required`);
    if (typeof w.audio !== 'string' || !w.audio) errors.push(`${t}: audio path required`);
    if (typeof w.example === 'string' && w.example && typeof w.word === 'string' && w.word && !w.example.toLowerCase().includes(w.word.toLowerCase().split(' ')[0]))
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
