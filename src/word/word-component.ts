/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createComponent, Types } from '@iwsdk/core';

/** A nameable thing: real-room surface (via scene label) or diorama prop. */
export const WordTarget = createComponent('WordTarget', {
  wordId: { type: Types.String, default: '' },
  state: { type: Types.String, default: 'sleeping' }, // sleeping | awake
  bloom: { type: Types.Float32, default: 0 }, // 1 at wake moment, decays to 0
});

/** A draggable Sentence Spell tile (see spell.ts / spell-tiles.ts). */
export const SpellTile = createComponent('SpellTile', {
  entryId: { type: Types.String, default: '' },
  kind: { type: Types.String, default: '' },
  snapped: { type: Types.Boolean, default: false },
});

/** Mic orb for voice wake: press starts consent / 3s voice-wake flow. */
export const MicOrb = createComponent('MicOrb', {});
