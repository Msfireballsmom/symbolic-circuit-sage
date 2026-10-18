import { ExtractionSchema } from "@/lib/extraction-schema";
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
import VerifiedSolution from "./VerifiedSolution";
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
  const [confirmed, setConfirmed] = useState<ParsedProblem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { markSolveCompleted } = useFreeRun();

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleParse = () => {
    if (!problemText.trim()) return;
    setError("");
    setResult(null);
    setConfirmed(null);
    const p = parseProblem(problemText);
    setParsed(p);
    setParseSteps(formatParsedSummary(p));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Upload a PNG, JPEG or WebP image up to 5 MB. PDF/DOCX recognition is unsupported; paste its text instead.'); return; }
    // Convert to base64
    const reader = new FileReader();
    reader.onerror = () => { setError('Image could not be read.'); setIsExtracting(false); };
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
      setIsExtracting(true);
      setError("");
      setResult(null);
      setConfirmed(null);
      setParsed(null);
      setParseSteps([]);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('circuit-extract', {
          body: { imageBase64: base64, textPrompt: problemText || undefined },
        });

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);

        // Convert AI extraction to ParsedProblem format
        const validated = ExtractionSchema.parse(data);
        const aiParsed = convertAIToParsed(validated);
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
      value: c.value,
      nodeA: c.nodeA,
      nodeB: c.nodeB,
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
      confidence: aiData.confidence,
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
    setConfirmed(null);
    setResult(null);
    setError("");
    setUploadedImage(null);
  };

  const handleClear = () => {
    setProblemText("");
    setConfirmed(null);
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
            Draft extraction only. Confirmed DC networks and first-order RC/RL have a deterministic path; unsupported parts and ambiguous connections withhold answers.
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
            onChange={(e) => { setProblemText(e.target.value); setParsed(null); setConfirmed(null); setResult(null); }}
            placeholder={`Paste your circuit problem here...\n\nExamples:\n• "Inverting op-amp: Rf = 100kΩ, Rin = 10kΩ, Vin = 0.5V"\n• "Half-wave rectifier: Vs = 12V peak, R = 1kΩ"\n• "Zener regulator: Vs = 15V, R = 330Ω, Vz = 5.1V"\n• "Nodal analysis with dependent source: VCCS gm = 0.01S"\n\nOr upload a photo of your circuit/homework!`}
            className="w-full h-36 rounded-md bg-muted/50 border border-border p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleParse} variant="outline" className="gap-2 text-xs" disabled={!problemText.trim()}>
              <Play className="w-3.5 h-3.5" /> Parse Text
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => imageInputRef.current?.click()} disabled={isExtracting}>
              <Image className="w-3.5 h-3.5" /> Upload Image
            </Button>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Upload .txt
            </Button>
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageUpload} />
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
                      <td className="p-2 font-mono text-foreground"><select aria-label={`Type of ${comp.label}`} value={comp.type} className="bg-background text-foreground border border-border" onChange={e => { setConfirmed(null); setParsed({ ...parsed, components: parsed.components.map((c, j) => j === i ? { ...c, type: e.target.value as typeof comp.type } : c) }); }}>
                        {['resistor', 'voltage_source', 'current_source', 'capacitor', 'inductor', 'opamp', 'diode', 'dependent_voltage_source', 'dependent_current_source', 'transformer', 'switch'].map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
                      </select></td>
                      <td className="p-2">
                        <input
                          className="w-full bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono text-foreground px-0.5"
                          value={comp.label}
                          onChange={e => {
                            setConfirmed(null);
                            const updated = { ...parsed, components: [...parsed.components] };
                            updated.components[i] = { ...comp, label: e.target.value };
                            setParsed({ ...updated });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-20 bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono text-foreground px-0.5"
                          value={Number.isFinite(comp.value) ? comp.value : ""}
                          onChange={e => {
                            setConfirmed(null);
                            const updated = { ...parsed, components: [...parsed.components] };
                            updated.components[i] = { ...comp, value: e.target.value.trim() ? Number(e.target.value) : NaN };
                            setParsed({ ...updated });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-12 bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono text-foreground px-0.5"
                          value={comp.nodeA ?? ""}
                          onChange={e => {
                            setConfirmed(null);
                            const updated = { ...parsed, components: [...parsed.components] };
                            updated.components[i] = { ...comp, nodeA: e.target.value.trim() ? Number(e.target.value) : undefined };
                            setParsed({ ...updated });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-12 bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono text-foreground px-0.5"
                          value={comp.nodeB ?? ""}
                          onChange={e => {
                            setConfirmed(null);
                            const updated = { ...parsed, components: [...parsed.components] };
                            updated.components[i] = { ...comp, nodeB: e.target.value.trim() ? Number(e.target.value) : undefined };
                            setParsed({ ...updated });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <button
                          className="text-destructive/50 hover:text-destructive"
                          onClick={() => {
                            setConfirmed(null);
                            const updated = { ...parsed, components: [...parsed.components] };
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

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                onClick={() => setConfirmed(structuredClone(parsed))}
                className="gap-2 text-xs"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Confirm netlist &amp; solve
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Image and text reading is not perfect — confirm every type, value, and node
                connection above. Nothing is solved until you do.
              </p>
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

      {confirmed && <VerifiedSolution parsed={confirmed} onSolved={markSolveCompleted} />}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-mono">
          Error: {error}
        </div>
      )}


    </div>
  );
};

export default CircuitSagePanel;
