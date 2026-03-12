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
import BodePlotTab from "@/components/BodePlotTab";
import CircuitSagePanel from "@/components/CircuitSagePanel";
import SavedProblemsTab from "@/components/SavedProblemsTab";
import PracticeExamTab from "@/components/PracticeExamTab";
import CheckHomeworkTab from "@/components/CheckHomeworkTab";
import ProGate from "@/components/ProGate";
import TestModeBanner from "@/components/TestModeBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Timer, Waves, BookOpen, Calculator, Activity, GitBranch, Sigma, AudioWaveform, BarChart3, Bookmark, Trophy, Camera, Crown, BookCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Free features: quick, reference
// Pro features: everything else
const PRO_TABS = ["dc", "mesh", "transient", "rlc", "ac", "laplace", "fourier", "bode", "sage", "exam", "homework"];

const Index = () => {
  const [activeTab, setActiveTab] = useState("quick");
  const { isPro } = useAuth();

  const renderTabContent = (tabId: string, content: React.ReactNode, featureName: string) => {
    if (PRO_TABS.includes(tabId) && !isPro) {
      return <ProGate featureName={featureName}>{content}</ProGate>;
    }
    return content;
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      <TestModeBanner />
      <SolverHeader />

      {/* Hero */}
      <section className="border-b border-border bg-card/30">
        <div className="container px-4 py-10 sm:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono text-primary mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
              Circuit Analysis Engine v4
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
              Solve any circuit with
              <span className="text-primary glow-text"> verified math</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl leading-relaxed">
              Upload assignments, get instant step-by-step solutions. DC, AC, transient, op-amps, Laplace, Fourier — 
              with power balance verification. Check your homework before you submit.
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
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="mesh" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <GitBranch className="w-4 h-4" />
              Mesh
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="transient" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">1st-Order</span> Transient
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="rlc" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">2nd-Order</span> RLC
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="ac" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Waves className="w-4 h-4" />
              AC Phasor
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="laplace" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sigma className="w-4 h-4" />
              Laplace
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="fourier" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <AudioWaveform className="w-4 h-4" />
              Fourier
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="bode" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BarChart3 className="w-4 h-4" />
              Bode Plot
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="sage" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
              <Camera className="w-4 h-4" />
              Snap & Solve
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="homework" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
              <BookCheck className="w-4 h-4" />
              Check Homework
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Bookmark className="w-4 h-4" />
              Saved
            </TabsTrigger>
            <TabsTrigger value="exam" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
              <Trophy className="w-4 h-4" />
              Practice Exam
              {!isPro && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="reference" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BookOpen className="w-4 h-4" />
              Reference
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick"><QuickSolverTab /></TabsContent>
          <TabsContent value="dc">{renderTabContent("dc", <DCAnalysisTab />, "DC Nodal Analysis")}</TabsContent>
          <TabsContent value="mesh">{renderTabContent("mesh", <MeshAnalysisTab />, "Mesh Analysis")}</TabsContent>
          <TabsContent value="transient">{renderTabContent("transient", <TransientTab />, "1st-Order Transient Analysis")}</TabsContent>
          <TabsContent value="rlc">{renderTabContent("rlc", <RLCTransientTab />, "2nd-Order RLC Analysis")}</TabsContent>
          <TabsContent value="ac">{renderTabContent("ac", <ACPhasorTab />, "AC Phasor Analysis")}</TabsContent>
          <TabsContent value="laplace">{renderTabContent("laplace", <LaplaceTab />, "Laplace Transform Solver")}</TabsContent>
          <TabsContent value="fourier">{renderTabContent("fourier", <FourierTab />, "Fourier Series Analysis")}</TabsContent>
          <TabsContent value="bode">{renderTabContent("bode", <BodePlotTab />, "Bode Plot Generator")}</TabsContent>
          <TabsContent value="sage">{renderTabContent("sage", <CircuitSagePanel onNavigateToTab={setActiveTab} />, "Snap & Solve — AI Circuit Reader")}</TabsContent>
          <TabsContent value="homework">{renderTabContent("homework", <CheckHomeworkTab />, "Check My Homework")}</TabsContent>
          <TabsContent value="saved"><SavedProblemsTab /></TabsContent>
          <TabsContent value="exam">{renderTabContent("exam", <PracticeExamTab />, "Practice Exam Mode")}</TabsContent>
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
                    <p>P = VIcosθ, Q = VIsinθ, S = VI</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Laplace Transform</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>L&#123;e^(-at)&#125; = 1/(s+a)</p>
                    <p>L&#123;cos(ωt)&#125; = s/(s²+ω²)</p>
                    <p>Inductor: V(s) = sLI(s) - Li(0⁻)</p>
                    <p>Capacitor: V(s) = I(s)/(sC) + v(0⁻)/s</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Fourier & Bode</h4>
                  <div className="space-y-1 font-mono text-xs text-equation">
                    <p>f(t) = a₀ + Σ[aₙcos(nω₀t) + bₙsin(nω₀t)]</p>
                    <p>RC Low-Pass: f_c = 1/(2πRC)</p>
                    <p>Roll-off: -20 dB/decade (1st order)</p>
                    <p>Q = f₀/BW = (1/R)√(L/C)</p>
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
          <span>Circuit Solver Pro — Advanced Analysis Engine</span>
          <span className="font-mono">v4.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
