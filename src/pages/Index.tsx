import { useState } from "react";
import SolverHeader from "@/components/SolverHeader";
import DCAnalysisTab from "@/components/DCAnalysisTab";
import TransientTab from "@/components/TransientTab";
import RLCTransientTab from "@/components/RLCTransientTab";
import CircuitSagePanel from "@/components/CircuitSagePanel";
import SavedProblemsTab from "@/components/SavedProblemsTab";
import TierGate from "@/components/TierGate";
import TestModeBanner from "@/components/TestModeBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Timer, BookOpen, Activity, Bookmark, Camera, Crown, GitBranch, Waves, BarChart3, Sigma, Calculator, BookCheck, AudioWaveform, Trophy, Pencil } from "lucide-react";
import FourierTab from "@/components/FourierTab";
import PracticeExamTab from "@/components/PracticeExamTab";
import SchematicEditor from "@/components/SchematicEditor";
import MeshAnalysisTab from "@/components/MeshAnalysisTab";
import ACPhasorTab from "@/components/ACPhasorTab";
import BodePlotTab from "@/components/BodePlotTab";
import LaplaceTab from "@/components/LaplaceTab";
import QuickSolverTab from "@/components/QuickSolverTab";
import CheckHomeworkTab from "@/components/CheckHomeworkTab";
import ET310Coverage from '@/components/ET310Coverage';
import ErrorBoundary from "@/components/ErrorBoundary";

/** Each tab gets its own boundary and a reset key, so one broken panel cannot blank the app. */
const Tab = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <ErrorBoundary label={label} resetKey={label}>
    {children}
  </ErrorBoundary>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState("dc");

  // Payments are not live yet: no tab shows a lock until Stripe launches.
  const isLocked = (_tabId: string) => false;

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
              Verified calculations only
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
              Circuit calculations within
              <span className="text-primary glow-text"> tested scope</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl leading-relaxed">
              Confirm circuit values and connections before solving. Verified paths include a drawn DC schematic, DC nodal, a row of meshes, series and parallel AC phasors, first-order transients, tested RLC cases, Bode samples, distinct-pole Laplace, Fourier series, quick calculators, homework checks, and a practice exam with checked numeric keys. Photo and PDF upload stay off.
            </p>
          </div>
        </div>
      </section>

      {/* Solver Tabs */}
      <main className="container px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border h-auto p-1 flex-wrap">
            {import.meta.env.DEV && <TabsTrigger value="coverage" className="text-xs">ET310 Coverage</TabsTrigger>}
            <TabsTrigger value="dc" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">DC</span> Nodal
              {isLocked("dc") && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="mesh" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <GitBranch className="w-4 h-4" />
              Mesh
            </TabsTrigger>
            <TabsTrigger value="ac" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Waves className="w-4 h-4" />
              <span className="hidden sm:inline">AC</span> Phasor
            </TabsTrigger>
            <TabsTrigger value="transient" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">1st-Order</span> Transient
              {isLocked("transient") && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="rlc" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">2nd-Order</span> RLC
              {isLocked("rlc") && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="bode" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BarChart3 className="w-4 h-4" />
              Bode
            </TabsTrigger>
            <TabsTrigger value="laplace" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sigma className="w-4 h-4" />
              Laplace
            </TabsTrigger>
            <TabsTrigger value="fourier" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <AudioWaveform className="w-4 h-4" />
              Fourier
            </TabsTrigger>
            <TabsTrigger value="draw" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Pencil className="w-4 h-4" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="exam" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Trophy className="w-4 h-4" />
              Exam
            </TabsTrigger>
            <TabsTrigger value="quick" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Calculator className="w-4 h-4" />
              Quick
            </TabsTrigger>
            <TabsTrigger value="homework" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BookCheck className="w-4 h-4" />
              Homework
            </TabsTrigger>
            <TabsTrigger value="sage" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
              <Camera className="w-4 h-4" />
              Snap & Solve
              {isLocked("sage") && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Bookmark className="w-4 h-4" />
              Saved
              {isLocked("saved") && <Crown className="w-3 h-3 text-primary/50" />}
            </TabsTrigger>
            <TabsTrigger value="reference" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BookOpen className="w-4 h-4" />
              Reference
            </TabsTrigger>
          </TabsList>

          {import.meta.env.DEV && <TabsContent value="coverage"><Tab label="ET310 Coverage"><ET310Coverage /></Tab></TabsContent>}
          <TabsContent value="dc"><Tab label="DC Nodal"><TierGate tabId="dc"><DCAnalysisTab /></TierGate></Tab></TabsContent>
          <TabsContent value="mesh"><Tab label="Mesh"><TierGate tabId="mesh"><MeshAnalysisTab /></TierGate></Tab></TabsContent>
          <TabsContent value="ac"><Tab label="AC Phasor"><TierGate tabId="ac"><ACPhasorTab /></TierGate></Tab></TabsContent>
          <TabsContent value="transient"><Tab label="1st-Order Transient"><TierGate tabId="transient"><TransientTab /></TierGate></Tab></TabsContent>
          <TabsContent value="rlc"><Tab label="2nd-Order RLC"><TierGate tabId="rlc"><RLCTransientTab /></TierGate></Tab></TabsContent>
          <TabsContent value="bode"><Tab label="Bode"><TierGate tabId="bode"><BodePlotTab /></TierGate></Tab></TabsContent>
          <TabsContent value="laplace"><Tab label="Laplace"><TierGate tabId="laplace"><LaplaceTab /></TierGate></Tab></TabsContent>
          <TabsContent value="fourier"><Tab label="Fourier"><TierGate tabId="fourier"><FourierTab /></TierGate></Tab></TabsContent>
          <TabsContent value="draw"><Tab label="Draw"><TierGate tabId="draw"><SchematicEditor /></TierGate></Tab></TabsContent>
          <TabsContent value="exam"><Tab label="Exam"><TierGate tabId="exam"><PracticeExamTab /></TierGate></Tab></TabsContent>
          <TabsContent value="quick"><Tab label="Quick"><TierGate tabId="quick"><QuickSolverTab /></TierGate></Tab></TabsContent>
          <TabsContent value="homework"><Tab label="Homework"><TierGate tabId="homework"><CheckHomeworkTab /></TierGate></Tab></TabsContent>
          <TabsContent value="sage"><Tab label="Snap & Solve"><TierGate tabId="sage"><CircuitSagePanel onNavigateToTab={setActiveTab} /></TierGate></Tab></TabsContent>
          <TabsContent value="saved"><Tab label="Saved"><TierGate tabId="saved"><SavedProblemsTab /></TierGate></Tab></TabsContent>
          <TabsContent value="reference">
            <Tab label="Reference">
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
            </Tab>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Circuit Sage — circuit analysis with explicit verification scope</span>
          <span className="font-mono">tested scope</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
