'use client';
import { create } from 'zustand';
import type { BigTileRow, PlayerRow, TileRow } from '@/lib/types/db';
import type { Camera } from '@/lib/grid/camera';
import { buildBigTileIndex, type BigTileIndex } from '@/lib/grid/big-tiles';

export interface PresencePeer { id: string; name: string; color: string }
export interface FlashEntry { tileId: string; until: number }
export interface FadeEntry { startedAt: number; durationMs: number }
export interface FeedItem {
  key: string;
  playerId: string;
  tileId: string;
  kind: 'small' | 'big';
  ts: number;
}

interface State {
  userId: string | null;
  me: PlayerRow | null;

  bigIndex: BigTileIndex;
  tiles: Map<string, TileRow>;
  players: Map<string, PlayerRow>;

  online: PresencePeer[];
  feed: FeedItem[];

  camera: Camera;
  cooldownUntil: number | null;
  flashes: FlashEntry[];
  fadingOut: Map<string, FadeEntry>;
  hoverScreen: { x: number; y: number } | null;
  hoverCell: { x: number; y: number } | null;

  dirty: boolean;

  setIdentity: (userId: string, me: PlayerRow | null) => void;
  setBigTiles: (rows: BigTileRow[]) => void;
  setInitialTiles: (rows: TileRow[]) => void;
  upsertTile: (row: TileRow) => void;
  removeTile: (tileId: string) => void;
  setPlayers: (rows: PlayerRow[]) => void;
  setOnline: (peers: PresencePeer[]) => void;
  pushFeed: (item: FeedItem) => void;
  setCamera: (c: Camera) => void;
  startCooldown: (seconds: number) => void;
  pushFlash: (tileId: string, ms: number) => void;
  markFading: (tileId: string, durationMs: number) => void;
  clearFading: (tileId: string) => void;
  setHover: (
    screen: { x: number; y: number } | null,
    cell: { x: number; y: number } | null,
  ) => void;
  clearDirty: () => void;
}

const FEED_MAX = 50;

export const useStore = create<State>((set) => ({
  userId: null,
  me: null,
  bigIndex: buildBigTileIndex([]),
  tiles: new Map(),
  players: new Map(),
  online: [],
  feed: [],
  camera: { zoom: 1, x: 0, y: 0 },
  cooldownUntil: null,
  flashes: [],
  fadingOut: new Map(),
  hoverScreen: null,
  hoverCell: null,
  dirty: true,

  setIdentity: (userId, me) => set({ userId, me, dirty: true }),
  setBigTiles: (rows) => set({ bigIndex: buildBigTileIndex(rows), dirty: true }),
  setInitialTiles: (rows) => set({ tiles: new Map(rows.map((r) => [r.id, r])), dirty: true }),
  upsertTile: (row) =>
    set((s) => {
      const next = new Map(s.tiles);
      next.set(row.id, row);
      return { tiles: next, dirty: true };
    }),
  removeTile: (tileId) =>
    set((s) => {
      const next = new Map(s.tiles);
      next.delete(tileId);
      return { tiles: next, dirty: true };
    }),
  setPlayers: (rows) =>
    set((s) => {
      const next = new Map(s.players);
      for (const r of rows) next.set(r.id, r);
      return { players: next, dirty: true };
    }),
  setOnline: (peers) => set({ online: peers }),
  pushFeed: (item) =>
    set((s) => ({
      feed: [item, ...s.feed.filter((f) => f.key !== item.key)].slice(0, FEED_MAX),
    })),
  setCamera: (camera) => set({ camera, dirty: true }),
  startCooldown: (seconds) => set({ cooldownUntil: Date.now() + seconds * 1000 }),
  pushFlash: (tileId, ms) =>
    set((s) => ({
      flashes: [...s.flashes.filter((f) => f.until > Date.now()), { tileId, until: Date.now() + ms }],
      dirty: true,
    })),
  markFading: (tileId, durationMs) =>
    set((s) => {
      const next = new Map(s.fadingOut);
      next.set(tileId, { startedAt: Date.now(), durationMs });
      return { fadingOut: next, dirty: true };
    }),
  clearFading: (tileId) =>
    set((s) => {
      const next = new Map(s.fadingOut);
      next.delete(tileId);
      return { fadingOut: next, dirty: true };
    }),
  setHover: (hoverScreen, hoverCell) => set({ hoverScreen, hoverCell, dirty: true }),
  clearDirty: () => set({ dirty: false }),
}));
