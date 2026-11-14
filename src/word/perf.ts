/** Performance budget assessment (PLAN: <100 draw calls, ~150k tris, >=60fps). Pure. */
export interface PerfSample { fps: number; drawCalls: number; triangles: number }
export interface PerfReport { ok: boolean; issues: string[] }
export const BUDGET = { minFps: 60, maxDrawCalls: 100, maxTriangles: 150_000 } as const;
export function assessPerf(s: PerfSample): PerfReport {
  const issues: string[] = [];
  if (!Number.isFinite(s.fps) || s.fps < BUDGET.minFps) issues.push(`fps ${s.fps} < ${BUDGET.minFps}`);
  if (!Number.isFinite(s.drawCalls) || s.drawCalls >= BUDGET.maxDrawCalls) issues.push(`draw calls ${s.drawCalls} >= ${BUDGET.maxDrawCalls}`);
  if (!Number.isFinite(s.triangles) || s.triangles > BUDGET.maxTriangles) issues.push(`triangles ${s.triangles} > ${BUDGET.maxTriangles}`);
  return { ok: issues.length === 0, issues };
}
