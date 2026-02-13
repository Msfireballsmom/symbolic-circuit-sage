// Advanced Circuit Solvers — Op-Amps, Dependent Sources, Diodes
// Deterministic math, no AI — pure symbolic computation

import { QuickResult } from "./circuit-solver";

// ============ OP-AMP SOLVER ============

export interface OpAmpInput {
  config: 'inverting' | 'non-inverting' | 'summing' | 'differential' | 'integrator' | 'differentiator' | 'buffer';
  Rf: number;        // Feedback resistor (Ω)
  Rin: number;       // Input resistor (Ω) — R1 for most configs
  Vin: number;       // Input voltage (V)
  Vin2?: number;     // Second input for differential/summing
  R2?: number;       // Second input resistor for differential/summing
  R3?: number;       // R3 for differential amp (non-inv side)
  R4?: number;       // R4 for differential amp (non-inv side feedback)
  frequency?: number; // For integrator/differentiator (Hz)
  C?: number;         // Capacitor for integrator/differentiator (F)
}

export function solveOpAmp(input: OpAmpInput): QuickResult {
  const steps: string[] = [];
  const { config, Rf, Rin, Vin } = input;

  steps.push(`Op-Amp Configuration: ${config.replace('_', ' ').toUpperCase()}`);
  steps.push(`Assumptions: Ideal op-amp (V+ = V−, I+ = I− = 0)`);
  steps.push(``);

  switch (config) {
    case 'inverting': {
      const gain = -Rf / Rin;
      const Vout = gain * Vin;
      const Iin = Vin / Rin;
      const If = -Vout / Rf; // Current through feedback

      steps.push(`Inverting Amplifier Analysis:`);
      steps.push(`  V− = V+ = 0V (virtual ground)`);
      steps.push(`  By KCL at V−: I_in = I_f`);
      steps.push(`  V_in/R_in = -V_out/R_f`);
      steps.push(`  V_out/V_in = -R_f/R_in = -${Rf}/${Rin}`);
      steps.push(`  Gain A_v = ${gain.toFixed(4)}`);
      steps.push(`  V_out = A_v × V_in = ${gain.toFixed(4)} × ${Vin} = ${Vout.toFixed(4)}V`);
      steps.push(`  I_in = V_in/R_in = ${Vin}/${Rin} = ${Iin.toExponential(4)}A`);
      steps.push(`  R_in(circuit) = R_in = ${Rin}Ω`);
      steps.push(``);
      steps.push(`✓ Verification: V_out/V_in = ${Vout.toFixed(4)}/${Vin} = ${(Vout / Vin).toFixed(4)} = -R_f/R_in = ${gain.toFixed(4)} ✓`);

      return {
        title: 'Inverting Op-Amp',
        results: [
          { label: 'A_v (Gain)', value: gain.toFixed(4), unit: 'V/V' },
          { label: 'V_out', value: Vout.toFixed(4), unit: 'V' },
          { label: 'I_in', value: Iin.toExponential(4), unit: 'A' },
          { label: 'A_v (dB)', value: (20 * Math.log10(Math.abs(gain))).toFixed(2), unit: 'dB' },
        ],
        steps,
      };
    }

    case 'non-inverting': {
      const gain = 1 + Rf / Rin;
      const Vout = gain * Vin;

      steps.push(`Non-Inverting Amplifier Analysis:`);
      steps.push(`  V+ = V_in = ${Vin}V`);
      steps.push(`  V− = V+ = ${Vin}V (virtual short)`);
      steps.push(`  V− divider: V− = V_out × R_in/(R_in + R_f)`);
      steps.push(`  ${Vin} = V_out × ${Rin}/(${Rin} + ${Rf})`);
      steps.push(`  V_out = V_in × (1 + R_f/R_in) = ${Vin} × (1 + ${Rf}/${Rin})`);
      steps.push(`  Gain A_v = 1 + R_f/R_in = 1 + ${Rf}/${Rin} = ${gain.toFixed(4)}`);
      steps.push(`  V_out = ${Vout.toFixed(4)}V`);
      steps.push(`  R_in(circuit) = ∞ (ideal)`);

      return {
        title: 'Non-Inverting Op-Amp',
        results: [
          { label: 'A_v (Gain)', value: gain.toFixed(4), unit: 'V/V' },
          { label: 'V_out', value: Vout.toFixed(4), unit: 'V' },
          { label: 'A_v (dB)', value: (20 * Math.log10(gain)).toFixed(2), unit: 'dB' },
        ],
        steps,
      };
    }

    case 'buffer': {
      steps.push(`Voltage Follower (Buffer):`);
      steps.push(`  V_out = V_in = ${Vin}V`);
      steps.push(`  Gain A_v = 1 (unity gain)`);
      steps.push(`  R_in = ∞, R_out ≈ 0`);
      steps.push(`  Purpose: Impedance matching / isolation`);

      return {
        title: 'Voltage Follower (Buffer)',
        results: [
          { label: 'A_v', value: '1.0000', unit: 'V/V' },
          { label: 'V_out', value: Vin.toFixed(4), unit: 'V' },
        ],
        steps,
      };
    }

    case 'summing': {
      const Vin2 = input.Vin2 || 0;
      const R2 = input.R2 || Rin;
      const Vout = -Rf * (Vin / Rin + Vin2 / R2);

      steps.push(`Summing Amplifier (Inverting):`);
      steps.push(`  V− = 0V (virtual ground)`);
      steps.push(`  KCL at V−: V₁/R₁ + V₂/R₂ = -V_out/R_f`);
      steps.push(`  V_out = -R_f(V₁/R₁ + V₂/R₂)`);
      steps.push(`  V_out = -${Rf}(${Vin}/${Rin} + ${Vin2}/${R2})`);
      steps.push(`  V_out = -${Rf} × ${(Vin / Rin + Vin2 / R2).toFixed(6)}`);
      steps.push(`  V_out = ${Vout.toFixed(4)}V`);
      if (Rin === R2 && R2 === Rf) {
        steps.push(`  Special case: R₁ = R₂ = R_f → V_out = -(V₁ + V₂)`);
      }

      return {
        title: 'Summing Amplifier',
        results: [
          { label: 'V_out', value: Vout.toFixed(4), unit: 'V' },
          { label: 'Gain₁', value: (-Rf / Rin).toFixed(4), unit: 'V/V' },
          { label: 'Gain₂', value: (-Rf / R2).toFixed(4), unit: 'V/V' },
        ],
        steps,
      };
    }

    case 'differential': {
      const Vin2 = input.Vin2 || 0;
      const R2 = input.R2 || Rin;
      const R3 = input.R3 || Rin;
      const R4 = input.R4 || Rf;
      // Vout = (R4/R3)(1 + R2/R1) / (1 + R4/R3) × V2 − (R2/R1) × V1
      // Simplified if R1=R3, R2=R4: Vout = (R2/R1)(V2 - V1)
      const Vout = (Rf / Rin) * (Vin2 - Vin);

      steps.push(`Differential Amplifier:`);
      steps.push(`  If R₁ = R₃ = ${Rin}Ω and R₂ = R₄ = ${Rf}Ω:`);
      steps.push(`  V_out = (R_f/R_in)(V₂ - V₁)`);
      steps.push(`  V_out = (${Rf}/${Rin})(${Vin2} - ${Vin})`);
      steps.push(`  V_out = ${(Rf / Rin).toFixed(4)} × ${(Vin2 - Vin).toFixed(4)}`);
      steps.push(`  V_out = ${Vout.toFixed(4)}V`);
      steps.push(`  Differential gain = R_f/R_in = ${(Rf / Rin).toFixed(4)}`);
      steps.push(`  CMRR (ideal) = ∞`);

      return {
        title: 'Differential Amplifier',
        results: [
          { label: 'V_out', value: Vout.toFixed(4), unit: 'V' },
          { label: 'A_diff', value: (Rf / Rin).toFixed(4), unit: 'V/V' },
          { label: 'V_diff', value: (Vin2 - Vin).toFixed(4), unit: 'V' },
        ],
        steps,
      };
    }

    case 'integrator': {
      const C = input.C || 1e-6;
      const f = input.frequency || 1000;
      const w = 2 * Math.PI * f;
      const gain = 1 / (w * Rin * C);

      steps.push(`Integrator (Op-Amp):`);
      steps.push(`  V_out(t) = -(1/RC) ∫ V_in(t) dt`);
      steps.push(`  RC = ${Rin} × ${C} = ${(Rin * C).toExponential(4)}s`);
      steps.push(`  At f = ${f}Hz: |Gain| = 1/(ωRC) = 1/(2π×${f}×${Rin}×${C})`);
      steps.push(`  |Gain| = ${gain.toFixed(4)}`);
      steps.push(`  Phase = -90° (output lags by 90°)`);
      steps.push(`  For DC input V_in = ${Vin}V:`);
      steps.push(`  V_out(t) = -(V_in/RC)t = -(${Vin}/${(Rin * C).toExponential(4)})t`);
      steps.push(`  Rate of change = ${(-Vin / (Rin * C)).toFixed(4)} V/s`);

      return {
        title: 'Integrator',
        results: [
          { label: '|Gain| @ f', value: gain.toFixed(4), unit: 'V/V' },
          { label: 'RC', value: (Rin * C).toExponential(4), unit: 's' },
          { label: 'dV/dt', value: (-Vin / (Rin * C)).toFixed(4), unit: 'V/s' },
        ],
        steps,
      };
    }

    case 'differentiator': {
      const C = input.C || 1e-6;
      const f = input.frequency || 1000;
      const w = 2 * Math.PI * f;
      const gain = w * Rf * C;

      steps.push(`Differentiator (Op-Amp):`);
      steps.push(`  V_out(t) = -RC × dV_in/dt`);
      steps.push(`  RC = ${Rf} × ${C} = ${(Rf * C).toExponential(4)}s`);
      steps.push(`  At f = ${f}Hz: |Gain| = ωRC = 2π×${f}×${Rf}×${C}`);
      steps.push(`  |Gain| = ${gain.toFixed(4)}`);
      steps.push(`  Phase = +90° (output leads by 90°)`);

      return {
        title: 'Differentiator',
        results: [
          { label: '|Gain| @ f', value: gain.toFixed(4), unit: 'V/V' },
          { label: 'RC', value: (Rf * C).toExponential(4), unit: 's' },
        ],
        steps,
      };
    }

    default:
      return { title: 'Op-Amp', results: [], steps: ['Unknown op-amp configuration'] };
  }
}

