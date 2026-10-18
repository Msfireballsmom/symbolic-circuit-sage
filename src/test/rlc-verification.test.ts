import { describe, it, expect } from 'vitest';
import { solveRLC } from '@/lib/circuit-solver';
import { auditRLC } from '@/lib/rlc-verification';
const defaults = { topology: 'series' as const, excitation: 'step' as const, R: 200, L: 0.05, C: 0.0002, Vs: 10, vC0: 0, iL0: 0, tFinal: 0.05 };
describe('RLC false checkmark regression', () => {
  it('does not certify the live default endpoint of 0.05 s as infinity', () => {
    const result = solveRLC(defaults);
    expect(result.pointsVC[300].value).toBeLessThan(8);
    expect(result.verification.physicalOk).toBe(true);
    expect(result.verification.settled).toBe(false);
    expect(result.verification.ok).toBe(false);
  });
  it('only certifies the series steady-state endpoint after both residuals pass', () => {
    const result = solveRLC({ ...defaults, tFinal: 1 });
    expect(result.pointsVC[300].value).toBeCloseTo(10, 7);
    expect(result.pointsIL[300].value).toBeCloseTo(0, 7);
    expect(result.verification.ok).toBe(true);
  });
  it.each([NaN, Infinity, -1, 0])('rejects nonphysical resistance %s', R => {
    expect(() => solveRLC({ ...defaults, R })).toThrow(/unsupported or unverified/i);
  });
  it('rejects the ambiguous parallel voltage-step model', () => {
    expect(() => solveRLC({ ...defaults, topology: 'parallel' })).toThrow(/source connection is ambiguous/i);
  });
  it.each([0.01, NaN, Infinity])('disagreement %s can never receive Verified status', residual => {
    expect(auditRLC([{ name: 'DC KVL', residual, scale: 10, unit: 'V' }]).ok).toBe(false);
  });
  it('does not verify an empty audit', () => expect(auditRLC([]).ok).toBe(false));
});