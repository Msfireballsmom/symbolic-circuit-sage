import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { solveAC, ACInput, ACResult, polarString, complexToString, complexMag, complexAngle } from "@/lib/circuit-solver";
import StepDisplay from "./StepDisplay";
import { Play, Waves } from "lucide-react";

const ACPhasorTab = () => {
  const [input, setInput] = useState<ACInput>({
    Vm: 170, phase: 0, frequency: 60, R: 100, L: 0.5, C: 0.00001, config: 'series',
  });
  const [result, setResult] = useState<ACResult | null>(null);

  const update = (field: keyof ACInput, val: string) => {
    setInput({ ...input, [field]: parseFloat(val) || 0 });
  };

  const solve = () => setResult(solveAC(input));

  const PhasorDiagram = () => {
    if (!result) return null;
    const vectors = [
      { c: result.voltageR, label: 'V_R', color: 'hsl(185, 80%, 50%)' },
      { c: result.voltageL, label: 'V_L', color: 'hsl(38, 90%, 55%)' },
      { c: result.voltageC, label: 'V_C', color: 'hsl(0, 72%, 55%)' },
    ].filter(v => complexMag(v.c) > 1e-6);

    const maxMag = Math.max(...vectors.map(v => complexMag(v.c)), 1);
    const scale = 80 / maxMag;
    const cx = 120, cy = 100;

    return (
      <svg viewBox="0 0 240 200" className="w-full max-w-xs">
        {/* Axes */}
        <line x1={20} x2={220} y1={cy} y2={cy} className="stroke-border" strokeWidth="0.5" />
        <line x1={cx} x2={cx} y1={10} y2={190} className="stroke-border" strokeWidth="0.5" />
        <text x={225} y={cy + 4} className="fill-muted-foreground text-[8px] font-mono">Re</text>
        <text x={cx + 3} y={8} className="fill-muted-foreground text-[8px] font-mono">Im</text>
        {/* Vectors */}
        {vectors.map((v, i) => {
          const x2 = cx + v.c.re * scale;
          const y2 = cy - v.c.im * scale;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={v.color} strokeWidth="2" markerEnd="url(#arrow)" />
              <text x={x2 + (v.c.re >= 0 ? 4 : -28)} y={y2 - 4} fill={v.color} className="text-[8px] font-mono">{v.label}</text>
            </g>
          );
        })}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-foreground" />
          </marker>
        </defs>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Waves className="w-4 h-4 text-primary" />
          AC Phasor Parameters (Series RLC)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">V_peak (V)</Label>
            <Input type="number" value={input.Vm} onChange={e => update('Vm', e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Phase (°)</Label>
            <Input type="number" value={input.phase} onChange={e => update('phase', e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Frequency (Hz)</Label>
            <Input type="number" value={input.frequency} onChange={e => update('frequency', e.target.value)} className="h-8 text-xs font-mono" />
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
        </div>

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Solve AC Circuit
        </Button>
      </div>

      {result && (
        <div className="space-y-4 animate-slide-up">
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
                <span className="text-xs text-muted-foreground">|Z|</span>
                <p className="text-sm font-mono font-bold text-primary">{complexMag(result.impedance).toFixed(2)} Ω</p>
              </div>
              <div className="px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
                <span className="text-xs text-muted-foreground">∠Z</span>
                <p className="text-sm font-mono font-bold text-primary">{complexAngle(result.impedance).toFixed(1)}°</p>
              </div>
              <div className="px-3 py-2 rounded-md bg-accent/10 border border-accent/30">
                <span className="text-xs text-muted-foreground">P (Real)</span>
                <p className="text-sm font-mono font-bold text-accent">{result.powerReal.toFixed(2)} W</p>
              </div>
              <div className="px-3 py-2 rounded-md bg-success/10 border border-success/30">
                <span className="text-xs text-muted-foreground">PF</span>
                <p className="text-sm font-mono font-bold text-success">{result.powerFactor.toFixed(4)}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-md bg-muted/50 border border-border">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Impedance & Current</h4>
                <p className="font-mono text-xs text-equation">Z = {complexToString(result.impedance)} Ω</p>
                <p className="font-mono text-xs text-equation">Z = {polarString(result.impedance)}</p>
                <p className="font-mono text-xs text-equation mt-1">I = {complexToString(result.current)} A</p>
                <p className="font-mono text-xs text-equation">I = {polarString(result.current)}</p>
              </div>
              <div className="flex justify-center items-center">
                <PhasorDiagram />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border">
            <StepDisplay steps={result.steps} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ACPhasorTab;
