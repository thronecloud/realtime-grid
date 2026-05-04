import { describe, it, expect } from 'vitest';
import { randomPlayerColor, isValidHexColor, scoreColor } from '@/lib/colors';

describe('colors', () => {
  it('isValidHexColor', () => {
    expect(isValidHexColor('#abcdef')).toBe(true);
    expect(isValidHexColor('#ABC')).toBe(false);
    expect(isValidHexColor('abcdef')).toBe(false);
  });

  it('randomPlayerColor returns hex', () => {
    for (let i = 0; i < 50; i++) {
      const c = randomPlayerColor();
      expect(isValidHexColor(c)).toBe(true);
    }
  });

  it('scoreColor maps 0..1 -> green..gold', () => {
    expect(isValidHexColor(scoreColor(0))).toBe(true);
    expect(isValidHexColor(scoreColor(1))).toBe(true);
  });
});
