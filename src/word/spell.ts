/**
 * Sentence Spells: English grammar as magnetic tile snapping. Pure, unit-tested.
 * Rules (PLAN Sentence Spells): verb + object, phrasal verb = one tile,
 * adjective only before noun (wrong order repels), a/an snap only to stored
 * article match ('the' snaps to any noun), pinch-stretch pluralizes from
 * stored plural, preposition + landmark completes a placement spell.
 * XR tile entities call trySnap(); this module never touches the scene.
 */
import type { WordEntry } from './pack.js';

export type TileKind = 'verb' | 'phrasalVerb' | 'noun' | 'adjective' | 'preposition' | 'article';

export interface Tile {
  entryId: string; // pack id, or 'article-a' | 'article-an' | 'article-the'
  kind: TileKind;
  text: string; // display word(s); plural form after stretch
  article?: 'a' | 'an'; // nouns only: stored article from pack data
  plural?: string; // nouns only: stored plural from pack data
  form: 'base' | 'plural';
}

export function tileFor(entry: WordEntry): Tile {
  return {
    entryId: entry.id, kind: entry.partOfSpeech, text: entry.word,
    article: entry.article, plural: entry.plural, form: 'base',
  };
}

export function articleTile(article: 'a' | 'an' | 'the'): Tile {
  return { entryId: `article-${article}`, kind: 'article', text: article, form: 'base' };
}

export interface Spell { tiles: Tile[] }
export function emptySpell(): Spell { return { tiles: [] }; }

export type SnapReject =
  | 'needs-object-first' | 'needs-noun' | 'needs-verb-first' | 'already-has-verb'
  | 'already-has-article' | 'article-after-adjective' | 'one-adjective'
  | 'article-mismatch' | 'plural-after-article' | 'adjective-after-noun' | 'spell-full';

export type SnapResult =
  | { ok: true; spell: Spell }
  | { ok: false; reason: SnapReject; hint: string };

interface NounPhrase { article?: Tile; adjective?: Tile; noun?: Tile }

interface Parsed {
  verb?: Tile;
  np1: NounPhrase;
  preposition?: Tile;
  np2?: NounPhrase;
  phase: 'start' | 'after-verb' | 'in-np' | 'np-closed' | 'after-prep' | 'in-np2' | 'done';
}

function parseNP(tiles: Tile[], i: number): { np: NounPhrase; next: number } {
  const np: NounPhrase = {};
  if (tiles[i]?.kind === 'article') { np.article = tiles[i]; i += 1; }
  if (tiles[i]?.kind === 'adjective') { np.adjective = tiles[i]; i += 1; }
  if (tiles[i]?.kind === 'noun') { np.noun = tiles[i]; i += 1; }
  return { np, next: i };
}

function parse(tiles: Tile[]): Parsed {
  let i = 0;
  let verb: Tile | undefined;
  if (tiles[0]?.kind === 'verb' || tiles[0]?.kind === 'phrasalVerb') { verb = tiles[0]; i = 1; }
  const first = parseNP(tiles, i);
  i = first.next;
  if (!first.np.noun) {
    const started = Boolean(first.np.article || first.np.adjective);
    return { verb, np1: first.np, phase: tiles.length === 0 ? 'start' : verb && !started ? 'after-verb' : 'in-np' };
  }
  if (tiles[i]?.kind === 'preposition') {
    const preposition = tiles[i];
    const second = parseNP(tiles, i + 1);
    const phase = second.np.noun ? 'done' : (second.np.article || second.np.adjective) ? 'in-np2' : 'after-prep';
    return { verb, np1: first.np, preposition, np2: second.np, phase };
  }
  return { verb, np1: first.np, phase: 'np-closed' };
}

function reject(reason: SnapReject, hint: string): SnapResult {
  return { ok: false, reason, hint };
}

/** Article/plural gate checked at the moment a noun snaps into a phrase. */
function checkNounSnap(np: NounPhrase, noun: Tile): SnapResult | null {
  if (np.article && np.article.text !== 'the' && noun.form !== 'plural'
    && noun.article && noun.article !== np.article.text) {
    return reject('article-mismatch', `Say "${noun.article} ${noun.text}" — try the other little word.`);
  }
  if (np.article && np.article.text !== 'the' && noun.form === 'plural') {
    return reject('plural-after-article', `"${np.article.text} ${noun.text}"? Drop the little word for many.`);
  }
  return null;
}

