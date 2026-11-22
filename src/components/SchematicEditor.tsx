import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { solveDC, type DCResult } from '@/lib/circuit-solver';
import { DIVIDER_EXAMPLE, cellName, schematicToDC, type SchematicCell, type SchematicKind, type SchematicPart } from '@/lib/schematic-netlist';
import { Play, Trash2 } from 'lucide-react';

const ROWS = 5;
const COLUMNS = 7;
const TOOLS: { kind: SchematicKind | 'ground' | 'erase'; label: string }[] = [
  { kind: 'resistor', label: 'Resistor' },
  { kind: 'voltage_source', label: 'Voltage source' },
  { kind: 'current_source', label: 'Current source' },
  { kind: 'wire', label: 'Wire' },
  { kind: 'ground', label: 'Ground' },
  { kind: 'erase', label: 'Erase' },
];

const defaultValue = (kind: SchematicKind) => kind === 'resistor' ? 1000 : kind === 'voltage_source' ? 12 : kind === 'current_source' ? 0.001 : 0;

export default function SchematicEditor() {
  const [parts, setParts] = useState<SchematicPart[]>(DIVIDER_EXAMPLE.parts);
  const [ground, setGround] = useState<SchematicCell | null>(DIVIDER_EXAMPLE.ground);
  const [tool, setTool] = useState<SchematicKind | 'ground' | 'erase'>('resistor');
  const [pending, setPending] = useState<SchematicCell | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<DCResult | null>(null);
  const [error, setError] = useState('');

  const cells = useMemo(() => Array.from({ length: ROWS * COLUMNS }, (_, index) => ({
    row: Math.floor(index / COLUMNS),
    column: index % COLUMNS,
    name: cellName(Math.floor(index / COLUMNS), index % COLUMNS),
  })), []);

  const clearResult = () => { setResult(null); setError(''); };

  const onCell = (name: SchematicCell) => {
    clearResult();
    if (tool === 'ground') { setGround(name); setPending(null); return; }
    if (tool === 'erase') {
      setParts(parts.filter(part => part.a !== name && part.b !== name));
      if (ground === name) setGround(null);
      setPending(null);
      return;
    }
    if (!pending) { setPending(name); return; }
    if (pending === name) { setPending(null); return; }
    const id = `${tool === 'wire' ? 'W' : tool === 'resistor' ? 'R' : tool === 'voltage_source' ? 'V' : 'I'}${parts.length + 1}`;
    setParts([...parts, { id, kind: tool, a: pending, b: name, value: defaultValue(tool) }]);
    setSelected(id);
    setPending(null);
  };

  const solve = () => {
    try {
      setError('');
      const net = schematicToDC(parts, ground);
      setResult(solveDC(net.components));
    } catch (reason) {
      setResult(null);
      setError(reason instanceof Error ? reason.message : 'Answer withheld.');
    }
  };

  const nodeVoltage = (name: SchematicCell) => {
    if (!result) return null;
    try {
      const net = schematicToDC(parts, ground);
      const id = net.nodeOf[name];
      if (id === 0) return 0;
      return result.nodeVoltages.find(node => node.node === id)?.voltage ?? null;
    } catch {
      return null;
    }
  };

  const selectedPart = parts.find(part => part.id === selected);

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Draw a DC circuit</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Click two grid points to place a part. The first point is the positive terminal of a source and the tail of a current arrow. Wires join points into one node. The drawing is solved by the checked DC nodal engine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TOOLS.map(item => (
            <button key={item.kind} type="button" onClick={() => { setTool(item.kind); setPending(null); }} className={`px-3 py-1.5 rounded-md text-xs border ${tool === item.kind ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-muted-foreground'}`}>
              {item.label}
            </button>
          ))}
          <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => { setParts(DIVIDER_EXAMPLE.parts); setGround(DIVIDER_EXAMPLE.ground); clearResult(); }}>Load divider example</Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => { setParts([]); setGround(null); setSelected(null); clearResult(); }}>Clear</Button>
        </div>
        <div className="relative overflow-x-auto">
          <svg viewBox={`0 0 ${COLUMNS * 72} ${ROWS * 72}`} className="w-full max-w-3xl bg-muted/20 rounded-md border border-border">
            {parts.map(part => {
              const [r1, c1] = part.a.split(',').map(Number);
              const [r2, c2] = part.b.split(',').map(Number);
              const x1 = c1 * 72 + 36;
              const y1 = r1 * 72 + 36;
              const x2 = c2 * 72 + 36;
              const y2 = r2 * 72 + 36;
              return (
                <g key={part.id} onClick={() => setSelected(part.id)} className="cursor-pointer">
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected === part.id ? 'hsl(185 80% 50%)' : 'hsl(215 20% 55%)'} strokeWidth={part.kind === 'wire' ? 2 : 3} />
                  <text x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2 - 6} className="fill-foreground text-[11px] font-mono">
                    {part.kind === 'wire' ? part.id : `${part.id} ${part.value}`}
                  </text>
                </g>
              );
            })}
            {cells.map(cell => {
              const voltage = nodeVoltage(cell.name);
              return (
                <g key={cell.name} onClick={() => onCell(cell.name)} className="cursor-pointer">
                  <circle cx={cell.column * 72 + 36} cy={cell.row * 72 + 36} r={pending === cell.name ? 7 : 4.5} className={ground === cell.name ? 'fill-muted-foreground' : 'fill-primary'} />
                  {ground === cell.name && <text x={cell.column * 72 + 44} y={cell.row * 72 + 52} className="fill-muted-foreground text-[10px] font-mono">0</text>}
                  {voltage !== null && ground !== cell.name && <text x={cell.column * 72 + 44} y={cell.row * 72 + 30} className="fill-primary text-[10px] font-mono">{voltage.toFixed(3)} V</text>}
                </g>
              );
            })}
          </svg>
        </div>
        {pending && <p className="text-xs text-muted-foreground">First point is {pending}. Click the second point.</p>}
        {selectedPart && selectedPart.kind !== 'wire' && (
          <div className="flex items-end gap-2 max-w-xs">
            <div>
              <label className="text-xs text-muted-foreground" htmlFor="part-value">{selectedPart.id} value ({selectedPart.kind === 'resistor' ? 'Ω' : selectedPart.kind === 'voltage_source' ? 'V' : 'A'})</label>
              <Input id="part-value" type="number" value={selectedPart.value} className="h-8 font-mono text-xs" onChange={event => {
                const value = event.target.value.trim() ? Number(event.target.value) : NaN;
                setParts(parts.map(part => part.id === selectedPart.id ? { ...part, value } : part));
                clearResult();
              }} />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setParts(parts.filter(part => part.id !== selectedPart.id)); setSelected(null); clearResult(); }}><Trash2 className="w-4 h-4" /></Button>
          </div>
        )}
        <Button type="button" onClick={solve} className="gap-2"><Play className="w-4 h-4" /> Solve drawing</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="p-4 rounded-lg bg-card border border-border space-y-3">
          <h3 className="text-sm font-semibold">Node voltages from the checked DC solver</h3>
          <div className="flex flex-wrap gap-3">
            {result.nodeVoltages.map(node => (
              <div key={node.node} className="px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
                <span className="text-xs text-muted-foreground">Node {node.node}</span>
                <p className="font-mono font-bold text-primary">{node.voltage.toFixed(6)} V</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Power balance {result.powerBalance.balanced ? 'passed' : 'failed'} the same KCL and power checks as DC Nodal. Current leaves the first terminal of a source when the source supplies power.</p>
        </div>
      )}
    </div>
  );
}
