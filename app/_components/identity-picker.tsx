'use client';
import { useState } from 'react';
import { randomPlayerColor, isValidHexColor } from '@/lib/colors';

interface Props {
  open: boolean;
  onSubmit: (name: string, color: string) => void;
  initialName?: string;
  initialColor?: string;
}

export function IdentityPicker({ open, onSubmit, initialName = '', initialColor }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? randomPlayerColor());

  if (!open) return null;
  const valid = name.trim().length >= 1 && name.trim().length <= 24 && isValidHexColor(color);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold tracking-tight">Pick a name &amp; color</h2>
        <p className="mt-1 text-sm text-neutral-400">Used for tiles you capture.</p>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Display name
            </label>
            <input
              id="name"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-600"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="color" className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-neutral-800 bg-transparent"
              />
              <button
                type="button"
                onClick={() => setColor(randomPlayerColor())}
                className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900"
              >
                Random
              </button>
              <span className="ml-auto h-6 w-6 rounded-full" style={{ background: color }} />
            </div>
          </div>
        </div>
        <button
          disabled={!valid}
          onClick={() => onSubmit(name.trim(), color)}
          className="mt-6 w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          Start playing
        </button>
      </div>
    </div>
  );
}
