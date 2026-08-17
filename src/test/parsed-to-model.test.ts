import { describe, it, expect } from "vitest";
import { parseProblem } from "@/lib/problem-parser";
import { buildCircuitModel } from "@/lib/parsed-to-model";
import { preflight } from "@/lib/preflight";
import { solveQuestion } from "@/lib/model-solver";
import type { ParsedProblem } from "@/lib/problem-parser";

const netlist = (overrides: Partial<ParsedProblem> = {}): ParsedProblem => ({
  components: [
    { type: "voltage_source", label: "V1", value: 10, nodeA: 1, nodeB: 0 },
    { type: "resistor", label: "R1", value: 3000, nodeA: 1, nodeB: 2 },
    { type: "resistor", label: "R2", value: 7000, nodeA: 2, nodeB: 0 },
  ],
  method: "dc_nodal",
  findWhat: ["all"],
  rawText: "confirmed by the student",
  confidence: 1,
  warnings: [],
  ...overrides,
});

describe("confirmed netlist → CircuitModel", () => {
  it("passes preflight and solves node voltages", () => {
    const { model, unsupported } = buildCircuitModel(netlist());
    expect(unsupported).toEqual([]);
    expect(preflight(model).ok).toBe(true);

    const vAtN2 = model.questions.find(
      (q) => q.kind === "solve" && q.target.type === "node" && q.target.ref === "n2",
    )!;
    expect(solveQuestion(model, vAtN2).numeric).toBeCloseTo(7, 9);

    const iThroughR1 = model.questions.find(
      (q) => q.target.type === "component" && q.target.ref === "R1",
    )!;
    expect(solveQuestion(model, iThroughR1).numeric).toBeCloseTo(1e-3, 12);
  });

  it("reports components the verified engine cannot stamp", () => {
    const { unsupported } = buildCircuitModel(
      netlist({
        components: [
          ...netlist().components,
          { type: "bjt", label: "Q1", value: 0, nodeA: 2, nodeB: 0 },
        ],
      }),
    );
    expect(unsupported).toEqual([{ id: "Q1", kind: "bjt" }]);
  });

  it("carries a capacitor initial condition into the model", () => {
    const { model } = buildCircuitModel(
      netlist({
        method: "transient",
        initialVoltage: 10,
        components: [
          { type: "resistor", label: "R1", value: 1000, nodeA: 1, nodeB: 0 },
          { type: "capacitor", label: "C1", value: 1e-3, nodeA: 1, nodeB: 0 },
        ],
      }),
    );
    expect(model.components.find((c) => c.id === "C1")?.initial?.magnitude).toBe(10);
    expect(solveQuestion(model, model.questions[0]).numeric).toBeCloseTo(0, 9);
  });

  it("builds a solvable model straight from parsed text", () => {
    const parsed = parseProblem(
      "Use nodal analysis. 12V source between node 1 and ground, R1 = 1kΩ between node 1 and node 2, R2 = 2kΩ between node 2 and ground",
    );
    const { model } = buildCircuitModel(parsed);
    expect(model.components.length).toBeGreaterThan(0);
  });
});
