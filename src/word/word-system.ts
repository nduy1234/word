/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * M1 slice: fallback table diorama with poke-to-hear + wake bloom, plus
 * real-room targets spawned from scene-understanding mesh labels.
 * Every feature is wrapped so a failure disables the slice, never the session.
 */

import {
  BoxGeometry,
  CanvasTexture,
  Color,
  createSystem,
  CylinderGeometry,
  Grabbed,
  Mesh,
  MeshStandardMaterial,
  OneHandGrabbable,
  Pressed,
  RayInteractable,
  SphereGeometry,
  VisibilityState,
  XRMesh,
  InputComponent,
} from '@iwsdk/core';
import { SpellTile, WordTarget, MicOrb } from './word-component.js';
import { emptySpell, isComplete, spellEffect, spellText, stretchTile, trySnap, type Spell, type Tile } from './spell.js';
import { buildTiles, castSentence, homeOffset, orderBySnap, slotOffset, stretchArmed, TILE_COLORS, withinSnap, STRETCH_RATIO } from './spell-tiles.js';
import { CAFE_PROPS, KITCHEN_PROPS, wordById, wordForSceneLabel, type WordEntry } from './pack.js';
import { fadeAmount, gradeCard, newCard, type CardState } from './scheduler.js';
import { load, save, fromTableRelative, toTableRelative, type SaveState } from './store.js';
import { playSfx } from './sound.js';
import { PauseGate } from './pause.js';
import { DEFAULT_A11Y, palette, type A11y } from './accessibility.js';
import { assessPerf } from './perf.js';
import { nextOnboarding, onboardingCaption, type OnbStep } from './onboarding.js';
import { askEcho } from './echo.js';
import { HandLossTracker, sourceIsHand } from './hand-presence.js';
import { checkPreposition, makeTableFrame, SETTLE_MS, type BoxLike } from './preposition-check.js';
import { ROOM_WORDS } from './pack.js';
import { buildDeck, type Quest } from './deck.js';
import { newRush, startRush, tickRush, hitRush, pauseRush, resumeRush, type RushState } from './hush-rush.js';
import { aimAssist } from './aim-assist.js';
import { browserRecorder, voiceWake } from './voice-wake.js';
import { helperText, detectHelper, type HelperLang } from './helper.js';
import { preloadClips, speakWord } from './word-audio-player.js';
import { atlasSummary, echoForm, muralPercent, unlockedDistricts } from './progression.js';
import type { PrepositionId } from './preposition-check.js';

const PREP_CYCLE: PrepositionId[] = ['on', 'under', 'next-to', 'in-front-of', 'behind'];
const PREP_READABLE: Record<PrepositionId, string> = { on: 'on', under: 'under', 'next-to': 'next to', 'in-front-of': 'in front of', behind: 'behind' };

const HUSH = new Color(0x7a8794); // docs/art.md Hush fog
const WAKE = new Color(0xffb43a); // docs/art.md Wake warm
const AWAKE = new Color(0x57c98a); // docs/art.md Life green

function speak(entry: WordEntry, helperLang: HelperLang = 'none', immersion = false): void {
  // Chain: pre-generated clip -> speechSynthesis -> caption only (word-audio-player).
  const helper = helperText(entry, helperLang, immersion);
  const caption = helper ? `${entry.word} - ${entry.ipa} | ${helper}` : `${entry.word} - ${entry.ipa}`;
  console.info(`[Word caption] ${caption}`);
  try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: caption })); } catch { /* no DOM */ }
  void speakWord(entry);
}

