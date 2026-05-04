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
      .map(([id, n]) => ({
        id,
        n,
        p: players.get(id),
        jackpots: jackpots.get(id) ?? 0,
      }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [tiles, players]);

  const max = rows[0]?.n ?? 1;

  return (
    <section className="border-b border-[var(--line)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent-amber)] text-[10px]">▸</span>
          <span className="label">LEADERBOARD</span>
        </div>
        <span className="label">TOP 10</span>
      </div>
      <ol className="text-[11px]">
        {rows.map((r, i) => {
          const pct = (r.n / max) * 100;
          const isMe = me && r.id === me.id;
          return (
            <li
              key={r.id}
              className={`group relative flex items-center gap-2 px-3 py-1.5 ${
                isMe ? 'bg-[var(--accent-amber)]/[0.06]' : ''
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 -z-10 transition-[width]"
                style={{
                  width: `${pct}%`,
                  background:
                    i === 0
                      ? 'linear-gradient(to right, rgba(245,194,69,0.18), rgba(245,194,69,0.02))'
                      : `linear-gradient(to right, ${r.p?.color ?? '#3a3f4d'}1a, transparent)`,
                }}
              />
              <span className="w-5 text-right text-[10px] tabular-nums tnum text-[var(--fg-dim)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="chip" style={{ background: r.p?.color ?? '#666' }} />
              <span className="truncate text-[var(--fg)]">
                {r.p?.name ?? r.id.slice(0, 6)}
              </span>
              {r.jackpots > 0 && (
                <span className="text-[9px] font-bold text-[var(--accent-amber)]">
                  ✦{r.jackpots}
                </span>
              )}
              <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums tnum text-[var(--fg)]">
                {r.n}
              </span>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-3 py-6 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            // no captures
          </li>
        )}
      </ol>
    </section>
  );
}
