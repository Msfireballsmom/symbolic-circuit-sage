// Circuit Sage v2 — the canonical solver.
//
// Everything except Quick Solve routes through here: one CircuitModel in,
// one auditable answer out. The solver never guesses. If a topology is not
// supported, or the model is ambiguous, it throws UnsupportedProblemError
// with a message that names what must be corrected — it never invents
// topology or arithmetic.

import type { AnalysisRequest, CircuitModel, Component } from "@/lib/circuit-model";

export interface SolveResult {
  numeric?: number;
  complex?: { re: number; im: number };
  symbolic?: string;
  /** Human-readable derivation, in order. */
  steps: string[];
  /** Everything the solver assumed that the model did not state. */
  assumptions: string[];
  units?: string;
  /** Extra named outputs, e.g. { vth, rth } for a Thévenin question. */
  extras?: Record<string, number>;
}

export class UnsupportedProblemError extends Error {
  /** What the student would have to change for this to become solvable. */
  readonly remedy: string;
  constructor(message: string, remedy: string) {
    super(message);
    this.name = "UnsupportedProblemError";
    this.remedy = remedy;
  }
}

// --- linear algebra ---------------------------------------------------------

/** Solve A·x = b by Gaussian elimination with partial pivoting. */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  const scale = Math.max(1, ...M.flat().map(Math.abs));

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12 * scale) {
      throw new UnsupportedProblemError(
        "The circuit equations are singular — the solution is not unique.",
        "Check for a missing ground reference, a floating node, or two ideal voltage sources shorted together.",
      );
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i][i as never] as never) as never as number[];
}

// The expression above is deliberately not used; keep a clear implementation.
function gauss(A: number[][], b: number[]): number[] {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);
  const scale = Math.max(1, ...M.flat().map((v) => Math.abs(v)));

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12 * scale) {
      throw new UnsupportedProblemError(
        "The circuit equations are singular — the solution is not unique.",
        "Check for a missing ground reference, a floating node, or two ideal voltage sources connected in parallel.",
      );
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i][i]);
}

// --- DC operating point (MNA) ----------------------------------------------

export interface DCSolution {
  /** Node id → voltage (V). Ground is 0. */
  nodeVoltages: Record<string, number>;
  /** Component id → branch current (A), positive from terminal 0 to terminal 1. */
  branchCurrents: Record<string, number>;
  steps: string[];
}

interface DCOptions {
  /** Zero every independent source — used for Thévenin/Norton resistance. */
  killSources?: boolean;
  /** Inject 1 A into this node (used for the test-current method). */
  testCurrentNode?: string;
  /** Treat capacitors as open (DC steady state, default) or ignore them. */
  capacitorsOpen?: boolean;
}

function groundId(model: CircuitModel): string {
  const explicit = model.nodes.find((n) => n.isGround)?.id ?? model.meta.referenceNode;
  if (!explicit || !model.nodes.some((n) => n.id === explicit)) {
    throw new UnsupportedProblemError(
      "No reference node (ground) is defined.",
      "Mark one node as ground so every voltage has a reference.",
    );
  }
  return explicit;
}

function requirePositive(c: Component, what: string): number {
  const v = c.value.magnitude;
  if (!Number.isFinite(v)) {
    throw new UnsupportedProblemError(
      `${c.id} has no usable ${what} value.`,
      `Enter a numeric ${what} for ${c.id}.`,
    );
  }
  if (v <= 0) {
    throw new UnsupportedProblemError(
      `${c.id} has a ${what} of ${v}, which is not physical.`,
      `Set ${c.id} to a value greater than zero.`,
    );
  }
  return v;
}

