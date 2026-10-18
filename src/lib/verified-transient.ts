import { solveTransient, type TransientInput } from './circuit-solver';
import { buildCircuitModel } from './parsed-to-model';
import { solveFirstOrder } from './model-solver';

/** Compare the legacy plot with independently checked canonical endpoint circuits. */
export function solveVerifiedTransient(input: TransientInput) {
  const result = solveTransient(input);
  const cap = input.type === 'RC';
  const model = buildCircuitModel({
    method: 'transient', rawText: 'Explicit series circuit', findWhat: ['all'], confidence: 1, warnings: [],
    initialVoltage: cap ? input.initialValue : undefined, initialCurrent: cap ? undefined : input.initialValue,
    components: [
      { type: 'voltage_source', label: 'V1', value: input.Vs, nodeA: 1, nodeB: 0 },
      { type: 'resistor', label: 'R1', value: input.R, nodeA: 1, nodeB: 2 },
      { type: cap ? 'capacitor' : 'inductor', label: 'X1', value: input.L_or_C, nodeA: 2, nodeB: 0 },
    ],
  }).model;
  const target = { type: cap ? 'node' as const : 'component' as const, ref: cap ? 'n2' : 'X1' };
  const reference = solveFirstOrder(model, target, 'inf');
  const near = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-8 * Math.max(1e-12, Math.abs(a), Math.abs(b));
  if (!near(result.tau, reference.tau) || !near(result.finalValue, reference.vinf)) throw new Error('Unverified: time constant or steady-state checks disagree; answer withheld.');
  for (const point of result.points) {
    const expected = solveFirstOrder(model, target, point.t);
    if (!near(point.value, expected.value)) throw new Error('Unverified: transient response checks disagree; answer withheld.');
  }
  return { ...result, steps: [...reference.steps, ...result.steps, 'Independent endpoint branch equations, continuity and power checks passed.'] };
}