export class WordSystem extends createSystem({
  targets: { required: [WordTarget] },
  pressedTargets: { required: [WordTarget, Pressed] },
  pressedMic: { required: [MicOrb, Pressed] },
  grabbedTargets: { required: [WordTarget, Grabbed] },
  grabbedTiles: { required: [SpellTile, Grabbed] },
  pressedTiles: { required: [SpellTile, Pressed] },
  sceneMeshes: { required: [XRMesh] },
}) {
  private claimedLabels = new Set<string>();
  private gate = new PauseGate();
  private a11y: A11y = DEFAULT_A11Y;
  private perfFrames = 0;
  private perfLast = 0;
  private onbStep: OnbStep = 'fog';
  private echoCalls = 0;
  private handTracker = new HandLossTracker();
  private immersive = false;
  private grabbedIds = new Set<string>();
  private pendingPlace: { wordId: string; object: Mesh; releasedAt: number; lastX: number; lastY: number; lastZ: number } | null = null;
  private tableObject: Mesh | null = null;
  private tileRecs: { tile: Tile; object: Mesh; entity: { getValue: Function; setValue: Function; addComponent: Function; removeComponent: Function }; home: { x: number; y: number; z: number }; redraw: (t: string) => void; returning: boolean; snapSeq: number }[] = [];
  private spell: Spell = emptySpell();
  private stretchStart: number | null = null;
  private cards = new Map<string, CardState>();
  private persisted: SaveState | null = null;
  private tableOrigin: { x: number; y: number; z: number } | null = null;
  private elapsed = 0;
  private dioramaParts: { object: Mesh; offsetX: number; isTable?: boolean; isTile?: boolean; isCafe?: boolean }[] = [];
  private dioramaOnRealTable = false;
  private quest: Quest | null = null;
  private rush: RushState | null = null;
  private rushLastCaptionSec = -1;
  private rushWasPaused = false;
  private voiceBusy = false;
  private consentPending = false;
  private farTargets = new Map<string, { x: number; y: number; z: number }>();
  private gazeId: string | null = null;
  private prevTrigger = false;
  private questAnnounced = false;
  private cafeRecs: { object: Mesh; offsetX: number }[] = [];
  private cafeUnlocked = false;
  private echoMesh: Mesh | null = null;
  private echoLevel = 0;
  private mural: Mesh | null = null;
  private muralRedraw: ((awakeCount: number, total: number, pct: number) => void) | null = null;
  private lastMuralPct = -1;
  private muralOnWall = false;
  private driftNoted = false;
  private prepIndex = 0;

  init(): void {
    try {
      this.persisted = load(localStorage);
      if (this.persisted.a11y) this.a11y = { ...DEFAULT_A11Y, ...this.persisted.a11y, captionScale: (this.persisted.a11y.captionScale as A11y['captionScale']) || 1 };
      this.cards = new Map(this.persisted.cards.map((c) => [c.wordId, c]));
    } catch { this.persisted = null; }
    try {
      this.buildFallbackDiorama();
    } catch (error) {
      console.error('[Word] diorama build failed; slice disabled', error);
    }

    this.queries.pressedTargets.subscribe('qualify', (entity) => {
      try {
        const entry = wordById(entity.getValue(WordTarget, 'wordId') ?? '');
        if (!entry) return;
        speak(entry, this.helperLangNow(), this.immersionNow());
        playSfx('pop');
        const now0 = Date.now();
        const existing = this.cards.get(entry.id);
        const reviewable = entity.getValue(WordTarget, 'state') === 'awake' && existing && existing.dueAt <= now0;
        if (entity.getValue(WordTarget, 'state') === 'sleeping' || reviewable) {
          entity.setValue(WordTarget, 'state', 'awake');
          entity.setValue(WordTarget, 'bloom', 1);
          const now = Date.now();
          const prev = this.cards.get(entry.id) ?? newCard(entry.id, now);
          this.cards.set(entry.id, gradeCard(prev, 4, now));
          this.persistProgress();
          playSfx('wake');
          // Onboarding advance (first session only, captions only).
          if (!this.persisted?.onboardingDone && this.onbStep !== 'done') {
            if (this.onbStep === 'fog') this.onbStep = 'poke-table';
            // Aliases until spell/placement runtimes land: waking door/cup completes those steps.
            const goal = entry.id === 'table' ? 'poke:table'
              : this.onbStep === 'first-spell' && entry.id === 'door' ? 'spell:open-door'
              : this.onbStep === 'place-cup' && entry.id === 'cup' ? 'place:cup-on-table'
              : `wake:${entry.id}`;
            this.onbStep = nextOnboarding(this.onbStep, goal);
            try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: onboardingCaption(this.onbStep) })); } catch { /* no DOM */ }
            if (this.onbStep === 'done' && this.persisted) { this.persisted.onboardingDone = true; this.persistProgress(); }
          }
          // Echo reacts to wake (max 3/session, offline scripted fallback inside askEcho).
          if (this.echoCalls < 3) {
            this.echoCalls += 1;
            void askEcho({ knownIds: [...this.cards.keys()], justWokeId: entry.id }).then((r) => {
              try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: r.data.line })); } catch { /* no DOM */ }
            }).catch(() => { /* Echo optional */ });
          }
          console.info(`[Word] woke ${entry.word} (${entry.ipa})`);
          if (this.rush?.phase === 'running') { this.rush = hitRush(this.rush, true); }
          if (this.quest?.wordId === entry.id) this.refreshQuest(true);
        }
      } catch (error) {
        console.error('[Word] press handling failed', error);
      }
    });

    this.queries.pressedMic.subscribe('qualify', () => { void this.handleMic(); });
    window.addEventListener('word:mic', () => { void this.handleMic(); });
    window.addEventListener('word:atlas', () => {
      try {
        const awake = new Set(this.cards.keys());
        const mastered = new Set([...this.cards.values()].filter((c) => c.reps >= 3).map((c) => c.wordId));
        const s = atlasSummary(awake, mastered);
        try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: { text: `Atlas: ${s.awakeCount}/${s.total} awake, ${s.masteredCount} mastered`, sub: s.lines.join(' | '), sticky: true } })); } catch { /* no panel */ }
      } catch { /* atlas optional */ }
    });
    window.addEventListener('word:rush-start', () => this.startRushNow());
    window.addEventListener('word:settings', () => {
      try { const s = load(localStorage); if (s.a11y) this.a11y = { ...DEFAULT_A11Y, ...s.a11y, captionScale: (s.a11y.captionScale as A11y['captionScale']) || 1 }; this.persisted = s; } catch { /* ignore */ }
    });
    try { preloadClips([...ROOM_WORDS, ...KITCHEN_PROPS, ...CAFE_PROPS]); } catch { /* audio optional */ }
    this.refreshQuest(false);

    this.queries.grabbedTargets.subscribe('qualify', (entity) => {
      const id = entity.getValue(WordTarget, 'wordId') ?? '';
      if (id) { this.grabbedIds.add(id); if (this.pendingPlace?.wordId === id) this.pendingPlace = null; }
      if (id === 'cup') this.caption(`Put the cup ${PREP_READABLE[PREP_CYCLE[this.prepIndex]]} the table`);
    });
    this.queries.grabbedTargets.subscribe('disqualify', (entity) => {
      try {
        const id = entity.getValue(WordTarget, 'wordId') ?? '';
        this.grabbedIds.delete(id);
        const object = entity.object3D as Mesh | null;
        if (id && object) this.pendingPlace = { wordId: id, object, releasedAt: performance.now(), lastX: object.position.x, lastY: object.position.y, lastZ: object.position.z };
      } catch { /* placement optional */ }
    });

    // Spell tiles: grab shows word; release near next slot tries snap.
    this.queries.grabbedTiles.subscribe('qualify', (entity) => {
      const rec = this.tileRecs.find((r) => (r.entity as unknown) === entity);
      if (!rec) return;
      rec.returning = false;
      this.stretchStart = null;
      const entry = wordById(rec.tile.entryId);
      this.caption(entry ? `${rec.tile.text} - ${entry.ipa}` : rec.tile.text);
    });
    this.queries.grabbedTiles.subscribe('disqualify', (entity) => {
      try {
        const rec = this.tileRecs.find((r) => (r.entity as unknown) === entity);
        if (!rec || rec.entity.getValue(SpellTile, 'snapped')) return;
        const slot = this.slotWorld(this.spell.tiles.length, this.spell.tiles.length + 1);
        const d = Math.hypot(rec.object.position.x - slot.x, rec.object.position.y - slot.y, rec.object.position.z - slot.z);
        if (!withinSnap(d)) { rec.returning = true; return; }
        const r = trySnap(this.spell, rec.tile);
        if (!r.ok) { this.caption(r.hint); playSfx('boing'); rec.returning = true; return; } // repel
        this.spell = r.spell;
        rec.snapSeq = this.spell.tiles.length - 1;
        rec.entity.setValue(SpellTile, 'snapped', true);
        rec.entity.removeComponent(OneHandGrabbable);
        this.relayoutSpell();
        playSfx('snap');
        this.caption(isComplete(this.spell) ? `${spellText(this.spell)} - poke a tile to cast!` : spellText(this.spell));
      } catch (error) { console.warn('[Word] tile snap failed', error); }
    });
    // Poke snapped tile with complete spell -> cast.
    this.queries.pressedTiles.subscribe('qualify', (entity) => {
      try {
        if (entity.getValue(SpellTile, 'snapped') && isComplete(this.spell)) this.castSpell();
      } catch (error) { console.warn('[Word] spell cast failed', error); }
    });

    this.queries.sceneMeshes.subscribe('qualify', (entity) => {
      try {
        this.claimSceneMesh(entity);
      } catch (error) {
        console.error('[Word] scene mesh claim failed', error);
      }
    });

    // Pause/resume: visibility loss or blur pauses timers + saves; resume restores.
    const onVis = () => { if (document.hidden) { this.gate.add('hidden'); this.persistProgress(); } else this.gate.remove('hidden'); };
    const onBlur = () => { this.gate.add('blur'); this.persistProgress(); };
    const onFocus = () => this.gate.remove('blur');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus);
    // Hand-tracking loss: runtime dispatches 'word:hands-lost'/'word:hands-back' (device QA in docs/QA.md).
    window.addEventListener('word:hands-lost', () => this.gate.add('hands-lost'));
    window.addEventListener('word:hands-back', () => this.gate.remove('hands-lost'));
    this.cleanupFuncs.push(
      () => document.removeEventListener('visibilitychange', onVis),
      this.world.visibilityState.subscribe((state) => {
        if (state !== VisibilityState.Visible && state !== VisibilityState.NonImmersive) {
          this.gate.add('session-end'); this.persistProgress();
          try { globalThis.speechSynthesis?.cancel(); } catch { /* captions only */ }
        } else this.gate.remove('session-end');
        this.immersive = state === VisibilityState.Visible;
      }),
    );
  }

  private helperLangNow(): HelperLang {
    const raw = this.persisted?.helperLang;
    return !raw || raw === 'auto' ? detectHelper(typeof navigator !== 'undefined' ? navigator.language : '') : (raw as HelperLang);
  }
  private immersionNow(): boolean { return !!this.persisted?.immersion; }

  /** Deck: due reviews first, then new. Sets current quest + caption. */
  private refreshQuest(announce: boolean): void {
    try {
      const cafeIds = new Set(CAFE_PROPS.map((w) => w.id));
      const present = [...new Set([...this.queries.targets.entities].map((e) => e.getValue(WordTarget, 'wordId') as string).filter(Boolean))]
        .filter((id) => this.cafeUnlocked || !cafeIds.has(id)); // locked Cafe words are not questable yet
      const allIds = present.length ? present : [...ROOM_WORDS.map((w) => w.id), ...KITCHEN_PROPS.map((w) => w.id)];
      const deck = buildDeck(this.cards, allIds, Date.now());
      this.quest = deck[0] ?? null;
      if (this.quest && (announce || !this.persisted?.onboardingDone)) {
        const e = wordById(this.quest.wordId);
        if (e) this.caption(this.quest.kind === 'review' ? `Again: wake the ${e.word}` : `Wake the ${e.word}`);
      }
      if (!this.quest && announce) this.caption('Your room is awake!');
    } catch { this.quest = null; }
  }

  private startRushNow(): void {
    try {
      const best = this.persisted?.rushBest ?? 0;
      this.rush = startRush(newRush(best));
      this.rushLastCaptionSec = -1;
      this.caption('Hush Rush! Wake words fast!');
      playSfx('whoosh');
    } catch { /* rush optional */ }
  }

  /** Voice wake: first use = in-world consent (press mic again), then 3s clip.
   * Target = current deck quest word (due first). Any failure -> ray-pinch caption. */
  private async handleMic(): Promise<void> {
    if (this.voiceBusy) return;
    try {
      const state = load(localStorage);
      if (!state.voiceConsent && !this.consentPending) {
        this.consentPending = true;
        this.caption('Voice? Press mic again to allow. Voice is transcribed, never saved.');
        return;
      }
      if (!state.voiceConsent && this.consentPending) {
        state.voiceConsent = true; save(localStorage, state); this.persisted = state; this.consentPending = false;
        this.caption('Voice on. Say the word!');
      }
      const targetId = this.quest?.wordId ?? 'table';
      const entry = wordById(targetId);
      if (!entry) { this.caption('Poke a word first'); return; }
      this.voiceBusy = true;
      this.caption(`Say: ${entry.word}`);
      const outcome = await voiceWake({ targetWord: entry.word, targetIpa: entry.ipa, recorder: browserRecorder() });
      if (outcome.result === 'exact') {
        this.caption(`Yes! ${entry.word}`);
        this.wakeById(entry.id);
      } else if (outcome.result === 'almost') {
        this.caption(outcome.hint);
      } else if (outcome.result === 'wrong') {
        this.caption(`I heard "${outcome.heard}". Try: ${entry.word}`);
      } else {
        this.caption('Voice unavailable - use ray-pinch on the word');
      }
    } catch { this.caption('Voice unavailable - use ray-pinch on the word'); }
    finally { this.voiceBusy = false; }
  }

  /** Wake a target by id (voice / gaze-pinch path): same grading guard as poke.
   * Already-awake, not-due words never re-grade (no SRS/rush farming). */
  private wakeById(id: string): void {
    for (const entity of this.queries.targets.entities) {
      if ((entity.getValue(WordTarget, 'wordId') ?? '') !== id) continue;
      const state = entity.getValue(WordTarget, 'state');
      const card = this.cards.get(id);
      const reviewable = state === 'awake' && card && card.dueAt <= Date.now();
      if (state !== 'sleeping' && !reviewable) continue;
      entity.setValue(WordTarget, 'state', 'awake');
      entity.setValue(WordTarget, 'bloom', 1);
      const prev = this.cards.get(id) ?? newCard(id, Date.now());
      this.cards.set(id, gradeCard(prev, 4, Date.now()));
      this.persistProgress(); playSfx('wake');
      if (this.rush?.phase === 'running') this.rush = hitRush(this.rush, true);
      if (this.quest?.wordId === id) this.refreshQuest(true);
    }
  }

  /** Persist cards + awake ids + table-relative positions; failure never crashes. */
  private persistProgress(): void {
    try {
      if (!this.persisted) this.persisted = load(localStorage);
      this.persisted.cards = [...this.cards.values()];
      this.persisted.awake = [...this.cards.keys()];
      save(localStorage, this.persisted);
    } catch { /* storage unavailable: session continues unpersisted */ }
  }

  private restoreAwake(entity: { getValue: Function; setValue: Function }): void {
    const id = entity.getValue(WordTarget, 'wordId') as string;
    if (this.persisted?.awake.includes(id)) entity.setValue(WordTarget, 'state', 'awake');
  }

  /** No scene data / emulator: virtual tabletop at lap height with props. */
  private buildFallbackDiorama(): void {
    const tableMaterial = new MeshStandardMaterial({ color: HUSH.clone() });
    const table = new Mesh(new BoxGeometry(1.1, 0.05, 0.7), tableMaterial);
    table.position.set(0, 0.74, -1.15);
    const tableEntity = this.world.createTransformEntity(table);
    this.tableObject = table;
    tableEntity.addComponent(WordTarget);
    tableEntity.setValue(WordTarget, 'wordId', 'table');
    this.restoreAwake(tableEntity);
    tableEntity.addComponent(RayInteractable);
    this.dioramaParts.push({ object: table, offsetX: 0, isTable: true });

    const geometries = [
      new CylinderGeometry(0.035, 0.03, 0.09, 20), // cup
      new CylinderGeometry(0.07, 0.05, 0.02, 24), // plate
      new SphereGeometry(0.04, 20, 16), // apple
      new BoxGeometry(0.09, 0.16, 0.09), // chair (stylized block)
      new BoxGeometry(0.11, 0.03, 0.08), // book
    ];
    KITCHEN_PROPS.forEach((entry, index) => {
      const material = new MeshStandardMaterial({ color: HUSH.clone() });
      const prop = new Mesh(geometries[index % geometries.length], material);
      prop.position.set(-0.4 + index * 0.2, 0.82, -1.15);
      const entity = this.world.createTransformEntity(prop);
      entity.addComponent(WordTarget);
      entity.setValue(WordTarget, 'wordId', entry.id);
      this.restoreAwake(entity);
      entity.addComponent(RayInteractable);
      if (entry.id === 'cup') entity.addComponent(OneHandGrabbable); // placement quests: grab, place, settle-grade
      this.dioramaParts.push({ object: prop, offsetX: -0.4 + index * 0.2 });
    });
    this.buildSpellTiles(table.position);
    this.buildCafeProps(table.position);
    this.buildEcho(table.position);
    this.buildMural();
    // Mic orb near table front edge: press to start voice wake (consent first use).
    try {
      const orb = new Mesh(new SphereGeometry(0.035, 20, 16), new MeshStandardMaterial({ color: 0x7c9eff, emissive: 0x3355aa }));
      orb.position.set(table.position.x + 0.45, table.position.y + 0.09, table.position.z + 0.22);
      const orbEntity = this.world.createTransformEntity(orb);
      orbEntity.addComponent(MicOrb);
      orbEntity.addComponent(RayInteractable);
      this.dioramaParts.push({ object: orb, offsetX: 0.45 });
    } catch { /* voice optional; ray-pinch remains */ }
  }

  /** Cafe district props: hidden until Kitchen >=80% awake unlocks them
   * (progression.unlockedDistricts). Shown on the table back row. */
  private buildCafeProps(tablePos: { x: number; y: number; z: number }): void {
    try {
      this.cafeUnlocked = unlockedDistricts(new Set(this.persisted?.awake ?? [])).includes('cafe');
      const geos = [new SphereGeometry(0.032, 16, 12), new BoxGeometry(0.07, 0.05, 0.07), new CylinderGeometry(0.03, 0.03, 0.07, 16)];
      CAFE_PROPS.forEach((entry, index) => {
        try {
          const prop = new Mesh(geos[index % geos.length], new MeshStandardMaterial({ color: HUSH.clone() }));
          const offsetX = -0.5 + index * 0.09;
          prop.position.set(tablePos.x + offsetX, this.cafeUnlocked ? tablePos.y + 0.08 : -5, tablePos.z - 0.18);
          prop.visible = this.cafeUnlocked;
          const entity = this.world.createTransformEntity(prop);
          entity.addComponent(WordTarget);
          entity.setValue(WordTarget, 'wordId', entry.id);
          this.restoreAwake(entity);
          entity.addComponent(RayInteractable);
          this.cafeRecs.push({ object: prop, offsetX });
          this.dioramaParts.push({ object: prop, offsetX, isCafe: true });
        } catch { /* one prop fails: rest of Cafe still builds */ }
      });
    } catch { /* Cafe optional; Kitchen loop intact */ }
  }

  /** Echo body: small glowing orb perched on the table corner. Form 1-3 grows
   * with Atlas awake count (progression.echoForm). No AI needed for the body. */
  private buildEcho(tablePos: { x: number; y: number; z: number }): void {
    try {
      const orb = new Mesh(new SphereGeometry(1, 20, 16), new MeshStandardMaterial({ color: 0x7c9eff, emissive: 0x3355aa }));
      orb.scale.setScalar(0.032);
      orb.position.set(tablePos.x + 0.52, tablePos.y + 0.12, tablePos.z - 0.2);
      this.world.createTransformEntity(orb);
      this.echoMesh = orb;
      this.dioramaParts.push({ object: orb, offsetX: 0.52 });
    } catch { /* Echo body optional */ }
  }

  /** Fluency Mural: canvas plane. Fallback wall in front; moves to the real
   * wall when scene mesh claims it, filling as words wake (muralPercent). */
  private buildMural(): void {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 288;
      const ctx = canvas.getContext('2d');
      const tex = new CanvasTexture(canvas);
      this.muralRedraw = (awakeCount, total, pct) => {
        if (!ctx) return;
        ctx.fillStyle = '#3a4550'; ctx.fillRect(0, 0, 512, 288);
        const cols = 10, cell = 44, x0 = 36, y0 = 30;
        for (let i = 0; i < total; i++) {
          ctx.fillStyle = i < awakeCount ? '#57c98a' : '#7a8794';
          ctx.fillRect(x0 + (i % cols) * cell, y0 + Math.floor(i / cols) * cell, cell - 6, cell - 6);
        }
        ctx.fillStyle = '#fff4e0'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`Room ${pct}% awake`, 256, 248);
        tex.needsUpdate = true;
      };
      const plane = new Mesh(new BoxGeometry(0.95, 0.53, 0.02), new MeshStandardMaterial({ map: tex }));
      plane.position.set(0, 1.55, -2.35);
      this.world.createTransformEntity(plane);
      this.mural = plane;
      this.muralRedraw(0, 29, 0);
    } catch { /* mural optional */ }
  }

  private checkCafeUnlock(): void {
    if (this.cafeUnlocked || !this.cafeRecs.length) return;
    if (!unlockedDistricts(new Set(this.cards.keys())).includes('cafe')) return;
    this.cafeUnlocked = true;
    const ty = (this.tableObject?.position.y ?? 0.74) + 0.08;
    for (const rec of this.cafeRecs) { rec.object.visible = true; rec.object.position.y = ty; }
    this.caption('The Cafe is open! New words on the table');
    playSfx('whoosh');
    this.refreshQuest(false);
  }

  private updateEchoForm(): void {
    if (!this.echoMesh) return;
    const form = echoForm(this.cards.size);
    if (form === this.echoLevel) return;
    const grew = this.echoLevel > 0 && form > this.echoLevel;
    this.echoLevel = form;
    this.echoMesh.scale.setScalar([0.032, 0.045, 0.06][form - 1]);
    const mat = this.echoMesh.material as MeshStandardMaterial;
    mat.color.setHex([0x7c9eff, 0x57c98a, 0xffb43a][form - 1]);
    mat.emissive.setHex([0x3355aa, 0x1d6b41, 0x8a5a00][form - 1]);
    if (grew) { this.caption('Echo grew!'); playSfx('whoosh'); }
  }

  private updateMural(): void {
    if (!this.mural || !this.muralRedraw) return;
    const awake = new Set(this.cards.keys());
    const pct = muralPercent(awake);
    if (pct === this.lastMuralPct) return;
    this.lastMuralPct = pct;
    const total = 12 + 5 + CAFE_PROPS.length;
    this.muralRedraw(awake.size, total, pct);
    if (this.muralOnWall) {
      try {
        const head = this.player.head; head.updateWorldMatrix(true, false);
        this.mural.lookAt(head.matrixWorld.elements[12], this.mural.position.y, head.matrixWorld.elements[14]);
      } catch { /* keep last facing */ }
    }
  }

  /** Anchor drift: saved table-relative spot disagrees with fresh scene mesh
   * by >0.35m: room changed, labels re-place from mesh (never float wrong). */
  private checkDrift(id: string, pos: { x: number; y: number; z: number }): void {
    if (this.driftNoted || !this.tableOrigin || !this.persisted) return;
    const rel = this.persisted.tableRelative[id];
    if (!rel) return;
    const exp = fromTableRelative(rel, this.tableOrigin);
    if (Math.hypot(exp.x - pos.x, exp.y - pos.y, exp.z - pos.z) > 0.35) {
      this.driftNoted = true;
      this.caption('Room changed - labels re-placed');
    }
  }

  /** Sentence Spell tiles: colored boxes, word drawn on top face (canvas).
   * Grab -> release near next slot -> trySnap; reject repels home. Poke a
   * snapped tile with a complete spell to cast it at the named target. */
  private buildSpellTiles(tablePos: { x: number; y: number; z: number }): void {
    const tiles = buildTiles();
    tiles.forEach((tile, index) => {
      try {
        const color = TILE_COLORS[tile.kind];
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 160;
        const ctx = canvas.getContext('2d');
        const tex = new CanvasTexture(canvas);
        const redraw = (text: string) => {
          if (!ctx) return;
          ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
          ctx.fillRect(0, 0, 256, 160);
          ctx.fillStyle = '#2d2438';
          ctx.font = 'bold 56px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(text, 128, 84, 236);
          tex.needsUpdate = true;
        };
        redraw(tile.text);
        const side = new MeshStandardMaterial({ color });
        const top = new MeshStandardMaterial({ map: tex });
        const object = new Mesh(new BoxGeometry(0.105, 0.02, 0.07), [side, side, top, side, side, side]);
        const home = homeOffset(index, tiles.length);
        object.position.set(tablePos.x + home.x, tablePos.y + home.y, tablePos.z + home.z);
        const entity = this.world.createTransformEntity(object);
        entity.addComponent(SpellTile);
        entity.setValue(SpellTile, 'entryId', tile.entryId);
        entity.setValue(SpellTile, 'kind', tile.kind);
        entity.addComponent(RayInteractable);
        entity.addComponent(OneHandGrabbable);
        this.tileRecs.push({ tile, object, entity: entity as never, home: { ...object.position }, redraw, returning: false, snapSeq: -1 });
        this.dioramaParts.push({ object, offsetX: home.x, isTile: true });
      } catch (error) { console.warn('[Word] spell tile failed', tile.entryId, error); }
    });
  }

  private caption(text: string): void {
    try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: text })); } catch { /* no DOM */ }
  }

  private slotWorld(index: number, spellLength: number): { x: number; y: number; z: number } {
    const t = this.tableObject?.position ?? { x: 0, y: 0.74, z: -1.15 };
    const o = slotOffset(index, spellLength);
    return { x: t.x + o.x, y: t.y + o.y, z: t.z + o.z };
  }

  private relayoutSpell(): void {
    const snapped = orderBySnap(this.tileRecs);
    snapped.forEach((r, i) => { const p = this.slotWorld(i, snapped.length); r.object.position.set(p.x, p.y, p.z); });
  }

  /** Cast completed spell: wake named target, tiles fly home, spell resets. */
  private castSpell(): void {
    const effect = spellEffect(this.spell);
    if (!effect || !isComplete(this.spell)) return;
    const sentence = castSentence(spellText(this.spell));
    playSfx('wake');
    for (const entity of this.queries.targets.entities) {
      if ((entity.getValue(WordTarget, 'wordId') ?? '') !== effect.objectId) continue;
      entity.setValue(WordTarget, 'state', 'awake');
      entity.setValue(WordTarget, 'bloom', 1);
      const prev = this.cards.get(effect.objectId) ?? newCard(effect.objectId, Date.now());
      this.cards.set(effect.objectId, gradeCard(prev, 4, Date.now()));
      this.persistProgress();
    }
    let advanced = false;
    if (!this.persisted?.onboardingDone && this.onbStep === 'first-spell') {
      const before = this.onbStep;
      this.onbStep = nextOnboarding(this.onbStep, spellText(this.spell) === 'open the door' ? 'spell:open-door' : 'spell:cast');
      advanced = this.onbStep !== before;
      if (this.onbStep === 'done' && this.persisted) { this.persisted.onboardingDone = true; this.persistProgress(); }
    }
    // One caption only: cast line, plus next-step hint when onboarding advances.
    this.caption(advanced && this.onbStep !== 'done' ? `${sentence} Next: ${onboardingCaption(this.onbStep)}` : sentence);
    for (const r of this.tileRecs) {
      if (!r.entity.getValue(SpellTile, 'snapped')) continue;
      r.snapSeq = -1;
      r.entity.setValue(SpellTile, 'snapped', false);
      r.entity.addComponent(OneHandGrabbable);
      r.returning = true;
      if (r.tile.form === 'plural') { const fresh = buildTiles().find((t) => t.entryId === r.tile.entryId); if (fresh) { r.tile = fresh; r.redraw(fresh.text); } }
    }
    this.spell = emptySpell();
  }

  /** Real room: one target per known semantic label, marker at mesh center. */
  private claimSceneMesh(entity: { getValue: Function; object3D?: { position: { x: number; y: number; z: number } } | null }): void {
    const label = entity.getValue(XRMesh, 'semanticLabel') as string;
    const entry = label ? wordForSceneLabel(label) : undefined;
    if (!entry || this.claimedLabels.has(entry.id)) return; // skip unknown, dedupe
    this.claimedLabels.add(entry.id);

    const origin = entity.object3D?.position ?? { x: 0, y: 1.2, z: -1.5 };

    // Table found: move the fallback diorama onto the real table, once.
    if (entry.id === 'table' && !this.dioramaOnRealTable) {
      this.tableOrigin = { ...origin };
      this.dioramaOnRealTable = true;
      for (const part of this.dioramaParts) {
        part.object.position.set(
          origin.x + part.offsetX,
          part.isTable ? origin.y + 0.03 : origin.y + 0.11,
          origin.z + (part.isTile ? 0.26 : part.isCafe ? -0.18 : 0), // tiles keep front-edge tray row, clear of spell slots
        );
      }
      // Backfill table-relative anchors for targets claimed before the table.
      if (this.persisted) {
        for (const [fid, fpos] of this.farTargets) {
          if (!this.persisted.tableRelative[fid]) this.persisted.tableRelative[fid] = toTableRelative(fpos, this.tableOrigin);
          this.checkDrift(fid, fpos);
        }
        this.persistProgress();
      }
      console.info('[Word] diorama moved onto real table');
      for (const r of this.tileRecs) r.home = { ...r.object.position };
    }

    const material = new MeshStandardMaterial({ color: HUSH.clone(), emissive: HUSH.clone().multiplyScalar(0.25) });
    const marker = new Mesh(new SphereGeometry(0.05, 20, 16), material);
    marker.position.set(origin.x, origin.y + 0.3, origin.z);
    const target = this.world.createTransformEntity(marker);
    target.addComponent(WordTarget);
    target.setValue(WordTarget, 'wordId', entry.id);
    this.restoreAwake(target);
    target.addComponent(RayInteractable);
    this.farTargets.set(entry.id, { x: origin.x, y: origin.y + 0.3, z: origin.z });
    this.checkDrift(entry.id, { x: origin.x, y: origin.y + 0.3, z: origin.z });
    if (entry.id === 'wall' && this.mural) { // Fluency Mural pins to real wall
      this.muralOnWall = true;
      this.mural.position.set(origin.x, Math.max(1.25, origin.y), origin.z);
    }
    if (this.persisted && this.tableOrigin) {
      this.persisted.tableRelative[entry.id] = toTableRelative(
        { x: origin.x, y: origin.y + 0.3, z: origin.z }, this.tableOrigin);
      this.persistProgress();
    }
    console.info(`[Word] room target claimed: ${label} -> ${entry.word}`);
    this.refreshQuest(false);
  }

  update(delta: number): void {
    // Hand-presence producer (verified API: input.xr.getPrimaryInputSource, .hand = hand-tracked).
    try {
      const xr = (this.world as unknown as { input?: { xr?: { getPrimaryInputSource(s: 'left' | 'right'): { hand?: unknown } | undefined } } }).input?.xr;
      const present = sourceIsHand(xr?.getPrimaryInputSource('left')) || sourceIsHand(xr?.getPrimaryInputSource('right'));
      const ev = this.handTracker.update(present, this.immersive, performance.now());
      if (ev === 'lost') { this.gate.add('hands-lost'); this.persistProgress(); try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: 'Show your hands' })); } catch { /* no DOM */ } }
      if (ev === 'back') this.gate.remove('hands-lost');
    } catch { /* input unavailable: visibility/blur pause still active */ }
    // Hush Rush frozen by PauseGate: sync pause/resume, never tick while paused.
    if (this.rush) {
      if (this.gate.paused && this.rush.phase === 'running') { this.rush = pauseRush(this.rush); this.rushWasPaused = true; }
      else if (!this.gate.paused && this.rush.phase === 'paused' && this.rushWasPaused) { this.rush = resumeRush(this.rush); this.rushWasPaused = false; }
    }
    if (this.gate.paused) return; // all timers frozen: Hush Rush, fade, bloom, onboarding
    this.checkCafeUnlock();
    this.updateEchoForm();
    this.updateMural();
    if (!this.questAnnounced) { this.questAnnounced = true; if (this.quest) { const e = wordById(this.quest.wordId); if (e) this.caption(`Wake the ${e.word}`); } }
    // Hush Rush tick + in-world timer/score caption (sticky while running).
    if (this.rush?.phase === 'running') {
      this.rush = tickRush(this.rush, delta * 1000);
      const sec = Math.ceil(this.rush.leftMs / 1000);
      if (sec !== this.rushLastCaptionSec) {
        this.rushLastCaptionSec = sec;
        const questWord = this.quest ? wordById(this.quest.wordId)?.word ?? '' : '';
        try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: { text: `Hush Rush ${sec}s · Score ${this.rush.score} · x${Math.max(1, this.rush.combo)}`, sub: questWord ? `Wake the ${questWord}` : '', sticky: true } })); } catch { /* no panel */ }
      }
      if (this.rush.phase === 'done') {
        try { if (this.persisted) { this.persisted.rushBest = this.rush.best; this.persistProgress(); } } catch { /* ignore */ }
        this.caption(`Time! Score ${this.rush.score} · Best ${this.rush.best}`);
        playSfx('wake');
      }
    }
    // Aim assist + head-gaze pinch for far real-room targets (within 15 deg).
    try {
      if (this.farTargets.size) {
        const head = this.player.head; head.updateWorldMatrix(true, false);
        const hp = { x: head.matrixWorld.elements[12], y: head.matrixWorld.elements[13], z: head.matrixWorld.elements[14] };
        const e = head.matrixWorld.elements;
        const fwd = { x: -e[8], y: -e[9], z: -e[10] };
        const targets = [...this.farTargets.entries()].map(([id, position]) => ({ id, position }));
        const assisted = aimAssist(hp, fwd, targets, 15);
        this.gazeId = assisted?.id ?? null;
        if (assisted) {
          for (const entity of this.queries.targets.entities) {
            if ((entity.getValue(WordTarget, 'wordId') ?? '') === assisted.id && entity.getValue(WordTarget, 'state') !== 'awake') entity.setValue(WordTarget, 'bloom', Math.max(entity.getValue(WordTarget, 'bloom') ?? 0, 0.35));
          }
        }
        const pads = (this as unknown as { input?: { xr?: { gamepads?: { left?: { getButtonDown(b: unknown): boolean }; right?: { getButtonDown(b: unknown): boolean } } } } }).input?.xr?.gamepads;
        const down = !!(pads?.left?.getButtonDown(InputComponent.Trigger) || pads?.right?.getButtonDown(InputComponent.Trigger));
        if (down && !this.prevTrigger && this.gazeId) { const id = this.gazeId; const e2 = wordById(id); if (e2) speak(e2, this.helperLangNow(), this.immersionNow()); this.wakeById(id); }
        this.prevTrigger = down;
      }
    } catch { /* gaze optional; ray-pinch remains */ }
    // Placement grading: released prop, settled SETTLE_MS without moving -> check vs real table.
    if (this.pendingPlace && this.tableObject) {
      const p = this.pendingPlace; const o = p.object;
      const moved = Math.hypot(o.position.x - p.lastX, o.position.y - p.lastY, o.position.z - p.lastZ);
      if (moved > 0.002) { p.releasedAt = performance.now(); p.lastX = o.position.x; p.lastY = o.position.y; p.lastZ = o.position.z; }
      else if (performance.now() - p.releasedAt >= SETTLE_MS) {
        this.pendingPlace = null;
        try {
          const t = this.tableObject.position;
          const cam = (this.world as unknown as { camera?: { position?: { x: number; y: number; z: number } } }).camera?.position;
          const frame = makeTableFrame({ x: t.x, y: t.y, z: t.z }, cam ?? { x: t.x, y: 1.6, z: t.z + 1.15 });
          const subject: BoxLike = { center: { x: o.position.x, y: o.position.y, z: o.position.z }, size: { x: 0.07, y: 0.09, z: 0.07 } };
          const tableBox: BoxLike = { center: { x: t.x, y: t.y, z: t.z }, size: { x: 1.1, y: 0.05, z: 0.7 } };
          const prep = PREP_CYCLE[this.prepIndex];
          const r = checkPreposition(prep, subject, tableBox, frame, { stillMs: SETTLE_MS, targetName: 'the table' });
          if (r.result === 'correct') {
            this.wakeById(p.wordId);
            this.prepIndex = (this.prepIndex + 1) % PREP_CYCLE.length;
            const next = PREP_CYCLE[this.prepIndex];
            try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: `${r.hint} Next: put the cup ${PREP_READABLE[next]} the table` })); } catch { /* no DOM */ }
          } else {
            try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: r.hint })); } catch { /* no DOM */ }
          }
          playSfx(r.result === 'correct' ? 'snap' : r.result === 'almost' ? 'click' : 'boing');
          if (r.result === 'correct' && !this.persisted?.onboardingDone) {
            this.onbStep = nextOnboarding(this.onbStep, 'place:cup-on-table');
            if (this.onbStep === 'done' && this.persisted) { this.persisted.onboardingDone = true; this.persistProgress(); }
          }
        } catch (error) { console.warn('[Word] placement check failed', error); }
      }
    }
    this.elapsed += delta;
    // Perf sample every 2s (dev log; budget enforced in docs/QA.md device pass).
    this.perfFrames += 1;
    const nowMs = performance.now();
    if (!this.perfLast) this.perfLast = nowMs;
    if (nowMs - this.perfLast >= 2000) {
      const fps = Math.round((this.perfFrames * 1000) / (nowMs - this.perfLast));
      const tris = this.queries.targets.entities.size * 800; // low-poly props, upper bound per mesh
      const report = assessPerf({ fps, drawCalls: this.queries.targets.entities.size + 2 + this.tileRecs.length * 6, triangles: tris });
      try { globalThis.dispatchEvent(new CustomEvent('word:perf', { detail: { fps, drawCalls: this.queries.targets.entities.size + 2 + this.tileRecs.length * 6, triangles: tris } })); } catch { /* dev panel optional */ }
      if (!report.ok) console.warn('[Word perf]', report.issues.join('; '));
      this.perfFrames = 0; this.perfLast = nowMs;
    }
    // Tiles: fly home when returning; pinch-stretch plural while held.
    for (const r of this.tileRecs) {
      if (!r.returning) continue;
      const p = r.object.position;
      p.x += (r.home.x - p.x) * Math.min(1, delta * 10);
      p.y += (r.home.y - p.y) * Math.min(1, delta * 10);
      p.z += (r.home.z - p.z) * Math.min(1, delta * 10);
      if (Math.hypot(r.home.x - p.x, r.home.y - p.y, r.home.z - p.z) < 0.005) r.returning = false;
    }
    try {
      const grips = (this as unknown as { player?: { gripSpaces?: { left?: { position: { x: number; y: number; z: number } }; right?: { position: { x: number; y: number; z: number } } } } }).player?.gripSpaces;
      if (grips?.left && grips?.right) {
        const handDist = Math.hypot(grips.left.position.x - grips.right.position.x, grips.left.position.y - grips.right.position.y, grips.left.position.z - grips.right.position.z);
        for (const entity of this.queries.grabbedTiles.entities) {
          const rec = this.tileRecs.find((r) => (r.entity as unknown) === entity);
          if (!rec || rec.tile.kind !== 'noun') continue;
          if (this.stretchStart === null) { if (stretchArmed(handDist)) this.stretchStart = handDist; continue; }
          if (handDist > this.stretchStart * STRETCH_RATIO) {
            const s = stretchTile(rec.tile);
            if (s.ok) { rec.tile = s.tile; rec.redraw(s.tile.text); this.caption(`${s.tile.text}!`); playSfx('whoosh'); }
            this.stretchStart = handDist;
          }
        }
      }
    } catch { /* stretch optional */ }
    for (const entity of this.queries.targets.entities) {
      const object = entity.object3D as Mesh | null;
      if (!object || !(object.material instanceof MeshStandardMaterial)) continue;
      const material = object.material;
      const awake = entity.getValue(WordTarget, 'state') === 'awake';
      let bloom = entity.getValue(WordTarget, 'bloom') ?? 0;
      if (bloom > 0) {
        bloom = Math.max(0, bloom - delta * 1.4);
        entity.setValue(WordTarget, 'bloom', bloom);
      }
      const pal = palette(this.a11y);
      const base = awake ? new Color(pal.awake) : new Color(pal.hush);
      if (awake) {
        // Fade-as-review: due cards desaturate awake objects back toward Hush.
        const card = this.cards.get(entity.getValue(WordTarget, 'wordId') ?? '');
        if (card) base.lerp(HUSH, fadeAmount(card, Date.now()));
      }
      material.color.copy(base).lerp(new Color(pal.wake), bloom);
      const pulse = this.a11y.reducedMotion ? 1 : awake ? 1 + bloom * 0.6 : 1 + Math.sin(this.elapsed * 2) * 0.04;
      object.scale.setScalar(pulse);
    }
  }
}
