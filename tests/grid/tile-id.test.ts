import { describe, it, expect } from 'vitest';
import { tileId, parseTileId } from '@/lib/grid/tile-id';

describe('tile-id', () => {
  it('formats and parses round-trip', () => {
    expect(tileId(34, 71)).toBe('s:34,71');
    expect(parseTileId('s:34,71')).toEqual({ x: 34, y: 71 });
    expect(parseTileId('s:0,0')).toEqual({ x: 0, y: 0 });
  });

  it('rejects bad ids', () => {
    expect(parseTileId('')).toBeNull();
    expect(parseTileId('x:1,1')).toBeNull();
    expect(parseTileId('b:10,10')).toBeNull();
    expect(parseTileId('s:1')).toBeNull();
    expect(parseTileId('s:-1,0')).toBeNull();
    expect(parseTileId('s:100,0')).toBeNull();
    expect(parseTileId('s:1.5,2')).toBeNull();
  });
});
