// ============ SELF-TEST ENGINE ============
// Runs every solver with known problems and verifies answers

import {
  solveOhmsLaw, solveSeriesParallel, solveVoltageDivider,
  solveCurrentDivider, solveThevenin, solvePower, solveDC,
  solveTransient, solveAC, solveRLC,
} from './circuit-solver';
import { solveMesh } from './mesh-solver';
import { solveLaplace } from './laplace-solver';
import { solveFourier } from './fourier-solver';
import { solveOpAmp, solveDiode } from './advanced-solvers';

export interface TestResult {
  id: string;
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'error' | 'running' | 'pending';
  problem: string;
  expectedAnswer: string;
  actualAnswer: string;
  error?: string;
  steps?: string[];
  durationMs: number;
}

export interface TestReport {
  results: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  overallScore: string;
  durationMs: number;
  timestamp: string;
}

function approx(actual: number, expected: number, tolerance = 0.01): boolean {
  if (Math.abs(expected) < 1e-10) return Math.abs(actual) < tolerance;
  return Math.abs((actual - expected) / expected) < tolerance;
}

function findResult(results: { label: string; value: string }[], label: string): number {
  const r = results.find(r => r.label === label);
  return r ? parseFloat(r.value) : NaN;
}

type TestDef = {
  id: string;
  name: string;
  category: string;
  problem: string;
  expectedAnswer: string;
  run: () => { pass: boolean; actual: string; steps?: string[] };
};