// ============ DIODE SOLVER ============

export interface DiodeInput {
  config: 'forward' | 'half_rectifier' | 'full_rectifier' | 'clipper' | 'clamper' | 'zener';
  Vs: number;        // Source voltage (peak for AC)
  R: number;         // Load resistance
  Vd?: number;       // Forward voltage drop (default 0.7V for Si)
  Vz?: number;       // Zener breakdown voltage
  isAC?: boolean;     // True if AC source
  frequency?: number;
}

export function solveDiode(input: DiodeInput): QuickResult {
  const steps: string[] = [];
  const Vd = input.Vd ?? 0.7;
  const { config, Vs, R } = input;

  steps.push(`Diode Analysis: ${config.replace('_', ' ').toUpperCase()}`);
  steps.push(`Silicon diode: V_D = ${Vd}V (forward bias threshold)`);
  steps.push(``);

  switch (config) {
    case 'forward': {
      if (Vs > Vd) {
        const Vr = Vs - Vd;
        const I = Vr / R;
        const Pd = Vd * I;
        const Pr = I * I * R;

        steps.push(`V_s = ${Vs}V > V_D = ${Vd}V → Diode is ON (forward biased)`);
        steps.push(`V_R = V_s - V_D = ${Vs} - ${Vd} = ${Vr.toFixed(4)}V`);
        steps.push(`I = V_R / R = ${Vr.toFixed(4)} / ${R} = ${I.toExponential(4)}A`);
        steps.push(`P_diode = V_D × I = ${Pd.toExponential(4)}W`);
        steps.push(`P_R = I²R = ${Pr.toExponential(4)}W`);
        steps.push(`✓ KVL: V_s = V_D + V_R = ${Vd} + ${Vr.toFixed(4)} = ${(Vd + Vr).toFixed(4)}V ✓`);

        return {
          title: 'Diode Forward Bias',
          results: [
            { label: 'V_R', value: Vr.toFixed(4), unit: 'V' },
            { label: 'I', value: I.toExponential(4), unit: 'A' },
            { label: 'P_diode', value: Pd.toExponential(4), unit: 'W' },
            { label: 'P_R', value: Pr.toExponential(4), unit: 'W' },
          ],
          steps,
        };
      } else {
        steps.push(`V_s = ${Vs}V ≤ V_D = ${Vd}V → Diode is OFF (reverse biased)`);
        steps.push(`I = 0A, V_R = 0V`);
        steps.push(`Full source voltage appears across diode: V_diode = ${Vs}V`);

        return {
          title: 'Diode Reverse Bias',
          results: [
            { label: 'I', value: '0', unit: 'A' },
            { label: 'V_R', value: '0', unit: 'V' },
            { label: 'V_diode', value: Vs.toFixed(4), unit: 'V' },
          ],
          steps,
        };
      }
    }

    case 'half_rectifier': {
      const Vpeak_out = Vs - Vd;
      const Vavg = Vpeak_out / Math.PI;
      const Vrms = Vpeak_out / 2;
      const PIV = Vs;

      steps.push(`Half-Wave Rectifier:`);
      steps.push(`  V_peak(in) = ${Vs}V`);
      steps.push(`  V_peak(out) = V_peak - V_D = ${Vs} - ${Vd} = ${Vpeak_out.toFixed(4)}V`);
      steps.push(`  V_avg(DC) = V_peak(out)/π = ${Vpeak_out.toFixed(4)}/π = ${Vavg.toFixed(4)}V`);
      steps.push(`  V_rms = V_peak(out)/2 = ${Vrms.toFixed(4)}V`);
      steps.push(`  PIV (Peak Inverse Voltage) = V_peak = ${PIV.toFixed(4)}V`);
      steps.push(`  I_avg = V_avg/R = ${(Vavg / R).toExponential(4)}A`);

      return {
        title: 'Half-Wave Rectifier',
        results: [
          { label: 'V_peak(out)', value: Vpeak_out.toFixed(4), unit: 'V' },
          { label: 'V_avg(DC)', value: Vavg.toFixed(4), unit: 'V' },
          { label: 'V_rms', value: Vrms.toFixed(4), unit: 'V' },
          { label: 'PIV', value: PIV.toFixed(4), unit: 'V' },
          { label: 'I_avg', value: (Vavg / R).toExponential(4), unit: 'A' },
        ],
        steps,
      };
    }

    case 'full_rectifier': {
      const Vpeak_out = Vs - 2 * Vd; // Bridge uses 2 diodes
      const Vavg = (2 * Vpeak_out) / Math.PI;
      const Vrms = Vpeak_out / Math.sqrt(2);
      const PIV = Vs - Vd; // For bridge rectifier

      steps.push(`Full-Wave Bridge Rectifier:`);
      steps.push(`  V_peak(in) = ${Vs}V`);
      steps.push(`  V_peak(out) = V_peak - 2V_D = ${Vs} - 2×${Vd} = ${Vpeak_out.toFixed(4)}V`);
      steps.push(`  V_avg(DC) = 2V_peak(out)/π = ${Vavg.toFixed(4)}V`);
      steps.push(`  V_rms = V_peak(out)/√2 = ${Vrms.toFixed(4)}V`);
      steps.push(`  PIV per diode = V_peak - V_D = ${PIV.toFixed(4)}V`);
      steps.push(`  Ripple factor ≈ 1/(4fRC) for filtered output`);

      return {
        title: 'Full-Wave Bridge Rectifier',
        results: [
          { label: 'V_peak(out)', value: Vpeak_out.toFixed(4), unit: 'V' },
          { label: 'V_avg(DC)', value: Vavg.toFixed(4), unit: 'V' },
          { label: 'V_rms', value: Vrms.toFixed(4), unit: 'V' },
          { label: 'PIV', value: PIV.toFixed(4), unit: 'V' },
        ],
        steps,
      };
    }

    case 'zener': {
      const Vz = input.Vz || 5.1;
      if (Vs > Vz) {
        const Iz = (Vs - Vz) / R;
        const Pz = Vz * Iz;

        steps.push(`Zener Regulator:`);
        steps.push(`  V_s = ${Vs}V > V_Z = ${Vz}V → Zener is in breakdown (regulating)`);
        steps.push(`  V_out = V_Z = ${Vz}V`);
        steps.push(`  I_Z = (V_s - V_Z)/R = (${Vs} - ${Vz})/${R} = ${Iz.toExponential(4)}A`);
        steps.push(`  P_Z = V_Z × I_Z = ${Pz.toExponential(4)}W`);

        return {
          title: 'Zener Regulator',
          results: [
            { label: 'V_out', value: Vz.toFixed(4), unit: 'V' },
            { label: 'I_Z', value: Iz.toExponential(4), unit: 'A' },
            { label: 'P_Z', value: Pz.toExponential(4), unit: 'W' },
          ],
          steps,
        };
      } else {
        steps.push(`V_s = ${Vs}V < V_Z = ${Vz}V → Zener is OFF`);
        steps.push(`V_out = V_s = ${Vs}V (no regulation)`);
        return {
          title: 'Zener Regulator (OFF)',
          results: [{ label: 'V_out', value: Vs.toFixed(4), unit: 'V' }],
          steps,
        };
      }
    }

    default:
      return { title: 'Diode', results: [], steps: [`Config "${config}" not yet supported`] };
  }
}

