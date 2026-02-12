// ============ LAPLACE TRANSFORM / S-DOMAIN SOLVER ============
// Handles transfer functions, partial fractions, pole-zero, and inverse transforms

export interface LaplaceInput {
  /** Numerator coefficients [highest power ... constant], e.g. [6] for H(s)=6/... */
  numerator: number[];
  /** Denominator coefficients [highest power ... constant], e.g. [1, 6, 8] for s²+6s+8 */
  denominator: number[];
  /** Optional: input type for response calculation */
  inputType: 'impulse' | 'step' | 'custom';
  /** For custom: additional numerator multiplier in s-domain (e.g. 1/s for step) */
}

export interface Pole {
  re: number;
  im: number;
  multiplicity: number;
}

export interface PartialFraction {
  coefficient: number | { re: number; im: number };
  pole: Pole;
  label: string;
  timeDomain: string;
}

export interface LaplaceResult {
  transferFunction: string;
  poles: Pole[];
  zeros: { re: number; im: number }[];
  isStable: boolean;
  partialFractions: PartialFraction[];
  timeDomainResponse: string;
  dcGain: number | null;
  naturalFrequency?: number;
  dampingRatio?: number;
  steps: string[];
  poleZeroData: { poles: { x: number; y: number }[]; zeros: { x: number; y: number }[] };
}

function polyToString(coeffs: number[], variable: string = 's'): string {
  const n = coeffs.length - 1;
  const terms: string[] = [];
  for (let i = 0; i < coeffs.length; i++) {
    const c = coeffs[i];
    const power = n - i;
    if (Math.abs(c) < 1e-12) continue;
    
    let term = '';
    if (power === 0) {
      term = c.toString();
    } else if (power === 1) {
      term = Math.abs(c) === 1 ? (c > 0 ? variable : `-${variable}`) : `${c}${variable}`;
    } else {
      term = Math.abs(c) === 1 ? (c > 0 ? `${variable}²` : `-${variable}²`) : `${c}${variable}^${power}`;
      if (power === 2) {
        term = Math.abs(c) === 1 ? (c > 0 ? `${variable}²` : `-${variable}²`) : `${c}${variable}²`;
      }
    }
    
    if (terms.length > 0 && c > 0) term = '+ ' + term;
    terms.push(term);
  }
  return terms.join(' ') || '0';
}

function evalPoly(coeffs: number[], sRe: number, sIm: number): { re: number; im: number } {
  let re = 0, im = 0;
  const n = coeffs.length - 1;
  for (let i = 0; i < coeffs.length; i++) {
    const power = n - i;
    // s^power = (sRe + j*sIm)^power
    const sp = complexPow(sRe, sIm, power);
    re += coeffs[i] * sp.re;
    im += coeffs[i] * sp.im;
  }
  return { re, im };
}

function complexPow(re: number, im: number, n: number): { re: number; im: number } {
  if (n === 0) return { re: 1, im: 0 };
  let rr = 1, ri = 0;
  for (let i = 0; i < n; i++) {
    const newRe = rr * re - ri * im;
    const newIm = rr * im + ri * re;
    rr = newRe;
    ri = newIm;
  }
  return { re: rr, im: ri };
}

