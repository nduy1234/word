import { describe, expect, it } from 'vitest';
import { DEFAULT_A11Y, awakeMarker, captionPx, cycleCaption, palette } from './accessibility.js';
import { nextOnboarding, onboardingCaption, ONBOARDING } from './onboarding.js';
import { PauseGate, pauseHint } from './pause.js';
import { assessPerf, BUDGET } from './perf.js';
import { clampToCone, inCone, lazyFollow } from './fov.js';

describe('accessibility', () => {
  it('caption size scales, min readable; cycles 1 -> 1.25 -> 1.5', () => {
    expect(captionPx(DEFAULT_A11Y)).toBe(22);
    expect(captionPx(cycleCaption(DEFAULT_A11Y))).toBe(28);
    expect(captionPx(cycleCaption(cycleCaption(DEFAULT_A11Y)))).toBe(33);
  });
  it('awake marker never color alone: icon + label + outline', () => {
    const m = awakeMarker(DEFAULT_A11Y, true);
    expect(m.icon).toBe('✓'); expect(m.label).toBe('awake'); expect(m.outline).toBe(true);
    expect(awakeMarker(DEFAULT_A11Y, false).label).toBe('sleeping');
  });
  it('high contrast palette differs', () => { expect(palette({ ...DEFAULT_A11Y, highContrast: true }).awake).not.toBe(palette(DEFAULT_A11Y).awake); });
});

describe('onboarding first five minutes', () => {
  it('sequence fog -> poke -> flick -> spell -> place -> done, captions only', () => {
    expect(ONBOARDING.map((s) => s.step)).toEqual(['fog', 'poke-table', 'ghost-flick', 'first-spell', 'place-cup', 'done']);
    let s = nextOnboarding('fog', 'watch'); expect(s).toBe('poke-table');
    s = nextOnboarding(s, 'poke:table'); expect(s).toBe('ghost-flick');
    s = nextOnboarding(s, 'wake:window'); expect(s).toBe('first-spell');
    s = nextOnboarding(s, 'spell:open-door'); expect(s).toBe('place-cup');
    s = nextOnboarding(s, 'place:cup-on-table'); expect(s).toBe('done');
    expect(nextOnboarding('poke-table', 'wake:window')).toBe('poke-table'); // wrong event: no advance
    expect(onboardingCaption('poke-table')).toBe('table'); // word-only caption, no text wall
    expect(ONBOARDING.every((x) => x.caption.length <= 32)).toBe(true);
  });
  it('every teach step has ghost-hand demo', () => {
    for (const s of ONBOARDING.filter((x) => !['fog', 'done'].includes(x.step))) expect(s.ghost).toBeTruthy();
  });
});

describe('pause/resume + hand loss', () => {
  it('gate: any reason pauses, all cleared resumes', () => {
    const g = new PauseGate();
    expect(g.add('hidden')).toBe(true); expect(g.paused).toBe(true);
    g.add('hands-lost'); g.remove('hidden'); expect(g.paused).toBe(true);
    expect(g.remove('hands-lost')).toBe(true); expect(g.paused).toBe(false);
    expect(pauseHint(['hands-lost'])).toContain('Show your hands');
    expect(pauseHint(['hidden'])).toContain('saved');
  });
});

describe('perf budget + FoV', () => {
  it('budget flags fps/draw/tris overages', () => {
    expect(assessPerf({ fps: 72, drawCalls: 20, triangles: 15000 }).ok).toBe(true);
    expect(assessPerf({ fps: 45, drawCalls: 20, triangles: 1 }).issues[0]).toContain('fps');
    expect(assessPerf({ fps: 72, drawCalls: BUDGET.maxDrawCalls, triangles: 1 }).ok).toBe(false);
    expect(assessPerf({ fps: 72, drawCalls: 1, triangles: BUDGET.maxTriangles + 1 }).ok).toBe(false);
  });
  it('cone clamp ±25°, lazy follow deadband', () => {
    expect(clampToCone(40)).toBe(25); expect(clampToCone(-40)).toBe(-25);
    expect(inCone(20)).toBe(true); expect(inCone(30)).toBe(false);
    expect(lazyFollow(0, 5)).toBe(0); // inside deadband: no motion
    expect(lazyFollow(0, 30)).toBeGreaterThan(0);
  });
});
