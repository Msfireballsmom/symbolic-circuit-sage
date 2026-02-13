import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Pencil, Zap, Waves, GitBranch, Activity, Sigma, AudioWaveform, BarChart3, Calculator, Timer, Triangle } from "lucide-react";

interface CircuitSagePanelProps {
  onNavigateToTab?: (tab: string) => void;
}

const CircuitSagePanel = ({ onNavigateToTab }: CircuitSagePanelProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [showCanvas, setShowCanvas] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const drawCircuit = useCallback(() => {
    setShowCanvas(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "hsl(220, 25%, 8%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "hsl(185, 80%, 50%)";
      ctx.lineWidth = 2;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.fillStyle = "hsl(210, 20%, 92%)";

      // Draw voltage source circle
      ctx.beginPath();
      ctx.arc(80, 180, 25, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillText("+", 72, 165);
      ctx.fillText("−", 72, 200);
      ctx.fillText("Vs", 68, 183);

      // Wires
      ctx.beginPath();
      ctx.moveTo(105, 180);
      ctx.lineTo(160, 180);
      ctx.moveTo(160, 100);
      ctx.lineTo(160, 260);
      ctx.moveTo(55, 180);
      ctx.lineTo(20, 180);
      ctx.moveTo(20, 100);
      ctx.lineTo(20, 260);
      ctx.stroke();

      // Resistors (zigzag)
      const drawResistor = (x: number, y: number, horizontal: boolean, label: string) => {
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(x, y);
          for (let i = 0; i < 6; i++) {
            ctx.lineTo(x + (i + 0.5) * 15, y + (i % 2 === 0 ? -8 : 8));
          }
          ctx.lineTo(x + 90, y);
          ctx.stroke();
          ctx.fillText(label, x + 35, y - 14);
        } else {
          ctx.moveTo(x, y);
          for (let i = 0; i < 6; i++) {
            ctx.lineTo(x + (i % 2 === 0 ? -8 : 8), y + (i + 0.5) * 15);
          }
          ctx.lineTo(x, y + 90);
          ctx.stroke();
          ctx.fillText(label, x + 12, y + 50);
        }
      };

      drawResistor(160, 100, true, "R₁");
      drawResistor(340, 140, false, "R₂");
      drawResistor(160, 260, true, "R₃");

      // Connecting wires
      ctx.beginPath();
      ctx.moveTo(250, 100);
      ctx.lineTo(340, 100);
      ctx.lineTo(340, 140);
      ctx.moveTo(340, 230);
      ctx.lineTo(340, 260);
      ctx.moveTo(250, 260);
      ctx.lineTo(340, 260);
      ctx.moveTo(20, 100);
      ctx.lineTo(160, 100);
      ctx.moveTo(20, 260);
      ctx.lineTo(160, 260);
      ctx.stroke();

      // Nodes
      ctx.fillStyle = "hsl(185, 80%, 50%)";
      [
        [160, 100],
        [160, 260],
        [340, 100],
        [340, 260],
      ].forEach(([nx, ny]) => {
        ctx.beginPath();
        ctx.arc(nx, ny, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Node labels
      ctx.fillStyle = "hsl(38, 90%, 55%)";
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.fillText("Node 1", 165, 95);
      ctx.fillText("Node 2", 345, 95);
      ctx.fillText("GND", 165, 275);

      // Ground symbol
      ctx.strokeStyle = "hsl(210, 20%, 92%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 265);
      ctx.lineTo(25, 265);
      ctx.moveTo(17, 270);
      ctx.lineTo(23, 270);
      ctx.moveTo(19, 275);
      ctx.lineTo(21, 275);
      ctx.stroke();
    }, 100);
  }, []);

  const analysisButtons = [
    { label: "Quick Solve", icon: Calculator, tab: "quick", color: "bg-primary/20 hover:bg-primary/30 text-primary" },
    { label: "DC Nodal", icon: Zap, tab: "dc", color: "bg-destructive/20 hover:bg-destructive/30 text-destructive" },
    { label: "Mesh", icon: GitBranch, tab: "mesh", color: "bg-accent/20 hover:bg-accent/30 text-accent" },
    { label: "Transient", icon: Timer, tab: "transient", color: "bg-primary/20 hover:bg-primary/30 text-primary" },
    { label: "RLC", icon: Activity, tab: "rlc", color: "bg-pink-500/20 hover:bg-pink-500/30 text-pink-400" },
    { label: "AC Phasor", icon: Waves, tab: "ac", color: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400" },
    { label: "Laplace", icon: Sigma, tab: "laplace", color: "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400" },
    { label: "Fourier", icon: AudioWaveform, tab: "fourier", color: "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400" },
    { label: "Bode Plot", icon: BarChart3, tab: "bode", color: "bg-purple-500/20 hover:bg-purple-500/30 text-purple-400" },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Left Panel — Upload & Describe */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Triangle className="w-4 h-4 text-primary" />
            Circuit Sage — Problem Input
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-4">
          {/* Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              uploadedFile
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-primary/30 hover:bg-muted/30"
            }`}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {uploadedFile
                ? `✅ ${uploadedFile.name}`
                : "Upload circuit image (optional)"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Circuit Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"Describe your circuit or paste problem text...\n\nExample:\n- Find node voltages using nodal analysis\n- 12V source, R1=4Ω, R2=6Ω, R3=8Ω\n- Calculate power dissipated"}
              className="w-full h-28 rounded-md bg-muted/50 border border-border p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Draw Circuit */}
          <Button
            onClick={drawCircuit}
            variant="outline"
            className="w-full gap-2 text-xs"
          >
            <Pencil className="w-3.5 h-3.5" /> Draw Example Circuit
          </Button>

          {/* Canvas */}
          {showCanvas && (
            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              className="w-full rounded-lg border border-border"
            />
          )}

          {uploadedFile && (
            <div className="text-[10px] text-muted-foreground">
              💡 Tip: Describe the circuit values in the text box above, then navigate to the appropriate solver tab to compute the solution with full steps.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Panel — Quick Analysis Buttons */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            Quick Analysis — Jump to Solver
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Click any method to navigate directly to that solver tab</p>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid gap-2">
            {analysisButtons.map((btn) => (
              <button
                key={btn.tab}
                onClick={() => onNavigateToTab?.(btn.tab)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left text-xs font-medium transition-all ${btn.color} border border-transparent hover:border-current/20`}
              >
                <btn.icon className="w-4 h-4 shrink-0" />
                <span>{btn.label}</span>
                <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0 opacity-60">
                  →
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CircuitSagePanel;
