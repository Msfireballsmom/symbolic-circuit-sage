// Preflight tests — one failing model per blocking rule, one passing model.
// See spec §4.

import { describe, it, expect } from "vitest";
import { preflight } from "@/lib/preflight";
import type { CircuitModel, Component, NodeRef } from "@/lib/circuit-model";

const NOW = "2026-07-24T00:00:00.000Z";

function baseModel(overrides: Partial<CircuitModel>): CircuitModel {
  return {
    components: [],
    nodes: [],
    ports: [],
    couplings: [],
    questions: [],
    source: { genre: "text-only", pages: 1, regions: [] },
    meta: { referenceNode: "gnd", readAt: NOW, genre: "text-only", revision: 1 },
    ...overrides,
  };
}

function c(partial: Partial<Component> & Pick<Component, "id" | "kind" | "terminals" | "value">): Component {
  return {
    tolerance: null, rating: null, tempco: null, initial: null,
    waveform: null, control: null, switching: null,
    confidence: { exists: 1, value: 1 },
    provenance: { from: "both" },
    ...partial,
  };
}

function n(id: string, connects: string[], isGround = false): NodeRef {
  return { id, connects, isGround };
}

describe("preflight (§4)", () => {
  it("passes a valid series RL divider", () => {
    const m = baseModel({
      components: [
        c({ id: "V1", kind: "vsource", terminals: ["a", "gnd"], value: { magnitude: 5, unit: "volt" } }),
        c({ id: "R1", kind: "resistor", terminals: ["a", "b"], value: { magnitude: 100, unit: "ohm" } }),
        c({ id: "R2", kind: "resistor", terminals: ["b", "gnd"], value: { magnitude: 200, unit: "ohm" } }),
      ],
      nodes: [
        n("a", ["V1", "R1"]),
        n("b", ["R1", "R2"]),
        n("gnd", ["V1", "R2"], true),
      ],
    });
    const r = preflight(m);
    expect(r.ok).toBe(true);
    expect(r.blocking).toHaveLength(0);
  });

  it("blocks on a dangling terminal", () => {
    const m = baseModel({
      components: [
        c({ id: "R1", kind: "resistor", terminals: ["a", "zzz"], value: { magnitude: 1, unit: "ohm" } }),
      ],
      nodes: [n("a", ["R1"]), n("gnd", [], true)],
    });
    const r = preflight(m);
    expect(r.ok).toBe(false);
    expect(r.blocking.some(b => b.code === "dangling-terminal")).toBe(true);
  });

  it("blocks on unit mismatch (capacitor with volts)", () => {
    const m = baseModel({
      components: [
        c({ id: "C1", kind: "capacitor", terminals: ["a", "gnd"], value: { magnitude: 10, unit: "volt" } }),
      ],
      nodes: [n("a", ["C1"]), n("gnd", ["C1"], true)],
    });
    const r = preflight(m);
    expect(r.blocking.some(b => b.code === "unit-mismatch" && b.refs.includes("C1"))).toBe(true);
  });

  it("blocks on unresolved dependent-source control", () => {
    const m = baseModel({
      components: [
        c({
          id: "E1", kind: "vcvs", terminals: ["a", "gnd"],
          value: { magnitude: 0, unit: "unitless" },
          control: { type: "current-through", through: "does-not-exist", gain: 2 },
        }),
      ],
      nodes: [n("a", ["E1"]), n("gnd", ["E1"], true)],
    });
    const r = preflight(m);
    expect(r.blocking.some(b => b.code === "unresolved-control")).toBe(true);
  });

  it("blocks transient with reactive component missing initial and no switch history", () => {
    const m = baseModel({
      components: [
        c({ id: "R1", kind: "resistor", terminals: ["a", "gnd"], value: { magnitude: 1000, unit: "ohm" } }),
        c({ id: "C1", kind: "capacitor", terminals: ["a", "gnd"], value: { magnitude: 1e-6, unit: "farad" } }),
      ],
      nodes: [n("a", ["R1", "C1"]), n("gnd", ["R1", "C1"], true)],
      questions: [{
        label: "a", kind: "transient",
        target: { type: "node", ref: "a" }, at: 0.001,
        deliverable: "number", sourceText: "Find v(1ms).",
      }],
    });
    const r = preflight(m);
    expect(r.blocking.some(b => b.code === "transient-missing-initial")).toBe(true);
  });

  it("blocks ambiguous dot convention on coupled inductors", () => {
    const m = baseModel({
      components: [
        c({ id: "L1", kind: "inductor", terminals: ["a", "gnd"], value: { magnitude: 1e-3, unit: "henry" } }),
        c({ id: "L2", kind: "inductor", terminals: ["b", "gnd"], value: { magnitude: 1e-3, unit: "henry" } }),
      ],
      nodes: [n("a", ["L1"]), n("b", ["L2"]), n("gnd", ["L1", "L2"], true)],
      couplings: [{ inductors: ["L1", "L2"], k: 0.9, dots: [undefined as any, undefined as any] }],
    });
    const r = preflight(m);
    expect(r.blocking.some(b => b.code === "ambiguous-dot-convention")).toBe(true);
  });

  it("blocks a voltage-source loop with disagreeing sources", () => {
    const m = baseModel({
      components: [
        c({ id: "V1", kind: "vsource", terminals: ["a", "gnd"], value: { magnitude: 5, unit: "volt" } }),
        c({ id: "V2", kind: "vsource", terminals: ["a", "gnd"], value: { magnitude: 7, unit: "volt" } }),
      ],
      nodes: [n("a", ["V1", "V2"]), n("gnd", ["V1", "V2"], true)],
    });
    const r = preflight(m);
    expect(r.blocking.some(b => b.code === "voltage-source-loop")).toBe(true);
  });

  it("warns on implausible capacitor value (mF/µF misread)", () => {
    const m = baseModel({
      components: [
        c({ id: "R1", kind: "resistor", terminals: ["a", "gnd"], value: { magnitude: 1000, unit: "ohm" } }),
        c({ id: "C1", kind: "capacitor", terminals: ["a", "gnd"], value: { magnitude: 4.7, unit: "farad" } }),
      ],
      nodes: [n("a", ["R1", "C1"]), n("gnd", ["R1", "C1"], true)],
    });
    const r = preflight(m);
    expect(r.warnings.some(w => w.code === "implausible-value" && w.refs.includes("C1"))).toBe(true);
  });
});
