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
export function gauss(A: number[][], b: number[]): number[] {
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
  return M.map((row, i) => row[n] / row[i]);
}

// --- DC operating point (MNA) ----------------------------------------------
//
// Sign conventions (used everywhere, including the regression suite):
// • Branch current of a resistor, voltage source, inductor, dependent source:
//   positive from terminal 0 → terminal 1 THROUGH the element.
// • Independent / dependent current sources: the arrow head is terminal 0;
//   the source pushes its value INTO terminal 0. branchCurrents[id] reports
//   the source value in the arrow direction.
// • A resistor of 0 Ω is an ideal short; a resistor of +∞ Ω is an open.

export interface DCSolution {
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  steps: string[];
}

interface DCOptions {
  /** Zero independent sources (dependent sources stay active). */
  killSources?: boolean;
  /** Keep only this independent source alive (superposition). */
  onlySource?: string;
  /** Inject 1 A into this node … */
  testCurrentNode?: string;
  /** … and draw it back out of this node (defaults to ground). */
  testCurrentReturn?: string;
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

function finiteValue(c: Component, what: string): number {
  const v = c.value?.magnitude;
  if (typeof v !== "number" || Number.isNaN(v)) {
    throw new UnsupportedProblemError(
      `${c.id} has no usable ${what} value.`,
      `Enter a numeric ${what} for ${c.id}.`,
    );
  }
  return v;
}

function requirePositive(c: Component, what: string): number {
  const v = finiteValue(c, what);
  if (!Number.isFinite(v) || v <= 0) {
    throw new UnsupportedProblemError(
      `${c.id} has a ${what} of ${v}, which is not usable here.`,
      `Set ${c.id} to a finite value greater than zero.`,
    );
  }
  return v;
}

const isIndependent = (c: Component) => c.kind === "vsource" || c.kind === "isource";
const isVoltageBranch = (c: Component) =>
  c.kind === "vsource" || c.kind === "inductor" || c.kind === "vcvs" || c.kind === "ccvs" ||
  (c.kind === "resistor" && c.value?.magnitude === 0);

function sourceValue(c: Component, opts: DCOptions): number {
  if (opts.killSources) return 0;
  if (opts.onlySource && opts.onlySource !== c.id) return 0;
  const v = finiteValue(c, c.kind === "vsource" ? "voltage" : "current");
  if (!Number.isFinite(v)) {
    throw new UnsupportedProblemError(`${c.id} has an infinite value.`, `Give ${c.id} a finite value.`);
  }
  return v;
}

export function solveDCOperatingPoint(model: CircuitModel, opts: DCOptions = {}): DCSolution {
  const gnd = groundId(model);
  const declared = new Set(model.nodes.map((n) => n.id));
  for (const c of model.components) {
    if (c.kind === "ground") continue;
    if (c.terminals.length < 2 || c.terminals.some((t) => t === undefined || t === "")) {
      throw new UnsupportedProblemError(
        `${c.id} is not connected at both terminals.`,
        `Connect both terminals of ${c.id} to a node.`,
      );
    }
    for (const t of c.terminals) declared.add(t);
  }
  const nodeIds = [...declared].filter((id) => id !== gnd);
  const index = new Map(nodeIds.map((id, i) => [id, i]));
  const at = (id: string) => (id === gnd ? -1 : (index.get(id) as number));
  const byId = new Map(model.components.map((c) => [c.id, c]));
  const steps: string[] = [];

  const vBranches = model.components.filter(isVoltageBranch);
  const vIndex = new Map(vBranches.map((c, k) => [c.id, nodeIds.length + k]));
  const n = nodeIds.length;
  const size = n + vBranches.length;
  if (size === 0) return { nodeVoltages: { [gnd]: 0 }, branchCurrents: {}, steps };

  const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const b = new Array(size).fill(0);
  const add = (r: number, c: number, v: number) => { if (r >= 0 && c >= 0) A[r][c] += v; };

  /** Linear expression for a controlling quantity: Σ coef·x[idx] + constant. */
  type Lin = { terms: [number, number][]; k: number };
  const controlExpr = (c: Component): Lin => {
    const ctl = c.control;
    if (!ctl || !Number.isFinite(ctl.gain)) {
      throw new UnsupportedProblemError(
        `${c.id} is a dependent source with no usable control.`,
        `Say what ${c.id} depends on and give its gain.`,
      );
    }
    if (ctl.type === "voltage-across") {
      const [pa, pb] = ctl.across ?? [];
      if (!pa || !pb || !declared.has(pa) || !declared.has(pb)) {
        throw new UnsupportedProblemError(
          `${c.id} is controlled by a voltage across nodes that are not in the circuit.`,
          `Point ${c.id}'s control at two existing nodes.`,
        );
      }
      return { terms: [[at(pa), 1], [at(pb), -1]], k: 0 };
    }
    const ref = ctl.through ? byId.get(ctl.through) : undefined;
    if (!ref) {
      throw new UnsupportedProblemError(
        `${c.id} is controlled by the current through a component that does not exist.`,
        `Point ${c.id}'s control at an existing component.`,
      );
    }
    if (vIndex.has(ref.id)) return { terms: [[vIndex.get(ref.id)!, 1]], k: 0 };
    if (ref.kind === "resistor") {
      const R = ref.value.magnitude;
      if (!Number.isFinite(R)) return { terms: [], k: 0 };
      return { terms: [[at(ref.terminals[0]), 1 / R], [at(ref.terminals[1]), -1 / R]], k: 0 };
    }
    if (ref.kind === "isource") {
      // Current t0→t1 through a current source is minus its arrow value.
      return { terms: [], k: -sourceValue(ref, opts) };
    }
    if (ref.kind === "capacitor") return { terms: [], k: 0 };
    throw new UnsupportedProblemError(
      `${c.id} is controlled by the current through ${ref.id} (${ref.kind}), which this engine cannot express.`,
      "Control the source with a resistor, voltage source, or inductor current.",
    );
  };

  for (const c of model.components) {
    if (c.kind === "ground") continue;
    const [a0, a1] = c.terminals;
    const i = at(a0);
    const j = at(a1);
    switch (c.kind) {
      case "resistor": {
        const R = finiteValue(c, "resistance");
        if (R < 0) {
          throw new UnsupportedProblemError(`${c.id} has a negative resistance.`, `Set ${c.id} to a value ≥ 0.`);
        }
        if (R === 0) { steps.push(`${c.id} is 0 Ω — treated as an ideal short between ${a0} and ${a1}.`); break; }
        if (R === Infinity) { steps.push(`${c.id} is an open circuit.`); break; }
        const g = 1 / R;
        add(i, i, g); add(j, j, g); add(i, j, -g); add(j, i, -g);
        steps.push(`KCL stamp: ${c.id} = ${R.toPrecision(6)} Ω → conductance ${g.toPrecision(6)} S between ${a0} and ${a1}.`);
        break;
      }
      case "isource": {
        const val = sourceValue(c, opts);
        if (i >= 0) b[i] += val;
        if (j >= 0) b[j] -= val;
        steps.push(`KCL stamp: ${c.id} drives ${val} A into ${a0} and out of ${a1}.`);
        break;
      }
      case "vccs":
      case "cccs": {
        const e = controlExpr(c);
        const g = c.control!.gain;
        // Injection into a0 = g·ctrl → move to left-hand side.
        for (const [idx, coef] of e.terms) { add(i, idx, -g * coef); add(j, idx, g * coef); }
        if (i >= 0) b[i] += g * e.k;
        if (j >= 0) b[j] -= g * e.k;
        steps.push(`KCL stamp: ${c.id} drives ${g} × (${c.kind === "vccs" ? "control voltage" : "control current"}) into ${a0}.`);
        break;
      }
      case "capacitor":
        requirePositive(c, "capacitance");
        steps.push(`${c.id} is an open circuit at DC steady state.`);
        break;
      case "inductor":
        requirePositive(c, "inductance");
        break;
      case "vsource":
      case "vcvs":
      case "ccvs":
        break;
      default:
        throw new UnsupportedProblemError(
          `${c.id} is a ${c.kind}, which the verified DC engine does not handle yet.`,
          "Remove the component or use a dedicated preview tab — unsupported parts are never approximated.",
        );
    }
  }

  for (const c of vBranches) {
    const row = vIndex.get(c.id)!;
    const [a0, a1] = c.terminals;
    const i = at(a0);
    const j = at(a1);
    add(i, row, 1); add(row, i, 1);
    add(j, row, -1); add(row, j, -1);
    if (c.kind === "vsource") {
      b[row] = sourceValue(c, opts);
      steps.push(`Source constraint: v(${a0}) − v(${a1}) = ${b[row]} V for ${c.id}.`);
    } else if (c.kind === "vcvs" || c.kind === "ccvs") {
      const e = controlExpr(c);
      const g = c.control!.gain;
      for (const [idx, coef] of e.terms) add(row, idx, -g * coef);
      b[row] = g * e.k;
      steps.push(`Dependent source constraint: v(${a0}) − v(${a1}) = ${g} × (${c.kind === "vcvs" ? "control voltage" : "control current"}) for ${c.id}.`);
    } else {
      b[row] = 0;
      steps.push(`${c.id} is a short circuit at DC, so v(${a0}) − v(${a1}) = 0.`);
    }
  }

  if (opts.testCurrentNode) {
    const t = at(opts.testCurrentNode);
    const r = opts.testCurrentReturn ? at(opts.testCurrentReturn) : -1;
    if (t === undefined || t < 0 && r < 0) {
      throw new UnsupportedProblemError(
        `Cannot apply a test current at ${opts.testCurrentNode}.`,
        "Pick a non-ground node for the test terminal.",
      );
    }
    if (t >= 0) b[t] += 1;
    if (r >= 0) b[r] -= 1;
    steps.push(`Inject a 1 A test current into ${opts.testCurrentNode} to measure resistance.`);
  }

  const x = gauss(A, b);
  if (x.some((v) => !Number.isFinite(v))) {
    throw new UnsupportedProblemError(
      "The solution contains a non-finite value.",
      "Check for floating nodes, shorted sources, or current sources in series.",
    );
  }

  const nodeVoltages: Record<string, number> = { [gnd]: 0 };
  nodeIds.forEach((id, k) => { nodeVoltages[id] = x[k]; });
  const branchCurrents: Record<string, number> = {};
  for (const c of vBranches) branchCurrents[c.id] = x[vIndex.get(c.id)!];
  const evalLin = (e: Lin) => e.terms.reduce((s, [idx, coef]) => s + (idx >= 0 ? coef * x[idx] : 0), e.k);
  for (const c of model.components) {
    if (c.kind === "resistor" && c.value.magnitude !== 0) {
      const R = c.value.magnitude;
      branchCurrents[c.id] = R === Infinity ? 0 : (nodeVoltages[c.terminals[0]] - nodeVoltages[c.terminals[1]]) / R;
    } else if (c.kind === "isource") {
      branchCurrents[c.id] = sourceValue(c, opts);
    } else if (c.kind === "vccs" || c.kind === "cccs") {
      branchCurrents[c.id] = c.control!.gain * evalLin(controlExpr(c));
    } else if (c.kind === "capacitor") {
      branchCurrents[c.id] = 0;
    }
  }
  return { nodeVoltages, branchCurrents, steps };
}

// --- independent self-check -------------------------------------------------

/**
 * Re-derives KCL at every node from the solved currents. If any node fails,
 * the answer is withheld — an unverified number is never shown as final.
 */
export function verifyKCL(model: CircuitModel, dc: DCSolution): number {
  const sum: Record<string, number> = {};
  let scale = 1e-12;
  for (const c of model.components) {
    if (c.kind === "ground") continue;
    const [a0, a1] = c.terminals;
    const i = dc.branchCurrents[c.id] ?? 0;
    // Current leaving a0 and entering a1 (through the element).
    const out = c.kind === "isource" || c.kind === "vccs" || c.kind === "cccs" ? -i : i;
    sum[a0] = (sum[a0] ?? 0) + out;
    sum[a1] = (sum[a1] ?? 0) - out;
    scale = Math.max(scale, Math.abs(i));
  }
  const gnd = groundId(model);
  let worst = 0;
  for (const [node, s] of Object.entries(sum)) if (node !== gnd) worst = Math.max(worst, Math.abs(s));
  return worst / scale;
}

function assertVerified(model: CircuitModel, dc: DCSolution): ReturnType<typeof powerBalance> {
  const kcl = verifyKCL(model, dc);
  const pb = powerBalance(model, dc);
  const pscale = Math.max(1e-15, Math.abs(pb.delivered), Math.abs(pb.dissipated));
  if (!(kcl < 1e-6) || !(Math.abs(pb.residual) / pscale < 1e-6)) {
    throw new UnsupportedProblemError(
      `Unverified: the solution failed its own check (KCL residual ${kcl.toExponential(2)}, power residual ${pb.residual.toExponential(2)} W).`,
      "The circuit is likely ill-conditioned or mis-entered. Re-check values and connections.",
    );
  }
  return pb;
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
  if (!model.nodes.some((nd) => nd.id === ref) && !model.components.some((c) => c.terminals.includes(ref))) {
    throw new UnsupportedProblemError(
      `The model has no node called "${ref}".`,
      "Check the node label in the question against the circuit.",
    );
  }
  return ref;
}

export function theveninAt(model: CircuitModel, node: string): TheveninResult {
  const open = solveDCOperatingPoint(model);
  assertVerified(model, open);
  const vth = open.nodeVoltages[node];
  const test = solveDCOperatingPoint(model, { killSources: true, testCurrentNode: node });
  const rth = test.nodeVoltages[node];
  if (!Number.isFinite(rth) || Math.abs(rth) < 1e-12) {
    throw new UnsupportedProblemError(
      `The Thévenin resistance at ${node} is ${rth} Ω — the terminal is shorted to ground or across an ideal source.`,
      "Pick a terminal pair that is not directly across an ideal voltage source or short.",
    );
  }
  const steps = [
    `Open-circuit voltage at ${node}: V_th = ${vth.toPrecision(6)} V.`,
    "Kill every independent source: voltage sources become shorts, current sources become opens. Dependent sources stay active.",
    `Inject 1 A into ${node} and read the resulting voltage: R_th = v/1 A = ${rth.toPrecision(6)} Ω.`,
    `Norton current: I_N = V_th / R_th = ${(vth / rth).toPrecision(6)} A.`,
  ];
  return { vth, rth, inorton: vth / rth, steps };
}

// --- first-order transient --------------------------------------------------

function firstOrderElement(model: CircuitModel): Component {
  const storage = model.components.filter((c) => c.kind === "capacitor" || c.kind === "inductor");
  if (storage.length === 0) {
    throw new UnsupportedProblemError(
      "This circuit has no capacitor or inductor, so there is no transient to compute.",
      "Add the storage element, or ask for a DC solve instead.",
    );
  }
  if (storage.length > 1) {
    throw new UnsupportedProblemError(
      `This circuit has ${storage.length} storage elements — that is a second-order or higher problem, which is not verified yet.`,
      "Second-order RLC is coming soon in the verified engine.",
    );
  }
  return storage[0];
}

export interface TransientResult {
  value: number;
  v0: number;
  vinf: number;
  tau: number;
  steps: string[];
  units: "V" | "A";
}

export function solveFirstOrder(
  model: CircuitModel,
  target: string | { type: "node" | "component"; ref: string },
  at: number | "0-" | "0+" | "inf",
): TransientResult {
  const tgt = typeof target === "string" ? { type: "node" as const, ref: target } : target;
  const el = firstOrderElement(model);
  const [e0, e1] = el.terminals;
  const isCap = el.kind === "capacitor";
  const value = requirePositive(el, isCap ? "capacitance" : "inductance");

  const others = model.components.filter((c) => c.id !== el.id);
  const probe = solveDCOperatingPoint({ ...model, components: others }, {
    killSources: true, testCurrentNode: e0, testCurrentReturn: e1,
  });
  const req = probe.nodeVoltages[e0] - probe.nodeVoltages[e1];
  if (!(req > 0) || !Number.isFinite(req)) {
    throw new UnsupportedProblemError(
      `The resistance seen by ${el.id} came out as ${req} Ω, which gives no stable time constant.`,
      "Check the resistors around the storage element.",
    );
  }
  const tau = isCap ? req * value : value / req;
  const x0 = el.initial?.magnitude ?? 0;

  // t = 0⁺: capacitor → voltage source v(0); inductor → current source i(0) (t0→t1).
  const replacement: Component = isCap
    ? { ...el, kind: "vsource", value: { magnitude: x0, unit: "volt" } }
    : { ...el, kind: "isource", terminals: [e1, e0], value: { magnitude: x0, unit: "amp" } };
  const m0 = { ...model, components: [...others, replacement] };
  const dc0 = solveDCOperatingPoint(m0);
  assertVerified(m0, dc0);
  const dcInf = solveDCOperatingPoint(model);
  assertVerified(model, dcInf);

  const read = (dc: DCSolution): number => {
    if (tgt.type === "node") {
      const node = resolveTerminal(model, tgt.ref, "node");
      return dc.nodeVoltages[node];
    }
    const v = dc.branchCurrents[tgt.ref];
    if (v === undefined) {
      throw new UnsupportedProblemError(`No current is defined for "${tgt.ref}".`, "Check the component label.");
    }
    return v;
  };
  const v0 = read(dc0);
  const vinf = read(dcInf);
  const units = tgt.type === "node" ? "V" : "A";
  const t = at === "inf" ? Infinity : at === "0-" || at === "0+" ? 0 : at;
  if (typeof t === "number" && t < 0) {
    throw new UnsupportedProblemError("Negative times are before the switching event.", "Ask for t ≥ 0.");
  }
  const val = at === "inf" ? vinf : vinf + (v0 - vinf) * Math.exp(-t / tau);

  const label = tgt.type === "node" ? `v(${tgt.ref})` : `i(${tgt.ref})`;
  const steps = [
    `Storage element: ${el.id} between ${e0} and ${e1}, initial ${isCap ? "voltage" : "current"} ${x0} ${isCap ? "V" : "A"}.`,
    `Kill independent sources, remove ${el.id}, apply 1 A across its terminals: R_eq = ${req.toPrecision(6)} Ω.`,
    `Time constant: τ = ${isCap ? "R_eq·C" : "L/R_eq"} = ${tau.toPrecision(6)} s.`,
    `At t = 0⁺ replace ${el.id} by a ${isCap ? `${x0} V voltage source` : `${x0} A current source`} (continuity) and solve: ${label}(0⁺) = ${v0.toPrecision(6)} ${units}.`,
    `As t → ∞ the ${isCap ? "capacitor is open" : "inductor is a short"}: ${label}(∞) = ${vinf.toPrecision(6)} ${units}.`,
    `${label}(t) = ${vinf.toPrecision(6)} + (${(v0 - vinf).toPrecision(6)})·e^(−t/${tau.toPrecision(6)}).`,
    at === "inf" ? `${label}(∞) = ${val.toPrecision(6)} ${units}.` : `${label}(${t}) = ${val.toPrecision(6)} ${units}.`,
  ];
  return { value: val, v0, vinf, tau, steps, units };
}

// --- power balance ----------------------------------------------------------

export function powerBalance(model: CircuitModel, dc: DCSolution): { delivered: number; dissipated: number; residual: number } {
  let delivered = 0;
  let dissipated = 0;
  const vAcross = (c: Component) => dc.nodeVoltages[c.terminals[0]] - dc.nodeVoltages[c.terminals[1]];
  for (const c of model.components) {
    const i = dc.branchCurrents[c.id] ?? 0;
    switch (c.kind) {
      case "resistor":
        dissipated += vAcross(c) * i;
        break;
      case "vsource":
      case "vcvs":
      case "ccvs":
        delivered += vAcross(c) * -i;
        break;
      case "isource":
      case "vccs":
      case "cccs":
        delivered += vAcross(c) * i;
        break;
      default:
        break; // ideal L (short) and C (open) carry no DC power
    }
  }
  return { delivered, dissipated, residual: delivered - dissipated };
}

// --- public entry point -----------------------------------------------------

export function solveQuestion(model: CircuitModel, question: AnalysisRequest): SolveResult {
  const assumptions: string[] = [];

  const readDC = (dc: DCSolution, steps: string[]): SolveResult => {
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
        throw new UnsupportedProblemError(`No branch current is defined for ${c.id}.`, "Ask for a node voltage instead.");
      }
      steps.push(`Current through ${c.id} (terminal ${c.terminals[0]} → ${c.terminals[1]}): ${i.toPrecision(6)} A.`);
      return { numeric: i, units: "A", steps, assumptions };
    }
    const node = resolveTerminal(model, question.target.ref, question.target.type);
    const v = dc.nodeVoltages[node];
    steps.push(`Voltage at ${node} with respect to ground: ${v.toPrecision(6)} V.`);
    return { numeric: v, units: "V", steps, assumptions };
  };

  switch (question.kind) {
    case "solve":
    case "power": {
      const dc = solveDCOperatingPoint(model);
      const balance = assertVerified(model, dc);
      const steps = [...dc.steps];
      steps.push(
        `Verification: KCL holds at every node; sources deliver ${balance.delivered.toPrecision(6)} W, resistors dissipate ${balance.dissipated.toPrecision(6)} W, residual ${balance.residual.toExponential(2)} W.`,
      );
      return readDC(dc, steps);
    }

    case "superposition": {
      const src = model.components.find((c) => c.id === question.source);
      if (!src || !isIndependent(src)) {
        throw new UnsupportedProblemError(
          "Superposition needs the name of one independent source.",
          "Say which source's contribution you want.",
        );
      }
      const full = solveDCOperatingPoint(model);
      assertVerified(model, full);
      const part = solveDCOperatingPoint(model, { onlySource: src.id });
      const steps = [
        `Keep only ${src.id}; short every other voltage source and open every other current source (dependent sources stay).`,
        ...part.steps,
      ];
      assumptions.push(`Contribution of ${src.id} alone.`);
      return readDC(part, steps);
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
      if (!(th.rth > 0)) {
        throw new UnsupportedProblemError(
          `R_th = ${th.rth.toPrecision(6)} Ω is not positive, so no passive load maximises power.`,
          "Maximum power transfer only applies when R_th > 0.",
        );
      }
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
      const at = question.at;
      if (at === undefined) {
        throw new UnsupportedProblemError(
          "The question asks for a transient response but names no time.",
          "Say which time to evaluate: 0⁻, 0⁺, a number of seconds, or ∞.",
        );
      }
      if (typeof at === "object") {
        throw new UnsupportedProblemError("A frequency was given for a time-domain question.", "Give a time instead.");
      }
      if (at === "expression") {
        throw new UnsupportedProblemError(
          "Symbolic time-domain expressions are not produced by this path yet.",
          "Ask for the response at a specific time.",
        );
      }
      if (question.target.type !== "node" && question.target.type !== "component") {
        throw new UnsupportedProblemError("Transient targets must be a node or a component.", "Pick a node voltage or a component current.");
      }
      if (at === "0-") {
        throw new UnsupportedProblemError(
          "t = 0⁻ needs the pre-switching circuit, which this model does not describe.",
          "Give the initial condition and ask for 0⁺ or later.",
        );
      }
      const tr = solveFirstOrder(model, question.target as { type: "node" | "component"; ref: string }, at);
      assumptions.push("Sources are constant for t > 0; the storage element starts from its stated initial condition (0 if none).");
      return { numeric: tr.value, units: tr.units, steps: tr.steps, assumptions, extras: { tau: tr.tau, x0: tr.v0, xinf: tr.vinf } };
    }

    default:
      throw new UnsupportedProblemError(
        `"${question.kind}" analysis is not verified yet (coming soon).`,
        "Verified scope: DC, nodal/mesh with dependent sources, superposition, Thévenin, Norton, maximum power, first-order RC/RL.",
      );
  }
}
