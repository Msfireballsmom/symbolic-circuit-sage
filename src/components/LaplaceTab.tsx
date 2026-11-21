import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { solveLaplace, LaplaceInput, LaplaceResult } from "@/lib/laplace-solver";
import StepDisplay from "./StepDisplay";
import { Play, Sigma, Badge } from "lucide-react";

const presets = [
  {
    name: 'Simple: 6/[(s+2)(s+4)]',
    num: [6],
    den: [1, 6, 8],
  },
  {
    name: '2nd-order underdamped: 100/(s²+4s+100)',
    num: [100],
    den: [1, 4, 100],
  },
  {
    name: '2nd-order overdamped: 10/(s²+7s+10)',
    num: [10],
    den: [1, 7, 10],
  },
  {
    name: 'With zero: (s+3)/[(s+1)(s+4)]',
    num: [1, 3],
    den: [1, 5, 4],
  },
  {
    name: '3rd-order: 24/[(s+1)(s+2)(s+3)]',
    num: [24],
    den: [1, 6, 11, 6],
  },
];

const LaplaceTab = () => {
  const [numStr, setNumStr] = useState('6');
  const [denStr, setDenStr] = useState('1, 6, 8');
  const [inputType, setInputType] = useState<'impulse' | 'step'>('step');
  const [result, setResult] = useState<LaplaceResult | null>(null);
  const [error, setError] = useState('');

  const parseCoeffs = (s: string): number[] => {
    const values = s.split(',').map(x => x.trim() ? Number(x.trim()) : NaN);
    if (values.some(v => !Number.isFinite(v))) throw new Error('Every coefficient must be a finite number; empty or invalid entries cannot be discarded.');
    return values;
  };

  const applyPreset = (preset: typeof presets[0]) => {
    setNumStr(preset.num.join(', '));
    setDenStr(preset.den.join(', '));
    setResult(null);
  };

  const solve = () => {
    try {
      setError('');
      const numerator = parseCoeffs(numStr);
      const denominator = parseCoeffs(denStr);
      if (numerator.length === 0 || denominator.length === 0) {
        throw new Error('Enter valid coefficients');
      }
      if (denominator.length < 2) {
        throw new Error('Denominator must be at least degree 1');
      }
      const input: LaplaceInput = { numerator, denominator, inputType };
      setResult(solveLaplace(input));
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    }
  };

  const PoleZeroPlot = () => {
    if (!result) return null;
    const { poleZeroData } = result;
    const allPts = [...poleZeroData.poles, ...poleZeroData.zeros];
    if (allPts.length === 0) return null;

    const maxAbs = Math.max(...allPts.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))), 1) * 1.3;
    const W = 260, H = 260;
    const cx = W / 2, cy = H / 2;
    const scale = (W / 2 - 30) / maxAbs;

    const toX = (v: number) => cx + v * scale;
    const toY = (v: number) => cy - v * scale;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[260px]">
        {/* Axes */}
        <line x1={0} x2={W} y1={cy} y2={cy} className="stroke-border" strokeWidth="0.5" />
        <line x1={cx} x2={cx} y1={0} y2={H} className="stroke-border" strokeWidth="0.5" />
        <text x={W - 14} y={cy - 4} className="fill-muted-foreground text-[8px] font-mono">σ</text>
        <text x={cx + 4} y={12} className="fill-muted-foreground text-[8px] font-mono">jω</text>

        {/* Left half-plane shading */}
        <rect x={0} y={0} width={cx} height={H} fill="hsl(150 70% 45% / 0.05)" />

        {/* Poles (×) */}
        {poleZeroData.poles.map((p, i) => {
          const px = toX(p.x), py = toY(p.y);
          return (
            <g key={`p${i}`}>
              <line x1={px - 6} y1={py - 6} x2={px + 6} y2={py + 6} stroke="hsl(0 72% 55%)" strokeWidth="2" />
              <line x1={px + 6} y1={py - 6} x2={px - 6} y2={py + 6} stroke="hsl(0 72% 55%)" strokeWidth="2" />
            </g>
          );
        })}

        {/* Zeros (○) */}
        {poleZeroData.zeros.map((z, i) => {
          const zx = toX(z.x), zy = toY(z.y);
          return (
            <circle key={`z${i}`} cx={zx} cy={zy} r={6} fill="none" stroke="hsl(185 80% 50%)" strokeWidth="2" />
          );
        })}

        {/* Legend */}
        <g>
          <line x1={10} y1={H - 30} x2={18} y2={H - 22} stroke="hsl(0 72% 55%)" strokeWidth="1.5" />
          <line x1={18} y1={H - 30} x2={10} y2={H - 22} stroke="hsl(0 72% 55%)" strokeWidth="1.5" />
          <text x={22} y={H - 23} className="fill-muted-foreground text-[8px] font-mono">Poles</text>
          <circle cx={14} cy={H - 12} r={4} fill="none" stroke="hsl(185 80% 50%)" strokeWidth="1.5" />
          <text x={22} y={H - 9} className="fill-muted-foreground text-[8px] font-mono">Zeros</text>
        </g>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sigma className="w-4 h-4 text-primary" />
          Laplace Transform / S-Domain Analysis
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Strictly proper transfer functions through degree 3 with distinct poles. Repeated poles and higher-degree inverses are refused. Residues are shown only when they reproduce F(s).</p>

        {/* Presets */}
        <div className="mb-4">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Quick Presets</Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded-md text-xs font-mono bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/20 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">
              Numerator coefficients (highest power → constant, comma-separated)
            </Label>
            <Input
              value={numStr}
              onChange={e => setNumStr(e.target.value)}
              placeholder="e.g. 6 or 1, 3"
              className="h-8 text-xs font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Example: "1, 3" = s + 3; "6" = 6
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Denominator coefficients (highest power → constant, comma-separated)
            </Label>
            <Input
              value={denStr}
              onChange={e => setDenStr(e.target.value)}
              placeholder="e.g. 1, 6, 8"
              className="h-8 text-xs font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Example: "1, 6, 8" = s² + 6s + 8
            </p>
          </div>
          <div className="w-48">
            <Label className="text-xs text-muted-foreground">Response Type</Label>
            <Select value={inputType} onValueChange={v => setInputType(v as 'impulse' | 'step')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="impulse">Impulse Response</SelectItem>
                <SelectItem value="step">Step Response</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Analyze Transfer Function
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-mono">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-slide-up">
          <div className="p-4 rounded-lg bg-card border border-border">
            {/* Transfer function display */}
            <div className="p-3 rounded-md bg-muted/50 border border-border mb-4">
              <span className="text-xs text-muted-foreground block mb-1">Transfer Function</span>
              <p className="font-mono text-sm text-equation break-all">{result.transferFunction}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {/* Key results */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <div className="px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-xs text-muted-foreground">Stability</span>
                    <p className={`text-sm font-mono font-bold ${result.isStable ? 'text-success' : 'text-destructive'}`}>
                      {result.isStable ? 'STABLE ✓' : 'UNSTABLE ⚠'}
                    </p>
                  </div>
                  {result.dcGain !== null && (
                    <div className="px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
                      <span className="text-xs text-muted-foreground">DC Gain</span>
                      <p className="text-sm font-mono font-bold text-primary">{result.dcGain.toFixed(4)}</p>
                    </div>
                  )}
                  {result.naturalFrequency !== undefined && (
                    <div className="px-3 py-2 rounded-md bg-accent/10 border border-accent/30">
                      <span className="text-xs text-muted-foreground">ω_n</span>
                      <p className="text-sm font-mono font-bold text-accent">{result.naturalFrequency.toFixed(4)} rad/s</p>
                    </div>
                  )}
                  {result.dampingRatio !== undefined && (
                    <div className="px-3 py-2 rounded-md bg-accent/10 border border-accent/30">
                      <span className="text-xs text-muted-foreground">ζ</span>
                      <p className="text-sm font-mono font-bold text-accent">{result.dampingRatio.toFixed(4)}</p>
                    </div>
                  )}
                </div>

                {/* Poles */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Poles</h4>
                  {result.poles.map((p, i) => (
                    <p key={i} className="font-mono text-xs text-equation">
                      s{i + 1} = {p.re.toFixed(4)}{Math.abs(p.im) > 1e-10 ? ` ${p.im >= 0 ? '+' : '-'} j${Math.abs(p.im).toFixed(4)}` : ''}
                    </p>
                  ))}
                </div>

                {result.zeros.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">Zeros</h4>
                    {result.zeros.map((z, i) => (
                      <p key={i} className="font-mono text-xs text-equation">
                        z{i + 1} = {z.re.toFixed(4)}{Math.abs(z.im) > 1e-10 ? ` ${z.im >= 0 ? '+' : '-'} j${Math.abs(z.im).toFixed(4)}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Pole-Zero Plot */}
              <div className="flex flex-col items-center">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Pole-Zero Map</h4>
                <PoleZeroPlot />
              </div>
            </div>

            {/* Time domain response */}
            <div className="p-3 rounded-md bg-muted/50 border border-border">
              <span className="text-xs text-muted-foreground block mb-1">
                Time-Domain {inputType === 'step' ? 'Step' : 'Impulse'} Response
              </span>
              <p className="font-mono text-sm text-equation break-all">
                f(t) = {result.timeDomainResponse}  for t ≥ 0
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border">
            <StepDisplay steps={result.steps} verification="verified" />
          </div>
        </div>
      )}
    </div>
  );
};

export default LaplaceTab;
