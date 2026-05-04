'use client';
import { useCallback, useRef } from 'react';

export function useToast() {
  // Module-instance throttle for peer jackpot toasts. Self captures always
  // fire (the captor deserves their celebratory moment); peer captures are
  // gated to one banner per ~1.5s so a busy server doesn't drown the screen.
  const peerLastFiredAt = useRef(0);
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

  // Big celebratory banner for hidden-multiplier captures.
  const jackpot = useCallback((mult: number) => {
    if (typeof document === 'undefined') return;
    const wrap = document.createElement('div');
    wrap.className =
      'pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center';
    const inner = document.createElement('div');
    const isMega = mult === 10;
    inner.className = [
      'jackpot-banner relative px-6 py-3 font-mono uppercase tracking-[0.3em] font-bold',
      'border bg-[var(--bg-panel)]/95 backdrop-blur',
      isMega ? 'border-[var(--accent-amber)] text-[var(--accent-amber)] text-2xl' : 'border-[var(--accent-amber)]/60 text-[var(--accent-amber)] text-xl',
    ].join(' ');
    inner.style.boxShadow = isMega
      ? '0 0 40px rgba(245,194,69,0.45), inset 0 0 16px rgba(245,194,69,0.18)'
      : '0 0 22px rgba(245,194,69,0.30)';
    inner.innerHTML = `
      <span style="position:absolute;top:-1px;left:-1px;width:12px;height:12px;border:1px solid currentColor;border-right:0;border-bottom:0"></span>
      <span style="position:absolute;top:-1px;right:-1px;width:12px;height:12px;border:1px solid currentColor;border-left:0;border-bottom:0"></span>
      <span style="position:absolute;bottom:-1px;left:-1px;width:12px;height:12px;border:1px solid currentColor;border-right:0;border-top:0"></span>
      <span style="position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;border:1px solid currentColor;border-left:0;border-top:0"></span>
      <span style="display:block">✦ ${isMega ? 'MEGA JACKPOT' : 'JACKPOT'} · ${mult}× ✦</span>
      <span style="display:block;font-size:10px;letter-spacing:0.2em;margin-top:4px;color:var(--fg-muted)">${isMega ? 'rare drop' : 'lucky tile'}</span>
    `;
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => {
      inner.animate(
        [
          { opacity: 0, transform: 'translateY(-12px) scale(0.9)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 220, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' },
      );
    });
    setTimeout(() => {
      inner.animate(
        [
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(-12px) scale(0.95)' },
        ],
        { duration: 280, easing: 'ease-in', fill: 'forwards' },
      );
      setTimeout(() => wrap.remove(), 320);
    }, isMega ? 1900 : 1300);
  }, []);

  // Smaller, top-right banner for OTHER players' multiplier captures.
  // Throttled to 1.5s so a flurry of peer jackpots doesn't spam the screen.
  const peerJackpot = useCallback((args: { mult: number; name: string; color: string }) => {
    if (typeof document === 'undefined') return;
    const now = Date.now();
    if (now - peerLastFiredAt.current < 1500) return;
    peerLastFiredAt.current = now;
    const wrap = document.createElement('div');
    wrap.className = 'pointer-events-none fixed right-4 top-20 z-40';
    const inner = document.createElement('div');
    inner.className =
      'flex items-center gap-2 border border-[var(--accent-amber)]/40 bg-[var(--bg-panel)]/95 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--accent-amber)] backdrop-blur';
    inner.style.boxShadow = '0 0 18px rgba(245,194,69,0.25)';
    inner.innerHTML = `
      <span style="color:var(--fg-muted);font-size:10px">✦</span>
      <span style="color:${args.color};">${args.name.slice(0, 16)}</span>
      <span style="color:var(--fg-muted)">hit</span>
      <span>${args.mult}×</span>
    `;
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    inner.animate(
      [
        { opacity: 0, transform: 'translateY(-6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 180, fill: 'forwards' },
    );
    setTimeout(() => {
      inner.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-6px)' },
        ],
        { duration: 220, fill: 'forwards' },
      );
      setTimeout(() => wrap.remove(), 240);
    }, 1100);
  }, []);

  return { toast, jackpot, peerJackpot };
}
