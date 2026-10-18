import { useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, ShieldCheck, XCircle } from "lucide-react";
import StepDisplay from "@/components/StepDisplay";
import { preflight } from "@/lib/preflight";
import { buildCircuitModel, analysisKindFor } from "@/lib/parsed-to-model";
import {
  powerBalance, solveDCOperatingPoint, solveQuestion,
  UnsupportedProblemError, type SolveResult,
} from "@/lib/model-solver";
import type { ParsedProblem } from "@/lib/problem-parser";
import type { AnalysisRequest } from "@/lib/circuit-model";

interface Answer {
  question: AnalysisRequest;
  result?: SolveResult;
  error?: { message: string; remedy?: string };
}

const fmt = (v: number, unit?: string) => {
  const abs = Math.abs(v);
  const text = abs !== 0 && (abs < 1e-3 || abs >= 1e6) ? v.toExponential(4) : v.toPrecision(6);
  return unit ? `${text} ${unit}` : text;
};

/**
 * The verified path: confirmed netlist → CircuitModel → preflight → deterministic
 * solve → power verification → full worked solution. Anything the engine cannot
 * prove is reported as unsupported, never approximated.
 */
const VerifiedSolution = ({ parsed, onSolved }: { parsed: ParsedProblem; onSolved?: () => void }) => {
  const build = useMemo(() => buildCircuitModel(parsed), [parsed]);
  const check = useMemo(() => preflight(build.model), [build.model]);

  const answers = useMemo<Answer[]>(() => {
    if (!check.ok || build.unsupported.length || analysisKindFor(parsed.method) === null) return [];
    return build.model.questions.map((question) => {
      try {
        return { question, result: solveQuestion(build.model, question) };
      } catch (e) {
        const err = e as Error;
        return {
          question,
          error: {
            message: err.message,
            remedy: e instanceof UnsupportedProblemError ? e.remedy : undefined,
          },
        };
      }
    });
  }, [build.model, build.unsupported.length, check.ok, parsed.method]);

  const verification = useMemo(() => {
    if (!check.ok || build.unsupported.length || analysisKindFor(parsed.method) === null) return null;
    try {
      const dc = solveDCOperatingPoint(build.model);
      const b = powerBalance(build.model, dc);
      return { ...b, ok: Math.abs(b.residual) < 1e-6 * Math.max(1, Math.abs(b.delivered)) };
    } catch {
      return null;
    }
  }, [build.model, check.ok]);

  const namedKind = analysisKindFor(parsed.method);
  const allVerified = answers.length > 0 && answers.every(answer => answer.result) && verification?.ok === true;
  useEffect(() => { if (allVerified) onSolved?.(); }, [allVerified, onSolved]);

  return (
    <Card className="border-primary/30">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          {allVerified ? 'Verified solution — independent equations and power checks passed' : 'Answer withheld — unsupported or unverified'}
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Solved from the netlist you confirmed. Every number below comes from modified nodal
          analysis, not from a language model.
        </p>
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-4">
        {/* Preflight */}
        {!check.ok && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 space-y-1">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Preflight blocked the solve
            </p>
            {check.blocking.map((issue, i) => (
              <p key={i} className="text-xs text-destructive/90">
                {issue.message}{issue.fix ? ` — ${issue.fix}` : ""}
              </p>
            ))}
          </div>
        )}

        {check.warnings.length > 0 && (
          <div className="p-3 rounded-md bg-warning/10 border border-warning/30 space-y-1">
            <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Check these before you submit
            </p>
            {check.warnings.map((issue, i) => (
              <p key={i} className="text-xs text-warning/90">
                {issue.message}{issue.fix ? ` — ${issue.fix}` : ""}
              </p>
            ))}
          </div>
        )}

        {build.unsupported.length > 0 && (
          <div className="p-3 rounded-md bg-muted border border-border">
            <p className="text-xs font-semibold text-foreground mb-1">Not covered by the verified engine</p>
            <p className="text-[11px] text-muted-foreground">
              {build.unsupported.map((u) => `${u.id} (${u.kind.replace(/_/g, " ")})`).join(", ")} —
              the complete answer is withheld; these components cannot be omitted safely.
            </p>
          </div>
        )}

        {namedKind === null && (
          <p className="text-[11px] text-muted-foreground">
            The named method “{parsed.method.replace(/_/g, " ")}” has no verified path yet. The DC
            answer is withheld. Use a dedicated tab only within its explicitly tested scope.
          </p>
        )}

        {/* Answers */}
        {answers.map(({ question, result, error }, i) => (
          <div key={i} className="rounded-md border border-border overflow-hidden">
            <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] uppercase">{question.kind}</Badge>
              <span className="text-xs text-foreground">{question.sourceText}</span>
            </div>
            <div className="p-3 space-y-3">
              {result && allVerified ? (
                <>
                  <p className="text-lg font-mono font-bold text-primary glow-text">
                    {result.numeric !== undefined ? fmt(result.numeric, result.units) : "—"}
                  </p>
                  {result.extras && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.extras).map(([k, v]) => (
                        <Badge key={k} variant="secondary" className="text-[10px] font-mono">
                          {k} = {fmt(v)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <StepDisplay steps={result.steps} verification="verified" />
                  {result.assumptions.length > 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Assumptions: </span>
                      {result.assumptions.join(" ")}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-warning">
                  <p>{error?.message ?? 'Answer withheld because the complete solve or physical verification did not pass.'}</p>
                  {error?.remedy && <p className="text-muted-foreground mt-1">{error.remedy}</p>}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Power verification */}
        {verification && (
          <div className={`p-3 rounded-md border ${verification.ok ? "bg-success/10 border-success/30" : "bg-warning/10 border-warning/30"}`}>
            <p className={`text-xs font-semibold flex items-center gap-1.5 ${verification.ok ? "text-success" : "text-warning"}`}>
              {verification.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              Power balance {verification.ok ? "verified" : "off — do not trust this result"}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              delivered {fmt(verification.delivered, "W")} · dissipated {fmt(verification.dissipated, "W")} ·
              residual {verification.residual.toExponential(2)} W
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VerifiedSolution;
