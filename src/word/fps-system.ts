/** Dev-only in-world perf panel: fps + draw calls + triangles (perf.ts budget).
 * Listens to 'word:perf' from WordSystem. Registered only in DEV (index.ts). */
import { createSystem, UIKitMLAsset, Vector3 } from '@iwsdk/core';
import { PANEL_DISTANCE_M } from './fov.js';
import { nextPanelYaw, panelPosition, panelRotationY, yawFromForward } from './panel-follow.js';
import { assessPerf, type PerfSample } from './perf.js';

interface PanelObj {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  visible: boolean;
  getElementById(id: string): { setProperties(p: Record<string, unknown>): void } | null;
}

export class FpsSystem extends createSystem({}) {
  private panel: PanelObj | null = null;
  private textEl: { setProperties(p: Record<string, unknown>): void } | null = null;
  private panelYaw: number | null = null;
  private headPos = new Vector3();
  private headFwd = new Vector3();
  private frames = 0;
  private lastSample = performance.now();
  private latest: PerfSample = { fps: 0, drawCalls: 0, triangles: 0 };

  init(): void {
    try {
      this.panel = this.world.getSceneObject<UIKitMLAsset>('dev-panel') as unknown as PanelObj | null;
      this.textEl = this.panel?.getElementById('dev-text') as never;
      if (this.panel) this.panel.visible = false;
      const onPerf = (ev: Event) => { this.latest = (ev as CustomEvent<PerfSample>).detail; };
      window.addEventListener('word:perf', onPerf);
      this.cleanupFuncs.push(() => window.removeEventListener('word:perf', onPerf));
    } catch { this.panel = null; }
  }

  update(): void {
    this.frames += 1;
    const now = performance.now();
    if (now - this.lastSample >= 500) {
      const fps = Math.round((this.frames * 1000) / (now - this.lastSample));
      this.frames = 0; this.lastSample = now;
      this.latest = { ...this.latest, fps };
      if (this.panel && this.textEl) {
        try {
          const r = assessPerf(this.latest);
          this.panel.visible = true;
          this.textEl.setProperties({
            text: `${fps} fps | ${this.latest.drawCalls} calls | ${Math.round(this.latest.triangles / 1000)}k tris${r.ok ? '' : ' OVER'}`,
            color: r.ok ? '#57c98a' : '#ff7a59',
          });
        } catch { /* dev only */ }
      }
      if (fps < 60) console.warn(`[Word perf] ${fps} fps — below 60 fps budget`);
    }
    if (!this.panel?.visible) return;
    try {
      const head = this.player.head;
      head.updateWorldMatrix(true, false);
      this.headPos.setFromMatrixPosition(head.matrixWorld);
      const e = head.matrixWorld.elements;
      this.headFwd.set(-e[8], -e[9], -e[10]).normalize();
      const headYaw = yawFromForward(this.headFwd);
      this.panelYaw = this.panelYaw === null ? headYaw : nextPanelYaw(this.panelYaw, headYaw);
      const pos = panelPosition(this.headPos, this.panelYaw, PANEL_DISTANCE_M, 0.22);
      this.panel.position.set(pos.x, pos.y, pos.z);
      this.panel.rotation.set(0, panelRotationY(this.panelYaw), 0);
    } catch { /* dev only */ }
  }
}
