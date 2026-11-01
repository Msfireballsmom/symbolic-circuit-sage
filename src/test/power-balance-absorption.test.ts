// Item 4: a source that absorbs power must be reported as absorption, not as
// negative delivery. Physical case: 12 V → 1 kΩ → 5 V charging a 5 V source.
import { describe, it, expect } from 'vitest';
import type { CircuitModel } from '@/lib/circuit-model';
import { powerBalance, solveDCOperatingPoint, solveQuestion } from '@/lib/model-solver';

const q = (magnitude: number, unit: any) => ({ magnitude, unit });
const comp = (id: string, kind: any, terminals: string[], value: any) => ({
  id, kind, terminals, value,
  confidence: { exists: 1, value: 1 },
  provenance: { from: 'text' as const },
});

/** 12 V source on n1, 1 kΩ from n1 to n2, 5 V source on n2: V2 is being charged. */
function charging(): CircuitModel {
  return {
    components: [
      comp('V1', 'vsource', ['n1', 'gnd'], q(12, 'volt')),
      comp('R1', 'resistor', ['n1', 'n2'], q(1000, 'ohm')),
      comp('V2', 'vsource', ['n2', 'gnd'], q(5, 'volt')),
    ] as any,
    nodes: [
      { id: 'n1', connects: ['V1', 'R1'] },
      { id: 'n2', connects: ['R1', 'V2'] },
      { id: 'gnd', connects: ['V1', 'V2'], isGround: true },
    ],
    ports: [],
    couplings: [],
    questions: [],
    source: { genre: 'text-only', pages: 1, regions: [] },
    meta: { referenceNode: 'gnd', readAt: new Date().toISOString(), genre: 'text-only', revision: 1 },
  };
}

describe('power balance books an absorbing source as absorption (item 4)', () => {
  it('reports 84 mW delivered, 49 mW dissipated and 35 mW absorbed by the charged source', () => {
    const m = charging();
    const b = powerBalance(m, solveDCOperatingPoint(m));
    expect(b.delivered).toBeCloseTo(0.084, 9);
    expect(b.dissipated).toBeCloseTo(0.049, 9);
    expect(b.absorbedBySources).toBeCloseTo(0.035, 9);
    expect(Math.abs(b.residual)).toBeLessThan(1e-12);
  });

  it('keeps delivered ≈ dissipated + absorbedBySources', () => {
    const m = charging();
    const b = powerBalance(m, solveDCOperatingPoint(m));
    expect(Math.abs(b.delivered - (b.dissipated + b.absorbedBySources))).toBeLessThan(1e-12);
  });

  it('still passes the full verified solve for the charging circuit', () => {
    // assertVerified()/requireIndependentAgreement() must keep passing here: the
    // residual definition is unchanged, only its bookkeeping is split.
    const m = charging();
    const r = solveQuestion(m, {
      label: 'a', kind: 'solve', target: { type: 'node', ref: 'n2' },
      deliverable: 'number', sourceText: 'Find the voltage at node n2.',
    });
    expect(r.numeric).toBeCloseTo(5, 9);
  });

  it('leaves a purely delivering circuit unchanged', () => {
    const m = charging();
    m.components = [
      comp('V1', 'vsource', ['n1', 'gnd'], q(10, 'volt')),
      comp('R1', 'resistor', ['n1', 'n2'], q(3000, 'ohm')),
      comp('R2', 'resistor', ['n2', 'gnd'], q(7000, 'ohm')),
    ] as any;
    m.nodes = [
      { id: 'n1', connects: ['V1', 'R1'] },
      { id: 'n2', connects: ['R1', 'R2'] },
      { id: 'gnd', connects: ['V1', 'R2'], isGround: true },
    ];
    const b = powerBalance(m, solveDCOperatingPoint(m));
    expect(b.delivered).toBeCloseTo(0.01, 12);
    expect(b.dissipated).toBeCloseTo(0.01, 12);
    expect(b.absorbedBySources).toBe(0);
  });
});