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

export function MobileTabs() {
  const [tab, setTab] = useState<Tab>('feed');
  const me = useStore((s) => s.me);
  const tiles = useStore((s) => s.tiles);
  const myTiles = me ? [...tiles.values()].filter((t) => t.owner_id === me.id) : [];
  const myScore = myTiles.reduce(
    (acc, t) => acc + (t.kind === 'mult10' ? 10 : t.kind === 'mult5' ? 5 : 1),
    0,
  );
  const myJackpots = myTiles.filter((t) => t.kind === 'mult5' || t.kind === 'mult10').length;

  return (
    <div className="flex h-48 flex-col border-t-2 border-[var(--ink)] bg-[var(--bg-paper)]">
      <nav className="flex shrink-0 border-b-2 border-[var(--ink)]">
        {TABS.map((t, i) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`hand flex-1 px-3 py-2 text-[13px] font-bold tracking-[0.05em] ${
                i < TABS.length - 1 ? 'border-r border-[var(--ink)]' : ''
              } ${active ? 'bg-[var(--ink)] text-[var(--bg-paper)]' : 'text-[var(--ink)]'}`}
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
        {tab === 'me' && me && (
          <div className="h-full p-4">
            <div className="flex items-center gap-3">
              <span
                className="h-5 w-5 border-[1.5px] border-[var(--ink)]"
                style={{ background: me.color }}
              />
              <span className="hand text-[18px] font-bold uppercase">{me.name}</span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-2 border-[var(--ink)] bg-[var(--bg-warm)] p-3">
              <div>
                <dt className="label">SCORE</dt>
                <dd className="hand mt-1 text-[22px] font-bold tabular-nums tnum">{myScore}</dd>
              </div>
              <div>
                <dt className="label">TILES</dt>
                <dd className="hand mt-1 text-[22px] font-bold tabular-nums tnum">{myTiles.length}</dd>
              </div>
              <div>
                <dt className="label">★ HITS</dt>
                <dd className="hand mt-1 text-[22px] font-bold tabular-nums tnum text-[var(--accent-amber)]">
                  {myJackpots}
                </dd>
              </div>
            </dl>
            <p className="caption mt-3">// tiles auto-expire after 7 days</p>
          </div>
        )}
        {tab === 'me' && !me && (
          <div className="hand p-4 text-[var(--fg-muted)]">// no operative selected</div>
        )}
      </div>
    </div>
  );
}
