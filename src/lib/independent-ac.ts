// Time-domain audit for phasor answers. This file does not import the AC solver
// or its complex helpers. It rebuilds v(t) and i(t) from the reported peak
// phasor and checks KVL (series) or KCL (parallel), then the RMS power split.

export interface PhasorAuditInput {
  Vm: number;
  phase: number;
  frequency: number;
  R: number;
  L: number;
  C: number;
  config: 'series' | 'parallel';
}

export interface PhasorAuditReport {
  current: { re: number; im: number };
  powerReal: number;
  powerReactive: number;
  powerApparent: number;
  powerFactor: number;
}

function sampleTimes(omega: number) {
  const times: number[] = [];
  for (let k = 0; k < 24; k++) times.push((k / 24) * (2 * Math.PI / omega));
  return times;
}

function seriesResidual(input: PhasorAuditInput, current: { re: number; im: number }) {
  const { Vm, phase: phaseDeg, R, L, C } = input;
  const w = 2 * Math.PI * input.frequency;
  const phase = phaseDeg * Math.PI / 180;
  let worst = 0;
  for (const t of sampleTimes(w)) {
    const cos = Math.cos(w * t);
    const sin = Math.sin(w * t);
    const i = current.re * cos - current.im * sin;
    const di = -w * current.re * sin - w * current.im * cos;
    const integ = (current.re * sin + current.im * cos) / w;
    const v = R * i + (L > 0 ? L * di : 0) + (C > 0 ? integ / C : 0);
    const source = Vm * Math.cos(w * t + phase);
    worst = Math.max(worst, Math.abs(v - source));
  }
  return worst;
}

function parallelResidual(input: PhasorAuditInput, current: { re: number; im: number }) {
  const { Vm, phase: phaseDeg, R, L, C } = input;
  const w = 2 * Math.PI * input.frequency;
  const phase = phaseDeg * Math.PI / 180;
  let worst = 0;
  for (const t of sampleTimes(w)) {
    const cos = Math.cos(w * t);
    const sin = Math.sin(w * t);
    const v = Vm * Math.cos(w * t + phase);
    const dv = -w * Vm * Math.sin(w * t + phase);
    const integ = Vm * Math.sin(w * t + phase) / w;
    const i = v / R + (L > 0 ? integ / L : 0) + (C > 0 ? C * dv : 0);
    const reported = current.re * cos - current.im * sin;
    worst = Math.max(worst, Math.abs(i - reported));
  }
  return worst;
}

export function assertPhasorPhysics(input: PhasorAuditInput, report: PhasorAuditReport) {
  const w = 2 * Math.PI * input.frequency;
  const { R, L, C } = input;
  const i2 = (report.current.re ** 2 + report.current.im ** 2) / 2;
  const v2 = input.Vm ** 2 / 2;
  const x = w * L - (C > 0 ? 1 / (w * C) : 0);
  const expectedP = input.config === 'series' ? i2 * R : v2 / R;
  const expectedQ = input.config === 'series'
    ? i2 * x
    : (L > 0 ? v2 / (w * L) : 0) - (C > 0 ? v2 * w * C : 0);
  const expectedS = Math.hypot(expectedP, expectedQ);
  const expectedPf = expectedS > 0 ? expectedP / expectedS : NaN;
  const residual = input.config === 'series' ? seriesResidual(input, report.current) : parallelResidual(input, report.current);
  const scale = Math.max(1, Math.abs(input.Vm), Math.abs(report.powerReal), Math.abs(report.powerReactive));
  const powerGap = Math.max(
    Math.abs(report.powerReal - expectedP),
    Math.abs(report.powerReactive - expectedQ),
    Math.abs(report.powerApparent - expectedS),
    Math.abs(report.powerFactor - expectedPf),
  );
  if (residual > 1e-6 * scale || powerGap > 1e-6 * Math.max(1e-9, scale, expectedS)) {
    throw new Error('Unverified: the phasor answer disagrees with the time-domain KVL/KCL sample or the RMS power split. Answer withheld.');
  }
}
