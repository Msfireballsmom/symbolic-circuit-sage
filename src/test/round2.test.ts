import { describe, expect, it } from 'vitest';
import { solveFourier } from '@/lib/fourier-solver';
import { DIVIDER_EXAMPLE, schematicToDC } from '@/lib/schematic-netlist';
import { solveDC } from '@/lib/circuit-solver';
import { EXAM_ITEMS, gradeBlanks, verifiedExamItems } from '@/lib/exam-bank';
import { WORKFLOW_AVAILABILITY } from '@/lib/workflow-availability';

describe('Fourier coefficients against textbook formulas', () => {
  it('matches square, pulse, and full-wave closed forms', () => {
    const square = solveFourier({ waveform: 'square', amplitude: 3, period: 0.02, dutyCycle: 0.5, numHarmonics: 5, dcOffset: 0 });
    expect(square.a0).toBeCloseTo(0, 8);
    expect(square.coefficients[0].bn).toBeCloseTo(12 / Math.PI, 6);
    expect(square.coefficients[1].bn).toBeCloseTo(0, 6);
    expect(square.coefficients[2].bn).toBeCloseTo(4 * 3 / (3 * Math.PI), 6);

    const pulse = solveFourier({ waveform: 'pulse', amplitude: 2, period: 1, dutyCycle: 0.25, numHarmonics: 4, dcOffset: 0 });
    expect(pulse.a0).toBeCloseTo(0.5, 6);
    const n = 1;
    expect(pulse.coefficients[0].an).toBeCloseTo((2 * Math.sin(2 * Math.PI * n * 0.25)) / (n * Math.PI), 5);
    expect(pulse.coefficients[0].bn).toBeCloseTo((2 * (1 - Math.cos(2 * Math.PI * n * 0.25))) / (n * Math.PI), 5);

    const full = solveFourier({ waveform: 'rectified_sine', amplitude: 1, period: 1, dutyCycle: 0.5, numHarmonics: 4, dcOffset: 0 });
    expect(full.a0).toBeCloseTo(2 / Math.PI, 5);
    expect(full.coefficients[1].an).toBeCloseTo(-4 / (Math.PI * 3), 5);
    expect(full.coefficients[0].cn).toBeCloseTo(0, 5);
  });

  it('refuses a custom waveform', () => {
    expect(() => solveFourier({ waveform: 'custom', amplitude: 1, period: 1, dutyCycle: 0.5, numHarmonics: 3, dcOffset: 0 })).toThrow(/custom/i);
  });
});

describe('Schematic drawing feeds the DC solver', () => {
  it('solves the drawn 12 V divider at 8 V', () => {
    const net = schematicToDC(DIVIDER_EXAMPLE.parts, DIVIDER_EXAMPLE.ground);
    const solved = solveDC(net.components);
    const output = net.nodeOf['0,2'];
    expect(solved.nodeVoltages.find(node => node.node === output)?.voltage).toBeCloseTo(8, 8);
    expect(solved.powerBalance.balanced).toBe(true);
  });

  it('requires ground and rejects a wire across a source', () => {
    expect(() => schematicToDC(DIVIDER_EXAMPLE.parts, null)).toThrow(/ground/i);
    expect(() => schematicToDC([
      ...DIVIDER_EXAMPLE.parts,
      { id: 'short', kind: 'wire', a: '0,0', b: '2,0', value: 0 },
    ], DIVIDER_EXAMPLE.ground)).toThrow(/short/i);
  });
});

describe('Practice exam keys', () => {
  it('publishes every question only after the second method agrees', () => {
    expect(WORKFLOW_AVAILABILITY.exam.enabled).toBe(true);
    expect(WORKFLOW_AVAILABILITY.photo.enabled).toBe(false);
    const ready = verifiedExamItems();
    expect(ready.length).toBe(EXAM_ITEMS.length);
    const nodal = ready.find(entry => entry.item.id === 'nodal-two-resistors');
    expect(nodal?.key.V2).toBeCloseTo(72 / 11, 8);
    const ohm = ready.find(entry => entry.item.id === 'ohm-24-6k');
    if (!ohm) throw new Error('missing ohm item');
    const graded = gradeBlanks(ohm.item, ohm.key, { I: 0.004, P: 0.096 });
    expect(graded.every(blank => blank.match)).toBe(true);
    expect(gradeBlanks(ohm.item, ohm.key, { I: 1, P: 1 }).some(blank => blank.match)).toBe(false);
  });
});
