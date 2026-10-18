/** Physical residuals use fixed tolerances, never the plot's rounding precision. */
export const RLC_RESIDUAL_TOLERANCE = 1e-6;
export interface RLCCheck {
  name: string;
  residual: number;
  scale: number;
  unit: string;
}
export function auditRLC(checks: RLCCheck[]) {
  const results = checks.map(check => ({
    ...check,
    ok: Number.isFinite(check.residual) && Number.isFinite(check.scale) &&
      Math.abs(check.residual) <= RLC_RESIDUAL_TOLERANCE * Math.max(1e-12, Math.abs(check.scale)),
  }));
  return { ok: results.length > 0 && results.every(check => check.ok), checks: results };
}