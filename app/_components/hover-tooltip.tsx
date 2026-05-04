'use client';
import { useStore } from '@/lib/store';

function fmtRel(iso: string): string {
  const d = Date.parse(iso) - Date.now();
  if (d <= 0) return 'expired';
  const days = Math.floor(d / 86_400_000);
  const hours = Math.floor((d % 86_400_000) / 3_600_000);
  if (days === 0) return `${hours}h`;
  return `${days}d ${hours}h`;
}

export function HoverTooltip() {
  const hoverScreen = useStore((s) => s.hoverScreen);
  const hoverCell = useStore((s) => s.hoverCell);
  const tiles = useStore((s) => s.tiles);
  const players = useStore((s) => s.players);
  if (!hoverScreen || !hoverCell) return null;

  const id = `s:${hoverCell.x},${hoverCell.y}`;
  const t = tiles.get(id);
  const p = t ? players.get(t.owner_id) : null;
  const mult = t?.kind === 'mult10' ? 10 : t?.kind === 'mult5' ? 5 : 1;

  const style: React.CSSProperties = {
    left: hoverScreen.x + 14,
    top: hoverScreen.y + 14,
  };

  return (
    <div
      className="brackets pointer-events-none absolute z-10 min-w-[180px] border border-[var(--line-strong)] bg-[var(--bg-panel)]/95 px-3 py-2 backdrop-blur"
      style={style}
    >
      <span className="br-bl" />
      <span className="br-br" />
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tabular-nums tnum text-[var(--fg)]">
          {hoverCell.x},{hoverCell.y}
        </span>
        {mult > 1 && (
          <span className="bg-[var(--accent-amber)]/20 px-1 py-px text-[8px] font-bold tracking-[0.2em] text-[var(--accent-amber)]">
            ✦ {mult}× JACKPOT
          </span>
        )}
      </div>
      <div className="mt-2 space-y-0.5 text-[10px]">
        {t ? (
          <>
            <div className="flex items-center gap-2">
              <span className="label w-14">OWNER</span>
              <span className="chip" style={{ background: p?.color ?? '#666' }} />
              <span className="text-[var(--fg)]">{p?.name ?? '·····'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="label w-14">EXPIRES</span>
              <span className="font-mono tabular-nums tnum text-[var(--fg-muted)]">
                {fmtRel(t.expires_at)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="label w-14">STATUS</span>
            <span className="text-[var(--accent-signal)]">UNCLAIMED</span>
            <span className="ml-auto text-[var(--fg-dim)]">click to capture</span>
          </div>
        )}
      </div>
    </div>
  );
}
