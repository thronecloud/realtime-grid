'use client';
import { useStore } from '@/lib/store';
import { bigTileAt } from '@/lib/grid/big-tiles';

function fmtRel(iso: string): string {
  const d = Date.parse(iso) - Date.now();
  if (d <= 0) return 'expired';
  const days = Math.floor(d / 86_400_000);
  const hours = Math.floor((d % 86_400_000) / 3_600_000);
  return `${days}d ${hours}h`;
}

export function HoverTooltip() {
  const hoverScreen = useStore((s) => s.hoverScreen);
  const hoverCell = useStore((s) => s.hoverCell);
  const tiles = useStore((s) => s.tiles);
  const players = useStore((s) => s.players);
  const bigIndex = useStore((s) => s.bigIndex);
  if (!hoverScreen || !hoverCell) return null;

  const big = bigTileAt(bigIndex, hoverCell.x, hoverCell.y);
  const id = big ? `b:${big.x},${big.y}` : `s:${hoverCell.x},${hoverCell.y}`;
  const t = tiles.get(id);
  const p = t ? players.get(t.owner_id) : null;

  const style: React.CSSProperties = {
    left: hoverScreen.x + 12,
    top: hoverScreen.y + 12,
  };

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md bg-neutral-900/95 px-3 py-2 text-xs ring-1 ring-neutral-800"
      style={style}
    >
      <div className="font-mono text-neutral-300">
        {id}
        {big ? ' (big)' : ''}
      </div>
      {t ? (
        <>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: p?.color ?? '#888' }}
            />
            <span>{p?.name ?? '…'}</span>
          </div>
          <div className="text-neutral-500">expires in {fmtRel(t.expires_at)}</div>
        </>
      ) : (
        <div className="text-neutral-500">unclaimed</div>
      )}
    </div>
  );
}
