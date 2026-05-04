'use client';
import { useStore } from '@/lib/store';

export function PresencePill() {
  const online = useStore((s) => s.online);
  return (
    <div className="flex items-center gap-2">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent-signal)] opacity-60 pulse-ring" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent-signal)]" />
      </span>
      <span className="hand text-[15px] font-semibold tabular-nums tnum">
        {online.length} ONLINE
      </span>
    </div>
  );
}
