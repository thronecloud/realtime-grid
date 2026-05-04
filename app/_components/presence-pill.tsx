'use client';
import { useStore } from '@/lib/store';

export function PresencePill() {
  const online = useStore((s) => s.online);
  return (
    <div className="flex items-center gap-2 text-[11px] tabular-nums tnum">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent-signal)] opacity-60 pulse-ring" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-signal)]" />
      </span>
      <span className="font-semibold text-[var(--fg)]">
        {String(online.length).padStart(2, '0')}
      </span>
      <span className="label">ONLINE</span>
    </div>
  );
}
