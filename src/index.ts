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
import { WordSystem } from './word/word-system.js';
import { cycleHelper, detectHelper, type HelperLang } from './word/helper.js';
import { load, save } from './word/store.js';

// Helper picker: auto-detect from locale, one tap/pinch cycles + confirms, saved.
const helperBtn = document.getElementById('helper-picker') as HTMLButtonElement | null;
const immersionBox = document.getElementById('immersion') as HTMLInputElement | null;
try {
  const state = load(localStorage);
  let helper: HelperLang = state.helperLang === 'auto' || !state.helperLang
    ? detectHelper(navigator.language) : (state.helperLang as HelperLang);
  if (immersionBox) immersionBox.checked = state.immersion;
  const render = () => { if (helperBtn) helperBtn.textContent = `Helper: ${helper === 'es' ? 'Español' : helper === 'vi' ? 'Tiếng Việt' : 'off'} (tap to change)`; };
  render();
  helperBtn?.addEventListener('click', () => {
    helper = cycleHelper(helper);
    const s = load(localStorage); s.helperLang = helper; save(localStorage, s); render();
  });
  immersionBox?.addEventListener('change', () => {
    const s = load(localStorage); s.immersion = immersionBox.checked; save(localStorage, s);
  });
} catch { /* picker optional; game continues English-only */ }

const launchError = document.getElementById('launch-error');
const caption = document.getElementById('caption');
let captionTimer: ReturnType<typeof setTimeout> | undefined;

// Captions: WordSystem dispatches 'word:caption' on poke.
window.addEventListener('word:caption', (event) => {
  if (!caption) return;
  caption.textContent = (event as CustomEvent<string>).detail;
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
    enterRoom?.addEventListener('click', () => {
      try {
        world.launchXR({ sessionMode: SessionMode.ImmersiveAR });
      } catch (error) {
        console.error('[Word] MR launch failed', error);
        if (launchError) launchError.textContent = 'Mixed reality unavailable here — try "Play in VR instead".';
      }
    });
    playVr?.addEventListener('click', () => {
      try {
        world.launchXR({ sessionMode: SessionMode.ImmersiveVR });
      } catch (error) {
        console.error('[Word] VR launch failed', error);
        if (launchError) launchError.textContent = 'VR unavailable on this device/browser.';
      }
    });

    world.visibilityState.subscribe((state) => {
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