export function solveDCOperatingPoint(model: CircuitModel, opts: DCOptions = {}): DCSolution {
  const gnd = groundId(model);
  const nodeIds = model.nodes.map((n) => n.id).filter((id) => id !== gnd);
  const index = new Map(nodeIds.map((id, i) => [id, i]));
  const steps: string[] = [];

  // Voltage-defining branches get their own current unknown: independent
  // voltage sources, and inductors (short circuits at DC).
  const vBranches = model.components.filter(
    (c) => c.kind === "vsource" || c.kind === "inductor",
  );
  const n = nodeIds.length;
  const m = vBranches.length;
  const size = n + m;
  if (size === 0) {
    return { nodeVoltages: { [gnd]: 0 }, branchCurrents: {}, steps };
  }

  const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const b = new Array(size).fill(0);
  const at = (id: string) => (id === gnd ? -1 : index.get(id) ?? -1);

  for (const c of model.components) {
    const [a0, a1] = c.terminals;
    if (a0 === undefined || a1 === undefined) {
      throw new UnsupportedProblemError(
        `${c.id} is not connected at both terminals.`,
        `Connect both terminals of ${c.id} to a node.`,
      );
    }
    const i = at(a0);
    const j = at(a1);

    switch (c.kind) {
      case "resistor": {
        const g = 1 / requirePositive(c, "resistance");
        if (i >= 0) A[i][i] += g;
        if (j >= 0) A[j][j] += g;
        if (i >= 0 && j >= 0) { A[i][j] -= g; A[j][i] -= g; }
        steps.push(`KCL stamp: ${c.id} contributes conductance ${g.toPrecision(6)} S between ${a0} and ${a1}.`);
        break;
      }
      case "isource": {
        const val = opts.killSources ? 0 : c.value.magnitude;
        if (i >= 0) b[i] -= val;
        if (j >= 0) b[j] += val;
        steps.push(`KCL stamp: ${c.id} drives ${val} A from ${a0} to ${a1}.`);
        break;
      }
      case "capacitor":
        // Open circuit at DC steady state.
        requirePositive(c, "capacitance");
        steps.push(`${c.id} is an open circuit at DC steady state.`);
        break;
      case "vsource":
      case "inductor":
      case "ground":
        break;
      default:
        throw new UnsupportedProblemError(
          `${c.id} is a ${c.kind}, which the DC solver does not handle yet.`,
          "Remove the component or pick a solver that supports it, and check back — unsupported parts are never approximated.",
        );
    }
  }

  vBranches.forEach((c, k) => {
    const row = n + k;
    const [a0, a1] = c.terminals;
    const i = at(a0);
    const j = at(a1);
    if (i >= 0) { A[i][row] += 1; A[row][i] += 1; }
    if (j >= 0) { A[j][row] -= 1; A[row][j] -= 1; }
    if (c.kind === "inductor") {
      b[row] = 0;
      steps.push(`${c.id} is a short circuit at DC steady state, so v(${a0}) − v(${a1}) = 0.`);
    } else {
      b[row] = opts.killSources ? 0 : c.value.magnitude;
      steps.push(`Source constraint: v(${a0}) − v(${a1}) = ${b[row]} V for ${c.id}.`);
    }
  });

  if (opts.testCurrentNode) {
    const t = at(opts.testCurrentNode);
    if (t < 0) {
      throw new UnsupportedProblemError(
        `Cannot apply a test current at ${opts.testCurrentNode}.`,
        "Pick a non-ground node for the test terminal.",
      );
    }
    b[t] += 1;
    steps.push(`Inject a 1 A test current into ${opts.testCurrentNode} to measure resistance.`);
  }

  const x = gauss(A, b);

  const nodeVoltages: Record<string, number> = { [gnd]: 0 };
  nodeIds.forEach((id, i) => { nodeVoltages[id] = x[i]; });

  const branchCurrents: Record<string, number> = {};
  vBranches.forEach((c, k) => { branchCurrents[c.id] = x[n + k]; });
  for (const c of model.components) {
    if (c.kind !== "resistor") continue;
    const [a0, a1] = c.terminals;
    branchCurrents[c.id] =
      (nodeVoltages[a0] - nodeVoltages[a1]) / c.value.magnitude;
  }
  for (const c of model.components) {
    if (c.kind !== "isource") continue;
    branchCurrents[c.id] = opts.killSources ? 0 : c.value.magnitude;
  }

  return { nodeVoltages, branchCurrents, steps };
}

// --- Thévenin / Norton ------------------------------------------------------

export interface TheveninResult {
  vth: number;
  rth: number;
  inorton: number;
  steps: string[];
}

function resolveTerminal(model: CircuitModel, ref: string, type: string): string {
  if (type === "port") {
    const port = model.ports.find((p) => p.id === ref);
    if (!port) {
      throw new UnsupportedProblemError(
        `The model has no port called "${ref}".`,
        "Label the output terminals before asking for an equivalent at them.",
      );
    }
    return port.node;
  }
  if (!model.nodes.some((nd) => nd.id === ref)) {
    throw new UnsupportedProblemError(
      `The model has no node called "${ref}".`,
      "Check the node label in the question against the circuit.",
    );
  }
  return ref;
}

