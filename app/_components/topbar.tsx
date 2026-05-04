'use client';
import { useStore } from '@/lib/store';
import { PresencePill } from './presence-pill';
import { CooldownIndicator } from './cooldown-indicator';

export function Topbar() {
  const me = useStore((s) => s.me);
  return (
    <header
      className="relative flex h-12 items-stretch border-b border-[var(--line)] bg-[var(--bg-base)]/95 backdrop-blur-sm"
      style={{
        backgroundImage:
          'linear-gradient(to bottom, rgba(245,194,69,0.04), transparent 70%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-r border-[var(--line)] px-4">
        <div className="relative h-4 w-4">
          <span className="absolute inset-0 bg-[var(--accent-amber)]" />
          <span className="absolute inset-[3px] bg-[var(--bg-void)]" />
          <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 bg-[var(--accent-amber)]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--fg)]">
            GRID
          </span>
          <span className="label">/ Realtime · 100×100</span>
        </div>
      </div>

      {/* Spacer with optional ticker hint */}
      <div className="flex flex-1 items-center px-4 text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
        <span className="hidden sm:inline">
          // CLICK A TILE TO CLAIM · 10s COOLDOWN · 7d OWNERSHIP
        </span>
      </div>

      {/* Cooldown */}
      <div className="hidden items-center border-l border-[var(--line)] px-4 sm:flex">
        <CooldownIndicator />
      </div>

      {/* Presence */}
      <div className="flex items-center border-l border-[var(--line)] px-3">
        <PresencePill />
      </div>

      {/* Me */}
      {me && (
        <div className="flex items-center gap-2 border-l border-[var(--line)] bg-[var(--bg-void)] px-3">
          <span className="chip" style={{ background: me.color }} />
          <span className="text-[11px] text-[var(--fg)]">{me.name}</span>
        </div>
      )}
    </header>
  );
}
