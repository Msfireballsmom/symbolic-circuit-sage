import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Play, AlertTriangle, CheckCircle, FileText, Trash2, Image, Loader2 } from "lucide-react";
import { parseProblem, formatParsedSummary, formatMethod, ParsedProblem } from "@/lib/problem-parser";
import {
  solveOhmsLaw, solveSeriesParallel, solveVoltageDivider,
  solveCurrentDivider, solveThevenin, solvePower, solveDC,
  solveTransient, solveAC, solveRLC, QuickResult, DCResult,
  TransientResult, ACResult, RLCResult,
} from "@/lib/circuit-solver";
import { solveMesh, MeshComponent, MeshResult } from "@/lib/mesh-solver";
import { solveOpAmp, solveDiode, solveWithDependentSources, DepSourceResult } from "@/lib/advanced-solvers";
import { supabase } from "@/integrations/supabase/client";
import { useFreeRun } from "@/hooks/useFreeRun";
import StepDisplay from "./StepDisplay";
import MatrixDisplay from "./MatrixDisplay";

interface CircuitSagePanelProps {
  onNavigateToTab?: (tab: string) => void;
}

type SolverResult = {
  type: 'quick'; data: QuickResult;
} | {
  type: 'dc'; data: DCResult;
} | {
  type: 'mesh'; data: MeshResult;
} | {
  type: 'transient'; data: TransientResult;
} | {
  type: 'ac'; data: ACResult;
} | {
  type: 'rlc'; data: RLCResult;
} | {
  type: 'dep'; data: DepSourceResult;
};

const EXAMPLE_PROBLEMS = [
  "Find the voltage across R2 using voltage divider. Vs = 12V, R1 = 4kΩ, R2 = 6kΩ",
  "Use nodal analysis. 12V source between node 1 and ground, R1 = 1kΩ between node 1 and node 2, R2 = 2kΩ between node 2 and ground",
  "Find equivalent resistance. R1 = 100Ω, R2 = 200Ω, R3 = 300Ω in series",
  "RC transient circuit. R = 10kΩ, C = 47μF, Vs = 5V, v(0) = 0V",
  "AC phasor analysis. Vs = 120V, f = 60Hz, R = 100Ω, L = 50mH, C = 10μF, series RLC",
  "Ohm's law. V = 24V, R = 4.7kΩ, find current and power",
  "Mesh analysis with 2 meshes. Vs = 24V, R1 = 2kΩ in mesh 1, R2 = 4kΩ shared between mesh 1 and mesh 2, R3 = 6kΩ in mesh 2",
  "Inverting op-amp. Rf = 100kΩ, Rin = 10kΩ, Vin = 0.5V",
  "Half-wave rectifier. Vs = 12V peak, R = 1kΩ, silicon diode",
  "Zener regulator. Vs = 15V, R = 330Ω, Vz = 5.1V",
];

