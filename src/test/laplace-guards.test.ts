import { it, expect } from 'vitest';
import { solveLaplace } from '@/lib/laplace-solver';
it.each(['impulse', 'step'] as const)('refuses repeated-pole %s rather than returning NaN residues', inputType => {
  expect(() => solveLaplace({ numerator: [1], denominator: [1, 4, 4], inputType })).toThrow(/repeated-pole/i);
});
it('refuses a degree-four inverse transform without a root implementation', () => {
  expect(() => solveLaplace({ numerator: [1], denominator: [1, 10, 35, 50, 24], inputType: 'impulse' })).toThrow(/unsupported or unverified/i);
});
it('refuses a nonproper transfer function with unmodeled impulses', () => {
  expect(() => solveLaplace({ numerator: [1, 2], denominator: [1, 3], inputType: 'step' })).toThrow(/strictly proper/i);
});