import { answersMatch } from './homework-check';
import { solveBode } from './bode';
import { solveAC, solveDC, solveOhmsLaw, solveRLC, solveTransient, solveVoltageDivider } from './circuit-solver';

export interface ExamBlank {
  key: string;
  label: string;
  unit: string;
}

export interface ExamItem {
  id: string;
  topic: string;
  difficulty: 'easy' | 'medium';
  prompt: string;
  blanks: ExamBlank[];
  /** Returns the key only after a second method agrees. */
  solve: () => Record<string, number>;
}

export interface GradedBlank {
  key: string;
  label: string;
  unit: string;
  student: number;
  correct: number;
  match: boolean;
}

const close = (actual: number, expected: number) =>
  Number.isFinite(actual) && Number.isFinite(expected)
  && Math.abs(actual - expected) <= 1e-6 * Math.max(1e-9, Math.abs(actual), Math.abs(expected));

function requireClose(actual: number, expected: number, label: string) {
  if (!close(actual, expected)) throw new Error(`Unverified exam key for ${label}.`);
  return expected;
}

export const EXAM_ITEMS: ExamItem[] = [
  {
    id: 'ohm-24-6k',
    topic: 'DC',
    difficulty: 'easy',
    prompt: 'A 24 V source is connected across a 6 kΩ resistor. Enter the current in amperes and the absorbed power in watts.',
    blanks: [
      { key: 'I', label: 'Current', unit: 'A' },
      { key: 'P', label: 'Power', unit: 'W' },
    ],
    solve: () => {
      const solved = solveOhmsLaw({ V: 24, R: 6000 });
      const current = Number(solved.results.find(item => item.label === 'I')?.value);
      const power = Number(solved.results.find(item => item.label === 'P')?.value);
      return {
        I: requireClose(current, 24 / 6000, 'ohm current'),
        P: requireClose(power, (24 * 24) / 6000, 'ohm power'),
      };
    },
  },
  {
    id: 'divider-20',
    topic: 'DC',
    difficulty: 'easy',
    prompt: 'Voltage divider: 20 V across 5 kΩ on top and 15 kΩ on the bottom. Enter the voltage across the 15 kΩ resistor.',
    blanks: [{ key: 'Vout', label: 'Vout', unit: 'V' }],
    solve: () => {
      const fromDivider = Number(solveVoltageDivider(20, 5000, 15000).results[0].value);
      const nodal = solveDC([
        { type: 'voltage_source', value: 20, nodeA: 1, nodeB: 0 },
        { type: 'resistor', value: 5000, nodeA: 1, nodeB: 2 },
        { type: 'resistor', value: 15000, nodeA: 2, nodeB: 0 },
      ]);
      const v2 = nodal.nodeVoltages.find(node => node.node === 2)?.voltage ?? NaN;
      return { Vout: requireClose(fromDivider, v2, 'divider') };
    },
  },
  {
    id: 'parallel-3k-6k',
    topic: 'DC',
    difficulty: 'easy',
    prompt: '3 kΩ and 6 kΩ are in parallel across 12 V. Enter the equivalent resistance, the source current, and the current in the 3 kΩ resistor.',
    blanks: [
      { key: 'Req', label: 'R_eq', unit: 'Ω' },
      { key: 'Is', label: 'Source current', unit: 'A' },
      { key: 'I3', label: 'Current in 3 kΩ', unit: 'A' },
    ],
    solve: () => {
      const nodal = solveDC([
        { type: 'voltage_source', value: 12, nodeA: 1, nodeB: 0 },
        { type: 'resistor', value: 3000, nodeA: 1, nodeB: 0 },
        { type: 'resistor', value: 6000, nodeA: 1, nodeB: 0 },
      ]);
      const req = 1 / (1 / 3000 + 1 / 6000);
      const source = -nodal.branchCurrents[0].current;
      const through3k = nodal.branchCurrents[1].current;
      return {
        Req: requireClose(req, 2000, 'parallel resistance'),
        Is: requireClose(source, 12 / 2000, 'parallel source current'),
        I3: requireClose(through3k, 12 / 3000, '3 kΩ current'),
      };
    },
  },
  {
    id: 'nodal-two-resistors',
    topic: 'DC',
    difficulty: 'medium',
    prompt: 'Node 1 is fixed at 12 V. R1 = 1 kΩ from node 1 to node 2. R2 = 2 kΩ and R3 = 3 kΩ both go from node 2 to ground. Enter the voltage at node 2.',
    blanks: [{ key: 'V2', label: 'V2', unit: 'V' }],
    solve: () => {
      const nodal = solveDC([
        { type: 'voltage_source', value: 12, nodeA: 1, nodeB: 0 },
        { type: 'resistor', value: 1000, nodeA: 1, nodeB: 2 },
        { type: 'resistor', value: 2000, nodeA: 2, nodeB: 0 },
        { type: 'resistor', value: 3000, nodeA: 2, nodeB: 0 },
      ]);
      const v2 = nodal.nodeVoltages.find(node => node.node === 2)?.voltage ?? NaN;
      // KCL multiplied through by 6000: 6(12 − V2) = 5 V2.
      return { V2: requireClose(v2, 72 / 11, 'node 2') };
    },
  },
  {
    id: 'thevenin-divider',
    topic: 'DC',
    difficulty: 'medium',
    prompt: '30 V, then 10 kΩ, then 20 kΩ to ground. The load terminals are the 20 kΩ resistor. Enter V_th and R_th.',
    blanks: [
      { key: 'Vth', label: 'V_th', unit: 'V' },
      { key: 'Rth', label: 'R_th', unit: 'Ω' },
    ],
    solve: () => {
      const open = solveDC([
        { type: 'voltage_source', value: 30, nodeA: 1, nodeB: 0 },
        { type: 'resistor', value: 10000, nodeA: 1, nodeB: 2 },
        { type: 'resistor', value: 20000, nodeA: 2, nodeB: 0 },
      ]);
      const voc = open.nodeVoltages.find(node => node.node === 2)?.voltage ?? NaN;
      const test = solveDC([
        { type: 'current_source', value: 1, nodeA: 2, nodeB: 0 },
        { type: 'resistor', value: 10000, nodeA: 2, nodeB: 0 },
        { type: 'resistor', value: 20000, nodeA: 2, nodeB: 0 },
      ]);
      const rth = test.nodeVoltages.find(node => node.node === 2)?.voltage ?? NaN;
      return {
        Vth: requireClose(voc, 20, 'Thevenin voltage'),
        Rth: requireClose(rth, (10000 * 20000) / 30000, 'Thevenin resistance'),
      };
    },
  },
  {
    id: 'rc-discharge',
    topic: 'Transient',
    difficulty: 'easy',
    prompt: 'A 10 μF capacitor charged to 20 V discharges through 5 kΩ. Enter τ and the capacitor voltage at t = τ. The source is zero after t = 0.',
    blanks: [
      { key: 'tau', label: 'τ', unit: 's' },
      { key: 'v', label: 'v(τ)', unit: 'V' },
    ],
    solve: () => {
      const tau = 5000 * 10e-6;
      const solved = solveTransient({ type: 'RC', R: 5000, L_or_C: 10e-6, Vs: 0, initialValue: 20, tFinal: tau });
      const atTau = solved.points.reduce((best, point) => Math.abs(point.t - tau) < Math.abs(best.t - tau) ? point : best).value;
      return {
        tau: requireClose(solved.tau, tau, 'RC time constant'),
        v: requireClose(atTau, 20 * Math.exp(-1), 'RC voltage'),
      };
    },
  },
  {
    id: 'rl-step',
    topic: 'Transient',
    difficulty: 'medium',
    prompt: 'Series RL step: 10 V, 100 Ω, 200 mH, i(0) = 0. Enter τ and the current at t = 2τ.',
    blanks: [
      { key: 'tau', label: 'τ', unit: 's' },
      { key: 'i', label: 'i(2τ)', unit: 'A' },
    ],
    solve: () => {
      const tau = 0.2 / 100;
      const solved = solveTransient({ type: 'RL', R: 100, L_or_C: 0.2, Vs: 10, initialValue: 0, tFinal: 2 * tau });
      const at = solved.points.reduce((best, point) => Math.abs(point.t - 2 * tau) < Math.abs(best.t - 2 * tau) ? point : best).value;
      return {
        tau: requireClose(solved.tau, tau, 'RL time constant'),
        i: requireClose(at, 0.1 * (1 - Math.exp(-2)), 'RL current'),
      };
    },
  },
  {
    id: 'series-rlc-roots',
    topic: 'RLC',
    difficulty: 'easy',
    prompt: 'Series RLC: R = 100 Ω, L = 10 mH, C = 1 μF. Enter α = R/(2L) and ω₀ = 1/√(LC), in rad/s.',
    blanks: [
      { key: 'alpha', label: 'α', unit: 'rad/s' },
      { key: 'omega0', label: 'ω₀', unit: 'rad/s' },
    ],
    solve: () => {
      const solved = solveRLC({ topology: 'series', R: 100, L: 0.01, C: 1e-6, Vs: 0, excitation: 'natural', vC0: 1, iL0: 0, tFinal: 0.005 });
      if (!solved.verification.physicalOk) throw new Error('Unverified series RLC key.');
      return {
        alpha: requireClose(solved.alpha, 100 / (2 * 0.01), 'series alpha'),
        omega0: requireClose(solved.omega0, 1 / Math.sqrt(0.01 * 1e-6), 'series omega'),
      };
    },
  },
  {
    id: 'critical-r',
    topic: 'RLC',
    difficulty: 'medium',
    prompt: 'Find the series resistance that critically damps L = 25 mH and C = 10 μF.',
    blanks: [{ key: 'R', label: 'R', unit: 'Ω' }],
    solve: () => {
      const resistance = 2 * Math.sqrt(0.025 / 1e-5);
      const solved = solveRLC({ topology: 'series', R: resistance, L: 0.025, C: 1e-5, Vs: 0, excitation: 'natural', vC0: 1, iL0: 0, tFinal: 0.02 });
      if (solved.dampingType !== 'critically_damped' || !solved.verification.physicalOk) throw new Error('Unverified critical-resistance key.');
      return { R: requireClose(solved.alpha * 2 * 0.025, resistance, 'critical R') };
    },
  },
  {
    id: 'ac-impedance',
    topic: 'AC',
    difficulty: 'medium',
    prompt: 'Series RLC at 60 Hz: R = 100 Ω, L = 0.5 H, C = 10 μF. Enter |Z| in ohms and the impedance angle in degrees (positive if inductive).',
    blanks: [
      { key: 'Z', label: '|Z|', unit: 'Ω' },
      { key: 'angle', label: '∠Z', unit: '°' },
    ],
    solve: () => {
      const solved = solveAC({ Vm: 10, phase: 0, frequency: 60, R: 100, L: 0.5, C: 10e-6, config: 'series' });
      const omega = 2 * Math.PI * 60;
      const reactance = omega * 0.5 - 1 / (omega * 10e-6);
      return {
        Z: requireClose(Math.hypot(solved.impedance.re, solved.impedance.im), Math.hypot(100, reactance), 'impedance magnitude'),
        angle: requireClose(Math.atan2(solved.impedance.im, solved.impedance.re) * (180 / Math.PI), Math.atan2(reactance, 100) * (180 / Math.PI), 'impedance angle'),
      };
    },
  },
  {
    id: 'bode-lowpass',
    topic: 'Bode',
    difficulty: 'easy',
    prompt: 'RC low-pass: R = 1 kΩ, C = 0.1 μF. Enter the cutoff frequency in hertz and |H| in dB at 10 times that cutoff.',
    blanks: [
      { key: 'fc', label: 'f_c', unit: 'Hz' },
      { key: 'db', label: '|H| at 10 f_c', unit: 'dB' },
    ],
    solve: () => {
      const fc = 1 / (2 * Math.PI * 1000 * 0.1e-6);
      const solved = solveBode('rc_lowpass', 1000, 0, 0.1e-6, fc / 20, fc * 20);
      const corner = solved.checkpoints.find(point => Math.abs(point.freq - fc) / fc < 1e-6);
      const decade = solved.checkpoints.find(point => Math.abs(point.freq - 10 * fc) / fc < 1e-6);
      if (!corner || !decade) throw new Error('Unverified Bode key.');
      const expectedDb = 20 * Math.log10(1 / Math.sqrt(1 + 100));
      return {
        fc: requireClose(solved.fc, fc, 'cutoff'),
        db: requireClose(decade.magDb, expectedDb, 'decade magnitude'),
      };
    },
  },
];

export function verifiedExamItems() {
  return EXAM_ITEMS.flatMap(item => {
    try {
      return [{ item, key: item.solve() }];
    } catch {
      return [];
    }
  });
}

export function gradeBlanks(item: ExamItem, key: Record<string, number>, student: Record<string, number>): GradedBlank[] {
  return item.blanks.map(blank => ({
    ...blank,
    student: student[blank.key],
    correct: key[blank.key],
    match: answersMatch(student[blank.key], key[blank.key]),
  }));
}
