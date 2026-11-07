import { describe, expect, it } from 'vitest';
import { buildTiles, castSentence, homeOffset, orderBySnap, slotOffset, stretchArmed, TILE_COLORS, withinSnap, SNAP_RADIUS_M, STRETCH_ARM_MAX_M } from './spell-tiles.js';
import { emptySpell, isComplete, spellText, trySnap } from './spell.js';

describe('spell tile runtime helpers', () => {
  it('tray builds from packs; every kind has art.md color', () => {
    const tiles = buildTiles();
    expect(tiles.length).toBe(10);
    expect(tiles.map((t) => t.entryId)).toContain('door');
    for (const t of tiles) expect(TILE_COLORS[t.kind]).toBeTypeOf('number');
  });
  it('onboarding spell open-the-door snaps and completes from tray tiles', () => {
    const byId = new Map(buildTiles().map((t) => [t.entryId, t]));
    let s = emptySpell();
    for (const id of ['open', 'article-the', 'door']) {
      const r = trySnap(s, byId.get(id)!);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.spell;
    }
    expect(spellText(s)).toBe('open the door');
    expect(isComplete(s)).toBe(true);
    expect(castSentence(spellText(s))).toBe('Open the door!');
  });
  it('wrong order repels at runtime distance gate', () => {
    expect(withinSnap(SNAP_RADIUS_M)).toBe(true);
    expect(withinSnap(SNAP_RADIUS_M + 0.01)).toBe(false);
    const byId = new Map(buildTiles().map((t) => [t.entryId, t]));
    let s = emptySpell();
    const r1 = trySnap(s, byId.get('cup')!); if (r1.ok) s = r1.spell;
    expect(trySnap(s, byId.get('big')!).ok).toBe(false); // adjective after noun
  });
  it('layout: homes spread on front edge, slots centered on table', () => {
    expect(homeOffset(0, 10).x).toBeLessThan(homeOffset(9, 10).x);
    expect(homeOffset(0, 10).z).toBeGreaterThan(slotOffset(0, 3).z);
    expect(Math.abs(slotOffset(0, 3).x + slotOffset(2, 3).x)).toBeLessThan(1e-9);
  });
  it('relayout follows snap order, not tray order (door landmark after "on")', () => {
    const recs = [{ id: 'door', snapSeq: 4 }, { id: 'on', snapSeq: 3 }, { id: 'open', snapSeq: 0 }, { id: 'apple', snapSeq: -1 }];
    expect(orderBySnap(recs).map((r) => r.id)).toEqual(['open', 'on', 'door']);
  });
  it('pinch-stretch arms only hands-close', () => {
    expect(stretchArmed(0.2)).toBe(true);
    expect(stretchArmed(STRETCH_ARM_MAX_M + 0.1)).toBe(false);
    expect(stretchArmed(null)).toBe(false);
  });
});
