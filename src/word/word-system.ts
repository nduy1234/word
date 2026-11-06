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
  Color,
  createSystem,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  Pressed,
  RayInteractable,
  SphereGeometry,
  VisibilityState,
  XRMesh,
} from '@iwsdk/core';
import { WordTarget } from './word-component.js';
import { KITCHEN_PROPS, wordById, wordForSceneLabel, type WordEntry } from './pack.js';
import { fadeAmount, gradeCard, newCard, type CardState } from './scheduler.js';
import { load, save, toTableRelative, type SaveState } from './store.js';

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
  sceneMeshes: { required: [XRMesh] },
}) {
  private claimedLabels = new Set<string>();
  private paused = false;
  private cards = new Map<string, CardState>();
  private persisted: SaveState | null = null;
  private tableOrigin: { x: number; y: number; z: number } | null = null;
  private elapsed = 0;
  private dioramaParts: { object: Mesh; offsetX: number }[] = [];
  private dioramaOnRealTable = false;

  init(): void {
    try {
      this.persisted = load(localStorage);
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
          console.info(`[Word] woke ${entry.word} (${entry.ipa})`);
        }
      } catch (error) {
        console.error('[Word] press handling failed', error);
      }
    });

    this.queries.sceneMeshes.subscribe('qualify', (entity) => {
      try {
        this.claimSceneMesh(entity);
      } catch (error) {
        console.error('[Word] scene mesh claim failed', error);
      }
    });

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        this.paused = state !== VisibilityState.Visible && state !== VisibilityState.NonImmersive;
        if (this.paused) {
          try {
            globalThis.speechSynthesis?.cancel();
          } catch {
            /* captions only */
          }
        }
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
    tableEntity.addComponent(WordTarget);
    tableEntity.setValue(WordTarget, 'wordId', 'table');
    this.restoreAwake(tableEntity);
    tableEntity.addComponent(RayInteractable);
    this.dioramaParts.push({ object: table, offsetX: 0 });

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
      this.dioramaParts.push({ object: prop, offsetX: -0.4 + index * 0.2 });
    });
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
        const isTableTop = part.offsetX === 0 && part.object.geometry.type === 'BoxGeometry';
        part.object.position.set(
          origin.x + part.offsetX,
          isTableTop ? origin.y + 0.03 : origin.y + 0.11,
          origin.z,
        );
      }
      console.info('[Word] diorama moved onto real table');
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
    if (this.paused) return;
    this.elapsed += delta;
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
      const base = awake ? AWAKE.clone() : HUSH.clone();
      if (awake) {
        // Fade-as-review: due cards desaturate awake objects back toward Hush.
        const card = this.cards.get(entity.getValue(WordTarget, 'wordId') ?? '');
        if (card) base.lerp(HUSH, fadeAmount(card, Date.now()));
      }
      material.color.copy(base).lerp(WAKE, bloom);
      const pulse = awake ? 1 + bloom * 0.6 : 1 + Math.sin(this.elapsed * 2) * 0.04;
      object.scale.setScalar(pulse);
    }
  }
}
