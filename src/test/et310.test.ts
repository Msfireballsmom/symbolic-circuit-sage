import { describe, it, expect } from 'vitest';
import { ET310_CASES, runET310Coverage } from '@/lib/et310-coverage';

describe('Original ET310 independent numerical corpus', () => {
  for (const test of ET310_CASES) it(test.id, test.run);
  it('never certifies untested course requirements', () => {
    const coverage = runET310Coverage();
    for (const id of ['time', 'energy', 'resistivity', 'repeated', 'week8', 'other']) {
      expect(coverage.find(topic => topic.id === id)?.status).toBe('coming soon');
    }
    expect(coverage.filter(topic => topic.status === 'failing')).toEqual([]);
  });
});