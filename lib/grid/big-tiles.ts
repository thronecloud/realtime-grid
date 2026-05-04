export interface BigAnchor { x: number; y: number }

export interface BigTileIndex {
  anchors: BigAnchor[];
  cellToAnchor: Map<string, BigAnchor>;
}

const KEY = (x: number, y: number) => `${x},${y}`;

export function buildBigTileIndex(anchors: BigAnchor[]): BigTileIndex {
  const cellToAnchor = new Map<string, BigAnchor>();
  for (const a of anchors) {
    for (let dx = 0; dx < 5; dx++) {
      for (let dy = 0; dy < 5; dy++) {
        cellToAnchor.set(KEY(a.x + dx, a.y + dy), a);
      }
    }
  }
  return { anchors, cellToAnchor };
}

export function isInsideBigTile(idx: BigTileIndex, x: number, y: number): boolean {
  return idx.cellToAnchor.has(KEY(x, y));
}

export function bigTileAt(idx: BigTileIndex, x: number, y: number): BigAnchor | null {
  return idx.cellToAnchor.get(KEY(x, y)) ?? null;
}
