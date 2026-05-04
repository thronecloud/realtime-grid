// All tiles are uniform 1x1 cells. Tile ids are always "s:x,y".
// (Multipliers are a hidden mechanic, not a separate tile id format.)

export interface TileCoord { x: number; y: number }

export function tileId(x: number, y: number): string {
  return `s:${x},${y}`;
}

export function parseTileId(id: string): TileCoord | null {
  const m = /^s:(\d{1,2}),(\d{1,2})$/.exec(id);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (x < 0 || x > 99 || y < 0 || y > 99) return null;
  return { x, y };
}
