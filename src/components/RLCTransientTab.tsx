import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { solveRLC, RLCInput, RLCResult } from "@/lib/circuit-solver";
import StepDisplay from "./StepDisplay";
import { Play, Waves } from "lucide-react";

const RLCTransientTab = () => {
  const [input, setInput] = useState<RLCInput>({
    topology: 'series',
    R: 200,
    L: 0.05,
    C: 0.0002,
    Vs: 10,
    excitation: 'step',
    vC0: 0,
    iL0: 0,
    tFinal: 0.05,
  });
  const [atRest, setAtRest] = useState(true);
  const [showVC, setShowVC] = useState(true);
  const [showIL, setShowIL] = useState(true);
  const [result, setResult] = useState<RLCResult | null>(null);
  const [error, setError] = useState('');

  const update = (field: keyof RLCInput, val: string) => {
    setResult(null);
    if (field === 'topology' || field === 'excitation') {
      setInput(prev => ({ ...prev, [field]: val }));
    } else {
      setInput(prev => ({ ...prev, [field]: val.trim() ? Number(val) : NaN }));
    }
  };

  const solve = () => {
    try {
      setError('');
      const inp = atRest ? { ...input, vC0: 0, iL0: 0 } : input;
      const solved = solveRLC(inp);
      if (!solved.verification.ok) throw new Error('Unverified: physical or steady-state endpoint residuals did not pass. Results and exports are withheld; increase t_final or check the circuit.');
      setResult(solved);
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    }
  };

  const renderChart = () => {
    if (!result) return null;
    const datasets: { points: { t: number; value: number }[]; label: string; color: string }[] = [];
    if (showVC) datasets.push({ points: result.pointsVC, label: 'v_C(t)', color: 'stroke-primary' });
    if (showIL) datasets.push({ points: result.pointsIL, label: 'i_L(t)', color: 'stroke-accent' });
    if (datasets.length === 0) return null;

    const allVals = datasets.flatMap(d => d.points.map(p => p.value));
    const maxT = result.pointsVC[result.pointsVC.length - 1].t;
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;
    const W = 600, H = 220, pad = 45;

    const toX = (t: number) => pad + (t / maxT) * (W - 2 * pad);
    const toY = (v: number) => H - pad - ((v - minV) / range) * (H - 2 * pad);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <line key={frac} x1={pad} x2={W - pad} y1={pad + frac * (H - 2 * pad)} y2={pad + frac * (H - 2 * pad)} className="stroke-border" strokeWidth="0.5" />
        ))}
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="stroke-muted-foreground" strokeWidth="1" />
        <line x1={pad} x2={pad} y1={pad} y2={H - pad} className="stroke-muted-foreground" strokeWidth="1" />

        {datasets.map((ds, di) => {
          const pathD = ds.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
          return <path key={di} d={pathD} fill="none" className={ds.color} strokeWidth="2" strokeLinecap="round" />;
        })}

        <text x={W / 2} y={H - 5} className="fill-muted-foreground text-[10px] font-mono" textAnchor="middle">Time (s)</text>
        <text x={pad - 4} y={H - pad + 3} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{minV.toFixed(2)}</text>
        <text x={pad - 4} y={pad + 4} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{maxV.toFixed(2)}</text>

        {/* Legend */}
        {datasets.map((ds, di) => (
          <g key={di}>
            <line x1={W - pad - 80} x2={W - pad - 60} y1={pad + 10 + di * 16} y2={pad + 10 + di * 16} className={ds.color} strokeWidth="2" />
            <text x={W - pad - 56} y={pad + 14 + di * 16} className="fill-muted-foreground text-[9px] font-mono">{ds.label}</text>
          </g>
        ))}
      </svg>
    );
  };

  const dampingLabel = result ? {
    overdamped: 'Overdamped (α > ω₀)',
    underdamped: 'Underdamped (α < ω₀)',
    critically_damped: 'Critically Damped (α = ω₀)',
  }[result.dampingType] : '';

  const dampingColor = result ? {
    overdamped: 'text-warning',
    underdamped: 'text-primary',
    critically_damped: 'text-success',
  }[result.dampingType] : '';

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Waves className="w-4 h-4 text-primary" />
          Second-Order RLC Transient Parameters
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Topology</Label>
            <Select value={input.topology} onValueChange={v => update('topology', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="series">Series RLC</SelectItem>
                <SelectItem value="parallel">Parallel RLC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Excitation</Label>
            <Select value={input.excitation} onValueChange={v => update('excitation', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="natural">Natural (source-free)</SelectItem>
                <SelectItem value="step">Step Input</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">R (Ω)</Label>
            <Input type="number" value={input.R} onChange={e => update('R', e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">L (H)</Label>
            <Input type="number" value={input.L} onChange={e => update('L', e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">C (F)</Label>
            <Input type="number" value={input.C} onChange={e => update('C', e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
          {input.excitation === 'step' && (
            <div>
              <Label className="text-xs text-muted-foreground">V_source (V)</Label>
              <Input type="number" value={input.Vs} onChange={e => update('Vs', e.target.value)} className="h-8 text-xs font-mono" />
            </div>
          )}
        </div>

        {/* Initial conditions */}
        <div className="mt-4 p-3 rounded-md bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">Initial Conditions</Label>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">At rest</Label>
              <Switch checked={atRest} onCheckedChange={value => { setAtRest(value); setResult(null); }} />
            </div>
          </div>
          {!atRest && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">v_C(0⁺) (V)</Label>
                <Input type="number" value={input.vC0} onChange={e => update('vC0', e.target.value)} className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">i_L(0⁺) (A)</Label>
                <Input type="number" value={input.iL0} onChange={e => update('iL0', e.target.value)} className="h-8 text-xs font-mono" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">t_final (s)</Label>
            <Input type="number" value={input.tFinal} onChange={e => update('tFinal', e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
        </div>

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Solve 2nd-Order RLC
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-mono">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-slide-up">
          <p role="status" className={result.verification.ok ? 'text-success text-sm' : 'text-warning text-sm'}>
            {result.verification.ok
              ? 'Verified — tested RLC scope; physical and steady-state residuals pass.'
              : 'Unverified steady-state endpoint — physical equations pass, but t_final has not settled. The last plotted sample is not the final value.'}
          </p>
          <div className="p-4 rounded-lg bg-card border border-border">
            {/* Key results */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                <span className="text-xs text-muted-foreground">α (Neper freq)</span>
                <p className="text-lg font-mono font-bold text-primary glow-text">{result.alpha.toFixed(2)} Np/s</p>
              </div>
              <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                <span className="text-xs text-muted-foreground">ω₀ (Resonant)</span>
                <p className="text-lg font-mono font-bold text-primary">{result.omega0.toFixed(2)} rad/s</p>
              </div>
              {result.omegaD !== undefined && (
                <div className="px-4 py-2 rounded-md bg-accent/10 border border-accent/30">
                  <span className="text-xs text-muted-foreground">ω_d (Damped)</span>
                  <p className="text-lg font-mono font-bold text-accent">{result.omegaD.toFixed(2)} rad/s</p>
                </div>
              )}
              <div className="px-4 py-2 rounded-md bg-secondary border border-border">
                <span className="text-xs text-muted-foreground">Damping</span>
                <p className={`text-sm font-mono font-bold ${dampingColor}`}>{dampingLabel}</p>
              </div>
            </div>

            {/* Equations */}
            <div className="space-y-2 mb-4">
              <div className="p-3 rounded-md bg-muted/50 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">v_C(t)</span>
                <p className="font-mono text-sm text-equation break-all">{result.equationVC}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/50 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">i_L(t)</span>
                <p className="font-mono text-sm text-equation break-all">{result.equationIL}</p>
              </div>
            </div>

            {/* Plot toggles */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Switch checked={showVC} onCheckedChange={setShowVC} />
                <Label className="text-xs text-muted-foreground">v_C(t)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={showIL} onCheckedChange={setShowIL} />
                <Label className="text-xs text-muted-foreground">i_L(t)</Label>
              </div>
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

export default RLCTransientTab;
