import { parseQuantity } from "@/lib/quantity";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StepDisplay from "./StepDisplay";

import { gradeHomework, type HomeworkKind } from "@/lib/homework-check";
import {
  CheckCircle, XCircle, ArrowRight, BookCheck, AlertTriangle, Loader2, Sparkles
} from "lucide-react";

interface ComparisonResult {
  label: string;
  studentValue: number;
  correctValue: number;
  match: boolean;
  percentError: number;
}

const PROBLEM_TYPES = [
  { value: "ohms_law", label: "Ohm's Law" },
  { value: "voltage_divider", label: "Voltage Divider" },
  { value: "current_divider", label: "Current Divider" },
  { value: "series", label: "Series Resistance" },
  { value: "parallel", label: "Parallel Resistance" },
  { value: "thevenin", label: "Thévenin Equivalent" },
  { value: "power", label: "Power Analysis" },
  { value: "rc_transient", label: "RC Transient" },
  { value: "rl_transient", label: "RL Transient" },
  { value: "ac_phasor", label: "AC Phasor (Series RLC)" },
];

const CheckHomeworkTab = () => {
  const [problemType, setProblemType] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [comparison, setComparison] = useState<ComparisonResult[] | null>(null);
  const [steps, setSteps] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [overallPass, setOverallPass] = useState<boolean | null>(null);

  const getInputFields = (): { key: string; label: string; placeholder: string }[] => {
    switch (problemType) {
      case "ohms_law": return [
        { key: "V", label: "Voltage (V)", placeholder: "e.g. 10" },
        { key: "R", label: "Resistance (Ω)", placeholder: "e.g. 5" },
      ];
      case "voltage_divider": return [
        { key: "Vs", label: "Source Voltage (V)", placeholder: "e.g. 12" },
        { key: "R1", label: "R1 (Ω)", placeholder: "e.g. 4000" },
        { key: "R2", label: "R2 (Ω)", placeholder: "e.g. 6000" },
      ];
      case "current_divider": return [
        { key: "Is", label: "Source Current (A)", placeholder: "e.g. 0.01" },
        { key: "R1", label: "R1 (Ω)", placeholder: "e.g. 1000" },
        { key: "R2", label: "R2 (Ω)", placeholder: "e.g. 3000" },
      ];
      case "series": case "parallel": return [
        { key: "R1", label: "R1 (Ω)", placeholder: "e.g. 100" },
        { key: "R2", label: "R2 (Ω)", placeholder: "e.g. 200" },
        { key: "R3", label: "R3 (Ω, optional)", placeholder: "e.g. 300" },
      ];
      case "thevenin": return [
        { key: "Voc", label: "Open-Circuit Voltage (V)", placeholder: "e.g. 12" },
        { key: "Isc", label: "Short-Circuit Current (A)", placeholder: "e.g. 0.003" },
      ];
      case "power": return [
        { key: "V", label: "Voltage (V)", placeholder: "e.g. 24" },
        { key: "R", label: "Resistance (Ω)", placeholder: "e.g. 48" },
      ];
      case "rc_transient": return [
        { key: "R", label: "Resistance (Ω)", placeholder: "e.g. 1000" },
        { key: "C", label: "Capacitance (F)", placeholder: "e.g. 0.000001" },
        { key: "Vs", label: "Source Voltage (V)", placeholder: "e.g. 10" },
      ];
      case "rl_transient": return [
        { key: "R", label: "Resistance (Ω)", placeholder: "e.g. 100" },
        { key: "L", label: "Inductance (H)", placeholder: "e.g. 0.5" },
        { key: "Vs", label: "Source Voltage (V)", placeholder: "e.g. 10" },
      ];
      case "ac_phasor": return [
        { key: "Vm", label: "Peak Voltage (V)", placeholder: "e.g. 170" },
        { key: "f", label: "Frequency (Hz)", placeholder: "e.g. 60" },
        { key: "R", label: "R (Ω)", placeholder: "e.g. 100" },
        { key: "L", label: "L (H)", placeholder: "e.g. 0.5" },
        { key: "C", label: "C (F)", placeholder: "e.g. 0.00001" },
      ];
      default: return [];
    }
  };

  const getAnswerFields = (): { key: string; label: string }[] => {
    switch (problemType) {
      case "ohms_law": return [
        { key: "I", label: "Your Answer: Current I (A)" },
        { key: "P", label: "Your Answer: Power P (W)" },
      ];
      case "voltage_divider": return [
        { key: "Vout", label: "Your Answer: V_out (V)" },
      ];
      case "current_divider": return [
        { key: "I1", label: "Your Answer: I₁ (A)" },
      ];
      case "series": case "parallel": return [
        { key: "Req", label: "Your Answer: R_eq (Ω)" },
      ];
      case "thevenin": return [
        { key: "Rth", label: "Your Answer: R_th (Ω)" },
      ];
      case "power": return [
        { key: "P", label: "Your Answer: Power P (W)" },
      ];
      case "rc_transient": case "rl_transient": return [
        { key: "tau", label: "Your Answer: Time Constant τ (s)" },
        { key: "final", label: "Your Answer: Final Value" },
      ];
      case "ac_phasor": return [
        { key: "Z", label: "Your Answer: |Z| (Ω)" },
        { key: "PF", label: "Your Answer: Power Factor" },
      ];
      default: return [];
    }
  };

  const handleCheck = () => {
    setError('');
    setChecking(true);
    setComparison(null);
    setSteps(null);
    setOverallPass(null);

    setTimeout(() => {
      try {
        const comparisons: ComparisonResult[] = [];
        let solverSteps: string[] = [];

        const units: Record<string, string> = { V: 'V', Vs: 'V', Vm: 'V', Voc: 'V', R: 'Ω', R1: 'Ω', R2: 'Ω', R3: 'Ω', Is: 'A', Isc: 'A', C: 'F', L: 'H', f: 'Hz', I: 'A', P: 'W', Vout: 'V', I1: 'A', Req: 'Ω', Rth: 'Ω', Z: 'Ω', PF: 'unitless', tau: 's', final: problemType === 'rc_transient' ? 'V' : 'A' };
        const given: Record<string, number> = {};
        for (const field of getInputFields()) {
          if (!inputs[field.key] && field.key === 'R3') continue;
          given[field.key] = parseQuantity(inputs[field.key] ?? '', units[field.key] ?? '');
        }
        const student: Record<string, number> = {};
        for (const field of getAnswerFields()) {
          if (!studentAnswers[field.key] && (field.key === 'P' && problemType === 'ohms_law')) continue;
          student[field.key] = parseQuantity(studentAnswers[field.key] ?? '', units[field.key] ?? '');
        }
        const graded = gradeHomework(problemType as HomeworkKind, given, student);
        comparisons.push(...graded.comparisons);
        solverSteps = graded.steps;

        const allPass = comparisons.every(c => c.match);

        setComparison(comparisons);
        setSteps(solverSteps);
        setOverallPass(allPass);
      } catch (e: any) {
        setComparison([]);
        setError(e.message);
        setSteps(null);
        setOverallPass(false);
      }
      setChecking(false);
    }, 300);
  };

  const inputFields = getInputFields();
  const answerFields = getAnswerFields();

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BookCheck className="w-5 h-5 text-primary" />
            Check My Homework
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Numeric check only. A match is within 2% of the verified calculator, or within 0.000001 when that value is near zero. Written steps are not graded. Op-amps are not checked here.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Problem Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Problem Type</label>
            <Select value={problemType} onValueChange={(v) => { setProblemType(v); setComparison(null); setSteps(null); setInputs({}); setStudentAnswers({}); setOverallPass(null); }}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Select problem type..." />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_TYPES.map(pt => (
                  <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {problemType && (
            <>
              {/* Circuit Values */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Circuit Values (Given)</h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  {inputFields.map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                      <Input
                        type="text" inputMode="decimal"
                        placeholder={f.placeholder}
                        value={inputs[f.key] || ""}
                        onChange={e => setInputs(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Answers */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Your Answers
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {answerFields.map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                      <Input
                        type="text" inputMode="decimal"
                        placeholder="Enter your answer..."
                        value={studentAnswers[f.key] || ""}
                        onChange={e => setStudentAnswers(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleCheck} disabled={checking} className="gap-2" size="lg">
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookCheck className="w-4 h-4" />}
                Check My Answers
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-destructive">{error}</p>}
      {/* Results */}
      {comparison && comparison.length > 0 && (
        <Card className={`border-2 ${overallPass ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {overallPass ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400">Answers match the verified calculator</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-destructive" />
                  <span className="text-destructive">Errors Found</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comparison Table */}
            <div className="space-y-2">
              {comparison.map((c, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${c.match ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                  {c.match ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    <div className="flex items-center gap-2 text-xs font-mono mt-0.5">
                      <span className={c.match ? 'text-emerald-400' : 'text-destructive'}>
                        Your answer: {c.studentValue}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-foreground">Calculator: {c.correctValue.toPrecision(9)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${c.match ? 'border-emerald-500/30 text-emerald-400' : 'border-destructive/30 text-destructive'}`}>
                    {c.match ? '✓ Match' : `${c.percentError.toFixed(1)}% error`}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Explanation for wrong answers */}
            {!overallPass && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-foreground/80">
                    <p className="font-semibold text-amber-400 mb-1">Where you went wrong:</p>
                    {comparison.filter(c => !c.match).map((c, i) => (
                      <p key={i} className="mb-1">
                        <strong>{c.label}</strong>: You got {c.studentValue}, but the correct answer is {c.correctValue.toFixed(6)}.
                        {c.percentError > 100 ? " This is way off — check your formula or units." :
                         c.percentError > 10 ? " Significant error — check your calculation." :
                         " Close! Might be a rounding issue."}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Full Solution */}
            {steps && steps.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Full Solution (Step-by-Step)</h4>
                <StepDisplay steps={steps} defaultExpanded={!overallPass} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CheckHomeworkTab;
