'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { fetchRecentCaptures } from '@/lib/api/captures';
import { ensurePlayers } from '@/lib/api/players';

function fmtAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

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
    <aside className="flex h-full w-full flex-col bg-[var(--bg-paper)]">
      <div className="flex items-center justify-between border-b-[1.5px] border-[var(--ink)] px-3 py-2">
        <span className="hand text-[15px] font-bold tracking-[0.1em]">▸ LIVE FEED</span>
        <span className="caption tabular-nums tnum">
          {String(feed.length).padStart(2, '0')}
        </span>
      </div>
      {feed.length === 0 ? (
        <div className="p-4">
          <div
            className="border border-dashed border-[var(--ink)] p-4"
            style={{ transform: 'rotate(-0.3deg)' }}
          >
            <div className="caption">// no signal yet</div>
            <div className="hand mt-1 text-[14px]">be the first to claim a tile.</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ul>
            {feed.map((i) => {
              const p = players.get(i.playerId);
              const mult = i.kind === 'mult10' ? 10 : i.kind === 'mult5' ? 5 : 1;
              const isFresh = mult > 1 && Date.now() - i.ts < 4000;
              const xy = i.tileId.startsWith('s:') ? i.tileId.slice(2) : i.tileId;
              return (
                <li
                  key={i.key}
                  className={`feed-in flex items-center gap-2 px-3 py-1 ${isFresh ? 'feed-jackpot' : ''}`}
                >
                  <span className="chip" style={{ background: p?.color ?? '#888' }} />
                  <span className="hand text-[14px] font-semibold">
                    {(p?.name ?? '·····').toLowerCase()}
                  </span>
                  <span className="text-[var(--fg-muted)]">→</span>
                  <span
                    className="font-mono text-[11px] tabular-nums tnum text-[var(--fg-muted)]"
                  >
                    {xy}
                  </span>
                  {mult > 1 ? (
                    <span className="ml-auto hand text-[13px] font-bold text-[var(--accent-amber)]">
                      ★ {mult}×
                    </span>
                  ) : (
                    <span className="ml-auto caption tabular-nums tnum">{fmtAgo(i.ts)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
