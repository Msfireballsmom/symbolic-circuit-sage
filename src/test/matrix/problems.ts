// Seed rows. Each row is a real problem from the coverage list in §10.
// Additional rows will be added incrementally as milestones land.
//
// These models are hand-built (not extracted), so provenance.from is "text"
// and confidence is 1.0 across the board — they represent the ground-truth
// model that extraction is supposed to produce.

import type { CircuitModel, Component, NodeRef } from "@/lib/circuit-model";
import type { MatrixProblem } from "./types";

const NOW = "2026-07-24T00:00:00.000Z";

function q(magnitude: number, unit: Component["value"]["unit"]) {
  return { magnitude, unit } as const;
}

function baseSource(genre: CircuitModel["source"]["genre"] = "text-only") {
  return {
    genre,
    pages: 1,
    regions: [],
  } as CircuitModel["source"];
}

function baseMeta(referenceNode: string): CircuitModel["meta"] {
  return { referenceNode, readAt: NOW, genre: "text-only", revision: 1 };
}

function makeNode(id: string, connects: string[], isGround = false): NodeRef {
  return { id, connects, isGround };
}

function makeComponent(partial: Partial<Component> & Pick<Component, "id" | "kind" | "terminals" | "value">): Component {
  return {
    tolerance: null,
    rating: null,
    tempco: null,
    initial: null,
    waveform: null,
    control: null,
    switching: null,
    confidence: { exists: 1, value: 1 },
    provenance: { from: "text" },
    ...partial,
  };
}

// --- Row 1: series resistance, Ohm's law -----------------------------------
// 12 V across R1=4Ω and R2=8Ω in series. Find I and V_R2.
const seriesResistors: MatrixProblem = (() => {
  const V1 = makeComponent({ id: "V1", kind: "vsource", terminals: ["n1", "gnd"], value: q(12, "volt") });
  const R1 = makeComponent({ id: "R1", kind: "resistor", terminals: ["n1", "n2"], value: q(4, "ohm") });
  const R2 = makeComponent({ id: "R2", kind: "resistor", terminals: ["n2", "gnd"], value: q(8, "ohm") });
  const model: CircuitModel = {
    components: [V1, R1, R2],
    nodes: [
      makeNode("n1", ["V1", "R1"]),
      makeNode("n2", ["R1", "R2"]),
      makeNode("gnd", ["V1", "R2"], true),
    ],
    ports: [],
    couplings: [],
    questions: [
      { label: "a", kind: "solve", target: { type: "component", ref: "R2" }, deliverable: "number", sourceText: "Find the current through the circuit." },
      { label: "b", kind: "solve", target: { type: "node", ref: "n2" }, deliverable: "number", sourceText: "Find V_R2." },
    ],
    source: baseSource(),
    meta: baseMeta("gnd"),
  };
  return {
    id: "core-1-series-ohms",
    topic: "Series reduction + Ohm's law",
    course: "core-1",
    source: "Fundamentals — Ch. 2",
    model,
    expectations: [
      { questionLabel: "a", expected: { kind: "number", value: 1 }, tolerance: 1e-6 },        // 12 / 12 = 1 A
      { questionLabel: "b", expected: { kind: "number", value: 8 }, tolerance: 1e-6 },        // 1 A · 8 Ω = 8 V
    ],
  };
})();

// --- Row 2: voltage divider ------------------------------------------------
// Vin=10V, R1=3kΩ, R2=7kΩ (series). Vout across R2 = 7 V.
const voltageDivider: MatrixProblem = (() => {
  const Vin = makeComponent({ id: "V1", kind: "vsource", terminals: ["n1", "gnd"], value: q(10, "volt") });
  const R1  = makeComponent({ id: "R1", kind: "resistor", terminals: ["n1", "n2"], value: q(3000, "ohm") });
  const R2  = makeComponent({ id: "R2", kind: "resistor", terminals: ["n2", "gnd"], value: q(7000, "ohm") });
  const model: CircuitModel = {
    components: [Vin, R1, R2],
    nodes: [
      makeNode("n1", ["V1", "R1"]),
      makeNode("n2", ["R1", "R2"]),
      makeNode("gnd", ["V1", "R2"], true),
    ],
    ports: [{ id: "out", node: "n2", label: "out" }],
    couplings: [],
    questions: [
      { label: "a", kind: "solve", target: { type: "port", ref: "out" }, deliverable: "number", sourceText: "Find V_out." },
    ],
    source: baseSource(),
    meta: baseMeta("gnd"),
  };
  return {
    id: "core-1-voltage-divider",
    topic: "Voltage divider",
    course: "core-1",
    source: "Fundamentals — Ch. 3",
    model,
    expectations: [{ questionLabel: "a", expected: { kind: "number", value: 7 }, tolerance: 1e-6 }],
  };
})();

