# Realtime Shared Grid

A 100×100 shared map of 10,000 tiles. Anyone who opens the site picks a callsign, drops onto the grid, and starts claiming territory in real time. ~100 of those cells are **secretly worth 5× or 10× points** — players don't know which until they capture them. Hit one and a `MEGA JACKPOT` banner fires. Per-user 10-second cooldown, 7-day ownership lock — both server-enforced.

> **Live demo:** _TBD — deployed URL pending submission_
> **Repo:** https://github.com/thronecloud/realtime-grid

```
┌───────────────────────────────────────────────────────────────┐
│ ░ GRID  /  REALTIME · 100×100   COOLDOWN ▮▮▮▮▮▯▯▯▯▯  ●02 BRAVO │
├──────────┬─────────────────────────────────────┬──────────────┤
│ FEED  08 │             ✦ MEGA JACKPOT · 10× ✦  │ LEADERBOARD  │
│ ZETA→ 10×│              · rare drop ·          │ ZETA  ✦1  10 │
│ EPSI→ 10×│                                     │ EPSI  ✦1  10 │
│ exp →    │       ░░░░░▓░░░░░░░░░░░             │ jack  ✦1   5 │
│ alic→    │       ░░░░░░░░░▓░░░░░░░             │              │
│ ...      │       ░░▓░░░░░░░░░░░░░░             │ HOT STREAK   │
│          │                                     │ exp +2       │
└──────────┴─────────────────────────────────────┴──────────────┘
```

## Tech stack

- **Framework:** Next.js 16 (App Router) on Vercel, React 19, TypeScript
- **Database:** Supabase Postgres with a single `capture_tile` RPC enforcing every conflict rule; RLS denies any direct write
- **Real-time:** Supabase Realtime — two channels (`tiles` Postgres Changes for authoritative state + `world` broadcast for ephemeral UX)
- **Auth:** Supabase Anonymous Auth (silent sign-in on first visit + name/color picker)
- **Renderer:** HTML Canvas 2D with viewport culling, dirty-flag rAF gating, capture-flash + expiry-fade + jackpot-reveal animations
- **State:** Zustand
- **Styling:** Tailwind 4 with a tactical-terminal token system (no UI lib)
- **Tests:** Vitest — 10 unit + 6 integration (capture-RPC contention) all passing
- **Hosting:** Vercel for the app + cron, Supabase Cloud for DB + realtime
- **Cron:** `pg_cron` (preferred) or Vercel Cron at `/api/cron/expire` (always-available fallback)

## How real-time works

Two channels with deliberately split responsibilities:

**Channel A — `tiles` Postgres Changes (authoritative state).**
Every client subscribes. `INSERT`/`UPDATE` paints the tile in the new owner's color and runs a 220ms capture-flash. `DELETE` (from the expiry sweeper) runs a 600ms fade. The DB row is the single source of truth.

**Channel B — `world` broadcast (ephemeral UX).**
Carries presence (online players + their colors) and capture events that drive the right-rail recent-captures feed without forcing a JOIN on every Channel A message. Best-effort — if it drops, Channel A is still correct. `broadcast.self = true` so the captor sees their own capture in their own feed.

Captures funnel through one Postgres RPC: `capture_tile(tile_id)`. The function:

1. Reads `auth.uid()`; rejects unauthenticated.
2. Validates the tile id (`s:x,y`, both 0..99) — server-authoritative bounds check.
3. **Looks up the secret multiplier** for that cell. The seed table holds ~100 random anchor cells, each tagged `mult = 5 or mult = 10` (70/30 split).
4. `SELECT … FOR UPDATE` on the player row → enforces the 10s cooldown atomically.
5. **Atomic capture** via `INSERT … ON CONFLICT (id) DO UPDATE … WHERE expires_at <= now() RETURNING *`. This single statement either creates the row, steals an expired tile, or returns zero rows when the tile is currently owned. There is no read-then-write window.
6. Tags the tile with the multiplier kind (`'normal' | 'mult5' | 'mult10'`) and inserts an immutable row in `captures` for the hot-streak board.
7. Returns `{ok, reason, tile}` so the client can fire the JACKPOT animation when `tile.kind` reveals a hidden multiplier.

**Every contention scenario resolves at the database, not in JS:**
- *Two users, same tile:* the upsert's `WHERE expires_at <= now()` excludes any owned row at commit time. One transaction wins; the other sees `RETURNING` empty and returns `locked`. (The naïve "SELECT FOR UPDATE then INSERT" pattern is racy under READ COMMITTED — both readers see no row, both write, the loser's `ON CONFLICT DO UPDATE` silently overwrites the winner. The integration tests caught this; the WHERE-clause variant fixes it.)
- *Same user, two parallel clicks:* serialized via the player-row `for update` lock. One wins; the other reads the fresh `last_capture_at` and returns `cooldown`.
- *Client edits JS to skip the cooldown UI:* the RPC re-checks `last_capture_at` server-side. RLS denies direct table writes, so the RPC is the only mutation path.

The client paints optimistically the instant you click, then reconciles on the RPC return. Reconciliation **compares before reverting** — if Channel A pushed in a legitimate concurrent capture during the round-trip, the optimistic revert leaves it alone.

A `pg_cron` job (or Vercel Cron at `/api/cron/expire`) sweeps `expires_at < now()` every 60 s. The deletes flow through Channel A → all clients fade the freed tiles out. Free correctness + free animation.

