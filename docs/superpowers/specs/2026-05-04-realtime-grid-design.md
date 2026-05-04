# Realtime Shared Grid — Design

**Date:** 2026-05-04
**Author:** Priyeshu (with Claude)
**Context:** Interview assignment. Build a real-time shared grid where many users capture tiles and see each other's captures live. Evaluator emphasizes backend + real-time thinking, with a clean UI as a hard requirement.

## Problem

A 100×100 (10,000-cell) grid hosted at a public URL. Any visitor can claim tiles. ~1% of cells are rare 5×5 "reward" tiles. Captures must be visible to every connected client in near real-time. Concurrent captures of the same tile must resolve correctly (exactly one winner). Per-user 10s cooldown is server-enforced. Captured tiles are owned for 7 days, then unlocked.

The submission must include: deployed URL, public GitHub repo, tech-stack writeup, real-time approach, trade-offs, and bonus features.

## Goals & non-goals

**Goals**
- Demonstrably correct conflict resolution under concurrent captures of the same tile.
- Server-authoritative cooldown and tile-lock enforcement.
- Real-time broadcast to all connected clients with <300ms perceived latency.
- A polished, responsive UI with zoom/pan, animations, and live presence.
- Code small enough for a reviewer to read end-to-end in one sitting.

**Non-goals**
- Persistent cross-device accounts (anonymous auth is per-device).
- Team play, alliances, area-control bonuses.
- Replay / time-travel of the board state.
- Sound effects.
- Sharded / geographically distributed real-time. Single Supabase channel is fine for 10k tiles.

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│  Next.js (Vercel)       │         │  Supabase                    │
│  ─────────────────────  │  HTTPS  │  ─────────────────────────   │
│  • App Router pages     │ ──────► │  • Postgres                  │
│  • Canvas grid renderer │         │    - tiles, players,         │
│  • Zoom/pan camera      │         │      captures, big_tiles     │
│  • Capture cooldown UI  │ ◄─────► │  • Postgres RPC capture_tile │
│                         │   WSS   │    (the conflict-safe write) │
│                         │ ──────► │  • Realtime (Postgres        │
│                         │         │    Changes on tiles + a      │
│                         │         │    broadcast channel)        │
│                         │         │  • Anonymous Auth            │
│                         │         │  • pg_cron expiry sweeper    │
└─────────────────────────┘         └──────────────────────────────┘
```

**Three load-bearing decisions:**

1. **Capture is a Postgres RPC, not a Next.js route handler.** The function takes the cooldown check, lock check, and ownership write inside one transaction with row-level locks. Conflict resolution happens at the database, not in JS.
2. **Real-time fanout is two channels.** Channel A is `tiles` Postgres Changes — authoritative state, drives grid repaints. Channel B is a `world` broadcast — ephemeral UX (presence, capture-feed payloads). Splitting them keeps the correctness path obvious.
3. **Tiles are a sparse table.** Unclaimed tiles aren't rows. Saturated cap is ~7,600 rows. `delete` on expiry naturally drives the "tile freed" animation via Postgres Changes.

## Data model

```sql
create table players (
  id              uuid primary key references auth.users(id),
  name            text not null,
  color           text not null,                -- hex; chosen at first visit
  last_capture_at timestamptz,                  -- enforces 10s cooldown
  created_at      timestamptz default now()
);

-- Pre-generated 100 anchor coords for the rare 5x5 reward tiles.
-- Inserted once at world init, never mutated.
create table big_tiles (
  x int not null, y int not null,
  primary key (x, y)
);

-- Sparse: only currently-or-recently-owned tiles exist as rows.
create table tiles (
  id          text primary key,                 -- "s:34,71" or "b:10,10"
  kind        text not null check (kind in ('small','big')),
  x           int  not null,                    -- anchor coord (top-left for big)
  y           int  not null,
  owner_id    uuid not null references players(id),
  captured_at timestamptz not null default now(),
  expires_at  timestamptz not null              -- captured_at + 7 days
);
create index on tiles(owner_id);
create index on tiles(expires_at);

