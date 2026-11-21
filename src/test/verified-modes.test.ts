import { describe, expect, it } from 'vitest';
import { solveAC, solveDC, solveCurrentDivider, solveOhmsLaw, solveSeriesParallel, solveThevenin, solveVoltageDivider } from '@/lib/circuit-solver';
import { solveMesh } from '@/lib/mesh-solver';
import { solveBode } from '@/lib/bode';
import { solveLaplace } from '@/lib/laplace-solver';
import { answersMatch, gradeHomework } from '@/lib/homework-check';

const near = (actual: number, expected: number) => {
  expect(actual).toBeCloseTo(expected, 6);
};

describe('Mesh rows cross-checked with nodal analysis', () => {
  it('matches the two-mesh textbook fractions and a hand-built nodal netlist', () => {
    const mesh = solveMesh(2, [
      { type: 'voltage_source', value: 10, meshes: [1], label: 'Vs' },
      { type: 'resistor', value: 4, meshes: [1], label: 'R1' },
      { type: 'resistor', value: 2, meshes: [1, 2], label: 'R2' },
      { type: 'resistor', value: 6, meshes: [2], label: 'R3' },
    ]);
    near(mesh.meshCurrents[0].current, 20 / 11);
    near(mesh.meshCurrents[1].current, 5 / 11);
    const nodal = solveDC([
      { type: 'voltage_source', value: 10, nodeA: 1, nodeB: 0 },
      { type: 'resistor', value: 4, nodeA: 1, nodeB: 2 },
      { type: 'resistor', value: 2, nodeA: 2, nodeB: 0 },
      { type: 'resistor', value: 6, nodeA: 2, nodeB: 0 },
    ]);
    const iR1 = nodal.branchCurrents[1].current;
    const iR3 = nodal.branchCurrents[3].current;
    near(mesh.meshCurrents[0].current, iR1);
    near(mesh.meshCurrents[1].current, iR3);
    expect(mesh.powerBalance.balanced).toBe(true);
    expect(mesh.steps.some(step => step.includes('Independent nodal cross-check'))).toBe(true);
  });

  it('matches two aiding sources and a three-mesh ladder', () => {
    const two = solveMesh(2, [
      { type: 'voltage_source', value: 20, meshes: [1], label: 'V1' },
      { type: 'voltage_source', value: 10, meshes: [2], label: 'V2' },
      { type: 'resistor', value: 4, meshes: [1], label: 'R1' },
      { type: 'resistor', value: 2, meshes: [1, 2], label: 'R2' },
      { type: 'resistor', value: 6, meshes: [2], label: 'R3' },
    ]);
    near(two.meshCurrents[0].current, 45 / 11);
    near(two.meshCurrents[1].current, 25 / 11);
    // A source that aids a clockwise mesh current is a rise in that direction:
    // the return source has its positive terminal on the outer rail.
    const hand = solveDC([
      { type: 'voltage_source', value: 20, nodeA: 1, nodeB: 0 },
      { type: 'resistor', value: 4, nodeA: 1, nodeB: 2 },
      { type: 'resistor', value: 2, nodeA: 2, nodeB: 0 },
      { type: 'resistor', value: 6, nodeA: 2, nodeB: 3 },
      { type: 'voltage_source', value: 10, nodeA: 0, nodeB: 3 },
    ]);
    near(two.meshCurrents[0].current, hand.branchCurrents[1].current);
    near(two.meshCurrents[1].current, hand.branchCurrents[3].current);

    const three = solveMesh(3, [
      { type: 'voltage_source', value: 10, meshes: [1], label: 'Vs' },
      { type: 'resistor', value: 1, meshes: [1], label: 'R1' },
      { type: 'resistor', value: 2, meshes: [1, 2], label: 'R12' },
      { type: 'resistor', value: 3, meshes: [2], label: 'R2' },
      { type: 'resistor', value: 4, meshes: [2, 3], label: 'R23' },
      { type: 'resistor', value: 5, meshes: [3], label: 'R3' },
    ]);
    near(three.meshCurrents[0].current, 650 / 159);
    near(three.meshCurrents[1].current, 180 / 159);
    near(three.meshCurrents[2].current, 80 / 159);
  });

  it('refuses a shared loop and a current source instead of returning a partial answer', () => {
    expect(() => solveMesh(3, [
      { type: 'voltage_source', value: 12, meshes: [1] },
      { type: 'resistor', value: 1, meshes: [1] },
      { type: 'resistor', value: 2, meshes: [1, 2] },
      { type: 'resistor', value: 3, meshes: [2, 3] },
      { type: 'resistor', value: 4, meshes: [1, 3] },
      { type: 'resistor', value: 5, meshes: [2] },
      { type: 'resistor', value: 6, meshes: [3] },
    ])).toThrow(/loop|row|Nodal/i);
    expect(() => solveMesh(2, [
      { type: 'current_source', value: 1, meshes: [1, 2] },
      { type: 'resistor', value: 10, meshes: [1] },
      { type: 'resistor', value: 10, meshes: [2] },
    ])).toThrow(/current-source|supermesh/i);
  });
});

