// Circuit Sage v2 test matrix — see spec §10.
// The matrix is built FIRST. The model is done when the rows go green.

import type { CircuitModel, Quantity } from "@/lib/circuit-model";

export type ExpectedValue =
  | { kind: "quantity"; value: Quantity }
  | { kind: "number"; value: number }
  | { kind: "complex"; re: number; im: number }
  | { kind: "expression"; symbolic: string };

export interface MatrixExpectation {
  /** Which question label from the model this expectation belongs to. */
  questionLabel: string;
  expected: ExpectedValue;
  /** Relative tolerance (fraction, e.g. 0.001 = 0.1%). */
  tolerance: number;
}

export interface MatrixProblem {
  id: string;                     // e.g. "core-1-nodal-supernode"
  topic: string;                  // e.g. "Nodal analysis with supernode"
  course: "core-1" | "core-2" | "professional";
  source: string;                 // citation / textbook attribution
  model: CircuitModel;
  expectations: MatrixExpectation[];
}
