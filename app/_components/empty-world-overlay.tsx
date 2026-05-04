'use client';
import { useStore } from '@/lib/store';

// First-visit prompt — a paper card with brackets and a -0.5deg rotation
// floating over the empty parchment grid. Auto-dismisses on first capture
// via store reactivity.
export function EmptyWorldOverlay() {
  const tilesSize = useStore((s) => s.tiles.size);
  if (tilesSize > 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500"
      aria-hidden="true"
    >
      <div
        className="brackets relative border-2 border-[var(--ink)] bg-[var(--bg-paper)] px-8 py-6 text-center"
        style={{ transform: 'rotate(-0.5deg)', boxShadow: '3px 3px 0 0 rgba(0,0,0,0.15)' }}
      >
        <span className="br-bl" />
        <span className="br-br" />
        <p className="hand text-[28px] font-bold leading-tight">
          The world is yours, operative.
        </p>
        <p className="caption mt-2">// click anywhere to drop your first claim</p>
      </div>
    </div>
  );
}
