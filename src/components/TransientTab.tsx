import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { solveTransient, TransientInput, TransientResult } from "@/lib/circuit-solver";
import StepDisplay from "./StepDisplay";
import { Play, Timer } from "lucide-react";
import { solveVerifiedTransient } from '@/lib/verified-transient';

const TransientTab = () => {
  const [input, setInput] = useState<TransientInput>({
    type: 'RC',
    R: 1000,
    L_or_C: 0.001,
    Vs: 10,
    initialValue: 0,
    tFinal: 0.01,
  });
  const [result, setResult] = useState<TransientResult | null>(null);
  const [error, setError] = useState('');

  const update = (field: keyof TransientInput, val: string) => {
    setResult(null);
    if (field === 'type') {
      setInput({ ...input, type: val as 'RC' | 'RL' });
    } else {
      setInput({ ...input, [field]: val.trim() ? Number(val) : NaN });
    }
  };

  const solve = () => { try { setError(''); setResult(solveVerifiedTransient(input)); } catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'Unverified transient.'); } };

  // Simple SVG chart
  const renderChart = () => {
    if (!result) return null;
    const { points } = result;
    const maxT = points[points.length - 1].t;
    const vals = points.map(p => p.value);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;
    const W = 600, H = 200, pad = 40;

    const toX = (t: number) => pad + (t / maxT) * (W - 2 * pad);
    const toY = (v: number) => H - pad - ((v - minV) / range) * (H - 2 * pad);

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');

    // tau marker
    const tauX = toX(result.tau);
    const tauVal = points.find(p => Math.abs(p.t - result.tau) < maxT / 200)?.value ?? 0;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <line key={frac} x1={pad} x2={W - pad} y1={pad + frac * (H - 2 * pad)} y2={pad + frac * (H - 2 * pad)} className="stroke-border" strokeWidth="0.5" />
        ))}
        {/* Axes */}
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="stroke-muted-foreground" strokeWidth="1" />
        <line x1={pad} x2={pad} y1={pad} y2={H - pad} className="stroke-muted-foreground" strokeWidth="1" />
        {/* Response curve */}
        <path d={pathD} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
        {/* Tau marker */}
        {result.tau < maxT && (
          <>
            <line x1={tauX} x2={tauX} y1={pad} y2={H - pad} className="stroke-accent" strokeWidth="1" strokeDasharray="4,3" />
            <text x={tauX + 4} y={pad + 12} className="fill-accent text-[10px] font-mono">τ</text>
          </>
        )}
        {/* Labels */}
        <text x={W / 2} y={H - 5} className="fill-muted-foreground text-[10px] font-mono" textAnchor="middle">Time (s)</text>
        <text x={5} y={H / 2} className="fill-muted-foreground text-[10px] font-mono" textAnchor="middle" transform={`rotate(-90, 10, ${H / 2})`}>
          {input.type === 'RC' ? 'v(t)' : 'i(t)'}
        </text>
        {/* Min/Max labels */}
        <text x={pad - 4} y={H - pad + 3} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{minV.toFixed(2)}</text>
        <text x={pad - 4} y={pad + 4} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{maxV.toFixed(2)}</text>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          First-Order Transient Parameters
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Circuit Type</Label>
            <Select value={input.type} onValueChange={(v) => update('type', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RC">RC Circuit</SelectItem>
                <SelectItem value="RL">RL Circuit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">R (Ω)</Label>
            <Input type="number" value={input.R} onChange={e => update('R', e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{input.type === 'RC' ? 'C (F)' : 'L (H)'}</Label>
            <Input type="number" value={input.L_or_C} onChange={e => update('L_or_C', e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">V_source (V)</Label>
            <Input type="number" value={input.Vs} onChange={e => update('Vs', e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{input.type === 'RC' ? 'v(0⁺)' : 'i(0⁺)'}</Label>
            <Input type="number" value={input.initialValue} onChange={e => update('initialValue', e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">t_final (s)</Label>
            <Input type="number" value={input.tFinal} onChange={e => update('tFinal', e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
        </div>

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Analyze Transient
        </Button>
      </div>

      {error && <p role="alert" className="text-destructive">{error}</p>}
      {result && (
        <div className="space-y-4 animate-slide-up">
          <p role="status" className="text-success text-sm">Verified — explicit series RC/RL; independent endpoint equations, continuity and power checks passed.</p>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                <span className="text-xs text-muted-foreground">Time Constant τ</span>
                <p className="text-lg font-mono font-bold text-primary glow-text">{result.tau.toExponential(3)} s</p>
              </div>
              <div className="px-4 py-2 rounded-md bg-accent/10 border border-accent/30">
                <span className="text-xs text-muted-foreground">Final Value</span>
                <p className="text-lg font-mono font-bold text-accent">{result.finalValue.toFixed(4)} {input.type === 'RC' ? 'V' : 'A'}</p>
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted/50 border border-border mb-4">
              <span className="text-xs text-muted-foreground block mb-1">Response Equation</span>
              <p className="font-mono text-sm text-equation break-all">{result.equation}</p>
            </div>

            {renderChart()}
          </div>

          <div className="p-4 rounded-lg bg-card border border-border">
            <StepDisplay steps={result.steps} verification="verified" />
          </div>
        </div>
      )}
    </div>
  );
};

export default TransientTab;
