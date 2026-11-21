import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { solveDC, DCComponent, DCResult } from "@/lib/circuit-solver";
import StepDisplay from "./StepDisplay";
import MatrixDisplay from "./MatrixDisplay";
import { NodeVoltageGraph } from "./ResultGraph";
import NetlistSketch from "./NetlistSketch";
import { Plus, Trash2, Play, Zap } from "lucide-react";

type EditableComponent = DCComponent & { id: string };
let nextRowId = 1;
const withRowId = (c: Omit<DCComponent, 'id'>): EditableComponent => ({ ...c, id: `row-${nextRowId++}` });

const DCAnalysisTab = () => {
  const [components, setComponents] = useState<EditableComponent[]>([
    withRowId({ type: 'voltage_source', value: 12, nodeA: 1, nodeB: 0 }),
    withRowId({ type: 'resistor', value: 1000, nodeA: 1, nodeB: 2 }),
    withRowId({ type: 'resistor', value: 2000, nodeA: 2, nodeB: 0 }),
  ]);
  const [result, setResult] = useState<DCResult | null>(null);
  const [error, setError] = useState('');

  const addComponent = () => {
    setResult(null);
    setComponents([...components, withRowId({ type: 'resistor', value: 1000, nodeA: 1, nodeB: 0 })]);
  };

  const removeComponent = (id: string) => {
    setResult(null);
    setComponents(components.filter((c) => c.id !== id));
  };

  const updateComponent = (id: string, field: 'type' | 'value' | 'nodeA' | 'nodeB', val: string | number) => {
    setResult(null);
    setComponents(components.map((c) => {
      if (c.id !== id) return c;
      if (field === 'type') return { ...c, type: val as DCComponent['type'] };
      return { ...c, [field]: String(val).trim() ? Number(val) : NaN };
    }));
  };

  const solve = () => {
    try {
      setError('');
      const r = solveDC(components);
      setResult(r);
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Circuit Components
          </h3>
          <Button onClick={addComponent} size="sm" variant="outline" className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>

        <div className="space-y-3">
          {components.map((comp) => (
            <div key={comp.id} className="flex flex-wrap items-end gap-2 p-3 rounded-md bg-muted/50 border border-border">
              <div className="w-36">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={comp.type} onValueChange={(v) => updateComponent(comp.id, 'type', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resistor">Resistor (Ω)</SelectItem>
                    <SelectItem value="voltage_source">V Source (V)</SelectItem>
                    <SelectItem value="current_source">I Source (A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="text-xs text-muted-foreground">Value</Label>
                <Input type="number" value={Number.isFinite(comp.value) ? comp.value : ''} onChange={e => updateComponent(comp.id, 'value', e.target.value)} className="h-8 text-xs font-mono" />
              </div>
              <div className="w-16">
                <Label className="text-xs text-muted-foreground">Node+</Label>
                <Input type="number" min={0} value={Number.isFinite(comp.nodeA) ? comp.nodeA : ''} onChange={e => updateComponent(comp.id, 'nodeA', e.target.value)} className="h-8 text-xs font-mono" />
              </div>
              <div className="w-16">
                <Label className="text-xs text-muted-foreground">Node−</Label>
                <Input type="number" min={0} value={Number.isFinite(comp.nodeB) ? comp.nodeB : ''} onChange={e => updateComponent(comp.id, 'nodeB', e.target.value)} className="h-8 text-xs font-mono" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeComponent(comp.id)} className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <NetlistSketch
          edges={components.map((comp, index) => ({ label: `${comp.type === 'voltage_source' ? 'V' : comp.type === 'current_source' ? 'I' : 'R'}${index + 1}`, nodeA: comp.nodeA, nodeB: comp.nodeB }))}
          caption="Nodes you entered. Node 0 is ground. This drawing is the netlist, not a separate solver."
        />

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Solve Circuit
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
            <h3 className="text-sm font-semibold text-foreground mb-3">Node Voltages</h3>
            <div className="flex flex-wrap gap-3">
              {result.nodeVoltages.map(nv => (
                <div key={nv.node} className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                  <span className="text-xs text-muted-foreground">V{nv.node}</span>
                  <p className="text-lg font-mono font-bold text-primary glow-text">{nv.voltage.toFixed(4)} V</p>
                </div>
              ))}
            </div>

            {result.branchCurrents.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Component Currents</h4>
                <div className="flex flex-wrap gap-3">
                  {result.branchCurrents.map((bc, i) => (
                    <div key={i} className="px-4 py-2 rounded-md bg-muted/50 border border-border">
                      <span className="text-xs text-muted-foreground">I({bc.component})</span>
                      <p className="text-base font-mono font-bold text-foreground">{bc.current.toFixed(6)} A</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm">

              <span className={`w-2 h-2 rounded-full ${result.powerBalance.balanced ? 'bg-success' : 'bg-warning'}`} />
              <span className={result.powerBalance.balanced ? 'text-success' : 'text-warning'}>
                Power Balance: {result.powerBalance.balanced ? 'Verified ✓' : 'Imbalance Detected ⚠'}
              </span>
            </div>

            {/* Verification Residuals */}
            {result.residuals && result.residuals.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Verification Residuals</h4>
                <div className="space-y-1">
                  {result.residuals.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono">
                      <span className={`w-1.5 h-1.5 rounded-full ${r.pass ? 'bg-success' : 'bg-warning'}`} />
                      <span className="text-muted-foreground w-12">{r.type}</span>
                      <span className="text-foreground">{r.location}</span>
                      <span className={`ml-auto ${r.pass ? 'text-success' : 'text-warning'}`}>
                        {r.value.toExponential(2)} {r.pass ? '✓' : '⚠'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Graph */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Node Voltage Graph</h4>
            <NodeVoltageGraph
              data={result.nodeVoltages.map(nv => ({ label: `V${nv.node}`, value: nv.voltage }))}
            />
          </div>

          {result.matrix.G.length > 0 && <MatrixDisplay G={result.matrix.G} I={result.matrix.I} labels={result.matrix.labels} />}
          <div className="p-4 rounded-lg bg-card border border-border">
            <StepDisplay steps={result.steps} verification="verified" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DCAnalysisTab;
