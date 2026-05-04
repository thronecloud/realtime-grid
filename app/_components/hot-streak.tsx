'use client';
import { useEffect, useState } from 'react';
import { fetchHotStreak } from '@/lib/api/captures';
import { useStore } from '@/lib/store';
import { ensurePlayers } from '@/lib/api/players';

export function HotStreak() {
  const players = useStore((s) => s.players);
  const [rows, setRows] = useState<{ player_id: string; n: number }[]>([]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const r = await fetchHotStreak(since);
      await ensurePlayers(r.map((x) => x.player_id));
      if (alive) setRows(r);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Hot streak (1h)
      </h2>
      <ol className="space-y-1 text-sm">
        {rows.map((r, i) => {
          const p = players.get(r.player_id);
          return (
            <li key={r.player_id} className="flex items-center gap-2">
              <span className="w-5 text-right text-neutral-500">{i + 1}.</span>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: p?.color ?? '#888' }}
              />
              <span className="truncate">{p?.name ?? r.player_id.slice(0, 6)}</span>
              <span className="ml-auto font-mono text-xs">{r.n}</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-neutral-500">Quiet hour</li>}
      </ol>
    </section>
  );
}
