import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, BarChart3 } from "lucide-react";
import StepDisplay from "./StepDisplay";
import { parseQuantity } from '@/lib/quantity';

type FilterType = 'rc_lowpass' | 'rc_highpass' | 'rlc_bandpass' | 'rlc_series';

interface BodePoint {
  freq: number;
  magDb: number;
  phaseDeg: number;
}

const BodePlotTab = () => {
  const [filterType, setFilterType] = useState<FilterType>('rc_lowpass');
  const [R, setR] = useState('1000');
  const [C, setC] = useState('0.000001');
  const [L, setL] = useState('0.1');
  const [fStart, setFStart] = useState('1');
  const [fEnd, setFEnd] = useState('100000');
  const [points, setPoints] = useState<BodePoint[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState('');

  const solve = () => {
    setError(''); setPoints([]); setSteps([]);
    let r: number, c: number, l: number, fs: number, fe: number;
    try {
      r = parseQuantity(R, 'Ω'); c = parseQuantity(C, 'F'); l = parseQuantity(L, 'H');
      fs = parseQuantity(fStart, 'Hz'); fe = parseQuantity(fEnd, 'Hz');
      if ([r,c,l,fs,fe].some(v => v <= 0) || fe <= fs) throw new Error('Positive component values and an increasing frequency range are required.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid quantities.'); return; }

    const newSteps: string[] = [];
    newSteps.push(`═══════════════════════════════════════`);
    newSteps.push(`BODE PLOT — FREQUENCY RESPONSE ANALYSIS`);
    newSteps.push(`═══════════════════════════════════════`);
    newSteps.push(``);

    // Calculate cutoff/resonant frequency
    let fc: number;
    if (filterType === 'rc_lowpass' || filterType === 'rc_highpass') {
      fc = 1 / (2 * Math.PI * r * c);
      newSteps.push(`Filter type: ${filterType === 'rc_lowpass' ? 'RC Low-Pass' : 'RC High-Pass'}`);
      newSteps.push(`R = ${r} Ω, C = ${c} F`);
      newSteps.push(``);
      newSteps.push(`STEP 1: Cutoff frequency`);
      newSteps.push(`  f_c = 1/(2πRC) = 1/(2π × ${r} × ${c})`);
      newSteps.push(`  f_c = ${fc.toFixed(2)} Hz`);
      newSteps.push(`  ω_c = ${(2 * Math.PI * fc).toFixed(2)} rad/s`);
      newSteps.push(``);

      if (filterType === 'rc_lowpass') {
        newSteps.push(`STEP 2: Transfer function`);
        newSteps.push(`  H(jω) = 1 / (1 + jω/ω_c)`);
        newSteps.push(`  |H(jω)| = 1 / √(1 + (f/f_c)²)`);
        newSteps.push(`  ∠H(jω) = -arctan(f/f_c)`);
      } else {
        newSteps.push(`STEP 2: Transfer function`);
        newSteps.push(`  H(jω) = jω/ω_c / (1 + jω/ω_c)`);
        newSteps.push(`  |H(jω)| = (f/f_c) / √(1 + (f/f_c)²)`);
        newSteps.push(`  ∠H(jω) = 90° - arctan(f/f_c)`);
      }
    } else {
      fc = 1 / (2 * Math.PI * Math.sqrt(l * c));
      const Q = (1 / r) * Math.sqrt(l / c);
      newSteps.push(`Filter type: ${filterType === 'rlc_bandpass' ? 'RLC Band-Pass' : 'Series RLC'}`);
      newSteps.push(`R = ${r} Ω, L = ${l} H, C = ${c} F`);
      newSteps.push(``);
      newSteps.push(`STEP 1: Resonant frequency`);
      newSteps.push(`  f₀ = 1/(2π√(LC)) = 1/(2π√(${l} × ${c}))`);
      newSteps.push(`  f₀ = ${fc.toFixed(2)} Hz`);
      newSteps.push(`  ω₀ = ${(2 * Math.PI * fc).toFixed(2)} rad/s`);
      newSteps.push(``);
      newSteps.push(`STEP 2: Quality factor`);
      newSteps.push(`  Q = (1/R)√(L/C) = (1/${r})√(${l}/${c})`);
      newSteps.push(`  Q = ${Q.toFixed(4)}`);
      newSteps.push(`  Bandwidth = f₀/Q = ${(fc / Q).toFixed(2)} Hz`);
    }
    newSteps.push(``);

    // Generate frequency points (log scale)
    const numPts = 200;
    const logFs = Math.log10(fs);
    const logFe = Math.log10(fe);
    const newPoints: BodePoint[] = [];

    for (let i = 0; i <= numPts; i++) {
      const logF = logFs + (i / numPts) * (logFe - logFs);
      const f = Math.pow(10, logF);
      const w = 2 * Math.PI * f;
      let magDb: number, phaseDeg: number;

      if (filterType === 'rc_lowpass') {
        const wc = 2 * Math.PI * fc;
        const ratio = w / wc;
        const mag = 1 / Math.sqrt(1 + ratio * ratio);
        magDb = 20 * Math.log10(mag);
        phaseDeg = -Math.atan(ratio) * (180 / Math.PI);
      } else if (filterType === 'rc_highpass') {
        const wc = 2 * Math.PI * fc;
        const ratio = w / wc;
        const mag = ratio / Math.sqrt(1 + ratio * ratio);
        magDb = 20 * Math.log10(mag);
        phaseDeg = 90 - Math.atan(ratio) * (180 / Math.PI);
      } else {
        // RLC series impedance response
        const XL = w * l;
        const XC = 1 / (w * c);
        const Zre = r;
        const Zim = XL - XC;
        const Zmag = Math.sqrt(Zre * Zre + Zim * Zim);
        if (filterType === 'rlc_bandpass') {
          // Bandpass: H = R/Z
          const mag = r / Zmag;
          magDb = 20 * Math.log10(mag);
          phaseDeg = -Math.atan2(Zim, Zre) * (180 / Math.PI);
        } else {
          // Series RLC voltage across C: H = (1/jwC) / Z
          const VcMag = XC / Zmag;
          magDb = 20 * Math.log10(VcMag);
          phaseDeg = -90 - Math.atan2(Zim, Zre) * (180 / Math.PI);
        }
      }

      newPoints.push({ freq: f, magDb, phaseDeg });
    }

    // Key points
    newSteps.push(`STEP 3: Key frequency response values`);
    const keyFreqs = [fc / 10, fc / 2, fc, fc * 2, fc * 10].filter(f => f >= fs && f <= fe);
    keyFreqs.forEach(f => {
      const pt = newPoints.reduce((a, b) => Math.abs(b.freq - f) < Math.abs(a.freq - f) ? b : a);
      newSteps.push(`  nearest plotted sample f = ${pt.freq.toFixed(1)} Hz (target ${f.toFixed(1)} Hz): |H| ≈ ${pt.magDb.toFixed(2)} dB, ∠H ≈ ${pt.phaseDeg.toFixed(1)}°`);
    });
    newSteps.push(``);
    newSteps.push(`STEP 4: Asymptotic behavior`);
    if (filterType === 'rc_lowpass') {
      newSteps.push(`  f << f_c: |H| → 0 dB (passband)`);
      newSteps.push(`  f = f_c: |H| = -3.01 dB (half-power point)`);
      newSteps.push(`  f >> f_c: |H| rolls off at -20 dB/decade`);
    } else if (filterType === 'rc_highpass') {
      newSteps.push(`  f << f_c: |H| rises at +20 dB/decade`);
      newSteps.push(`  f = f_c: |H| = -3.01 dB (half-power point)`);
      newSteps.push(`  f >> f_c: |H| → 0 dB (passband)`);
    } else {
      newSteps.push(`  At resonance: |H| peaks (minimum impedance)`);
      newSteps.push(`  Away from resonance: |H| rolls off`);
    }

    setPoints(newPoints);
    setSteps(newSteps);
  };

  const renderBodePlot = () => {
    if (points.length === 0) return error ? <p role="alert" className="text-destructive">{error}</p> : null;

    const W = 640, H = 180, pad = 50, padR = 20;
    const plotW = W - pad - padR;
    const plotH = H - 40;

    const logFreqs = points.map(p => Math.log10(p.freq));
    const minLogF = logFreqs[0];
    const maxLogF = logFreqs[logFreqs.length - 1];

    const toX = (logF: number) => pad + ((logF - minLogF) / (maxLogF - minLogF)) * plotW;

    // Magnitude plot
    const mags = points.map(p => p.magDb);
    const minMag = Math.min(...mags);
    const maxMag = Math.max(...mags);
    const magRange = (maxMag - minMag) || 1;
    const toYmag = (db: number) => 20 + ((maxMag - db) / magRange) * plotH;

    const magPath = points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${toX(logFreqs[i]).toFixed(1)},${toYmag(p.magDb).toFixed(1)}`
    ).join(' ');

    // Phase plot
    const phases = points.map(p => p.phaseDeg);
    const minPh = Math.min(...phases);
    const maxPh = Math.max(...phases);
    const phRange = (maxPh - minPh) || 1;
    const toYph = (deg: number) => 20 + ((maxPh - deg) / phRange) * plotH;

    const phPath = points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${toX(logFreqs[i]).toFixed(1)},${toYph(p.phaseDeg).toFixed(1)}`
    ).join(' ');

    // Grid lines (decades)
    const decades: number[] = [];
    for (let d = Math.ceil(minLogF); d <= Math.floor(maxLogF); d++) decades.push(d);

    return (
      <div className="space-y-4">
        {/* Magnitude */}
        <div className="p-3 rounded-md bg-muted/30 border border-border">
          <h4 className="text-xs font-semibold text-foreground mb-2">Magnitude (dB) vs Frequency</h4>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {decades.map(d => (
              <g key={`mg${d}`}>
                <line x1={toX(d)} x2={toX(d)} y1={20} y2={20 + plotH} className="stroke-border" strokeWidth="0.5" />
                <text x={toX(d)} y={H - 5} className="fill-muted-foreground text-[9px] font-mono" textAnchor="middle">
                  {Math.pow(10, d) >= 1000 ? `${(Math.pow(10, d) / 1000).toFixed(0)}k` : Math.pow(10, d).toFixed(0)}
                </text>
              </g>
            ))}
            <line x1={pad} x2={pad + plotW} y1={20 + plotH} y2={20 + plotH} className="stroke-muted-foreground" strokeWidth="1" />
            <line x1={pad} x2={pad} y1={20} y2={20 + plotH} className="stroke-muted-foreground" strokeWidth="1" />
            <text x={pad - 4} y={24} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{maxMag.toFixed(0)}</text>
            <text x={pad - 4} y={20 + plotH} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{minMag.toFixed(0)}</text>
            <path d={magPath} fill="none" className="stroke-primary" strokeWidth="2" />
            <text x={W / 2} y={H - 1} className="fill-muted-foreground text-[9px] font-mono" textAnchor="middle">Frequency (Hz)</text>
            <text x={8} y={20 + plotH / 2} className="fill-muted-foreground text-[9px] font-mono" textAnchor="middle" transform={`rotate(-90, 8, ${20 + plotH / 2})`}>|H| (dB)</text>
          </svg>
        </div>

        {/* Phase */}
        <div className="p-3 rounded-md bg-muted/30 border border-border">
          <h4 className="text-xs font-semibold text-foreground mb-2">Phase (°) vs Frequency</h4>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {decades.map(d => (
              <g key={`ph${d}`}>
                <line x1={toX(d)} x2={toX(d)} y1={20} y2={20 + plotH} className="stroke-border" strokeWidth="0.5" />
                <text x={toX(d)} y={H - 5} className="fill-muted-foreground text-[9px] font-mono" textAnchor="middle">
                  {Math.pow(10, d) >= 1000 ? `${(Math.pow(10, d) / 1000).toFixed(0)}k` : Math.pow(10, d).toFixed(0)}
                </text>
              </g>
            ))}
            <line x1={pad} x2={pad + plotW} y1={20 + plotH} y2={20 + plotH} className="stroke-muted-foreground" strokeWidth="1" />
            <line x1={pad} x2={pad} y1={20} y2={20 + plotH} className="stroke-muted-foreground" strokeWidth="1" />
            <text x={pad - 4} y={24} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{maxPh.toFixed(0)}°</text>
            <text x={pad - 4} y={20 + plotH} className="fill-muted-foreground text-[9px] font-mono" textAnchor="end">{minPh.toFixed(0)}°</text>
            <path d={phPath} fill="none" className="stroke-accent" strokeWidth="2" />
            <text x={W / 2} y={H - 1} className="fill-muted-foreground text-[9px] font-mono" textAnchor="middle">Frequency (Hz)</text>
            <text x={8} y={20 + plotH / 2} className="fill-muted-foreground text-[9px] font-mono" textAnchor="middle" transform={`rotate(-90, 8, ${20 + plotH / 2})`}>∠H (°)</text>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Bode Plot — Frequency Response
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Filter Type</Label>
            <Select value={filterType} onValueChange={v => setFilterType(v as FilterType)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rc_lowpass">RC Low-Pass</SelectItem>
                <SelectItem value="rc_highpass">RC High-Pass</SelectItem>
                <SelectItem value="rlc_bandpass">RLC Band-Pass</SelectItem>
                <SelectItem value="rlc_series">RLC (V across C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">R (Ω)</Label>
            <Input type="number" value={R} onChange={e => setR(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">C (F)</Label>
            <Input type="number" value={C} onChange={e => setC(e.target.value)} className="h-8 text-xs font-mono" step="any" />
          </div>
          {(filterType === 'rlc_bandpass' || filterType === 'rlc_series') && (
            <div>
              <Label className="text-xs text-muted-foreground">L (H)</Label>
              <Input type="number" value={L} onChange={e => setL(e.target.value)} className="h-8 text-xs font-mono" step="any" />
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">f_start (Hz)</Label>
            <Input type="number" value={fStart} onChange={e => setFStart(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">f_end (Hz)</Label>
            <Input type="number" value={fEnd} onChange={e => setFEnd(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
        </div>

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Generate Bode Plot
        </Button>
      </div>

      {points.length > 0 && (
        <div className="space-y-4 animate-slide-up">
          <div className="p-4 rounded-lg bg-card border border-border">
            {renderBodePlot()}
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <StepDisplay steps={steps} />
          </div>
        </div>
      )}
    </div>
  );
};

export default BodePlotTab;
