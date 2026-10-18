import { describe, it, expect } from 'vitest';
import { parseQuantity } from '@/lib/quantity';
import { solveDC, solveAC, solveTransient } from '@/lib/circuit-solver';
import { buildCircuitModel } from '@/lib/parsed-to-model';
import { requireIndependentAgreement } from '@/lib/independent-dc';
import { solveQuestion } from '@/lib/model-solver';
import { ExtractionSchema } from '@/lib/extraction-schema';

describe('Production verification guards', () => {
  it('preserves SI prefix case and converts units', () => {
    expect(parseQuantity('2MΩ', 'Ω')).toBe(2e6);
    expect(parseQuantity('2mA', 'A')).toBe(0.002);
    expect(parseQuantity('4.7uF', 'F')).toBeCloseTo(4.7e-6, 14);
    expect(parseQuantity('10nF', 'F')).toBe(1e-8);
    expect(parseQuantity('-1e2V', 'V')).toBe(-100);
  });
  it('rejects wrong dimensions, blank and nonfinite quantities', () => {
    for (const value of ['1A', '', 'NaN', 'Infinity', '1e999V']) expect(() => parseQuantity(value, 'V')).toThrow();
  });
  const divider = () => buildCircuitModel({ components: [
    { label: 'V1', type: 'voltage_source', value: 10, nodeA: 1, nodeB: 0 },
    { label: 'R1', type: 'resistor', value: 3000, nodeA: 1, nodeB: 2 },
    { label: 'R2', type: 'resistor', value: 7000, nodeA: 2, nodeB: 0 },
  ], method: 'dc_nodal', rawText: '', findWhat: ['all'], confidence: 1, warnings: [] }).model;
  it('independent equations withhold a deliberately wrong node answer', () => {
    expect(() => requireIndependentAgreement(divider(), { gnd: 0, n1: 10, n2: 6 })).toThrow(/disagree/);
    expect(() => requireIndependentAgreement(divider(), { gnd: 0, n1: 10, n2: 7 })).not.toThrow();
  });
  it('real DC path accounts for voltage-source current and power', () => {
    const result = solveDC([
      { type: 'voltage_source', value: 10, nodeA: 1, nodeB: 0 },
      { type: 'resistor', value: 3000, nodeA: 1, nodeB: 2 },
      { type: 'resistor', value: 7000, nodeA: 2, nodeB: 0 },
    ]);
    expect(result.nodeVoltages.find(n => n.node === 2)?.voltage).toBeCloseTo(7, 10);
    expect(result.branchCurrents[0].current).toBeCloseTo(-0.001, 12);
    expect(result.powerBalance.delivered).toBeCloseTo(0.01, 12);
    expect(result.powerBalance.absorbed).toBeCloseTo(0.01, 12);
  });
  it('refuses floating nodes instead of copying power into a fake check', () => {
    expect(() => solveDC([{ type: 'resistor', value: 100, nodeA: 1, nodeB: 2 }])).toThrow();
  });
  it('requires explicit dimensionally correct storage initial condition', () => {
    const model = divider();
    model.components[2] = { ...model.components[2], kind: 'capacitor', value: { magnitude: 1e-6, unit: 'farad' } };
    expect(() => solveQuestion(model, { label: 'a', kind: 'transient', target: { type: 'node', ref: 'n2' }, at: 1, deliverable: 'number', sourceText: '' })).toThrow(/initial/);
  });
  it('rejects invalid transient component values', () => {
    expect(() => solveTransient({ type: 'RC', R: 0, L_or_C: 1e-6, Vs: 10, initialValue: 0, tFinal: 1 })).toThrow();
  });
  it('does not fabricate missing vision fields', () => {
    expect(ExtractionSchema.safeParse({ components: [{ type: 'resistor', label: 'R1', value: 100 }], analysisMethod: 'dc_nodal', findWhat: ['voltage'], confidence: 1 }).success).toBe(false);
  });
});