import { solveRLC, type RLCInput } from '@/lib/circuit-solver';

/** Round upwards to two significant figures, never shortening an audited horizon. */
function roundHorizonUp(time: number): number {
  const step = 10 ** (Math.floor(Math.log10(time)) - 1);
  return Number((Math.ceil(time / step) * step).toPrecision(2));
}

/** Poles seed the search; only the solver's unchanged physical/endpoint audit accepts it. */
export function suggestRLCFinalTime(input: RLCInput): number {
  const poles = solveRLC({ ...input, tFinal: 1 });
  const decay = Math.min(Math.hypot(poles.s1.re, poles.s1.im), poles.alpha);
  if (!Number.isFinite(decay) || decay <= 0) {
    throw new Error('Cannot suggest t_final: the poles do not have a finite positive decay rate.');
  }
  let candidate = roundHorizonUp(6 / decay);
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = solveRLC({ ...input, tFinal: candidate });
    if (result.verification.physicalOk && result.verification.settled && result.verification.ok) {
      return candidate;
    }
    candidate = roundHorizonUp(candidate * 1.25);
  }
  throw new Error('Cannot suggest t_final: the endpoint audit has not settled after 100 extensions.');
}

/** The tab and regression tests share the shipped parameters and audited default. */
export function defaultRLCInput(): RLCInput {
  const input: RLCInput = {
    topology: 'series', R: 200, L: 0.05, C: 0.0002, Vs: 10,
    excitation: 'step', vC0: 0, iL0: 0, tFinal: 1,
  };
  return { ...input, tFinal: suggestRLCFinalTime(input) };
}