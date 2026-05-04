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
    <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent-amber)] text-[10px]">▸</span>
          <span className="label">LIVE FEED</span>
        </div>
        <span className="label tnum">{String(feed.length).padStart(2, '0')}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-[var(--line)]/50">
          {feed.map((i) => {
            const p = players.get(i.playerId);
            const mult = i.kind === 'mult10' ? 10 : i.kind === 'mult5' ? 5 : 1;
            const isFresh = mult > 1 && Date.now() - i.ts < 4000;
            return (
              <li
                key={i.key}
                className={`feed-in group flex items-center gap-2 px-3 py-1.5 text-[11px] ${
                  isFresh ? 'feed-jackpot' : ''
                }`}
              >
                <span
                  className="chip"
                  style={{ background: p?.color ?? '#666' }}
                />
                <span className="max-w-[80px] truncate font-medium text-[var(--fg)]">
                  {p?.name ?? '·····'}
                </span>
                <span className="text-[var(--fg-dim)]">→</span>
                <span className="font-mono text-[10px] text-[var(--fg-muted)] tnum">
                  {i.tileId.slice(2)}
                </span>
                {mult > 1 ? (
                  <span
                    className={`ml-auto px-1 py-px text-[9px] font-bold tracking-[0.15em] ${
                      mult === 10
                        ? 'bg-[var(--accent-amber)]/25 text-[var(--accent-amber)]'
                        : 'bg-[var(--accent-amber)]/12 text-[var(--accent-amber)]/90'
                    }`}
                  >
                    ✦ {mult}×
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] text-[var(--fg-dim)] tnum">
                    {fmtAgo(i.ts)}
                  </span>
                )}
              </li>
            );
          })}
          {feed.length === 0 && (
            <li className="px-3 py-6 text-center text-[10px] tracking-[0.18em] text-[var(--fg-dim)]">
              <span className="block uppercase">// no signal yet</span>
              <span className="mt-1 block normal-case text-[var(--fg-muted)]">be the first to claim a tile.</span>
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}
