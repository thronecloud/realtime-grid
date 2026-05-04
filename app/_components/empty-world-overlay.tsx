'use client';
import { useStore } from '@/lib/store';

// First-visit prompt. Stays mounted but only renders content while the
// world is genuinely empty — fades out the moment the first capture lands
// (driven by store.tiles.size, no manual dismissal needed).
export function EmptyWorldOverlay() {
  const tilesSize = useStore((s) => s.tiles.size);
  if (tilesSize > 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500"
      aria-hidden="true"
    >
      <div className="brackets relative border border-[var(--accent-amber)]/40 bg-[var(--bg-panel)]/70 px-8 py-6 text-center backdrop-blur-sm">
        <span className="br-bl" />
        <span className="br-br" />
        <p className="text-[16px] font-semibold tracking-[0.04em] text-[var(--fg)]">
          The world is yours, operative.
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[var(--fg-muted)]">
          // click anywhere to drop your first claim
        </p>
      </div>
    </div>
  );
}
