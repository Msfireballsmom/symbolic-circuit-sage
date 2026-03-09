import { useState } from "react";
import SolverHeader from "@/components/SolverHeader";
import DCAnalysisTab from "@/components/DCAnalysisTab";
import MeshAnalysisTab from "@/components/MeshAnalysisTab";
import TransientTab from "@/components/TransientTab";
import RLCTransientTab from "@/components/RLCTransientTab";
import ACPhasorTab from "@/components/ACPhasorTab";
import LaplaceTab from "@/components/LaplaceTab";
import FourierTab from "@/components/FourierTab";
import QuickSolverTab from "@/components/QuickSolverTab";
import CurriculumTab from "@/components/CurriculumTab";
import BodePlotTab from "@/components/BodePlotTab";
import CircuitSagePanel from "@/components/CircuitSagePanel";
import SavedProblemsTab from "@/components/SavedProblemsTab";
import PracticeExamTab from "@/components/PracticeExamTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Timer, Waves, BookOpen, Calculator, Activity, GitBranch, Sigma, AudioWaveform, GraduationCap, BarChart3, Lightbulb, Bookmark, Trophy, Camera } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("quick");

  return (
    <div className="min-h-screen bg-background grid-bg">
      <SolverHeader />

      {/* Hero */}
      <section className="border-b border-border bg-card/30">
        <div className="container px-4 py-10 sm:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono text-primary mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
              Circuit Analysis Engine v3
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
              Solve any linear circuit with
              <span className="text-primary glow-text"> verified math</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl leading-relaxed">
              Input your values, get instant step-by-step solutions. Ohm's Law, voltage/current dividers, 
              series/parallel, Thévenin/Norton, transients, AC phasors — with power balance verification.
            </p>
          </div>
        </div>
      </section>

      {/* Solver Tabs */}
      <main className="container px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border h-auto p-1 flex-wrap">
            <TabsTrigger value="quick" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Calculator className="w-4 h-4" />
              Quick Solve
            </TabsTrigger>
            <TabsTrigger value="dc" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">DC</span> Nodal
            </TabsTrigger>
            <TabsTrigger value="mesh" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <GitBranch className="w-4 h-4" />
              Mesh
            </TabsTrigger>
            <TabsTrigger value="transient" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">1st-Order</span> Transient
            </TabsTrigger>
            <TabsTrigger value="rlc" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">2nd-Order</span> RLC
            </TabsTrigger>
            <TabsTrigger value="ac" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Waves className="w-4 h-4" />
              AC Phasor
            </TabsTrigger>
            <TabsTrigger value="laplace" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sigma className="w-4 h-4" />
              Laplace
            </TabsTrigger>
            <TabsTrigger value="fourier" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <AudioWaveform className="w-4 h-4" />
              Fourier
            </TabsTrigger>
            <TabsTrigger value="bode" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BarChart3 className="w-4 h-4" />
              Bode Plot
            </TabsTrigger>
            <TabsTrigger value="sage" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
              <Lightbulb className="w-4 h-4" />
              Circuit Sage
            </TabsTrigger>
            <TabsTrigger value="reference" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BookOpen className="w-4 h-4" />
              Reference
            </TabsTrigger>
            <TabsTrigger value="curriculum" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <GraduationCap className="w-4 h-4" />
              Curriculum
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick"><QuickSolverTab /></TabsContent>
          <TabsContent value="dc"><DCAnalysisTab /></TabsContent>
          <TabsContent value="mesh"><MeshAnalysisTab /></TabsContent>
          <TabsContent value="transient"><TransientTab /></TabsContent>
          <TabsContent value="rlc"><RLCTransientTab /></TabsContent>
          <TabsContent value="ac"><ACPhasorTab /></TabsContent>
          <TabsContent value="laplace"><LaplaceTab /></TabsContent>
          <TabsContent value="fourier"><FourierTab /></TabsContent>
          <TabsContent value="bode"><BodePlotTab /></TabsContent>
          <TabsContent value="sage"><CircuitSagePanel onNavigateToTab={setActiveTab} /></TabsContent>
          <TabsContent value="reference">
            <div className="p-6 rounded-lg bg-card border border-border space-y-6">
              <h3 className="text-lg font-bold text-foreground">Quick Reference — Circuit Formulas</h3>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">DC Analysis</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>Ohm's Law: V = IR</p>
                    <p>KVL: ΣV_loop = 0</p>
                    <p>KCL: ΣI_node = 0</p>
                    <p>Power: P = VI = I²R = V²/R</p>
                    <p>Series: R_eq = ΣR_i</p>
                    <p>Parallel: 1/R_eq = Σ(1/R_i)</p>
                    <p>Voltage Divider: V_out = V_s × R₂/(R₁+R₂)</p>
                    <p>Current Divider: I₁ = I_s × R₂/(R₁+R₂)</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Network Theorems</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>Thévenin: V_th = V_oc, R_th = V_oc/I_sc</p>
                    <p>Norton: I_N = I_sc, R_N = R_th</p>
                    <p>Max Power: R_L = R_th</p>
                    <p>P_max = V_th²/(4R_th)</p>
                    <p>Superposition: analyze one source at a time</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Transient Analysis</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>RC: τ = RC</p>
                    <p>RL: τ = L/R</p>
                    <p>Natural: x(t) = x(0)e^(-t/τ)</p>
                    <p>Step: x(t) = x(∞) + [x(0)-x(∞)]e^(-t/τ)</p>
                    <p>At t = τ: 63.2% of final value</p>
                    <p>At t = 5τ: ~steady state (99.3%)</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">AC / Phasor Domain</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>Z_R = R</p>
                    <p>Z_L = jωL</p>
                    <p>Z_C = 1/(jωC) = -j/(ωC)</p>
                    <p>V = IZ (Ohm's Law for phasors)</p>
                    <p>ω = 2πf</p>
                    <p>P = VIcosθ (real power)</p>
                    <p>Q = VIsinθ (reactive power)</p>
                    <p>S = VI (apparent power)</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Laplace Transform</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>L&#123;f(t)&#125; = ∫₀^∞ f(t)e^(-st)dt</p>
                    <p>L&#123;e^(-at)&#125; = 1/(s+a)</p>
                    <p>L&#123;cos(ωt)&#125; = s/(s²+ω²)</p>
                    <p>L&#123;u(t)&#125; = 1/s</p>
                    <p>Inductor: V(s) = sLI(s) - Li(0⁻)</p>
                    <p>Capacitor: V(s) = I(s)/(sC) + v(0⁻)/s</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Switch Analysis (t&lt;0 → t&gt;0)</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>t&lt;0: Capacitor → open, Inductor → short</p>
                    <p>Find initial: V₀ = v_C(0⁻), I₀ = i_L(0⁻)</p>
                    <p>t=0⁺: Cap → V source (V₀), Ind → I source (I₀)</p>
                    <p>t&gt;0: Solve with initial conditions</p>
                    <p>Continuity: v_C(0⁻) = v_C(0⁺)</p>
                    <p>Continuity: i_L(0⁻) = i_L(0⁺)</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Fourier Series</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>f(t) = a₀ + Σ[aₙcos(nω₀t) + bₙsin(nω₀t)]</p>
                    <p>a₀ = (1/T)∫₀ᵀ f(t)dt</p>
                    <p>aₙ = (2/T)∫₀ᵀ f(t)cos(nω₀t)dt</p>
                    <p>bₙ = (2/T)∫₀ᵀ f(t)sin(nω₀t)dt</p>
                    <p>ω₀ = 2π/T = 2πf₀</p>
                    <p>Even sym: bₙ = 0 (cosine only)</p>
                    <p>Odd sym: aₙ = 0 (sine only)</p>
                    <p>Half-wave: even harmonics = 0</p>
                    <p>Parseval: P = a₀² + ½Σ(aₙ²+bₙ²)</p>
                  </div>
                </div>
              </div>

              {/* Circuit Reading Guide */}
              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-bold text-foreground mb-4">📐 How to Read Circuit Diagrams</h3>
                
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-primary">Schematic Symbols</h4>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p><span className="font-mono text-foreground">─/\/\/─</span> Resistor (R, in Ω)</p>
                      <p><span className="font-mono text-foreground">─||─</span> Capacitor (C, in F)</p>
                      <p><span className="font-mono text-foreground">─⌇⌇⌇─</span> Inductor (L, in H)</p>
                      <p><span className="font-mono text-foreground">─(+|−)─</span> Voltage Source (V_s)</p>
                      <p><span className="font-mono text-foreground">─(↑)─</span> Current Source (I_s)</p>
                      <p><span className="font-mono text-foreground">⏚</span> Ground (reference node, 0V)</p>
                      <p><span className="font-mono text-foreground">●</span> Connection dot (wires connect)</p>
                      <p><span className="font-mono text-foreground">╳</span> Crossing without dot = NO connection</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-primary">Step-by-Step Reading Method</h4>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p><span className="text-primary font-bold">1.</span> Identify every component symbol and its value</p>
                      <p><span className="text-primary font-bold">2.</span> Mark ALL nodes (junctions where 3+ wires meet)</p>
                      <p><span className="text-primary font-bold">3.</span> Choose a ground node (reference = 0V)</p>
                      <p><span className="text-primary font-bold">4.</span> Note source polarities (+/− for V, arrow for I)</p>
                      <p><span className="text-primary font-bold">5.</span> Determine series vs parallel connections</p>
                      <p><span className="text-primary font-bold">6.</span> Pick analysis method (Nodal, Mesh, or Thévenin)</p>
                      <p><span className="text-primary font-bold">7.</span> Write equations BEFORE plugging in numbers</p>
                      <p><span className="text-primary font-bold">8.</span> Verify with power balance (ΣP = 0)</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-destructive">⚠ Common Mistakes to Avoid</h4>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p>❌ Assuming crossing wires connect (need a dot!)</p>
                      <p>❌ Forgetting to assign ground before solving</p>
                      <p>❌ Mixing up source polarity (+ vs −)</p>
                      <p>❌ Writing numbers before symbolic equations</p>
                      <p>❌ Forgetting passive sign convention</p>
                      <p>❌ Not checking units (kΩ vs Ω, μF vs F)</p>
                      <p>❌ Skipping power balance verification</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-primary">Common Visual Types</h4>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p>📋 <span className="text-foreground font-medium">Circuit schematics</span> — component diagrams</p>
                      <p>📈 <span className="text-foreground font-medium">Time-domain plots</span> — v(t) or i(t) vs time</p>
                      <p>📐 <span className="text-foreground font-medium">Phasor diagrams</span> — AC magnitude & phase vectors</p>
                      <p>📊 <span className="text-foreground font-medium">Bode plots</span> — |H| and ∠H vs frequency</p>
                      <p>🔄 <span className="text-foreground font-medium">Pole-zero maps</span> — s-plane stability analysis</p>
                      <p>📉 <span className="text-foreground font-medium">Harmonic spectra</span> — Fourier coefficient magnitudes</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Frequency Response Reference */}
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-primary mb-2">Frequency Response / Bode Plots</h3>
                <div className="space-y-1 font-mono text-xs text-equation">
                  <p>RC Low-Pass: H(jω) = 1/(1+jωRC), f_c = 1/(2πRC)</p>
                  <p>RC High-Pass: H(jω) = jωRC/(1+jωRC)</p>
                  <p>At f_c: |H| = -3.01 dB (half-power point)</p>
                  <p>Roll-off: -20 dB/decade (1st order)</p>
                  <p>RLC resonance: f₀ = 1/(2π√LC)</p>
                  <p>Quality factor: Q = f₀/BW = (1/R)√(L/C)</p>
                  <p>|H| in dB = 20·log₁₀(|H|)</p>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="curriculum"><CurriculumTab /></TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Circuit Solver Pro — Advanced Analysis Engine</span>
          <span className="font-mono">v3.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
