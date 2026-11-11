/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SessionMode, VisibilityState, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { FpsSystem } from './word/fps-system.js';
import { CaptionSystem } from './word/caption-system.js';
import { PalmMenuSystem } from './word/palm-menu-system.js';
import { WordSystem } from './word/word-system.js';
import { cycleHelper, detectHelper, type HelperLang } from './word/helper.js';
import { load, save } from './word/store.js';
import { newStreak, visitStreak } from './word/progression.js';
import { DEFAULT_A11Y, captionPx, cycleCaption, type A11y } from './word/accessibility.js';

// Helper picker: auto-detect from locale, one tap/pinch cycles + confirms, saved.
const helperBtn = document.getElementById('helper-picker') as HTMLButtonElement | null;
const immersionBox = document.getElementById('immersion') as HTMLInputElement | null;
try {
  const state = load(localStorage);
  state.streak = visitStreak(state.streak ?? newStreak(Date.now()), Date.now()); // Daily Fog streak + freezes
  save(localStorage, state);
  let helper: HelperLang = state.helperLang === 'auto' || !state.helperLang
    ? detectHelper(navigator.language) : (state.helperLang as HelperLang);
  if (immersionBox) immersionBox.checked = state.immersion;
  const render = () => { if (helperBtn) helperBtn.textContent = `Helper: ${helper === 'es' ? 'Español' : helper === 'vi' ? 'Tiếng Việt' : 'off'} (tap to change)`; };
  render();
  helperBtn?.addEventListener('click', () => {
    helper = cycleHelper(helper);
    const s = load(localStorage); s.helperLang = helper; save(localStorage, s); render();
    try { window.dispatchEvent(new CustomEvent('word:settings')); } catch { /* ignore */ }
  });
  immersionBox?.addEventListener('change', () => {
    const s = load(localStorage); s.immersion = immersionBox.checked; save(localStorage, s);
    try { window.dispatchEvent(new CustomEvent('word:settings')); } catch { /* ignore */ }
  });
  // Accessibility toggles (M4): high contrast, reduced motion, caption size — persisted.
  const contrastBox = document.getElementById('a11y-contrast') as HTMLInputElement | null;
  const motionBox = document.getElementById('a11y-motion') as HTMLInputElement | null;
  const captionBtn = document.getElementById('a11y-caption') as HTMLButtonElement | null;
  let a11y: A11y = { ...DEFAULT_A11Y, ...(state.a11y ?? {}), captionScale: ((state.a11y?.captionScale as A11y['captionScale']) || 1) };
  const applyA11y = () => {
    if (contrastBox) contrastBox.checked = a11y.highContrast;
    if (motionBox) motionBox.checked = a11y.reducedMotion;
    if (captionBtn) captionBtn.textContent = `Caption size: ${a11y.captionScale === 1 ? 'normal' : a11y.captionScale === 1.25 ? 'large' : 'extra large'}`;
    const cap = document.getElementById('caption'); if (cap) cap.style.fontSize = `${captionPx(a11y)}px`;
    // High contrast applies via palette() to scene materials (WordSystem/PalmMenu), not CSS filter.
    const s = load(localStorage); s.a11y = a11y; save(localStorage, s);
    try { window.dispatchEvent(new CustomEvent('word:settings')); } catch { /* ignore */ }
  };
  applyA11y();
  contrastBox?.addEventListener('change', () => { a11y = { ...a11y, highContrast: contrastBox.checked }; applyA11y(); });
  motionBox?.addEventListener('change', () => { a11y = { ...a11y, reducedMotion: motionBox.checked }; applyA11y(); });
  captionBtn?.addEventListener('click', () => { a11y = cycleCaption(a11y); applyA11y(); });
} catch { /* picker optional; game continues English-only */ }

const launchError = document.getElementById('launch-error');
const caption = document.getElementById('caption');
let captionTimer: ReturnType<typeof setTimeout> | undefined;

let immersiveNow = false;
// Captions: in-world CaptionSystem always listens. DOM #caption only non-immersive.
window.addEventListener('word:caption', (event) => {
  if (!caption || immersiveNow) return;
  const d = (event as CustomEvent<unknown>).detail;
  caption.textContent = typeof d === 'string' ? d : ((d as { text?: string })?.text ?? '');
  caption.style.display = 'block';
  if (captionTimer) clearTimeout(captionTimer);
  captionTimer = setTimeout(() => {
    caption.style.display = 'none';
  }, 3000);
});

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
)
  .then((world) => {
    world.registerSystem(WordSystem);
    world.registerSystem(CaptionSystem);
    world.registerSystem(PalmMenuSystem);
    world.registerSystem(PanelSystem);
    if (import.meta.env.DEV) {
      world.registerSystem(FpsSystem);
    }

    const launch = document.getElementById('launch');
    const enterRoom = document.getElementById('enter-room');
    const playVr = document.getElementById('play-vr');

    // Spatial-data permission is requested by the XR session itself on entry.
    // Denial/failure lands back here (NonImmersive) with the fallback intact:
    // the virtual tabletop diorama is always built by WordSystem.
    const launchFail = (ar: boolean) => (error: unknown) => {
      console.error(`[Word] ${ar ? 'MR' : 'VR'} launch failed`, error);
      if (immersiveNow) { try { window.dispatchEvent(new CustomEvent('word:caption', { detail: ar ? 'Mixed reality unavailable here' : 'VR unavailable on this device' })); } catch { /* ignore */ } }
      else if (launchError) launchError.textContent = ar ? 'Mixed reality unavailable here — try "Play in VR instead".' : 'VR unavailable on this device/browser.';
    };
    enterRoom?.addEventListener('click', () => {
      try {
        // launchXR may reject async (permission denied): catch both paths.
        void Promise.resolve(world.launchXR({ sessionMode: SessionMode.ImmersiveAR })).catch(launchFail(true));
      } catch (error) { launchFail(true)(error); }
    });
    playVr?.addEventListener('click', () => {
      try {
        void Promise.resolve(world.launchXR({ sessionMode: SessionMode.ImmersiveVR })).catch(launchFail(false));
      } catch (error) { launchFail(false)(error); }
    });

    world.visibilityState.subscribe((state) => {
      immersiveNow = state !== VisibilityState.NonImmersive;
      if (immersiveNow && caption) caption.style.display = 'none';
      if (launch) {
        launch.style.display = state === VisibilityState.NonImmersive ? 'flex' : 'none';
      }
    });
  })
  .catch((error: unknown) => {
    // Error boundary: a failed world never leaves a blank page.
    console.error('[Word] World.create failed', error);
    if (launchError) {
      launchError.textContent = 'Something failed while loading your room. Reload to try again.';
    }
  });