const CircuitSagePanel = ({ onNavigateToTab }: CircuitSagePanelProps) => {
  const [problemText, setProblemText] = useState("");
  const [parsed, setParsed] = useState<ParsedProblem | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [error, setError] = useState("");
  const [parseSteps, setParseSteps] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { markSolveCompleted } = useFreeRun();

  // The monthly free run is charged only once a solve has produced a result.
  useEffect(() => {
    if (result) markSolveCompleted();
  }, [result, markSolveCompleted]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleParse = () => {
    if (!problemText.trim()) return;
    setError("");
    setResult(null);
    const p = parseProblem(problemText);
    setParsed(p);
    setParseSteps(formatParsedSummary(p));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
      setIsExtracting(true);
      setError("");
      setResult(null);
      setParsed(null);
      setParseSteps([]);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('circuit-extract', {
          body: { imageBase64: base64, textPrompt: problemText || undefined },
        });

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);

        // Convert AI extraction to ParsedProblem format
        const aiParsed = convertAIToParsed(data);
        setParsed(aiParsed);
        setParseSteps(formatParsedSummary(aiParsed));
        
        // Also set the problem text for reference
        if (data.problemDescription) {
          setProblemText(data.problemDescription);
        }
      } catch (err: any) {
        setError(`Image extraction failed: ${err.message}`);
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const convertAIToParsed = (aiData: any): ParsedProblem => {
    const components = (aiData.components || []).map((c: any) => ({
      type: mapComponentType(c.type),
      label: c.label || 'Unknown',
      value: c.value || 0,
      nodeA: c.nodeA ?? 1,
      nodeB: c.nodeB ?? 0,
      meshes: c.meshes,
      config: c.config,
      gain: c.gain,
      dependentOn: c.dependentOn,
    }));

    return {
      components,
      method: aiData.analysisMethod || 'unknown',
      frequency: aiData.frequency,
      phase: aiData.phase,
      initialVoltage: aiData.initialVoltage,
      initialCurrent: aiData.initialCurrent,
      sourceVoltage: components.find((c: any) => c.type === 'voltage_source')?.value,
      sourceCurrent: components.find((c: any) => c.type === 'current_source')?.value,
      topology: aiData.topology === 'mixed' ? undefined : aiData.topology,
      findWhat: aiData.findWhat || ['all'],
      rawText: aiData.problemDescription || '',
      confidence: aiData.confidence || 0.5,
      warnings: aiData.warnings || [],
    };
  };

  const mapComponentType = (aiType: string): string => {
    const map: Record<string, string> = {
      resistor: 'resistor', capacitor: 'capacitor', inductor: 'inductor',
      voltage_source: 'voltage_source', current_source: 'current_source',
      opamp: 'opamp', diode: 'diode', bjt: 'bjt', mosfet: 'mosfet',
      dependent_voltage_source: 'dependent_voltage_source',
      dependent_current_source: 'dependent_current_source',
      transformer: 'transformer', switch: 'switch',
    };
    return map[aiType] || aiType;
  };

  const handleSolve = () => {
    if (!parsed) return;
    setError("");

    try {
      const { components, method, topology } = parsed;
      const resistors = components.filter(c => c.type === 'resistor');
      const vSources = components.filter(c => c.type === 'voltage_source');
      const caps = components.filter(c => c.type === 'capacitor');
      const inds = components.filter(c => c.type === 'inductor');
      const opamps = components.filter(c => c.type === 'opamp');
      const diodes = components.filter(c => c.type === 'diode');
      const depSources = components.filter(c => 
        c.type === 'dependent_voltage_source' || c.type === 'dependent_current_source'
      );

      // Handle advanced circuit types first
      if (method === 'opamp' || opamps.length > 0) {
        const opamp = opamps[0];
        const config = (opamp as any)?.config || 'inverting';
        const Rf = resistors.find(r => r.label.match(/[Rr][Ff]/))?.value || resistors[1]?.value || 100000;
        const Rin = resistors.find(r => r.label.match(/[Rr](1|[Ii][Nn])/))?.value || resistors[0]?.value || 10000;
        const Vin = vSources[0]?.value || 1;
        const C = caps[0]?.value;
        
        setResult({
          type: 'quick',
          data: solveOpAmp({
            config, Rf, Rin, Vin,
            Vin2: vSources[1]?.value,
            R2: resistors[2]?.value,
            C,
            frequency: parsed.frequency,
          }),
        });
        return;
      }

      if (method === 'diode_analysis' || diodes.length > 0) {
        const diode = diodes[0];
        const config = (diode as any)?.config || 'forward';
        const Vs = vSources[0]?.value || 12;
        const R = resistors[0]?.value || 1000;
        
        setResult({
          type: 'quick',
          data: solveDiode({
            config, Vs, R,
            Vd: diode?.value || 0.7,
          }),
        });
        return;
      }

      if (method === 'dependent_source' || depSources.length > 0) {
        const depComps = components.map(c => {
          if (c.type === 'dependent_voltage_source') {
            return {
              type: 'vcvs' as const,
              value: 0,
              nodeA: c.nodeA || 1,
              nodeB: c.nodeB || 0,
              controlNodeA: 1,
              controlNodeB: 0,
              gain: (c as any).gain || 1,
            };
          }
          if (c.type === 'dependent_current_source') {
            return {
              type: 'vccs' as const,
              value: 0,
              nodeA: c.nodeA || 1,
              nodeB: c.nodeB || 0,
              controlNodeA: 1,
              controlNodeB: 0,
              gain: (c as any).gain || 1,
            };
          }
          return {
            type: c.type as 'resistor' | 'voltage_source' | 'current_source',
            value: c.value,
            nodeA: c.nodeA || 1,
            nodeB: c.nodeB || 0,
          };
        });
        
        setResult({
          type: 'dep',
          data: solveWithDependentSources(depComps),
        });
        return;
      }

      // Original linear circuit solvers
      switch (method) {
        case 'ohms_law': {
          const R = resistors[0]?.value;
          const V = vSources[0]?.value;
          setResult({ type: 'quick', data: solveOhmsLaw({ V, R }) });
          break;
        }
        case 'power': {
          const R = resistors[0]?.value;
          const V = vSources[0]?.value;
          setResult({ type: 'quick', data: solvePower({ V, R }) });
          break;
        }
        case 'voltage_divider': {
          const Vs = vSources[0]?.value || 0;
          const R1 = resistors[0]?.value || 0;
          const R2 = resistors[1]?.value || 0;
          setResult({ type: 'quick', data: solveVoltageDivider(Vs, R1, R2) });
          break;
        }
        case 'current_divider': {
          const Is = components.find(c => c.type === 'current_source')?.value || 0;
          const R1 = resistors[0]?.value || 0;
          const R2 = resistors[1]?.value || 0;
          setResult({ type: 'quick', data: solveCurrentDivider(Is, R1, R2) });
          break;
        }
        case 'series_parallel': {
          const vals = resistors.map(r => r.value);
          setResult({ type: 'quick', data: solveSeriesParallel(vals, topology || 'series') });
          break;
        }
        case 'thevenin': {
          const Voc = vSources[0]?.value || 0;
          const Rth = resistors[0]?.value || 1;
          const Isc = Voc / Rth;
          setResult({ type: 'quick', data: solveThevenin(Voc, Isc) });
          break;
        }
        case 'dc_nodal': {
          const dcComps = components
            .filter(c => ['resistor', 'voltage_source', 'current_source'].includes(c.type))
            .map(c => ({
              type: c.type as 'resistor' | 'voltage_source' | 'current_source',
              value: c.value,
              nodeA: c.nodeA || 1,
              nodeB: c.nodeB || 0,
            }));
          setResult({ type: 'dc', data: solveDC(dcComps) });
          break;
        }
        case 'mesh': {
          const allMeshes = new Set<number>();
          components.forEach(c => c.meshes?.forEach(m => allMeshes.add(m)));
          const numMeshes = allMeshes.size || 2;

          const meshComps: MeshComponent[] = components.map(c => ({
            type: c.type === 'resistor' ? 'resistor' : c.type === 'voltage_source' ? 'voltage_source' : 'current_source',
            value: c.value,
            meshes: c.meshes || [1],
            label: c.label,
          }));
          setResult({ type: 'mesh', data: solveMesh(numMeshes, meshComps) });
          break;
        }
        case 'transient': {
          const R = resistors[0]?.value || 1000;
          const C = caps[0]?.value;
          const L = inds[0]?.value;
          const Vs = vSources[0]?.value || 0;
          const isRC = !!C;
          setResult({
            type: 'transient',
            data: solveTransient({
              type: isRC ? 'RC' : 'RL',
              R,
              L_or_C: isRC ? C! : (L || 0.1),
              Vs,
              initialValue: parsed.initialVoltage ?? parsed.initialCurrent ?? 0,
              tFinal: isRC ? 5 * R * C! : 5 * (L || 0.1) / R,
            })
          });
          break;
        }
        case 'ac_phasor': {
          const R = resistors[0]?.value || 100;
          const L = inds[0]?.value || 0;
          const C = caps[0]?.value || 0;
          const Vm = vSources[0]?.value || 120;
          const freq = parsed.frequency || 60;
          setResult({
            type: 'ac',
            data: solveAC({
              Vm, phase: parsed.phase || 0, frequency: freq,
              R, L, C, config: topology || 'series'
            })
          });
          break;
        }
        case 'rlc': {
          const R = resistors[0]?.value || 100;
          const L = inds[0]?.value || 0.1;
          const C = caps[0]?.value || 1e-6;
          const Vs = vSources[0]?.value || 0;
          setResult({
            type: 'rlc',
            data: solveRLC({
              topology: topology || 'series', R, L, C, Vs,
              excitation: Vs > 0 ? 'step' : 'natural',
              vC0: parsed.initialVoltage ?? 0,
              iL0: parsed.initialCurrent ?? 0,
              tFinal: 10 / (R / (2 * L)),
            })
          });
          break;
        }
        default: {
          if (resistors.length > 0 && vSources.length > 0) {
            setResult({ type: 'quick', data: solveOhmsLaw({ V: vSources[0].value, R: resistors[0].value }) });
          } else if (resistors.length >= 2) {
            setResult({ type: 'quick', data: solveSeriesParallel(resistors.map(r => r.value), 'series') });
          } else {
            setError("Couldn't determine how to solve. Try being more specific about the analysis method.");
          }
        }
      }
    } catch (e: any) {
      setError(e.message || "Solver error — check your values");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const text = await file.text();
      setProblemText(text);
    } else {
      setProblemText(`[Uploaded: ${file.name}] — Paste the problem text from the file here.`);
    }
  };

  const handleExample = (example: string) => {
    setProblemText(example);
    setParsed(null);
    setResult(null);
    setError("");
    setUploadedImage(null);
  };

  const handleClear = () => {
    setProblemText("");
    setParsed(null);
    setResult(null);
    setError("");
    setParseSteps([]);
    setUploadedImage(null);
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Paste, Type, or Upload — Auto-Parse & Solve
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Supports linear & nonlinear circuits: op-amps, diodes, dependent sources, transistors, RLC, mesh, nodal — upload an image or paste text.
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-4">
          {/* Image preview */}
          {uploadedImage && (
            <div className="relative">
              <img src={uploadedImage} alt="Uploaded circuit" className="max-h-48 rounded-md border border-border" />
              {isExtracting && (
                <div className="absolute inset-0 bg-background/70 rounded-md flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-primary font-medium">Extracting circuit...</span>
                </div>
              )}
            </div>
          )}

          <textarea
            value={problemText}
            onChange={(e) => { setProblemText(e.target.value); setParsed(null); setResult(null); }}
            placeholder={`Paste your circuit problem here...\n\nExamples:\n• "Inverting op-amp: Rf = 100kΩ, Rin = 10kΩ, Vin = 0.5V"\n• "Half-wave rectifier: Vs = 12V peak, R = 1kΩ"\n• "Zener regulator: Vs = 15V, R = 330Ω, Vz = 5.1V"\n• "Nodal analysis with dependent source: VCCS gm = 0.01S"\n\nOr upload a photo of your circuit/homework!`}
            className="w-full h-36 rounded-md bg-muted/50 border border-border p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleParse} variant="outline" className="gap-2 text-xs" disabled={!problemText.trim()}>
              <Play className="w-3.5 h-3.5" /> Parse Text
            </Button>
            {parsed && (
              <Button onClick={handleSolve} className="gap-2 text-xs">
                <CheckCircle className="w-3.5 h-3.5" /> Solve ({formatMethod(parsed.method)})
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => imageInputRef.current?.click()} disabled={isExtracting}>
              <Image className="w-3.5 h-3.5" /> Upload Image
            </Button>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Upload .txt
            </Button>
            <input ref={imageInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleImageUpload} />
            <input ref={fileInputRef} type="file" accept=".txt,.md,text/*" className="hidden" onChange={handleFileUpload} />
            {(problemText || uploadedImage) && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive" onClick={handleClear}>
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>

          {/* Quick Examples */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Try an example:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROBLEMS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => handleExample(ex)}
                  className="px-2 py-1 rounded text-[10px] bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors truncate max-w-[200px]"
                  title={ex}
                >
                  {ex.slice(0, 40)}…
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parse Results — Editable Netlist Confirmation */}
      {parseSteps.length > 0 && parsed && (
        <Card className="border-border animate-slide-up">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Extracted Components — Verify & Edit
              <Badge variant={parsed.confidence > 0.6 ? "default" : "secondary"} className="text-[9px]">
                {(parsed.confidence * 100).toFixed(0)}% confidence
              </Badge>
              {uploadedImage && <Badge variant="outline" className="text-[9px]">AI Extracted</Badge>}
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Review and correct any values before solving. Click a value to edit.</p>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {/* Editable component table */}
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left p-2 font-semibold text-muted-foreground">Component</th>
                    <th className="text-left p-2 font-semibold text-muted-foreground">Label</th>
                    <th className="text-left p-2 font-semibold text-muted-foreground">Value</th>
                    <th className="text-left p-2 font-semibold text-muted-foreground">Node A</th>
                    <th className="text-left p-2 font-semibold text-muted-foreground">Node B</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.components.map((comp, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-2 font-mono text-foreground">{comp.type.replace(/_/g, ' ')}</td>
                      <td className="p-2">
                        <input
                          className="w-full bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono text-foreground px-0.5"
                          value={comp.label}
                          onChange={e => {
                            const updated = { ...parsed };
                            updated.components[i] = { ...comp, label: e.target.value };
                            setParsed({ ...updated });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-20 bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono text-foreground px-0.5"
                          value={comp.value}
                          onChange={e => {
                            const updated = { ...parsed };
                            updated.components[i] = { ...comp, value: parseFloat(e.target.value) || 0 };
                            setParsed({ ...updated });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-12 bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono text-foreground px-0.5"
                          value={comp.nodeA}
                          onChange={e => {
                            const updated = { ...parsed };
                            updated.components[i] = { ...comp, nodeA: parseInt(e.target.value) || 0 };
                            setParsed({ ...updated });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-12 bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono text-foreground px-0.5"
                          value={comp.nodeB}
                          onChange={e => {
                            const updated = { ...parsed };
                            updated.components[i] = { ...comp, nodeB: parseInt(e.target.value) || 0 };
                            setParsed({ ...updated });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <button
                          className="text-destructive/50 hover:text-destructive"
                          onClick={() => {
                            const updated = { ...parsed };
                            updated.components = parsed.components.filter((_, j) => j !== i);
                            setParsed({ ...updated });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Method & analysis info */}
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge variant="outline">Method: {formatMethod(parsed.method)}</Badge>
              {parsed.frequency && <Badge variant="outline">f = {parsed.frequency} Hz</Badge>}
              {parsed.sourceVoltage && <Badge variant="outline">Vs = {parsed.sourceVoltage}V</Badge>}
            </div>

            {parsed.warnings.length > 0 && (
              <div className="p-2 rounded bg-warning/10 border border-warning/30">
                <div className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    {parsed.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-mono">
          Error: {error}
        </div>
      )}

      {/* Solution Results */}
      {result && (
        <Card className="border-border animate-slide-up">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              Solution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {result.type === 'quick' && (
              <div>
                <h4 className="text-sm font-semibold mb-3">{result.data.title}</h4>
                <div className="flex flex-wrap gap-3 mb-4">
                  {result.data.results.map((r, i) => (
                    <div key={i} className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                      <span className="text-xs text-muted-foreground">{r.label}</span>
                      <p className="text-lg font-mono font-bold text-primary glow-text">
                        {r.value} <span className="text-xs text-muted-foreground">{r.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <StepDisplay steps={result.data.steps} />
              </div>
            )}

            {result.type === 'dc' && (
              <div>
                <h4 className="text-sm font-semibold mb-3">DC Nodal Analysis</h4>
                <div className="flex flex-wrap gap-3 mb-4">
                  {result.data.nodeVoltages.map(nv => (
                    <div key={nv.node} className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                      <span className="text-xs text-muted-foreground">V{nv.node}</span>
                      <p className="text-lg font-mono font-bold text-primary glow-text">{nv.voltage.toFixed(4)} V</p>
                    </div>
                  ))}
                </div>
                <MatrixDisplay G={result.data.matrix.G} I={result.data.matrix.I} labels={result.data.matrix.labels} />
                <StepDisplay steps={result.data.steps} />
              </div>
            )}

            {result.type === 'mesh' && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Mesh Analysis</h4>
                <div className="flex flex-wrap gap-3 mb-4">
                  {result.data.meshCurrents.map(mc => (
                    <div key={mc.mesh} className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                      <span className="text-xs text-muted-foreground">i{mc.mesh}</span>
                      <p className="text-lg font-mono font-bold text-primary glow-text">{mc.current.toFixed(6)} A</p>
                    </div>
                  ))}
                </div>
                <StepDisplay steps={result.data.steps} />
              </div>
            )}

            {result.type === 'transient' && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Transient Analysis</h4>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-xs text-muted-foreground">τ</span>
                    <p className="text-lg font-mono font-bold text-primary glow-text">{result.data.tau.toExponential(3)} s</p>
                  </div>
                  <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-xs text-muted-foreground">Final Value</span>
                    <p className="text-lg font-mono font-bold text-primary glow-text">{result.data.finalValue.toFixed(4)}</p>
                  </div>
                </div>
                <div className="p-2 rounded bg-muted/50 border border-border font-mono text-xs text-equation mb-3">
                  {result.data.equation}
                </div>
                <StepDisplay steps={result.data.steps} />
              </div>
            )}

            {result.type === 'ac' && (
              <div>
                <h4 className="text-sm font-semibold mb-3">AC Phasor Analysis</h4>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-xs text-muted-foreground">P (Real)</span>
                    <p className="text-lg font-mono font-bold text-primary glow-text">{result.data.powerReal.toFixed(3)} W</p>
                  </div>
                  <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-xs text-muted-foreground">PF</span>
                    <p className="text-lg font-mono font-bold text-primary glow-text">{result.data.powerFactor.toFixed(4)}</p>
                  </div>
                </div>
                <StepDisplay steps={result.data.steps} />
              </div>
            )}

            {result.type === 'rlc' && (
              <div>
                <h4 className="text-sm font-semibold mb-3">RLC Analysis ({result.data.dampingType})</h4>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-xs text-muted-foreground">α</span>
                    <p className="text-lg font-mono font-bold text-primary glow-text">{result.data.alpha.toFixed(4)}</p>
                  </div>
                  <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-xs text-muted-foreground">ω₀</span>
                    <p className="text-lg font-mono font-bold text-primary glow-text">{result.data.omega0.toFixed(4)}</p>
                  </div>
                </div>
                <StepDisplay steps={result.data.steps} />
              </div>
            )}

            {result.type === 'dep' && (
              <div>
                <h4 className="text-sm font-semibold mb-3">MNA with Dependent Sources</h4>
                <div className="flex flex-wrap gap-3 mb-4">
                  {result.data.nodeVoltages.map(nv => (
                    <div key={nv.node} className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
                      <span className="text-xs text-muted-foreground">V{nv.node}</span>
                      <p className="text-lg font-mono font-bold text-primary glow-text">{nv.voltage.toFixed(4)} V</p>
                    </div>
                  ))}
                </div>
                <StepDisplay steps={result.data.steps} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CircuitSagePanel;
