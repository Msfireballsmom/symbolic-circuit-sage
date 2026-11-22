import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { solveFourier, FourierInput, FourierResult, WaveformType } from "@/lib/fourier-solver";
import StepDisplay from "./StepDisplay";
import { Play, AudioWaveform } from "lucide-react";

const waveformOptions: { value: WaveformType; label: string }[] = [
  { value: 'square', label: 'Square Wave' },
  { value: 'sawtooth', label: 'Sawtooth Wave' },
  { value: 'triangle', label: 'Triangle Wave' },
  { value: 'rectified_sine', label: 'Full-Wave Rectified Sine' },
  { value: 'half_rectified', label: 'Half-Wave Rectified Sine' },
  { value: 'pulse', label: 'Pulse Train' },
];

const FourierTab = () => {
  const [input, setInput] = useState<FourierInput>({
    waveform: 'square',
    amplitude: 1,
    period: 0.01,
    dutyCycle: 0.5,
    numHarmonics: 10,
    dcOffset: 0,
  });
  const [showOriginal, setShowOriginal] = useState(true);
  const [showReconstructed, setShowReconstructed] = useState(true);
  const [result, setResult] = useState<FourierResult | null>(null);
  const [error, setError] = useState('');

  const update = (field: keyof FourierInput, val: string) => {
    if (field === 'waveform') {
      setInput(prev => ({ ...prev, waveform: val as WaveformType }));
    } else {
      setInput(prev => ({ ...prev, [field]: val.trim() ? Number(val) : NaN }));
    }
  };

  const solve = () => {
    try {
      setError('');
      if (Object.values(input).some(v => typeof v === 'number' && !Number.isFinite(v))) throw new Error('All numeric fields must be finite.');
      if (input.period <= 0) throw new Error('Period must be positive');
      if (input.numHarmonics < 1) throw new Error('Need at least 1 harmonic');
      setResult(solveFourier(input));
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    }
  };

  const WaveformPlot = () => {
    if (!result) return null;
    const datasets: { points: { t: number; value: number }[]; label: string; color: string; dash?: string }[] = [];
    if (showOriginal) datasets.push({ points: result.waveformPoints, label: 'Original', color: 'stroke-muted-foreground', dash: '4,3' });
    if (showReconstructed) datasets.push({ points: result.reconstructedPoints, label: `Reconstructed (${input.numHarmonics}H)`, color: 'stroke-primary' });
    if (datasets.length === 0) return null;

    const allVals = datasets.flatMap(d => d.points.map(p => p.value));
    const maxT = result.waveformPoints[result.waveformPoints.length - 1].t;
    const minV = Math.min(...allVals) * 1.1;
    const maxV = Math.max(...allVals) * 1.1;
    const range = maxV - minV || 1;
    const W = 620, H = 200, pad = 45;

    const toX = (t: number) => pad + (t / maxT) * (W - 2 * pad);
    const toY = (v: number) => H - pad - ((v - minV) / range) * (H - 2 * pad);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <line key={frac} x1={pad} x2={W - pad} y1={pad + frac * (H - 2 * pad)} y2={pad + frac * (H - 2 * pad)} className="stroke-border" strokeWidth="0.5" />
        ))}
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="stroke-muted-foreground" strokeWidth="1" />
        <line x1={pad} x2={pad} y1={pad} y2={H - pad} className="stroke-muted-foreground" strokeWidth="1" />
        {/* Zero line */}
        {minV < 0 && maxV > 0 && (
          <line x1={pad} x2={W - pad} y1={toY(0)} y2={toY(0)} className="stroke-border" strokeWidth="0.8" strokeDasharray="2,4" />
        )}

        {datasets.map((ds, di) => {
          const pathD = ds.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
          return <path key={di} d={pathD} fill="none" className={ds.color} strokeWidth={di === 0 ? "1.5" : "2"} strokeLinecap="round" strokeDasharray={ds.dash} />;
        })}

        <text x={W / 2} y={H - 5} className="fill-muted-foreground text-[10px] font-mono" textAnchor="middle">Time (s)</text>
        <text x={pad - 4} y={H - pad + 3} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{minV.toFixed(2)}</text>
        <text x={pad - 4} y={pad + 4} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{maxV.toFixed(2)}</text>

        {datasets.map((ds, di) => (
          <g key={di}>
            <line x1={W - pad - 120} x2={W - pad - 100} y1={pad + 10 + di * 16} y2={pad + 10 + di * 16} className={ds.color} strokeWidth="2" strokeDasharray={ds.dash} />
            <text x={W - pad - 96} y={pad + 14 + di * 16} className="fill-muted-foreground text-[9px] font-mono">{ds.label}</text>
          </g>
        ))}
      </svg>
    );
  };

  const SpectrumPlot = () => {
    if (!result || result.harmonicSpectrum.length === 0) return null;
    const maxMag = Math.max(...result.harmonicSpectrum.map(h => h.magnitude));
    if (maxMag < 1e-12) return null;

    const W = 620, H = 180, pad = 45;
    const barW = Math.min(20, (W - 2 * pad) / result.harmonicSpectrum.length * 0.7);
    const gap = (W - 2 * pad) / result.harmonicSpectrum.length;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" preserveAspectRatio="xMidYMid meet">
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="stroke-muted-foreground" strokeWidth="1" />
        <line x1={pad} x2={pad} y1={pad} y2={H - pad} className="stroke-muted-foreground" strokeWidth="1" />

        {result.harmonicSpectrum.map((h, i) => {
          const barH = (h.magnitude / maxMag) * (H - 2 * pad);
          const x = pad + i * gap + gap / 2 - barW / 2;
          const y = H - pad - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} className="fill-primary/70" rx="1" />
              <text x={x + barW / 2} y={H - pad + 12} className="fill-muted-foreground text-[8px] font-mono" textAnchor="middle">
                {h.n}
              </text>
              {h.magnitude / maxMag > 0.05 && (
                <text x={x + barW / 2} y={y - 4} className="fill-equation text-[7px] font-mono" textAnchor="middle">
                  {h.magnitude.toFixed(3)}
                </text>
              )}
            </g>
          );
        })}

        <text x={W / 2} y={H - 5} className="fill-muted-foreground text-[10px] font-mono" textAnchor="middle">Harmonic number (n)</text>
        <text x={5} y={H / 2} className="fill-muted-foreground text-[10px] font-mono" textAnchor="middle" transform={`rotate(-90, 10, ${H / 2})`}>|cₙ|</text>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <AudioWaveform className="w-4 h-4 text-primary" />
          Fourier Series Analysis
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Square, sawtooth, triangle, pulse, and rectified sine only. Coefficients are shown after they match an independent midpoint integral. A custom sketch is not accepted.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Waveform</Label>
            <Select value={input.waveform} onValueChange={v => update('waveform', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {waveformOptions.map(w => (
                  <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Amplitude (A)</Label>
            <Input type="number" value={input.amplitude} onChange={e => update('amplitude', e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Period T (s)</Label>
            <Input type="number" value={input.period} onChange={e => update('period', e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Harmonics (N)</Label>
            <Input type="number" value={input.numHarmonics} onChange={e => update('numHarmonics', e.target.value)} className="h-8 text-xs font-mono" min={1} max={50} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">DC Offset</Label>
            <Input type="number" value={input.dcOffset} onChange={e => update('dcOffset', e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
          {input.waveform === 'pulse' && (
            <div>
              <Label className="text-xs text-muted-foreground">Duty Cycle (0-1)</Label>
              <Input type="number" value={input.dutyCycle} onChange={e => update('dutyCycle', e.target.value)} className="h-8 text-xs font-mono" step="0.05" min={0.01} max={0.99} />
            </div>
          )}
        </div>

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Compute Fourier Series
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-mono">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Key results */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
                <span className="text-xs text-muted-foreground">f₀</span>
                <p className="text-sm font-mono font-bold text-primary">{result.fundamentalFreq.toFixed(2)} Hz</p>
              </div>
              <div className="px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
                <span className="text-xs text-muted-foreground">ω₀</span>
                <p className="text-sm font-mono font-bold text-primary">{result.omega0.toFixed(2)} rad/s</p>
              </div>
              <div className="px-3 py-2 rounded-md bg-accent/10 border border-accent/30">
                <span className="text-xs text-muted-foreground">a₀ (DC)</span>
                <p className="text-sm font-mono font-bold text-accent">{result.a0.toFixed(6)}</p>
              </div>
              {result.symmetry.map((s, i) => (
                <div key={i} className="px-3 py-2 rounded-md bg-success/10 border border-success/30">
                  <span className="text-xs text-muted-foreground">Symmetry</span>
                  <p className="text-xs font-mono text-success">{s}</p>
                </div>
              ))}
            </div>

            {/* Equation */}
            <div className="p-3 rounded-md bg-muted/50 border border-border mb-4">
              <span className="text-xs text-muted-foreground block mb-1">Fourier Series</span>
              <p className="font-mono text-sm text-equation break-all">{result.equation}</p>
            </div>

            {/* Waveform toggles & plot */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Switch checked={showOriginal} onCheckedChange={setShowOriginal} />
                <Label className="text-xs text-muted-foreground">Original</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={showReconstructed} onCheckedChange={setShowReconstructed} />
                <Label className="text-xs text-muted-foreground">Reconstructed</Label>
              </div>
            </div>

            <WaveformPlot />
          </div>

          {/* Spectrum */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <h4 className="text-sm font-semibold text-foreground mb-3">Harmonic Spectrum |cₙ|</h4>
            <SpectrumPlot />
          </div>

          {/* Coefficient table */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <h4 className="text-sm font-semibold text-foreground mb-3">Coefficient Table</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-muted-foreground">n</th>
                    <th className="text-right py-1.5 text-muted-foreground">aₙ</th>
                    <th className="text-right py-1.5 text-muted-foreground">bₙ</th>
                    <th className="text-right py-1.5 text-muted-foreground">|cₙ|</th>
                    <th className="text-right py-1.5 text-muted-foreground">φₙ (°)</th>
                    <th className="text-right py-1.5 text-muted-foreground">Freq (Hz)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.coefficients.map(c => (
                    <tr key={c.n} className={`border-b border-border/50 ${c.cn < input.amplitude * 0.001 ? 'opacity-40' : ''}`}>
                      <td className="py-1.5 text-foreground">{c.n}</td>
                      <td className="text-right py-1.5 text-equation">{c.an.toFixed(6)}</td>
                      <td className="text-right py-1.5 text-equation">{c.bn.toFixed(6)}</td>
                      <td className="text-right py-1.5 text-primary font-semibold">{c.cn.toFixed(6)}</td>
                      <td className="text-right py-1.5 text-equation">{c.phaseN.toFixed(1)}</td>
                      <td className="text-right py-1.5 text-muted-foreground">{(c.n * result.fundamentalFreq).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full derivation */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <StepDisplay steps={result.steps} verification="verified" />
          </div>
        </div>
      )}
    </div>
  );
};

export default FourierTab;
