import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { CaptureRow } from '@/lib/types/db';

export async function fetchRecentCaptures(limit = 30): Promise<CaptureRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('captures')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as CaptureRow[]) ?? [];
}

export async function fetchHotStreak(sinceIso: string): Promise<{ player_id: string; n: number }[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('captures')
    .select('player_id')
    .gte('captured_at', sinceIso);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of (data as { player_id: string }[]) ?? []) {
    counts.set(r.player_id, (counts.get(r.player_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([player_id, n]) => ({ player_id, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
}
