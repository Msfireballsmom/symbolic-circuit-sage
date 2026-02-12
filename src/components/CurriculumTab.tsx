import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookOpen, ChevronDown, CheckCircle2, FileText, FlaskConical, GraduationCap, Target } from "lucide-react";

interface Problem {
  id: string;
  question: string;
  hints: string[];
  solverTab?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Week {
  week: number;
  title: string;
  textbook: string;
  topics: string[];
  objectives: string[];
  problems: Problem[];
  labTitle?: string;
  labDescription?: string;
}

const curriculum: Week[] = [
  {
    week: 1,
    title: "DC Fundamentals & Ohm's Law",
    textbook: "Nilsson & Riedel Ch. 1–2",
    topics: [
      "SI units & prefixes (mA, kΩ, μF)",
      "Charge, current, voltage, power, energy",
      "Ohm's Law: V = IR",
      "Power: P = VI = I²R = V²/R",
      "Passive sign convention",
      "Series & parallel resistor combinations",
    ],
    objectives: [
      "Apply Ohm's Law to find V, I, or R",
      "Calculate power delivered/absorbed by each element",
      "Simplify series and parallel resistor networks",
      "Verify power balance (ΣP_delivered = ΣP_absorbed)",
    ],
    problems: [
      { id: "1.1", question: "A 12V battery drives current through a 4kΩ resistor. Find the current in mA and the power dissipated in mW.", hints: ["I = V/R", "P = V²/R or P = I²R"], solverTab: "quick", difficulty: "easy" },
      { id: "1.2", question: "Three resistors (1kΩ, 2.2kΩ, 3.3kΩ) are connected in series across a 24V source. Find R_eq, total current, and voltage across each resistor.", hints: ["R_eq = R1 + R2 + R3", "Voltage divider: V_k = V_s × R_k / R_eq"], solverTab: "quick", difficulty: "easy" },
      { id: "1.3", question: "Two resistors (6kΩ and 3kΩ) are in parallel. Find R_eq. If 10mA total current enters, find the current through each resistor.", hints: ["1/R_eq = 1/R1 + 1/R2", "Current divider: I1 = I_total × R2/(R1+R2)"], solverTab: "quick", difficulty: "easy" },
      { id: "1.4", question: "A circuit has a 20V source, R1=2kΩ in series with (R2=6kΩ ∥ R3=3kΩ). Find the current from the source, voltage across the parallel combination, and power delivered by the source.", hints: ["Simplify parallel first", "V_parallel = I × R_parallel"], solverTab: "quick", difficulty: "medium" },
      { id: "1.5", question: "For a circuit with V_s=15V, R1=1kΩ, R2=2kΩ, R3=3kΩ all in series: verify that the sum of voltage drops equals the source voltage (KVL) and that power delivered = power absorbed.", hints: ["KVL: V_s = V_R1 + V_R2 + V_R3", "P_source = V_s × I"], solverTab: "quick", difficulty: "medium" },
      { id: "1.6", question: "Design a voltage divider using two resistors to produce 5V from a 12V source. The total current should not exceed 1mA. What values of R1 and R2 should you use?", hints: ["V_out = V_s × R2/(R1+R2)", "I_total = V_s / (R1+R2) ≤ 1mA"], solverTab: "quick", difficulty: "hard" },
    ],
    labTitle: "Lab 1: DC Measurements & Verification",
    labDescription: "Build a series-parallel circuit in Multisim. Measure voltage drops with DMM. Verify Ohm's Law and power balance. Compare simulated vs. calculated values.",
  },
  {
    week: 2,
    title: "KVL, KCL & Node/Mesh Analysis",
    textbook: "Nilsson & Riedel Ch. 3–4",
    topics: [
      "Kirchhoff's Voltage Law (KVL): ΣV_loop = 0",
      "Kirchhoff's Current Law (KCL): ΣI_node = 0",
      "Node voltage method (choose reference, write KCL)",
      "Mesh current method (assign CW currents, write KVL)",
      "Supernodes and supermeshes",
      "Matrix formulation and Cramer's rule",
    ],
    objectives: [
      "Write KVL equations for any closed loop",
      "Write KCL equations at any node",
      "Set up and solve nodal analysis [G][V] = [I]",
      "Set up and solve mesh analysis [R][I] = [V]",
      "Handle voltage sources at nodes (supernodes)",
    ],
    problems: [
      { id: "2.1", question: "A circuit has 3 nodes (including reference). Two voltage sources (10V, 5V) and three resistors (1kΩ, 2kΩ, 4kΩ). Set up the nodal equations and solve for all node voltages.", hints: ["Write KCL at each non-reference node", "Use conductance matrix [G][V] = [I]"], solverTab: "dc", difficulty: "medium" },
      { id: "2.2", question: "A two-mesh circuit has V1=20V, R1=4kΩ, R2=2kΩ (shared), R3=6kΩ, V2=10V. Write KVL for each mesh and solve for mesh currents i1 and i2 using Cramer's rule.", hints: ["Mesh 1: V1 = (R1+R2)i1 - R2·i2", "Mesh 2: -V2 = -R2·i1 + (R2+R3)i2"], solverTab: "mesh", difficulty: "medium" },
      { id: "2.3", question: "Find all branch currents in a Wheatstone bridge: V_s=12V, R1=1kΩ, R2=2kΩ, R3=3kΩ, R4=4kΩ, R5=5kΩ (bridge resistor). Use mesh analysis with 3 meshes.", hints: ["3 meshes needed", "Build 3×3 impedance matrix"], solverTab: "mesh", difficulty: "hard" },
      { id: "2.4", question: "A circuit has a supernode: two nodes connected by a 5V voltage source. Write the supernode constraint and KCL equation. Other components: 2kΩ, 4kΩ, 10mA current source.", hints: ["Supernode: V_a - V_b = 5V", "Combined KCL at both nodes"], solverTab: "dc", difficulty: "hard" },
      { id: "2.5", question: "Verify your mesh analysis solution: check that KVL holds for every loop (ΣV = 0) and that power delivered by sources equals power absorbed by resistors.", hints: ["P_source = V × I", "P_R = I²R", "ΣP = 0"], solverTab: "mesh", difficulty: "medium" },
    ],
    labTitle: "Lab 2: Node & Mesh Verification in Multisim",
    labDescription: "Build a multi-loop circuit. Solve by hand using node and mesh methods. Simulate in Multisim and compare calculated vs. simulated voltages and currents.",
  },
  {
    week: 3,
    title: "Network Theorems: Thévenin, Norton, Superposition",
    textbook: "Nilsson & Riedel Ch. 4",
    topics: [
      "Source transformations (V↔I)",
      "Thévenin equivalent: V_th = V_oc, R_th = V_oc/I_sc",
      "Norton equivalent: I_N = I_sc, R_N = R_th",
      "Maximum power transfer: R_L = R_th",
      "Superposition principle",
      "Dependent sources in Thévenin/Norton",
    ],
    objectives: [
      "Find Thévenin equivalent at any two terminals",
      "Find Norton equivalent at any two terminals",
      "Determine load for maximum power transfer",
      "Apply superposition with multiple sources",
    ],
    problems: [
      { id: "3.1", question: "Find the Thévenin equivalent seen by R_L: circuit has V_s=24V, R1=6kΩ, R2=12kΩ, R3=4kΩ. R_L is across R3. Find V_th, R_th, and I through R_L=4kΩ.", hints: ["Remove R_L, find V_oc across terminals", "Deactivate sources, find R_th looking into terminals"], solverTab: "quick", difficulty: "medium" },
      { id: "3.2", question: "Find the Norton equivalent at terminals a-b: V_s=30V, R1=5kΩ, R2=10kΩ, R3=15kΩ. Find I_N, R_N.", hints: ["I_N = I_sc (short a-b)", "R_N = R_th (same method)"], solverTab: "quick", difficulty: "medium" },
      { id: "3.3", question: "A circuit has two voltage sources (V1=12V, V2=8V) and three resistors. Use superposition to find the current through R2=2kΩ. Show the contribution from each source separately.", hints: ["Source 1 alone: short V2, solve circuit", "Source 2 alone: short V1, solve circuit", "Total = sum"], solverTab: "quick", difficulty: "medium" },
      { id: "3.4", question: "For V_th=10V, R_th=2kΩ: (a) What R_L gives max power transfer? (b) What is P_max? (c) What is the efficiency at max power?", hints: ["R_L = R_th for max power", "P_max = V_th²/(4R_th)", "η = 50% at max power"], solverTab: "quick", difficulty: "easy" },
      { id: "3.5", question: "A circuit contains a dependent source (VCVS, gain=3): V_s=20V, R1=4kΩ, R2=8kΩ, V_x=3V_R2. Find Thévenin equivalent. (Cannot use R_th = V_oc/I_sc shortcut — must use test source method.)", hints: ["With dependent sources, apply test voltage V_t at terminals", "R_th = V_t / I_t"], solverTab: "quick", difficulty: "hard" },
    ],
    labTitle: "Lab 3: Thévenin & Norton Verification",
    labDescription: "Measure V_oc and I_sc experimentally. Calculate R_th. Verify maximum power transfer by varying R_L and plotting P_L vs R_L.",
  },
  {
    week: 4,
    title: "First-Order Transient Circuits (RC & RL)",
    textbook: "Nilsson & Riedel Ch. 7",
    topics: [
      "Natural response of RC: v(t) = V₀e^(-t/τ), τ = RC",
      "Natural response of RL: i(t) = I₀e^(-t/τ), τ = L/R",
      "Step response: x(t) = x(∞) + [x(0) - x(∞)]e^(-t/τ)",
      "Initial conditions: v_C(0⁻) = v_C(0⁺), i_L(0⁻) = i_L(0⁺)",
      "Switch analysis: t < 0 (steady state) → t > 0 (transient)",
      "Time constants and settling (5τ ≈ steady state)",
    ],
    objectives: [
      "Determine initial conditions from t < 0 steady state",
      "Calculate time constant τ for RC and RL circuits",
      "Write complete transient response x(t)",
      "Find specific values at given times",
    ],
    problems: [
      { id: "4.1", question: "RC natural response: C=10μF charged to 20V, R=5kΩ. Find τ, v(t), and the time when v = 5V.", hints: ["τ = RC", "v(t) = 20e^(-t/τ)", "Set 5 = 20e^(-t/τ), solve for t"], solverTab: "transient", difficulty: "easy" },
      { id: "4.2", question: "RL natural response: L=100mH, R=200Ω, i(0)=50mA. Find τ, i(t), and energy dissipated by R from t=0 to t=∞.", hints: ["τ = L/R", "W = ½Li(0)²"], solverTab: "transient", difficulty: "easy" },
      { id: "4.3", question: "RC step response: V_s=10V, R=2kΩ, C=47μF, v_C(0)=0V. Find v_C(t), i(t), and v_C at t=2τ.", hints: ["v_C(t) = V_s(1 - e^(-t/τ))", "i(t) = (V_s/R)e^(-t/τ)", "At t=2τ: ~86.5%"], solverTab: "transient", difficulty: "medium" },
      { id: "4.4", question: "Switch problem: A switch opens at t=0. For t<0: V_s=12V, R1=3kΩ, R2=6kΩ, C=22μF. For t>0: C discharges through R2. Find v_C(0), τ, and v_C(t) for t>0.", hints: ["t<0: v_C = V_s × R2/(R1+R2) (voltage divider)", "t>0: τ = R2·C"], solverTab: "transient", difficulty: "medium" },
      { id: "4.5", question: "RL step response with switch: V_s=24V, R1=4kΩ, R2=8kΩ, L=200mH. Switch closes at t=0. For t<0: i_L=0. Find i_L(t), v_L(t), and time to reach 90% of final value.", hints: ["R_th for t>0 circuit", "τ = L/R_th", "90% at t = 2.303τ"], solverTab: "transient", difficulty: "hard" },
      { id: "4.6", question: "Sequential switching: At t=0, switch 1 opens. At t=10ms, switch 2 closes. V_s=15V, R=10kΩ, C=1μF. Find v_C(t) in each interval.", hints: ["Solve 0 < t < 10ms first", "v_C(10ms) becomes new initial condition"], solverTab: "transient", difficulty: "hard" },
    ],
    labTitle: "Lab 4: RC & RL Transient Measurements",
    labDescription: "Build RC and RL circuits. Capture transient waveforms with oscilloscope. Measure τ from the waveform. Compare experimental vs. calculated time constants.",
  },
  {
    week: 5,
    title: "Second-Order Circuits (RLC)",
    textbook: "Nilsson & Riedel Ch. 8",
    topics: [
      "Series RLC: α = R/(2L), ω₀ = 1/√(LC)",
      "Parallel RLC: α = 1/(2RC), ω₀ = 1/√(LC)",
      "Overdamped (α > ω₀): two real roots s₁, s₂",
      "Critically damped (α = ω₀): repeated root",
      "Underdamped (α < ω₀): complex roots, oscillation",
      "Damped frequency: ω_d = √(ω₀² - α²)",
      "Initial conditions: v_C(0), i_L(0), dv/dt(0), di/dt(0)",
    ],
    objectives: [
      "Classify damping type from R, L, C values",
      "Write characteristic equation and find roots",
      "Determine coefficients from initial conditions",
      "Write complete natural and step responses",
    ],
    problems: [
      { id: "5.1", question: "Series RLC: R=100Ω, L=10mH, C=1μF. Find α, ω₀, classify damping, and find s₁, s₂ or s, ω_d.", hints: ["α = R/(2L)", "ω₀ = 1/√(LC)", "Compare α vs ω₀"], solverTab: "rlc", difficulty: "easy" },
      { id: "5.2", question: "Parallel RLC natural response: R=2kΩ, L=50mH, C=0.2μF. v_C(0)=10V, i_L(0)=0. Find v(t) for t>0.", hints: ["α = 1/(2RC)", "Find damping type", "Apply initial conditions to find A₁, A₂"], solverTab: "rlc", difficulty: "medium" },
      { id: "5.3", question: "Find R for critical damping in a series RLC: L=25mH, C=10μF. Then find the response v_C(t) if v_C(0)=5V and dv_C/dt(0)=0.", hints: ["Critical: α = ω₀ → R = 2√(L/C)", "v(t) = (A₁ + A₂t)e^(-αt)"], solverTab: "rlc", difficulty: "medium" },
      { id: "5.4", question: "Underdamped series RLC step response: V_s=20V, R=50Ω, L=10mH, C=4.7μF. v_C(0)=0, i(0)=0. Find v_C(t) including the oscillation frequency and decay envelope.", hints: ["ω_d = √(ω₀² - α²)", "v(t) = V_f + e^(-αt)(A₁cos(ω_d·t) + A₂sin(ω_d·t))"], solverTab: "rlc", difficulty: "hard" },
      { id: "5.5", question: "Design problem: Choose R so the step response of a series RLC (L=100mH, C=10μF) settles within 5ms with no overshoot. What damping type does this require?", hints: ["No overshoot → overdamped or critically damped", "Settling ≈ 5τ for overdamped", "Try critical damping first"], solverTab: "rlc", difficulty: "hard" },
    ],
    labTitle: "Lab 5: RLC Transient Responses",
    labDescription: "Build series RLC circuits with different R values to observe all three damping cases. Capture waveforms. Measure ω_d for underdamped case.",
  },
  {
    week: 6,
    title: "AC Steady-State & Phasor Analysis",
    textbook: "Nilsson & Riedel Ch. 9–10",
    topics: [
      "Sinusoidal sources: v(t) = V_m cos(ωt + φ)",
      "Phasor representation: V = V_m∠φ",
      "Impedance: Z_R = R, Z_L = jωL, Z_C = 1/(jωC)",
      "Ohm's law in phasor domain: V = IZ",
      "Series and parallel impedance combinations",
      "Voltage and current dividers with impedances",
      "Power: P = ½V_m I_m cos(θ_v - θ_i)",
      "Power factor and complex power S = P + jQ",
    ],
    objectives: [
      "Convert time-domain signals to phasor domain",
      "Calculate impedances at a given frequency",
      "Solve AC circuits using phasor methods",
      "Compute real, reactive, and apparent power",
    ],
    problems: [
      { id: "6.1", question: "Convert to phasors: v(t) = 170cos(377t + 30°) and i(t) = 5sin(377t - 45°). Find the impedance Z = V/I.", hints: ["sin → cos: subtract 90°", "Z = V∠θ_v / I∠θ_i"], solverTab: "ac", difficulty: "easy" },
      { id: "6.2", question: "Series RLC at ω = 1000 rad/s: R=200Ω, L=100mH, C=5μF. Find Z_total, I if V_s = 10∠0° V, and voltage across each element.", hints: ["Z_L = jωL, Z_C = -j/(ωC)", "Z_total = R + Z_L + Z_C"], solverTab: "ac", difficulty: "medium" },
      { id: "6.3", question: "Parallel RL: R=1kΩ ∥ L=500mH, f=60Hz. Find equivalent impedance in rectangular and polar form. If V=120∠0°V, find total current.", hints: ["1/Z_eq = 1/R + 1/(jωL)", "I = V/Z_eq"], solverTab: "ac", difficulty: "medium" },
      { id: "6.4", question: "For V_s = 120∠0°V at 60Hz, load Z = 30 + j40 Ω: find I, P (real), Q (reactive), S (apparent), and power factor.", hints: ["I = V/Z", "S = VI*/2", "pf = cos(θ_z)"], solverTab: "ac", difficulty: "medium" },
      { id: "6.5", question: "AC voltage divider: V_s = 100∠0°V, Z1 = 50∠30°Ω, Z2 = 100∠-60°Ω. Find V_out across Z2 in both phasor and time-domain form (ω = 377 rad/s).", hints: ["V_out = V_s × Z2/(Z1+Z2)", "Convert polar result back to time domain"], solverTab: "ac", difficulty: "hard" },
      { id: "6.6", question: "Power factor correction: A motor draws 5kW at 0.7 lagging pf from 240Vrms, 60Hz. What capacitor (in μF) is needed to correct to 0.95 lagging?", hints: ["Q_old = P·tan(θ_old)", "Q_new = P·tan(θ_new)", "Q_C = Q_old - Q_new = V²ωC"], solverTab: "ac", difficulty: "hard" },
    ],
    labTitle: "Lab 5: Sinusoidal Steady-State Analysis",
    labDescription: "Measure AC voltages and currents with oscilloscope. Verify phasor relationships. Measure phase angle between V and I. Calculate power and power factor.",
  },
  {
    week: 7,
    title: "Laplace Transform & s-Domain Analysis",
    textbook: "Nilsson & Riedel Ch. 12–13",
    topics: [
      "Laplace transform definition: F(s) = ∫₀^∞ f(t)e^(-st)dt",
      "Common transforms: u(t)→1/s, e^(-at)→1/(s+a), cos(ωt)→s/(s²+ω²)",
      "Properties: linearity, differentiation, integration, shifting",
      "s-domain circuit models: L→sL, C→1/(sC) with initial conditions",
      "Transfer function: H(s) = V_out(s)/V_in(s)",
      "Partial fraction expansion and inverse transform",
      "Pole-zero analysis and stability",
    ],
    objectives: [
      "Transform circuits to s-domain with initial conditions",
      "Derive transfer functions",
      "Perform partial fraction expansion",
      "Find inverse Laplace transforms",
      "Analyze stability from pole locations",
    ],
    problems: [
      { id: "7.1", question: "Find the Laplace transform of: f(t) = 5e^(-3t) + 2cos(4t) - 3u(t). Express as a single rational function.", hints: ["L{e^(-at)} = 1/(s+a)", "L{cos(ωt)} = s/(s²+ω²)", "L{u(t)} = 1/s"], solverTab: "laplace", difficulty: "easy" },
      { id: "7.2", question: "RC circuit in s-domain: R=1kΩ, C=1μF, v_C(0)=5V, V_s(s)=10/s. Find V_C(s) and v_C(t).", hints: ["V_C(s) = [V_s/(sRC+1)] + [v_C(0)/(s+1/RC)]", "Partial fractions → inverse transform"], solverTab: "laplace", difficulty: "medium" },
      { id: "7.3", question: "Find the inverse Laplace transform of: F(s) = (3s + 12) / [(s+1)(s+4)]. Use partial fraction expansion (cover-up method).", hints: ["A/(s+1) + B/(s+4)", "A = F(s)(s+1)|_{s=-1}", "B = F(s)(s+4)|_{s=-4}"], solverTab: "laplace", difficulty: "medium" },
      { id: "7.4", question: "Transfer function: H(s) = 100/(s² + 6s + 25). Find poles, zeros, classify stability, natural frequency, and damping ratio. Find the unit step response.", hints: ["Poles: s² + 6s + 25 = 0", "ζ = α/ω_n", "Underdamped: complex poles"], solverTab: "laplace", difficulty: "hard" },
      { id: "7.5", question: "Series RLC in s-domain: R=10Ω, L=1H, C=0.04F, v_C(0)=0, i(0)=2A, input=10u(t)V. Find I(s) and i(t).", hints: ["Z_total(s) = R + sL + 1/(sC)", "Include initial conditions as sources", "Partial fractions"], solverTab: "laplace", difficulty: "hard" },
    ],
    labTitle: "Lab 6: Laplace Transform & s-Domain Analysis",
    labDescription: "Transform a transient circuit to s-domain. Solve algebraically. Verify with time-domain simulation in Multisim. Compare analytical i(t) with simulation.",
  },
  {
    week: 8,
    title: "Fourier Series & Frequency Response",
    textbook: "Nilsson & Riedel Ch. 16–17",
    topics: [
      "Fourier series: f(t) = a₀ + Σ[aₙcos(nω₀t) + bₙsin(nω₀t)]",
      "Coefficient formulas: a₀, aₙ, bₙ",
      "Symmetry shortcuts: even (bₙ=0), odd (aₙ=0), half-wave (even harmonics=0)",
      "Parseval's theorem: power from Fourier coefficients",
      "Frequency response: H(jω) = |H|∠θ",
      "Bode plots: magnitude and phase",
      "Filters: low-pass, high-pass, band-pass",
    ],
    objectives: [
      "Compute Fourier coefficients for periodic waveforms",
      "Apply symmetry to simplify calculations",
      "Use Parseval's theorem for power analysis",
      "Evaluate circuit response to each harmonic",
    ],
    problems: [
      { id: "8.1", question: "Find the Fourier series of a square wave: amplitude A=5V, period T=2ms. Compute a₀, aₙ, bₙ for n=1 to 5.", hints: ["Square wave: bₙ = 4A/(nπ) for odd n", "Even function → bₙ = 0 if centered at peak"], solverTab: "fourier", difficulty: "medium" },
      { id: "8.2", question: "Sawtooth wave: V_peak=10V, f₀=1kHz. Find the Fourier series. What percentage of total power is in the first 3 harmonics? (Use Parseval's)", hints: ["Sawtooth: bₙ = -2V/(nπ)×(-1)^(n+1)", "P_total = Σ(cₙ²)"], solverTab: "fourier", difficulty: "medium" },
      { id: "8.3", question: "A triangle wave (V_peak=8V, T=4ms) passes through an RC low-pass filter (R=1kΩ, C=0.1μF). Find the output voltage for the fundamental and 3rd harmonic. What is the THD of the output?", hints: ["H(jω) = 1/(1+jωRC)", "|H| at each harmonic frequency", "THD = √(ΣV_n²)/V_1"], solverTab: "fourier", difficulty: "hard" },
      { id: "8.4", question: "Half-wave rectified sine: V_m=170V, f=60Hz. Find the DC component, fundamental, and 2nd harmonic coefficients. Verify with Parseval's theorem.", hints: ["Half-wave: a₀ = V_m/π", "Special case: both aₙ and bₙ needed"], solverTab: "fourier", difficulty: "hard" },
      { id: "8.5", question: "Design an LC filter to remove the 3rd harmonic (180Hz) from a 60Hz square wave signal. What L and C values create a series resonance trap at 180Hz?", hints: ["ω₀ = 1/√(LC) = 2π(180)", "Choose practical L, solve for C"], solverTab: "fourier", difficulty: "hard" },
    ],
    labTitle: "Lab 7: Fourier Analysis & Filtering",
    labDescription: "Generate periodic waveforms. Use FFT on oscilloscope to verify harmonic content. Build a low-pass filter and observe harmonic attenuation.",
  },
];

const difficultyColor = {
  easy: "bg-green-500/10 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  hard: "bg-red-500/10 text-red-400 border-red-500/30",
};

const CurriculumTab = () => {
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([1]));

