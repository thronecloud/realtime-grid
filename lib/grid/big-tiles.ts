// Multiplier-tile index: maps a single (x,y) cell to its multiplier (5 or 10).
// Cells absent from the index are normal 1x-payoff tiles. The index is purely
// for client-side awareness — multipliers are HIDDEN visually; they are
// revealed on capture by the server-returned tile.kind ('mult5'/'mult10').

export interface MultiplierAnchor { x: number; y: number; mult: number }

export interface MultiplierIndex {
  anchors: MultiplierAnchor[];
  byCell: Map<string, number>;
}

const KEY = (x: number, y: number) => `${x},${y}`;

export function buildMultiplierIndex(anchors: MultiplierAnchor[]): MultiplierIndex {
  const byCell = new Map<string, number>();
  for (const a of anchors) byCell.set(KEY(a.x, a.y), a.mult);
  return { anchors, byCell };
}

export function multiplierAt(idx: MultiplierIndex, x: number, y: number): number {
  return idx.byCell.get(KEY(x, y)) ?? 1;
}
