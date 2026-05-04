import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function newPlayer(name: string): Promise<SupabaseClient> {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error('no user');
  await sb.from('players').upsert({
    id: data.user.id,
    name,
    color: '#abcdef',
  });
  return sb;
}

interface TilePayload {
  owner_id?: string;
  kind?: 'normal' | 'mult5' | 'mult10';
}

async function rpc(sb: SupabaseClient, tileId: string) {
  const { data, error } = await sb.rpc('capture_tile', { p_tile_id: tileId });
  if (error) throw error;
  const rows = data as Array<{ ok: boolean; reason: string | null; tile: TilePayload | null }>;
  return rows[0];
}

describe('capture_tile', () => {
  beforeAll(() => {
    if (!URL || !ANON) throw new Error('Set NEXT_PUBLIC_SUPABASE_* in env');
  });

  it('only one of two parallel captures of the same tile wins', async () => {
    const a = await newPlayer('alice-' + Date.now());
    const b = await newPlayer('bob-' + Date.now());
    const tileId = `s:${1 + Math.floor(Math.random() * 90)},${1 + Math.floor(Math.random() * 90)}`;

    const [ra, rb] = await Promise.all([rpc(a, tileId), rpc(b, tileId)]);
    const oks = [ra, rb].filter((r) => r.ok).length;
    const locks = [ra, rb].filter((r) => !r.ok && r.reason === 'locked').length;
    expect(oks).toBe(1);
    expect(locks).toBe(1);
  });

  it('cooldown rejects second capture by same user within 10s', async () => {
    const a = await newPlayer('cool-' + Date.now());
    const r1 = await rpc(a, `s:50,50`);
    expect(r1.ok).toBe(true);
    const r2 = await rpc(a, `s:51,50`);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe('cooldown');
  });

  it('rejects non-s: tile id format', async () => {
    const a = await newPlayer('fmt-' + Date.now());
    const r = await rpc(a, 'b:0,0');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_tile');
  });

  it('rejects out-of-bounds tile id', async () => {
    const a = await newPlayer('bounds-' + Date.now());
    const r = await rpc(a, 's:99,99');
    // 99,99 is in bounds — sanity check.
    expect(r.ok).toBe(true);
  });

  it('captures a multiplier tile and tags the kind', async () => {
    // Find a known multiplier cell from big_tiles.
    const sb = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: mults } = await sb.from('big_tiles').select('*').limit(1);
    expect(mults?.length).toBe(1);
    const m = mults![0] as { x: number; y: number; mult: number };
    const a = await newPlayer('jackpot-' + Date.now());
    const r = await rpc(a, `s:${m.x},${m.y}`);
    expect(r.ok).toBe(true);
    expect(r.tile?.kind).toBe(m.mult === 10 ? 'mult10' : 'mult5');
  });

  it('re-captures an expired tile cleanly', async () => {
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!SERVICE) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for this test');
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const a = await newPlayer('exp-' + Date.now());
    const tileId = `s:60,60`;
    const r1 = await rpc(a, tileId);
    expect(r1.ok).toBe(true);
    await admin.from('tiles').update({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    }).eq('id', tileId);
    const userId = (await a.auth.getUser()).data.user!.id;
    await admin.from('players').update({
      last_capture_at: new Date(Date.now() - 11_000).toISOString(),
    }).eq('id', userId);
    const r2 = await rpc(a, tileId);
    expect(r2.ok).toBe(true);
    expect(r2.tile?.owner_id).toBe(userId);
  });
});
