// ============ FOURIER SERIES ANALYSIS ENGINE ============
// Computes Fourier coefficients, plots harmonics, and shows full derivation

export type WaveformType = 'square' | 'sawtooth' | 'triangle' | 'rectified_sine' | 'half_rectified' | 'pulse' | 'custom';

export interface FourierInput {
  waveform: WaveformType;
  amplitude: number;    // Peak amplitude A
  period: number;       // T in seconds
  dutyCycle: number;    // For pulse waveform (0-1)
  numHarmonics: number; // How many harmonics to compute
  dcOffset: number;     // Optional DC offset
}

export interface FourierCoefficient {
  n: number;
  an: number;
  bn: number;
  cn: number;   // magnitude = √(an² + bn²)
  phaseN: number; // phase in degrees
}

export interface FourierResult {
  a0: number;
  coefficients: FourierCoefficient[];
  equation: string;
  fundamentalFreq: number;
  omega0: number;
  symmetry: string[];
  waveformPoints: { t: number; value: number }[];
  reconstructedPoints: { t: number; value: number }[];
  harmonicSpectrum: { n: number; magnitude: number; phase: number }[];
  steps: string[];
}

/**
 * Evaluate the chosen waveform at time t (normalized to period T).
 * Returns value in [-A, A] range.
 */
function evalWaveform(type: WaveformType, A: number, T: number, duty: number, t: number): number {
  const tNorm = ((t % T) + T) % T; // normalize to [0, T)
  const halfT = T / 2;

  switch (type) {
    case 'square':
      return tNorm < halfT ? A : -A;
    case 'sawtooth':
      return A * (2 * tNorm / T - 1);
    case 'triangle':
      if (tNorm < halfT) return A * (4 * tNorm / T - 1);
      return A * (3 - 4 * tNorm / T);
    case 'rectified_sine':
      return A * Math.abs(Math.sin(2 * Math.PI * tNorm / T));
    case 'half_rectified': {
      const sinVal = A * Math.sin(2 * Math.PI * tNorm / T);
      return sinVal > 0 ? sinVal : 0;
    }
    case 'pulse':
      return tNorm < duty * T ? A : 0;
    default:
      return 0;
  }
}

/**
 * Numerical integration using Simpson's rule
 */
function integrate(fn: (t: number) => number, a: number, b: number, N: number = 1000): number {
  const h = (b - a) / N;
  let sum = fn(a) + fn(b);
  for (let i = 1; i < N; i++) {
    const coeff = i % 2 === 0 ? 2 : 4;
    sum += coeff * fn(a + i * h);
  }
  return (h / 3) * sum;
}

/**
 * Get known closed-form Fourier coefficients for standard waveforms
 */
function getAnalyticCoefficients(type: WaveformType, A: number, n: number, duty: number): { an: number; bn: number } {
  switch (type) {
    case 'square':
      // a_n = 0 (odd symmetry), b_n = 4A/(nπ) for odd n, 0 for even
      return { an: 0, bn: n % 2 === 1 ? (4 * A) / (n * Math.PI) : 0 };
    case 'sawtooth':
      // Defined on [0,T): f(t)=A(2t/T−1). Integration by parts gives −2A/(nπ).
      return { an: 0, bn: -2 * A / (n * Math.PI) };
    case 'triangle':
      // The plotted waveform starts at −A, peaks at T/2; every odd cosine coefficient is negative.
      if (n % 2 === 0) return { an: 0, bn: 0 };
      return { an: -8 * A / (n * n * Math.PI * Math.PI), bn: 0 };
    default:
      return { an: NaN, bn: NaN }; // fall through to numerical
  }
}

