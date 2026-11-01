import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { solveRLC } from '@/lib/circuit-solver';
import { defaultRLCInput, suggestRLCFinalTime } from '@/lib/rlc-settling';
import RLCTransientTab from '@/components/RLCTransientTab';

describe('RLC settling defaults and recovery', () => {
  it('uses the audited suggestion on the untouched tab and certifies its first solve', () => {
    const defaults = defaultRLCInput();
    expect(defaults).toMatchObject({ R: 200, L: 0.05, C: 0.0002, Vs: 10, excitation: 'step', vC0: 0, iL0: 0 });
    expect(defaults.tFinal).toBe(suggestRLCFinalTime(defaults));
    const solved = solveRLC(defaults);
    expect(solved.verification.ok).toBe(true);
    expect(solved.verification.endpoint.every(check => check.ok)).toBe(true);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => root.render(createElement(RLCTransientTab)));
      const field = container.querySelector<HTMLInputElement>('#rlc-final-time');
      expect(field?.value).toBe(String(defaults.tFinal));
      expect(field?.disabled).toBe(true);
      const solveButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Solve 2nd-Order RLC'));
      expect(solveButton).toBeDefined();
      act(() => solveButton?.click());
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Verified —');
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('returns a physical but unsettled waveform at the old 0.05 s endpoint without throwing', () => {
    const result = solveRLC({ ...defaultRLCInput(), tFinal: 0.05 });
    expect(result.verification).toMatchObject({ ok: false, physicalOk: true, settled: false });
    expect(result.pointsVC[300].value).toBeCloseTo(7.139424, 6);
    expect(result.verification.endpoint[0].residual).toBeCloseTo(-2.860576, 6);
  });

  it('still throws for genuinely nonphysical input, including during suggestion', () => {
    const input = { ...defaultRLCInput(), L: -0.05 };
    expect(() => solveRLC(input)).toThrow(/positive finite/);
    expect(() => suggestRLCFinalTime(input)).toThrow(/positive finite/);
  });

  it.each([
    { R: 10 },
    { R: 2 * Math.sqrt(0.05 / 0.0002) },
    { topology: 'parallel' as const, excitation: 'natural' as const, vC0: 5, iL0: 0.1 },
    { Vs: 20, vC0: -3, iL0: 0.2 },
  ])('audits suggested horizons across changed damping/topology/initial conditions: %j', changes => {
    const input = { ...defaultRLCInput(), ...changes };
    const tFinal = suggestRLCFinalTime(input);
    expect(Number.isFinite(tFinal)).toBe(true);
    expect(solveRLC({ ...input, tFinal }).verification.ok).toBe(true);
  });
});