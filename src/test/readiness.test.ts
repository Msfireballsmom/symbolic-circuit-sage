import { describe, it, expect, vi } from 'vitest';
import { parseQuantity } from '@/lib/quantity';
import { solveDC, solveAC, solveTransient } from '@/lib/circuit-solver';
import { buildCircuitModel } from '@/lib/parsed-to-model';
import { requireIndependentAgreement } from '@/lib/independent-dc';
import { solveQuestion } from '@/lib/model-solver';
import { ExtractionSchema } from '@/lib/extraction-schema';
import { parseProblem } from '@/lib/problem-parser';
import { exportSolutionAsPDF } from '@/lib/pdf-export';

describe('Production verification guards', () => {
  it('retains numbered source values and nodes instead of reading question node numbers as volts', () => {
    const parsed = parseProblem('Use nodal analysis. V1 = 10V between node 1 and node 0. R1 = 3kΩ between node 1 and node 2. R2 = 7kΩ between node 2 and node 0. Find voltage at node 2 and currents.');
    expect(parsed.components.find(c => c.type === 'voltage_source')).toMatchObject({ label: 'V1', value: 10, nodeA: 1, nodeB: 0 });
    const model = buildCircuitModel(parsed).model;
    expect(solveQuestion(model, { label: 'a', kind: 'solve', target: { type: 'node', ref: 'n2' }, deliverable: 'number', sourceText: '' }).numeric).toBeCloseTo(7, 10);
  });
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
  it('rejects parallel AC rather than applying the series formula', () => {
    expect(() => solveAC({ Vm: 10, phase: 0, frequency: 60, R: 100, L: 0.1, C: 1e-6, config: 'parallel' })).toThrow(/parallel AC topology is not implemented/i);
  });
  it('escapes user export content and defaults to uncertified status', () => {
    const write = vi.fn();
    const popup = vi.spyOn(window, 'open').mockReturnValue({ document: { write, close: vi.fn() } } as unknown as Window);
    try {
      exportSolutionAsPDF('<img src=x onerror=alert(1)>', ['<script>steal()</script>']);
      const html = write.mock.calls[0][0] as string;
      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('<script>steal()');
      expect(html).toContain('&lt;script&gt;steal()');
      expect(html).toContain('Unverified — not a certified final answer');
    } finally { popup.mockRestore(); }
  });
});