## Trade-offs

- **Supabase Realtime over a hand-rolled WS server.** Hides plumbing — but shifts the *interesting* concurrency work into Postgres, where row-level locks and RLS are stronger guarantees than anything I'd write in Node. The `capture_tile` migration is the part of this codebase worth reading.
- **Canvas 2D over WebGL/Pixi.** 10k cells is well inside Canvas 2D's range, the bundle stays small, and the renderer is ~150 lines you can hold in your head. WebGL would balloon both. Easy migration path if the grid grew to 100k+.
- **Sparse `tiles` table.** Unclaimed tiles aren't rows. The table caps at 10,000 rows when the world is fully claimed; "is this free?" is `not exists`; expiry is just `delete` and the realtime layer animates it for free.
- **Single realtime channel for the whole 10k world.** With a 10s cooldown, peak global write rate is bounded. Spatial sharding would only matter at 100k+ cells.
- **Anonymous auth instead of accounts.** Real `auth.uid()` for RLS, zero friction. Identity is per-device, which is fine for a casual grid.
- **Hidden multipliers, no visual distinction.** Earlier iterations had visually-distinct 5×5 BIG tiles with gold borders. They dominated the canvas and made small captures read as glitches. Hiding the multipliers turns every click into a slot-machine pull and keeps the grid feeling continuous.
- **Optimistic capture client-side with compare-before-revert.** Snappier feel; reconciliation handles the case where Channel A pushed in a legitimate concurrent capture during the round-trip.
- **`INSERT … ON CONFLICT … WHERE … RETURNING` over `SELECT FOR UPDATE` + `INSERT`.** The latter is racy under READ COMMITTED. The former is one atomic statement and the integration test that exposes the race goes from RED to GREEN.
- **Two cron paths, not one.** `pg_cron` may not exist on every Supabase tier; the Vercel Cron route at `/api/cron/expire` is the always-available fallback. Both can run safely — once one deletes a row, the other no-ops.
- **Dirty-flag rAF gating.** Idle screens don't repaint; only state changes (or active capture/fade animations) wake the loop. Battery-friendly on mobile.

## Bonus features

- Display callsign + custom color (random suggestion on every load + manual color picker + shuffle button)
- 10-second per-user cooldown, server-enforced, with chunked terminal-style segmented progress bar
- 7-day ownership lock with automatic expiry sweeper + fade animation
- **Hidden 5× and 10× multipliers** (~1% density, ~70/30 split) with `MEGA JACKPOT` reveal animation — gold sparkle on the cell, banner with corner brackets and "RARE DROP" subtitle
- Top-10 all-time leaderboard with score-bar gradient fills, gold-tinted #1, "me" row amber-tinted, and `✦N` jackpot count badge
- Hot-streak board (top 5 captures in the last hour, polled every 30s)
- Live recent-captures feed (left rail) with feed-in entrance animations and `✦ 5×` / `✦ 10×` chips
- Presence pill ("X online" with pulsing signal-green ring)
- Zoom (0.5×–8×) + drag-pan with cursor-anchored zoom and click-vs-drag disambiguation
- Optimistic UI + capture-flash + expiry-fade + jackpot-reveal animations
- Hover tooltip with HUD corner brackets (cell coords, owner, expires-in, hidden until captured)
- Mobile-responsive layout (panels collapse to bottom sheet at md breakpoint)
- Distinctive "tactical multiplayer terminal" aesthetic — Bloomberg-meets-r/place

## Local development

```bash
pnpm install
supabase start                           # local Postgres + realtime via Docker
supabase db reset                        # apply all 5 migrations + seed multipliers
cp .env.local.example .env.local         # fill from `supabase status`
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env.local
pnpm test                                # 10 unit tests
pnpm test:integration                    # 6 capture-RPC contention tests
pnpm dev                                 # http://localhost:3000
```

`supabase/config.toml` enables anonymous sign-ins for the local stack — Supabase Cloud projects need the same toggle in the dashboard before deploy.

## Project layout

```
app/
  _components/                # presentational UI
  api/cron/expire/route.ts    # Vercel Cron expiry sweeper (fallback to pg_cron)
  layout.tsx, page.tsx        # composition
lib/
  api/{tiles,players,captures}.ts   # data access (paginated where needed)
  grid/{camera,renderer,tile-id,big-tiles}.ts   # pure helpers (TDD-tested)
  supabase/{client,server}.ts       # browser + SSR clients
  hooks/{use-anon-auth,use-toast}.ts
  realtime.ts                       # two-channel wiring + worldChannel ref
  store.ts                          # Zustand
  colors.ts                         # palette
supabase/migrations/
  0001_init.sql                     # schema + RLS
  0002_capture_rpc.sql              # capture_tile + parse_tile_id
  0003_seed_big_tiles.sql           # 100 random anchors
  0004_cleanup_cron.sql             # pg_cron expiry sweep
  0005_multiplier_redesign.sql      # uniform tiles + hidden 5x/10x multipliers
tests/
  grid/, colors.test.ts             # unit
  integration/capture.test.ts       # RPC contention + multiplier verification
docs/superpowers/
  specs/2026-05-04-realtime-grid-design.md
  plans/2026-05-04-realtime-grid.md
```
