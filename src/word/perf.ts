/** Performance budget assessment (PLAN: <100 draw calls, ~150k tris, >=60fps). Pure. */
export interface PerfSample { fps: number; drawCalls: number; triangles: number }
export interface PerfReport { ok: boolean; issues: string[] }
export const BUDGET = { minFps: 60, maxDrawCalls: 100, maxTriangles: 150_000 } as const;
export function assessPerf(s: PerfSample): PerfReport {
  const issues: string[] = [];
  if (s.fps < BUDGET.minFps) issues.push(`fps ${s.fps} < ${BUDGET.minFps}`);
  if (s.drawCalls >= BUDGET.maxDrawCalls) issues.push(`draw calls ${s.drawCalls} >= ${BUDGET.maxDrawCalls}`);
  if (s.triangles > BUDGET.maxTriangles) issues.push(`triangles ${s.triangles} > ${BUDGET.maxTriangles}`);
  return { ok: issues.length === 0, issues };
}
