/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Dev-only FPS overlay: writes into the #fps element from index.html.
 * Registered only when import.meta.env.DEV is true.
 */

import { createSystem } from '@iwsdk/core';

export class FpsSystem extends createSystem({}) {
  private frames = 0;
  private lastSample = performance.now();

  update(): void {
    this.frames += 1;
    const now = performance.now();
    const elapsed = now - this.lastSample;
    if (elapsed < 500) return;
    const fps = Math.round((this.frames * 1000) / elapsed);
    this.frames = 0;
    this.lastSample = now;
    const element = document.getElementById('fps');
    if (element) {
      element.style.display = 'block';
      element.textContent = `${fps} fps`;
      element.style.color = fps >= 60 ? '#57c98a' : '#ff7a59';
    }
    if (fps < 60) {
      console.warn(`[Word perf] ${fps} fps — below 60 fps budget`);
    }
  }
}
