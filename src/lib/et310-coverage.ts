import type { CircuitModel, Component } from './circuit-model';
import { solveDCOperatingPoint, solveFirstOrder, solveQuestion, powerBalance, verifyKCL, theveninAt } from './model-solver';
import { solveRLC, type RLCInput } from './circuit-solver';
import { solveMesh } from './mesh-solver';
import { solveLaplace } from './laplace-solver';
import { solveFourier } from './fourier-solver';

export interface CoverageCase { id: string; topic: string; run: () => void }
export interface CoverageTopic { id: string; week: string; topic: string; scope: string }
export const ET310_TOPICS: CoverageTopic[] = [
  { id: 'time', week: '1', topic: 'Time-varying charge / current / voltage', scope: 'Coming soon: differentiation and integration of arbitrary time functions.' },
  { id: 'energy', week: '1', topic: 'Instantaneous power and energy', scope: 'Coming soon: time-domain power integration; DC power is covered below.' },
  { id: 'resistivity', week: '1', topic: 'Resistivity', scope: 'Coming soon: material / length / cross-sectional area model.' },
  { id: 'dc', week: '1–2', topic: 'Ohm, series / parallel, dividers, KCL / KVL, Chapter 3 networks', scope: 'Original series-divider, parallel-source and two-mesh networks; independent algebra and power audit.' },
  { id: 'dependent', week: '1–2', topic: 'Dependent-source nodal networks', scope: 'VCVS, VCCS, CCVS, CCCS original controlled-source fixtures; not arbitrary topology certification.' },
  { id: 'equivalent', week: '2 / 5', topic: 'Network equivalents', scope: 'Resistive divider Thévenin / Norton / maximum power; remaining Chapter 7/8 exercise variants coming soon.' },
  { id: 'rc', week: '3 / 5', topic: 'First-order RC and capacitor initial conditions', scope: 'Series RC natural / forced responses with nonzero initial voltage, at 0+, finite times and infinity.' },
  { id: 'rl', week: '5', topic: 'First-order RL', scope: 'Series RL forced response and current continuity; other switching topologies coming soon.' },
  { id: 'rlc', week: '4 / 5', topic: 'Series / parallel RLC roots, damping, critical resistance', scope: 'Series natural/voltage-step and parallel natural, three damping classes; independent RK4 state-space reference. Parallel step coming soon (source ambiguity).' },
  { id: 'laplace', week: '6', topic: 'Laplace transfer functions, poles / zeros, value theorems, step / inverse response', scope: 'First-order and distinct-real second-order transfer functions only; limited residue checks, not full Laplace certification.' },
  { id: 'repeated', week: '6', topic: 'Repeated poles', scope: 'Coming soon: repeated-pole inverse transform is explicitly refused.' },
  { id: 'fourier', week: '7', topic: 'Fourier series', scope: 'Square, sawtooth and triangle coefficients vs independent midpoint quadrature; arbitrary / rectified / pulse waveforms unverified.' },
  { id: 'week8', week: '8', topic: 'No usable question text', scope: 'Coming soon: no requirements inferred.' },
  { id: 'other', week: '—', topic: 'Op-amps, AC phasors, Bode, two-ports', scope: 'Coming soon: no independent certification corpus for these domains.' },
];

