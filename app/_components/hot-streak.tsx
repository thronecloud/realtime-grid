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
    <section>
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent-signal)] text-[10px]">▸</span>
          <span className="label">HOT · 1H</span>
        </div>
        <span className={`text-[9px] uppercase tracking-[0.2em] text-[var(--fg-dim)] ${loading ? 'blink' : ''}`}>
          {loading ? 'SCAN' : 'LIVE'}
        </span>
      </div>
      <ol className="text-[11px]">
        {rows.map((r, i) => {
          const p = players.get(r.player_id);
          return (
            <li key={r.player_id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="w-5 text-right text-[10px] tabular-nums tnum text-[var(--fg-dim)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="chip" style={{ background: p?.color ?? '#666' }} />
              <span className="truncate text-[var(--fg)]">
                {p?.name ?? r.player_id.slice(0, 6)}
              </span>
              <span className="ml-auto font-mono text-[11px] tabular-nums tnum text-[var(--accent-signal)]">
                +{r.n}
              </span>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-3 py-6 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            quiet hour
          </li>
        )}
      </ol>
    </section>
  );
}
