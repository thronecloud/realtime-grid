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

// Paper card with HUD corner brackets and a slight -1deg rotation —
// matches the rotated handwritten-note feel from tactical.jsx.
// Two variants: free (`+1 pt · 7d lock`) and owned (owner + expires-in).
// Multipliers stay hidden for free cells so the jackpot reveal still
// surprises on capture; the ★ N× JACKPOT badge appears only on already-
// captured multiplier tiles.
export function HoverTooltip() {
  const hoverScreen = useStore((s) => s.hoverScreen);
  const hoverCell = useStore((s) => s.hoverCell);
  const tiles = useStore((s) => s.tiles);
  const players = useStore((s) => s.players);
  if (!hoverScreen || !hoverCell) return null;

  const id = `s:${hoverCell.x},${hoverCell.y}`;
  const t = tiles.get(id);
  const p = t ? players.get(t.owner_id) : null;
  const ownedMult = t?.kind === 'mult10' ? 10 : t?.kind === 'mult5' ? 5 : 1;

  const style: React.CSSProperties = {
    left: hoverScreen.x + 16,
    top: hoverScreen.y + 16,
    transform: 'rotate(-1deg)',
    boxShadow: '2px 2px 0 0 rgba(0,0,0,0.15)',
  };

  return (
    <div
      className="brackets pointer-events-none absolute z-10 min-w-[180px] border-2 border-[var(--ink)] bg-[var(--bg-paper)] px-3 py-2"
      style={style}
    >
      <span className="br-bl" />
      <span className="br-br" />
      <div className="font-mono text-[10px] tabular-nums tnum text-[var(--fg-muted)]">
        {hoverCell.x},{hoverCell.y}
      </div>
      {t ? (
        <>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="chip" style={{ background: p?.color ?? '#888' }} />
            <span className="hand text-[15px] font-bold">
              {(p?.name ?? '·····').toLowerCase()}
            </span>
            {ownedMult > 1 && (
              <span className="ml-auto hand text-[13px] font-bold text-[var(--accent-amber)]">
                ★ {ownedMult}×
              </span>
            )}
          </div>
          <div className="caption mt-0.5">expires in {fmtRel(t.expires_at)}</div>
        </>
      ) : (
        <>
          <div className="hand mt-0.5 text-[15px] font-bold">FREE · click to claim</div>
          <div className="caption mt-0.5">+1 pt · 7d lock</div>
        </>
      )}
    </div>
  );
}