export function theveninAt(model: CircuitModel, node: string): TheveninResult {
  const open = solveDCOperatingPoint(model);
  const vth = open.nodeVoltages[node];
  const test = solveDCOperatingPoint(model, { killSources: true, testCurrentNode: node });
  const rth = test.nodeVoltages[node];
  const steps = [
    `Open-circuit voltage at ${node}: V_th = ${vth.toPrecision(6)} V.`,
    "Kill every independent source: voltage sources become shorts, current sources become opens.",
    `Inject 1 A into ${node} and read the resulting voltage: R_th = ${rth.toPrecision(6)} Ω.`,
    `Norton current: I_N = V_th / R_th = ${(rth === 0 ? NaN : vth / rth).toPrecision(6)} A.`,
  ];
  if (!(rth > 0)) {
    throw new UnsupportedProblemError(
      `The Thévenin resistance at ${node} came out as ${rth}, which is not physical.`,
      "Check that the terminals are not shorted directly across an ideal source.",
    );
  }
  return { vth, rth, inorton: vth / rth, steps };
}

// --- first-order transient --------------------------------------------------

function firstOrderElement(model: CircuitModel): Component {
  const storage = model.components.filter(
    (c) => c.kind === "capacitor" || c.kind === "inductor",
  );
  if (storage.length === 0) {
    throw new UnsupportedProblemError(
      "This circuit has no capacitor or inductor, so there is no transient to compute.",
      "Add the storage element, or ask for a DC solve instead.",
    );
  }
  if (storage.length > 1) {
    throw new UnsupportedProblemError(
      `This circuit has ${storage.length} storage elements — that is a second-order or higher problem.`,
      "Use the RLC solver for two elements; higher orders are not supported yet.",
    );
  }
  return storage[0];
}

export interface TransientResult {
  /** Value at the requested time. */
  value: number;
  v0: number;
  vinf: number;
  tau: number;
  steps: string[];
}

export function solveFirstOrder(
  model: CircuitModel,
  node: string,
  at: number | "0-" | "0+" | "inf",
): TransientResult {
  const el = firstOrderElement(model);
  const [e0, e1] = el.terminals;
  const gnd = groundId(model);
  if (e1 !== gnd && e0 !== gnd) {
    throw new UnsupportedProblemError(
      `${el.id} is not referenced to ground, so the first-order shortcut does not apply.`,
      "Redraw with the storage element between the node of interest and ground.",
    );
  }
  const across = e0 === gnd ? e1 : e0;

  // Resistance seen by the storage element, sources killed.
  const withoutElement: CircuitModel = {
    ...model,
    components: model.components.filter((c) => c.id !== el.id),
  };
  const probe = solveDCOperatingPoint(withoutElement, {
    killSources: true,
    testCurrentNode: across,
  });
  const req = probe.nodeVoltages[across];
  if (!(req > 0)) {
    throw new UnsupportedProblemError(
      `The resistance seen by ${el.id} came out as ${req}, which gives no usable time constant.`,
      "Check the resistors around the storage element.",
    );
  }

  const isCap = el.kind === "capacitor";
  const tau = isCap ? req * requirePositive(el, "capacitance") : requirePositive(el, "inductance") / req;

  // Final value: DC steady state with the element open (cap) or shorted (ind).
  const steady = solveDCOperatingPoint(model);
  const vinf = steady.nodeVoltages[across];
  const v0 = el.initial?.magnitude ?? 0;

  const t = at === "inf" ? Infinity : at === "0-" || at === "0+" ? 0 : at;
  const value = at === "inf" ? vinf : vinf + (v0 - vinf) * Math.exp(-t / tau);

  const steps = [
    `Storage element: ${el.id}. Resistance seen with sources killed: R_eq = ${req.toPrecision(6)} Ω.`,
    `Time constant: τ = ${isCap ? "R_eq·C" : "L/R_eq"} = ${tau.toPrecision(6)} s.`,
    `Initial value at t = 0⁺: ${v0.toPrecision(6)} ${isCap ? "V" : "A"} (continuity of ${isCap ? "capacitor voltage" : "inductor current"}).`,
    `Final value as t → ∞: ${vinf.toPrecision(6)} ${isCap ? "V" : "A"} from the DC steady state.`,
    `x(t) = x(∞) + [x(0⁺) − x(∞)]·e^(−t/τ) = ${vinf.toPrecision(6)} + ${(v0 - vinf).toPrecision(6)}·e^(−t/${tau.toPrecision(6)}).`,
    at === "inf"
      ? `x(∞) = ${vinf.toPrecision(6)}.`
      : `x(${t}) = ${value.toPrecision(6)}.`,
  ];

  if (node !== across) {
    // The requested node is not the element node — only valid if it is a plain
    // resistive extension, which the shortcut cannot justify.
    throw new UnsupportedProblemError(
      `The transient shortcut gives the response at ${across}, not ${node}.`,
      `Ask for the response at ${across}, or use the full time-domain solver.`,
    );
  }

  return { value, v0, vinf, tau, steps };
}

// --- power balance ----------------------------------------------------------

