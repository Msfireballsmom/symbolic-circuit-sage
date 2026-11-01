import { describe, expect, it } from 'vitest';
import { TIERS } from '@/lib/tier-config';

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
});