// Circuit Sage v2 — the coverage runner.
// Every row here is a failing test on purpose until the solver lands (M2).
// This file is the "done" definition for §9: when every row is green,
// "solves the whole subject" is a number rather than a claim.

import { describe, it, expect } from "vitest";
import { MATRIX, TODO_ROWS } from "./problems";
import type { ExpectedValue } from "./types";
import { solveQuestion } from "@/lib/model-solver";

const solve = solveQuestion;

function checkExpectation(actual: { numeric?: number; complex?: { re: number; im: number }; symbolic?: string }, expected: ExpectedValue, tol: number) {
  switch (expected.kind) {
    case "number":
      expect(actual.numeric).toBeDefined();
      expect(Math.abs((actual.numeric as number) - expected.value))
        .toBeLessThanOrEqual(Math.max(tol, tol * Math.abs(expected.value)));
      break;
    case "quantity":
      expect(actual.numeric).toBeDefined();
      expect(Math.abs((actual.numeric as number) - expected.value.magnitude))
        .toBeLessThanOrEqual(Math.max(tol, tol * Math.abs(expected.value.magnitude)));
      break;
    case "complex":
      expect(actual.complex).toBeDefined();
      expect(Math.abs(actual.complex!.re - expected.re)).toBeLessThanOrEqual(tol);
      expect(Math.abs(actual.complex!.im - expected.im)).toBeLessThanOrEqual(tol);
      break;
    case "expression":
      expect(actual.symbolic).toBe(expected.symbolic);
      break;
  }
}

describe("Coverage matrix (§10)", () => {
  for (const problem of MATRIX) {
    describe(`${problem.id} — ${problem.topic}`, () => {
      for (const exp of problem.expectations) {
        const question = problem.model.questions.find(q => q.label === exp.questionLabel);
        it(`(${exp.questionLabel}) ${question?.sourceText ?? ""}`, () => {
          expect(question, `question ${exp.questionLabel} missing from model`).toBeDefined();
          const result = solve(problem.model, question!);
          checkExpectation(result, exp.expected, exp.tolerance);
        });
      }
    });
  }

  describe("stubbed rows (awaiting model + solver)", () => {
    for (const id of TODO_ROWS) {
      it.todo(id);
    }
  });
});
