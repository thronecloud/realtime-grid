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
  const { toast } = useToast();
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
    <main className="flex h-screen flex-col">
      <Topbar />
      <div className="flex flex-1 flex-col overflow-hidden md:grid md:grid-cols-[260px_1fr_260px]">
        <div className="hidden md:block">
          <RecentFeed />
        </div>
        <div className="relative flex-1">
          {auth.status === 'ready' && me && (
            <GridCanvas onCaptureRejected={(reason) => toast(reason)} />
          )}
          <HoverTooltip />
        </div>
        <aside className="hidden overflow-y-auto border-l border-neutral-900 bg-neutral-950 md:block">
          <Leaderboard />
          <HotStreak />
        </aside>
        <div className="flex h-44 overflow-y-auto border-t border-neutral-900 bg-neutral-950 md:hidden">
          <div className="w-1/2 border-r border-neutral-900">
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
