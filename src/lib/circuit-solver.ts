import { buildCircuitModel } from "./parsed-to-model";
import { solveDCOperatingPoint, solveQuestion, powerBalance, verifyKCL } from "./model-solver";
import { requireIndependentAgreement } from "./independent-dc";
import { assertPhasorPhysics } from "./independent-ac";
import { preflight } from "./preflight";
// Circuit Analysis Engine - Core mathematical operations

// ============ MATRIX OPERATIONS ============

export function solveLinearSystem(G: number[][], I: number[]): number[] {
  const n = G.length;
  // Gaussian elimination with partial pivoting
  const A = G.map((row, i) => [...row, I[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];

    if (Math.abs(A[col][col]) < 1e-12) throw new Error(`Singular matrix at column ${col + 1}`);

    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let j = col; j <= n; j++) A[row][j] -= factor * A[col][j];
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = A[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= A[i][j] * x[j];
    x[i] /= A[i][i];
  }
  return x;
}

// ============ DC NODAL ANALYSIS ============

export interface DCComponent {
  /** Stable row identity for editors. The solver ignores it. */
  id?: string;
  type: 'resistor' | 'voltage_source' | 'current_source';
  value: number;
  nodeA: number; // positive terminal node (0 = ground)
  nodeB: number; // negative terminal node (0 = ground)
}

export interface DCResult {
  nodeVoltages: { node: number; voltage: number }[];
  branchCurrents: { component: string; current: number }[];
  powerBalance: { delivered: number; absorbed: number; absorbedBySources?: number; balanced: boolean };
  residuals: { type: string; location: string; value: number; pass: boolean }[];
  steps: string[];
  matrix: { G: number[][]; I: number[]; labels: string[] };
}

export function solveDC(components: DCComponent[]): DCResult {
  if (!components.length) throw new Error('No circuit components supplied.');
  for (const c of components) {
    if (!Number.isInteger(c.nodeA) || !Number.isInteger(c.nodeB) || c.nodeA < 0 || c.nodeB < 0) throw new Error('Node IDs must be nonnegative integers.');
  }
  const { model } = buildCircuitModel({
    components: components.map((c, i) => ({ type: c.type, value: c.value, nodeA: c.nodeA, nodeB: c.nodeB, label: `${c.type}_${i + 1}` })),
    method: 'dc_nodal', rawText: '', findWhat: ['all'], confidence: 1, warnings: [],
  });
  // Preflight is the component that names what is wrong. Running it here means a
  // floating node is reported by name instead of as a generic singular matrix.
  const check = preflight(model);
  if (!check.ok) {
    throw new Error(check.blocking.map((issue) => (issue.fix ? `${issue.message} ${issue.fix}` : issue.message)).join(' '));
  }
  const dc = solveDCOperatingPoint(model);
  requireIndependentAgreement(model, dc.nodeVoltages);
  // Public entry enforces physical residuals before any answer is returned.
  const question = model.questions[0];
  if (!question) throw new Error('No non-ground circuit output.');
  const answer = solveQuestion(model, question);
  const pb = powerBalance(model, dc), kcl = verifyKCL(model, dc);
  // Derived from the measured residuals, never assumed: the same tolerances
  // assertVerified() enforces. The UI renders these flags as green ticks.
  const powerTolerance = 1e-6 * Math.max(1, Math.abs(pb.delivered));
  const kclPass = kcl <= 1e-6;
  const powerPass = Math.abs(pb.residual) <= powerTolerance;
  return {
    nodeVoltages: model.nodes.filter(n => !n.isGround).map(n => ({ node: Number(n.id.slice(1)), voltage: dc.nodeVoltages[n.id] })),
    branchCurrents: components.map((c, i) => ({ component: `${c.type}_${i + 1}`, current: (c.type === 'current_source' ? -1 : 1) * dc.branchCurrents[`${c.type}_${i + 1}`] })),
    powerBalance: { delivered: pb.delivered, absorbed: pb.dissipated + pb.absorbedBySources, absorbedBySources: pb.absorbedBySources, balanced: powerPass },
    residuals: [
      { type: 'KCL', location: 'Worst normalized node', value: kcl, pass: kclPass },
      { type: 'Power', location: 'Circuit (W)', value: pb.residual, pass: powerPass },
    ],
    steps: [...answer.steps, 'Verified: independent branch-tableau solution agrees with MNA. Current-source arrows point into Node+; displayed current is Node+ to Node−.'],
    // MNA derivation is shown in steps; do not fabricate a reduced matrix.
    matrix: { G: [], I: [], labels: [] },
  };
}

// ============ FIRST-ORDER TRANSIENT ANALYSIS ============

export interface TransientInput {
  type: 'RC' | 'RL';
  R: number;
  L_or_C: number; // L in Henries or C in Farads
  Vs: number; // Source voltage
  initialValue: number; // v(0) for RC or i(0) for RL
  tFinal: number; // Time range to plot
}

export interface TransientResult {
  tau: number;
  equation: string;
  finalValue: number;
  points: { t: number; value: number }[];
  steps: string[];
}

export function solveTransient(input: TransientInput): TransientResult {
  const { type, R, L_or_C, Vs, initialValue, tFinal } = input;
  if (![R, L_or_C, Vs, initialValue, tFinal].every(Number.isFinite) || R <= 0 || L_or_C <= 0 || tFinal <= 0) throw new Error('Transient requires finite values, positive R, storage and time.');
  const steps: string[] = [];
  
  let tau: number;
  let equation: string;
  let finalValue: number;
  let fn: (t: number) => number;

  if (type === 'RC') {
    tau = R * L_or_C;
    finalValue = Vs;
    const V0 = initialValue;
    steps.push(`Circuit type: RC (First-Order)`);
    steps.push(`Time constant: τ = RC = ${R} × ${L_or_C} = ${tau.toExponential(3)}s`);
    steps.push(`Initial condition: v(0⁺) = ${V0}V`);
    steps.push(`Final value: v(∞) = ${Vs}V`);
    steps.push(`General solution: v(t) = v(∞) + [v(0⁺) - v(∞)]e^(-t/τ)`);
    equation = `v(t) = ${Vs} + (${V0} - ${Vs})e^(-t/${tau.toExponential(3)})`;
    steps.push(`v(t) = ${equation}`);
    fn = (t: number) => Vs + (V0 - Vs) * Math.exp(-t / tau);
  } else {
    tau = L_or_C / R;
    finalValue = Vs / R;
    const I0 = initialValue;
    steps.push(`Circuit type: RL (First-Order)`);
    steps.push(`Time constant: τ = L/R = ${L_or_C} / ${R} = ${tau.toExponential(3)}s`);
    steps.push(`Initial condition: i(0⁺) = ${I0}A`);
    steps.push(`Final value: i(∞) = Vs/R = ${Vs}/${R} = ${finalValue.toFixed(4)}A`);
    steps.push(`General solution: i(t) = i(∞) + [i(0⁺) - i(∞)]e^(-t/τ)`);
    equation = `i(t) = ${finalValue.toFixed(4)} + (${I0} - ${finalValue.toFixed(4)})e^(-t/${tau.toExponential(3)})`;
    steps.push(`i(t) = ${equation}`);
    fn = (t: number) => finalValue + (I0 - finalValue) * Math.exp(-t / tau);
  }

  steps.push(`At t = τ: response reaches 63.2% of final value`);
  steps.push(`At t = 5τ: response is within 0.67% of final value (considered steady-state)`);

  const numPoints = 200;
  const points = Array.from({ length: numPoints + 1 }, (_, i) => {
    const t = (i / numPoints) * tFinal;
    return { t, value: fn(t) };
  });

  return { tau, equation, finalValue, points, steps };
}

// ============ AC PHASOR ANALYSIS ============

export interface Complex {
  re: number;
  im: number;
}

export function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function complexMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

export function complexDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

export function complexMag(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

export function complexAngle(c: Complex): number {
  return Math.atan2(c.im, c.re) * (180 / Math.PI);
}

export function complexToString(c: Complex): string {
  const re = Math.round(c.re * 1000) / 1000;
  const im = Math.round(c.im * 1000) / 1000;
  if (Math.abs(im) < 1e-9) return `${re}`;
  const sign = im >= 0 ? '+' : '-';
  return `${re} ${sign} j${Math.abs(im)}`;
}

export function polarString(c: Complex): string {
  return `${complexMag(c).toFixed(3)}∠${complexAngle(c).toFixed(1)}°`;
}

export interface ACInput {
  Vm: number; // Peak voltage
  phase: number; // Phase in degrees
  frequency: number; // Hz
  R: number;
  L: number; // Henries (0 if none)
  C: number; // Farads (0 if none)
  config: 'series' | 'parallel';
}

export interface ACResult {
  impedance: Complex;
  current: Complex;
  currentR: Complex;
  currentL: Complex;
  currentC: Complex;
  voltageR: Complex;
  voltageL: Complex;
  voltageC: Complex;
  powerReal: number;
  powerReactive: number;
  powerApparent: number;
  powerFactor: number;
  steps: string[];
}

export function solveAC(input: ACInput): ACResult {
  if (input.config !== 'series' && input.config !== 'parallel') throw new Error('AC configuration must be series or parallel.');
  if (![input.Vm, input.phase, input.frequency, input.R, input.L, input.C].every(Number.isFinite) || input.frequency <= 0 || input.R <= 0 || input.L < 0 || input.C < 0) throw new Error('Invalid AC parameters.');
  const { Vm, phase, frequency, R, L, C, config } = input;
  const w = 2 * Math.PI * frequency;
  const steps: string[] = [];
  const zero: Complex = { re: 0, im: 0 };

  steps.push(`Configuration: ${config} RLC. Peak source phasors. L = 0 or C = 0 omits that element.`);
  steps.push(`Angular frequency: ω = 2πf = 2π(${frequency}) = ${w.toFixed(4)} rad/s`);

  const ZR: Complex = { re: R, im: 0 };
  const ZL: Complex = L > 0 ? { re: 0, im: w * L } : zero;
  const ZC: Complex = C > 0 ? { re: 0, im: -1 / (w * C) } : zero;
  const phaseRad = phase * Math.PI / 180;
  const Vs: Complex = { re: Vm * Math.cos(phaseRad), im: Vm * Math.sin(phaseRad) };
  steps.push(`Source phasor: V_s = ${polarString(Vs)} (peak)`);

  let Z: Complex;
  let I: Complex;
  let VR: Complex;
  let VL: Complex;
  let VC: Complex;
  let IR: Complex;
  let IL: Complex;
  let IC: Complex;

  if (config === 'series') {
    steps.push(`Z_R = ${R} Ω`);
    if (L > 0) steps.push(`Z_L = jωL = ${complexToString(ZL)} Ω`);
    if (C > 0) steps.push(`Z_C = -j/(ωC) = ${complexToString(ZC)} Ω`);
    Z = complexAdd(complexAdd(ZR, ZL), ZC);
    if (complexMag(Z) < 1e-15) throw new Error('Series impedance is zero. Answer withheld.');
    steps.push(`Z = Z_R + Z_L + Z_C = ${complexToString(Z)} Ω = ${polarString(Z)}`);
    I = complexDiv(Vs, Z);
    IR = I;
    IL = L > 0 ? I : zero;
    IC = C > 0 ? I : zero;
    VR = complexMul(I, ZR);
    VL = L > 0 ? complexMul(I, ZL) : zero;
    VC = C > 0 ? complexMul(I, ZC) : zero;
    steps.push(`I = V_s / Z = ${complexToString(I)} A = ${polarString(I)}`);
    steps.push(`V_R = ${polarString(VR)}`);
    if (L > 0) steps.push(`V_L = ${polarString(VL)}`);
    if (C > 0) steps.push(`V_C = ${polarString(VC)}`);
  } else {
    const YR: Complex = { re: 1 / R, im: 0 };
    const YL: Complex = L > 0 ? { re: 0, im: -1 / (w * L) } : zero;
    const YC: Complex = C > 0 ? { re: 0, im: w * C } : zero;
    const Y = complexAdd(complexAdd(YR, YL), YC);
    steps.push(`Y_R = 1/R = ${1 / R} S`);
    if (L > 0) steps.push(`Y_L = -j/(ωL) = ${complexToString(YL)} S`);
    if (C > 0) steps.push(`Y_C = jωC = ${complexToString(YC)} S`);
    steps.push(`Y = Y_R + Y_L + Y_C = ${complexToString(Y)} S`);
    I = complexMul(Vs, Y);
    if (complexMag(I) < 1e-18) throw new Error('Parallel admittance produces no finite current. Answer withheld.');
    Z = complexDiv(Vs, I);
    IR = complexMul(Vs, YR);
    IL = L > 0 ? complexMul(Vs, YL) : zero;
    IC = C > 0 ? complexMul(Vs, YC) : zero;
    VR = Vs;
    VL = L > 0 ? Vs : zero;
    VC = C > 0 ? Vs : zero;
    steps.push(`I = V_s · Y = ${complexToString(I)} A = ${polarString(I)}`);
    steps.push(`Z = V_s / I = ${complexToString(Z)} Ω = ${polarString(Z)}`);
    steps.push(`I_R = ${polarString(IR)}`);
    if (L > 0) steps.push(`I_L = ${polarString(IL)}`);
    if (C > 0) steps.push(`I_C = ${polarString(IC)}`);
  }

  const Irms = complexMag(I) / Math.sqrt(2);
  const Vrms = Vm / Math.sqrt(2);
  const S = Vrms * Irms;
  const pfSigned = Math.cos(complexAngle(Z) * Math.PI / 180);
  const pf = Math.abs(pfSigned);
  const P = S * pfSigned;
  const Q = S * Math.sin(complexAngle(Z) * Math.PI / 180);

  steps.push(`Power from RMS magnitudes (peak phasors ÷ √2):`);
  steps.push(`  P = ${P.toFixed(6)} W`);
  steps.push(`  Q = ${Q.toFixed(6)} VAR`);
  steps.push(`  S = ${S.toFixed(6)} VA`);
  steps.push(`  pf = |cos ∠Z| = ${pf.toFixed(6)} ${Q > 1e-9 ? '(lagging)' : Q < -1e-9 ? '(leading)' : '(unity)'}`);

  const result: ACResult = {
    impedance: Z, current: I, currentR: IR, currentL: IL, currentC: IC,
    voltageR: VR, voltageL: VL, voltageC: VC,
    powerReal: P, powerReactive: Q, powerApparent: S, powerFactor: pf, steps,
  };
  assertPhasorPhysics(input, result);
  steps.push(`Verified: 24 time-domain samples satisfy ${config === 'series' ? 'KVL' : 'KCL'}, and P, Q, S, pf match the RMS identities.`);
  return result;
}

function quickAgrees(actual: number, expected: number) {
  return Number.isFinite(actual) && Number.isFinite(expected)
    && Math.abs(actual - expected) <= 1e-6 * Math.max(1e-9, Math.abs(actual), Math.abs(expected));
}

/** Second formulation for the quick calculators: a nodal circuit, not the algebra that produced the displayed number. */
function nodalResistance(resistors: number[], config: 'series' | 'parallel') {
  const source: DCComponent = { type: 'voltage_source', value: 1, nodeA: 1, nodeB: 0 };
  const elements: DCComponent[] = [source];
  if (config === 'parallel') {
    resistors.forEach(value => elements.push({ type: 'resistor', value, nodeA: 1, nodeB: 0 }));
  } else {
    resistors.forEach((value, index) => {
      const nodeA = index === 0 ? 1 : index + 1;
      const nodeB = index === resistors.length - 1 ? 0 : index + 2;
      elements.push({ type: 'resistor', value, nodeA, nodeB });
    });
  }
  const solved = solveDC(elements);
  const leavingPositive = -solved.branchCurrents[0].current;
  if (!(leavingPositive > 0)) throw new Error('Unverified: nodal equivalent drew no source current. Answer withheld.');
  return 1 / leavingPositive;
}

// ============ QUICK SOLVERS ============

export interface QuickResult {
  title: string;
  results: { label: string; value: string; unit: string }[];
  steps: string[];
}

export function solveSeriesParallel(resistors: number[], config: 'series' | 'parallel'): QuickResult {
  if (!resistors.length || resistors.some(r => !Number.isFinite(r) || r <= 0)) throw new Error('Resistance values must be finite and positive.');
  const steps: string[] = [];
  let Req: number;

  if (config === 'series') {
    Req = resistors.reduce((a, b) => a + b, 0);
    steps.push(`Series combination: R_eq = ${resistors.map(r => `${r}`).join(' + ')}`);
    steps.push(`R_eq = ${Req} Ω`);
  } else {
    const sumInv = resistors.reduce((a, r) => a + 1 / r, 0);
    Req = 1 / sumInv;
    steps.push(`Parallel combination: 1/R_eq = ${resistors.map(r => `1/${r}`).join(' + ')}`);
    steps.push(`1/R_eq = ${sumInv.toFixed(6)}`);
    steps.push(`R_eq = ${Req.toFixed(4)} Ω`);
  }

  const checked = nodalResistance(resistors, config);
  if (!quickAgrees(Req, checked)) throw new Error('Unverified: equivalent resistance disagrees with the nodal circuit. Answer withheld.');
  steps.push(`Verified against a 1 V nodal circuit: R_eq = ${checked.toPrecision(6)} Ω.`);

  return {
    title: `${config === 'series' ? 'Series' : 'Parallel'} Resistance`,
    results: [{ label: 'R_eq', value: Req.toPrecision(12), unit: 'Ω' }],
    steps,
  };
}

export function solveOhmsLaw(known: { V?: number; I?: number; R?: number }): QuickResult {
  const steps: string[] = [];
  let V = known.V, I = known.I, R = known.R;
  const given = [V, I, R].filter(v => v !== undefined);
  if (given.length < 2 || given.some(v => !Number.isFinite(v)) || (R !== undefined && R <= 0)) throw new Error('Provide at least two finite quantities and positive resistance.');
  if (V !== undefined && I !== undefined && R !== undefined && Math.abs(V - I * R) > 1e-8 * Math.max(1e-12, Math.abs(V), Math.abs(I * R))) throw new Error('Unverified: supplied V, I and R disagree with V = IR.');

  if (V !== undefined && R !== undefined) {
    I = V / R;
    steps.push(`Given: V = ${V}V, R = ${R}Ω`);
    steps.push(`Ohm's Law: I = V/R = ${V}/${R} = ${I.toFixed(6)}A`);
  } else if (V !== undefined && I !== undefined) {
    R = V / I;
    steps.push(`Given: V = ${V}V, I = ${I}A`);
    steps.push(`Ohm's Law: R = V/I = ${V}/${I} = ${R.toFixed(4)}Ω`);
  } else if (I !== undefined && R !== undefined) {
    V = I * R;
    steps.push(`Given: I = ${I}A, R = ${R}Ω`);
    steps.push(`Ohm's Law: V = IR = ${I}×${R} = ${V.toFixed(4)}V`);
  } else {
    return { title: "Ohm's Law", results: [], steps: ['Error: Provide exactly 2 of V, I, R'] };
  }

  if (V === undefined || I === undefined || R === undefined || ![V, I, R].every(Number.isFinite) || R <= 0) throw new Error('No finite passive Ohm-law solution.');
  const P = V * I;
  const forms = [V * I, I * I * R, (V * V) / R];
  if (forms.some(value => !quickAgrees(value, forms[0]))) throw new Error('Unverified: VI, I²R and V²/R disagree. Answer withheld.');
  steps.push(`Power: P = VI = I²R = V²/R = ${P.toFixed(6)}W`);

  return {
    title: "Ohm's Law",
    results: [
      { label: 'V', value: V.toPrecision(12), unit: 'V' },
      { label: 'I', value: I.toPrecision(12), unit: 'A' },
      { label: 'R', value: R.toPrecision(12), unit: 'Ω' },
      { label: 'P', value: P.toPrecision(12), unit: 'W' },
    ],
    steps,
  };
}

export function solveVoltageDivider(Vs: number, R1: number, R2: number): QuickResult {
  if (![Vs, R1, R2].every(Number.isFinite) || R1 <= 0 || R2 <= 0) throw new Error('Divider requires finite source and positive resistances.');
  const steps: string[] = [];
  const Vout = Vs * R2 / (R1 + R2);
  const I = Vs / (R1 + R2);
  const P1 = I * I * R1;
  const P2 = I * I * R2;

  steps.push(`Voltage Divider: V_out = V_s × R₂ / (R₁ + R₂)`);
  steps.push(`V_out = ${Vs} × ${R2} / (${R1} + ${R2})`);
  steps.push(`V_out = ${Vs} × ${R2} / ${R1 + R2}`);
  steps.push(`V_out = ${Vout.toFixed(4)}V`);
  steps.push(`Total current: I = V_s / (R₁ + R₂) = ${Vs} / ${R1 + R2} = ${I.toFixed(6)}A`);
  steps.push(`V_R1 = I × R₁ = ${(I * R1).toFixed(4)}V`);
  steps.push(`V_R2 = I × R₂ = ${Vout.toFixed(4)}V (= V_out)`);
  steps.push(`Power: P_R1 = ${P1.toFixed(6)}W, P_R2 = ${P2.toFixed(6)}W`);
  steps.push(`✓ KVL check: V_R1 + V_R2 = ${(I * R1).toFixed(4)} + ${Vout.toFixed(4)} = ${(I * R1 + Vout).toFixed(4)}V ≈ ${Vs}V`);
  const nodal = solveDC([
    { type: 'voltage_source', value: Vs, nodeA: 1, nodeB: 0 },
    { type: 'resistor', value: R1, nodeA: 1, nodeB: 2 },
    { type: 'resistor', value: R2, nodeA: 2, nodeB: 0 },
  ]);
  const v2 = nodal.nodeVoltages.find(node => node.node === 2)?.voltage;
  if (v2 === undefined || !quickAgrees(Vout, v2)) throw new Error('Unverified: divider voltage disagrees with nodal analysis. Answer withheld.');
  steps.push(`Verified against nodal analysis: V(node 2) = ${v2.toPrecision(6)} V.`);

  return {
    title: 'Voltage Divider',
    results: [
      { label: 'V_out', value: Vout.toPrecision(12), unit: 'V' },
      { label: 'I', value: I.toPrecision(12), unit: 'A' },
      { label: 'V_R1', value: (I * R1).toPrecision(12), unit: 'V' },
      { label: 'P_total', value: (P1 + P2).toPrecision(12), unit: 'W' },
    ],
    steps,
  };
}

export function solveCurrentDivider(Is: number, R1: number, R2: number): QuickResult {
  if (![Is, R1, R2].every(Number.isFinite) || R1 <= 0 || R2 <= 0) throw new Error('Divider requires finite source and positive resistances.');
  const steps: string[] = [];
  const I1 = Is * R2 / (R1 + R2);
  const I2 = Is * R1 / (R1 + R2);
  const Req = (R1 * R2) / (R1 + R2);
  const V = Is * Req;

  steps.push(`Current Divider: Two resistors in parallel with total current I_s = ${Is}A`);
  steps.push(`R_eq = R₁R₂/(R₁+R₂) = ${R1}×${R2}/(${R1}+${R2}) = ${Req.toFixed(4)}Ω`);
  steps.push(`V = I_s × R_eq = ${Is} × ${Req.toFixed(4)} = ${V.toFixed(4)}V`);
  steps.push(`I₁ = I_s × R₂/(R₁+R₂) = ${Is} × ${R2}/${R1 + R2} = ${I1.toFixed(6)}A`);
  steps.push(`I₂ = I_s × R₁/(R₁+R₂) = ${Is} × ${R1}/${R1 + R2} = ${I2.toFixed(6)}A`);
  steps.push(`✓ KCL check: I₁ + I₂ = ${I1.toFixed(6)} + ${I2.toFixed(6)} = ${(I1 + I2).toFixed(6)}A ≈ ${Is}A`);
  const nodal = solveDC([
    { type: 'current_source', value: Is, nodeA: 1, nodeB: 0 },
    { type: 'resistor', value: R1, nodeA: 1, nodeB: 0 },
    { type: 'resistor', value: R2, nodeA: 1, nodeB: 0 },
  ]);
  const throughR1 = nodal.branchCurrents[1].current;
  if (!quickAgrees(I1, throughR1)) throw new Error('Unverified: divider current disagrees with nodal analysis. Answer withheld.');
  steps.push(`Verified against nodal analysis: I(R1) = ${throughR1.toPrecision(6)} A.`);

  return {
    title: 'Current Divider',
    results: [
      { label: 'I₁', value: I1.toPrecision(12), unit: 'A' },
      { label: 'I₂', value: I2.toPrecision(12), unit: 'A' },
      { label: 'V', value: V.toPrecision(12), unit: 'V' },
      { label: 'R_eq', value: Req.toPrecision(12), unit: 'Ω' },
    ],
    steps,
  };
}

export function solveThevenin(Voc: number, Isc: number): QuickResult {
  if (![Voc, Isc].every(Number.isFinite) || Isc === 0 || Voc / Isc <= 0) throw new Error('Unverified: equivalent needs nonzero short-circuit current and positive resistance.');
  const steps: string[] = [];
  const Rth = Voc / Isc;
  const In = Isc; // Norton current = short circuit current

  steps.push(`Thévenin Equivalent:`);
  steps.push(`  V_th = V_oc (open-circuit voltage) = ${Voc}V`);
  steps.push(`  I_sc (short-circuit current) = ${Isc}A`);
  steps.push(`  R_th = V_oc / I_sc = ${Voc} / ${Isc} = ${Rth.toFixed(4)}Ω`);
  steps.push(``);
  steps.push(`Norton Equivalent:`);
  steps.push(`  I_N = I_sc = ${In.toFixed(6)}A`);
  steps.push(`  R_N = R_th = ${Rth.toFixed(4)}Ω`);
  steps.push(``);
  steps.push(`Maximum Power Transfer:`);
  const Pmax = (Voc * Voc) / (4 * Rth);
  steps.push(`  R_L = R_th = ${Rth.toFixed(4)}Ω for max power`);
  steps.push(`  P_max = V_th² / (4R_th) = ${Voc}² / (4×${Rth.toFixed(4)}) = ${Pmax.toFixed(6)}W`);
  const loaded = solveDC([
    { type: 'voltage_source', value: Voc, nodeA: 1, nodeB: 0 },
    { type: 'resistor', value: Rth, nodeA: 1, nodeB: 2 },
    { type: 'resistor', value: Rth, nodeA: 2, nodeB: 0 },
  ]);
  const loadCurrent = loaded.branchCurrents[2].current;
  const loadPower = loadCurrent * loadCurrent * Rth;
  if (!quickAgrees(loadPower, Pmax)) throw new Error('Unverified: maximum power disagrees with the loaded Thévenin circuit. Answer withheld.');
  steps.push(`Verified by loading R_L = R_th in a nodal circuit: P = ${loadPower.toPrecision(6)} W.`);

  return {
    title: 'Thévenin / Norton Equivalent',
    results: [
      { label: 'V_th', value: Voc.toPrecision(12), unit: 'V' },
      { label: 'R_th', value: Rth.toPrecision(12), unit: 'Ω' },
      { label: 'I_N', value: In.toPrecision(12), unit: 'A' },
      { label: 'P_max', value: Pmax.toPrecision(12), unit: 'W' },
    ],
    steps,
  };
}

export function solvePower(known: { V?: number; I?: number; R?: number }): QuickResult {
  const ohm = solveOhmsLaw(known);
  if (ohm.results.length === 0) return ohm;

  const V = known.V ?? (known.I ?? NaN) * (known.R ?? NaN);
  const I = known.I ?? V / (known.R ?? NaN);
  const R = known.R ?? V / I;

  const steps = [...ohm.steps];
  steps.push(``);
  steps.push(`Power calculations (3 equivalent forms):`);
  steps.push(`  P = V × I = ${V.toFixed(4)} × ${I.toFixed(6)} = ${(V * I).toFixed(6)}W`);
  steps.push(`  P = I²R = ${I.toFixed(6)}² × ${R.toFixed(4)} = ${(I * I * R).toFixed(6)}W`);
  steps.push(`  P = V²/R = ${V.toFixed(4)}² / ${R.toFixed(4)} = ${(V * V / R).toFixed(6)}W`);
  if (!quickAgrees(V * I, I * I * R) || !quickAgrees(V * I, (V * V) / R)) throw new Error('Unverified: the three power forms disagree. Answer withheld.');

  return {
    title: 'Power Analysis',
    results: [
      ...ohm.results,
      { label: 'P (VI)', value: (V * I).toPrecision(12), unit: 'W' },
      { label: 'P (I²R)', value: (I * I * R).toPrecision(12), unit: 'W' },
      { label: 'P (V²/R)', value: (V * V / R).toPrecision(12), unit: 'W' },
    ],
    steps,
  };
}

// ============ SECOND-ORDER RLC TRANSIENT ANALYSIS ============

import { auditRLC } from "./rlc-verification";

export interface RLCInput {
  topology: 'series' | 'parallel';
  R: number;
  L: number;  // Henries
  C: number;  // Farads
  Vs: number; // Source voltage (0 for natural response)
  excitation: 'natural' | 'step';
  vC0: number; // v_C(0+)
  iL0: number; // i_L(0+)
  tFinal: number;
}

export type DampingType = 'overdamped' | 'underdamped' | 'critically_damped';

export interface RLCResult {
  alpha: number;
  omega0: number;
  dampingType: DampingType;
  s1: { re: number; im: number };
  s2: { re: number; im: number };
  omegaD?: number; // damped frequency (underdamped only)
  equationVC: string;
  equationIL: string;
  pointsVC: { t: number; value: number }[];
  pointsIL: { t: number; value: number }[];
  steps: string[];
  verification: {
    ok: boolean;
    physicalOk: boolean;
    settled: boolean;
    endpoint: ReturnType<typeof auditRLC>['checks'];
  };
}

export function solveRLC(input: RLCInput): RLCResult {
  const { topology, R, L, C, Vs, excitation, vC0, iL0, tFinal } = input;
  if (![R, L, C, tFinal].every(x => Number.isFinite(x) && x > 0) ||
      ![Vs, vC0, iL0].every(Number.isFinite)) {
    throw new Error('Unsupported or unverified: R, L, C and t_final must be positive finite values; source and initial conditions must be finite.');
  }
  if (topology === 'parallel' && excitation === 'step') {
    throw new Error('Unsupported or unverified: parallel voltage-step source connection is ambiguous. A directly connected ideal voltage source does not have the assumed finite DC inductor current. Parallel step excitation is coming soon.');
  }
  const steps: string[] = [];

  // --- Step 1: Compute α and ω₀ ---
  let alpha: number, omega0: number;
  omega0 = 1 / Math.sqrt(L * C);

  if (topology === 'series') {
    alpha = R / (2 * L);
    steps.push(`Series RLC circuit`);
    steps.push(`Neper frequency: α = R/(2L) = ${R}/(2×${L}) = ${alpha.toFixed(4)} Np/s`);
  } else {
    alpha = 1 / (2 * R * C);
    steps.push(`Parallel RLC circuit`);
    steps.push(`Neper frequency: α = 1/(2RC) = 1/(2×${R}×${C}) = ${alpha.toFixed(4)} Np/s`);
  }
  steps.push(`Resonant frequency: ω₀ = 1/√(LC) = 1/√(${L}×${C}) = ${omega0.toFixed(4)} rad/s`);

  // --- Step 2: Characteristic equation ---
  steps.push(`Characteristic equation: s² + ${(2 * alpha).toFixed(4)}s + ${(omega0 * omega0).toFixed(4)} = 0`);

  let dampingType: DampingType;
  let s1re: number, s1im: number, s2re: number, s2im: number;
  let omegaD: number | undefined;

  const disc = alpha * alpha - omega0 * omega0;

  if (disc > 1e-6 * omega0 * omega0) {
    dampingType = 'overdamped';
    const sqrtDisc = Math.sqrt(disc);
    s1re = -(omega0 * omega0) / (alpha + sqrtDisc); s1im = 0;
    s2re = -alpha - sqrtDisc; s2im = 0;
    steps.push(`α² > ω₀² → Overdamped (α² - ω₀² = ${disc.toFixed(4)})`);
    steps.push(`s₁ = -α + √(α²-ω₀²) = ${s1re.toFixed(4)}`);
    steps.push(`s₂ = -α - √(α²-ω₀²) = ${s2re.toFixed(4)}`);
  } else if (disc < -1e-6 * omega0 * omega0) {
    dampingType = 'underdamped';
    omegaD = Math.sqrt(-disc);
    s1re = -alpha; s1im = omegaD;
    s2re = -alpha; s2im = -omegaD;
    steps.push(`α² < ω₀² → Underdamped`);
    steps.push(`Damped frequency: ω_d = √(ω₀²-α²) = ${omegaD.toFixed(4)} rad/s`);
    steps.push(`s₁,₂ = -α ± jω_d = ${s1re.toFixed(4)} ± j${omegaD.toFixed(4)}`);
  } else {
    dampingType = 'critically_damped';
    s1re = -alpha; s1im = 0;
    s2re = -alpha; s2im = 0;
    steps.push(`α² = ω₀² → Critically Damped`);
    steps.push(`s₁ = s₂ = -α = ${s1re.toFixed(4)}`);
  }

  // --- Step 3: Determine initial conditions & forced response ---
  const vCss = excitation === 'step' ? Vs : 0;
  const iLss = 0;

  steps.push(``);
  steps.push(`Excitation: ${excitation === 'step' ? `Step input V_s = ${Vs}V` : 'Natural response (no source)'}`);
  steps.push(`Initial conditions: v_C(0⁺) = ${vC0}V, i_L(0⁺) = ${iL0}A`);
  steps.push(`Steady-state values: v_C(∞) = ${vCss}V, i_L(∞) = ${iLss}A`);

  // --- Step 4: Compute derivative ICs ---
  // Series: L·di/dt(0+) = Vs - R·iL0 - vC0  →  dvC/dt(0+) = iL0/C
  // Parallel: C·dvC/dt(0+) = -vC0/R - iL0 + Is  →  diL/dt(0+) = vC0/L
  let dvC0: number, diL0: number;
  if (topology === 'series') {
    dvC0 = iL0 / C;
    diL0 = ((excitation === 'step' ? Vs : 0) - R * iL0 - vC0) / L;
  } else {
    dvC0 = (-vC0 / R - iL0 + (excitation === 'step' ? Vs / R : 0)) / C;
    // Actually for parallel: node KCL gives C·dvC/dt = Is - vC/R - iL
    // But simplified: dvC/dt(0+) from KCL, diL/dt(0+) = vC0/L
    diL0 = vC0 / L;
  }
  steps.push(`dv_C/dt(0⁺) = ${dvC0.toFixed(4)} V/s`);
  steps.push(`di_L/dt(0⁺) = ${diL0.toFixed(4)} A/s`);

  // --- Step 5: Build time-domain solutions ---
  let fnVC: (t: number) => number;
  let fnIL: (t: number) => number;
  let eqVC: string, eqIL: string;

  const buildSolution = (x0: number, dx0: number, xss: number) => {
    // Returns {fn, eq} for x(t) = xss + transient
    const x0p = x0 - xss; // x'(0) = x(0) - x(∞)
    if (dampingType === 'overdamped') {
      // x(t) = xss + A1·e^(s1·t) + A2·e^(s2·t)
      // A1 + A2 = x0p, A1·s1 + A2·s2 = dx0
      const A2 = (dx0 - s1re * x0p) / (s2re - s1re);
      const A1 = x0p - A2;
      const fn = (t: number) => xss + A1 * Math.exp(s1re * t) + A2 * Math.exp(s2re * t);
      const derivative = (t: number) => A1 * s1re * Math.exp(s1re * t) + A2 * s2re * Math.exp(s2re * t);
      const eq = `${xss.toFixed(4)} + ${A1.toFixed(4)}e^(${s1re.toFixed(4)}t) + ${A2.toFixed(4)}e^(${s2re.toFixed(4)}t)`;
      return { fn, derivative, eq, A1, A2 };
    } else if (dampingType === 'underdamped') {
      // x(t) = xss + e^(-αt)[B1·cos(ωd·t) + B2·sin(ωd·t)]
      const B1 = x0p;
      if (omegaD === undefined) throw new Error('Unverified: missing damped frequency.');
      const wd = omegaD;
      const B2 = (dx0 + alpha * x0p) / wd;
      const fn = (t: number) => xss + Math.exp(-alpha * t) * (B1 * Math.cos(wd * t) + B2 * Math.sin(wd * t));
      const derivative = (t: number) => Math.exp(-alpha * t) *
        ((wd * B2 - alpha * B1) * Math.cos(wd * t) + (-wd * B1 - alpha * B2) * Math.sin(wd * t));
      const eq = `${xss.toFixed(4)} + e^(${(-alpha).toFixed(4)}t)[${B1.toFixed(4)}cos(${wd.toFixed(4)}t) + ${B2.toFixed(4)}sin(${wd.toFixed(4)}t)]`;
      return { fn, derivative, eq, A1: B1, A2: B2 };
    } else {
      // Critically damped: x(t) = xss + (D1 + D2·t)e^(-αt)
      const D1 = x0p;
      const D2 = dx0 + alpha * x0p;
      const fn = (t: number) => xss + (D1 + D2 * t) * Math.exp(-alpha * t);
      const derivative = (t: number) => (D2 - alpha * (D1 + D2 * t)) * Math.exp(-alpha * t);
      const eq = `${xss.toFixed(4)} + (${D1.toFixed(4)} + ${D2.toFixed(4)}t)e^(${(-alpha).toFixed(4)}t)`;
      return { fn, derivative, eq, A1: D1, A2: D2 };
    }
  };

  const solVC = buildSolution(vC0, dvC0, vCss);
  const solIL = buildSolution(iL0, diL0, iLss);
  fnVC = solVC.fn;
  fnIL = solIL.fn;
  eqVC = solVC.eq;
  eqIL = solIL.eq;

  steps.push(``);
  if (dampingType === 'overdamped') {
    steps.push(`Overdamped form: x(t) = x(∞) + A₁e^(s₁t) + A₂e^(s₂t)`);
    steps.push(`v_C coefficients: A₁ = ${solVC.A1.toFixed(4)}, A₂ = ${solVC.A2.toFixed(4)}`);
    steps.push(`i_L coefficients: A₁ = ${solIL.A1.toFixed(4)}, A₂ = ${solIL.A2.toFixed(4)}`);
  } else if (dampingType === 'underdamped') {
    steps.push(`Underdamped form: x(t) = x(∞) + e^(-αt)[B₁cos(ω_d·t) + B₂sin(ω_d·t)]`);
    steps.push(`v_C coefficients: B₁ = ${solVC.A1.toFixed(4)}, B₂ = ${solVC.A2.toFixed(4)}`);
    steps.push(`i_L coefficients: B₁ = ${solIL.A1.toFixed(4)}, B₂ = ${solIL.A2.toFixed(4)}`);
  } else {
    steps.push(`Critically damped form: x(t) = x(∞) + (D₁ + D₂t)e^(-αt)`);
    steps.push(`v_C coefficients: D₁ = ${solVC.A1.toFixed(4)}, D₂ = ${solVC.A2.toFixed(4)}`);
    steps.push(`i_L coefficients: D₁ = ${solIL.A1.toFixed(4)}, D₂ = ${solIL.A2.toFixed(4)}`);
  }

  steps.push(``);
  steps.push(`v_C(t) = ${eqVC}`);
  steps.push(`i_L(t) = ${eqIL}`);

  // --- Step 6: Generate plot points ---
  const numPts = 300;
  const pointsVC: { t: number; value: number }[] = [];
  const pointsIL: { t: number; value: number }[] = [];
  for (let i = 0; i <= numPts; i++) {
    const t = (i / numPts) * tFinal;
    pointsVC.push({ t, value: fnVC(t) });
    pointsIL.push({ t, value: fnIL(t) });
  }

  // Verification
  steps.push(``);
  const voltageScale = Math.max(Math.abs(Vs), Math.abs(vC0), Math.abs(iL0) * Math.sqrt(L / C), 1e-12);
  const currentScale = Math.max(Math.abs(iL0), voltageScale * Math.sqrt(C / L), 1e-12);
  const physical = [
    { name: 'Capacitor continuity', residual: fnVC(0) - vC0, scale: voltageScale, unit: 'V' },
    { name: 'Inductor continuity', residual: fnIL(0) - iL0, scale: currentScale, unit: 'A' },
    { name: 'DC KVL', residual: topology === 'series' ? (excitation === 'step' ? Vs : 0) - R * iLss - vCss : vCss, scale: voltageScale, unit: 'V' },
    { name: 'DC KCL', residual: topology === 'series' ? iLss : -vCss / R - iLss, scale: currentScale, unit: 'A' },
  ];
  for (let i = 0; i <= numPts; i++) {
    const t = i * tFinal / numPts;
    const v = fnVC(t), current = fnIL(t);
    physical.push(
      { name: `KCL at ${t.toPrecision(4)} s`, residual: topology === 'series' ? C * solVC.derivative(t) - current : C * solVC.derivative(t) + v / R + current, scale: currentScale, unit: 'A' },
      { name: `KVL at ${t.toPrecision(4)} s`, residual: topology === 'series' ? L * solIL.derivative(t) + R * current + v - (excitation === 'step' ? Vs : 0) : L * solIL.derivative(t) - v, scale: voltageScale, unit: 'V' },
    );
  }
  const physicalAudit = auditRLC(physical);
  if (!physicalAudit.ok) {
    const failure = physicalAudit.checks.find(check => !check.ok);
    throw new Error(`Unsupported or unverified: ${failure?.name} residual ${failure?.residual.toExponential(3)} ${failure?.unit}. Answer withheld.`);
  }
  const endpoint = auditRLC([
    { name: 'v_C(t_final) − v_C(∞)', residual: fnVC(tFinal) - vCss, scale: voltageScale, unit: 'V' },
    { name: 'i_L(t_final) − i_L(∞)', residual: fnIL(tFinal) - iLss, scale: currentScale, unit: 'A' },
  ]);
  steps.push(`Physical initial-condition/KCL/KVL audit passed; maximum normalized residual = ${Math.max(...physicalAudit.checks.map(check => Math.abs(check.residual) / check.scale)).toExponential(3)}.`);
  steps.push(`Analytical DC limit: v_C(∞) = ${vCss} V, i_L(∞) = ${iLss} A.`);
  steps.push(`Finite plot endpoint t_final = ${tFinal} s is not infinity.`);
  for (const check of endpoint.checks) {
    steps.push(`${check.ok ? 'PASS' : 'NOT SETTLED'}: ${check.name} = ${check.residual.toExponential(4)} ${check.unit}.`);
  }
  steps.push(endpoint.ok ? 'Verified within tested RLC scope.' : 'Unverified steady-state endpoint: the plotted transient has not settled; do not treat its last sample as the final value.');

  return {
    alpha,
    omega0,
    dampingType,
    s1: { re: s1re, im: s1im },
    s2: { re: s2re, im: s2im },
    omegaD,
    equationVC: eqVC,
    equationIL: eqIL,
    pointsVC,
    pointsIL,
    steps,
    verification: { ok: physicalAudit.ok && endpoint.ok, physicalOk: physicalAudit.ok, settled: endpoint.ok, endpoint: endpoint.checks },
  };
}
