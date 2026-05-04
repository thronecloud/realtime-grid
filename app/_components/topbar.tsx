'use client';
import { useStore } from '@/lib/store';
import { PresencePill } from './presence-pill';
import { CooldownIndicator } from './cooldown-indicator';

export function Topbar() {
  const me = useStore((s) => s.me);
  return (
    <header className="relative flex h-12 items-stretch border-b-2 border-[var(--ink)] bg-[var(--bg-base)]">
      {/* Logo cell */}
      <div className="flex items-center gap-3 border-r-2 border-[var(--ink)] px-4">
        <span className="relative h-4 w-4">
          <span className="absolute inset-0 bg-[var(--accent-amber)]" />
          <span className="absolute inset-[3px] bg-[var(--ink)]" />
          <span className="absolute left-[7px] top-[7px] h-[2px] w-[2px] bg-[var(--accent-amber)]" />
        </span>
        <span className="hand text-[20px] font-bold tracking-[0.1em]">GRID · OPS</span>
        <span className="caption">// 100×100 · realtime</span>
      </div>

      {/* Hint */}
      <div className="hidden flex-1 items-center px-4 sm:flex">
        <span className="caption">// click a tile to claim · 10s cooldown · 7d ownership</span>
      </div>
      <div className="flex flex-1 sm:hidden" />

      {/* Cooldown */}
      <div className="hidden items-center border-l-2 border-[var(--ink)] px-4 sm:flex">
        <CooldownIndicator />
      </div>

      {/* Presence */}
      <div className="flex items-center border-l-2 border-[var(--ink)] px-3">
        <PresencePill />
      </div>

      {/* Me chip — inverted (ink bg, paper text) */}
      {me && (
        <div className="flex items-center gap-2 border-l-2 border-[var(--ink)] bg-[var(--ink)] px-3 text-[var(--bg-paper)]">
          <span
            className="h-3 w-3 border border-[var(--bg-paper)]"
            style={{ background: me.color }}
          />
          <span className="hand text-[15px] font-bold tracking-[0.05em] uppercase">
            {me.name}
          </span>
          <span className="caption text-[var(--fg-dim)]">· me</span>
        </div>
      )}
    </header>
  );
}
