// Midpoint quadrature for Fourier coefficients. This file does not use the
// solver's Simpson integrator or its closed-form coefficients.

export type FourierShape = 'square' | 'sawtooth' | 'triangle' | 'rectified_sine' | 'half_rectified' | 'pulse';

export interface FourierWave {
  waveform: FourierShape;
  amplitude: number;
  period: number;
  dutyCycle: number;
  dcOffset: number;
}

function sample(wave: FourierWave, t: number) {
  const T = wave.period;
  const A = wave.amplitude;
  const x = ((t % T) + T) % T;
  const half = T / 2;
  let y = 0;
  if (wave.waveform === 'square') y = x < half ? A : -A;
  else if (wave.waveform === 'sawtooth') y = A * (2 * x / T - 1);
  else if (wave.waveform === 'triangle') y = x < half ? A * (4 * x / T - 1) : A * (3 - 4 * x / T);
  else if (wave.waveform === 'rectified_sine') y = A * Math.abs(Math.sin((2 * Math.PI * x) / T));
  else if (wave.waveform === 'half_rectified') {
    const sine = A * Math.sin((2 * Math.PI * x) / T);
    y = sine > 0 ? sine : 0;
  } else y = x < wave.dutyCycle * T ? A : 0;
  return y + wave.dcOffset;
}

/** a0 is returned in `an` when n is 0. For n > 0, an and bn use the 2/T normalization. */
export function midpointFourier(wave: FourierWave, harmonic: number) {
  const samples = 24000;
  const T = wave.period;
  const omega = (2 * Math.PI) / T;
  let cosine = 0;
  let sine = 0;
  for (let k = 0; k < samples; k++) {
    const t = ((k + 0.5) * T) / samples;
    const value = sample(wave, t);
    cosine += value * Math.cos(harmonic * omega * t);
    sine += value * Math.sin(harmonic * omega * t);
  }
  const scale = harmonic === 0 ? 1 / samples : 2 / samples;
  return { an: cosine * scale, bn: harmonic === 0 ? 0 : sine * scale };
}
