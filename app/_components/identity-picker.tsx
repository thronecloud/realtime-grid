'use client';
import { useEffect, useState } from 'react';
import { randomPlayerColor, isValidHexColor } from '@/lib/colors';

interface Props {
  open: boolean;
  onSubmit: (name: string, color: string) => void;
  initialName?: string;
  initialColor?: string;
}

const SUGGESTED_NAMES = ['NORTH', 'KAIRO', 'HEX', 'OBSIDIAN', 'CIPHER', 'EMBER', 'VALKYRIE', 'ATLAS'];

// Squad-color preset palette, sourced from tactical.jsx (warm tones to sit
// on parchment without screaming).
const PRESETS = [
  '#e8553a', // accent — orange-red
  '#3a8ee8', // blue
  '#3ab26a', // signal green
  '#b53ae8', // violet
  '#e8b53a', // mustard
  '#1a1a1a', // ink
  '#ff66b3', // pink
  '#ffaa3a', // orange
];

export function IdentityPicker({ open, onSubmit, initialName = '', initialColor }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? PRESETS[0]);

  useEffect(() => {
    if (open && !name) {
      const suggested = SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)];
      setName(suggested);
    }
  }, [open, name]);

  if (!open) return null;
  const valid = name.trim().length >= 1 && name.trim().length <= 24 && isValidHexColor(color);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/80 backdrop-blur-sm">
      {/* Marquee ticker — atmospheric */}
      <div className="pointer-events-none absolute top-10 w-full overflow-hidden border-y-[1.5px] border-[var(--ink)] bg-[var(--bg-paper)] py-1.5">
        <div className="flex whitespace-nowrap" style={{ animation: 'ticker 60s linear infinite' }}>
          {Array(2)
            .fill(0)
            .map((_, j) => (
              <div key={j} className="flex shrink-0 gap-12 px-6">
                <span className="caption">· LIVE · 100×100 GRID · 10K CELLS · 10s COOLDOWN · 7d OWNERSHIP ·</span>
                <span className="caption">· POSTGRES-LOCKED CAPTURE · CLAIM YOUR TERRITORY ·</span>
                <span className="caption">· ✦ HIDDEN 5× &amp; 10× JACKPOTS · GET LUCKY ·</span>
              </div>
            ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(name.trim(), color);
        }}
        className="brackets relative w-full max-w-md frame p-6"
      >
        <span className="br-bl" />
        <span className="br-br" />

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-[var(--accent-amber)]" />
          <span className="caption">// new operative</span>
        </div>

        <h1
          className="hand mt-2 text-[42px] font-bold leading-[1.0]"
          style={{ letterSpacing: '0.01em' }}
        >
          enter the
          <br />
          <span style={{ color: 'var(--accent)' }}>grid.</span>
        </h1>

        <p className="hand mt-2 max-w-[28ch] text-[16px] leading-snug text-[var(--fg-muted)]">
          pick a callsign &amp; color. every tile you capture broadcasts in real time
          to everyone online.
        </p>

        <div className="mt-5 space-y-4">
          {/* Callsign */}
          <div>
            <div className="flex items-center justify-between">
              <span className="label">CALLSIGN</span>
              <span className="caption tabular-nums tnum">
                {String(name.length).padStart(2, '0')}/24
              </span>
            </div>
            <input
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="hand mt-1 w-full border-[1.5px] border-[var(--ink)] bg-[var(--bg-warm)] px-3 py-2 text-[22px] font-semibold uppercase tracking-[0.05em] text-[var(--ink)] outline-none"
              style={{ letterSpacing: '0.05em' }}
            />
          </div>

          {/* Color */}
          <div>
            <span className="label block">SQUAD COLOR</span>
            <div className="mt-1.5 flex items-center gap-2">
              {PRESETS.map((c) => {
                const active = c.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Pick ${c}`}
                    className="relative h-7 w-7 border-[1.5px] border-[var(--ink)]"
                    style={{ background: c }}
                  >
                    {active && (
                      <span
                        className="absolute pointer-events-none"
                        style={{
                          inset: -5,
                          border: '1.5px dashed var(--ink)',
                        }}
                      />
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setColor(randomPlayerColor())}
                className="hand ml-2 text-[14px] text-[var(--fg-muted)] hover:text-[var(--ink)]"
              >
                ↻ shuffle
              </button>
              <span
                className="ml-auto font-mono text-[10px] uppercase tabular-nums tnum text-[var(--fg-muted)]"
              >
                {color.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!valid}
          className="hand mt-6 flex w-full items-center justify-between px-4 py-3 text-[18px] font-bold uppercase transition"
          style={{
            background: valid ? 'var(--ink)' : 'rgba(0,0,0,0.25)',
            color: 'var(--bg-paper)',
            letterSpacing: '0.15em',
            cursor: valid ? 'pointer' : 'not-allowed',
          }}
        >
          <span>DEPLOY TO GRID</span>
          <span>▸▸</span>
        </button>

        <div className="mt-3 flex items-center justify-between">
          <span className="caption">SESSION · ANONYMOUS</span>
          <span className="caption">v0.1.0</span>
        </div>
      </form>

      <style jsx>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
