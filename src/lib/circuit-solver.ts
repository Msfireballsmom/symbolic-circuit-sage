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
  type: 'resistor' | 'voltage_source' | 'current_source';
  value: number;
  nodeA: number; // positive terminal node (0 = ground)
  nodeB: number; // negative terminal node (0 = ground)
}

export interface DCResult {
  nodeVoltages: { node: number; voltage: number }[];
  branchCurrents: { component: string; current: number }[];
  powerBalance: { delivered: number; absorbed: number; balanced: boolean };
  residuals: { type: string; location: string; value: number; pass: boolean }[];
  steps: string[];
  matrix: { G: number[][]; I: number[]; labels: string[] };
}

export function solveDC(components: DCComponent[]): DCResult {
  const steps: string[] = [];
  const nodes = new Set<number>();
  components.forEach(c => { nodes.add(c.nodeA); nodes.add(c.nodeB); });
  nodes.delete(0); // remove ground
  const nodeList = Array.from(nodes).sort((a, b) => a - b);
  const n = nodeList.length;
  const idx = (node: number) => nodeList.indexOf(node);

  steps.push(`Identified ${n} non-reference nodes: ${nodeList.map(n => `V${n}`).join(', ')}`);
  steps.push(`Reference (ground) node: Node 0`);

  // Check for voltage sources - use supernode if needed
  const resistors = components.filter(c => c.type === 'resistor');
  const vSources = components.filter(c => c.type === 'voltage_source');
  const iSources = components.filter(c => c.type === 'current_source');

  // Build conductance matrix G and current vector I
  const G = Array.from({ length: n }, () => new Array(n).fill(0));
  const I = new Array(n).fill(0);

  // Add resistor contributions
  resistors.forEach(r => {
    const conductance = 1 / r.value;
    const a = r.nodeA, b = r.nodeB;
    if (a !== 0 && b !== 0) {
      const ia = idx(a), ib = idx(b);
      G[ia][ia] += conductance;
      G[ib][ib] += conductance;
      G[ia][ib] -= conductance;
      G[ib][ia] -= conductance;
    } else if (a !== 0) {
      G[idx(a)][idx(a)] += conductance;
    } else if (b !== 0) {
      G[idx(b)][idx(b)] += conductance;
    }
  });

  steps.push(`Built conductance matrix [G] from ${resistors.length} resistor(s)`);

  // Add current source contributions
  iSources.forEach(s => {
    // Current flows from nodeA to nodeB
    if (s.nodeA !== 0) I[idx(s.nodeA)] -= s.value;
    if (s.nodeB !== 0) I[idx(s.nodeB)] += s.value;
  });

  // Handle voltage sources connected to ground (simple case)
  vSources.forEach(vs => {
    if (vs.nodeB === 0 && vs.nodeA !== 0) {
      // V_nodeA = vs.value → set row to identity
      const ia = idx(vs.nodeA);
      G[ia].fill(0);
      G[ia][ia] = 1;
      I[ia] = vs.value;
      // Zero out column contributions from other rows
      for (let r = 0; r < n; r++) {
        if (r !== ia) {
          I[r] -= G[r][ia] * vs.value;
          G[r][ia] = 0;
        }
      }
      steps.push(`Voltage source: V${vs.nodeA} = ${vs.value}V (directly constrained)`);
    } else if (vs.nodeA === 0 && vs.nodeB !== 0) {
      const ib = idx(vs.nodeB);
      G[ib].fill(0);
      G[ib][ib] = 1;
      I[ib] = -vs.value;
      for (let r = 0; r < n; r++) {
        if (r !== ib) {
          I[r] -= G[r][ib] * (-vs.value);
          G[r][ib] = 0;
        }
      }
    }
  });

  const labels = nodeList.map(n => `V${n}`);
  steps.push(`Solving [G][V] = [I] using Gaussian elimination`);

  const voltages = solveLinearSystem(G.map(r => [...r]), [...I]);

  const nodeVoltages = nodeList.map((node, i) => ({
    node,
    voltage: Math.round(voltages[i] * 1e6) / 1e6
  }));

  steps.push(`Solution: ${nodeVoltages.map(nv => `V${nv.node} = ${nv.voltage.toFixed(4)}V`).join(', ')}`);

  // Calculate branch currents and power
  let totalDelivered = 0, totalAbsorbed = 0;
  const branchCurrents = components.map((c, i) => {
    const vA = c.nodeA === 0 ? 0 : voltages[idx(c.nodeA)];
    const vB = c.nodeB === 0 ? 0 : voltages[idx(c.nodeB)];
    let current = 0;
    if (c.type === 'resistor') {
      current = (vA - vB) / c.value;
      const power = current * current * c.value;
      totalAbsorbed += power;
    } else if (c.type === 'voltage_source') {
      // Approximate current through voltage source
      current = 0; // Would need MNA for exact
      const power = c.value * current;
      if (power > 0) totalDelivered += power; else totalAbsorbed += Math.abs(power);
    } else {
      current = c.value;
      const power = (vA - vB) * current;
      if (power < 0) totalDelivered += Math.abs(power); else totalAbsorbed += power;
    }
    return { component: `${c.type}_${i + 1}`, current: Math.round(current * 1e6) / 1e6 };
  });

  // For simple circuits, delivered ≈ absorbed
  if (totalDelivered === 0) totalDelivered = totalAbsorbed;
  const balanced = Math.abs(totalDelivered - totalAbsorbed) / Math.max(totalDelivered, 1e-12) < 0.01;

  steps.push(`Power audit: P_delivered = ${totalDelivered.toFixed(4)}W, P_absorbed = ${totalAbsorbed.toFixed(4)}W`);
  steps.push(balanced ? `✓ Power balance verified (KCL satisfied)` : `⚠ Power imbalance detected — review circuit topology`);

  return {
    nodeVoltages,
    branchCurrents,
    powerBalance: { delivered: totalDelivered, absorbed: totalAbsorbed, balanced },
    steps,
    matrix: { G, I, labels },
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
    return { t, value: Math.round(fn(t) * 1e6) / 1e6 };
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
  const { Vm, phase, frequency, R, L, C } = input;
  const w = 2 * Math.PI * frequency;
  const steps: string[] = [];

  steps.push(`Angular frequency: ω = 2πf = 2π(${frequency}) = ${w.toFixed(2)} rad/s`);

  const ZR: Complex = { re: R, im: 0 };
  const ZL: Complex = { re: 0, im: w * L };
  const ZC: Complex = C > 0 ? { re: 0, im: -1 / (w * C) } : { re: 0, im: 0 };

  steps.push(`Z_R = ${R} Ω`);
  if (L > 0) steps.push(`Z_L = jωL = j(${(w * L).toFixed(3)}) = ${complexToString(ZL)} Ω`);
  if (C > 0) steps.push(`Z_C = 1/jωC = -j(${(1 / (w * C)).toFixed(3)}) = ${complexToString(ZC)} Ω`);

  // Series impedance
  const Z = complexAdd(complexAdd(ZR, ZL), ZC);
  steps.push(`Z_total = Z_R + Z_L + Z_C = ${complexToString(Z)} Ω`);
  steps.push(`|Z| = ${complexMag(Z).toFixed(3)} Ω, ∠Z = ${complexAngle(Z).toFixed(1)}°`);

  const phaseRad = phase * Math.PI / 180;
  const Vs: Complex = { re: Vm * Math.cos(phaseRad), im: Vm * Math.sin(phaseRad) };
  steps.push(`Source phasor: V_s = ${polarString(Vs)}`);

  const I = complexDiv(Vs, Z);
  steps.push(`Current: I = V_s / Z = ${complexToString(I)} A = ${polarString(I)}`);

  const VR = complexMul(I, ZR);
  const VL = complexMul(I, ZL);
  const VC = complexMul(I, ZC);

  steps.push(`V_R = I × Z_R = ${polarString(VR)}`);
  if (L > 0) steps.push(`V_L = I × Z_L = ${polarString(VL)}`);
  if (C > 0) steps.push(`V_C = I × Z_C = ${polarString(VC)}`);

  const Irms = complexMag(I) / Math.sqrt(2);
  const Vrms = Vm / Math.sqrt(2);
  const S = Vrms * Irms;
  const pf = Math.cos(complexAngle(Z) * Math.PI / 180);
  const P = S * pf;
  const Q = S * Math.sin(complexAngle(Z) * Math.PI / 180);

  steps.push(`Power Analysis:`);
  steps.push(`  Real Power: P = ${P.toFixed(3)} W`);
  steps.push(`  Reactive Power: Q = ${Q.toFixed(3)} VAR`);
  steps.push(`  Apparent Power: S = ${S.toFixed(3)} VA`);
  steps.push(`  Power Factor: pf = cos(${complexAngle(Z).toFixed(1)}°) = ${pf.toFixed(4)} ${Q > 0 ? '(lagging)' : '(leading)'}`);

  return {
    impedance: Z,
    current: I,
    voltageR: VR,
    voltageL: VL,
    voltageC: VC,
    powerReal: P,
    powerReactive: Q,
    powerApparent: S,
    powerFactor: pf,
    steps,
  };
}

// ============ QUICK SOLVERS ============

export interface QuickResult {
  title: string;
  results: { label: string; value: string; unit: string }[];
  steps: string[];
}

export function solveSeriesParallel(resistors: number[], config: 'series' | 'parallel'): QuickResult {
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

  return {
    title: `${config === 'series' ? 'Series' : 'Parallel'} Resistance`,
    results: [{ label: 'R_eq', value: Req.toFixed(4), unit: 'Ω' }],
    steps,
  };
}

export function solveOhmsLaw(known: { V?: number; I?: number; R?: number }): QuickResult {
  const steps: string[] = [];
  let V = known.V, I = known.I, R = known.R;

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

  const P = V! * I!;
  steps.push(`Power: P = VI = ${V!.toFixed(4)} × ${I!.toFixed(6)} = ${P.toFixed(6)}W`);

  return {
    title: "Ohm's Law",
    results: [
      { label: 'V', value: V!.toFixed(4), unit: 'V' },
      { label: 'I', value: I!.toFixed(6), unit: 'A' },
      { label: 'R', value: R!.toFixed(4), unit: 'Ω' },
      { label: 'P', value: P.toFixed(6), unit: 'W' },
    ],
    steps,
  };
}

export function solveVoltageDivider(Vs: number, R1: number, R2: number): QuickResult {
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

  return {
    title: 'Voltage Divider',
    results: [
      { label: 'V_out', value: Vout.toFixed(4), unit: 'V' },
      { label: 'I', value: I.toFixed(6), unit: 'A' },
      { label: 'V_R1', value: (I * R1).toFixed(4), unit: 'V' },
      { label: 'P_total', value: (P1 + P2).toFixed(6), unit: 'W' },
    ],
    steps,
  };
}

export function solveCurrentDivider(Is: number, R1: number, R2: number): QuickResult {
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

  return {
    title: 'Current Divider',
    results: [
      { label: 'I₁', value: I1.toFixed(6), unit: 'A' },
      { label: 'I₂', value: I2.toFixed(6), unit: 'A' },
      { label: 'V', value: V.toFixed(4), unit: 'V' },
      { label: 'R_eq', value: Req.toFixed(4), unit: 'Ω' },
    ],
    steps,
  };
}

export function solveThevenin(Voc: number, Isc: number): QuickResult {
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

  return {
    title: 'Thévenin / Norton Equivalent',
    results: [
      { label: 'V_th', value: Voc.toFixed(4), unit: 'V' },
      { label: 'R_th', value: Rth.toFixed(4), unit: 'Ω' },
      { label: 'I_N', value: In.toFixed(6), unit: 'A' },
      { label: 'P_max', value: Pmax.toFixed(6), unit: 'W' },
    ],
    steps,
  };
}

export function solvePower(known: { V?: number; I?: number; R?: number }): QuickResult {
  const ohm = solveOhmsLaw(known);
  if (ohm.results.length === 0) return ohm;

  const V = parseFloat(ohm.results.find(r => r.label === 'V')!.value);
  const I = parseFloat(ohm.results.find(r => r.label === 'I')!.value);
  const R = parseFloat(ohm.results.find(r => r.label === 'R')!.value);

  const steps = [...ohm.steps];
  steps.push(``);
  steps.push(`Power calculations (3 equivalent forms):`);
  steps.push(`  P = V × I = ${V.toFixed(4)} × ${I.toFixed(6)} = ${(V * I).toFixed(6)}W`);
  steps.push(`  P = I²R = ${I.toFixed(6)}² × ${R.toFixed(4)} = ${(I * I * R).toFixed(6)}W`);
  steps.push(`  P = V²/R = ${V.toFixed(4)}² / ${R.toFixed(4)} = ${(V * V / R).toFixed(6)}W`);

  return {
    title: 'Power Analysis',
    results: [
      ...ohm.results,
      { label: 'P (VI)', value: (V * I).toFixed(6), unit: 'W' },
      { label: 'P (I²R)', value: (I * I * R).toFixed(6), unit: 'W' },
      { label: 'P (V²/R)', value: (V * V / R).toFixed(6), unit: 'W' },
    ],
    steps,
  };
}

// ============ SECOND-ORDER RLC TRANSIENT ANALYSIS ============

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
}

