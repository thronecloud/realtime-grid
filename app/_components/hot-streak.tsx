'use client';
import { useEffect, useState } from 'react';
import { fetchHotStreak } from '@/lib/api/captures';
import { useStore } from '@/lib/store';
import { ensurePlayers } from '@/lib/api/players';

export function HotStreak() {
  const players = useStore((s) => s.players);
  const [rows, setRows] = useState<{ player_id: string; n: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const r = await fetchHotStreak(since);
      await ensurePlayers(r.map((x) => x.player_id));
      if (alive) {
        setRows(r);
        setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="bg-[var(--bg-paper)]">
      <div className="flex items-center justify-between border-b-[1.5px] border-[var(--ink)] px-3 py-2">
        <span className="hand text-[15px] font-bold tracking-[0.1em]">▸ HOT · 1H</span>
        <span
          className={`caption ${loading ? 'blink' : ''}`}
          style={{ color: 'var(--accent-signal)' }}
        >
          ● {loading ? 'SCAN' : 'LIVE'}
        </span>
      </div>
      <ol className="px-3 py-2">
        {rows.map((r, i) => {
          const p = players.get(r.player_id);
          return (
            <li key={r.player_id} className="flex items-center gap-2 py-0.5">
              <span className="w-[18px] font-mono text-[10px] tabular-nums tnum text-[var(--fg-muted)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="chip" style={{ background: p?.color ?? '#888' }} />
              <span className="hand text-[14px]">
                {(p?.name ?? r.player_id.slice(0, 6)).toLowerCase()}
              </span>
              <span className="ml-auto font-mono text-[12px] font-bold tabular-nums tnum text-[var(--accent-signal)]">
                +{r.n}
              </span>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="py-3">
            <div
              className="border border-dashed border-[var(--ink)] p-2"
              style={{ transform: 'rotate(-0.2deg)' }}
            >
              <div className="hand text-center text-[14px]">quiet hour</div>
            </div>
          </li>
        )}
      </ol>
    </section>
  );
}
