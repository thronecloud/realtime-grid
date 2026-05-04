'use client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { fetchAllTiles, fetchBigTiles } from '@/lib/api/tiles';
import { ensurePlayers } from '@/lib/api/players';
import type { TileKind, TileRow } from '@/lib/types/db';

export interface RealtimeHandle { stop(): void }

// Module-level ref to the subscribed `world` channel. broadcastCapture()
// reuses this — sb.channel('world') a second time creates a new unsubscribed
// channel that silently drops .send().
let worldChannel: RealtimeChannel | null = null;

export async function startRealtime(opts: {
  me: { id: string; name: string; color: string };
  // Fired when ANOTHER player captures a multiplier tile. The captor's own
  // jackpot banner is already fired locally by grid-canvas on RPC return,
  // so we filter `playerId !== me.id` before calling this.
  onPeerJackpot?: (args: { mult: number; name: string; color: string }) => void;
}): Promise<RealtimeHandle> {
  const sb = getSupabaseBrowser();
  const store = useStore.getState();

  const [bigs, tiles] = await Promise.all([fetchBigTiles(), fetchAllTiles()]);
  store.setMultipliers(bigs);
  store.setInitialTiles(tiles);
  await ensurePlayers([...new Set(tiles.map((t) => t.owner_id))]);

  const chA: RealtimeChannel = sb
    .channel('tiles-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tiles' },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as Partial<TileRow>).id;
          if (oldId) {
            useStore.getState().markFading(oldId, 600);
            setTimeout(() => {
              useStore.getState().removeTile(oldId);
              useStore.getState().clearFading(oldId);
            }, 600);
          }
        } else {
          const row = payload.new as TileRow;
          useStore.getState().upsertTile(row);
          useStore.getState().pushFlash(row.id, 220);
          await ensurePlayers([row.owner_id]);
        }
      },
    )
    .subscribe();

  const chB: RealtimeChannel = sb
    .channel('world', {
      config: {
        presence: { key: opts.me.id },
        // Self-receive: the captor sees their own broadcast in the feed too,
        // so the recent-captures rail stays consistent across all clients
        // including the one that just captured.
        broadcast: { self: true },
      },
    })
    .on('presence', { event: 'sync' }, () => {
      const state = chB.presenceState() as Record<
        string,
        Array<{ id: string; name: string; color: string }>
      >;
      const peers = Object.values(state)
        .flat()
        .map((p) => ({ id: p.id, name: p.name, color: p.color }));
      useStore.getState().setOnline(peers);
    })
    .on('broadcast', { event: 'capture' }, async (msg) => {
      const p = msg.payload as { playerId: string; tileId: string; kind: TileKind };
      const ts = Date.now();
      useStore.getState().pushFeed({
        key: `${ts}-${p.tileId}`,
        playerId: p.playerId,
        tileId: p.tileId,
        kind: p.kind,
        ts,
      });
      // Make sure we have the captor's player record so the toast can show
      // their name + color.
      await ensurePlayers([p.playerId]);
      // Peer jackpot: other player hit a multiplier. Captor's own celebration
      // is already fired locally on RPC return.
      if (
        opts.onPeerJackpot &&
        p.playerId !== opts.me.id &&
        (p.kind === 'mult5' || p.kind === 'mult10')
      ) {
        const peer = useStore.getState().players.get(p.playerId);
        opts.onPeerJackpot({
          mult: p.kind === 'mult10' ? 10 : 5,
          name: peer?.name ?? '·····',
          color: peer?.color ?? '#888',
        });
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await chB.track({ id: opts.me.id, name: opts.me.name, color: opts.me.color });
      }
    });
  worldChannel = chB;

  const onOnline = async () => {
    const [bigs2, tiles2] = await Promise.all([fetchBigTiles(), fetchAllTiles()]);
    useStore.getState().setMultipliers(bigs2);
    useStore.getState().setInitialTiles(tiles2);
    await ensurePlayers([...new Set(tiles2.map((t) => t.owner_id))]);
  };
  window.addEventListener('online', onOnline);

  return {
    stop: () => {
      window.removeEventListener('online', onOnline);
      sb.removeChannel(chA);
      sb.removeChannel(chB);
      if (worldChannel === chB) worldChannel = null;
    },
  };
}

export function broadcastCapture(payload: {
  playerId: string; tileId: string; kind: TileKind;
}) {
  if (!worldChannel) return;
  worldChannel.send({ type: 'broadcast', event: 'capture', payload });
}
