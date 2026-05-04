'use client';
import { useCallback, useRef } from 'react';

// All toasts use the warm-paper / ink aesthetic from tactical.jsx:
// - Rejection toasts: ink bg, paper text, slight rotation, accent dot.
// - Jackpot self banner: paper bg, 3px gold border, gold glow, rotated.
// - Peer jackpot: smaller paper card top-right, throttled.

export function useToast() {
  const peerLastFiredAt = useRef(0);

  const toast = useCallback((reason: string) => {
    if (typeof document === 'undefined') return;
    const map: Record<string, string> = {
      cooldown: 'COOLDOWN · wait a moment',
      locked: 'LOCKED · already owned',
      invalid_tile: 'INVALID TILE',
      unauthenticated: 'SIGN-IN FAILED',
      no_player: 'PICK A NAME FIRST',
      network: 'NETWORK ERROR',
    };
    const text = map[reason] ?? reason.toUpperCase();
    const wrap = document.createElement('div');
    wrap.className =
      'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 pointer-events-none';
    const inner = document.createElement('div');
    inner.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      background: #1a1a1a; color: #fbf8f1;
      padding: 8px 16px;
      transform: rotate(-0.5deg);
      box-shadow: 3px 3px 0 0 rgba(0,0,0,0.15);
      font-family: var(--font-caveat), Caveat, cursive;
      font-size: 16px; font-weight: 600;
      letter-spacing: 0.04em;
    `;
    inner.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;background:#e8553a;flex-shrink:0"></span>
      <span>${text}</span>
    `;
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1800);
  }, []);

  // Big celebratory paper card for own multiplier captures.
  const jackpot = useCallback((mult: number) => {
    if (typeof document === 'undefined') return;
    const isMega = mult === 10;
    const wrap = document.createElement('div');
    wrap.className = 'pointer-events-none fixed inset-x-0 top-1/3 z-50 flex justify-center';
    const inner = document.createElement('div');
    inner.style.cssText = `
      background: #fbf8f1;
      border: 3px solid #d9a826;
      padding: 22px 40px;
      text-align: center;
      transform: rotate(-1.4deg);
      box-shadow: 0 0 40px rgba(217,168,38,0.55), 4px 4px 0 #1a1a1a;
      position: relative;
    `;
    inner.innerHTML = `
      <span style="position:absolute;top:-6px;left:-6px;width:10px;height:10px;border:2px solid #d9a826;border-right:0;border-bottom:0"></span>
      <span style="position:absolute;top:-6px;right:-6px;width:10px;height:10px;border:2px solid #d9a826;border-left:0;border-bottom:0"></span>
      <span style="position:absolute;bottom:-6px;left:-6px;width:10px;height:10px;border:2px solid #d9a826;border-right:0;border-top:0"></span>
      <span style="position:absolute;bottom:-6px;right:-6px;width:10px;height:10px;border:2px solid #d9a826;border-left:0;border-top:0"></span>
      <div style="font-family:var(--font-caveat),Caveat,cursive;font-size:14px;letter-spacing:0.4em;font-weight:700;color:#d9a826">
        ★ ★ ★  ${isMega ? 'MEGA JACKPOT' : 'JACKPOT'}  ★ ★ ★
      </div>
      <div style="font-family:var(--font-caveat),Caveat,cursive;font-size:56px;line-height:1;font-weight:700;color:#1a1a1a;margin-top:6px">
        ${isMega ? 'MEGA' : 'BIG'} <span style="color:#d9a826">${mult}×</span>
      </div>
      <div style="font-family:var(--font-mono),monospace;font-size:12px;color:#888;margin-top:6px;letter-spacing:0.05em">
        ${isMega ? '// rare drop' : '// lucky tile'}
      </div>
    `;
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    inner.animate(
      [
        { opacity: 0, transform: 'rotate(-1.4deg) translateY(-10px) scale(0.92)' },
        { opacity: 1, transform: 'rotate(-1.4deg) translateY(0) scale(1.04)' },
        { transform: 'rotate(-1.4deg) scale(1.0)' },
      ],
      { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' },
    );
    setTimeout(() => {
      inner.animate(
        [
          { opacity: 1 },
          { opacity: 0, transform: 'rotate(-1.4deg) translateY(-8px) scale(0.97)' },
        ],
        { duration: 280, easing: 'ease-in', fill: 'forwards' },
      );
      setTimeout(() => wrap.remove(), 320);
    }, isMega ? 1900 : 1300);
  }, []);

  const peerJackpot = useCallback((args: { mult: number; name: string; color: string }) => {
    if (typeof document === 'undefined') return;
    const now = Date.now();
    if (now - peerLastFiredAt.current < 1500) return;
    peerLastFiredAt.current = now;
    const wrap = document.createElement('div');
    wrap.className = 'pointer-events-none fixed right-4 top-20 z-40';
    const inner = document.createElement('div');
    inner.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      background: #fbf8f1; border: 2px solid #d9a826;
      padding: 8px 14px;
      transform: rotate(-0.5deg);
      box-shadow: 0 0 18px rgba(217,168,38,0.30), 2px 2px 0 0 rgba(0,0,0,0.15);
      font-family: var(--font-caveat), Caveat, cursive;
    `;
    inner.innerHTML = `
      <span style="font-size:14px;color:#d9a826;font-weight:700">★</span>
      <span style="font-size:15px;font-weight:700;color:${args.color};text-transform:lowercase">${args.name.slice(0, 16)}</span>
      <span style="font-size:13px;color:#888">hit</span>
      <span style="font-size:15px;font-weight:700;color:#d9a826">${args.mult}×</span>
    `;
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    inner.animate(
      [
        { opacity: 0, transform: 'rotate(-0.5deg) translateY(-6px)' },
        { opacity: 1, transform: 'rotate(-0.5deg) translateY(0)' },
      ],
      { duration: 200, fill: 'forwards' },
    );
    setTimeout(() => {
      inner.animate(
        [
          { opacity: 1 },
          { opacity: 0, transform: 'rotate(-0.5deg) translateY(-6px)' },
        ],
        { duration: 220, fill: 'forwards' },
      );
      setTimeout(() => wrap.remove(), 240);
    }, 1100);
  }, []);

  return { toast, jackpot, peerJackpot };
}
