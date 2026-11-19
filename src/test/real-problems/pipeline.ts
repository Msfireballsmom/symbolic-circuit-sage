// Runs a problem through the same path the Snap & Solve card uses:
// parseProblem → (student confirms the parsed netlist unchanged) → buildCircuitModel
// → guardAnswer → preflight → solveQuestion per question → DC re-solve +
// requireIndependentAgreement + powerBalance → "allVerified".
// This mirrors src/components/VerifiedSolution.tsx line for line; nothing is
// hand-built. The RLC path mirrors src/components/RLCTransientTab.tsx.
import { parseProblem, type ParsedProblem } from '@/lib/problem-parser';
import { buildCircuitModel, analysisKindFor } from '@/lib/parsed-to-model';
import { guardAnswer } from '@/lib/answer-guard';
import { preflight } from '@/lib/preflight';
import { powerBalance, solveDCOperatingPoint, solveQuestion, type SolveResult } from '@/lib/model-solver';
import { requireIndependentAgreement } from '@/lib/independent-dc';
import type { AnalysisRequest } from '@/lib/circuit-model';
import { solveRLC, type RLCInput, type RLCResult } from '@/lib/circuit-solver';
import { suggestRLCFinalTime } from '@/lib/rlc-settling';

export interface SageRun {
  parsed: ParsedProblem;
  shown: boolean; // the card shows "Verified solution" with numbers
  withheldBy: string | null;
  answers: { question: AnalysisRequest; result?: SolveResult; error?: string }[];
  terminals: Record<string, [string, string]>;
}

export function runSage(text: string): SageRun {
  const parsed = parseProblem(text);
  const confirmed: ParsedProblem = structuredClone(parsed);
  const build = buildCircuitModel(confirmed);
  const guard = guardAnswer(build.model.components, build.model.questions, confirmed.findWhat);
  const check = preflight(build.model);
  const kind = analysisKindFor(confirmed.method);
  const gate = !guard.ok || !check.ok || build.unsupported.length > 0 || kind === null;
  const answers = gate ? [] : build.model.questions.map(question => {
    try { return { question, result: solveQuestion(build.model, question) }; }
    catch (e) { return { question, error: (e as Error).message }; }
  });
  let verificationOk = false;
  if (!gate) {
    try {
      const dc = solveDCOperatingPoint(build.model);
      requireIndependentAgreement(build.model, dc.nodeVoltages);
      const b = powerBalance(build.model, dc);
      verificationOk = Math.abs(b.residual) < 1e-6 * Math.max(1, Math.abs(b.delivered));
    } catch { verificationOk = false; }
  }
  const shown = guard.ok && answers.length > 0 && answers.every(a => a.result) && verificationOk;
  const withheldBy = shown ? null
    : !guard.ok ? `answer-guard: ${guard.code}`
    : !check.ok ? `preflight: ${check.blocking.map(b => b.code).join(', ')}`
    : build.unsupported.length ? `unsupported: ${build.unsupported.map(u => u.kind).join(', ')}`
    : kind === null ? `method "${confirmed.method}" has no verified path`
    : answers.find(a => a.error)?.error ? `solver: ${answers.find(a => a.error)!.error}`
    : 'verification failed';
  const terminals: Record<string, [string, string]> = {};
  for (const c of build.model.components) terminals[c.id] = [c.terminals[0], c.terminals[1]];
  return { parsed, shown, withheldBy, answers, terminals };
}

/** RLC tab, auto t_final (default UI state), as the student would type the values. */
export function runRLCTab(input: Omit<RLCInput, 'tFinal'>): { result?: RLCResult; error?: string; tFinal?: number } {
  try {
    const tFinal = suggestRLCFinalTime({ ...input, tFinal: 1 });
    const result = solveRLC({ ...input, tFinal });
    if (!result.verification.physicalOk) throw new Error('Physical residuals did not pass. Answer withheld.');
    return { result, tFinal };
  } catch (e) { return { error: (e as Error).message }; }
}

/** RLC tab with the auto switch off and t_final typed by hand: the last plotted point is t_final. */
export function rlcTabValueAt(input: Omit<RLCInput, 'tFinal'>, t: number): { vC: number; iL: number } | { error: string } {
  try {
    const r = solveRLC({ ...input, tFinal: t });
    if (!r.verification.physicalOk) throw new Error('Physical residuals did not pass. Answer withheld.');
    const last = r.pointsVC.length - 1;
    return { vC: r.pointsVC[last].value, iL: r.pointsIL[last].value };
  } catch (e) { return { error: (e as Error).message }; }
}
