// Regression tests for three confirmed bugs in src/lib/problem-parser.ts.
// Each reproduces the exact problem text from the bug report.

import { describe, it, expect } from 'vitest';
import { parseProblem } from '@/lib/problem-parser';
import { buildCircuitModel } from '@/lib/parsed-to-model';
import { preflight } from '@/lib/preflight';
import { solveQuestion } from '@/lib/model-solver';

/** Parse, build, preflight and solve one node voltage straight from problem text. */
function solvedNodeVoltage(text: string, ref: string): number {
  const built = buildCircuitModel(parseProblem(text));
  expect(built.unsupported).toEqual([]);
  expect(preflight(built.model).ok).toBe(true);
  const question = built.model.questions.find(
    (q) => q.kind === 'solve' && q.target.type === 'node' && q.target.ref === ref,
  );
  if (!question) throw new Error(`no node question for ${ref}`);
  const numeric = solveQuestion(built.model, question).numeric;
  if (numeric === undefined) throw new Error(`no numeric result for ${ref}`);
  return numeric;
}

describe('problem parser: unanchored resistor regex (bug 1)', () => {
  it('does not read the trailing r of a word as a resistor label', () => {
    const parsed = parseProblem(
      'A resistor carries Ir = 5mA. Find V across R2. R1 = 470Ω, R2 = 1kΩ, and Vs = 9V.',
    );
    const resistors = parsed.components.filter((c) => c.type === 'resistor');
    expect(resistors.map((c) => c.label)).toEqual(['R1', 'R2']);
    expect(resistors.find((c) => c.label === 'R1')?.value).toBe(470);
    expect(resistors.find((c) => c.label === 'R2')?.value).toBe(1000);
  });

  it('does not read a trailing r or an unrelated value as a resistor assignment', () => {
    expect(parseProblem('V_R2 = 4V. R1 = 1kΩ, R2 = 2kΩ.').components.find((c) => c.label === 'R2')?.value).toBe(2000);
    expect(parseProblem('Find V_out for: 5V. R1 = 470Ω, R2 = 1kΩ.').components.find((c) => c.label === 'R1')?.value).toBe(470);
  });

  it('requires a resistance unit on an unnumbered R = form', () => {
    const parsed = parseProblem('A resistor carries R = 5mA. R1 = 470Ω.');
    expect(parsed.components.filter((c) => c.type === 'resistor').map((c) => c.label)).toEqual(['R1']);
    expect(parsed.components.find((c) => c.label === 'R1')?.value).toBe(470);
  });

  it('never lets an unnumbered R = claim a label a numbered R1 = defines', () => {
    const parsed = parseProblem('R = 100Ω, R1 = 4kΩ, R2 = 6kΩ.');
    expect(parsed.components.find((c) => c.label === 'R1')?.value).toBe(4000);
    expect(parsed.components.find((c) => c.label === 'R2')?.value).toBe(6000);
  });
});

describe('problem parser: node clause bleed (bug 2)', () => {
  const text = 'R1 = 1kΩ. R2 = 1kΩ between node 2 and ground. Vs = 12V between node 1 and ground';

  it('keeps each between-clause with its own component', () => {
    const parsed = parseProblem(text);
    expect(parsed.components.find((c) => c.label === 'R1')).toMatchObject({ nodeA: 1, nodeB: 2 });
    expect(parsed.components.find((c) => c.label === 'R2')).toMatchObject({ nodeA: 2, nodeB: 0 });
    expect(parsed.components.find((c) => c.label === 'Vs')).toMatchObject({ nodeA: 1, nodeB: 0 });
  });

  it('solves the intended series divider to V(n2) = 6 V', () => {
    expect(solvedNodeVoltage(text, 'n2')).toBeCloseTo(6, 9);
  });
});

describe('problem parser: explicit sources keep their default nodes (bug 3)', () => {
  const text = 'Voltage divider. Vs = 12V, R1 = 4kΩ, R2 = 6kΩ. Find V across R2.';

  it('gives a Vs = 12V source nodes 1 and 0', () => {
    expect(parseProblem(text).components.find((c) => c.label === 'Vs')).toMatchObject({ nodeA: 1, nodeB: 0 });
  });

  it('solves the 12 V / 4 kΩ / 6 kΩ divider to 7.2 V', () => {
    expect(solvedNodeVoltage(text, 'n2')).toBeCloseTo(7.2, 9);
  });
});
