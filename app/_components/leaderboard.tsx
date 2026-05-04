'use client';
import { useMemo } from 'react';
import { useStore } from '@/lib/store';

export function Leaderboard() {
  const tiles = useStore((s) => s.tiles);
  const players = useStore((s) => s.players);

  const rows = useMemo(() => {
    const score = new Map<string, number>();
    for (const t of tiles.values()) {
      score.set(t.owner_id, (score.get(t.owner_id) ?? 0) + (t.kind === 'big' ? 5 : 1));
    }
    return [...score.entries()]
      .map(([id, n]) => ({ id, n, p: players.get(id) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [tiles, players]);

  return (
    <section className="border-b border-neutral-900 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Leaderboard
      </h2>
      <ol className="space-y-1 text-sm">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="w-5 text-right text-neutral-500">{i + 1}.</span>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: r.p?.color ?? '#888' }}
            />
            <span className="truncate">{r.p?.name ?? r.id.slice(0, 6)}</span>
            <span className="ml-auto font-mono text-xs">{r.n}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-neutral-500">No captures yet</li>}
      </ol>
    </section>
  );
}
