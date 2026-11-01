// Item 3: solveDC()'s balanced/pass flags must come from the measured residuals.
import { describe, it, expect, vi } from 'vitest';
import { solveDC, type DCComponent } from '@/lib/circuit-solver';

const state = vi.hoisted(() => ({
  power: { delivered: 0.01, dissipated: 0.01, residual: 0 },
  kcl: 1e-15,
}));

vi.mock('@/lib/model-solver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/model-solver')>();
  return {
    ...actual,
    powerBalance: () => state.power,
    verifyKCL: () => state.kcl,
    solveQuestion: () => ({ steps: [], assumptions: [] }),
  };
});

const divider: DCComponent[] = [
  { type: 'voltage_source', value: 10, nodeA: 1, nodeB: 0 },
  { type: 'resistor', value: 3000, nodeA: 1, nodeB: 2 },
  { type: 'resistor', value: 7000, nodeA: 2, nodeB: 0 },
];

describe('DC verification flags are derived from residuals (item 3)', () => {
  it('passes only when the measured residuals pass', () => {
    state.power = { delivered: 0.01, dissipated: 0.01, residual: 0 };
    state.kcl = 1e-15;
    const r = solveDC(divider);
    expect(r.powerBalance.balanced).toBe(true);
    expect(r.residuals.every((x) => x.pass)).toBe(true);
  });

  it('reports balanced false and pass false when a residual is made large', () => {
    state.power = { delivered: 0.01, dissipated: 0.0099, residual: -1e-3 };
    state.kcl = 1e-3;
    const r = solveDC(divider);
    expect(r.powerBalance.balanced).toBe(false);
    expect(r.residuals.find((x) => x.type === 'Power')?.pass).toBe(false);
    expect(r.residuals.find((x) => x.type === 'KCL')?.pass).toBe(false);
  });
});