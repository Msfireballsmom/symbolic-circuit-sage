import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  solveOhmsLaw, solveSeriesParallel, solveVoltageDivider,
  solveCurrentDivider, solveThevenin, solvePower, QuickResult,
} from "@/lib/circuit-solver";
import StepDisplay from "./StepDisplay";
import { Calculator, Plus, Trash2, Play } from "lucide-react";
import { parseQuantity } from '@/lib/quantity';

type SolverType = 'ohms_law' | 'series_parallel' | 'voltage_divider' | 'current_divider' | 'thevenin' | 'power' | 'superposition';

const QuickSolverTab = () => {
  const [solverType, setSolverType] = useState<SolverType>('ohms_law');
  const [result, setResult] = useState<QuickResult | null>(null);
  const [error, setError] = useState('');

  // Ohm's law state
  const [ohmV, setOhmV] = useState('');
  const [ohmI, setOhmI] = useState('');
  const [ohmR, setOhmR] = useState('');

  // Series/Parallel state
  const [resistors, setResistors] = useState<string[]>(['1000', '2000']);
  const [spConfig, setSpConfig] = useState<'series' | 'parallel'>('series');

  // Voltage divider state
  const [vdVs, setVdVs] = useState('12');
  const [vdR1, setVdR1] = useState('1000');
  const [vdR2, setVdR2] = useState('2000');

  // Current divider state
  const [cdIs, setCdIs] = useState('0.01');
  const [cdR1, setCdR1] = useState('1000');
  const [cdR2, setCdR2] = useState('2000');

  // Thevenin state
  const [thVoc, setThVoc] = useState('12');
  const [thIsc, setThIsc] = useState('0.003');

  // Superposition state
  const [spSources, setSpSources] = useState<{ name: string; value: string; unit: string }[]>([
    { name: 'V1', value: '12', unit: 'V' },
    { name: 'V2', value: '8', unit: 'V' },
  ]);
  const [spContributions, setSpContributions] = useState<{ source: string; contribution: string }[]>([
    { source: 'V1', contribution: '0.004' },
    { source: 'V2', contribution: '0.002' },
  ]);

  const solve = () => {
    setResult(null); setError('');
    try {
    if (solverType === 'superposition') throw new Error('Unsupported: this form only sums user-entered contributions; no circuit topology is provided. Use nodal analysis for actual source contributions.');
    switch (solverType) {
      case 'ohms_law':
        setResult(solveOhmsLaw({
          V: ohmV ? parseQuantity(ohmV, 'V') : undefined,
          I: ohmI ? parseQuantity(ohmI, 'A') : undefined,
          R: ohmR ? parseQuantity(ohmR, 'Ω') : undefined,
        }));
        break;
      case 'series_parallel':
        setResult(solveSeriesParallel(resistors.map(r => parseQuantity(r, 'Ω')), spConfig));
        break;
      case 'voltage_divider':
        setResult(solveVoltageDivider(parseQuantity(vdVs, 'V'), parseQuantity(vdR1, 'Ω'), parseQuantity(vdR2, 'Ω')));
        break;
      case 'current_divider':
        setResult(solveCurrentDivider(parseQuantity(cdIs, 'A'), parseQuantity(cdR1, 'Ω'), parseQuantity(cdR2, 'Ω')));
        break;
      case 'thevenin':
        setResult(solveThevenin(parseQuantity(thVoc, 'V'), parseQuantity(thIsc, 'A')));
        break;
      case 'power':
        setResult(solvePower({
          V: ohmV ? parseQuantity(ohmV, 'V') : undefined,
          I: ohmI ? parseQuantity(ohmI, 'A') : undefined,
          R: ohmR ? parseQuantity(ohmR, 'Ω') : undefined,
        }));
        break;

    }
    } catch (e) { setError(e instanceof Error ? e.message : 'Answer withheld.'); }
  };

  const renderInputs = () => {
    switch (solverType) {
      case 'ohms_law':
      case 'power':
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Enter any 2 of 3 values. Leave the unknown blank.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Voltage (V)</Label>
                <Input type="text" inputMode="decimal" value={ohmV} onChange={e => setOhmV(e.target.value)} placeholder="?" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Current (A)</Label>
                <Input type="text" inputMode="decimal" value={ohmI} onChange={e => setOhmI(e.target.value)} placeholder="?" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Resistance (Ω)</Label>
                <Input type="text" inputMode="decimal" value={ohmR} onChange={e => setOhmR(e.target.value)} placeholder="?" className="h-8 text-xs font-mono" />
              </div>
            </div>
          </div>
        );
      case 'series_parallel':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Select value={spConfig} onValueChange={(v) => setSpConfig(v as 'series' | 'parallel')}>
                <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="series">Series</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setResistors([...resistors, '1000'])}>
                <Plus className="w-3 h-3" /> Add R
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {resistors.map((r, i) => (
                <div key={i} className="flex items-end gap-1">
                  <div>
                    <Label className="text-xs text-muted-foreground">R{i + 1} (Ω)</Label>
                    <Input type="text" inputMode="decimal" value={r} onChange={e => { const n = [...resistors]; n[i] = e.target.value; setResistors(n); }} className="h-8 text-xs font-mono w-24" />
                  </div>
                  {resistors.length > 2 && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive/70" onClick={() => setResistors(resistors.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 'voltage_divider':
        return (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">V_source (V)</Label>
              <Input type="text" inputMode="decimal" value={vdVs} onChange={e => setVdVs(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">R₁ (Ω) — top</Label>
              <Input type="text" inputMode="decimal" value={vdR1} onChange={e => setVdR1(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">R₂ (Ω) — bottom</Label>
              <Input type="text" inputMode="decimal" value={vdR2} onChange={e => setVdR2(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
          </div>
        );
      case 'current_divider':
        return (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">I_source (A)</Label>
              <Input type="text" inputMode="decimal" value={cdIs} onChange={e => setCdIs(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">R₁ (Ω)</Label>
              <Input type="text" inputMode="decimal" value={cdR1} onChange={e => setCdR1(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">R₂ (Ω)</Label>
              <Input type="text" inputMode="decimal" value={cdR2} onChange={e => setCdR2(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
          </div>
        );
      case 'thevenin':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">V_oc (Open Circuit V)</Label>
              <Input type="text" inputMode="decimal" value={thVoc} onChange={e => setThVoc(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">I_sc (Short Circuit A)</Label>
              <Input type="text" inputMode="decimal" value={thIsc} onChange={e => setThIsc(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
          </div>
        );
      case 'superposition':
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              This form only adds contributions you type. It does not solve a circuit, and the solver will refuse it. Use DC Nodal for superposition.
            </p>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => {
                const n = spSources.length + 1;
                setSpSources([...spSources, { name: `V${n}`, value: '0', unit: 'V' }]);
                setSpContributions([...spContributions, { source: `V${n}`, contribution: '0' }]);
              }}>
                <Plus className="w-3 h-3" /> Add Source
              </Button>
            </div>
            {spSources.map((src, i) => (
              <div key={i} className="flex items-end gap-2 p-2 rounded-md bg-muted/50 border border-border">
                <div className="w-20">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input value={src.name} onChange={e => {
                    const updated = [...spSources]; updated[i] = { ...updated[i], name: e.target.value }; setSpSources(updated);
                  }} className="h-8 text-xs font-mono" />
                </div>
                <div className="w-20">
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input value={src.value} onChange={e => {
                    const updated = [...spSources]; updated[i] = { ...updated[i], value: e.target.value }; setSpSources(updated);
                  }} className="h-8 text-xs font-mono" />
                </div>
                <div className="w-16">
                  <Label className="text-xs text-muted-foreground">Unit</Label>
                  <Input value={src.unit} onChange={e => {
                    const updated = [...spSources]; updated[i] = { ...updated[i], unit: e.target.value }; setSpSources(updated);
                  }} className="h-8 text-xs font-mono" />
                </div>
                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">Contribution</Label>
                  <Input type="text" inputMode="decimal" value={spContributions[i]?.contribution || '0'} onChange={e => {
                    const updated = [...spContributions]; updated[i] = { source: src.name, contribution: e.target.value }; setSpContributions(updated);
                  }} className="h-8 text-xs font-mono" />
                </div>
                {spSources.length > 2 && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive/70" onClick={() => {
                    setSpSources(spSources.filter((_, j) => j !== i));
                    setSpContributions(spContributions.filter((_, j) => j !== i));
                  }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          Quick Homework Solver
        </h3>

        <div className="mb-4">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Problem Type</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { val: 'ohms_law', label: "Ohm's Law" },
              { val: 'voltage_divider', label: 'Voltage Divider' },
              { val: 'current_divider', label: 'Current Divider' },
              { val: 'series_parallel', label: 'Series / Parallel R' },
              { val: 'thevenin', label: 'Thévenin / Norton' },
              { val: 'power', label: 'Power Analysis' },
              { val: 'superposition', label: 'Superposition' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => { setSolverType(val as SolverType); setResult(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                  solverType === val
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {renderInputs()}

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Solve
        </Button>
      </div>

      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {result && (
        <div className="space-y-4 animate-slide-up">
          <div className="p-4 rounded-lg bg-card border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">{result.title}</h3>
            <p role="status" className="text-xs text-muted-foreground mb-3">Checked against an independent nodal circuit before display. Thévenin uses the open-circuit voltage and short-circuit current you entered.</p>
            <div className="flex flex-wrap gap-3 mb-4">
              {result.results.map((r, i) => (
                <div key={i} className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <p className="text-lg font-mono font-bold text-primary glow-text">
                    {r.value} <span className="text-xs text-muted-foreground">{r.unit}</span>
                  </p>
                </div>
              ))}
            </div>
            <StepDisplay steps={result.steps} verification="verified" />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickSolverTab;
