/** Strict case-sensitive SI parsing. A bare number uses the field's named unit. */
export function parseQuantity(text: string, unit: string): number {
  const match = text.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([GMkmunpμµ]?)([A-Za-zΩω]*)$/);
  if (!match) throw new Error(`Invalid ${unit || 'dimensionless'} quantity: ${text || 'missing value'}`);
  const [, number, prefix, suffix] = match;
  const aliases: Record<string, string[]> = { Ω: ['Ω', 'ω', 'ohm', 'ohms'], V: ['V'], A: ['A'], F: ['F'], H: ['H'], s: ['s'], Hz: ['Hz'], W: ['W'] };
  if (suffix && !(aliases[unit] ?? [unit]).includes(suffix)) throw new Error(`Expected ${unit || 'dimensionless'}, received ${suffix}.`);
  const multipliers: Record<string, number> = { '': 1, G: 1e9, M: 1e6, k: 1e3, m: 1e-3, u: 1e-6, μ: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12 };
  const value = Number(number) * multipliers[prefix];
  if (!Number.isFinite(value)) throw new Error('Quantity must be finite.');
  return value;
}