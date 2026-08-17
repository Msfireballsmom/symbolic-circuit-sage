// Bridge: the confirmed netlist (what the student sees and edits) → CircuitModel.
//
// Nothing here guesses. Component kinds the canonical solver does not model are
// reported back so the UI can say plainly which analyses stay unsupported,
// instead of quietly dropping parts and producing a confident wrong answer.

import type {
  AnalysisKind, AnalysisRequest, CircuitModel, Component, ComponentKind, NodeRef, Unit,
} from "@/lib/circuit-model";
import type { ParsedComponent, ParsedProblem } from "@/lib/problem-parser";

const KIND_MAP: Record<string, ComponentKind> = {
  resistor: "resistor",
  capacitor: "capacitor",
  inductor: "inductor",
  voltage_source: "vsource",
  current_source: "isource",
  opamp: "opamp",
  transformer: "transformer",
  switch: "switch",
  dependent_voltage_source: "vcvs",
  dependent_current_source: "vccs",
};

/** Kinds the canonical DC/transient engine can stamp today. */
export const SUPPORTED_KINDS: ComponentKind[] = [
  "resistor", "capacitor", "inductor", "vsource", "isource", "ground",
];

const UNIT_BY_KIND: Partial<Record<ComponentKind, Unit>> = {
  resistor: "ohm",
  capacitor: "farad",
  inductor: "henry",
  vsource: "volt",
  isource: "amp",
};

export interface ModelBuild {
  model: CircuitModel;
  /** Components whose kind the canonical engine cannot stamp. */
  unsupported: { id: string; kind: string }[];
}

function nodeName(n: number | undefined): string {
  const v = n ?? 0;
  return v === 0 ? "gnd" : `n${v}`;
}

/** Which canonical analysis each parsed method maps to, when one exists. */
export function analysisKindFor(method: ParsedProblem["method"]): AnalysisKind | null {
  switch (method) {
    case "dc_nodal":
    case "voltage_divider":
    case "current_divider":
    case "series_parallel":
    case "ohms_law":
      return "solve";
    case "power":
      return "power";
    case "thevenin":
      return "thevenin";
    case "transient":
      return "transient";
    default:
      return null;
  }
}

export function buildCircuitModel(parsed: ParsedProblem): ModelBuild {
  const unsupported: { id: string; kind: string }[] = [];
  const components: Component[] = [];
  const connects = new Map<string, string[]>();

  parsed.components.forEach((pc: ParsedComponent, i) => {
    const kind = KIND_MAP[pc.type];
    const id = pc.label?.trim() || `${pc.type[0].toUpperCase()}${i + 1}`;
    if (!kind || !SUPPORTED_KINDS.includes(kind)) {
      unsupported.push({ id, kind: pc.type });
      return;
    }
    const a = nodeName(pc.nodeA);
    const b = nodeName(pc.nodeB);
    for (const n of [a, b]) connects.set(n, [...(connects.get(n) ?? []), id]);

    const initial =
      kind === "capacitor" && parsed.initialVoltage !== undefined
        ? { magnitude: parsed.initialVoltage, unit: "volt" as Unit }
        : kind === "inductor" && parsed.initialCurrent !== undefined
          ? { magnitude: parsed.initialCurrent, unit: "amp" as Unit }
          : null;

    components.push({
      id,
      kind,
      terminals: [a, b],
      value: { magnitude: pc.value, unit: UNIT_BY_KIND[kind] ?? "unitless" },
      initial,
      confidence: { exists: parsed.confidence, value: parsed.confidence },
      provenance: { from: parsed.rawText ? "text" : "drawing" },
    });
  });

  if (!connects.has("gnd")) connects.set("gnd", []);

  const nodes: NodeRef[] = [...connects.entries()].map(([id, c]) => ({
    id,
    connects: c,
    isGround: id === "gnd",
  }));

  const model: CircuitModel = {
    components,
    nodes,
    ports: [],
    couplings: [],
    questions: buildQuestions(parsed, components),
    source: {
      genre: parsed.rawText ? "text-only" : "textbook-photo",
      pages: 1,
      regions: [],
      prose: parsed.rawText,
    },
    meta: {
      referenceNode: "gnd",
      readAt: new Date().toISOString(),
      genre: parsed.rawText ? "text-only" : "textbook-photo",
      revision: 1,
    },
  };

  return { model, unsupported };
}

/**
 * Turn the confirmed netlist into questions. One question per non-ground node
 * voltage, one per resistor current, plus the analysis the problem named.
 */
function buildQuestions(parsed: ParsedProblem, components: Component[]): AnalysisRequest[] {
  const kind = analysisKindFor(parsed.method);
  const nodes = [...new Set(components.flatMap((c) => c.terminals))].filter((n) => n !== "gnd");
  const questions: AnalysisRequest[] = [];
  let label = 97; // 'a'

  if (kind === "transient") {
    const target = nodes[0];
    if (target) {
      questions.push({
        label: String.fromCharCode(label++),
        kind: "transient",
        target: { type: "node", ref: target },
        at: "inf",
        deliverable: "number",
        sourceText: `Find the steady-state value at ${target}.`,
      });
    }
    return questions;
  }

  if (kind === "thevenin" && nodes[0]) {
    questions.push({
      label: String.fromCharCode(label++),
      kind: "thevenin",
      target: { type: "node", ref: nodes[0] },
      deliverable: "circuit",
      sourceText: `Find the Thévenin equivalent at ${nodes[0]}.`,
    });
  }

  for (const n of nodes) {
    questions.push({
      label: String.fromCharCode(label++),
      kind: "solve",
      target: { type: "node", ref: n },
      deliverable: "number",
      sourceText: `Find the voltage at node ${n}.`,
    });
  }
  for (const c of components.filter((x) => x.kind === "resistor")) {
    questions.push({
      label: String.fromCharCode(label++),
      kind: "solve",
      target: { type: "component", ref: c.id },
      deliverable: "number",
      sourceText: `Find the current through ${c.id}.`,
    });
  }
  return questions;
}
