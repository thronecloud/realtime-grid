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
  // Cooldown is 1s now (was 10s) — denominator updated to match.
  const filled = Math.round((1 - remaining / 1_000) * SEGMENTS);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-baseline gap-1.5">
        <span className="label">{ready ? 'STATUS' : 'COOLDOWN'}</span>
        <span
          className={`hand text-[16px] font-bold tabular-nums tnum ${
            ready ? 'text-[var(--accent-signal)]' : 'text-[var(--accent)]'
          }`}
        >
          {ready ? 'READY' : `${(remaining / 1000).toFixed(1)}s`}
        </span>
      </div>
      <div className="flex items-center" style={{ gap: 2 }}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const isFilled = ready ? true : i < filled;
          const isLast = !ready && i === filled - 1;
          return (
            <span
              key={i}
              className={isLast ? 'blink' : ''}
              style={{
                width: 4,
                height: 14,
                background: isFilled
                  ? ready
                    ? 'var(--accent-signal)'
                    : 'var(--accent)'
                  : 'rgba(0,0,0,0.12)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