export function powerBalance(model: CircuitModel, dc: DCSolution): { delivered: number; dissipated: number; residual: number } {
  let delivered = 0;
  let dissipated = 0;
  for (const c of model.components) {
    if (c.kind === "resistor") {
      const [a0, a1] = c.terminals;
      const v = dc.nodeVoltages[a0] - dc.nodeVoltages[a1];
      dissipated += (v * v) / c.value.magnitude;
    } else if (c.kind === "vsource") {
      // Branch current is defined into terminal 0; power delivered is v·(−i).
      delivered += c.value.magnitude * -dc.branchCurrents[c.id];
    } else if (c.kind === "isource") {
      const [a0, a1] = c.terminals;
      const v = dc.nodeVoltages[a1] - dc.nodeVoltages[a0];
      delivered += v * c.value.magnitude;
    }
  }
  return { delivered, dissipated, residual: delivered - dissipated };
}

// --- public entry point -----------------------------------------------------

export function solveQuestion(model: CircuitModel, question: AnalysisRequest): SolveResult {
  const assumptions: string[] = [];

  switch (question.kind) {
    case "solve":
    case "power": {
      const dc = solveDCOperatingPoint(model);
      const balance = powerBalance(model, dc);
      const steps = [...dc.steps];
      steps.push(
        `Power check: sources deliver ${balance.delivered.toPrecision(6)} W, resistors dissipate ${balance.dissipated.toPrecision(6)} W, residual ${balance.residual.toExponential(2)} W.`,
      );

      if (question.target.type === "component") {
        const c = model.components.find((x) => x.id === question.target.ref);
        if (!c) {
          throw new UnsupportedProblemError(
            `The model has no component called "${question.target.ref}".`,
            "Check the component label in the question against the circuit.",
          );
        }
        const i = dc.branchCurrents[c.id];
        if (i === undefined) {
          throw new UnsupportedProblemError(
            `No branch current is defined for ${c.id}.`,
            "Ask for a node voltage instead, or add the component to a supported branch type.",
          );
        }
        steps.push(`Current through ${c.id}: ${i.toPrecision(6)} A.`);
        return { numeric: i, units: "A", steps, assumptions };
      }

      const node = resolveTerminal(model, question.target.ref, question.target.type);
      const v = dc.nodeVoltages[node];
      steps.push(`Voltage at ${node} with respect to ground: ${v.toPrecision(6)} V.`);
      return { numeric: v, units: "V", steps, assumptions };
    }

    case "thevenin":
    case "norton": {
      const node = resolveTerminal(model, question.target.ref, question.target.type);
      const th = theveninAt(model, node);
      return {
        numeric: question.kind === "thevenin" ? th.vth : th.inorton,
        units: question.kind === "thevenin" ? "V" : "A",
        steps: th.steps,
        assumptions,
        extras: { vth: th.vth, rth: th.rth, inorton: th.inorton },
      };
    }

    case "maxpower": {
      const node = resolveTerminal(model, question.target.ref, question.target.type);
      const th = theveninAt(model, node);
      const pmax = (th.vth * th.vth) / (4 * th.rth);
      return {
        numeric: pmax,
        units: "W",
        steps: [
          ...th.steps,
          `Maximum power transfer needs R_L = R_th = ${th.rth.toPrecision(6)} Ω.`,
          `P_max = V_th² / (4·R_th) = ${pmax.toPrecision(6)} W.`,
        ],
        assumptions,
        extras: { rload: th.rth, pmax },
      };
    }

    case "transient": {
      const node = resolveTerminal(model, question.target.ref, question.target.type);
      const at = question.at;
      if (at === undefined) {
        throw new UnsupportedProblemError(
          "The question asks for a transient response but names no time.",
          "Say which time to evaluate: 0⁻, 0⁺, a number of seconds, or ∞.",
        );
      }
      if (typeof at === "object") {
        throw new UnsupportedProblemError(
          "A frequency was given for a time-domain question.",
          "Ask for a phasor analysis instead, or give a time.",
        );
      }
      if (at === "expression") {
        throw new UnsupportedProblemError(
          "Symbolic time-domain expressions are not produced by this path yet.",
          "Ask for the response at a specific time.",
        );
      }
      const tr = solveFirstOrder(model, node, at);
      assumptions.push("Storage element starts from the stated initial condition; switching happens at t = 0.");
      return { numeric: tr.value, units: "V", steps: tr.steps, assumptions, extras: { tau: tr.tau, v0: tr.v0, vinf: tr.vinf } };
    }

    default:
      throw new UnsupportedProblemError(
        `"${question.kind}" analysis is not supported by the canonical solver yet.`,
        "Use the dedicated tab for this analysis, or rephrase the question as a DC, Thévenin, or first-order transient request.",
      );
  }
}