function complexDiv(a: { re: number; im: number }, b: { re: number; im: number }): { re: number; im: number } {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

/** Find roots of quadratic ax²+bx+c */
function quadraticRoots(a: number, b: number, c: number): Pole[] {
  const disc = b * b - 4 * a * c;
  if (disc >= 0) {
    const sqrtD = Math.sqrt(disc);
    return [
      { re: (-b + sqrtD) / (2 * a), im: 0, multiplicity: 1 },
      { re: (-b - sqrtD) / (2 * a), im: 0, multiplicity: 1 },
    ];
  } else {
    const realPart = -b / (2 * a);
    const imagPart = Math.sqrt(-disc) / (2 * a);
    return [
      { re: realPart, im: imagPart, multiplicity: 1 },
      { re: realPart, im: -imagPart, multiplicity: 1 },
    ];
  }
}

/** Find roots of polynomial up to degree 3 */
function findRoots(coeffs: number[]): Pole[] {
  const degree = coeffs.length - 1;
  // Normalize leading coefficient
  const a = coeffs.map(c => c / coeffs[0]);
  
  if (degree === 1) {
    return [{ re: -a[1], im: 0, multiplicity: 1 }];
  }
  if (degree === 2) {
    return quadraticRoots(1, a[1], a[2]);
  }
  if (degree === 3) {
    // Try rational root theorem for simple roots, then deflate
    // Test simple values
    for (const test of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
      const val = a[0] * test * test * test + a[1] * test * test + a[2] * test + a[3];
      if (Math.abs(val) < 1e-8) {
        // Deflate: divide by (s - test)
        const b1 = 1;
        const b2 = a[1] + test * b1;
        const b3 = a[2] + test * b2;
        const remaining = quadraticRoots(b1, b2, b3);
        return [{ re: test, im: 0, multiplicity: 1 }, ...remaining];
      }
    }
    // Numerical approximation for harder cubics using Newton's method
    let x = -a[1] / 3; // initial guess
    for (let iter = 0; iter < 100; iter++) {
      const fx = x * x * x + a[1] * x * x + a[2] * x + a[3];
      const fpx = 3 * x * x + 2 * a[1] * x + a[2];
      if (Math.abs(fpx) < 1e-15) break;
      x -= fx / fpx;
      if (Math.abs(fx) < 1e-10) break;
    }
    const b2 = a[1] + x;
    const b3 = a[2] + x * b2;
    const remaining = quadraticRoots(1, b2, b3);
    return [{ re: Math.round(x * 1e6) / 1e6, im: 0, multiplicity: 1 }, ...remaining];
  }
  
  // For higher degrees, only handle up to 3
  return [{ re: NaN, im: 0, multiplicity: 1 }];
}

export function solveLaplace(input: LaplaceInput): LaplaceResult {
  const { numerator, denominator, inputType } = input;
  const steps: string[] = [];

  steps.push(`═══════════════════════════════════════════`);
  steps.push(`LAPLACE TRANSFORM / S-DOMAIN ANALYSIS`);
  steps.push(`═══════════════════════════════════════════`);
  steps.push(``);

  // Step 1: Transfer function
  const numStr = polyToString(numerator);
  const denStr = polyToString(denominator);
  const tfStr = `H(s) = (${numStr}) / (${denStr})`;
  steps.push(`STEP 1: Transfer function`);
  steps.push(`  ${tfStr}`);
  steps.push(``);

  // Step 2: Find poles
  steps.push(`STEP 2: Find poles (roots of denominator)`);
  steps.push(`  Denominator: ${denStr} = 0`);
  
  const poles = findRoots(denominator);
  const degDen = denominator.length - 1;
  
  if (degDen === 2) {
    const a = denominator[0], b = denominator[1], c = denominator[2];
    const disc = b * b - 4 * a * c;
    steps.push(`  Using quadratic formula: s = [-b ± √(b²-4ac)] / 2a`);
    steps.push(`  a = ${a}, b = ${b}, c = ${c}`);
    steps.push(`  Discriminant: Δ = b² - 4ac = ${b}² - 4(${a})(${c}) = ${disc.toFixed(4)}`);
    if (disc >= 0) {
      steps.push(`  Δ ≥ 0 → Two real roots`);
    } else {
      steps.push(`  Δ < 0 → Complex conjugate pair`);
    }
  }
  
  poles.forEach((p, i) => {
    if (Math.abs(p.im) < 1e-10) {
      steps.push(`  s${i + 1} = ${p.re.toFixed(4)}`);
    } else {
      steps.push(`  s${i + 1} = ${p.re.toFixed(4)} ${p.im >= 0 ? '+' : '-'} j${Math.abs(p.im).toFixed(4)}`);
    }
  });
  steps.push(``);

  // Step 3: Find zeros
  steps.push(`STEP 3: Find zeros (roots of numerator)`);
  let zeros: { re: number; im: number }[] = [];
  if (numerator.length > 1) {
    const zeroRoots = findRoots(numerator);
    zeros = zeroRoots.map(z => ({ re: z.re, im: z.im }));
    zeros.forEach((z, i) => {
      if (Math.abs(z.im) < 1e-10) {
        steps.push(`  z${i + 1} = ${z.re.toFixed(4)}`);
      } else {
        steps.push(`  z${i + 1} = ${z.re.toFixed(4)} ${z.im >= 0 ? '+' : '-'} j${Math.abs(z.im).toFixed(4)}`);
      }
    });
  } else {
    steps.push(`  No finite zeros (numerator is constant: ${numerator[0]})`);
  }
  steps.push(``);

  // Step 4: Stability
  steps.push(`STEP 4: Stability analysis`);
  const isStable = poles.every(p => p.re < 0);
  const isMarginally = poles.some(p => Math.abs(p.re) < 1e-10 && Math.abs(p.im) > 1e-10);
  if (isStable) {
    steps.push(`  ✓ All poles have negative real parts → BIBO STABLE`);
  } else if (isMarginally) {
    steps.push(`  ⚠ Poles on imaginary axis → MARGINALLY STABLE`);
  } else {
    steps.push(`  ⚠ Pole(s) with Re(s) ≥ 0 → UNSTABLE`);
  }
  poles.forEach((p, i) => {
    steps.push(`  s${i + 1}: Re = ${p.re.toFixed(4)} ${p.re < 0 ? '(stable)' : '(unstable)'}`);
  });
  steps.push(``);

  // Step 5: Second-order parameters if applicable
  let naturalFrequency: number | undefined;
  let dampingRatio: number | undefined;
  if (degDen === 2) {
    steps.push(`STEP 5: Standard second-order parameters`);
    const wn2 = denominator[2] / denominator[0];
    naturalFrequency = Math.sqrt(Math.abs(wn2));
    dampingRatio = denominator[1] / (2 * denominator[0] * naturalFrequency);
    steps.push(`  Standard form: s² + 2ζω_n·s + ω_n²`);
    steps.push(`  ω_n² = ${wn2.toFixed(4)} → ω_n = ${naturalFrequency.toFixed(4)} rad/s`);
    steps.push(`  2ζω_n = ${(denominator[1] / denominator[0]).toFixed(4)} → ζ = ${dampingRatio.toFixed(4)}`);
    if (dampingRatio < 1) {
      steps.push(`  ζ < 1 → Underdamped`);
      const wd = naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
      steps.push(`  ω_d = ω_n√(1-ζ²) = ${wd.toFixed(4)} rad/s`);
    } else if (Math.abs(dampingRatio - 1) < 1e-6) {
      steps.push(`  ζ = 1 → Critically damped`);
    } else {
      steps.push(`  ζ > 1 → Overdamped`);
    }
    steps.push(``);
  }

  // Step 6: Partial fraction expansion
  steps.push(`STEP ${degDen === 2 ? '6' : '5'}: Partial fraction expansion`);
  
  // For the input response, multiply by 1/s for step
  let responseNum = [...numerator];
  let responseDen = [...denominator];
  
  if (inputType === 'step') {
    steps.push(`  Step response: multiply H(s) by 1/s`);
    steps.push(`  F(s) = H(s)/s = (${numStr}) / [s × (${denStr})]`);
    // Add s=0 pole: multiply denominator by s
    responseDen = [...denominator, 0]; // append 0 = multiply by s
    steps.push(``);
  } else if (inputType === 'impulse') {
    steps.push(`  Impulse response: F(s) = H(s) directly`);
    steps.push(``);
  }

  // Compute partial fractions for distinct real poles
  const responsePoles = findRoots(responseDen);
  const partialFractions: PartialFraction[] = [];
  
  const realPoles = responsePoles.filter(p => Math.abs(p.im) < 1e-10);
  const complexPoles = responsePoles.filter(p => Math.abs(p.im) >= 1e-10);

  // Real pole residues using cover-up method
  realPoles.forEach((pole, i) => {
    steps.push(`  Residue at s = ${pole.re.toFixed(4)} (cover-up method):`);
    
    // Evaluate numerator at pole
    const numVal = evalPoly(responseNum, pole.re, 0);
    
    // Evaluate denominator derivative or remaining factors at pole
    let denProduct = { re: 1, im: 0 };
    responsePoles.forEach((otherPole, j) => {
      if (j === responsePoles.indexOf(pole)) return;
      const diff = {
        re: pole.re - otherPole.re,
        im: -otherPole.im,
      };
      denProduct = {
        re: denProduct.re * diff.re - denProduct.im * diff.im,
        im: denProduct.re * diff.im + denProduct.im * diff.re,
      };
    });

    // Account for leading coefficient
    denProduct.re *= responseDen[0];
    denProduct.im *= responseDen[0];

    const residue = complexDiv(numVal, denProduct);
    
    steps.push(`    Numerator at s=${pole.re.toFixed(4)}: ${numVal.re.toFixed(6)}`);
    steps.push(`    Product of other factors: ${denProduct.re.toFixed(6)}`);
    steps.push(`    K${i + 1} = ${residue.re.toFixed(6)}`);

    let timeDomain: string;
    if (Math.abs(pole.re) < 1e-10) {
      timeDomain = `${residue.re.toFixed(4)}`;
    } else {
      timeDomain = `${residue.re.toFixed(4)}·e^(${pole.re.toFixed(4)}t)`;
    }
    
    partialFractions.push({
      coefficient: residue.re,
      pole,
      label: `${residue.re.toFixed(4)} / (s ${pole.re >= 0 ? '-' : '+'} ${Math.abs(pole.re).toFixed(4)})`,
      timeDomain,
    });
  });

  // Handle complex conjugate pairs
  if (complexPoles.length >= 2) {
    // Take first pair
    const p1 = complexPoles[0];
    steps.push(`  Complex conjugate pair: s = ${p1.re.toFixed(4)} ± j${Math.abs(p1.im).toFixed(4)}`);
    steps.push(`  Combined as: e^(${p1.re.toFixed(4)}t)[A·cos(${Math.abs(p1.im).toFixed(4)}t) + B·sin(${Math.abs(p1.im).toFixed(4)}t)]`);
    
    // Compute residue at complex pole
    const numVal = evalPoly(responseNum, p1.re, p1.im);
    let denProduct = { re: 1, im: 0 };
    responsePoles.forEach((otherPole) => {
      if (Math.abs(otherPole.re - p1.re) < 1e-10 && Math.abs(otherPole.im - p1.im) < 1e-10) return;
      const diff = {
        re: p1.re - otherPole.re,
        im: p1.im - otherPole.im,
      };
      denProduct = {
        re: denProduct.re * diff.re - denProduct.im * diff.im,
        im: denProduct.re * diff.im + denProduct.im * diff.re,
      };
    });
    denProduct.re *= responseDen[0];
    denProduct.im *= responseDen[0];

    const residue = complexDiv(numVal, denProduct);
    const A = 2 * residue.re;
    const B = -2 * residue.im;
    
    steps.push(`    Residue K = ${residue.re.toFixed(4)} ${residue.im >= 0 ? '+' : '-'} j${Math.abs(residue.im).toFixed(4)}`);
    steps.push(`    A = 2·Re(K) = ${A.toFixed(4)}, B = -2·Im(K) = ${B.toFixed(4)}`);

    const timeDomain = `e^(${p1.re.toFixed(4)}t)[${A.toFixed(4)}·cos(${Math.abs(p1.im).toFixed(4)}t) + ${B.toFixed(4)}·sin(${Math.abs(p1.im).toFixed(4)}t)]`;
    
    partialFractions.push({
      coefficient: { re: residue.re, im: residue.im },
      pole: p1,
      label: `Complex pair at σ=${p1.re.toFixed(4)}, ω=${Math.abs(p1.im).toFixed(4)}`,
      timeDomain,
    });
  }

  steps.push(``);

  // Step 7: Inverse transform
  const stepNum = degDen === 2 ? '7' : '6';
  steps.push(`STEP ${stepNum}: Inverse Laplace transform`);
  steps.push(`  f(t) = L⁻¹{F(s)} for t ≥ 0:`);
  steps.push(``);

  const timeDomainParts = partialFractions.map(pf => pf.timeDomain);
  const timeDomainResponse = timeDomainParts.join(' + ');
  steps.push(`  f(t) = ${timeDomainResponse}`);
  steps.push(``);

  // Step 8: DC gain
  const nextStep = parseInt(stepNum) + 1;
  steps.push(`STEP ${nextStep}: DC gain and final value`);
  let dcGain: number | null = null;
  if (isStable) {
    // DC gain = H(0) = num(0)/den(0)
    const num0 = numerator[numerator.length - 1];
    const den0 = denominator[denominator.length - 1];
    if (Math.abs(den0) > 1e-12) {
      dcGain = num0 / den0;
      steps.push(`  DC gain = H(0) = ${num0}/${den0} = ${dcGain.toFixed(4)}`);
    }
    if (inputType === 'step' && dcGain !== null) {
      steps.push(`  Final value (step): f(∞) = DC gain = ${dcGain.toFixed(4)}`);
    }
  } else {
    steps.push(`  System is unstable — DC gain not meaningful`);
  }
  steps.push(``);

  // Verification
  steps.push(`STEP ${nextStep + 1}: Verification`);
  // Initial value theorem: f(0+) = lim s→∞ s·F(s)
  if (inputType === 'step') {
    // s·F(s) = s · H(s)/s = H(s), lim s→∞ H(s) = num[0]/den[0] if same degree, 0 if den higher
    if (denominator.length > numerator.length) {
      steps.push(`  Initial value theorem: f(0⁺) = lim[s→∞] s·F(s) = 0`);
    }
  }
  if (isStable && inputType === 'step' && dcGain !== null) {
    steps.push(`  Final value theorem: f(∞) = lim[s→0] s·F(s) = ${dcGain.toFixed(4)}`);
  }
  steps.push(`  ✓ Pole locations confirm ${isStable ? 'stable' : 'unstable'} system`);

  // Prepare pole-zero plot data
  const poleZeroData = {
    poles: poles.map(p => ({ x: p.re, y: p.im })),
    zeros: zeros.map(z => ({ x: z.re, y: z.im })),
  };

  return {
    transferFunction: tfStr,
    poles,
    zeros,
    isStable,
    partialFractions,
    timeDomainResponse,
    dcGain,
    naturalFrequency,
    dampingRatio,
    steps,
    poleZeroData,
  };
}
