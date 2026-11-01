// Item 1: the DC tab path must run preflight, so a floating node is named.
// Item 2: gauss() must not scale its singularity threshold by the source voltage.

import { describe, it, expect } from 'vitest';
import { solveDC, type DCComponent } from '@/lib/circuit-solver';
import { gauss, solveDCOperatingPoint } from '@/lib/model-solver';
import { buildCircuitModel } from '@/lib/parsed-to-model';

describe('DC solve runs preflight first (item 1)', () => {
  it('names the floating nodes instead of reporting a singular matrix', () => {
    const components: DCComponent[] = [
      { type: 'voltage_source', value: 12, nodeA: 1, nodeB: 0 },
      { type: 'resistor', value: 1000, nodeA: 2, nodeB: 3 },
    ];
    let message = '';
    try {
      solveDC(components);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/\bn2\b/);
    expect(message).toMatch(/\bn3\b/);
    expect(message).toMatch(/floats/i);
    expect(message).not.toMatch(/singular/i);
  });

  it('still solves a fully grounded circuit', () => {
    const r = solveDC([
      { type: 'voltage_source', value: 10, nodeA: 1, nodeB: 0 },
      { type: 'resistor', value: 3000, nodeA: 1, nodeB: 2 },
      { type: 'resistor', value: 7000, nodeA: 2, nodeB: 0 },
    ]);
    expect(r.nodeVoltages.find((n) => n.node === 2)?.voltage).toBeCloseTo(7, 9);
  });
});

describe('gauss() conditioning (item 2)', () => {
  it('keeps the pivot threshold row-relative, not scaled by the source voltage', () => {
    // 10 kV source across 1 GΩ resistors: coefficients ~1e-9 S, right-hand side 1e4 V.
    const A = [[1e-9, -1e-9, 1], [-1e-9, 2e-9, 0], [1, 0, 0]];
    const x = gauss(A, [0, 0, 1e4]);
    expect(x[0]).toBeCloseTo(1e4, 6);
    expect(x[1]).toBeCloseTo(5e3, 6);
    expect(x[2]).toBeCloseTo(-5e-6, 12);
  });

  it('solves a 10 kV / 1 GΩ divider through the public DC path', () => {
    const components: DCComponent[] = [
      { type: 'voltage_source', value: 10000, nodeA: 1, nodeB: 0 },
      { type: 'resistor', value: 1e9, nodeA: 1, nodeB: 2 },
      { type: 'resistor', value: 1e9, nodeA: 2, nodeB: 0 },
    ];
    const r = solveDC(components);
    expect(r.nodeVoltages.find((n) => n.node === 2)?.voltage).toBeCloseTo(5000, 6);

    const model = buildCircuitModel({
      components: components.map((c, i) => ({ type: c.type, value: c.value, nodeA: c.nodeA, nodeB: c.nodeB, label: `c${i + 1}` })),
      method: 'dc_nodal', rawText: '', findWhat: ['all'], confidence: 1, warnings: [],
    }).model;
    expect(solveDCOperatingPoint(model).nodeVoltages.n2).toBeCloseTo(5000, 6);
  });

  it('still refuses a genuinely singular system', () => {
    expect(() => gauss([[1, 1], [1, 1]], [1, 2])).toThrow(/singular/i);
  });
});