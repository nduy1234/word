import { describe, expect, it } from 'vitest';
import { wordById } from './pack.js';
import {
  articleTile, emptySpell, isComplete, matchesTarget, spellEffect, spellText,
  stretchTile, tileFor, trySnap, type Spell, type Tile,
} from './spell.js';
import {
  checkPreposition, classifyRelation, makeTableFrame, toTableFrame,
  type BoxLike,
} from './preposition-check.js';

const tile = (id: string): Tile => tileFor(wordById(id)!);

function snapAll(tiles: Tile[]): Spell {
  let spell = emptySpell();
  for (const t of tiles) {
    const r = trySnap(spell, t);
    if (!r.ok) throw new Error(`snap rejected: ${r.reason}`);
    spell = r.spell;
  }
  return spell;
}

describe('sentence spells', () => {
  it('verb + object: "open the window"', () => {
    const s = snapAll([tile('open'), articleTile('the'), tile('window')]);
    expect(spellText(s)).toBe('open the window');
    expect(isComplete(s)).toBe(true);
    expect(spellEffect(s)).toMatchObject({ verbId: 'open', objectId: 'window' });
    expect(matchesTarget(s, 'window')).toBe(true);
    expect(matchesTarget(s, 'door')).toBe(false);
  });

  it('phrasal verb is one tile: "turn on the lamp"', () => {
    const s = snapAll([tile('turn-on'), articleTile('the'), tile('lamp')]);
    expect(spellEffect(s)?.verbId).toBe('turn-on');
    expect(isComplete(s)).toBe(true);
  });

  it('a/an snap only to stored article match', () => {
    const bad = trySnap(snapAll([articleTile('a')]), tile('apple'));
    expect(bad.ok).toBe(false);
    if (!bad.ok) { expect(bad.reason).toBe('article-mismatch'); expect(bad.hint).toContain('an apple'); }
    expect(snapAll([articleTile('an'), tile('apple')])).toBeTruthy();
    expect(snapAll([articleTile('a'), tile('cup')])).toBeTruthy();
    expect(snapAll([articleTile('the'), tile('apple')])).toBeTruthy(); // 'the' snaps to any noun
  });

  it('adjective snaps before noun, repels after', () => {
    const s = snapAll([articleTile('the'), tile('red'), tile('cup')]);
    expect(spellText(s)).toBe('the red cup');
    const bad = trySnap(snapAll([articleTile('the'), tile('cup')]), tile('red'));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe('adjective-after-noun');
  });

  it('placement spell: "put the cup on the table" needs landmark', () => {
    const partial = snapAll([tile('put'), articleTile('the'), tile('cup'), tile('on')]);
    expect(isComplete(partial)).toBe(false);
    const full = snapAll([tile('put'), articleTile('the'), tile('cup'), tile('on'), articleTile('the'), tile('table')]);
    expect(isComplete(full)).toBe(true);
    expect(spellEffect(full)).toMatchObject({ verbId: 'put', objectId: 'cup', prepositionId: 'on', landmarkId: 'table' });
    const noVerb = trySnap(snapAll([articleTile('the'), tile('cup')]), tile('on'));
    expect(noVerb.ok).toBe(false);
    if (!noVerb.ok) expect(noVerb.reason).toBe('needs-verb-first');
  });

  it('pinch-stretch pluralizes from stored plural; "a cups" repels', () => {
    const cup = tile('cup');
    const stretched = stretchTile(cup);
    expect(stretched.ok).toBe(true);
    if (stretched.ok) {
      expect(stretched.tile.text).toBe('cups');
      const s = snapAll([articleTile('the'), stretched.tile]);
      expect(spellEffect(s)?.plural).toBe(true);
      const bad = trySnap(snapAll([articleTile('a')]), stretched.tile);
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.reason).toBe('plural-after-article');
    }
    expect(stretchTile(tile('open')).ok).toBe(false);
  });

  it('rejects second verb and leading preposition', () => {
    const two = trySnap(snapAll([tile('open')]), tile('close'));
    expect(two.ok).toBe(false);
    if (!two.ok) expect(two.reason).toBe('already-has-verb');
    const prep = trySnap(emptySpell(), tile('on'));
    expect(prep.ok).toBe(false);
    if (!prep.ok) expect(prep.reason).toBe('needs-object-first');
  });
});

// Table frame: table at (0,0.75,-1.15), player standing at origin side (+z).
const frame = makeTableFrame({ x: 0, y: 0.75, z: -1.15 }, { x: 0, y: 1.6, z: 0 });
const tableBox: BoxLike = { center: { x: 0, y: 0.75, z: -1.15 }, size: { x: 1.1, y: 0.05, z: 0.7 } };
const cupAt = (x: number, y: number, z: number): BoxLike => ({ center: { x, y, z }, size: { x: 0.07, y: 0.09, z: 0.07 } });

describe('preposition checks', () => {
  it('frame: +z toward player', () => {
    expect(toTableFrame({ x: 0, y: 1.6, z: 0 }, frame).z).toBeGreaterThan(0);
    expect(toTableFrame({ x: 0, y: 0.75, z: -1.15 }, frame)).toMatchObject({ x: 0, y: 0, z: 0 });
  });

  it('classifies on / under / next-to / in-front-of / behind', () => {
    expect(classifyRelation(cupAt(0, 0.82, -1.15), tableBox, frame)).toBe('on');
    expect(classifyRelation(cupAt(0, 0.5, -1.15), tableBox, frame)).toBe('under');
    expect(classifyRelation(cupAt(0.75, 0.82, -1.15), tableBox, frame)).toBe('next-to');
    expect(classifyRelation(cupAt(0, 0.82, -0.55), tableBox, frame)).toBe('in-front-of');
    expect(classifyRelation(cupAt(0, 0.82, -1.75), tableBox, frame)).toBe('behind');
    expect(classifyRelation(cupAt(2, 0.82, -1.15), tableBox, frame)).toBe('none');
  });

  it('correct when settled; pending while held or moving', () => {
    const on = cupAt(0, 0.82, -1.15);
    expect(checkPreposition('on', on, tableBox, frame, { stillMs: 1000 }).result).toBe('correct');
    expect(checkPreposition('on', on, tableBox, frame, { held: true, stillMs: 1000 }).result).toBe('pending');
    expect(checkPreposition('on', on, tableBox, frame, { stillMs: 100 }).result).toBe('pending');
  });

  it('almost within 2cm hysteresis; wrong otherwise with actual-relation hint', () => {
    const hovering = cupAt(0, 0.86, -1.15); // bottom 4cm above table top
    const almost = checkPreposition('on', hovering, tableBox, frame, { stillMs: 1000 });
    expect(almost.result).toBe('almost');
    const wrong = checkPreposition('under', cupAt(0, 0.82, -1.15), tableBox, frame, { stillMs: 1000 });
    expect(wrong.result).toBe('wrong');
    expect(wrong.relation).toBe('on');
    expect(wrong.hint).toContain('on the table');
  });

  it('"in" unsupported in v1; word forms accepted', () => {
    expect(checkPreposition('in', cupAt(0, 0.82, -1.15), tableBox, frame, { stillMs: 1000 }).result).toBe('unsupported');
    expect(checkPreposition('next to', cupAt(0.75, 0.82, -1.15), tableBox, frame, { stillMs: 1000 }).result).toBe('correct');
    expect(checkPreposition('in front of', cupAt(0, 0.82, -0.55), tableBox, frame, { stillMs: 1000 }).result).toBe('correct');
  });
});
