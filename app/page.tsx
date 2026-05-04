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
      {/* Mobile-only cooldown row directly below the topbar (topbar itself
          hides the desktop cooldown widget at <sm). */}
      <div className="flex items-center justify-between border-b-[1.5px] border-[var(--ink)] bg-[var(--bg-base)] px-3 py-1.5 sm:hidden">
        <CooldownIndicator />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden md:grid md:grid-cols-[260px_1fr_260px]">
        <div className="hidden border-r-2 border-[var(--ink)] md:block">
          <RecentFeed />
        </div>
        <div className="relative flex-1 bg-[var(--bg-parch)] p-4">
          {/* Sector header strip */}
          <div className="flex items-center justify-between mb-2">
            <span className="caption">▸ SECTOR · A1–B100  ·  zoom 1.0×</span>
            <span className="caption" style={{ color: 'var(--accent-signal)' }}>● RADAR · LIVE</span>
          </div>
          {/* Canvas — wrapped in gold-bracketed ink frame */}
          <div className="relative h-[calc(100%-3rem)] border-2 border-[var(--ink)] bg-[var(--bg-parch)]">
            {/* Gold corner brackets (matches Brackets util in tactical.jsx) */}
            <span className="pointer-events-none absolute -top-[5px] -left-[5px] h-2 w-2 border-t-2 border-l-2 border-[var(--accent-amber)]" />
            <span className="pointer-events-none absolute -top-[5px] -right-[5px] h-2 w-2 border-t-2 border-r-2 border-[var(--accent-amber)]" />
            <span className="pointer-events-none absolute -bottom-[5px] -left-[5px] h-2 w-2 border-b-2 border-l-2 border-[var(--accent-amber)]" />
            <span className="pointer-events-none absolute -bottom-[5px] -right-[5px] h-2 w-2 border-b-2 border-r-2 border-[var(--accent-amber)]" />
            {auth.status === 'ready' && me && (
              <GridCanvas
                onCaptureRejected={(reason) => toast(reason)}
                onJackpot={(mult) => jackpot(mult)}
              />
            )}
            <EmptyWorldOverlay />
            <HoverTooltip />
          </div>
          {/* Footer strip */}
          <div className="flex items-center justify-between mt-2">
            <span className="caption">drag · pan  ·  wheel · zoom</span>
            <span className="caption">click · capture</span>
          </div>
        </div>
        <aside className="hidden overflow-y-auto border-l-2 border-[var(--ink)] bg-[var(--bg-paper)] md:block">
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