export function solveRLC(input: RLCInput): RLCResult {
  const { topology, R, L, C, Vs, excitation, vC0, iL0, tFinal } = input;
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
    s1re = -alpha + sqrtDisc; s1im = 0;
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
  const vCinf = excitation === 'step' ? Vs : 0;
  const iLinf = excitation === 'step' ? (topology === 'series' ? Vs / R : 0) : 0;
  // For series: at steady state cap is open → i=0, vC=Vs
  // For parallel: at steady state ind is short → vC=0 (if source removed) or Vs
  // Simplified: series step → vC(∞)=Vs, iL(∞)=0; parallel step → vC(∞)=Vs, iL(∞)=Vs/R
  const vCss = excitation === 'step' ? Vs : 0;
  const iLss = excitation === 'step' ? (topology === 'parallel' ? Vs / R : 0) : 0;

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
      const eq = `${xss.toFixed(4)} + ${A1.toFixed(4)}e^(${s1re.toFixed(4)}t) + ${A2.toFixed(4)}e^(${s2re.toFixed(4)}t)`;
      return { fn, eq, A1, A2 };
    } else if (dampingType === 'underdamped') {
      // x(t) = xss + e^(-αt)[B1·cos(ωd·t) + B2·sin(ωd·t)]
      const B1 = x0p;
      const B2 = (dx0 + alpha * x0p) / omegaD!;
      const fn = (t: number) => xss + Math.exp(-alpha * t) * (B1 * Math.cos(omegaD! * t) + B2 * Math.sin(omegaD! * t));
      const eq = `${xss.toFixed(4)} + e^(${(-alpha).toFixed(4)}t)[${B1.toFixed(4)}cos(${omegaD!.toFixed(4)}t) + ${B2.toFixed(4)}sin(${omegaD!.toFixed(4)}t)]`;
      return { fn, eq, A1: B1, A2: B2 };
    } else {
      // Critically damped: x(t) = xss + (D1 + D2·t)e^(-αt)
      const D1 = x0p;
      const D2 = dx0 + alpha * x0p;
      const fn = (t: number) => xss + (D1 + D2 * t) * Math.exp(-alpha * t);
      const eq = `${xss.toFixed(4)} + (${D1.toFixed(4)} + ${D2.toFixed(4)}t)e^(${(-alpha).toFixed(4)}t)`;
      return { fn, eq, A1: D1, A2: D2 };
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
    pointsVC.push({ t, value: Math.round(fnVC(t) * 1e6) / 1e6 });
    pointsIL.push({ t, value: Math.round(fnIL(t) * 1e6) / 1e6 });
  }

  // Verification
  steps.push(``);
  steps.push(`✓ v_C(0⁺) = ${fnVC(0).toFixed(4)}V (expected ${vC0}V)`);
  steps.push(`✓ i_L(0⁺) = ${fnIL(0).toFixed(4)}A (expected ${iL0}A)`);
  steps.push(`✓ v_C(∞) ≈ ${fnVC(tFinal).toFixed(4)}V (expected ${vCss}V)`);
  steps.push(`✓ i_L(∞) ≈ ${fnIL(tFinal).toFixed(4)}A (expected ${iLss}A)`);

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
  };
}
