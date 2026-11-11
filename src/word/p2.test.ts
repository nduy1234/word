import { describe, expect, it } from 'vitest';
import { FLICK_MIN_SPEED_MS, handSpeedMs, isFlick, spritePoint } from './flick.js';
import { preferPackQuest, seedPackForLabels } from './room-pack-client.js';

describe('P2 flick gesture', () => {
  it('hand speed in m/s, dt guard', () => {
    expect(handSpeedMs({ x: 0, y: 0, z: 0 }, { x: 0.3, y: 0, z: 0 }, 100)).toBeCloseTo(3);
    expect(handSpeedMs({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0)).toBe(0);
  });
  it('flick threshold forgiving at 1 m/s', () => {
    expect(isFlick(FLICK_MIN_SPEED_MS)).toBe(true);
    expect(isFlick(0.99)).toBe(false);
    expect(isFlick(2.5)).toBe(true);
  });
  it('sprite path: endpoints exact, midpoint arcs up', () => {
    const from = { x: 0, y: 1.5, z: 0 };
    const to = { x: 0, y: 1.2, z: -2 };
    expect(spritePoint(from, to, 0)).toEqual(from);
    expect(spritePoint(from, to, 1)).toEqual(to);
    expect(spritePoint(from, to, 0.5).y).toBeGreaterThan(1.35);
    expect(spritePoint(from, to, 2)).toEqual(to); // clamped
  });
});

describe('P2 room-aware curriculum', () => {
  it('pack-preferred quest picked first; empty pack = deck order', () => {
    const deck = [{ wordId: 'cup' }, { wordId: 'window' }, { wordId: 'door' }];
    expect(preferPackQuest(deck, ['door', 'window'])?.wordId).toBe('window'); // first in deck order among pack words
    expect(preferPackQuest(deck, [])).toBeUndefined();
    expect(preferPackQuest(deck, ['shelf'])).toBeUndefined();
  });
  it('seed fallback: known labels map, unknown skipped, empty = room words', () => {
    expect(seedPackForLabels(['window', 'couch']).map((w) => w.id)).toEqual(['window', 'couch']);
    expect(seedPackForLabels(['spaceship']).length).toBeGreaterThan(5);
  });
});
