export type TileKind = 'small' | 'big';
export interface TileCoord { kind: TileKind; x: number; y: number }

export function smallTileId(x: number, y: number): string {
  return `s:${x},${y}`;
}

export function bigTileId(x: number, y: number): string {
  return `b:${x},${y}`;
}

export function formatTileId(t: TileCoord): string {
  return t.kind === 'small' ? smallTileId(t.x, t.y) : bigTileId(t.x, t.y);
}

export function parseTileId(id: string): TileCoord | null {
  const m = /^([sb]):(\d{1,2}),(\d{1,2})$/.exec(id);
  if (!m) return null;
  const x = Number(m[2]);
  const y = Number(m[3]);
  if (x < 0 || x > 99 || y < 0 || y > 99) return null;
  return { kind: m[1] === 's' ? 'small' : 'big', x, y };
}