export function solveFourier(input: FourierInput): FourierResult {
  const { waveform, amplitude: A, period: T, dutyCycle, numHarmonics, dcOffset } = input;
  const steps: string[] = [];
  const f0 = 1 / T;
  const omega0 = 2 * Math.PI * f0;

  steps.push(`═══════════════════════════════════════════════`);
  steps.push(`FOURIER SERIES ANALYSIS`);
  steps.push(`═══════════════════════════════════════════════`);
  steps.push(``);

  // Step 1: Waveform identification
  steps.push(`STEP 1: Waveform identification`);
  const waveformNames: Record<WaveformType, string> = {
    square: 'Square wave',
    sawtooth: 'Sawtooth wave',
    triangle: 'Triangle wave',
    rectified_sine: 'Full-wave rectified sine',
    half_rectified: 'Half-wave rectified sine',
    pulse: 'Rectangular pulse train',
    custom: 'Custom waveform',
  };
  steps.push(`  Waveform: ${waveformNames[waveform]}`);
  steps.push(`  Amplitude: A = ${A}`);
  steps.push(`  Period: T = ${T}s`);
  steps.push(`  Fundamental frequency: f₀ = 1/T = ${f0.toFixed(4)} Hz`);
  steps.push(`  Angular frequency: ω₀ = 2πf₀ = ${omega0.toFixed(4)} rad/s`);
  if (waveform === 'pulse') {
    steps.push(`  Duty cycle: D = ${(dutyCycle * 100).toFixed(1)}%`);
    steps.push(`  Pulse width: τ = DT = ${(dutyCycle * T).toFixed(6)}s`);
  }
  steps.push(``);

  // Step 2: Symmetry analysis
  steps.push(`STEP 2: Symmetry analysis`);
  const symmetry: string[] = [];

  // Generate waveform points for analysis and plotting
  const numPts = 500;
  const waveformPoints: { t: number; value: number }[] = [];
  for (let i = 0; i <= numPts; i++) {
    const t = (i / numPts) * 2 * T; // show 2 periods
    waveformPoints.push({ t, value: evalWaveform(waveform, A, T, dutyCycle, t) + dcOffset });
  }

  // Check symmetry properties
  const testPts = 200;
  let isEven = true, isOdd = true, isHalfWave = true;
  for (let i = 1; i < testPts; i++) {
    const t = (i / testPts) * T / 2;
    const fPos = evalWaveform(waveform, A, T, dutyCycle, t);
    const fNeg = evalWaveform(waveform, A, T, dutyCycle, -t + T); // f(-t) mapped to [0,T]
    const fNegDirect = evalWaveform(waveform, A, T, dutyCycle, T - t);
    const fHalf = evalWaveform(waveform, A, T, dutyCycle, t + T / 2);

    if (Math.abs(fPos - fNegDirect) > A * 0.01) isEven = false;
    if (Math.abs(fPos + fNegDirect) > A * 0.01) isOdd = false;
    if (Math.abs(fPos + fHalf) > A * 0.01) isHalfWave = false;
  }

  if (isEven) {
    symmetry.push('Even symmetry: f(-t) = f(t)');
    steps.push(`  ✓ Even symmetry detected: f(-t) = f(t)`);
    steps.push(`    → b_n = 0 for all n (only cosine terms)`);
  }
  if (isOdd) {
    symmetry.push('Odd symmetry: f(-t) = -f(t)');
    steps.push(`  ✓ Odd symmetry detected: f(-t) = -f(t)`);
    steps.push(`    → a_n = 0 for all n (only sine terms)`);
    steps.push(`    → a₀ = 0 (no DC component)`);
  }
  if (isHalfWave) {
    symmetry.push('Half-wave symmetry: f(t + T/2) = -f(t)');
    steps.push(`  ✓ Half-wave symmetry: f(t + T/2) = -f(t)`);
    steps.push(`    → Even harmonics are zero (n = 2,4,6,...)`);
  }
  if (!isEven && !isOdd) {
    symmetry.push('No even/odd symmetry');
    steps.push(`  Neither even nor odd — both a_n and b_n may be nonzero`);
  }
  steps.push(``);

  // Step 3: Compute a₀ (DC component)
  steps.push(`STEP 3: DC component (average value)`);
  steps.push(`  a₀ = (1/T) ∫₀ᵀ f(t) dt`);

  let a0: number;
  // Analytic DC values for known waveforms
  switch (waveform) {
    case 'square': a0 = 0; break;
    case 'sawtooth': a0 = 0; break;
    case 'triangle': a0 = 0; break;
    case 'rectified_sine': a0 = 2 * A / Math.PI; break;
    case 'half_rectified': a0 = A / Math.PI; break;
    case 'pulse': a0 = A * dutyCycle; break;
    default:
      a0 = (1 / T) * integrate(t => evalWaveform(waveform, A, T, dutyCycle, t), 0, T);
  }
  a0 += dcOffset;

  if (waveform === 'square' || waveform === 'sawtooth' || waveform === 'triangle') {
    steps.push(`  By symmetry (odd function): a₀ = 0`);
  } else if (waveform === 'rectified_sine') {
    steps.push(`  a₀ = (1/T) ∫₀ᵀ A|sin(ω₀t)| dt`);
    steps.push(`  a₀ = (2A/π) = 2(${A})/π = ${a0.toFixed(6)}`);
  } else if (waveform === 'half_rectified') {
    steps.push(`  a₀ = A/π = ${A}/π = ${a0.toFixed(6)}`);
  } else if (waveform === 'pulse') {
    steps.push(`  a₀ = A × D = ${A} × ${dutyCycle} = ${a0.toFixed(6)}`);
  }
  if (dcOffset !== 0) {
    steps.push(`  DC offset added: +${dcOffset} → a₀ = ${a0.toFixed(6)}`);
  }
  steps.push(``);

  // Step 4: Compute Fourier coefficients
  steps.push(`STEP 4: Fourier coefficients computation`);
  steps.push(`  a_n = (2/T) ∫₀ᵀ f(t)cos(nω₀t) dt`);
  steps.push(`  b_n = (2/T) ∫₀ᵀ f(t)sin(nω₀t) dt`);
  steps.push(``);

  const coefficients: FourierCoefficient[] = [];
  const harmonicSpectrum: { n: number; magnitude: number; phase: number }[] = [];

  // DC component in spectrum
  harmonicSpectrum.push({ n: 0, magnitude: Math.abs(a0), phase: 0 });

  for (let n = 1; n <= numHarmonics; n++) {
    let an: number, bn: number;

    // Try analytic first
    const analytic = getAnalyticCoefficients(waveform, A, n, dutyCycle);
    if (!isNaN(analytic.an) && !isNaN(analytic.bn)) {
      an = analytic.an;
      bn = analytic.bn;
    } else {
      // Numerical integration
      an = (2 / T) * integrate(t => evalWaveform(waveform, A, T, dutyCycle, t) * Math.cos(n * omega0 * t), 0, T);
      bn = (2 / T) * integrate(t => evalWaveform(waveform, A, T, dutyCycle, t) * Math.sin(n * omega0 * t), 0, T);
    }

    const cn = Math.sqrt(an * an + bn * bn);
    const phaseN = cn > 1e-10 ? Math.atan2(-bn, an) * (180 / Math.PI) : 0;

    coefficients.push({ n, an, bn, cn, phaseN });
    harmonicSpectrum.push({ n, magnitude: cn, phase: phaseN });

    // Show derivation for first few harmonics
    if (n <= 5 || cn > A * 0.01) {
      steps.push(`  n = ${n} (${n === 1 ? 'fundamental' : `${ordinal(n)} harmonic`}):`);
      steps.push(`    f = ${n}f₀ = ${(n * f0).toFixed(4)} Hz, ω = ${n}ω₀ = ${(n * omega0).toFixed(4)} rad/s`);

      // Show closed-form derivation for known waveforms
      if (waveform === 'square' && n % 2 === 1) {
        steps.push(`    a${n} = 0 (odd symmetry)`);
        steps.push(`    b${n} = 4A/(${n}π) = 4(${A})/(${n}π) = ${bn.toFixed(6)}`);
      } else if (waveform === 'square' && n % 2 === 0) {
        steps.push(`    a${n} = 0, b${n} = 0 (half-wave symmetry → even harmonics vanish)`);
      } else if (waveform === 'sawtooth') {
        steps.push(`    a${n} = 0 (odd symmetry)`);
        steps.push(`    b${n} = -2A/(${n}π) = ${bn.toFixed(6)}`);
      } else if (waveform === 'triangle') {
        if (n % 2 === 0) {
          steps.push(`    a${n} = 0, b${n} = 0 (half-wave symmetry)`);
        } else {
          steps.push(`    b${n} = 0 (even symmetry)`);
          steps.push(`    a${n} = -8A/(${n}²π²) = ${an.toFixed(6)}`);
        }
      } else {
        steps.push(`    a${n} = ${an.toFixed(6)}`);
        steps.push(`    b${n} = ${bn.toFixed(6)}`);
      }

      if (cn > 1e-10) {
        steps.push(`    c${n} = √(a${n}² + b${n}²) = ${cn.toFixed(6)}`);
        steps.push(`    φ${n} = atan2(-b${n}, a${n}) = ${phaseN.toFixed(1)}°`);
      }
      steps.push(``);
    }
  }

  // Step 5: Build the series equation
  steps.push(`STEP 5: Complete Fourier series`);
  steps.push(`  f(t) = a₀ + Σ[aₙcos(nω₀t) + bₙsin(nω₀t)]`);
  steps.push(``);

  const eqParts: string[] = [];
  if (Math.abs(a0) > 1e-10) eqParts.push(a0.toFixed(4));

  coefficients.forEach(c => {
    if (c.cn < 1e-10) return;
    if (Math.abs(c.an) > 1e-10) {
      eqParts.push(`${c.an > 0 ? '+' : '-'} ${Math.abs(c.an).toFixed(4)}cos(${c.n}ω₀t)`);
    }
    if (Math.abs(c.bn) > 1e-10) {
      eqParts.push(`${c.bn > 0 ? '+' : '-'} ${Math.abs(c.bn).toFixed(4)}sin(${c.n}ω₀t)`);
    }
  });

  const equation = eqParts.join(' ').replace(/^\+ /, '') || '0';
  steps.push(`  f(t) = ${equation}`);
  steps.push(``);

  // Compact form
  steps.push(`  Compact (amplitude-phase) form:`);
  const compactParts: string[] = [];
  if (Math.abs(a0) > 1e-10) compactParts.push(a0.toFixed(4));
  coefficients.forEach(c => {
    if (c.cn < 1e-10) return;
    compactParts.push(`${c.cn.toFixed(4)}cos(${c.n}ω₀t ${c.phaseN >= 0 ? '+' : '-'} ${Math.abs(c.phaseN).toFixed(1)}°)`);
  });
  steps.push(`  f(t) = ${compactParts.join(' + ') || '0'}`);
  steps.push(``);

  // Step 6: Reconstruct the signal
  steps.push(`STEP 6: Signal reconstruction (${numHarmonics} harmonics)`);

  const reconstructedPoints: { t: number; value: number }[] = [];
  for (let i = 0; i <= numPts; i++) {
    const t = (i / numPts) * 2 * T;
    let val = a0;
    coefficients.forEach(c => {
      val += c.an * Math.cos(c.n * omega0 * t) + c.bn * Math.sin(c.n * omega0 * t);
    });
    reconstructedPoints.push({ t, value: Math.round(val * 1e6) / 1e6 });
  }

  // Compute RMS error
  let errorSum = 0;
  for (let i = 0; i <= numPts; i++) {
    const diff = waveformPoints[i].value - reconstructedPoints[i].value;
    errorSum += diff * diff;
  }
  const rmsError = Math.sqrt(errorSum / (numPts + 1));
  steps.push(`  RMS reconstruction error: ${rmsError.toFixed(6)}`);
  steps.push(`  Relative error: ${((rmsError / A) * 100).toFixed(2)}%`);
  steps.push(``);

  // Step 7: Parseval's theorem verification
  steps.push(`STEP 7: Parseval's theorem verification`);
  steps.push(`  Average power from time domain:`);
  const powerTime = (1 / T) * integrate(t => {
    const v = evalWaveform(waveform, A, T, dutyCycle, t) + dcOffset;
    return v * v;
  }, 0, T);
  steps.push(`  P_avg = (1/T) ∫₀ᵀ f²(t) dt = ${powerTime.toFixed(6)}`);

  steps.push(`  Average power from Fourier coefficients:`);
  let powerFreq = a0 * a0;
  coefficients.forEach(c => {
    powerFreq += 0.5 * (c.an * c.an + c.bn * c.bn);
  });
  steps.push(`  P_avg = a₀² + ½Σ(aₙ² + bₙ²) = ${powerFreq.toFixed(6)}`);
  
  const parsevalMatch = Math.abs(powerTime - powerFreq) / Math.max(powerTime, 1e-12) < 0.05;
  steps.push(parsevalMatch 
    ? `  Truncated series captures ${((powerFreq / powerTime) * 100).toFixed(1)}% of estimated power; this is convergence evidence, not exact verification.`
    : `  ⚠ Partial power capture — add more harmonics for convergence`);
  steps.push(``);

  // Step 8: THD calculation
  steps.push(`STEP 8: Total Harmonic Distortion (THD)`);
  const c1 = coefficients[0]?.cn || 1e-12;
  let harmonicPower = 0;
  coefficients.slice(1).forEach(c => { harmonicPower += c.cn * c.cn; });
  const thd = Math.sqrt(harmonicPower) / c1 * 100;
  steps.push(`  THD = √(Σcₙ² for n≥2) / c₁ × 100%`);
  steps.push(`  THD = ${thd.toFixed(2)}%`);
  if (thd < 5) steps.push(`  ✓ Low distortion (nearly sinusoidal)`);
  else if (thd < 20) steps.push(`  Moderate harmonic content`);
  else steps.push(`  High harmonic content (rich spectrum)`);

  return {
    a0,
    coefficients,
    equation,
    fundamentalFreq: f0,
    omega0,
    symmetry,
    waveformPoints,
    reconstructedPoints,
    harmonicSpectrum,
    steps,
  };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
