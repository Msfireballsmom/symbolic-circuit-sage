import type { AnalysisRequest, Component } from '@/lib/circuit-model';

export type AnswerGuardResult =
  | { ok: true }
  | { ok: false; code: 'SOURCELESS_OPERATING_POINT'; message: string; remedy: string };

/** Answerability is separate from the certified engine's numerical correctness. */
export function guardAnswer(
  components: readonly Component[],
  questions: readonly AnalysisRequest[],
  findWhat: readonly string[],
): AnswerGuardResult {
  const hasIndependentSource = components.some(c => c.kind === 'vsource' || c.kind === 'isource');
  const hasOperatingPointQuestion = questions.some(q => q.kind === 'solve' || q.kind === 'power');
  if (hasIndependentSource || !hasOperatingPointQuestion) return { ok: true };

  return {
    ok: false,
    code: 'SOURCELESS_OPERATING_POINT',
    message: 'The question cannot be answered from this netlist. With no independent source, the DC operating point is trivially zero; zero voltage or zero current is not an answer to the question that was asked.',
    remedy: findWhat.includes('resistance')
      ? 'Equivalent resistance is not computed by the verified engine yet. The two measurement terminals must be explicitly stated and confirmed; they cannot be guessed from draft node numbers.'
      : 'Confirm the intended independent source and its connections, or choose a supported analysis matching the question. Source-free RC/RL transients require explicit initial conditions.',
  };
}