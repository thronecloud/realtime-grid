import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import type { PlayerRow } from '@/lib/types/db';

export async function fetchMyPlayer(userId: string): Promise<PlayerRow | null> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('players')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlayerRow | null) ?? null;
}

export async function upsertMyPlayer(input: {
  id: string; name: string; color: string;
}): Promise<PlayerRow> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('players')
    .upsert({ id: input.id, name: input.name, color: input.color }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as PlayerRow;
}

export async function fetchPlayersByIds(ids: string[]): Promise<PlayerRow[]> {
  if (ids.length === 0) return [];
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('players')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return (data as PlayerRow[]) ?? [];
}

export async function ensurePlayers(ids: string[]): Promise<void> {
  const have = useStore.getState().players;
  const missing = [...new Set(ids)].filter((id) => id && !have.has(id));
  if (!missing.length) return;
  const rows = await fetchPlayersByIds(missing);
  useStore.getState().setPlayers(rows);
}
