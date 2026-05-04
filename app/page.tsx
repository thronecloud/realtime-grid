'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAnonAuth } from '@/lib/hooks/use-anon-auth';
import { fetchMyPlayer, upsertMyPlayer } from '@/lib/api/players';
import { startRealtime, type RealtimeHandle } from '@/lib/realtime';
import { useToast } from '@/lib/hooks/use-toast';
import { Topbar } from './_components/topbar';
import { RecentFeed } from './_components/recent-feed';
import { Leaderboard } from './_components/leaderboard';
import { HotStreak } from './_components/hot-streak';
import { GridCanvas } from './_components/grid-canvas';
import { HoverTooltip } from './_components/hover-tooltip';
import { IdentityPicker } from './_components/identity-picker';
import { MobileTabs } from './_components/mobile-tabs';
import { CooldownIndicator } from './_components/cooldown-indicator';
import { EmptyWorldOverlay } from './_components/empty-world-overlay';

export default function HomePage() {
  const auth = useAnonAuth();
  const me = useStore((s) => s.me);
  const setIdentity = useStore((s) => s.setIdentity);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { toast, jackpot, peerJackpot } = useToast();
  const rtRef = useRef<RealtimeHandle | null>(null);

  async function ensureRealtime(player: { id: string; name: string; color: string }) {
    rtRef.current?.stop();
    rtRef.current = await startRealtime({
      me: player,
      onPeerJackpot: (args) => peerJackpot(args),
    });
  }

  useEffect(() => {
    if (auth.status !== 'ready') return;
    (async () => {
      const player = await fetchMyPlayer(auth.userId);
      setIdentity(auth.userId, player);
      if (!player) {
        setPickerOpen(true);
        return;
      }
      await ensureRealtime(player);
    })();
    return () => {
      rtRef.current?.stop();
      rtRef.current = null;
    };
  }, [auth, setIdentity]);

  async function onPickIdentity(name: string, color: string) {
    if (auth.status !== 'ready') return;
    const player = await upsertMyPlayer({ id: auth.userId, name, color });
    setIdentity(auth.userId, player);
    setPickerOpen(false);
    await ensureRealtime(player);
  }

  return (
    <main className="flex h-screen flex-col bg-[var(--bg-base)]">
      <Topbar />
      {/* Mobile-only cooldown row directly below the topbar (the topbar
          itself hides the desktop cooldown widget at <sm). */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-base)]/95 px-3 py-1.5 sm:hidden">
        <CooldownIndicator />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden md:grid md:grid-cols-[280px_1fr_280px]">
        <div className="hidden md:block">
          <RecentFeed />
        </div>
        <div className="relative flex-1 bg-[var(--bg-void)]">
          {auth.status === 'ready' && me && (
            <GridCanvas
              onCaptureRejected={(reason) => toast(reason)}
              onJackpot={(mult) => jackpot(mult)}
            />
          )}
          <EmptyWorldOverlay />
          <HoverTooltip />
          {/* HUD frame: gold corner brackets + corner labels */}
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute left-0 top-0 h-3 w-3 border-t border-l border-[var(--accent-amber)]/70" />
            <span className="absolute right-0 top-0 h-3 w-3 border-t border-r border-[var(--accent-amber)]/70" />
            <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-[var(--accent-amber)]/70" />
            <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-[var(--accent-amber)]/70" />
            <div className="absolute left-3 top-3 flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
              <span className="h-1 w-1 animate-pulse bg-[var(--accent-signal)]" />
              <span>RADAR · LIVE</span>
            </div>
            <div className="absolute right-3 top-3 text-[9px] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
              GRID 100×100 · 10K CELLS
            </div>
            <div className="absolute bottom-3 left-3 text-[9px] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
              DRAG · PAN  ·  WHEEL · ZOOM
            </div>
            <div className="absolute bottom-3 right-3 text-[9px] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
              CLICK · CAPTURE
            </div>
          </div>
        </div>
        <aside className="hidden overflow-y-auto border-l border-[var(--line)] bg-[var(--bg-panel)] md:block">
          <Leaderboard />
          <HotStreak />
        </aside>
        <div className="md:hidden">
          <MobileTabs />
        </div>
      </div>
      <IdentityPicker open={pickerOpen} onSubmit={onPickIdentity} />
    </main>
  );
}
