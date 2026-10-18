import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { solveMesh, MeshComponent, MeshResult } from "@/lib/mesh-solver";
import StepDisplay from "./StepDisplay";
import MatrixDisplay from "./MatrixDisplay";
import { Plus, Trash2, Play, GitBranch } from "lucide-react";

const MeshAnalysisTab = () => {
  const [numMeshes, setNumMeshes] = useState(2);
  const [components, setComponents] = useState<MeshComponent[]>([
    { type: 'voltage_source', value: 12, meshes: [1], label: 'Vs' },
    { type: 'resistor', value: 1000, meshes: [1], label: 'R1' },
    { type: 'resistor', value: 2000, meshes: [1, 2], label: 'R2' },
    { type: 'resistor', value: 3000, meshes: [2], label: 'R3' },
  ]);
  const [result, setResult] = useState<MeshResult | null>(null);
  const [error, setError] = useState('');

  const addComponent = () => {
    setComponents([...components, { type: 'resistor', value: 1000, meshes: [1], label: `R${components.length + 1}` }]);
  };

  const removeComponent = (i: number) => {
    setComponents(components.filter((_, idx) => idx !== i));
  };

  const updateComponent = (i: number, field: string, val: string | number | number[]) => {
    const updated = [...components];
    if (field === 'type') {
      updated[i] = { ...updated[i], type: val as MeshComponent['type'] };
    } else if (field === 'meshes') {
      updated[i] = { ...updated[i], meshes: val as number[] };
    } else if (field === 'value') {
      updated[i] = { ...updated[i], value: String(val).trim() ? Number(val) : NaN };
    } else if (field === 'label') {
      updated[i] = { ...updated[i], label: val as string };
    }
    setComponents(updated);
  };

  const parseMeshes = (str: string): number[] => {
    return str.split(',').map(s => /^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);
  };

  const solve = () => {
    try {
      setError('');
      setResult(solveMesh(numMeshes, components));
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
            <GitBranch className="w-4 h-4 text-primary" />
            Mesh Analysis — KVL Loop Method
          </h3>
          <Button onClick={addComponent} size="sm" variant="outline" className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Component
          </Button>
        </div>

        <div className="mb-4">
          <Label className="text-xs text-muted-foreground">Number of Meshes</Label>
          <Select value={String(numMeshes)} onValueChange={v => setNumMeshes(parseInt(v))}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5].map(n => (
                <SelectItem key={n} value={String(n)}>{n} meshes</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {components.map((comp, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 p-3 rounded-md bg-muted/50 border border-border">
              <div className="w-20">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  value={comp.label || ''}
                  onChange={e => updateComponent(i, 'label', e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="w-36">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={comp.type} onValueChange={v => updateComponent(i, 'type', v)}>
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
                <Input
                  type="number"
                  value={comp.value}
                  onChange={e => updateComponent(i, 'value', e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Meshes (e.g. 1,2)</Label>
                <Input
                  value={comp.meshes.join(',')}
                  onChange={e => updateComponent(i, 'meshes', parseMeshes(e.target.value))}
                  className="h-8 text-xs font-mono"
                  placeholder="1 or 1,2"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeComponent(i)} className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Assign each component to its mesh(es). Shared components (e.g. R between mesh 1 and 2) use "1,2".
          Voltage sources: positive value means source aids mesh current in first listed mesh.
        </p>

        <Button onClick={solve} className="mt-4 gap-2 w-full sm:w-auto">
          <Play className="w-4 h-4" /> Solve Mesh Equations
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
            <h3 className="text-sm font-semibold text-foreground mb-3">Mesh Currents</h3>
            <div className="flex flex-wrap gap-3 mb-4">
              {result.meshCurrents.map(mc => (
                <div key={mc.mesh} className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                  <span className="text-xs text-muted-foreground">i{mc.mesh}</span>
                  <p className="text-lg font-mono font-bold text-primary glow-text">
                    {mc.current.toFixed(6)} A
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {(mc.current * 1000).toFixed(3)} mA
                  </p>
                </div>
              ))}
            </div>

            <h4 className="text-xs font-semibold text-muted-foreground mt-4 mb-2">Branch Results</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-muted-foreground">Component</th>
                    <th className="text-right py-1.5 text-muted-foreground">Current (A)</th>
                    <th className="text-right py-1.5 text-muted-foreground">Voltage (V)</th>
                    <th className="text-right py-1.5 text-muted-foreground">Power (W)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.branchCurrents.map((bc, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 text-equation">{bc.label}</td>
                      <td className="text-right py-1.5 text-equation">{bc.current.toFixed(6)}</td>
                      <td className="text-right py-1.5 text-equation">{bc.voltage.toFixed(4)}</td>
                      <td className="text-right py-1.5 text-equation">{bc.power.toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${result.powerBalance.balanced ? 'bg-success' : 'bg-warning'}`} />
              <span className={result.powerBalance.balanced ? 'text-success' : 'text-warning'}>
                Power Balance: {result.powerBalance.balanced ? 'KVL/power checks passed — full independent certification pending' : 'Imbalance Detected ⚠'}
              </span>
            </div>
          </div>

          <MatrixDisplay G={result.matrix.R} I={result.matrix.V} labels={result.matrix.labels} />
          
          <div className="p-4 rounded-lg bg-card border border-border">
            <StepDisplay steps={result.steps} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MeshAnalysisTab;
