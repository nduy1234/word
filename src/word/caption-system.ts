/** In-world caption panel: listens to 'word:caption', follows head in ±25° cone.
 * DOM #caption stays non-immersive only (index.ts). Error boundary: any failure
 * disables panel, DOM/console caption path still works. */
import { createSystem, UIKitMLAsset, Vector3 } from '@iwsdk/core';
import { PANEL_DISTANCE_M } from './fov.js';
import { nextPanelYaw, panelPosition, panelRotationY, yawFromForward } from './panel-follow.js';
import { captionPx, palette, DEFAULT_A11Y, type A11y } from './accessibility.js';
import { load } from './store.js';

interface PanelObj {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  visible: boolean;
  getElementById(id: string): { setProperties(p: Record<string, unknown>): void } | null;
}
type CaptionDetail = string | { text: string; sub?: string; sticky?: boolean };

export class CaptionSystem extends createSystem({}) {
  private panel: PanelObj | null = null;
  private textEl: { setProperties(p: Record<string, unknown>): void } | null = null;
  private subEl: { setProperties(p: Record<string, unknown>): void } | null = null;
  private boxEl: { setProperties(p: Record<string, unknown>): void } | null = null;
  private hideAt = 0;
  private sticky = false;
  private panelYaw: number | null = null;
  private a11y: A11y = DEFAULT_A11Y;
  private headPos = new Vector3();
  private headFwd = new Vector3();

  init(): void {
    try {
      const raw = this.world.getSceneObject<UIKitMLAsset>('caption-panel');
      this.panel = raw as unknown as PanelObj | null;
      this.textEl = this.panel?.getElementById('caption-text') as never;
      this.subEl = this.panel?.getElementById('caption-sub') as never;
      this.boxEl = this.panel?.getElementById('caption-box') as never;
      if (this.panel) this.panel.visible = false;
      const onCaption = (ev: Event) => this.show((ev as CustomEvent<CaptionDetail>).detail);
      window.addEventListener('word:caption', onCaption);
      const onSettings = () => { try { const s = load(localStorage); if (s.a11y) this.a11y = { ...DEFAULT_A11Y, ...s.a11y, captionScale: (s.a11y.captionScale as A11y['captionScale']) || 1 }; } catch { /* keep */ } };
      window.addEventListener('word:settings', onSettings);
      onSettings();
      this.cleanupFuncs.push(() => window.removeEventListener('word:caption', onCaption), () => window.removeEventListener('word:settings', onSettings));
    } catch (e) { console.warn('[Word] caption panel disabled', e); this.panel = null; }
  }

  private show(detail: CaptionDetail): void {
    if (!this.panel || !this.textEl) return;
    try {
      const text = typeof detail === 'string' ? detail : detail.text;
      const sub = typeof detail === 'string' ? '' : (detail.sub ?? '');
      this.sticky = typeof detail !== 'string' && !!detail.sticky;
      // Split "word - /ipa/ ..." into main + sub when sub not given, for readability.
      let main = text, rest = sub;
      if (!rest) { const m = text.match(/^(.+?) (?:—|-) (\/.*)$/); if (m) { main = m[1]; rest = m[2]; } }
      const pal = palette(this.a11y);
      this.textEl.setProperties({ text: main, fontSize: captionPx(this.a11y), color: this.a11y.highContrast ? pal.ink : undefined });
      this.subEl?.setProperties({ text: rest, display: rest ? 'flex' : 'none' });
      if (this.a11y.highContrast) this.boxEl?.setProperties({ backgroundColor: pal.bg });
      this.panel.visible = true;
      this.hideAt = performance.now() + (this.sticky ? 12_000 : 3500); // sticky = longer read (rush re-sends each second)
    } catch { /* panel optional */ }
  }

  update(): void {
    if (!this.panel) return;
    try {
      if (this.panel.visible && performance.now() > this.hideAt) { this.panel.visible = false; this.sticky = false; return; }
      if (!this.panel.visible) return;
      const head = this.player.head;
      head.updateWorldMatrix(true, false);
      this.headPos.setFromMatrixPosition(head.matrixWorld);
      const e = head.matrixWorld.elements;
      this.headFwd.set(-e[8], -e[9], -e[10]).normalize();
      const headYaw = yawFromForward(this.headFwd);
      this.panelYaw = this.panelYaw === null ? headYaw : nextPanelYaw(this.panelYaw, headYaw);
      const pos = panelPosition(this.headPos, this.panelYaw, PANEL_DISTANCE_M, -0.28);
      this.panel.position.set(pos.x, pos.y, pos.z);
      this.panel.rotation.set(0, panelRotationY(this.panelYaw), 0);
    } catch { /* follow optional */ }
  }
}
