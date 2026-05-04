# Realtime Shared Grid

A 100×100 shared map where any visitor can capture tiles. ~100 of those tiles are rare 5×5 reward squares (1% density). Captures appear in real time for everyone connected. Per-user 10-second cooldown, 7-day ownership lock — both server-enforced.

> **Live demo:** _TBD — deployed URL pending submission_
> **Repo:** https://github.com/thronecloud/realtime-grid

```
┌────────────────────────────────────────────────────────────────┐
│  GRID  / Realtime · 100×100        [cooldown]  ●02 ONLINE  ME  │
├──────────────┬───────────────────────────────────┬─────────────┤
│  FEED   00   │                                   │ LEADERBOARD │
│              │                                   │ HOT STREAK  │
│              │      ░ ░ ░ ░ ░ █ ░ ░ ░ ░          │             │
│              │      ░ ░ █████ █ ░ ░ ░ ░          │             │
│              │      ░ ░ █BIG█ ░ ░ ░ ░ ░          │             │
│              │      ░ ░ █████ ░ ░ █ ░ ░          │             │
│              │                                   │             │
└──────────────┴───────────────────────────────────┴─────────────┘
   click a tile to claim · 10s cooldown · 7d ownership
```

## Tech stack

- **Framework:** Next.js 16 (App Router) on Vercel, React 19, TypeScript
- **Database:** Supabase Postgres with a single `capture_tile` RPC enforcing every conflict rule; RLS denies any direct write
- **Real-time:** Supabase Realtime — two channels (`tiles` Postgres Changes + `world` broadcast)
- **Auth:** Supabase Anonymous Auth (silent sign-in on first visit + name/color picker)
- **Renderer:** HTML Canvas 2D with viewport culling, dirty-flag rAF gating, capture-flash + expiry-fade animations
- **State:** Zustand
- **Styling:** Tailwind 4 with a tactical-terminal token system (no UI lib)
- **Tests:** Vitest (unit + integration), 12 unit tests passing
- **Hosting:** Vercel for the app + cron, Supabase Cloud for DB + realtime
- **Cron:** `pg_cron` (preferred) or Vercel Cron at `/api/cron/expire` (always-available fallback)

## How real-time works

Two channels with deliberately split responsibilities:

**Channel A — `tiles` Postgres Changes (authoritative state).**
Every client subscribes. `INSERT`/`UPDATE` paints the tile in the new owner's color and runs a 220ms capture-flash. `DELETE` (from the expiry sweeper) runs a 600ms fade. The DB row is the single source of truth.

**Channel B — `world` broadcast (ephemeral UX).**
Carries presence (online players + their colors) and capture events that drive the right-rail recent-captures feed without forcing a JOIN on every Channel A message. Best-effort — if it drops, Channel A is still correct.

Captures funnel through one Postgres RPC: `capture_tile(tile_id)`. The function:

1. Reads `auth.uid()`; rejects unauthenticated.
2. Validates the tile id against world bounds and the `big_tiles` seed table — server-authoritative geometry, so a malicious client can't claim a non-existent big tile or claim a small tile inside a big-tile footprint.
3. `SELECT … FOR UPDATE` on the player row → enforces the 10s cooldown atomically.
4. `SELECT … FOR UPDATE` on the target tile row → serializes concurrent captures of the same tile.
5. If the tile is owned and unexpired, returns `locked`. Otherwise upserts ownership and bumps `last_capture_at`.
6. Inserts an immutable row in `captures` for the hot-streak board.

**Every contention scenario resolves at the database, not in JS:**
- *Two users, same tile:* Postgres serializes via `for update`. One wins; the other gets `locked`.
- *Same user, two parallel clicks:* serialized via the player-row lock. One wins; the other gets `cooldown`.
- *Client edits JS to skip the cooldown UI:* the RPC re-checks `last_capture_at` server-side. RLS denies direct table writes, so the RPC is the only path.

The client paints optimistically the instant you click, then reconciles on the RPC return. Reconciliation **compares before reverting** — if Channel A pushed in a legitimate concurrent capture during the round-trip, the optimistic revert leaves it alone.

