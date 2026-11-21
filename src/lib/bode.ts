// Frequency-response samples. The plotted curve uses rectangular H(jω).
// A second, closed-form magnitude/phase expression has to agree before any
// point is returned.

export type BodeFilter = 'rc_lowpass' | 'rc_highpass' | 'rlc_bandpass' | 'rlc_series';

export interface BodePoint {
  freq: number;
  magDb: number;
  phaseDeg: number;
}

export interface BodeResult {
  filter: BodeFilter;
  fc: number;
  q?: number;
  points: BodePoint[];
  checkpoints: BodePoint[];
  steps: string[];
}

function rectangular(filter: BodeFilter, R: number, L: number, C: number, freq: number) {
  const w = 2 * Math.PI * freq;
  let re = 1;
  let im = 0;
  if (filter === 'rc_lowpass') {
    re = 1;
    im = w * R * C;
  } else if (filter === 'rc_highpass') {
    const denRe = 1;
    const denIm = w * R * C;
    const numRe = 0;
    const numIm = w * R * C;
    const d = denRe * denRe + denIm * denIm;
    re = (numRe * denRe + numIm * denIm) / d;
    im = (numIm * denRe - numRe * denIm) / d;
    return { mag: Math.hypot(re, im), phaseDeg: Math.atan2(im, re) * (180 / Math.PI) };
  } else {
    const x = w * L - 1 / (w * C);
    if (filter === 'rlc_bandpass') {
      const d = R * R + x * x;
      re = (R * R) / d;
      im = (-R * x) / d;
    } else {
      const zRe = R;
      const zIm = x;
      const numRe = 0;
      const numIm = -1 / (w * C);
      const d = zRe * zRe + zIm * zIm;
      re = (numRe * zRe + numIm * zIm) / d;
      im = (numIm * zRe - numRe * zIm) / d;
    }
  }
  if (filter === 'rc_lowpass') {
    const d = re * re + im * im;
    return { mag: 1 / Math.sqrt(d), phaseDeg: -Math.atan2(im, re) * (180 / Math.PI) };
  }
  return { mag: Math.hypot(re, im), phaseDeg: Math.atan2(im, re) * (180 / Math.PI) };
}

function closedForm(filter: BodeFilter, R: number, L: number, C: number, freq: number, fc: number) {
  const ratio = freq / fc;
  if (filter === 'rc_lowpass') {
    const mag = 1 / Math.sqrt(1 + ratio * ratio);
    return { mag, phaseDeg: -Math.atan(ratio) * (180 / Math.PI) };
  }
  if (filter === 'rc_highpass') {
    const mag = ratio / Math.sqrt(1 + ratio * ratio);
    return { mag, phaseDeg: 90 - Math.atan(ratio) * (180 / Math.PI) };
  }
  const w = 2 * Math.PI * freq;
  const x = w * L - 1 / (w * C);
  const z = Math.hypot(R, x);
  if (filter === 'rlc_bandpass') return { mag: R / z, phaseDeg: -Math.atan2(x, R) * (180 / Math.PI) };
  return { mag: (1 / (w * C)) / z, phaseDeg: -90 - Math.atan2(x, R) * (180 / Math.PI) };
}

function agree(actual: number, expected: number) {
  return Math.abs(actual - expected) <= 1e-6 * Math.max(1, Math.abs(actual), Math.abs(expected));
}

export function solveBode(filter: BodeFilter, R: number, L: number, C: number, fStart: number, fEnd: number): BodeResult {
  if (![R, C, fStart, fEnd].every(v => Number.isFinite(v) && v > 0) || !(fEnd > fStart)) {
    throw new Error('Positive R, C and an increasing frequency range are required.');
  }
  if (filter === 'rlc_bandpass' || filter === 'rlc_series') {
    if (!Number.isFinite(L) || L <= 0) throw new Error('Series RLC response needs a positive inductance.');
  }
  const steps: string[] = [];
  const fc = filter === 'rc_lowpass' || filter === 'rc_highpass'
    ? 1 / (2 * Math.PI * R * C)
    : 1 / (2 * Math.PI * Math.sqrt(L * C));
  const q = filter === 'rc_lowpass' || filter === 'rc_highpass' ? undefined : (1 / R) * Math.sqrt(L / C);
  steps.push(filter === 'rc_lowpass' ? 'RC low-pass. H(jω) = 1 / (1 + jωRC).' : filter === 'rc_highpass' ? 'RC high-pass. H(jω) = jωRC / (1 + jωRC).' : filter === 'rlc_bandpass' ? 'Series RLC band-pass. H(jω) = R / Z(jω).' : 'Series RLC, voltage across C. H(jω) = Z_C / Z(jω).');
  steps.push(`f_c = ${fc.toFixed(6)} Hz.${q === undefined ? '' : ` Q = ${q.toFixed(6)}.`}`);

  const checkFreqs = [fc / 10, fc / 2, fc, fc * 2, fc * 10].filter(f => f > 0 && Number.isFinite(f));
  for (const freq of checkFreqs) {
    const a = rectangular(filter, R, L, C, freq);
    const b = closedForm(filter, R, L, C, freq, fc);
    if (!agree(a.mag, b.mag) || !agree(a.phaseDeg, b.phaseDeg)) {
      throw new Error('Unverified: rectangular H(jω) disagrees with the closed-form magnitude and phase. Answer withheld.');
    }
  }

  const numPts = 200;
  const logFs = Math.log10(fStart);
  const logFe = Math.log10(fEnd);
  const points: BodePoint[] = [];
  for (let i = 0; i <= numPts; i++) {
    const freq = 10 ** (logFs + (i / numPts) * (logFe - logFs));
    const h = rectangular(filter, R, L, C, freq);
    if (!(h.mag > 0) || !Number.isFinite(h.phaseDeg)) throw new Error('Unverified: a frequency sample was not finite. Answer withheld.');
    points.push({ freq, magDb: 20 * Math.log10(h.mag), phaseDeg: h.phaseDeg });
  }
  const checkpoints = checkFreqs.map(freq => {
    const h = rectangular(filter, R, L, C, freq);
    return { freq, magDb: 20 * Math.log10(h.mag), phaseDeg: h.phaseDeg };
  });
  const atCorner = checkpoints.find(point => Math.abs(point.freq - fc) / fc < 1e-9);
  if (atCorner && (filter === 'rc_lowpass' || filter === 'rc_highpass')) {
    steps.push(`At f_c, |H| = ${atCorner.magDb.toFixed(3)} dB and ∠H = ${atCorner.phaseDeg.toFixed(3)}°.`);
  }
  steps.push('Verified: rectangular division and the closed-form magnitude agree at f_c/10, f_c/2, f_c, 2 f_c and 10 f_c.');
  return { filter, fc, q, points, checkpoints, steps };
}