  const toggle = (week: number) => {
    setOpenWeeks(prev => {
      const next = new Set(prev);
      next.has(week) ? next.delete(week) : next.add(week);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-6 h-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-bold text-foreground">ET310 Circuit Analysis — Full Curriculum</h3>
              <p className="text-xs text-muted-foreground mt-1">
                8 weeks • Nilsson & Riedel textbook • {curriculum.reduce((a, w) => a + w.problems.length, 0)} practice problems with hints • Lab descriptions included
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Each problem links to the solver tab that can help you work through it step-by-step.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weeks */}
      {curriculum.map(week => (
        <Collapsible key={week.week} open={openWeeks.has(week.week)} onOpenChange={() => toggle(week.week)}>
          <Card className="border-border">
            <CollapsibleTrigger className="w-full text-left">
              <CardHeader className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
                      {week.week}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{week.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{week.textbook} • {week.problems.length} problems</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${openWeeks.has(week.week) ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="p-4 pt-0 space-y-4">
                {/* Topics */}
                <div className="p-3 rounded-md bg-muted/30 border border-border">
                  <h4 className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-2">
                    <BookOpen className="w-3.5 h-3.5" /> Topics Covered
                  </h4>
                  <ul className="grid sm:grid-cols-2 gap-1">
                    {week.topics.map((t, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-primary mt-0.5">•</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Objectives */}
                <div className="p-3 rounded-md bg-muted/30 border border-border">
                  <h4 className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-2">
                    <Target className="w-3.5 h-3.5" /> Learning Objectives
                  </h4>
                  <ul className="space-y-1">
                    {week.objectives.map((o, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {o}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Problems */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5 text-primary" /> Assignment Problems
                  </h4>
                  <div className="space-y-2">
                    {week.problems.map(p => (
                      <ProblemCard key={p.id} problem={p} />
                    ))}
                  </div>
                </div>

                {/* Lab */}
                {week.labTitle && (
                  <div className="p-3 rounded-md bg-accent/10 border border-accent/30">
                    <h4 className="text-xs font-semibold text-accent-foreground flex items-center gap-1.5 mb-1">
                      <FlaskConical className="w-3.5 h-3.5" /> {week.labTitle}
                    </h4>
                    <p className="text-xs text-muted-foreground">{week.labDescription}</p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
};

const ProblemCard = ({ problem }: { problem: Problem }) => {
  const [showHints, setShowHints] = useState(false);

  return (
    <div className="p-3 rounded-md bg-card border border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-primary">#{problem.id}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${difficultyColor[problem.difficulty]}`}>
              {problem.difficulty}
            </Badge>
            {problem.solverTab && (
              <span className="text-[10px] text-muted-foreground">→ use {problem.solverTab} tab</span>
            )}
          </div>
          <p className="text-xs text-foreground leading-relaxed">{problem.question}</p>
        </div>
      </div>
      <button
        onClick={() => setShowHints(!showHints)}
        className="mt-2 text-[10px] text-primary hover:underline"
      >
        {showHints ? "Hide hints" : "Show hints"}
      </button>
      {showHints && (
        <div className="mt-1.5 space-y-0.5">
          {problem.hints.map((h, i) => (
            <p key={i} className="text-[11px] font-mono text-muted-foreground">💡 {h}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default CurriculumTab;
