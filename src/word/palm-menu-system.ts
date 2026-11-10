/** Palm-up menu: open palm facing head shows panel near hand; pinch (UIKit ray
 * click) selects. Settings persist via store.ts and broadcast 'word:settings'.
 * High contrast applies via palette() in WordSystem material update, not CSS.
 * Fallbacks: 'M' key (desktop/emulator QA) and 'word:palm-menu' event toggle. */
import { createSystem, UIKitMLAsset, Vector3 } from '@iwsdk/core';
import { load, save } from './store.js';
import { DEFAULT_A11Y, cycleCaption, type A11y } from './accessibility.js';
import { cycleHelper, detectHelper, type HelperLang } from './helper.js';
import { palmFacingHead, palmNormalFromQuat } from './palm.js';

interface PanelObj {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  visible: boolean;
  getElementById(id: string): El | null;
}
interface El { setProperties(p: Record<string, unknown>): void; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void }

const BTNS = ['menu-contrast', 'menu-caption', 'menu-motion', 'menu-helper', 'menu-immersion', 'menu-rush', 'menu-mic', 'menu-close'] as const;

export class PalmMenuSystem extends createSystem({}) {
  private panel: PanelObj | null = null;
  private els = new Map<string, El>();
  private a11y: A11y = DEFAULT_A11Y;
  private helper: HelperLang = 'none';
  private immersion = false;
  private shownAt = 0;
  private lastPalmAt = 0;
  private headPos = new Vector3();
  private handPos = new Vector3();
  private tmp = new Vector3();

