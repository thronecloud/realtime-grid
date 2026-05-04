'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { RecentFeed } from './recent-feed';
import { Leaderboard } from './leaderboard';
import { HotStreak } from './hot-streak';

type Tab = 'feed' | 'top' | 'hot' | 'me';

const TABS: { key: Tab; label: string }[] = [
  { key: 'feed', label: 'FEED' },
  { key: 'top', label: 'TOP10' },
  { key: 'hot', label: 'HOT' },
  { key: 'me', label: 'ME' },
];

// Mobile-only tabbed bottom panel (renders at <md breakpoint via page.tsx).
// Replaces the 50/50 leaderboard+hot-streak split so all four surfaces are
// reachable on small screens.
export function MobileTabs() {
  const [tab, setTab] = useState<Tab>('feed');
  const me = useStore((s) => s.me);
  const tiles = useStore((s) => s.tiles);
  const myCount = me ? [...tiles.values()].filter((t) => t.owner_id === me.id).length : 0;
  const myScore = me
    ? [...tiles.values()].reduce(
        (acc, t) => (t.owner_id === me.id ? acc + (t.kind === 'mult10' ? 10 : t.kind === 'mult5' ? 5 : 1) : acc),
        0,
      )
    : 0;
  const myJackpots = me
    ? [...tiles.values()].filter(
        (t) => t.owner_id === me.id && (t.kind === 'mult5' || t.kind === 'mult10'),
      ).length
    : 0;

  return (
    <div className="flex h-48 flex-col border-t border-[var(--line)] bg-[var(--bg-panel)]">
      <nav className="flex shrink-0 border-b border-[var(--line)] text-[10px] uppercase tracking-[0.2em]">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 border-r border-[var(--line)] px-3 py-2 last:border-r-0 ${
                active
                  ? 'bg-[var(--bg-void)] font-semibold text-[var(--accent-amber)]'
                  : 'bg-[var(--bg-panel)] text-[var(--fg-muted)]'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'feed' && (
          <div className="h-full">
            <RecentFeed />
          </div>
        )}
        {tab === 'top' && (
          <div className="h-full overflow-y-auto">
            <Leaderboard />
          </div>
        )}
        {tab === 'hot' && (
          <div className="h-full overflow-y-auto">
            <HotStreak />
          </div>
        )}
        {tab === 'me' && (
          <div className="h-full p-4 text-[11px]">
            {me ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="chip h-5 w-5" style={{ background: me.color }} />
                  <span className="text-[14px] font-semibold text-[var(--fg)]">{me.name}</span>
                </div>
                <dl className="grid grid-cols-3 gap-2 border border-[var(--line)] bg-[var(--bg-sunken)] p-3">
                  <div>
                    <dt className="label">SCORE</dt>
                    <dd className="mt-1 font-mono text-[18px] tabular-nums text-[var(--fg)]">{myScore}</dd>
                  </div>
                  <div>
                    <dt className="label">TILES</dt>
                    <dd className="mt-1 font-mono text-[18px] tabular-nums text-[var(--fg)]">{myCount}</dd>
                  </div>
                  <div>
                    <dt className="label">✦ HITS</dt>
                    <dd className="mt-1 font-mono text-[18px] tabular-nums text-[var(--accent-amber)]">{myJackpots}</dd>
                  </div>
                </dl>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
                  // tiles auto-expire after 7 days
                </p>
              </div>
            ) : (
              <div className="text-[var(--fg-dim)]">// no operative selected</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