// --- Row 3: parallel resistance --------------------------------------------
// R1=6Ω || R2=3Ω = 2Ω. Current source 3A into parallel combo. V_across = 6V.
const parallelResistors: MatrixProblem = (() => {
  const I1 = makeComponent({ id: "I1", kind: "isource", terminals: ["n1", "gnd"], value: q(3, "amp") });
  const R1 = makeComponent({ id: "R1", kind: "resistor", terminals: ["n1", "gnd"], value: q(6, "ohm") });
  const R2 = makeComponent({ id: "R2", kind: "resistor", terminals: ["n1", "gnd"], value: q(3, "ohm") });
  const model: CircuitModel = {
    components: [I1, R1, R2],
    nodes: [
      makeNode("n1", ["I1", "R1", "R2"]),
      makeNode("gnd", ["I1", "R1", "R2"], true),
    ],
    ports: [],
    couplings: [],
    questions: [
      { label: "a", kind: "solve", target: { type: "node", ref: "n1" }, deliverable: "number", sourceText: "Find V at n1." },
    ],
    source: baseSource(),
    meta: baseMeta("gnd"),
  };
  return {
    id: "core-1-parallel",
    topic: "Parallel resistance",
    course: "core-1",
    source: "Fundamentals — Ch. 3",
    model,
    expectations: [{ questionLabel: "a", expected: { kind: "number", value: 6 }, tolerance: 1e-6 }],
  };
})();

// --- Row 4: Thévenin equivalent --------------------------------------------
// Same voltage divider as row 2. V_th = 7V, R_th = R1||R2 = 2.1kΩ.
const thevenin: MatrixProblem = (() => {
  const m = structuredClone(voltageDivider.model);
  m.questions = [
    { label: "a", kind: "thevenin", target: { type: "port", ref: "out" }, deliverable: "circuit", sourceText: "Find the Thévenin equivalent at the output terminals." },
  ];
  return {
    id: "core-1-thevenin",
    topic: "Thévenin equivalent",
    course: "core-1",
    source: "Fundamentals — Ch. 4",
    model: m,
    // Expectation representation is deliberately loose — the solver will
    // return {vth, rth}. We assert V_th here; R_th checked once solver lands.
    expectations: [{ questionLabel: "a", expected: { kind: "number", value: 7 }, tolerance: 1e-6 }],
  };
})();

// --- Row 5: first-order RC natural response --------------------------------
// C=1mF pre-charged to 10V, discharges through R=1kΩ. τ=1s, v(t)=10 e^{-t}.
const rcNatural: MatrixProblem = (() => {
  const R = makeComponent({ id: "R1", kind: "resistor", terminals: ["n1", "gnd"], value: q(1000, "ohm") });
  const C = makeComponent({
    id: "C1", kind: "capacitor", terminals: ["n1", "gnd"],
    value: q(1e-3, "farad"),
    initial: q(10, "volt"),
  });
  const model: CircuitModel = {
    components: [R, C],
    nodes: [
      makeNode("n1", ["R1", "C1"]),
      makeNode("gnd", ["R1", "C1"], true),
    ],
    ports: [],
    couplings: [],
    questions: [
      { label: "a", kind: "transient", target: { type: "node", ref: "n1" }, at: 1, deliverable: "number", sourceText: "Find v(1s)." },
      { label: "b", kind: "transient", target: { type: "node", ref: "n1" }, at: "inf", deliverable: "number", sourceText: "Find v(∞)." },
    ],
    source: baseSource(),
    meta: baseMeta("gnd"),
  };
  return {
    id: "core-1-rc-natural",
    topic: "First-order RC natural response",
    course: "core-1",
    source: "Fundamentals — Ch. 7",
    model,
    expectations: [
      { questionLabel: "a", expected: { kind: "number", value: 10 * Math.exp(-1) }, tolerance: 1e-6 },
      { questionLabel: "b", expected: { kind: "number", value: 0 }, tolerance: 1e-9 },
    ],
  };
})();

// Stubbed rows. Each expands as its solver lands. `it.todo` in the runner.
export const TODO_ROWS = [
  "core-1-nodal-basic",
  "core-1-nodal-supernode",
  "core-1-mesh-basic",
  "core-1-mesh-supermesh",
  "core-1-superposition",
  "core-1-norton",
  "core-1-max-power",
  "core-1-opamp-inverting",
  "core-1-rl-step",
  "core-1-rlc-overdamped",
  "core-1-rlc-critical",
  "core-1-rlc-underdamped",
  "core-2-phasor-ss",
  "core-2-ac-power",
  "core-2-three-phase",
  "core-2-laplace-transfer-function",
  "core-2-bode",
  "core-2-fourier-series",
];

export const MATRIX: MatrixProblem[] = [
  seriesResistors,
  voltageDivider,
  parallelResistors,
  thevenin,
  rcNatural,
];
