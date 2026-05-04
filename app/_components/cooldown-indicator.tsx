'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

const SEGMENTS = 10;

export function CooldownIndicator() {
  const cooldownUntil = useStore((s) => s.cooldownUntil);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const remaining = cooldownUntil ? Math.max(0, cooldownUntil - Date.now()) : 0;
  const ready = remaining === 0;
  // How many segments are "filled" (ready segments) — counts up as time passes.
  const filled = Math.round((1 - remaining / 10_000) * SEGMENTS);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-baseline gap-1.5">
        <span className="label">{ready ? 'STATUS' : 'COOLDOWN'}</span>
        <span
          className={`text-[12px] tabular-nums tnum font-semibold ${
            ready ? 'text-[var(--accent-signal)]' : 'text-[var(--accent-warn)]'
          }`}
        >
          {ready ? 'READY' : `${(remaining / 1000).toFixed(1)}s`}
        </span>
      </div>
      <div className="flex h-3 items-center gap-[2px]">
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const isFilled = i < filled;
          const isLast = i === filled - 1 && !ready;
          return (
            <span
              key={i}
              className={`h-3 w-1 ${isLast ? 'blink' : ''}`}
              style={{
                background: isFilled
                  ? ready
                    ? 'var(--accent-signal)'
                    : 'var(--accent-warn)'
                  : 'var(--line-strong)',
                boxShadow: isFilled ? '0 0 6px currentColor' : 'none',
                color: ready ? 'var(--accent-signal)' : 'var(--accent-warn)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
