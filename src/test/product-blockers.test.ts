import { describe, it, expect } from 'vitest';
import { WORKFLOW_AVAILABILITY } from '@/lib/workflow-availability';
import { parseProblem } from '@/lib/problem-parser';
import { buildCircuitModel } from '@/lib/parsed-to-model';
import { solveQuestion } from '@/lib/model-solver';
import { solveVerifiedTransient } from '@/lib/verified-transient';
import { solveRLC } from '@/lib/circuit-solver';

describe('Product readiness boundaries', () => {
  for (const id of ['photo', 'generation', 'history'] as const) {
    it(`withholds ${id} actions without independent end-to-end evidence`, () => {
      expect(WORKFLOW_AVAILABILITY[id].enabled).toBe(false);
    });
  }
  for (const id of ['quick', 'mesh', 'ac', 'laplace', 'bode', 'homework', 'fourier', 'exam', 'dc', 'transient', 'rlc', 'sage'] as const) {
    it(`enables ${id} only with a verification path`, () => {
      expect(WORKFLOW_AVAILABILITY[id].enabled).toBe(true);
      expect(WORKFLOW_AVAILABILITY[id].reason.length).toBeGreaterThan(20);
    });
  }
  it('requires an explicitly selected equivalent terminal', () => {
    const draft = parseProblem('Find Thevenin. V1 = 10V between node 1 and node 0. R1 = 3kΩ between node 1 and node 2. R2 = 7kΩ between node 2 and node 0.');
    expect(buildCircuitModel(draft).unsupported.length).toBeGreaterThan(0);
    const built = buildCircuitModel({ ...draft, outputNode: 2 });
    expect(built.unsupported).toEqual([]);
    const q = built.model.questions.find(q => q.kind === 'thevenin');
    if (!q) throw new Error('Missing explicit terminal question');
    expect(solveQuestion(built.model, q).extras?.rth).toBeCloseTo(2100, 8);
    expect(solveQuestion(built.model, q).numeric).toBeCloseTo(7, 10);
  });
  it('preserves dimensioned milliamp initial conditions', () => {
    expect(parseProblem('RL transient. R1 = 100Ω, L1 = 10mH, i(0) = 2mA').initialCurrent).toBe(0.002);
    expect(Number.isNaN(parseProblem('RL transient. R1 = 100Ω, L1 = 10mH, i(0) = 2V').initialCurrent)).toBe(true);
  });
  it('rejects equivalent output nodes not present in the circuit', () => {
    const parsed = parseProblem('Find Thevenin. V1 = 10V between node 1 and node 0. R1 = 100Ω between node 1 and node 0.');
    expect(buildCircuitModel({ ...parsed, outputNode: 99 }).unsupported.length).toBeGreaterThan(0);
  });
  it('selects capacitor voltage instead of a source node for RC', () => {
    const built = buildCircuitModel(parseProblem('RC transient. V1 = 10V between node 1 and node 0. R1 = 100Ω between node 1 and node 2. C1 = 10uF between node 2 and node 0. v(0) = 2V.'));
    expect(built.model.questions[0].target).toEqual({ type: 'node', ref: 'n2' });
    expect(solveQuestion(built.model, { ...built.model.questions[0], at: '0+' }).numeric).toBeCloseTo(2, 12);
  });
  it('preserves power intent in confirmed resistor questions', () => {
    const built = buildCircuitModel(parseProblem('Find power dissipated. V1 = 10V between node 1 and node 0. R1 = 100Ω between node 1 and node 0.'));
    const question = built.model.questions.find(q => q.target.ref === 'R1');
    if (!question) throw new Error('Power question missing');
    expect(question.kind).toBe('power');
    expect(solveQuestion(built.model, question).numeric).toBeCloseTo(1, 12);
  });
  for (const assignment of ['R2 = 2A', 'R2 = 2kA', 'C1 = 10Ω', 'R2 = -100Ω', 'C1 = 0F', 'R2 = NaN']) {
    it(`blocks omitted or wrong-dimension assignment ${assignment}`, () => {
      const draft = parseProblem(`Use nodal analysis. V1 = 10V between node 1 and node 0. R1 = 100Ω between node 1 and node 0. ${assignment}`);
      expect(buildCircuitModel(draft).unsupported.length).toBeGreaterThan(0);
    });
  }
  it('returns watts for a resistor power request', () => {
    const m = buildCircuitModel(parseProblem('Use nodal analysis. V1 = 10V between node 1 and node 0. R1 = 100Ω between node 1 and node 0.')).model;
    const result = solveQuestion(m, { label: 'a', kind: 'power', target: { type: 'component', ref: 'R1' }, deliverable: 'number', sourceText: '' });
    expect(result.numeric).toBeCloseTo(1, 12);
    expect(result.units).toBe('W');
  });
  for (const type of ['RC', 'RL'] as const) {
    it(`checks explicit series ${type} response against endpoint equations`, () => {
      const result = solveVerifiedTransient({ type, R: 1000, L_or_C: type === 'RC' ? 0.001 : 1, Vs: 10, initialValue: 0, tFinal: type === 'RC' ? 1 : 0.001 });
      expect(result.tau).toBe(type === 'RC' ? 1 : 0.001);
      expect(result.points[200].value).toBeCloseTo((type === 'RC' ? 10 : 0.01) * (1 - Math.exp(-1)), 12);
      expect(result.finalValue).toBe(type === 'RC' ? 10 : 0.01);
    });
  }
  it('selects storage current rather than source node for a confirmed RL transient', () => {
    const built = buildCircuitModel(parseProblem('RL transient. V1 = 10V between node 1 and node 0. R1 = 100Ω between node 1 and node 2. L1 = 10mH between node 2 and node 0. i(0) = 2mA.'));
    expect(built.model.questions[0].target).toEqual({ type: 'component', ref: 'L1' });
    expect(solveQuestion(built.model, built.model.questions[0]).numeric).toBeCloseTo(0.1, 12);
  });
  it('does not certify an unsettled RLC endpoint', () => {
    const result = solveRLC({ topology: 'series', R: 200, L: 0.05, C: 0.0002, Vs: 10, excitation: 'step', vC0: 0, iL0: 0, tFinal: 0.00001 });
    expect(result.verification.ok).toBe(false);
  });
});