export type TileKind = 'normal' | 'mult5' | 'mult10';

export interface PlayerRow {
  id: string;
  name: string;
  color: string;
  last_capture_at: string | null;
  created_at: string;
}

// Pre-seeded multiplier positions. Server keeps the table named `big_tiles`
// for migration simplicity, but each row is now a single jackpot cell.
export interface BigTileRow { x: number; y: number; mult: number }

export interface TileRow {
  id: string;
  kind: TileKind;
  x: number;
  y: number;
  owner_id: string;
  captured_at: string;
  expires_at: string;
}

export interface CaptureRow {
  id: number;
  player_id: string;
  tile_id: string;
  kind: TileKind;
  captured_at: string;
}

export interface CaptureResult {
  ok: boolean;
  reason: string | null;
  tile: TileRow | null;
}