function snapIntoNP(spell: Spell, parsed: Parsed, np: NounPhrase, tile: Tile): SnapResult {
  if (tile.kind === 'article') {
    if (np.article) return reject('already-has-article', 'One little word is enough.');
    if (np.adjective) return reject('article-after-adjective', 'The little word goes first.');
    return { ok: true, spell: { tiles: [...spell.tiles, tile] } };
  }
  if (tile.kind === 'adjective') {
    if (np.adjective) return reject('one-adjective', 'One describing word at A1–A2.');
    return { ok: true, spell: { tiles: [...spell.tiles, tile] } };
  }
  if (tile.kind === 'noun') {
    const bad = checkNounSnap(np, tile);
    if (bad) return bad;
    return { ok: true, spell: { tiles: [...spell.tiles, tile] } };
  }
  if (tile.kind === 'preposition') return reject('needs-noun', 'Name the thing first.');
  return reject('needs-noun', 'Name the thing first.');
}

/** Try to snap a tile onto the end of a spell. Repel = ok:false + kid-safe hint. */
export function trySnap(spell: Spell, tile: Tile): SnapResult {
  const p = parse(spell.tiles);
  switch (p.phase) {
    case 'start':
      if (tile.kind === 'preposition') return reject('needs-object-first', 'Start with an action or a thing.');
      if (tile.kind === 'verb' || tile.kind === 'phrasalVerb') return { ok: true, spell: { tiles: [tile] } };
      return snapIntoNP(spell, p, p.np1, tile);
    case 'after-verb':
      if (tile.kind === 'verb' || tile.kind === 'phrasalVerb') return reject('already-has-verb', 'One action word is enough.');
      if (tile.kind === 'preposition') return reject('needs-object-first', 'Name the thing first.');
      return snapIntoNP(spell, p, p.np1, tile);
    case 'in-np':
      return snapIntoNP(spell, p, p.np1, tile);
    case 'in-np2':
      return snapIntoNP(spell, p, p.np2!, tile);
    case 'after-prep':
      if (tile.kind === 'verb' || tile.kind === 'phrasalVerb' || tile.kind === 'preposition') {
        return reject('needs-noun', 'Where? Name the place-thing.');
      }
      return snapIntoNP(spell, p, p.np2!, tile);
    case 'np-closed':
      if (tile.kind === 'adjective') return reject('adjective-after-noun', 'Describing words go before the thing. It pushes back!');
      if (tile.kind === 'preposition') {
        if (!p.verb) return reject('needs-verb-first', 'Add an action word first, like "put".');
        return { ok: true, spell: { tiles: [...spell.tiles, tile] } };
      }
      return reject('spell-full', 'That spell is ready — flick it!');
    case 'done':
      return reject('spell-full', 'That spell is ready — flick it!');
  }
  return reject('spell-full', 'That spell is ready — flick it!');
}

/** Pinch-stretch: pluralize a noun tile from stored plural. Prop multiplies in XR. */
export function stretchTile(tile: Tile): { ok: true; tile: Tile } | { ok: false; reason: 'not-a-noun' | 'no-plural' | 'already-plural'; hint: string } {
  if (tile.kind !== 'noun') return { ok: false, reason: 'not-a-noun', hint: 'Only thing-words stretch.' };
  if (tile.form === 'plural') return { ok: false, reason: 'already-plural', hint: 'Already many!' };
  if (!tile.plural) return { ok: false, reason: 'no-plural', hint: 'This word has no many-form.' };
  return { ok: true, tile: { ...tile, text: tile.plural, form: 'plural' } };
}

/** Complete = object named, and any preposition has its landmark. */
export function isComplete(spell: Spell): boolean {
  const p = parse(spell.tiles);
  if (!p.np1.noun) return false;
  if (p.preposition && !p.np2?.noun) return false;
  return true;
}

export function spellText(spell: Spell): string {
  return spell.tiles.map((t) => t.text).join(' ');
}

export interface SpellEffect {
  verbId?: string;
  objectId: string;
  adjectiveId?: string;
  prepositionId?: string;
  landmarkId?: string;
  plural: boolean;
}

/** What the flicked spell should do in the world. Null until a noun is named. */
export function spellEffect(spell: Spell): SpellEffect | null {
  const p = parse(spell.tiles);
  if (!p.np1.noun) return null;
  return {
    verbId: p.verb?.entryId,
    objectId: p.np1.noun.entryId,
    adjectiveId: p.np1.adjective?.entryId,
    prepositionId: p.preposition?.entryId,
    landmarkId: p.np2?.noun?.entryId,
    plural: p.np1.noun.form === 'plural',
  };
}

/** Flick targeting: spell wakes the object it names. */
export function matchesTarget(spell: Spell, targetEntryId: string): boolean {
  return spellEffect(spell)?.objectId === targetEntryId;
}
