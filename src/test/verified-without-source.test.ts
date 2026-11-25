import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import VerifiedSolution from '@/components/VerifiedSolution';
import { guardAnswer } from '@/lib/answer-guard';
import { parseProblem, type ParsedProblem } from '@/lib/problem-parser';
import { analysisKindFor, buildCircuitModel } from '@/lib/parsed-to-model';
import { solveQuestion } from '@/lib/model-solver';
import type { Component } from '@/lib/circuit-model';

// Historical examples remain regression fixtures even when removed from the UI.
// The live list is covered by sage-examples.requirement.test.tsx.
const examples = [
  "Find the voltage across R2 using voltage divider. Vs = 12V, R1 = 4kΩ, R2 = 6kΩ",
  "Use nodal analysis. 12V source between node 1 and ground, R1 = 1kΩ between node 1 and node 2, R2 = 2kΩ between node 2 and ground",
  "Find equivalent resistance. R1 = 100Ω, R2 = 200Ω, R3 = 300Ω in series",
  "RC transient circuit. R = 10kΩ, C = 47μF, Vs = 5V, v(0) = 0V",
  "AC phasor analysis. Vs = 120V, f = 60Hz, R = 100Ω, L = 50mH, C = 10μF, series RLC",
  "Ohm's law. V = 24V, R = 4.7kΩ, find current and power",
  "Mesh analysis with 2 meshes. Vs = 24V, R1 = 2kΩ in mesh 1, R2 = 4kΩ shared between mesh 1 and mesh 2, R3 = 6kΩ in mesh 2",
  "Inverting op-amp. Rf = 100kΩ, Rin = 10kΩ, Vin = 0.5V",
  "Half-wave rectifier. Vs = 12V peak, R = 1kΩ, silicon diode",
  "Zener regulator. Vs = 15V, R = 330Ω, Vz = 5.1V",
];