describe('AC phasors cross-checked with textbook values', () => {
  it('solves a series RLC with XL = 8 Ω and XC = 4 Ω', () => {
    const frequency = 1000 / (2 * Math.PI);
    const result = solveAC({ Vm: 10, phase: 0, frequency, R: 6, L: 0.008, C: 0.00025, config: 'series' });
    near(result.impedance.re, 6);
    near(result.impedance.im, 4);
    near(result.current.re, 15 / 13);
    near(result.current.im, -10 / 13);
    near(result.powerReal, 75 / 13);
    near(result.powerFactor, 3 / Math.sqrt(13));
    near(result.voltageR.re + result.voltageL.re + result.voltageC.re, 10);
    near(result.voltageR.im + result.voltageL.im + result.voltageC.im, 0);
  });

  it('solves a parallel RL branch from admittance', () => {
    const frequency = 1000 / (2 * Math.PI);
    const result = solveAC({ Vm: 10, phase: 30, frequency, R: 10, L: 0.01, C: 0, config: 'parallel' });
    const phase = 30 * Math.PI / 180;
    const vs = { re: 10 * Math.cos(phase), im: 10 * Math.sin(phase) };
    const y = { re: 0.1, im: -0.1 };
    near(result.current.re, vs.re * y.re - vs.im * y.im);
    near(result.current.im, vs.re * y.im + vs.im * y.re);
    near(result.powerReal, 5);
    expect(result.powerReactive).toBeGreaterThan(0);
  });
});

describe('Bode checkpoints', () => {
  it('places the RC low-pass half-power point at −3.0103 dB and −45°', () => {
    const result = solveBode('rc_lowpass', 1000, 0, 1e-6, 1, 1e6);
    const corner = result.checkpoints.find(point => Math.abs(point.freq - result.fc) < 1e-6);
    expect(corner?.magDb).toBeCloseTo(20 * Math.log10(1 / Math.SQRT2), 4);
    expect(corner?.phaseDeg).toBeCloseTo(-45, 4);
    expect(result.fc).toBeCloseTo(1 / (2 * Math.PI * 1000 * 1e-6), 6);
  });

  it('puts series resonance at 0 dB and the capacitor voltage at −90°', () => {
    const band = solveBode('rlc_bandpass', 10, 0.1, 1e-4, 10, 1e4);
    const peak = band.checkpoints.find(point => Math.abs(point.freq - band.fc) < 1e-6);
    expect(peak?.magDb).toBeCloseTo(0, 4);
    expect(peak?.phaseDeg).toBeCloseTo(0, 4);
    const cap = solveBode('rlc_series', 10, 0.1, 1e-4, 10, 1e4);
    const acrossC = cap.checkpoints.find(point => Math.abs(point.freq - cap.fc) < 1e-6);
    const q = Math.sqrt(0.1 / 1e-4) / 10;
    expect(acrossC?.magDb).toBeCloseTo(20 * Math.log10(q), 3);
    expect(acrossC?.phaseDeg).toBeCloseTo(-90, 3);
  });
});

describe('Laplace residues', () => {
  it('reproduces the step residues of 6/[(s+2)(s+4)]', () => {
    const result = solveLaplace({ numerator: [6], denominator: [1, 6, 8], inputType: 'step' });
    const residue = (pole: number) => {
      const term = result.partialFractions.find(item => Math.abs(item.pole.re - pole) < 1e-6 && Math.abs(item.pole.im) < 1e-6);
      return typeof term?.coefficient === 'number' ? term.coefficient : NaN;
    };
    expect(residue(0)).toBeCloseTo(0.75, 6);
    expect(residue(-2)).toBeCloseTo(-1.5, 6);
    expect(residue(-4)).toBeCloseTo(0.75, 6);
  });

  it('inverts 24/[(s+1)(s+2)(s+3)] and refuses a repeated pole', () => {
    const result = solveLaplace({ numerator: [24], denominator: [1, 6, 11, 6], inputType: 'impulse' });
    const value = (pole: number) => {
      const term = result.partialFractions.find(item => Math.abs(item.pole.re - pole) < 1e-6);
      return typeof term?.coefficient === 'number' ? term.coefficient : NaN;
    };
    expect(value(-1)).toBeCloseTo(12, 5);
    expect(value(-2)).toBeCloseTo(-24, 5);
    expect(value(-3)).toBeCloseTo(12, 5);
    expect(() => solveLaplace({ numerator: [1], denominator: [1, 2, 1], inputType: 'impulse' })).toThrow(/repeated-pole/i);
  });
});

describe('Quick calculators and homework tolerance', () => {
  it('matches nodal equivalents for the quick formulas', () => {
    expect(Number(solveVoltageDivider(12, 4000, 6000).results[0].value)).toBeCloseTo(7.2, 8);
    expect(Number(solveCurrentDivider(0.01, 2000, 3000).results[0].value)).toBeCloseTo(0.006, 8);
    expect(Number(solveSeriesParallel([100, 200, 300], 'series').results[0].value)).toBeCloseTo(600, 8);
    expect(Number(solveSeriesParallel([100, 300], 'parallel').results[0].value)).toBeCloseTo(75, 6);
    expect(Number(solveOhmsLaw({ V: 10, R: 4 }).results.find(item => item.label === 'P')?.value)).toBeCloseTo(25, 8);
    expect(Number(solveThevenin(12, 0.003).results.find(item => item.label === 'P_max')?.value)).toBeCloseTo(0.009, 8);
  });

  it('accepts a divider within 2% and rejects a wrong one', () => {
    const good = gradeHomework('voltage_divider', { Vs: 12, R1: 4000, R2: 6000 }, { Vout: 7.2 });
    const bad = gradeHomework('voltage_divider', { Vs: 12, R1: 4000, R2: 6000 }, { Vout: 8 });
    expect(good.comparisons[0].match).toBe(true);
    expect(bad.comparisons[0].match).toBe(false);
    expect(answersMatch(0, 1e-8)).toBe(true);
    expect(answersMatch(0.01, 0)).toBe(false);
    const ohms = gradeHomework('ohms_law', { V: 10, R: 5 }, { I: 2, P: 20 });
    expect(ohms.comparisons.every(item => item.match)).toBe(true);
  });
});
