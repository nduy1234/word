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
} from '@iwsdk/core';
import { SpellTile, WordTarget } from './word-component.js';
import { emptySpell, isComplete, spellEffect, spellText, stretchTile, trySnap, type Spell, type Tile } from './spell.js';
import { buildTiles, castSentence, homeOffset, orderBySnap, slotOffset, stretchArmed, TILE_COLORS, withinSnap, STRETCH_RATIO } from './spell-tiles.js';
import { KITCHEN_PROPS, wordById, wordForSceneLabel, type WordEntry } from './pack.js';
import { fadeAmount, gradeCard, newCard, type CardState } from './scheduler.js';
import { load, save, toTableRelative, type SaveState } from './store.js';
import { playSfx } from './sound.js';
import { PauseGate } from './pause.js';
import { DEFAULT_A11Y, palette, type A11y } from './accessibility.js';
import { assessPerf } from './perf.js';
import { nextOnboarding, onboardingCaption, type OnbStep } from './onboarding.js';
import { askEcho } from './echo.js';
import { HandLossTracker, sourceIsHand } from './hand-presence.js';
import { checkPreposition, makeTableFrame, SETTLE_MS, type BoxLike } from './preposition-check.js';

const HUSH = new Color(0x7a8794); // docs/art.md Hush fog
const WAKE = new Color(0xffb43a); // docs/art.md Wake warm
const AWAKE = new Color(0x57c98a); // docs/art.md Life green

function speak(entry: WordEntry): void {
  // Poke-to-hear: pre-generated clips ship later; chain per PLAN is
  // clip -> speechSynthesis -> captions only.
  const caption = `${entry.word} — ${entry.ipa}`;
  console.info(`[Word caption] ${caption}`);
  try {
    globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: caption }));
  } catch {
    /* caption DOM unavailable */
  }
  try {
    const synth = globalThis.speechSynthesis;
    if (synth) {
      const utterance = new SpeechSynthesisUtterance(entry.word);
      utterance.lang = 'en-US';
      synth.speak(utterance);
    }
  } catch (error) {
    console.warn('[Word] speechSynthesis unavailable, captions only', error);
  }
}

export class WordSystem extends createSystem({
  targets: { required: [WordTarget] },
  pressedTargets: { required: [WordTarget, Pressed] },
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
  private dioramaParts: { object: Mesh; offsetX: number; isTable?: boolean; isTile?: boolean }[] = [];
  private dioramaOnRealTable = false;

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
        speak(entry);
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
        }
      } catch (error) {
        console.error('[Word] press handling failed', error);
      }
    });

    this.queries.grabbedTargets.subscribe('qualify', (entity) => {
      const id = entity.getValue(WordTarget, 'wordId') ?? '';
      if (id) { this.grabbedIds.add(id); if (this.pendingPlace?.wordId === id) this.pendingPlace = null; }
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
      this.caption(entry ? `${rec.tile.text} — ${entry.ipa}` : rec.tile.text);
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
        this.caption(isComplete(this.spell) ? `${spellText(this.spell)} — poke a tile to cast!` : spellText(this.spell));
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
    this.caption(advanced && this.onbStep !== 'done' ? `✨ ${sentence} Next: ${onboardingCaption(this.onbStep)}` : `✨ ${sentence}`);
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
          origin.z + (part.isTile ? 0.26 : 0), // tiles keep front-edge tray row, clear of spell slots
        );
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
    if (this.persisted && this.tableOrigin) {
      this.persisted.tableRelative[entry.id] = toTableRelative(
        { x: origin.x, y: origin.y + 0.3, z: origin.z }, this.tableOrigin);
      this.persistProgress();
    }
    console.info(`[Word] room target claimed: ${label} -> ${entry.word}`);
  }

  update(delta: number): void {
    // Hand-presence producer (verified API: input.xr.getPrimaryInputSource, .hand = hand-tracked).
    try {
      const xr = (this.world as unknown as { input?: { xr?: { getPrimaryInputSource(s: 'left' | 'right'): { hand?: unknown } | undefined } } }).input?.xr;
      const present = sourceIsHand(xr?.getPrimaryInputSource('left')) || sourceIsHand(xr?.getPrimaryInputSource('right'));
      const ev = this.handTracker.update(present, this.immersive, performance.now());
      if (ev === 'lost') { this.gate.add('hands-lost'); this.persistProgress(); try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: 'Show your hands ✋' })); } catch { /* no DOM */ } }
      if (ev === 'back') this.gate.remove('hands-lost');
    } catch { /* input unavailable: visibility/blur pause still active */ }
    if (this.gate.paused) return; // all timers frozen: Hush Rush, fade, bloom, onboarding
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
          const r = checkPreposition('on', subject, tableBox, frame, { stillMs: SETTLE_MS, targetName: 'the table' });
          try { globalThis.dispatchEvent(new CustomEvent('word:caption', { detail: r.hint })); } catch { /* no DOM */ }
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