/** Fixed explicit tolerances: strict algebra; quadrature/RK4 discretization separately specified. */
export function assertNear(actual: number, expected: number, tolerance = 1e-8) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance * Math.max(1, Math.abs(expected))) {
    throw new Error(`Expected ${expected}, got ${actual}; tolerance ${tolerance}`);
  }
}
const component = (id: string, kind: Component['kind'], terminals: string[], value: number, extra: Partial<Component> = {}): Component => ({
  id, kind, terminals, value: { magnitude: value, unit: kind === 'resistor' ? 'ohm' : kind === 'capacitor' ? 'farad' : kind === 'inductor' ? 'henry' : kind === 'isource' ? 'amp' : 'volt' },
  confidence: { exists: 1, value: 1 }, provenance: { from: 'text' }, ...extra,
});
function model(components: Component[]): CircuitModel {
  const ids = [...new Set(components.flatMap(c => c.terminals))];
  return { components, nodes: ids.map(id => ({ id, connects: components.filter(c => c.terminals.includes(id)).map(c => c.id), isGround: id === '0' })),
    ports: [], questions: [], couplings: [], source: { genre: 'text-only', pages: 1, regions: [] },
    meta: { referenceNode: '0', readAt: '2026-10-18T00:00:00Z', genre: 'text-only', revision: 1 } };
}
const divider = (v: number, r1: number, r2: number) => model([
  component('V', 'vsource', ['in', '0'], v), component('R1', 'resistor', ['in', 'out'], r1), component('R2', 'resistor', ['out', '0'], r2),
]);