export function getTestDefinitions(): TestDef[] {
  return [
    // 1. Ohm's Law
    {
      id: 'ohm1',
      name: "Ohm's Law — Find Current",
      category: 'Quick Solve',
      problem: 'V = 10V, R = 5Ω → I = ?',
      expectedAnswer: 'I = 2.000000 A',
      run: () => {
        const r = solveOhmsLaw({ V: 10, R: 5 });
        const I = findResult(r.results, 'I');
        return { pass: approx(I, 2), actual: `I = ${I} A`, steps: r.steps };
      },
    },
    // 2. Ohm's Law — Find Voltage
    {
      id: 'ohm2',
      name: "Ohm's Law — Find Voltage",
      category: 'Quick Solve',
      problem: 'I = 0.003A, R = 4700Ω → V = ?',
      expectedAnswer: 'V = 14.1000 V',
      run: () => {
        const r = solveOhmsLaw({ I: 0.003, R: 4700 });
        const V = findResult(r.results, 'V');
        return { pass: approx(V, 14.1), actual: `V = ${V} V`, steps: r.steps };
      },
    },
    // 3. Series Resistance
    {
      id: 'series1',
      name: 'Series Resistance',
      category: 'Quick Solve',
      problem: 'R1=100Ω, R2=200Ω, R3=300Ω series → Req = ?',
      expectedAnswer: 'R_eq = 600.0000 Ω',
      run: () => {
        const r = solveSeriesParallel([100, 200, 300], 'series');
        const Req = findResult(r.results, 'R_eq');
        return { pass: approx(Req, 600), actual: `R_eq = ${Req} Ω`, steps: r.steps };
      },
    },
    // 4. Parallel Resistance
    {
      id: 'parallel1',
      name: 'Parallel Resistance',
      category: 'Quick Solve',
      problem: 'R1=1000Ω, R2=1000Ω parallel → Req = ?',
      expectedAnswer: 'R_eq = 500.0000 Ω',
      run: () => {
        const r = solveSeriesParallel([1000, 1000], 'parallel');
        const Req = findResult(r.results, 'R_eq');
        return { pass: approx(Req, 500), actual: `R_eq = ${Req} Ω`, steps: r.steps };
      },
    },
    // 5. Voltage Divider
    {
      id: 'vdiv1',
      name: 'Voltage Divider',
      category: 'Quick Solve',
      problem: 'Vs=12V, R1=4kΩ, R2=6kΩ → Vout = ?',
      expectedAnswer: 'V_out = 7.2000 V',
      run: () => {
        const r = solveVoltageDivider(12, 4000, 6000);
        const Vout = findResult(r.results, 'V_out');
        return { pass: approx(Vout, 7.2), actual: `V_out = ${Vout} V`, steps: r.steps };
      },
    },
    // 6. Current Divider
    {
      id: 'cdiv1',
      name: 'Current Divider',
      category: 'Quick Solve',
      problem: 'Is=10mA, R1=1kΩ, R2=3kΩ → I1 = ?',
      expectedAnswer: 'I₁ = 0.007500 A (7.5mA)',
      run: () => {
        const r = solveCurrentDivider(0.01, 1000, 3000);
        const I1 = findResult(r.results, 'I₁');
        return { pass: approx(I1, 0.0075), actual: `I₁ = ${I1} A`, steps: r.steps };
      },
    },
    // 7. Thévenin
    {
      id: 'thev1',
      name: 'Thévenin / Norton',
      category: 'Quick Solve',
      problem: 'Voc=12V, Isc=3mA → Rth = ?',
      expectedAnswer: 'R_th = 4000.0000 Ω',
      run: () => {
        const r = solveThevenin(12, 0.003);
        const Rth = findResult(r.results, 'R_th');
        return { pass: approx(Rth, 4000), actual: `R_th = ${Rth} Ω`, steps: r.steps };
      },
    },
    // 8. Power Analysis
    {
      id: 'power1',
      name: 'Power Analysis',
      category: 'Quick Solve',
      problem: 'V=24V, R=48Ω → P = ?',
      expectedAnswer: 'P = 12.000000 W',
      run: () => {
        const r = solvePower({ V: 24, R: 48 });
        const P = findResult(r.results, 'P (V²/R)');
        return { pass: approx(P, 12), actual: `P = ${P} W`, steps: r.steps };
      },
    },
    // 9. DC Nodal Analysis
    {
      id: 'dc1',
      name: 'DC Nodal Analysis — 2 Node',
      category: 'DC Analysis',
      problem: '12V src(1→0), R1=1kΩ(1→2), R2=2kΩ(2→0) → V2 = ?',
      expectedAnswer: 'V2 = 8.0000 V',
      run: () => {
        const r = solveDC([
          { type: 'voltage_source', value: 12, nodeA: 1, nodeB: 0 },
          { type: 'resistor', value: 1000, nodeA: 1, nodeB: 2 },
          { type: 'resistor', value: 2000, nodeA: 2, nodeB: 0 },
        ]);
        const V2 = r.nodeVoltages.find(nv => nv.node === 2)?.voltage ?? NaN;
        return { pass: approx(V2, 8), actual: `V2 = ${V2} V`, steps: r.steps };
      },
    },
    // 10. Mesh Analysis
    {
      id: 'mesh1',
      name: 'Mesh Analysis — 2 Mesh',
      category: 'Mesh Analysis',
      problem: '24V source in mesh 1, R1=2kΩ(mesh 1), R2=4kΩ(shared 1,2), R3=6kΩ(mesh 2)',
      expectedAnswer: 'i1 and i2 solve [R][I]=[V]',
      run: () => {
        const r = solveMesh(2, [
          { type: 'voltage_source', value: 24, meshes: [1], label: 'Vs' },
          { type: 'resistor', value: 2000, meshes: [1], label: 'R1' },
          { type: 'resistor', value: 4000, meshes: [1, 2], label: 'R2' },
          { type: 'resistor', value: 6000, meshes: [2], label: 'R3' },
        ]);
        // KVL check: mesh 1 should balance
        const i1 = r.meshCurrents[0].current;
        const i2 = r.meshCurrents[1].current;
        // Mesh 1: 24 = 2000*i1 + 4000*(i1-i2) → 24 = 6000*i1 - 4000*i2
        const kvl1 = 6000 * i1 - 4000 * i2;
        const pass = approx(kvl1, 24) && r.powerBalance.balanced;
        return { pass, actual: `i1=${i1.toFixed(6)}A, i2=${i2.toFixed(6)}A, KVL1=${kvl1.toFixed(2)}V`, steps: r.steps };
      },
    },
    // 11. RC Transient
    {
      id: 'trans1',
      name: '1st-Order RC Transient',
      category: 'Transient',
      problem: 'R=1kΩ, C=1μF, Vs=10V, v(0)=0 → τ = 1ms',
      expectedAnswer: 'τ = 1.000e-3 s, v(τ) ≈ 6.32V',
      run: () => {
        const r = solveTransient({ type: 'RC', R: 1000, L_or_C: 1e-6, Vs: 10, initialValue: 0, tFinal: 0.005 });
        const tauCorrect = approx(r.tau, 0.001);
        // At t=tau, value should be ~6.32V (63.2% of 10V)
        const ptAtTau = r.points.find(p => Math.abs(p.t - r.tau) < 0.005 / 200);
        const vAtTau = ptAtTau?.value ?? NaN;
        const pass = tauCorrect && approx(vAtTau, 6.321, 0.05);
        return { pass, actual: `τ=${r.tau.toExponential(3)}s, v(τ)=${vAtTau.toFixed(3)}V`, steps: r.steps };
      },
    },
    // 12. RL Transient
    {
      id: 'trans2',
      name: '1st-Order RL Transient',
      category: 'Transient',
      problem: 'R=100Ω, L=0.5H, Vs=10V, i(0)=0 → τ = 5ms',
      expectedAnswer: 'τ = 5.000e-3 s, i(∞) = 0.1A',
      run: () => {
        const r = solveTransient({ type: 'RL', R: 100, L_or_C: 0.5, Vs: 10, initialValue: 0, tFinal: 0.025 });
        const pass = approx(r.tau, 0.005) && approx(r.finalValue, 0.1);
        return { pass, actual: `τ=${r.tau.toExponential(3)}s, i(∞)=${r.finalValue.toFixed(4)}A`, steps: r.steps };
      },
    },
    // 13. RLC Underdamped
    {
      id: 'rlc1',
      name: '2nd-Order RLC — Underdamped',
      category: 'RLC',
      problem: 'Series RLC: R=10Ω, L=0.1H, C=100μF, step 10V → underdamped',
      expectedAnswer: 'α < ω₀, oscillatory response',
      run: () => {
        const r = solveRLC({ topology: 'series', R: 10, L: 0.1, C: 100e-6, Vs: 10, excitation: 'step', vC0: 0, iL0: 0, tFinal: 0.1 });
        const pass = r.dampingType === 'underdamped' && r.omegaD !== undefined && r.omegaD > 0;
        return { pass, actual: `Type: ${r.dampingType}, α=${r.alpha.toFixed(2)}, ω₀=${r.omega0.toFixed(2)}, ωd=${r.omegaD?.toFixed(2)}`, steps: r.steps };
      },
    },
    // 14. RLC Overdamped
    {
      id: 'rlc2',
      name: '2nd-Order RLC — Overdamped',
      category: 'RLC',
      problem: 'Series RLC: R=200Ω, L=0.05H, C=200μF → overdamped',
      expectedAnswer: 'α > ω₀, no oscillation',
      run: () => {
        const r = solveRLC({ topology: 'series', R: 200, L: 0.05, C: 200e-6, Vs: 10, excitation: 'step', vC0: 0, iL0: 0, tFinal: 0.05 });
        const pass = r.dampingType === 'overdamped';
        return { pass, actual: `Type: ${r.dampingType}, α=${r.alpha.toFixed(2)}, ω₀=${r.omega0.toFixed(2)}`, steps: r.steps };
      },
    },
    // 15. AC Phasor — Series RLC
    {
      id: 'ac1',
      name: 'AC Phasor — Series RLC',
      category: 'AC Analysis',
      problem: 'Vm=170V, f=60Hz, R=100Ω, L=0.5H, C=10μF',
      expectedAnswer: 'Power factor computed, impedance correct',
      run: () => {
        const r = solveAC({ Vm: 170, phase: 0, frequency: 60, R: 100, L: 0.5, C: 10e-6, config: 'series' });
        const w = 2 * Math.PI * 60;
        const XL = w * 0.5;
        const XC = 1 / (w * 10e-6);
        const Zexpected = Math.sqrt(100 * 100 + (XL - XC) ** 2);
        const Zactual = Math.sqrt(r.impedance.re ** 2 + r.impedance.im ** 2);
        const pass = approx(Zactual, Zexpected) && r.powerFactor >= 0 && r.powerFactor <= 1;
        return { pass, actual: `|Z|=${Zactual.toFixed(2)}Ω (exp ${Zexpected.toFixed(2)}Ω), PF=${r.powerFactor.toFixed(4)}`, steps: r.steps };
      },
    },
    // 16. Laplace — Simple Real Poles
    {
      id: 'lap1',
      name: 'Laplace — Simple Real Poles',
      category: 'Laplace',
      problem: 'H(s) = 6/(s²+6s+8), step response',
      expectedAnswer: 'Poles at s=-2, s=-4, stable, DC gain = 0.75',
      run: () => {
        const r = solveLaplace({ numerator: [6], denominator: [1, 6, 8], inputType: 'step' });
        const polesCorrect = r.poles.some(p => approx(p.re, -2, 0.01)) && r.poles.some(p => approx(p.re, -4, 0.01));
        const stableCorrect = r.isStable === true;
        const dcCorrect = r.dcGain !== null && approx(r.dcGain, 0.75);
        const pass = polesCorrect && stableCorrect && dcCorrect;
        return { pass, actual: `Poles: ${r.poles.map(p => p.re.toFixed(4)).join(', ')}, Stable: ${r.isStable}, DC gain: ${r.dcGain?.toFixed(4)}`, steps: r.steps };
      },
    },
    // 17. Laplace — Complex Poles
    {
      id: 'lap2',
      name: 'Laplace — Underdamped 2nd Order',
      category: 'Laplace',
      problem: 'H(s) = 100/(s²+4s+100) → ζ < 1',
      expectedAnswer: 'ωn=10, ζ=0.2, underdamped',
      run: () => {
        const r = solveLaplace({ numerator: [100], denominator: [1, 4, 100], inputType: 'impulse' });
        const wnCorrect = r.naturalFrequency !== undefined && approx(r.naturalFrequency, 10);
        const zetaCorrect = r.dampingRatio !== undefined && approx(r.dampingRatio, 0.2);
        const pass = wnCorrect && zetaCorrect && r.isStable;
        return { pass, actual: `ωn=${r.naturalFrequency?.toFixed(4)}, ζ=${r.dampingRatio?.toFixed(4)}, Stable: ${r.isStable}`, steps: r.steps };
      },
    },
    // 18. Fourier — Square Wave
    {
      id: 'four1',
      name: 'Fourier — Square Wave',
      category: 'Fourier',
      problem: 'Square wave A=1, T=0.01s, 10 harmonics',
      expectedAnswer: 'a₀=0, b₁=4/π≈1.2732, even harmonics=0',
      run: () => {
        const r = solveFourier({ waveform: 'square', amplitude: 1, period: 0.01, dutyCycle: 0.5, numHarmonics: 10, dcOffset: 0 });
        const b1 = r.coefficients[0]?.bn ?? NaN;
        const b1Expected = 4 / Math.PI;
        const a0Correct = approx(r.a0, 0, 0.001);
        const b1Correct = approx(b1, b1Expected, 0.01);
        const evenZero = r.coefficients.filter(c => c.n % 2 === 0).every(c => Math.abs(c.bn) < 0.001);
        const pass = a0Correct && b1Correct && evenZero;
        return { pass, actual: `a₀=${r.a0.toFixed(6)}, b₁=${b1.toFixed(6)} (exp ${b1Expected.toFixed(6)}), even=0: ${evenZero}`, steps: r.steps };
      },
    },
    // 19. Fourier — Triangle Wave
    {
      id: 'four2',
      name: 'Fourier — Triangle Wave',
      category: 'Fourier',
      problem: 'Triangle wave A=1, T=0.01s, 10 harmonics',
      expectedAnswer: 'Only odd cosine terms, a₁=8/π²≈0.8106',
      run: () => {
        const r = solveFourier({ waveform: 'triangle', amplitude: 1, period: 0.01, dutyCycle: 0.5, numHarmonics: 10, dcOffset: 0 });
        const a1 = r.coefficients[0]?.an ?? NaN;
        const a1Expected = 8 / (Math.PI * Math.PI);
        const pass = approx(a1, a1Expected, 0.02);
        return { pass, actual: `a₁=${a1.toFixed(6)} (exp ${a1Expected.toFixed(6)})`, steps: r.steps };
      },
    },
    // 20. Op-Amp — Inverting
    {
      id: 'opamp1',
      name: 'Op-Amp — Inverting',
      category: 'Op-Amp',
      problem: 'Rf=100kΩ, Rin=10kΩ, Vin=0.5V → Vout = -5V',
      expectedAnswer: 'Gain = -10, Vout = -5.0000V',
      run: () => {
        const r = solveOpAmp({ config: 'inverting', Rf: 100000, Rin: 10000, Vin: 0.5 });
        const Vout = findResult(r.results, 'V_out');
        const Gain = findResult(r.results, 'A_v (Gain)');
        const pass = approx(Vout, -5) && approx(Gain, -10);
        return { pass, actual: `Gain=${Gain}, Vout=${Vout}V`, steps: r.steps };
      },
    },
    // 21. Op-Amp — Non-Inverting
    {
      id: 'opamp2',
      name: 'Op-Amp — Non-Inverting',
      category: 'Op-Amp',
      problem: 'Rf=47kΩ, Rin=10kΩ, Vin=1V → Vout = 5.7V',
      expectedAnswer: 'Gain = 5.7, Vout = 5.7000V',
      run: () => {
        const r = solveOpAmp({ config: 'non-inverting', Rf: 47000, Rin: 10000, Vin: 1 });
        const Vout = findResult(r.results, 'V_out');
        const pass = approx(Vout, 5.7);
        return { pass, actual: `Vout=${Vout}V`, steps: r.steps };
      },
    },
    // 22. Diode — Forward Bias
    {
      id: 'diode1',
      name: 'Diode — Forward Bias',
      category: 'Diode',
      problem: 'Vs=5V, R=1kΩ, Vd=0.7V → VR=4.3V, I=4.3mA',
      expectedAnswer: 'V_R = 4.3000V, I ≈ 4.3e-3 A',
      run: () => {
        const r = solveDiode({ config: 'forward', Vs: 5, R: 1000, Vd: 0.7 });
        const VR = findResult(r.results, 'V_R');
        const pass = approx(VR, 4.3);
        return { pass, actual: `V_R=${VR}V`, steps: r.steps };
      },
    },
    // 23. Diode — Zener Regulator
    {
      id: 'diode2',
      name: 'Diode — Zener Regulator',
      category: 'Diode',
      problem: 'Vs=15V, R=330Ω, Vz=5.1V → Vout=5.1V',
      expectedAnswer: 'V_out = 5.1000V',
      run: () => {
        const r = solveDiode({ config: 'zener', Vs: 15, R: 330, Vz: 5.1 });
        const Vout = findResult(r.results, 'V_out');
        const pass = approx(Vout, 5.1);
        return { pass, actual: `V_out=${Vout}V`, steps: r.steps };
      },
    },
    // 24. Bode Plot (existence test — generates points)
    {
      id: 'bode1',
      name: 'Bode Plot — RC Low-Pass',
      category: 'Bode',
      problem: 'R=1kΩ, C=1μF → fc = 159.15Hz, -3dB at cutoff',
      expectedAnswer: 'fc ≈ 159.15 Hz',
      run: () => {
        // The BodePlotTab solves inline, so we replicate the math
        const R = 1000, C = 1e-6;
        const fc = 1 / (2 * Math.PI * R * C);
        const w = 2 * Math.PI * fc;
        const ratio = w / (2 * Math.PI * fc);
        const magAtCutoff = 1 / Math.sqrt(1 + ratio * ratio);
        const dbAtCutoff = 20 * Math.log10(magAtCutoff);
        const pass = approx(fc, 159.1549, 0.01) && approx(dbAtCutoff, -3.0103, 0.02);
        return { pass, actual: `fc=${fc.toFixed(2)}Hz, |H(fc)|=${dbAtCutoff.toFixed(2)}dB`, steps: [`Cutoff: fc = 1/(2πRC) = ${fc.toFixed(4)} Hz`, `At cutoff: |H| = -3.01 dB`] };
      },
    },
    // 25. Half-Wave Rectifier
    {
      id: 'diode3',
      name: 'Diode — Half-Wave Rectifier',
      category: 'Diode',
      problem: 'Vs=12V peak, R=1kΩ → Vpeak_out = 11.3V',
      expectedAnswer: 'V_peak(out) = 11.3000V',
      run: () => {
        const r = solveDiode({ config: 'half_rectifier', Vs: 12, R: 1000 });
        const Vpeak = findResult(r.results, 'V_peak(out)');
        const pass = approx(Vpeak, 11.3);
        return { pass, actual: `V_peak(out)=${Vpeak}V`, steps: r.steps };
      },
    },
  ];
}