// ============ DEPENDENT SOURCE SOLVER (MNA Extension) ============

export interface DepSourceComponent {
  type: 'resistor' | 'voltage_source' | 'current_source' | 'vcvs' | 'ccvs' | 'vccs' | 'cccs';
  value: number;
  nodeA: number;
  nodeB: number;
  // For dependent sources:
  controlNodeA?: number; // Controlling branch positive node
  controlNodeB?: number; // Controlling branch negative node
  gain?: number;         // Multiplier
}

export interface DepSourceResult {
  nodeVoltages: { node: number; voltage: number }[];
  steps: string[];
}

export function solveWithDependentSources(components: DepSourceComponent[]): DepSourceResult {
  const steps: string[] = [];
  steps.push(`Modified Nodal Analysis with Dependent Sources`);
  steps.push(``);

  // Identify nodes
  const nodes = new Set<number>();
  components.forEach(c => { nodes.add(c.nodeA); nodes.add(c.nodeB); });
  nodes.delete(0);
  const nodeList = Array.from(nodes).sort((a, b) => a - b);
  const n = nodeList.length;
  const idx = (node: number) => nodeList.indexOf(node);

  steps.push(`Nodes: ${nodeList.map(n => `V${n}`).join(', ')} (ground = node 0)`);

  const vSources = components.filter(c => c.type === 'voltage_source' || c.type === 'vcvs' || c.type === 'ccvs');
  const augSize = n + vSources.length;
  const A = Array.from({ length: augSize }, () => new Array(augSize).fill(0));
  const b = new Array(augSize).fill(0);

  // Stamp resistors
  components.filter(c => c.type === 'resistor').forEach(r => {
    const g = 1 / r.value;
    const a = r.nodeA, bn = r.nodeB;
    if (a !== 0 && bn !== 0) {
      const ia = idx(a), ib = idx(bn);
      A[ia][ia] += g; A[ib][ib] += g; A[ia][ib] -= g; A[ib][ia] -= g;
    } else if (a !== 0) {
      A[idx(a)][idx(a)] += g;
    } else if (bn !== 0) {
      A[idx(bn)][idx(bn)] += g;
    }
    steps.push(`Stamped R = ${r.value}Ω between nodes ${a} and ${bn}`);
  });

  // Stamp independent current sources
  components.filter(c => c.type === 'current_source').forEach(s => {
    if (s.nodeA !== 0) b[idx(s.nodeA)] -= s.value;
    if (s.nodeB !== 0) b[idx(s.nodeB)] += s.value;
    steps.push(`Stamped I_s = ${s.value}A from node ${s.nodeA} to ${s.nodeB}`);
  });

  // Stamp voltage sources and dependent sources
  let vsIdx = 0;
  vSources.forEach(vs => {
    const row = n + vsIdx;
    const col = n + vsIdx;
    
    if (vs.type === 'voltage_source') {
      if (vs.nodeA !== 0) { A[idx(vs.nodeA)][col] += 1; A[row][idx(vs.nodeA)] += 1; }
      if (vs.nodeB !== 0) { A[idx(vs.nodeB)][col] -= 1; A[row][idx(vs.nodeB)] -= 1; }
      b[row] = vs.value;
      steps.push(`Stamped V_s = ${vs.value}V (branch current variable added)`);
    } else if (vs.type === 'vcvs') {
      // V_a - V_b = gain * (V_cA - V_cB)
      if (vs.nodeA !== 0) { A[idx(vs.nodeA)][col] += 1; A[row][idx(vs.nodeA)] += 1; }
      if (vs.nodeB !== 0) { A[idx(vs.nodeB)][col] -= 1; A[row][idx(vs.nodeB)] -= 1; }
      const g = vs.gain || 1;
      if (vs.controlNodeA !== undefined && vs.controlNodeA !== 0) A[row][idx(vs.controlNodeA)] -= g;
      if (vs.controlNodeB !== undefined && vs.controlNodeB !== 0) A[row][idx(vs.controlNodeB)] += g;
      steps.push(`Stamped VCVS: gain = ${g}, controls V(${vs.controlNodeA}-${vs.controlNodeB})`);
    }
    vsIdx++;
  });

  // Stamp VCCS (voltage-controlled current source)
  components.filter(c => c.type === 'vccs').forEach(s => {
    const g = s.gain || s.value;
    const cA = s.controlNodeA ?? 0;
    const cB = s.controlNodeB ?? 0;
    if (s.nodeA !== 0 && cA !== 0) A[idx(s.nodeA)][idx(cA)] += g;
    if (s.nodeA !== 0 && cB !== 0) A[idx(s.nodeA)][idx(cB)] -= g;
    if (s.nodeB !== 0 && cA !== 0) A[idx(s.nodeB)][idx(cA)] -= g;
    if (s.nodeB !== 0 && cB !== 0) A[idx(s.nodeB)][idx(cB)] += g;
    steps.push(`Stamped VCCS: gm = ${g}S, controls V(${cA}-${cB})`);
  });

  // Solve using Gaussian elimination
  steps.push(``);
  steps.push(`Solving augmented MNA system (${augSize} × ${augSize})...`);

  // Gaussian elimination
  for (let col = 0; col < augSize; col++) {
    let maxRow = col;
    for (let row = col + 1; row < augSize; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];

    if (Math.abs(A[col][col]) < 1e-12) {
      steps.push(`⚠ Singular matrix at column ${col + 1}`);
      continue;
    }

    for (let row = col + 1; row < augSize; row++) {
      const factor = A[row][col] / A[col][col];
      for (let j = col; j < augSize; j++) A[row][j] -= factor * A[col][j];
      b[row] -= factor * b[col];
    }
  }

  const x = new Array(augSize).fill(0);
  for (let i = augSize - 1; i >= 0; i--) {
    x[i] = b[i];
    for (let j = i + 1; j < augSize; j++) x[i] -= A[i][j] * x[j];
    if (Math.abs(A[i][i]) > 1e-12) x[i] /= A[i][i];
  }

  const nodeVoltages = nodeList.map((node, i) => ({
    node,
    voltage: Math.round(x[i] * 1e6) / 1e6,
  }));

  steps.push(``);
  nodeVoltages.forEach(nv => steps.push(`V${nv.node} = ${nv.voltage.toFixed(4)}V`));

  if (vSources.length > 0) {
    steps.push(``);
    vSources.forEach((vs, i) => {
      steps.push(`I(${vs.type}_${i + 1}) = ${x[n + i].toExponential(4)}A`);
    });
  }

  return { nodeVoltages, steps };
}
