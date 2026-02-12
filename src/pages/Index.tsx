import SolverHeader from "@/components/SolverHeader";
import DCAnalysisTab from "@/components/DCAnalysisTab";
import TransientTab from "@/components/TransientTab";
import ACPhasorTab from "@/components/ACPhasorTab";
import QuickSolverTab from "@/components/QuickSolverTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Timer, Waves, BookOpen, Calculator } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background grid-bg">
      <SolverHeader />

      {/* Hero */}
      <section className="border-b border-border bg-card/30">
        <div className="container px-4 py-10 sm:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono text-primary mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
              ET310 Circuit Analysis Engine
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
        <Tabs defaultValue="quick" className="space-y-6">
          <TabsList className="bg-card border border-border h-auto p-1 flex-wrap">
            <TabsTrigger value="quick" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Calculator className="w-4 h-4" />
              Quick Solve
            </TabsTrigger>
            <TabsTrigger value="dc" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">DC</span> Nodal
            </TabsTrigger>
            <TabsTrigger value="transient" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">First-Order</span> Transient
            </TabsTrigger>
            <TabsTrigger value="ac" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Waves className="w-4 h-4" />
              AC Phasor
            </TabsTrigger>
            <TabsTrigger value="reference" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BookOpen className="w-4 h-4" />
              Reference
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick"><QuickSolverTab /></TabsContent>
          <TabsContent value="dc"><DCAnalysisTab /></TabsContent>
          <TabsContent value="transient"><TransientTab /></TabsContent>
          <TabsContent value="ac"><ACPhasorTab /></TabsContent>
          <TabsContent value="reference">
            <div className="p-6 rounded-lg bg-card border border-border space-y-6">
              <h3 className="text-lg font-bold text-foreground">Quick Reference — ET310 Formulas</h3>
              
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
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>ET310 Circuit Solver — Nilsson & Riedel Framework</span>
          <span className="font-mono">v2.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
