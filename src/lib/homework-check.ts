import {
  solveAC, solveCurrentDivider, solveOhmsLaw, solvePower, solveSeriesParallel,
  solveThevenin, solveTransient, solveVoltageDivider,
} from './circuit-solver';

export const HOMEWORK_RELATIVE = 0.02;
export const HOMEWORK_ABSOLUTE = 1e-6;

export type HomeworkKind =
  | 'ohms_law'
  | 'voltage_divider'
  | 'current_divider'
  | 'series'
  | 'parallel'
  | 'thevenin'
  | 'power'
  | 'rc_transient'
  | 'rl_transient'
  | 'ac_phasor';

export interface HomeworkComparison {
  label: string;
  studentValue: number;
  correctValue: number;
  match: boolean;
  percentError: number;
}

const numberFrom = (results: { label: string; value: string }[], label: string) => {
  const found = results.find(result => result.label === label);
  const value = found ? Number(found.value) : NaN;
  if (!Number.isFinite(value)) throw new Error(`Unverified: calculator did not return ${label}.`);
  return value;
};

export function answersMatch(student: number, correct: number) {
  if (!Number.isFinite(student) || !Number.isFinite(correct)) return false;
  return Math.abs(student - correct) <= Math.max(HOMEWORK_RELATIVE * Math.abs(correct), HOMEWORK_ABSOLUTE);
}

function finish(label: string, studentValue: number, correctValue: number): HomeworkComparison {
  if (!Number.isFinite(studentValue) || !Number.isFinite(correctValue)) {
    throw new Error('No finite answer to compare. Answer withheld.');
  }
  const percentError = Math.abs(correctValue) < 1e-12
    ? Math.abs(studentValue - correctValue)
    : Math.abs((studentValue - correctValue) / correctValue) * 100;
  return { label, studentValue, correctValue, match: answersMatch(studentValue, correctValue), percentError };
}

export function gradeHomework(
  kind: HomeworkKind,
  given: Record<string, number>,
  student: Record<string, number>,
): { comparisons: HomeworkComparison[]; steps: string[] } {
  const need = (...keys: string[]) => {
    for (const key of keys) if (!Number.isFinite(given[key])) throw new Error(`Missing a finite value for ${key}.`);
  };
  const comparisons: HomeworkComparison[] = [];
  let steps: string[] = [];
  if (kind === 'ohms_law') {
    need('V', 'R');
    const solved = solveOhmsLaw({ V: given.V, R: given.R });
    steps = solved.steps;
    const current = numberFrom(solved.results, 'I');
    comparisons.push(finish('Current I (A)', student.I, current));
    if (Number.isFinite(student.P)) comparisons.push(finish('Power P (W)', student.P, given.V * current));
  } else if (kind === 'voltage_divider') {
    need('Vs', 'R1', 'R2');
    const solved = solveVoltageDivider(given.Vs, given.R1, given.R2);
    steps = solved.steps;
    comparisons.push(finish('V_out (V)', student.Vout, numberFrom(solved.results, 'V_out')));
  } else if (kind === 'current_divider') {
    need('Is', 'R1', 'R2');
    const solved = solveCurrentDivider(given.Is, given.R1, given.R2);
    steps = solved.steps;
    comparisons.push(finish('I₁ (A)', student.I1, numberFrom(solved.results, 'I₁')));
  } else if (kind === 'series' || kind === 'parallel') {
    need('R1', 'R2');
    const values = [given.R1, given.R2];
    if (Number.isFinite(given.R3)) values.push(given.R3);
    const solved = solveSeriesParallel(values, kind);
    steps = solved.steps;
    comparisons.push(finish('R_eq (Ω)', student.Req, numberFrom(solved.results, 'R_eq')));
  } else if (kind === 'thevenin') {
    need('Voc', 'Isc');
    const solved = solveThevenin(given.Voc, given.Isc);
    steps = solved.steps;
    comparisons.push(finish('R_th (Ω)', student.Rth, numberFrom(solved.results, 'R_th')));
  } else if (kind === 'power') {
    need('V', 'R');
    const solved = solvePower({ V: given.V, R: given.R });
    steps = solved.steps;
    comparisons.push(finish('Power P (W)', student.P, numberFrom(solved.results, 'P (V²/R)')));
  } else if (kind === 'rc_transient' || kind === 'rl_transient') {
    const rc = kind === 'rc_transient';
    need('R', rc ? 'C' : 'L', 'Vs');
    const storage = rc ? given.C : given.L;
    const solved = solveTransient({ type: rc ? 'RC' : 'RL', R: given.R, L_or_C: storage, Vs: given.Vs, initialValue: 0, tFinal: rc ? 5 * given.R * storage : 5 * storage / given.R });
    const tau = rc ? given.R * given.C : given.L / given.R;
    const finalValue = rc ? given.Vs : given.Vs / given.R;
    if (!answersMatch(solved.tau, tau) || !answersMatch(solved.finalValue, finalValue)) {
      throw new Error('Unverified: transient calculator disagrees with τ and the steady value. Answer withheld.');
    }
    steps = solved.steps;
    comparisons.push(finish('τ (s)', student.tau, solved.tau));
    comparisons.push(finish(rc ? 'Final voltage (V)' : 'Final current (A)', student.final, solved.finalValue));
  } else if (kind === 'ac_phasor') {
    need('Vm', 'f', 'R', 'L', 'C');
    const solved = solveAC({ Vm: given.Vm, phase: 0, frequency: given.f, R: given.R, L: given.L, C: given.C, config: 'series' });
    steps = solved.steps;
    comparisons.push(finish('|Z| (Ω)', student.Z, Math.hypot(solved.impedance.re, solved.impedance.im)));
    comparisons.push(finish('Power factor', student.PF, solved.powerFactor));
  } else {
    throw new Error('This homework type has no verified calculator.');
  }
  if (!comparisons.length) throw new Error('No answer to compare. Answer withheld.');
  return { comparisons, steps };
}