function withRenderedAnswer(parsed: ParsedProblem, inspect: (container: HTMLDivElement, onSolved: ReturnType<typeof vi.fn>) => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSolved = vi.fn();
  try {
    act(() => root.render(createElement(VerifiedSolution, { parsed, onSolved })));
    inspect(container, onSolved);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
}

describe('Answerability outside the certified engine', () => {
  it('withholds the three-resistor series answer and does not complete a solve', () => {
    const parsed = parseProblem(examples[2]);
    const { model } = buildCircuitModel(parsed);
    expect(model.components.map(c => c.value.magnitude)).toEqual([100, 200, 300]);
    expect(guardAnswer(model.components, model.questions, parsed.findWhat)).toMatchObject({ ok: false, code: 'RESISTANCE_NOT_COMPUTED' });
    withRenderedAnswer(parsed, (container, onSolved) => {
      expect(container.textContent).not.toContain('Verified solution');
      expect(container.textContent).toContain('Answer withheld — cannot be answered from this netlist');
      expect(container.textContent).toContain('Equivalent resistance is not computed by the verified engine yet.');
      expect(onSolved).not.toHaveBeenCalled();
    });
  });

  it('refuses resistance-only questions even with a voltage source, without completing a solve', () => {
    const parsed = { ...parseProblem(examples[1]), findWhat: ['resistance'] };
    const { model } = buildCircuitModel(parsed);
    expect(model.components.some(c => c.kind === 'vsource')).toBe(true);
    expect(guardAnswer(model.components, model.questions, parsed.findWhat)).toEqual({
      ok: false,
      code: 'RESISTANCE_NOT_COMPUTED',
      message: 'Equivalent resistance is not computed by the verified engine yet. Verified node voltages would be answers to a different question than the one asked.',
      remedy: 'The two measurement terminals must be explicitly stated and confirmed; they cannot be guessed from draft node numbers.',
    });
    withRenderedAnswer(parsed, (container, onSolved) => {
      expect(container.textContent).not.toContain('Verified solution');
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('Equivalent resistance is not computed');
      expect(onSolved).not.toHaveBeenCalled();
    });
  });

  it('still allows and solves sourced compound resistance and voltage questions', () => {
    const parsed = { ...parseProblem(examples[1]), findWhat: ['resistance', 'voltage'] };
    const { model } = buildCircuitModel(parsed);
    expect(guardAnswer(model.components, model.questions, parsed.findWhat)).toEqual({ ok: true });
    const question = model.questions.find(q => q.target.ref === 'n2');
    if (!question) throw new Error('Expected node n2 question');
    expect(solveQuestion(model, question).numeric).toBe(8);
    withRenderedAnswer(parsed, (container, onSolved) => {
      expect(container.textContent).toContain('Verified solution');
      expect(container.textContent).toContain('8.00000 V');
      expect(onSolved).toHaveBeenCalledTimes(1);
    });
  });

  it('still allows sourced all questions', () => {
    const parsed = { ...parseProblem(examples[1]), findWhat: ['all'] };
    const { model } = buildCircuitModel(parsed);
    expect(guardAnswer(model.components, model.questions, parsed.findWhat)).toEqual({ ok: true });
    withRenderedAnswer(parsed, (container, onSolved) => {
      expect(container.textContent).toContain('Verified solution');
      expect(container.textContent).toContain('8.00000 V');
      expect(onSolved).toHaveBeenCalledTimes(1);
    });
  });

  it('generally refuses source-less solve and power questions, allowing either independent source kind', () => {
    const parsed = parseProblem('Use nodal analysis. R1 = 73Ω between node 1 and ground, R2 = 211Ω between node 1 and ground');
    const { model } = buildCircuitModel(parsed);
    expect(guardAnswer(model.components, model.questions, ['current']).ok).toBe(false);
    const powerQuestions = model.questions.map(q => ({ ...q, kind: 'power' as const }));
    expect(guardAnswer(model.components, powerQuestions, ['power']).ok).toBe(false);
    for (const kind of ['vsource', 'isource'] as const) {
      const source: Component = { ...model.components[0], id: 'Independent1', kind, value: { magnitude: 2, unit: kind === 'vsource' ? 'volt' : 'amp' } };
      expect(guardAnswer([...model.components, source], model.questions, ['current'])).toEqual({ ok: true });
    }
  });

  it('allows a source-free RC natural response from its initial energy', () => {
    const parsed: ParsedProblem = {
      ...parseProblem('RC transient. R = 2kΩ, C = 10μF, v(0) = 3V'),
      initialVoltage: 3,
      components: [
        { type: 'resistor', label: 'R1', value: 2000, nodeA: 1, nodeB: 0 },
        { type: 'capacitor', label: 'C1', value: 10e-6, nodeA: 1, nodeB: 0 },
      ],
    };
    const { model } = buildCircuitModel(parsed);
    expect(model.questions.every(q => q.kind === 'transient')).toBe(true);
    expect(guardAnswer(model.components, model.questions, parsed.findWhat)).toEqual({ ok: true });
    const answer = solveQuestion(model, model.questions[0]);
    expect(answer.extras?.x0).toBe(3);
    expect(answer.extras?.tau).toBeCloseTo(0.02, 12);
    expect(answer.numeric).toBe(0);
    withRenderedAnswer(parsed, (container, onSolved) => {
      expect(container.textContent).toContain('Verified solution');
      expect(onSolved).toHaveBeenCalledTimes(1);
    });
  });

  const methods = ['voltage_divider', 'dc_nodal', 'series_parallel', 'transient', 'ac_phasor', 'ohms_law', 'mesh', 'opamp', 'diode_analysis', 'diode_analysis'];
  const expected = new Map<number, { ref: string; value: number; unit: string }[]>([
    [0, [{ ref: 'n1', value: 12, unit: 'V' }, { ref: 'n2', value: 7.2, unit: 'V' }, { ref: 'R1', value: 0.0012, unit: 'A' }, { ref: 'R2', value: 0.0012, unit: 'A' }]],
    [1, [{ ref: 'n1', value: 12, unit: 'V' }, { ref: 'n2', value: 8, unit: 'V' }, { ref: 'R1', value: 0.004, unit: 'A' }, { ref: 'R2', value: 0.004, unit: 'A' }]],
    [3, [{ ref: 'n2', value: 5, unit: 'V' }]],
    [5, [{ ref: 'n1', value: 24, unit: 'V' }, { ref: 'R1', value: 24 / 4700, unit: 'A' }]],
  ]);

  it('audits exactly ten historical examples', () => expect(examples).toHaveLength(10));

  it('keeps Example 6 voltage and current and appends verified resistor power', () => {
    const parsed = parseProblem(examples[5]);
    expect(parsed.findWhat).toEqual(['current', 'power']);
    const { model } = buildCircuitModel(parsed);
    expect(model.questions.map(q => ({ label: q.label, kind: q.kind, target: q.target }))).toEqual([
      { label: 'a', kind: 'solve', target: { type: 'node', ref: 'n1' } },
      { label: 'b', kind: 'solve', target: { type: 'component', ref: 'R1' } },
      { label: 'c', kind: 'power', target: { type: 'component', ref: 'R1' } },
    ]);
    expect(solveQuestion(model, model.questions[0]).numeric).toBe(24);
    expect(solveQuestion(model, model.questions[1]).numeric).toBe(24 / 4700);
    const power = solveQuestion(model, model.questions[2]);
    expect(power.numeric).toBeCloseTo(0.1225531914893617, 12);
    expect(power.units).toBe('W');
    expect(power.steps.some(step => step.includes('cross-check V²/R') && step.includes('the two agree to 1e-9'))).toBe(true);
    withRenderedAnswer(parsed, (container, onSolved) => {
      expect(container.textContent).toContain('Verified solution');
      expect(container.textContent).toContain('0.122553 W');
      expect(container.textContent).toContain('24.0000 V');
      expect(container.textContent).toContain('0.00510638 A');
      expect(onSolved).toHaveBeenCalledTimes(1);
    });
  });

  it.each(examples.map((text, index) => ({ text, index })))('example $index cannot certify an all-zero substitute answer', ({ text, index }) => {
    const parsed = parseProblem(text);
    expect(parsed.method).toBe(methods[index]);
    const build = buildCircuitModel(parsed);
    const guard = guardAnswer(build.model.components, build.model.questions, parsed.findWhat);
    const reachesSolver = guard.ok && analysisKindFor(parsed.method) !== null && build.unsupported.length === 0;
    expect(reachesSolver).toBe(expected.has(index));
    withRenderedAnswer(parsed, (container, onSolved) => {
      const certified = container.textContent?.includes('Verified solution') ?? false;
      expect(certified).toBe(expected.has(index));
      expect(onSolved).toHaveBeenCalledTimes(certified ? 1 : 0);
      if (!reachesSolver) return;
      const results = build.model.questions.map(q => ({ q, answer: solveQuestion(build.model, q) }));
      expect(certified && results.every(r => r.answer.numeric === 0)).toBe(false);
      for (const pin of expected.get(index) ?? []) {
        const result = results.find(r => r.q.target.ref === pin.ref)?.answer;
        expect(result?.numeric).toBeCloseTo(pin.value, 12);
        expect(result?.units).toBe(pin.unit);
        const displayed = Math.abs(pin.value) < 1e-3 ? pin.value.toExponential(4) : pin.value.toPrecision(6);
        expect(container.textContent).toContain(`${displayed} ${pin.unit}`);
      }
      if (index === 3) expect(results[0].answer.extras?.tau).toBeCloseTo(0.47, 12);
    });
  });
});