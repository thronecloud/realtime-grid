export interface PlayerRow {
  id: string;
  name: string;
  color: string;
  last_capture_at: string | null;
  created_at: string;
}

export interface BigTileRow { x: number; y: number }

export interface TileRow {
  id: string;
  kind: 'small' | 'big';
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
  kind: 'small' | 'big';
  captured_at: string;
}

export interface CaptureResult {
  ok: boolean;
  reason: string | null;
  tile: TileRow | null;
}