/** Independent numerical oracle: integrate physical state equations, never app roots or response helpers. */
export function referenceRLC(input: RLCInput, t: number): [number, number] {
  let state: [number, number] = [input.vC0, input.iL0];
  const source = input.excitation === 'step' ? input.Vs : 0;
  const derivative = ([v, i]: number[]) => input.topology === 'series'
    ? [i / input.C, (source - input.R * i - v) / input.L]
    : [(-v / input.R - i) / input.C, v / input.L];
  const n = 12000, h = t / n;
  for (let j = 0; j < n; j++) {
    const k1 = derivative(state);
    const k2 = derivative(state.map((x, k) => x + h * k1[k] / 2));
    const k3 = derivative(state.map((x, k) => x + h * k2[k] / 2));
    const k4 = derivative(state.map((x, k) => x + h * k3[k]));
    state = state.map((x, k) => x + h * (k1[k] + 2 * k2[k] + 2 * k3[k] + k4[k]) / 6) as [number, number];
  }
  return state;
}
export const ET310_CASES: CoverageCase[] = [];
const add = (topic: string, id: string, run: () => void) => ET310_CASES.push({ topic, id: `${topic}/${id}`, run });
for (const [v, r1, r2] of [[12, 1000, 2000], [-9, 330, 680], [5, 4700, 2200], [24, 47, 100], [3, 7, 11]]) {
  const key = `${v}/${r1}/${r2}`;
  add('dc', `divider/${key}`, () => {
    const m = divider(v, r1, r2), dc = solveDCOperatingPoint(m), i = v / (r1 + r2);
    assertNear(dc.nodeVoltages.out, i * r2); assertNear(dc.branchCurrents.R1, i); assertNear(dc.branchCurrents.R2, i);
    assertNear(verifyKCL(m, dc), 0); assertNear(powerBalance(m, dc).residual, 0);
    assertNear(powerBalance(m, dc).dissipated, v * v / (r1 + r2));
  });
  add('dc', `parallel/${key}`, () => {
    const source = v / r1;
    const m = model([component('I', 'isource', ['out', '0'], source), component('A', 'resistor', ['out', '0'], r1), component('B', 'resistor', ['out', '0'], r2)]);
    const dc = solveDCOperatingPoint(m), req = r1 * r2 / (r1 + r2);
    assertNear(dc.nodeVoltages.out, source * req); assertNear(dc.branchCurrents.A + dc.branchCurrents.B, source);
    assertNear(powerBalance(m, dc).residual, 0);
  });
  add('dc', `mesh/${key}`, () => {
    const shared = 17, a = r1 + shared, d = r2 + shared, det = a * d - shared * shared;
    const result = solveMesh(2, [
      { type: 'resistor', value: r1, meshes: [1] }, { type: 'resistor', value: r2, meshes: [2] },
      { type: 'resistor', value: shared, meshes: [1, 2] }, { type: 'voltage_source', value: v, meshes: [1] },
    ]);
    assertNear(result.meshCurrents[0].current, d * v / det, 1e-6);
    assertNear(result.meshCurrents[1].current, shared * v / det, 1e-6);
  });
  add('equivalent', key, () => {
    const m = divider(v, r1, r2), expectedV = v * r2 / (r1 + r2), expectedR = r1 * r2 / (r1 + r2);
    const th = theveninAt(m, 'out'); assertNear(th.vth, expectedV); assertNear(th.rth, expectedR); assertNear(th.inorton, expectedV / expectedR);
    const result = solveQuestion(m, { label: 'a', kind: 'maxpower', target: { type: 'node', ref: 'out' }, deliverable: 'number', sourceText: 'Original maximum power fixture' });
    assertNear(result.numeric ?? NaN, expectedV ** 2 / (4 * expectedR));
  });
}
for (const gain of [-2, 0, 0.5, 3]) for (const kind of ['vcvs', 'vccs', 'ccvs', 'cccs'] as const) {
  add('dependent', `${kind}/${gain}`, () => {
    const v = 6, r = 300, load = 100;
    const currentControlled = kind === 'ccvs' || kind === 'cccs';
    const m = model([component('V', 'vsource', ['in', '0'], v), component('R', 'resistor', ['in', '0'], r),
      component('D', kind, ['out', '0'], 0, { control: currentControlled ? { type: 'current-through', through: 'R', gain } : { type: 'voltage-across', across: ['in', '0'], gain } }),
      component('Load', 'resistor', ['out', '0'], load)]);
    const expected = gain * (currentControlled ? v / r : v) * (kind === 'vccs' || kind === 'cccs' ? load : 1);
    const dc = solveDCOperatingPoint(m); assertNear(dc.nodeVoltages.out, expected); assertNear(verifyKCL(m, dc), 0); assertNear(powerBalance(m, dc).residual, 0);
  });
}
for (const [v, r, storage, initial] of [[10, 1000, 1e-6, 3], [0, 2000, 4e-6, -2], [-5, 300, 2e-5, 7]]) {
  for (const factor of [0, 0.5, 1, 4, Infinity]) for (const kind of ['capacitor', 'inductor'] as const) {
    const cap = kind === 'capacitor', magnitude = cap ? storage : storage * 10000;
    const tau = cap ? r * magnitude : magnitude / r;
    add(cap ? 'rc' : 'rl', `${v}/${r}/${factor}`, () => {
      const m = model([component('V', 'vsource', ['in', '0'], v), component('R', 'resistor', ['in', 'out'], r),
        component('X', kind, ['out', '0'], magnitude, { initial: { magnitude: initial, unit: cap ? 'volt' : 'amp' } })]);
      const result = solveFirstOrder(m, { type: cap ? 'node' : 'component', ref: cap ? 'out' : 'X' }, factor === Infinity ? 'inf' : factor * tau);
      const final = cap ? v : v / r;
      assertNear(result.tau, tau); assertNear(result.v0, initial); assertNear(result.vinf, final);
      assertNear(result.value, final + (initial - final) * Math.exp(-factor));
    });
  }
}
for (const topology of ['series', 'parallel'] as const) for (const ratio of [0.25, 1, 3]) for (const scale of [1, 4]) {
  for (const excitation of topology === 'series' ? ['natural', 'step'] as const : ['natural'] as const) {
    add('rlc', `${topology}/${ratio}/${scale}/${excitation}`, () => {
      const L = 0.2 * scale, C = 0.0005 / scale, critical = topology === 'series' ? 2 * Math.sqrt(L / C) : Math.sqrt(L / C) / 2;
      const R = topology === 'series' ? critical * ratio : critical / ratio;
      const t = 0.006, input: RLCInput = { topology, R, L, C, excitation, Vs: 9, vC0: 2, iL0: -0.02, tFinal: t };
      const result = solveRLC(input), expected = referenceRLC(input, t);
      assertNear(result.pointsVC[300].value, expected[0], 1e-8); assertNear(result.pointsIL[300].value, expected[1], 1e-8);
      assertNear(result.s1.re + result.s2.re, topology === 'series' ? -R / L : -1 / (R * C));
      assertNear(result.s1.re * result.s2.re - result.s1.im * result.s2.im, 1 / (L * C));
      const damping = ratio === 1 ? 'critically_damped' : ratio < 1 ? 'underdamped' : 'overdamped';
      if (result.dampingType !== damping || !result.verification.physicalOk) throw new Error('Damping or physical residual mismatch');
    });
  }
}
for (const rate of [1, 2, 7]) for (const gain of [1, 3, -2]) {
  add('laplace', `first-order/${rate}/${gain}`, () => {
    const result = solveLaplace({ numerator: [gain * rate], denominator: [1, rate], inputType: 'step' });
    assertNear(result.poles[0].re, -rate); assertNear(result.dcGain ?? NaN, gain);
    const initial = result.partialFractions.reduce((s, p) => s + (typeof p.coefficient === 'number' ? p.coefficient : NaN), 0);
    assertNear(initial, 0);
    const at1 = result.partialFractions.reduce((s, p) => s + (typeof p.coefficient === 'number' ? p.coefficient * Math.exp(p.pole.re) : NaN), 0);
    assertNear(at1, gain * (1 - Math.exp(-rate)));
  });
  add('laplace', `distinct-poles/${rate}/${gain}`, () => {
    const a = rate, b = rate + 3;
    const result = solveLaplace({ numerator: [gain, gain * 2], denominator: [1, a + b, a * b], inputType: 'impulse' });
    assertNear(result.zeros[0].re, -2); assertNear(result.dcGain ?? NaN, 2 * gain / (a * b));
    const at1 = result.partialFractions.reduce((s, p) => s + (typeof p.coefficient === 'number' ? p.coefficient * Math.exp(p.pole.re) : NaN), 0);
    assertNear(at1, gain * (2 - a) / (b - a) * Math.exp(-a) + gain * (2 - b) / (a - b) * Math.exp(-b));
  });
}
for (const waveform of ['square', 'sawtooth', 'triangle'] as const) for (const amplitude of [1, 3]) {
  add('fourier', `${waveform}/${amplitude}`, () => {
    const result = solveFourier({ waveform, amplitude, period: 0.02, dutyCycle: 0.5, numHarmonics: 5, dcOffset: 0.25 });
    assertNear(result.a0, 0.25); assertNear(result.fundamentalFreq, 50);
    // Independent midpoint quadrature over the defined waveform origin; 40000 samples.
    for (const c of result.coefficients) {
      let a = 0, b = 0;
      const n = 40000;
      for (let k = 0; k < n; k++) {
        const x = (k + 0.5) / n;
        const value = amplitude * (waveform === 'square' ? (x < 0.5 ? 1 : -1) : waveform === 'sawtooth' ? 2 * x - 1 : x < 0.5 ? 4 * x - 1 : 3 - 4 * x);
        a += 2 * value * Math.cos(2 * Math.PI * c.n * x) / n;
        b += 2 * value * Math.sin(2 * Math.PI * c.n * x) / n;
      }
      assertNear(c.an, a, 1e-7); assertNear(c.bn, b, 1e-7);
    }
  });
}
export function runET310Coverage() {
  const cases = ET310_CASES.map(test => {
    try { test.run(); return { id: test.id, topic: test.topic, ok: true, error: '' }; }
    catch (error) { return { id: test.id, topic: test.topic, ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  return ET310_TOPICS.map(topic => {
    const results = cases.filter(test => test.topic === topic.id);
    return { ...topic, total: results.length, passed: results.filter(test => test.ok).length,
      status: results.length === 0 ? 'coming soon' as const : results.every(test => test.ok) ? 'certified' as const : 'failing' as const,
      failures: results.filter(test => !test.ok) };
  });
}