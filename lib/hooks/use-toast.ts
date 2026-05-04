'use client';
import { useCallback } from 'react';

export function useToast() {
  const toast = useCallback((reason: string) => {
    const map: Record<string, string> = {
      cooldown: 'Cooldown — wait a moment',
      locked: 'That tile is owned',
      invalid_tile: 'Invalid tile',
      unauthenticated: 'Sign-in failed',
      no_player: 'Pick a name first',
      network: 'Network error',
    };
    const text = map[reason] ?? reason;
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.textContent = text;
    el.className =
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-neutral-900 px-4 py-2 text-sm shadow-lg ring-1 ring-neutral-800 text-neutral-100';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }, []);
  return { toast };
}