  init(): void {
    try {
      this.panel = this.world.getSceneObject<UIKitMLAsset>('palm-panel') as unknown as PanelObj | null;
      if (this.panel) this.panel.visible = false;
      for (const id of BTNS) { const el = this.panel?.getElementById(id); if (el) this.els.set(id, el as El); }
      this.reload();
      this.renderLabels();
      const handlers: Record<string, () => void> = {
        'menu-contrast': () => { this.a11y = { ...this.a11y, highContrast: !this.a11y.highContrast }; this.persist(); },
        'menu-caption': () => { this.a11y = cycleCaption(this.a11y); this.persist(); },
        'menu-motion': () => { this.a11y = { ...this.a11y, reducedMotion: !this.a11y.reducedMotion }; this.persist(); },
        'menu-helper': () => { this.helper = cycleHelper(this.helper); this.persist(); },
        'menu-immersion': () => { this.immersion = !this.immersion; this.persist(); },
        'menu-rush': () => { try { globalThis.dispatchEvent(new CustomEvent('word:rush-start')); } catch { /* ignore */ } this.hide(); },
        'menu-mic': () => { try { globalThis.dispatchEvent(new CustomEvent('word:mic')); } catch { /* ignore */ } this.hide(); },
        'menu-close': () => this.hide(),
      };
      for (const [id, fn] of Object.entries(handlers)) {
        const el = this.els.get(id); if (!el) continue;
        el.addEventListener('click', fn);
        this.cleanupFuncs.push(() => el.removeEventListener('click', fn));
      }
      const onKey = (e: KeyboardEvent) => { if (e.key === 'm' || e.key === 'M') this.toggle(); };
      window.addEventListener('keydown', onKey);
      const onEvt = () => this.toggle();
      window.addEventListener('word:palm-menu', onEvt);
      const onSettings = () => { this.reload(); this.renderLabels(); };
      window.addEventListener('word:settings', onSettings);
      this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey), () => window.removeEventListener('word:palm-menu', onEvt), () => window.removeEventListener('word:settings', onSettings));
    } catch (e) { console.warn('[Word] palm menu disabled', e); this.panel = null; }
  }

  private reload(): void {
    try {
      const s = load(localStorage);
      if (s.a11y) this.a11y = { ...DEFAULT_A11Y, ...s.a11y, captionScale: (s.a11y.captionScale as A11y['captionScale']) || 1 };
      this.helper = s.helperLang === 'auto' || !s.helperLang ? detectHelper(navigator.language) : (s.helperLang as HelperLang);
      this.immersion = !!s.immersion;
    } catch { /* defaults */ }
  }
  private persist(): void {
    try { const s = load(localStorage); s.a11y = this.a11y; s.helperLang = this.helper; s.immersion = this.immersion; save(localStorage, s); } catch { /* ignore */ }
    try { globalThis.dispatchEvent(new CustomEvent('word:settings')); } catch { /* ignore */ }
    this.renderLabels();
  }
  private renderLabels(): void {
    const set = (id: string, text: string) => { try { this.panel?.getElementById(`${id}-label`)?.setProperties({ text }); } catch { /* ignore */ } };
    set('menu-contrast', `High contrast: ${this.a11y.highContrast ? 'on' : 'off'}`);
    set('menu-caption', `Caption size: ${this.a11y.captionScale === 1 ? 'normal' : this.a11y.captionScale === 1.25 ? 'large' : 'extra large'}`);
    set('menu-motion', `Reduced motion: ${this.a11y.reducedMotion ? 'on' : 'off'}`);
    set('menu-helper', `Helper: ${this.helper === 'es' ? 'Espanol' : this.helper === 'vi' ? 'Tieng Viet' : 'off'}`);
    set('menu-immersion', `Immersion: ${this.immersion ? 'on' : 'off'}`);
    try { this.panel?.getElementById('menu-status')?.setProperties({ text: `Helper ${this.helper} · Immersion ${this.immersion ? 'on' : 'off'} · Contrast ${this.a11y.highContrast ? 'on' : 'off'}` }); } catch { /* ignore */ }
  }
  private toggle(): void { if (this.panel?.visible) this.hide(); else this.showAt(this.headPos); }
  private hide(): void { if (this.panel) this.panel.visible = false; }
  private showAt(anchor: Vector3): void {
    if (!this.panel) return;
    this.panel.visible = true;
    this.shownAt = performance.now();
    // Place 0.55m in front of head, slightly below center, facing head.
    try {
      const head = this.player.head; head.updateWorldMatrix(true, false);
      this.headPos.setFromMatrixPosition(head.matrixWorld);
      const e = head.matrixWorld.elements;
      const fx = -e[8], fz = -e[10];
      const yaw = Math.atan2(-fx, -fz);
      this.panel.position.set(this.headPos.x + fx * 0.55, this.headPos.y - 0.12, this.headPos.z + fz * 0.55);
      this.panel.rotation.set(0, yaw, 0);
      void anchor;
    } catch { /* keep authored pos */ }
  }

  update(): void {
    if (!this.panel) return;
    try {
      const now = performance.now();
      if (this.panel.visible && now - this.shownAt > 20_000) { this.hide(); return; }
      // Palm detection via grip spaces (hand pose). Emulator/desktop: no grips -> M key fallback.
      const grips = (this.player as unknown as { gripSpaces?: { left?: { position: Vector3; quaternion: { x: number; y: number; z: number; w: number } }; right?: typeof undefined } }).gripSpaces;
      const head = this.player.head; head.updateWorldMatrix(true, false);
      this.headPos.setFromMatrixPosition(head.matrixWorld);
      let palmSeen = false;
      for (const side of ['left', 'right'] as const) {
        const g = (grips as Record<string, { position: Vector3; quaternion: { x: number; y: number; z: number; w: number } }> | undefined)?.[side];
        if (!g?.position || !g?.quaternion) continue;
        this.handPos.copy(g.position);
        // grip position is player-local in some rigs; if far from head in world, still relative check works locally.
        const normal = palmNormalFromQuat(g.quaternion);
        if (palmFacingHead(normal, this.handPos, this.headPos)) palmSeen = true;
      }
      if (palmSeen) {
        this.lastPalmAt = now;
        if (!this.panel.visible) this.showAt(this.handPos);
      } else if (this.panel.visible && now - this.lastPalmAt > 1500 && now - this.shownAt > 1500) {
        // Keep open briefly for pinch selection; hide after palm gone 1.5s and shown at least 1.5s.
        // Only auto-hide if shown by palm (shownAt recent track): use lastPalmAt set on show via key too.
        if (this.lastPalmAt > 0) this.hide();
      }
      void this.tmp;
    } catch { /* menu optional */ }
  }
}
