import { describe, expect, it } from 'vitest';
import { TIERS } from '@/lib/tier-config';
import { COMPARISON_ROWS } from '@/pages/PricingPage';

describe('Preserved future tier prices', () => {
  it.each([
    ['basic', 7.99],
    ['student', 11.99],
    ['pro', 15.99],
    ['team', 89.99],
  ] as const)('keeps %s at $%s per month', (tier, amount) => {
    expect(TIERS[tier].priceAmount).toBe(amount);
    expect(TIERS[tier].price).toBe(`$${amount.toFixed(2)}`);
    expect(TIERS[tier].interval).toBe('mo');
  });

  it('advertises no disabled or nonexistent capabilities in tier features or comparison labels', () => {
    const claims = [
      ...Object.values(TIERS).flatMap(tier => [...tier.features]),
      ...COMPARISON_ROWS.map(row => String(row[0])),
    ].join('\n').toLowerCase();
    for (const banned of [
      'Quick Solver', 'mesh', 'AC phasor', 'phasor', 'Laplace', 'Fourier', 'Bode',
      'Check My Homework', 'Practice Exam', 'Team Seats', 'Priority support',
      'Shared saved', 'Bulk PDF', 'per day', 'Unlimited solves', 'photo upload',
    ]) {
      expect(claims).not.toContain(banned.toLowerCase());
    }
  });
});