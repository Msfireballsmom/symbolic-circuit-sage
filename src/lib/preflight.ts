// Circuit Sage v2 — preflight. See spec §4.
// Nothing solves until preflight passes.
//
// Preflight is where "the app never guesses" is enforced. Every ambiguity
// resolves to certainty or surfaces as a question. Messages name the
// component and offer the fix — never generic.

import type { CircuitModel, Component } from "./circuit-model";

export type IssueSeverity = "blocking" | "warning";

export type IssueCode =
  // Blocking (§4)
  | "dangling-terminal"
  | "no-reference-node"
  | "unresolved-control"
  | "missing-unit"
  | "unit-mismatch"
  | "fusion-designator-missing-value"
  | "fusion-value-missing-designator"
  | "fusion-conflicting-values"
  | "fusion-unit-contradicts-symbol"
  | "transient-missing-initial"
  | "ambiguous-dot-convention"
  | "voltage-source-loop"
  | "current-source-cut-set"
  // Warning
  | "low-confidence-exists"
  | "low-confidence-value"
  | "implausible-value"
  | "orphan-component"
  | "value-not-corroborated";

export interface PreflightIssue {
  code: IssueCode;
  severity: IssueSeverity;
  /** Component ids or node ids the issue points at. */
  refs: string[];
  /** Plain, specific message. Never `Invalid circuit`. */
  message: string;
  /** Suggested fix, phrased as an offer. */
  fix?: string;
  /** Where on the source page this came from, when known. */
  region?: Component["provenance"]["region"];
}

export interface PreflightResult {
  blocking: PreflightIssue[];
  warnings: PreflightIssue[];
  ok: boolean; // true iff blocking.length === 0
}

const LOW_CONFIDENCE = 0.6;

const EXPECTED_UNIT: Partial<Record<Component["kind"], string>> = {
  resistor: "ohm",
  capacitor: "farad",
  inductor: "henry",
  vsource: "volt",
  isource: "amp",
};

/** Physically implausible values by kind — catches prefix misreads (§10). */
function implausible(c: Component): boolean {
  const m = Math.abs(c.value.magnitude);
  switch (c.kind) {
    case "capacitor": return m > 1;         // >1 F is almost always a mF/µF misread
    case "inductor":  return m > 100;       // >100 H is almost certainly wrong
    case "resistor":  return m > 1e10 || (m > 0 && m < 1e-3);
    default: return false;
  }
}

