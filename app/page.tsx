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

export default function HomePage() {
  const auth = useAnonAuth();
  const me = useStore((s) => s.me);
  const setIdentity = useStore((s) => s.setIdentity);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { toast, jackpot } = useToast();
  const rtRef = useRef<RealtimeHandle | null>(null);

  async function ensureRealtime(player: { id: string; name: string; color: string }) {
    rtRef.current?.stop();
    rtRef.current = await startRealtime({ me: player });
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
          <HoverTooltip />
          {/* Crosshair frame on the canvas viewport */}
          <div className="pointer-events-none absolute inset-0">
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
        <div className="flex h-44 overflow-y-auto border-t border-[var(--line)] bg-[var(--bg-panel)] md:hidden">
          <div className="w-1/2 border-r border-[var(--line)]">
            <Leaderboard />
          </div>
          <div className="w-1/2">
            <HotStreak />
          </div>
        </div>
      </div>
      <IdentityPicker open={pickerOpen} onSubmit={onPickIdentity} />
    </main>
  );
}
