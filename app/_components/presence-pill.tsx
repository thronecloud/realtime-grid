'use client';
import { useStore } from '@/lib/store';

export function PresencePill() {
  const online = useStore((s) => s.online);
  return (
    <div className="flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-sm">
      <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
      <span className="font-medium">{online.length}</span>
      <span className="text-neutral-400">online</span>
    </div>
  );
}
