import { describe, expect, it } from 'vitest';
import { yawFromForward, forwardFromYaw, nextPanelYaw, panelPosition } from './panel-follow.js';
import { palmFacingHead, palmNormalFromQuat } from './palm.js';
import { audioChain, clipUrl } from './word-audio.js';
import { clampToCone } from './fov.js';

describe('panel follow', () => {
  it('yaw round trip + cone clamp', () => {
    const f = forwardFromYaw(20);
    expect(yawFromForward(f)).toBeCloseTo(20, 5);
    expect(clampToCone(80)).toBe(25);
    // panel never jumps more than cone + lazy step toward head
    const next = nextPanelYaw(0, 90);
    expect(next).toBeGreaterThan(0); expect(next).toBeLessThanOrEqual(25);
    const p = panelPosition({ x: 0, y: 1.6, z: 0 }, 0, 1.2, -0.28);
    expect(p.z).toBeCloseTo(-1.2); expect(p.y).toBeCloseTo(1.32);
  });
});
describe('palm detection', () => {
  it('faces head within reach only', () => {
    expect(palmFacingHead({ x: 0, y: 0, z: 1 }, { x: 0, y: 1.4, z: -0.3 }, { x: 0, y: 1.6, z: 0 })).toBe(true);
    expect(palmFacingHead({ x: 0, y: 0, z: -1 }, { x: 0, y: 1.4, z: -0.3 }, { x: 0, y: 1.6, z: 0 })).toBe(false);
    expect(palmFacingHead({ x: 0, y: 0, z: 1 }, { x: 0, y: 1.4, z: -2 }, { x: 0, y: 1.6, z: 0 })).toBe(false);
    const n = palmNormalFromQuat({ x: 0, y: 0, z: 0, w: 1 });
    expect(n.y).toBeCloseTo(-1);
  });
});
describe('word audio chain', () => {
  it('clip then tts then caption', () => {
    expect(audioChain(true, true)).toEqual(['clip', 'tts', 'caption']);
    expect(audioChain(false, true)).toEqual(['tts', 'caption']);
    expect(audioChain(false, false)).toEqual(['caption']);
    expect(clipUrl('audio/en-US/cup.mp3')).toBe('/audio/en-US/cup.mp3');
  });
});
