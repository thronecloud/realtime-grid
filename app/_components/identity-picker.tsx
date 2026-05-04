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

// 8-color preset palette, hand-picked for vibrancy on the dark grid + good
// inter-color contrast so neighboring tiles stay distinguishable.
const PRESETS = [
  '#f5c245', // amber
  '#4ade80', // signal green
  '#60a5fa', // sky blue
  '#f472b6', // pink
  '#a78bfa', // purple
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#ef4444', // alert red
];

export function IdentityPicker({ open, onSubmit, initialName = '', initialColor }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? randomPlayerColor());

  useEffect(() => {
    if (open && !name) {
      const suggested = SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)];
      setName(suggested);
    }
  }, [open, name]);

  if (!open) return null;
  const valid = name.trim().length >= 1 && name.trim().length <= 24 && isValidHexColor(color);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-void)]/85 backdrop-blur-md"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 90% 60% at 50% 30%, rgba(245,194,69,0.10), transparent 60%)',
      }}
    >
      {/* Marquee ticker — atmospheric */}
      <div className="pointer-events-none absolute top-10 w-full overflow-hidden border-y border-[var(--line)] bg-[var(--bg-panel)]/40 py-2 text-[10px] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
        <div className="flex animate-[ticker_60s_linear_infinite] whitespace-nowrap">
          {Array(2)
            .fill(0)
            .map((_, j) => (
              <div key={j} className="flex shrink-0 gap-12 px-6">
                <span>· LIVE · 100×100 GRID · 10K CELLS · 10s COOLDOWN · 7d OWNERSHIP ·</span>
                <span>· POSTGRES-LOCKED CAPTURE · REALTIME FANOUT · CLICK TO CLAIM ·</span>
                <span>· ✦ 5× &amp; 10× JACKPOTS HIDDEN IN THE GRID · GET LUCKY ·</span>
                <span>· DEFEND. EXPAND. STRIKE GOLD. ·</span>
              </div>
            ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(name.trim(), color);
        }}
        className="brackets relative w-full max-w-md border border-[var(--line-strong)] bg-[var(--bg-panel)] p-8"
      >
        <span className="br-bl" />
        <span className="br-br" />

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse bg-[var(--accent-amber)]" />
          <span className="label">// NEW OPERATIVE</span>
        </div>

        <h1 className="mt-3 text-[28px] font-bold uppercase leading-none tracking-[0.04em] text-[var(--fg)]">
          Enter the
          <br />
          <span className="text-[var(--accent-amber)]">grid.</span>
        </h1>

        <p className="mt-3 max-w-[28ch] text-[12px] leading-relaxed text-[var(--fg-muted)]">
          Pick a callsign and color. Every tile you capture broadcasts in real time to
          everyone online.
        </p>

        <div className="mt-6 space-y-5">
          {/* Callsign */}
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 flex items-center justify-between"
            >
              <span className="label">CALLSIGN</span>
              <span className="text-[10px] tabular-nums tnum text-[var(--fg-dim)]">
                {name.length}/24
              </span>
            </label>
            <input
              id="name"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full border border-[var(--line)] bg-[var(--bg-sunken)] px-3 py-2.5 font-mono text-[14px] uppercase tracking-[0.05em] text-[var(--fg)] outline-none transition focus:border-[var(--accent-amber)]/60 focus:bg-[var(--bg-void)]"
            />
          </div>

          {/* Color */}
          <div>
            <span className="label mb-1.5 block">SQUAD COLOR</span>
            {/* Preset palette: 8 vibrant swatches, dashed outline on the
                active one. Custom color picker still available below. */}
            <div className="grid grid-cols-8 gap-1.5">
              {PRESETS.map((c) => {
                const active = c.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Pick color ${c}`}
                    className="aspect-square w-full"
                    style={{
                      background: c,
                      outline: active ? '1.5px dashed var(--fg)' : '1px solid rgba(255,255,255,0.08)',
                      outlineOffset: active ? '3px' : '-1px',
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-[var(--line)] bg-[var(--bg-sunken)] transition hover:border-[var(--accent-amber)]/60">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  className="block h-4 w-4"
                  style={{
                    background: color,
                    boxShadow:
                      '0 0 0 1px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.12)',
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => setColor(randomPlayerColor())}
                className="flex items-center gap-2 border border-[var(--line)] bg-[var(--bg-sunken)] px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-[var(--fg-muted)] transition hover:border-[var(--accent-amber)]/60 hover:text-[var(--fg)]"
              >
                <span>↻</span>
                <span>SHUFFLE</span>
              </button>
              <span
                className="ml-auto font-mono text-[10px] uppercase tabular-nums tnum"
                style={{ color }}
              >
                {color}
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!valid}
          className="group relative mt-7 flex w-full items-center justify-between border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)] px-4 py-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--bg-void)] transition hover:bg-[var(--fg)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:bg-[var(--bg-sunken)] disabled:text-[var(--fg-dim)]"
        >
          <span>DEPLOY TO GRID</span>
          <span className="transition group-hover:translate-x-1">▸▸</span>
        </button>

        <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[9px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          <span>SESSION · ANONYMOUS</span>
          <span>v0.1.0</span>
        </div>
      </form>
    </div>
  );
}
