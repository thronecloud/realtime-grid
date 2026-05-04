'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { fetchRecentCaptures } from '@/lib/api/captures';
import { ensurePlayers } from '@/lib/api/players';

export function RecentFeed() {
  const feed = useStore((s) => s.feed);
  const players = useStore((s) => s.players);
  const pushFeed = useStore((s) => s.pushFeed);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchRecentCaptures(50);
      await ensurePlayers([...new Set(rows.map((r) => r.player_id))]);
      if (cancelled) return;
      for (const r of rows.reverse()) {
        pushFeed({
          key: `${new Date(r.captured_at).getTime()}-${r.tile_id}`,
          playerId: r.player_id,
          tileId: r.tile_id,
          kind: r.kind,
          ts: new Date(r.captured_at).getTime(),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pushFeed]);

  return (
    <aside className="flex h-full w-full flex-col border-r border-neutral-900 bg-neutral-950">
      <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Recent captures
      </h2>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-1 text-sm">
          {feed.map((i) => {
            const p = players.get(i.playerId);
            return (
              <li
                key={i.key}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-neutral-900"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: p?.color ?? '#888' }}
                />
                <span className="truncate font-medium">{p?.name ?? '…'}</span>
                <span className="text-neutral-400">claimed</span>
                <span className="font-mono text-xs text-neutral-300">{i.tileId}</span>
                {i.kind === 'big' && (
                  <span className="ml-auto rounded bg-amber-500/20 px-1.5 text-[10px] text-amber-300">
                    big
                  </span>
                )}
              </li>
            );
          })}
          {feed.length === 0 && <li className="text-neutral-500">No captures yet</li>}
        </ul>
      </div>
    </aside>
  );
}