-- Immutable capture log. Drives hourly hot-streak board + recent-captures feed.
create table captures (
  id          bigserial primary key,
  player_id   uuid references players(id),
  tile_id     text references tiles(id) on delete cascade,
  captured_at timestamptz default now()
);
create index on captures(player_id, captured_at desc);
create index on captures(captured_at desc);
```

**Row Level Security**
- `select` is public on all four tables.
- `insert/update/delete` on `tiles` and `captures` are denied to all clients. Only the `capture_tile` RPC (security definer) writes them.
- `players` row is self-update only (`auth.uid() = id`).

**Cleanup job.** A `pg_cron` task runs every 60s: `delete from tiles where expires_at < now()`. The deletes flow through Postgres Changes → all clients see the fade-out animation.

## Capture flow & conflict resolution

The `capture_tile(p_tile_id)` RPC is the only path that mutates `tiles`. Pseudocode:

```sql
create or replace function capture_tile(p_tile_id text)
returns table(ok boolean, reason text, tile json)
language plpgsql security definer as $$
declare
  v_uid       uuid := auth.uid();
  v_kind      text;
  v_x int; v_y int;
  v_last      timestamptz;
  v_existing  tiles%rowtype;
begin
  if v_uid is null then
    return query select false, 'unauthenticated', null::json; return;
  end if;

  -- 1. Parse + validate. Enforces big-tile geometry server-side.
  --    A big tile id "b:ax,ay" must match a big_tiles row at (ax,ay).
  --    A small tile id "s:x,y" is invalid if (x,y) falls inside any
  --    big-tile footprint, i.e. if a big_tiles row exists with
  --    ax in [x-4, x] and ay in [y-4, y].
  --    World bounds: 0 <= x,y < 100.
  select kind, x, y into v_kind, v_x, v_y from parse_tile_id(p_tile_id);
  if v_kind is null then
    return query select false, 'invalid_tile', null::json; return;
  end if;

  -- 2. Cooldown check. FOR UPDATE serializes parallel captures by same user.
  select last_capture_at into v_last
    from players where id = v_uid for update;
  if v_last is not null and now() - v_last < interval '10 seconds' then
    return query select false, 'cooldown', null::json; return;
  end if;

  -- 3. Lock the target tile row. Serializes parallel captures of same tile.
  select * into v_existing from tiles where id = p_tile_id for update;

  -- 4. Lock check.
  if found and v_existing.expires_at > now() then
    return query select false, 'locked', row_to_json(v_existing); return;
  end if;

  -- 5. Write (upsert; tile may exist as an expired row).
  insert into tiles (id, kind, x, y, owner_id, captured_at, expires_at)
  values (p_tile_id, v_kind, v_x, v_y, v_uid, now(), now() + interval '7 days')
  on conflict (id) do update
    set owner_id    = excluded.owner_id,
        captured_at = excluded.captured_at,
        expires_at  = excluded.expires_at;

  -- 6. Bookkeeping.
  update players set last_capture_at = now() where id = v_uid;
  insert into captures (player_id, tile_id) values (v_uid, p_tile_id);

  return query select true, null::text,
    (select row_to_json(t) from tiles t where t.id = p_tile_id);