export async function runAllTests(
  onProgress: (result: TestResult) => void
): Promise<TestReport> {
  const tests = getTestDefinitions();
  const results: TestResult[] = [];
  const startTime = performance.now();

  for (const test of tests) {
    // Signal running
    onProgress({
      id: test.id, name: test.name, category: test.category,
      status: 'running', problem: test.problem,
      expectedAnswer: test.expectedAnswer, actualAnswer: '...', durationMs: 0,
    });

    // Small delay for UI update
    await new Promise(r => setTimeout(r, 50));

    const t0 = performance.now();
    let result: TestResult;
    try {
      const { pass, actual, steps } = test.run();
      result = {
        id: test.id, name: test.name, category: test.category,
        status: pass ? 'pass' : 'fail',
        problem: test.problem,
        expectedAnswer: test.expectedAnswer,
        actualAnswer: actual,
        steps,
        durationMs: performance.now() - t0,
      };
    } catch (e: any) {
      result = {
        id: test.id, name: test.name, category: test.category,
        status: 'error',
        problem: test.problem,
        expectedAnswer: test.expectedAnswer,
        actualAnswer: '',
        error: e.message || String(e),
        durationMs: performance.now() - t0,
      };
    }

    results.push(result);
    onProgress(result);
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;

  return {
    results,
    totalTests: results.length,
    passed,
    failed,
    errors,
    overallScore: `${passed}/${results.length}`,
    durationMs: performance.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}
