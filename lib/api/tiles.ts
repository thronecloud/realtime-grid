import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { BigTileRow, CaptureResult, TileRow } from '@/lib/types/db';

// Paginated. PostgREST default limit is 1000 — without explicit ranging,
// the world silently truncates once >1000 tiles are captured.
export async function fetchAllTiles(): Promise<TileRow[]> {
  const sb = getSupabaseBrowser();
  const PAGE = 1000;
  const out: TileRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('tiles')
      .select('*')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as TileRow[]));
    if (data.length < PAGE) break;
  }
  return out;
}

export async function fetchBigTiles(): Promise<BigTileRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from('big_tiles').select('*');
  if (error) throw error;
  return (data as BigTileRow[]) ?? [];
}

export async function captureTile(tileId: string): Promise<CaptureResult> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc('capture_tile', { p_tile_id: tileId });
  if (error) throw error;
  return data as unknown as CaptureResult;
}
