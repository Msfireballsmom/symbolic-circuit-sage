import { Zap } from "lucide-react";

const SolverHeader = () => (
  <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
    <div className="container flex items-center justify-between h-16 px-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            ET310 <span className="text-primary glow-text">Circuit Solver</span>
          </h1>
          <p className="text-xs text-muted-foreground -mt-0.5">Nilsson & Riedel Framework</p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <span className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
        Engine Ready
      </div>
    </div>
  </header>
);

export default SolverHeader;
