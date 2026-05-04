'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

export function CooldownIndicator() {
  const cooldownUntil = useStore((s) => s.cooldownUntil);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const remaining = cooldownUntil ? Math.max(0, cooldownUntil - Date.now()) : 0;
  const pct = Math.min(1, remaining / 10_000);
  const ready = remaining === 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-neutral-400">
        {ready ? 'Ready' : `Cooldown ${(remaining / 1000).toFixed(1)}s`}
      </span>
      <div className="h-2 w-40 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full transition-[width] duration-100"
          style={{
            width: `${(1 - pct) * 100}%`,
            background: ready ? '#22c55e' : '#eab308',
          }}
        />
      </div>
    </div>
  );
}
