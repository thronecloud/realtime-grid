'use client';
import { useStore } from '@/lib/store';
import { PresencePill } from './presence-pill';
import { CooldownIndicator } from './cooldown-indicator';

export function Topbar() {
  const me = useStore((s) => s.me);
  return (
    <header className="flex items-center justify-between border-b border-neutral-900 bg-neutral-950/95 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-sm bg-gradient-to-br from-amber-400 to-rose-500" />
        <h1 className="text-sm font-semibold tracking-wide">Realtime Grid</h1>
      </div>
      <div className="flex items-center gap-4">
        <CooldownIndicator />
        <PresencePill />
        {me && (
          <div className="flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ background: me.color }} />
            <span>{me.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
