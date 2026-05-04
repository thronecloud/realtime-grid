import { describe, it, expect } from 'vitest';
import { formatTileId, parseTileId, smallTileId, bigTileId } from '@/lib/grid/tile-id';

describe('tile-id', () => {
  it('formats small + big ids', () => {
    expect(smallTileId(34, 71)).toBe('s:34,71');
    expect(bigTileId(10, 10)).toBe('b:10,10');
    expect(formatTileId({ kind: 'small', x: 0, y: 0 })).toBe('s:0,0');
  });

  it('parses valid ids', () => {
    expect(parseTileId('s:34,71')).toEqual({ kind: 'small', x: 34, y: 71 });
    expect(parseTileId('b:10,10')).toEqual({ kind: 'big', x: 10, y: 10 });
  });

  it('rejects bad ids', () => {
    expect(parseTileId('')).toBeNull();
    expect(parseTileId('x:1,1')).toBeNull();
    expect(parseTileId('s:1')).toBeNull();
    expect(parseTileId('s:-1,0')).toBeNull();
    expect(parseTileId('s:100,0')).toBeNull();
    expect(parseTileId('s:1.5,2')).toBeNull();
  });
});
