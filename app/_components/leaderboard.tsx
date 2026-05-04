'use client';
import { useMemo } from 'react';
import { useStore } from '@/lib/store';

const SCORE: Record<string, number> = { normal: 1, mult5: 5, mult10: 10 };

export function Leaderboard() {
  const tiles = useStore((s) => s.tiles);
  const players = useStore((s) => s.players);
  const me = useStore((s) => s.me);

  const rows = useMemo(() => {
    const score = new Map<string, number>();
    const jackpots = new Map<string, number>();
    for (const t of tiles.values()) {
      score.set(t.owner_id, (score.get(t.owner_id) ?? 0) + (SCORE[t.kind] ?? 1));
      if (t.kind === 'mult5' || t.kind === 'mult10') {
        jackpots.set(t.owner_id, (jackpots.get(t.owner_id) ?? 0) + 1);
      }
    }
    return [...score.entries()]
      .map(([id, n]) => ({ id, n, p: players.get(id), jackpots: jackpots.get(id) ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [tiles, players]);

  const max = rows[0]?.n ?? 1;

  return (
    <section className="border-b-[1.5px] border-[var(--ink)] bg-[var(--bg-paper)]">
      <div className="flex items-center justify-between border-b-[1.5px] border-[var(--ink)] px-3 py-2">
        <span className="hand text-[15px] font-bold tracking-[0.1em]">▸ LEADERBOARD</span>
        <span className="caption">TOP 10</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-4">
          <div
            className="border border-dashed border-[var(--ink)] p-3"
            style={{ transform: 'rotate(-0.3deg)' }}
          >
            <div className="caption">// no captures</div>
            <div className="hand mt-1 text-[14px]">
              standings will fill in as the grid fills.
            </div>
          </div>
        </div>
      ) : (
        <ol>
          {rows.map((r, i) => {
            const pct = (r.n / max) * 100;
            const isMe = me && r.id === me.id;
            return (
              <li key={r.id} className="relative px-3 py-1">
                <div
                  className="absolute inset-y-0 left-0 -z-10"
                  style={{
                    width: `${pct}%`,
                    background:
                      i === 0
                        ? 'rgba(217, 168, 38, 0.30)'
                        : isMe
                          ? 'rgba(232, 85, 58, 0.18)'
                          : 'rgba(26, 26, 26, 0.07)',
                  }}
                />
                <div className="relative flex items-center gap-2">
                  <span className="w-[18px] font-mono text-[10px] tabular-nums tnum text-[var(--fg-muted)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="chip" style={{ background: r.p?.color ?? '#888' }} />
                  <span
                    className={`hand text-[14px] ${i === 0 || isMe ? 'font-bold' : ''}`}
                  >
                    {(r.p?.name ?? r.id.slice(0, 6)).toLowerCase()}
                  </span>
                  {r.jackpots > 0 && (
                    <span className="font-mono text-[11px] font-bold text-[var(--accent-amber)]">
                      ★{r.jackpots}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[12px] font-semibold tabular-nums tnum">
                    {r.n}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