A `pg_cron` job (or Vercel Cron at `/api/cron/expire`) sweeps `expires_at < now()` every 60 s. The deletes flow through Channel A → all clients fade the freed tiles out. Free correctness + free animation.

## Trade-offs

- **Supabase Realtime over a hand-rolled WS server.** Hides plumbing — but shifts the *interesting* concurrency work into Postgres, where row-level locks and RLS are stronger guarantees than anything I'd write in Node. The capture RPC is the part of this codebase worth reading.
- **Canvas 2D over WebGL/Pixi.** 10k cells is well inside Canvas 2D's range, the bundle stays small, and the renderer is ~150 lines you can hold in your head. WebGL would balloon both. Easy migration path if the grid grew to 100k+.
- **Sparse `tiles` table.** Unclaimed tiles aren't rows. The table caps at ~7,600 rows when the world is fully claimed; "is this free?" is `not exists`; expiry is just `delete` and the realtime layer animates it for free.
- **Single realtime channel for the whole 10k world.** With a 10s cooldown, peak global write rate is bounded. Spatial sharding would only matter at 100k+ cells.
- **Anonymous auth instead of accounts.** Real `auth.uid()` for RLS, zero friction. Identity is per-device, which is fine for a casual grid.
- **Optimistic capture client-side.** Snappier feel, but requires reconciliation logic on rejection. Worth it.
- **Two cron paths, not one.** `pg_cron` may not exist on every Supabase tier; the Vercel Cron route at `/api/cron/expire` is the always-available fallback. Both can run safely — once one deletes a row, the other no-ops.
- **Dirty-flag rAF gating.** Idle screens don't repaint; only state changes (or active capture/fade animations) wake the loop. Battery-friendly on mobile.

## Bonus features

- Display name + custom color (random suggestion + color picker, or shuffle)
- 10-second per-user cooldown, server-enforced, with chunked terminal-style progress bar
- 7-day ownership lock with automatic expiry sweeper + fade animation
- Rare 5×5 "reward" tiles (~1% of the world, gold border + inner glow + 5× score)
- Top-10 all-time leaderboard with score-bar fills and "★N" big-tile count
- Hot-streak board (top 5 captures in the last hour)
- Live recent-captures feed (left rail) with entrance animations and ★ BIG badge
- Presence pill ("X online" with pulsing signal-green ring)
- Zoom (0.5×–8×) + drag-pan, cursor-anchored zoom
- Optimistic UI + capture-flash animation + expiry-fade animation
- Hover tooltip with HUD corner brackets (owner, expires-in, BIG badge)
- Mobile-responsive layout (panels collapse to bottom sheet)
- Distinctive "tactical multiplayer terminal" aesthetic — Bloomberg-meets-r/place

## Local development

```bash
pnpm install
supabase start                           # local Postgres + realtime via Docker
supabase db reset                        # apply migrations + seed 100 big tiles
cp .env.local.example .env.local         # fill from `supabase status`
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env.local
pnpm test                                # 12 unit tests
pnpm test:integration                    # 5 RPC contention tests (needs running Supabase)
pnpm dev                                 # http://localhost:3000
```

## Project layout

```
app/
  _components/                # presentational UI
  api/cron/expire/route.ts    # vercel-cron expiry sweeper (fallback to pg_cron)
  layout.tsx, page.tsx        # composition
lib/
  api/{tiles,players,captures}.ts   # data access
  grid/{camera,renderer,tile-id,big-tiles}.ts   # pure helpers (TDD-tested)
  supabase/{client,server}.ts       # browser + SSR clients
  hooks/{use-anon-auth,use-toast}.ts
  realtime.ts                       # two-channel wiring
  store.ts                          # Zustand
  colors.ts                         # palette
supabase/migrations/
  0001_init.sql                     # schema + RLS
  0002_capture_rpc.sql              # capture_tile + parse_tile_id
  0003_seed_big_tiles.sql           # 100 anchors
  0004_cleanup_cron.sql             # pg_cron expiry sweep
tests/
  grid/, colors.test.ts             # unit
  integration/capture.test.ts       # RPC contention (against local Supabase)
docs/superpowers/
  specs/2026-05-04-realtime-grid-design.md
  plans/2026-05-04-realtime-grid.md
```