end $$;
```

**Why this is correct under contention:**

- *Same tile, two users in parallel.* Both calls reach step 3 and contend on `select ... for update` on the `tiles` row (or the gap if the row doesn't yet exist; Postgres `repeatable read` + the unique PK on `tiles.id` collapses the race at insert-time anyway). One transaction serializes through; the other sees the row exists with `expires_at > now()` and returns `locked`.
- *Same user, two tiles in parallel.* Both calls reach step 2 and contend on `select ... for update` on the `players` row. One serializes through and updates `last_capture_at`; the other reads the fresh value and returns `cooldown`.
- *Malicious client bypassing the cooldown UI.* RLS denies direct table writes; the only mutation path is the RPC, which checks `last_capture_at` server-side.
- *Malicious client claiming an invalid tile id.* `parse_tile_id` validates against `big_tiles` and the world bounds.

**Optimistic UI:** the client paints the tile in the player's color the instant they click, then reconciles when the RPC returns. On rejection (cooldown / locked) the optimistic paint is reverted and the cursor shakes briefly.

## Real-time strategy

**Channel A — `tiles` Postgres Changes (authoritative).**
- `INSERT/UPDATE` on `tiles` → repaint that tile in owner's color, run 220ms capture-flash.
- `DELETE` on `tiles` → fade tile to unclaimed over 600ms.
- This is the only thing that mutates on-screen grid colors.

**Channel B — `world` broadcast (ephemeral).**
- `presence`: online players with name+color, used for the "X online" pill.
- `event:capture`: `{playerId, name, color, tileId, kind, score}` — drives the right-rail recent-captures ticker without forcing clients to JOIN players on every Channel A message.

**Initial load.** On page open, in parallel:
1. `select * from tiles` (≤ ~7,600 rows; payload < 500 KB compressed).
2. `select id, name, color from players where id in (...)`.
3. `select * from big_tiles` (100 rows, cached in localStorage with a version tag).

Then subscribe to A and B.

**Reconnect.** On Realtime disconnect → on reconnect, refetch the full `tiles` snapshot once before re-subscribing. Bulletproof against any missed messages.

**Why not spatial sharding.** With a 10s cooldown and at most a few hundred concurrent users, peak write rate is bounded (≤ ~tens of captures/sec globally). One channel handles it. The README will note we'd shard by chunk for a 100k+ grid.

## Renderer & UI

**Canvas 2D, not WebGL/Pixi.** 10k tiles is comfortably within Canvas 2D's range. WebGL would balloon the bundle and the cognitive load for a 7-day project.

**Drawing model.**
- One on-screen `<canvas>` resize-observed to the viewport.
- One offscreen buffer with the whole world rendered at the current zoom level. Repainted only when zoom changes or when tiles arrive.
- Per-frame loop: blit buffer at camera offset, then draw the overlay (hover, selection ring, capture flashes, cursor cooldown ring).
- Tile state lives in a `Map<tileId, TileRow>` in a Zustand store. Realtime updates mutate the map and mark a dirty rect; the next animation frame re-blits just that region.

**Camera.**
- Pan: drag with mouse / two-finger touch.
- Zoom: wheel + pinch, clamped `[0.5x, 8x]`. Zoom anchors on cursor.
- "Zoom to fit" button resets to whole-world view.

**Click vs. drag disambiguation.** mousedown → mouseup with movement < 4px and duration < 250ms = click. Otherwise pan.

**Layout (desktop).**
```
┌──────────────────────────────────────────────────────────────────┐
│  ░ Realtime Grid    ● 24 online      [name pill]  [color swatch] │
├────────────┬─────────────────────────────────────┬───────────────┤
│  Recent    │                                     │  Leaderboard  │
│  captures  │            <canvas grid>            │  Hot streak   │
│  feed      │                                     │  (last 1h)    │
├────────────┴─────────────────────────────────────┴───────────────┤
│  [zoom −] [zoom %]  [zoom +]  [fit]   cooldown: ●●●●○○○○○○ 4.3s  │
└──────────────────────────────────────────────────────────────────┘
```

Side panels collapse into bottom sheets on mobile.

**Visuals.**
- Each player has a hue. Tiles render at ~80% saturation / 55% lightness on a near-black background.
- Big tiles get a subtle inset border + faint glow to telegraph rarity.
- Capture animation: 220ms flash white → owner color, scale 1.0 → 1.15 → 1.0.
- Expiry animation: 600ms desaturate + fade.
- Hover tooltip shows owner name, captured-at, expires-in.

**State.** Zustand for client state (camera, tiles, players, presence, cooldown deadline). React Query for the initial REST loads.

## Identity

- **Supabase Anonymous Auth** runs silently on first page load — every visitor gets a real `auth.uid()`.
- **Name + color picker modal** appears on first visit. Stored on the `players` row; cached in localStorage so returning users skip the modal.

## Bonus features (in scope for v1)

- Name + color identity
- 10s cooldown (server-enforced, with cursor ring + bottom-bar UI)
- 7-day tile lock
- Big "reward" tiles (1%, 5×5)
- Top-10 leaderboard (small=1pt, big=5pt)
- Hot-streak board (captures in last hour, top 5)
- Live recent-captures feed (right rail)
- Presence pill (X online)
- Zoom + pan
- Capture-flash + expiry-fade animations
- Hover tooltip
- Mobile-responsive layout

**Defense in depth:** the 10s server-enforced cooldown *is* the per-user rate limit (≤ 6 captures/min/user). Supabase's project-level request limits provide the global ceiling. We do not add a separate edge-side limiter — RPC calls go from the client straight to Supabase PostgREST, so a Next.js / middleware limiter wouldn't sit on the path anyway.

## Project structure

```
realtime-grid/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── api/healthz/route.ts
│   └── _components/
│       ├── grid-canvas.tsx
│       ├── topbar.tsx
│       ├── leaderboard.tsx
│       ├── hot-streak.tsx
│       ├── recent-feed.tsx
│       ├── cooldown-indicator.tsx
│       ├── identity-picker.tsx
│       └── presence-pill.tsx
├── lib/
│   ├── supabase/{client.ts, server.ts}
│   ├── grid/{camera.ts, renderer.ts, tile-id.ts, big-tiles.ts}
│   ├── store.ts
│   ├── realtime.ts
│   └── colors.ts
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_capture_rpc.sql
│   │   ├── 0003_seed_big_tiles.sql
│   │   └── 0004_cleanup_job.sql
│   └── config.toml
├── tests/
│   ├── capture.test.ts
│   └── grid.test.ts
├── README.md
├── vercel.ts
├── package.json
└── tsconfig.json
```

**Stack pinned:** Next.js 16 (App Router), React 19, TypeScript, Tailwind + shadcn/ui (chrome only — not the canvas), Zustand, React Query, Supabase JS v2, Vitest.

## Testing

- **Vitest unit tests** for pure helpers: camera transforms, tile-id parsing, big-tile footprint geometry, color palette.
- **One integration test** that spins up a local Supabase, calls `capture_tile` from two clients in parallel against the same tile, and asserts exactly one wins. This is the test that proves the conflict story.
- **Manual QA pass** via `/qa-only` against the deployed preview URL before submitting.

## Deployment

- Supabase project provisioned via the Vercel Marketplace integration → env vars auto-injected.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, baked into the client bundle.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only. Used solely for admin scripts; the capture path uses the user's own JWT so RLS + `auth.uid()` apply.
- `vercel deploy --prod` after a passing preview.
- `pg_cron` runs the expiry sweeper every 60s.

## Trade-offs (worth a section in the README)

- **Supabase Realtime vs. raw WebSocket server.** A managed pub/sub layer hides some of the "real-time plumbing" we're being evaluated on, but the *interesting* real-time work — server-authoritative ordering, conflict resolution, cooldown enforcement — moves into Postgres where it's stronger. We document the choice rather than hide it.
- **Canvas 2D vs. WebGL.** WebGL scales to millions of tiles; Canvas 2D is enough at 10k and keeps the renderer readable. Easy migration path if scale grew.
- **Sparse `tiles` table vs. dense pre-populated grid.** Sparse keeps the table tiny, makes "free?" a `not exists` check, and turns expiry into a delete that the realtime layer broadcasts for free.
- **Single channel vs. spatial sharding.** Sharding would matter at 100k+ cells or thousands of concurrent writers. At 10k cells with a 10s cooldown, one channel is correct *and* simpler.
- **Anonymous auth vs. real accounts.** Real accounts add friction and offer little for a tile-game submission. Anonymous still gives us a real `auth.uid()` for RLS.
- **Optimistic UI on capture.** Snappier feel, but requires reconciliation logic on rejection. Worth it.

## Open risks

- **Supabase Realtime payload caps.** Postgres Changes payload size is bounded (~256 KB last we checked). Single-tile updates are tiny so this isn't a practical concern, but flagged.
- **`pg_cron` availability on Supabase free tier.** If unavailable on the chosen tier, fall back to a Vercel Cron hitting an admin endpoint that runs the same delete.
- **Mobile pinch-zoom on the canvas.** Needs careful event handling so it doesn't fight native browser zoom; will verify during QA.