export function preflight(model: CircuitModel): PreflightResult {
  const blocking: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];

  const componentById = new Map(model.components.map(c => [c.id, c]));
  const nodeById = new Map(model.nodes.map(n => [n.id, n]));

  // --- reference node ---
  const groundNodes = model.nodes.filter(n => n.isGround);
  const refNode = model.meta.referenceNode;
  if (groundNodes.length > 1 || !nodeById.has(groundNodes[0]?.id ?? refNode)) {
    blocking.push({
      code: "no-reference-node",
      severity: "blocking",
      refs: [],
      message: "No reference node was identified. Every circuit needs a ground.",
      fix: "Pick a node to use as ground (usually the bottom rail).",
    });
  }

  // --- per-component checks ---
  for (const c of model.components) {
    if (model.components.filter(other => other.id === c.id).length !== 1 || c.terminals.includes('unresolved') || c.terminals.length !== 2 || Number.isNaN(c.value.magnitude) || (!Number.isFinite(c.value.magnitude) && !(c.kind === 'resistor' && c.value.magnitude === Infinity))) {
      blocking.push({ code: 'dangling-terminal', severity: 'blocking', refs: [c.id], message: `${c.id}: duplicate label, missing/invalid value, or unresolved connection.`, fix: 'Enter a unique label, value and both nodes.' });
    }
    // dangling terminals
    for (const t of c.terminals) {
      const node = nodeById.get(t);
      if (!node) {
        blocking.push({
          code: "dangling-terminal",
          severity: "blocking",
          refs: [c.id],
          message: `${c.id} has a terminal connected to nothing.`,
          fix: `Connect ${c.id} to an existing node, or add the missing node.`,
          region: c.provenance.region,
        });
        continue;
      }
      // orphan node (only this component participates)
      if (node.connects.length < 2 && !node.isGround) {
        warnings.push({
          code: "orphan-component",
          severity: "warning",
          refs: [c.id, node.id],
          message: `${c.id} sits on node ${node.id} but nothing else does — it participates in no loop.`,
          fix: `Check the drawing near ${c.id}; a wire may be missing.`,
          region: c.provenance.region,
        });
      }
    }

    // unit checks
    const expected = EXPECTED_UNIT[c.kind];
    if (!c.value.unit) {
      blocking.push({
        code: "missing-unit",
        severity: "blocking",
        refs: [c.id],
        message: `${c.id} has a value but no unit.`,
        fix: `Add the unit — expected ${expected ?? "an SI unit"}.`,
        region: c.provenance.region,
      });
    } else if (expected && c.value.unit !== expected) {
      blocking.push({
        code: "unit-mismatch",
        severity: "blocking",
        refs: [c.id],
        message: `${c.id} is a ${c.kind} but its value is in ${c.value.unit}, not ${expected}.`,
        fix: `Change ${c.id}'s value to ${expected}, or change the component kind.`,
        region: c.provenance.region,
      });
    }

    // dependent sources need a resolvable control ref
    const isDependent = c.kind === "vcvs" || c.kind === "vccs" || c.kind === "ccvs" || c.kind === "cccs";
    if (isDependent) {
      const ctl = c.control;
      const resolved =
        ctl &&
        ((ctl.type === "current-through" && ctl.through && componentById.has(ctl.through)) ||
          (ctl.type === "voltage-across" && ctl.across &&
            nodeById.has(ctl.across[0]) && nodeById.has(ctl.across[1])));
      if (!resolved) {
        blocking.push({
          code: "unresolved-control",
          severity: "blocking",
          refs: [c.id],
          message: `${c.id} is a dependent source but its controlling variable can't be resolved.`,
          fix: `Point ${c.id}'s control at an existing component or node pair.`,
          region: c.provenance.region,
        });
      }
    }

    // transient with reactive component missing initial + no switch history
    const isReactive = c.kind === "capacitor" || c.kind === "inductor";
    const wantsTransient = model.questions.some(q => q.kind === "transient");
    if (wantsTransient && isReactive && (c.initial == null)) {
      const anyHistory = model.components.some(x =>
        x.switching && (x.switching.closesAt != null || x.switching.opensAt != null)
      );
      if (!anyHistory) {
        blocking.push({
          code: "transient-missing-initial",
          severity: "blocking",
          refs: [c.id],
          message: `${c.id} needs an initial condition for transient analysis, and there's no switch history to derive one from.`,
          fix: `Add ${c.kind === "capacitor" ? "v(0)" : "i(0)"} for ${c.id}, or record when the switch closed/opened.`,
          region: c.provenance.region,
        });
      }
    }

    // confidence warnings
    if (c.confidence.exists < LOW_CONFIDENCE) {
      warnings.push({
        code: "low-confidence-exists",
        severity: "warning",
        refs: [c.id],
        message: `${c.id} was detected with low confidence — it may not actually be on the page.`,
        region: c.provenance.region,
      });
    }
    if (c.confidence.value < LOW_CONFIDENCE) {
      warnings.push({
        code: "low-confidence-value",
        severity: "warning",
        refs: [c.id],
        message: `${c.id}'s value was read with low confidence — please verify.`,
        region: c.provenance.region,
      });
    }
    if (implausible(c)) {
      warnings.push({
        code: "implausible-value",
        severity: "warning",
        refs: [c.id],
        message: `${c.id} = ${c.value.magnitude} ${c.value.unit} is outside the plausible range for a ${c.kind} — likely a prefix misread.`,
        fix: `Check the source; ${c.kind === "capacitor" ? "mF is often actually µF or nF" : "verify the prefix"}.`,
        region: c.provenance.region,
      });
    }
    if (c.provenance.from !== "both") {
      warnings.push({
        code: "value-not-corroborated",
        severity: "warning",
        refs: [c.id],
        message: `${c.id}'s value was found in the ${c.provenance.from} only, not corroborated by the other half.`,
        region: c.provenance.region,
      });
    }
  }

  // --- coupled inductor dot ambiguity ---
  for (const cp of model.couplings) {
    if (cp.dots == null || (cp.dots[0] !== 0 && cp.dots[0] !== 1) || (cp.dots[1] !== 0 && cp.dots[1] !== 1)) {
      blocking.push({
        code: "ambiguous-dot-convention",
        severity: "blocking",
        refs: cp.inductors,
        message: `Dot convention is ambiguous for coupled pair ${cp.inductors.join(" / ")}. The sign of the mutual term depends on it.`,
        fix: `Mark which terminal of each inductor carries the dot.`,
      });
    }
  }

  // --- voltage-source loop / current-source cut set (topology checks) ---
  // A pure v-source loop means two v-sources try to fix the same node pair to
  // different values. Detect the simplest case: two v-sources between the same
  // two nodes with different magnitudes.
  const vsources = model.components.filter(c => c.kind === "vsource");
  for (let i = 0; i < vsources.length; i++) {
    for (let j = i + 1; j < vsources.length; j++) {
      const a = vsources[i], b = vsources[j];
      const sameNodes =
        a.terminals.length === 2 && b.terminals.length === 2 &&
        ((a.terminals[0] === b.terminals[0] && a.terminals[1] === b.terminals[1]) ||
         (a.terminals[0] === b.terminals[1] && a.terminals[1] === b.terminals[0]));
      if (sameNodes && a.value.magnitude !== b.value.magnitude) {
        blocking.push({
          code: "voltage-source-loop",
          severity: "blocking",
          refs: [a.id, b.id],
          message: `${a.id} and ${b.id} form a voltage-source loop and disagree on the node voltage.`,
          fix: `Remove one, or add series impedance between them.`,
        });
      }
    }
  }

  // A pure current-source cut set: a node whose only incident components are
  // current sources whose currents don't sum to zero (KCL violation).
  for (const n of model.nodes) {
    if (n.isGround) continue;
    const incident = n.connects.map(id => componentById.get(id)).filter(Boolean) as Component[];
    if (incident.length === 0) continue;
    const allISources = incident.every(c => c.kind === "isource");
    if (!allISources) continue;
    const net = incident.reduce((sum, c) => {
      // Sign by which terminal touches this node.
      const idx = c.terminals.indexOf(n.id);
      const sign = idx === 0 ? 1 : -1;
      return sum + sign * c.value.magnitude;
    }, 0);
    if (Math.abs(net) > 1e-12) {
      blocking.push({
        code: "current-source-cut-set",
        severity: "blocking",
        refs: [n.id, ...incident.map(c => c.id)],
        message: `Node ${n.id} is fed only by current sources and they don't sum to zero.`,
        fix: `Adjust one of the source values or add a resistive path.`,
      });
    }
  }

  return { blocking, warnings, ok: blocking.length === 0 };
}
