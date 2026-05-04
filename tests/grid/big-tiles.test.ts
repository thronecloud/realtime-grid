import { describe, it, expect } from 'vitest';
import { buildMultiplierIndex, multiplierAt } from '@/lib/grid/big-tiles';

describe('multiplier index', () => {
  it('maps cells to their multiplier', () => {
    const idx = buildMultiplierIndex([
      { x: 10, y: 10, mult: 5 },
      { x: 50, y: 80, mult: 10 },
    ]);
    expect(multiplierAt(idx, 10, 10)).toBe(5);
    expect(multiplierAt(idx, 50, 80)).toBe(10);
    expect(multiplierAt(idx, 9, 10)).toBe(1);
    expect(multiplierAt(idx, 0, 0)).toBe(1);
  });
});
