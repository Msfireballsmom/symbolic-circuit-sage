import { describe, it, expect } from "vitest";
import type { CircuitModel } from "@/lib/circuit-model";
import {
  solveDCOperatingPoint,
  powerBalance,
  theveninAt,
  solveQuestion,
  UnsupportedProblemError,
} from "@/lib/model-solver";

const q = (magnitude: number, unit: any) => ({ magnitude, unit });
const comp = (id: string, kind: any, terminals: string[], value: any, extra: any = {}) => ({
  id, kind, terminals, value,
  confidence: { exists: 1, value: 1 },
  provenance: { from: "text" as const },
  ...extra,
});

/** 10 V across 3 kΩ + 7 kΩ, output tapped at the midpoint. */
function divider(): CircuitModel {
  return {
    components: [
      comp("V1", "vsource", ["n1", "gnd"], q(10, "volt")),
      comp("R1", "resistor", ["n1", "n2"], q(3000, "ohm")),
      comp("R2", "resistor", ["n2", "gnd"], q(7000, "ohm")),
    ] as any,
    nodes: [
      { id: "n1", connects: ["V1", "R1"] },
      { id: "n2", connects: ["R1", "R2"] },
      { id: "gnd", connects: ["V1", "R2"], isGround: true },
    ],
    ports: [{ id: "out", node: "n2", label: "out" }],
    couplings: [],
    questions: [],
    source: { genre: "text-only", pages: 1, regions: [] },
    meta: { referenceNode: "gnd", readAt: new Date().toISOString(), genre: "text-only", revision: 1 },
  };
}

describe("canonical model solver", () => {
  it("solves node voltages and branch currents", () => {
    const dc = solveDCOperatingPoint(divider());
    expect(dc.nodeVoltages.n1).toBeCloseTo(10, 9);
    expect(dc.nodeVoltages.n2).toBeCloseTo(7, 9);
    expect(dc.branchCurrents.R1).toBeCloseTo(1e-3, 12);
  });

  it("balances power for a voltage-source circuit", () => {
    const m = divider();
    const b = powerBalance(m, solveDCOperatingPoint(m));
    expect(b.dissipated).toBeCloseTo(0.01, 9);
    expect(Math.abs(b.residual)).toBeLessThan(1e-9);
  });

  it("balances power for a current-source circuit", () => {
    const m: CircuitModel = {
      ...divider(),
      components: [
        comp("I1", "isource", ["n1", "gnd"], q(3, "amp")),
        comp("R1", "resistor", ["n1", "gnd"], q(6, "ohm")),
        comp("R2", "resistor", ["n1", "gnd"], q(3, "ohm")),
      ] as any,
      nodes: [
        { id: "n1", connects: ["I1", "R1", "R2"] },
        { id: "gnd", connects: ["I1", "R1", "R2"], isGround: true },
      ],
      ports: [],
    };
    const dc = solveDCOperatingPoint(m);
    expect(dc.nodeVoltages.n1).toBeCloseTo(6, 9);
    const b = powerBalance(m, dc);
    expect(b.delivered).toBeCloseTo(18, 9);
    expect(Math.abs(b.residual)).toBeLessThan(1e-9);
  });

  it("computes Thévenin and Norton equivalents", () => {
    const th = theveninAt(divider(), "n2");
    expect(th.vth).toBeCloseTo(7, 9);
    expect(th.rth).toBeCloseTo(2100, 6);
    expect(th.inorton).toBeCloseTo(7 / 2100, 12);
  });

  it("computes maximum power transfer", () => {
    const m = divider();
    m.questions = [{
      label: "a", kind: "maxpower",
      target: { type: "port", ref: "out" },
      deliverable: "number", sourceText: "Max power to the load?",
    }];
    const r = solveQuestion(m, m.questions[0]);
    expect(r.numeric).toBeCloseTo((7 * 7) / (4 * 2100), 12);
    expect(r.extras?.rload).toBeCloseTo(2100, 6);
  });

  it("solves an RL step response", () => {
    const m: CircuitModel = {
      ...divider(),
      components: [
        comp("V1", "vsource", ["n1", "gnd"], q(10, "volt")),
        comp("R1", "resistor", ["n1", "n2"], q(100, "ohm")),
        comp("L1", "inductor", ["n2", "gnd"], q(0.1, "henry"), { initial: q(0, "amp") }),
      ] as any,
      nodes: [
        { id: "n1", connects: ["V1", "R1"] },
        { id: "n2", connects: ["R1", "L1"] },
        { id: "gnd", connects: ["V1", "L1"], isGround: true },
      ],
      ports: [],
      questions: [{
        label: "a", kind: "transient",
        target: { type: "node", ref: "n2" }, at: 0.001,
        deliverable: "number", sourceText: "Find the response at 1 ms.",
      }],
    };
    const r = solveQuestion(m, m.questions[0]);
    // τ = L/R = 1 ms; v(n2) jumps to 10 V at 0⁺ (i_L = 0) and decays to 0.
    expect(r.extras?.tau).toBeCloseTo(1e-3, 12);
    expect(r.numeric).toBeCloseTo(10 * Math.exp(-1), 9);
  });

  it("refuses unsupported analyses instead of inventing an answer", () => {
    const m = divider();
    const question = {
      label: "a", kind: "fourier-series" as const,
      target: { type: "node" as const, ref: "n2" },
      deliverable: "number" as const, sourceText: "Fourier series?",
    };
    expect(() => solveQuestion(m, question)).toThrow(UnsupportedProblemError);
  });

  it("refuses a model with no ground", () => {
    const m = divider();
    m.nodes = m.nodes.map((n) => ({ ...n, isGround: false }));
    m.meta.referenceNode = "";
    expect(() => solveDCOperatingPoint(m)).toThrow(/reference node/i);
  });
});
