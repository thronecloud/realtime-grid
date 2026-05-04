import { describe, it, expect } from 'vitest';
import { buildBigTileIndex, isInsideBigTile, bigTileAt } from '@/lib/grid/big-tiles';

const anchors = [
  { x: 10, y: 10 },
  { x: 50, y: 80 },
];

describe('big-tiles', () => {
  it('isInsideBigTile detects 5x5 footprint', () => {
    const idx = buildBigTileIndex(anchors);
    expect(isInsideBigTile(idx, 10, 10)).toBe(true);
    expect(isInsideBigTile(idx, 14, 14)).toBe(true);
    expect(isInsideBigTile(idx, 12, 11)).toBe(true);
    expect(isInsideBigTile(idx, 9, 10)).toBe(false);
    expect(isInsideBigTile(idx, 15, 14)).toBe(false);
    expect(isInsideBigTile(idx, 0, 0)).toBe(false);
  });

  it('bigTileAt returns the anchor or null', () => {
    const idx = buildBigTileIndex(anchors);
    expect(bigTileAt(idx, 12, 11)).toEqual({ x: 10, y: 10 });
    expect(bigTileAt(idx, 9, 9)).toBeNull();
  });
});
