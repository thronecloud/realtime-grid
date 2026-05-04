# Realtime Shared Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed 100×100 real-time shared grid where any visitor can capture tiles with server-enforced 10s cooldowns and 7-day ownership locks, including ~100 rare 5×5 reward tiles, leaderboard, hot-streak board, presence, and a polished Canvas 2D UI.

**Architecture:** Next.js App Router on Vercel, Supabase Postgres + Realtime + Anonymous Auth, Canvas 2D renderer with viewport-clipped offscreen buffer, two-channel realtime fanout (Postgres Changes for authoritative state, broadcast channel for ephemeral UX), Postgres RPC `capture_tile` with row-level locks for conflict resolution.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, Zustand, TanStack Query v5, Supabase JS v2, Vitest, Playwright (one e2e), pnpm.

**Reference spec:** [`docs/superpowers/specs/2026-05-04-realtime-grid-design.md`](../specs/2026-05-04-realtime-grid-design.md)

---

## Phase 0 — Project scaffolding

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `postcss.config.mjs`, `tailwind.config.ts`

- [ ] **Step 1: Run create-next-app in current directory**

```bash
cd /home/magical/Coding/assignment
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-pnpm --turbopack --skip-install --yes
```

If create-next-app refuses non-empty dir, move existing files first:

```bash
mkdir -p .scaffold-stash && mv README.md .gitignore docs .scaffold-stash/
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-pnpm --turbopack --skip-install --yes
mv .scaffold-stash/README.md .scaffold-stash/.gitignore .scaffold-stash/docs ./
# merge .gitignore lines from scaffold output if needed
rm -rf .scaffold-stash
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 3: Verify dev server boots**

```bash
pnpm dev &
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```

Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app"
```

---

### Task 2: Add runtime dependencies

**Files:** `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add zustand @tanstack/react-query @supabase/supabase-js @supabase/ssr clsx tailwind-merge lucide-react
```

- [ ] **Step 2: Install dev deps (test stack + shadcn deps)**

```bash
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/node @types/react happy-dom
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install runtime + test dependencies"
```

---

### Task 3: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 2: Write `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest runs (zero tests = exit 0)**

```bash
pnpm test
```

Expected: `No test files found` is acceptable; exit code 0.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json
git commit -m "chore: configure vitest"
```

---

### Task 4: Initialize shadcn/ui

**Files:** `components.json`, `lib/utils.ts`, plus shadcn-installed components.

- [ ] **Step 1: Run shadcn init**

```bash
pnpm dlx shadcn@latest init -d --yes
```

Defaults: New York style, neutral base, CSS vars yes.

- [ ] **Step 2: Install components used by the app**

```bash
pnpm dlx shadcn@latest add button dialog input label tooltip scroll-area separator -y
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: init shadcn/ui + add components"
```

---

## Phase 1 — Supabase database

### Task 5: Initialize Supabase project files

**Files:** `supabase/config.toml`, `supabase/migrations/`

- [ ] **Step 1: Install Supabase CLI locally**

```bash
pnpm add -D supabase
```

- [ ] **Step 2: Init Supabase**

```bash
pnpm supabase init
```

When prompted about VS Code Deno, answer N.

- [ ] **Step 3: Verify config exists**

```bash
test -f supabase/config.toml && echo OK
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "chore: init supabase project"
```

---

### Task 6: Schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Write `supabase/migrations/0001_init.sql`**

```sql
-- Players: 1 row per anonymous-auth user, with display name + color.
create table public.players (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null check (length(name) between 1 and 24),
  color           text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  last_capture_at timestamptz,
  created_at      timestamptz not null default now()
);

-- Big tiles: 100 rare 5x5 reward tile anchors. Pre-seeded once.
create table public.big_tiles (
  x int not null check (x between 0 and 95),
  y int not null check (y between 0 and 95),
  primary key (x, y)
);

-- Tiles: sparse — only currently-or-recently-captured tiles exist.
create table public.tiles (
  id          text primary key,
  kind        text not null check (kind in ('small','big')),
  x           int not null check (x between 0 and 99),
  y           int not null check (y between 0 and 99),
  owner_id    uuid not null references public.players(id) on delete cascade,
  captured_at timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index tiles_owner_idx on public.tiles(owner_id);
create index tiles_expires_idx on public.tiles(expires_at);

-- Captures: immutable log used for hot-streak + recent-feed.
create table public.captures (
  id          bigserial primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  tile_id     text not null,
  kind        text not null check (kind in ('small','big')),
  captured_at timestamptz not null default now()
);
create index captures_player_idx on public.captures(player_id, captured_at desc);
create index captures_recent_idx on public.captures(captured_at desc);

-- RLS
alter table public.players  enable row level security;
alter table public.big_tiles enable row level security;
alter table public.tiles    enable row level security;
alter table public.captures enable row level security;

-- Public read on everything.
create policy players_select  on public.players  for select using (true);
create policy bigtiles_select on public.big_tiles for select using (true);
create policy tiles_select    on public.tiles    for select using (true);
create policy captures_select on public.captures for select using (true);

-- Self-upsert on players (own row only).
create policy players_self_insert on public.players for insert
  with check (auth.uid() = id);
create policy players_self_update on public.players for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- No direct writes to tiles/captures from clients. Only the RPC.
-- (Default-deny: no policy means no access.)

-- Realtime publication (Supabase auto-creates `supabase_realtime`).
alter publication supabase_realtime add table public.tiles;
alter publication supabase_realtime add table public.captures;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): initial schema + RLS"
```

---

### Task 7: Capture RPC migration

**Files:**
- Create: `supabase/migrations/0002_capture_rpc.sql`

- [ ] **Step 1: Write `supabase/migrations/0002_capture_rpc.sql`**

```sql
-- Result type for capture_tile.
create type public.capture_result as (
  ok      boolean,
  reason  text,
  tile    json
);

-- parse_tile_id('s:34,71') -> ('small', 34, 71)
-- parse_tile_id('b:10,10') -> ('big',   10, 10)  iff (10,10) is in big_tiles
-- Returns NULLs on invalid input.
create or replace function public.parse_tile_id(p_id text)
returns table(kind text, x int, y int)
language plpgsql immutable as $$
declare
  v_kind char;
  v_x int;
  v_y int;
  v_match text[];
begin
  v_match := regexp_match(p_id, '^([sb]):(\d{1,2}),(\d{1,2})$');
  if v_match is null then return; end if;
  v_kind := v_match[1];
  v_x := v_match[2]::int;
  v_y := v_match[3]::int;

  if v_x < 0 or v_x > 99 or v_y < 0 or v_y > 99 then return; end if;

  if v_kind = 's' then
    -- small must NOT fall inside any big-tile footprint
    if exists (
      select 1 from public.big_tiles b
      where v_x between b.x and b.x + 4
        and v_y between b.y and b.y + 4
    ) then return; end if;
    return query select 'small'::text, v_x, v_y;
  else
    -- big anchor must exist; footprint must fit in 100x100
    if v_x > 95 or v_y > 95 then return; end if;
    if not exists (
      select 1 from public.big_tiles where x = v_x and y = v_y
    ) then return; end if;
    return query select 'big'::text, v_x, v_y;
  end if;
end $$;

-- The single mutation entry point. SECURITY DEFINER lets it bypass the
-- default-deny RLS on tiles/captures while still enforcing identity via
-- auth.uid() at the top of the function.
create or replace function public.capture_tile(p_tile_id text)
returns public.capture_result
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_kind      text;
  v_x int; v_y int;
  v_last      timestamptz;
  v_existing  public.tiles%rowtype;
  v_result    public.capture_result;
begin
  if v_uid is null then
    return row(false, 'unauthenticated', null)::public.capture_result;
  end if;

  -- 1. parse + validate
  select kind, x, y into v_kind, v_x, v_y from public.parse_tile_id(p_tile_id);
  if v_kind is null then
    return row(false, 'invalid_tile', null)::public.capture_result;
  end if;

  -- 2. cooldown (lock player row first)
  select last_capture_at into v_last
    from public.players where id = v_uid for update;
  if not found then
    return row(false, 'no_player', null)::public.capture_result;
  end if;
  if v_last is not null and now() - v_last < interval '10 seconds' then
    return row(false, 'cooldown', null)::public.capture_result;
  end if;

  -- 3. lock target tile row (if any)
  select * into v_existing from public.tiles where id = p_tile_id for update;

  -- 4. lock check
  if found and v_existing.expires_at > now() then
    return row(false, 'locked', row_to_json(v_existing))::public.capture_result;
  end if;

  -- 5. write
  insert into public.tiles (id, kind, x, y, owner_id, captured_at, expires_at)
  values (p_tile_id, v_kind, v_x, v_y, v_uid, now(), now() + interval '7 days')
  on conflict (id) do update
    set owner_id = excluded.owner_id,
        captured_at = excluded.captured_at,
        expires_at = excluded.expires_at;

  -- 6. bookkeeping
  update public.players set last_capture_at = now() where id = v_uid;
  insert into public.captures (player_id, tile_id, kind)
    values (v_uid, p_tile_id, v_kind);

  select row(true, null, row_to_json(t))::public.capture_result
    into v_result
    from public.tiles t where t.id = p_tile_id;
  return v_result;
end $$;

revoke all on function public.capture_tile(text) from public;
grant execute on function public.capture_tile(text) to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0002_capture_rpc.sql
git commit -m "feat(db): capture_tile RPC with row-locked conflict resolution"
```

---

### Task 8: Big-tile seed migration

**Files:**
- Create: `supabase/migrations/0003_seed_big_tiles.sql`

- [ ] **Step 1: Write `supabase/migrations/0003_seed_big_tiles.sql`**

```sql
-- Seed 100 non-overlapping 5x5 anchor positions.
-- Deterministic: seeded random with setseed for reproducibility.
do $$
declare
  v_x int;
  v_y int;
  v_count int := 0;
  v_attempts int := 0;
begin
  perform setseed(0.42);
  while v_count < 100 and v_attempts < 5000 loop
    v_attempts := v_attempts + 1;
    v_x := floor(random() * 96)::int;  -- 0..95
    v_y := floor(random() * 96)::int;
    -- non-overlap: any existing anchor within 5 cells in either axis collides
    if not exists (
      select 1 from public.big_tiles
      where abs(x - v_x) < 5 and abs(y - v_y) < 5
    ) then
      insert into public.big_tiles (x, y) values (v_x, v_y);
      v_count := v_count + 1;
    end if;
  end loop;
  if v_count < 100 then
    raise exception 'seed_big_tiles: only placed % of 100 anchors', v_count;
  end if;
end $$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0003_seed_big_tiles.sql
git commit -m "feat(db): seed 100 big-tile anchors"
```

---

### Task 9: Cleanup cron migration

**Files:**
- Create: `supabase/migrations/0004_cleanup_cron.sql`

- [ ] **Step 1: Write `supabase/migrations/0004_cleanup_cron.sql`**

```sql
-- pg_cron is preinstalled on Supabase; enable if not already.
create extension if not exists pg_cron with schema extensions;

-- Sweep expired tiles every 60 seconds. Deletes flow through Postgres
-- Changes -> Supabase Realtime -> all clients fade the freed tiles out.
select cron.schedule(
  'expire_tiles',
  '* * * * *',
  $$ delete from public.tiles where expires_at < now() $$
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_cleanup_cron.sql
git commit -m "feat(db): pg_cron sweeper for expired tiles"
```

---

### Task 10: Spin up local Supabase + apply migrations

**Files:** none (verification step)

- [ ] **Step 1: Start local Supabase stack**

```bash
pnpm supabase start
```

(First run takes a few minutes — pulls Docker images.)

- [ ] **Step 2: Apply migrations**

```bash
pnpm supabase db reset
```

- [ ] **Step 3: Verify big_tiles seeded to 100 rows**

```bash
pnpm supabase db query "select count(*) from public.big_tiles"
```

Expected: `100`

- [ ] **Step 4: Capture URL + anon key for `.env.local`**

```bash
pnpm supabase status > /tmp/sbstatus.txt
cat /tmp/sbstatus.txt | grep -E 'API URL|anon key|service_role key'
```

Note the values; next task uses them.

---

### Task 11: Wire env vars

**Files:**
- Create: `.env.local`, `.env.local.example`

- [ ] **Step 1: Write `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Write `.env.local` with values from Task 10 step 4**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key>
```

- [ ] **Step 3: Verify .env.local is gitignored**

```bash
git check-ignore .env.local && echo IGNORED
```

Expected: `IGNORED` (and `.env.local`)

- [ ] **Step 4: Commit example only**

```bash
git add .env.local.example
git commit -m "chore: env var template"
```

---

## Phase 2 — Pure helpers (TDD)

### Task 12: Tile-id helpers

**Files:**
- Create: `lib/grid/tile-id.ts`
- Test: `tests/grid/tile-id.test.ts`

- [ ] **Step 1: Write the failing test `tests/grid/tile-id.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatTileId, parseTileId, smallTileId, bigTileId } from '@/lib/grid/tile-id';

describe('tile-id', () => {
  it('formats small + big ids', () => {
    expect(smallTileId(34, 71)).toBe('s:34,71');
    expect(bigTileId(10, 10)).toBe('b:10,10');
    expect(formatTileId({ kind: 'small', x: 0, y: 0 })).toBe('s:0,0');
  });

  it('parses valid ids', () => {
    expect(parseTileId('s:34,71')).toEqual({ kind: 'small', x: 34, y: 71 });
    expect(parseTileId('b:10,10')).toEqual({ kind: 'big', x: 10, y: 10 });
  });

  it('rejects bad ids', () => {
    expect(parseTileId('')).toBeNull();
    expect(parseTileId('x:1,1')).toBeNull();
    expect(parseTileId('s:1')).toBeNull();
    expect(parseTileId('s:-1,0')).toBeNull();
    expect(parseTileId('s:100,0')).toBeNull();
    expect(parseTileId('s:1.5,2')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm test tests/grid/tile-id.test.ts
```

Expected: `Error: Cannot find module '@/lib/grid/tile-id'`

- [ ] **Step 3: Implement `lib/grid/tile-id.ts`**

```ts
export type TileKind = 'small' | 'big';
export interface TileCoord { kind: TileKind; x: number; y: number }

export function smallTileId(x: number, y: number): string {
  return `s:${x},${y}`;
}

export function bigTileId(x: number, y: number): string {
  return `b:${x},${y}`;
}

export function formatTileId(t: TileCoord): string {
  return t.kind === 'small' ? smallTileId(t.x, t.y) : bigTileId(t.x, t.y);
}

export function parseTileId(id: string): TileCoord | null {
  const m = /^([sb]):(\d{1,2}),(\d{1,2})$/.exec(id);
  if (!m) return null;
  const x = Number(m[2]);
  const y = Number(m[3]);
  if (x < 0 || x > 99 || y < 0 || y > 99) return null;
  return { kind: m[1] === 's' ? 'small' : 'big', x, y };
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm test tests/grid/tile-id.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/grid/tile-id.ts tests/grid/tile-id.test.ts
git commit -m "feat(grid): tile-id parse/format helpers"
```

---

### Task 13: Big-tile geometry helpers

**Files:**
- Create: `lib/grid/big-tiles.ts`
- Test: `tests/grid/big-tiles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildBigTileIndex, isInsideBigTile, bigTileAt } from '@/lib/grid/big-tiles';

const anchors = [
  { x: 10, y: 10 },
  { x: 50, y: 80 },
];

describe('big-tiles', () => {
  it('isInsideBigTile detects 5x5 footprint', () => {
    const idx = buildBigTileIndex(anchors);
    // anchor cell + interior cells return true
    expect(isInsideBigTile(idx, 10, 10)).toBe(true);
    expect(isInsideBigTile(idx, 14, 14)).toBe(true);
    expect(isInsideBigTile(idx, 12, 11)).toBe(true);
    // cell just outside footprint
    expect(isInsideBigTile(idx, 9, 10)).toBe(false);
    expect(isInsideBigTile(idx, 15, 14)).toBe(false);
    expect(isInsideBigTile(idx, 0, 0)).toBe(false);
  });

  it('bigTileAt returns the anchor or null', () => {
    const idx = buildBigTileIndex(anchors);
    expect(bigTileAt(idx, 12, 11)).toEqual({ x: 10, y: 10 });
    expect(bigTileAt(idx, 9, 9)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test tests/grid/big-tiles.test.ts
```

- [ ] **Step 3: Implement `lib/grid/big-tiles.ts`**

```ts
export interface BigAnchor { x: number; y: number }

export interface BigTileIndex {
  anchors: BigAnchor[];
  // For O(1) lookups during render, cells -> anchor map keyed by "x,y".
  cellToAnchor: Map<string, BigAnchor>;
}

const KEY = (x: number, y: number) => `${x},${y}`;

export function buildBigTileIndex(anchors: BigAnchor[]): BigTileIndex {
  const cellToAnchor = new Map<string, BigAnchor>();
  for (const a of anchors) {
    for (let dx = 0; dx < 5; dx++) {
      for (let dy = 0; dy < 5; dy++) {
        cellToAnchor.set(KEY(a.x + dx, a.y + dy), a);
      }
    }
  }
  return { anchors, cellToAnchor };
}

export function isInsideBigTile(idx: BigTileIndex, x: number, y: number): boolean {
  return idx.cellToAnchor.has(KEY(x, y));
}

export function bigTileAt(idx: BigTileIndex, x: number, y: number): BigAnchor | null {
  return idx.cellToAnchor.get(KEY(x, y)) ?? null;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/grid/big-tiles.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/grid/big-tiles.ts tests/grid/big-tiles.test.ts
git commit -m "feat(grid): big-tile geometry helpers"
```

---

### Task 14: Camera (pan + zoom math)

**Files:**
- Create: `lib/grid/camera.ts`
- Test: `tests/grid/camera.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createCamera, pan, zoomAt, screenToWorld, worldToScreen, clampCamera } from '@/lib/grid/camera';

describe('camera', () => {
  it('round-trips screen<->world', () => {
    const cam = createCamera({ zoom: 2, x: 100, y: 50 });
    const w = screenToWorld(cam, 300, 200);
    const s = worldToScreen(cam, w.x, w.y);
    expect(s.x).toBeCloseTo(300);
    expect(s.y).toBeCloseTo(200);
  });

  it('zoomAt anchors on cursor', () => {
    const cam = createCamera({ zoom: 1, x: 0, y: 0 });
    const before = screenToWorld(cam, 200, 100);
    const next = zoomAt(cam, 200, 100, 2);
    const after = screenToWorld(next, 200, 100);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(next.zoom).toBe(2);
  });

  it('pan translates camera', () => {
    const cam = createCamera({ zoom: 1, x: 10, y: 20 });
    const next = pan(cam, 5, -3);
    expect(next.x).toBe(15);
    expect(next.y).toBe(17);
  });

  it('clampCamera enforces zoom + world bounds', () => {
    const cam = createCamera({ zoom: 0.1, x: -1e6, y: 1e6 });
    const c = clampCamera(cam, { worldPx: 1000, viewportW: 800, viewportH: 600 });
    expect(c.zoom).toBeGreaterThanOrEqual(0.5);
    expect(c.zoom).toBeLessThanOrEqual(8);
    // x must keep some world visible
    expect(c.x).toBeGreaterThanOrEqual(-1000);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test tests/grid/camera.test.ts
```

- [ ] **Step 3: Implement `lib/grid/camera.ts`**

```ts
export interface Camera {
  zoom: number;
  x: number;       // world coord at screen origin
  y: number;
}

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 8;

export function createCamera(c: Camera): Camera {
  return { zoom: c.zoom, x: c.x, y: c.y };
}

export function pan(c: Camera, dx: number, dy: number): Camera {
  return { ...c, x: c.x + dx, y: c.y + dy };
}

export function screenToWorld(c: Camera, sx: number, sy: number): { x: number; y: number } {
  return { x: c.x + sx / c.zoom, y: c.y + sy / c.zoom };
}

export function worldToScreen(c: Camera, wx: number, wy: number): { x: number; y: number } {
  return { x: (wx - c.x) * c.zoom, y: (wy - c.y) * c.zoom };
}

export function zoomAt(c: Camera, sx: number, sy: number, nextZoom: number): Camera {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
  // Keep world point under cursor stationary on screen.
  const w = screenToWorld(c, sx, sy);
  return { zoom: z, x: w.x - sx / z, y: w.y - sy / z };
}

export interface ClampInput { worldPx: number; viewportW: number; viewportH: number }

export function clampCamera(c: Camera, b: ClampInput): Camera {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, c.zoom));
  // Allow scrolling so that some part of world stays visible.
  const margin = 200 / z;
  const x = Math.min(b.worldPx + margin, Math.max(-margin, c.x));
  const y = Math.min(b.worldPx + margin, Math.max(-margin, c.y));
  return { zoom: z, x, y };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/grid/camera.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/grid/camera.ts tests/grid/camera.test.ts
git commit -m "feat(grid): camera pan/zoom math"
```

---

### Task 15: Color palette helper

**Files:**
- Create: `lib/colors.ts`
- Test: `tests/colors.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { randomPlayerColor, isValidHexColor, scoreColor } from '@/lib/colors';

describe('colors', () => {
  it('isValidHexColor', () => {
    expect(isValidHexColor('#abcdef')).toBe(true);
    expect(isValidHexColor('#ABC')).toBe(false);
    expect(isValidHexColor('abcdef')).toBe(false);
  });

  it('randomPlayerColor returns hex', () => {
    for (let i = 0; i < 50; i++) {
      const c = randomPlayerColor();
      expect(isValidHexColor(c)).toBe(true);
    }
  });

  it('scoreColor maps 0..1 -> green..gold', () => {
    expect(isValidHexColor(scoreColor(0))).toBe(true);
    expect(isValidHexColor(scoreColor(1))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test tests/colors.test.ts
```

- [ ] **Step 3: Implement `lib/colors.ts`**

```ts
export function isValidHexColor(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

function hslToHex(h: number, s: number, l: number): string {
  // h: 0..360, s/l: 0..1
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (0 <= hp && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to255 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

export function randomPlayerColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 0.78, 0.55);
}

export function scoreColor(t: number): string {
  // 0 -> green (140), 1 -> gold (45)
  const clamped = Math.max(0, Math.min(1, t));
  const hue = 140 - clamped * 95;
  return hslToHex(hue, 0.7, 0.5);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/colors.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/colors.ts tests/colors.test.ts
git commit -m "feat: color palette helpers"
```

---

## Phase 3 — Supabase client + auth

### Task 16: Supabase client factories

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/types/db.ts`

- [ ] **Step 1: Write `lib/types/db.ts`**

```ts
export interface PlayerRow {
  id: string;
  name: string;
  color: string;
  last_capture_at: string | null;
  created_at: string;
}

export interface BigTileRow { x: number; y: number }

export interface TileRow {
  id: string;
  kind: 'small' | 'big';
  x: number;
  y: number;
  owner_id: string;
  captured_at: string;
  expires_at: string;
}

export interface CaptureRow {
  id: number;
  player_id: string;
  tile_id: string;
  kind: 'small' | 'big';
  captured_at: string;
}

export interface CaptureResult {
  ok: boolean;
  reason: string | null;
  tile: TileRow | null;
}
```

- [ ] **Step 2: Write `lib/supabase/client.ts`**

```ts
'use client';
import { createBrowserClient } from '@supabase/ssr';

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}
```

- [ ] **Step 3: Write `lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(items) {
          for (const c of items) cookieStore.set(c.name, c.value, c.options);
        },
      },
    },
  );
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types/db.ts lib/supabase/
git commit -m "feat: supabase client factories + db types"
```

---

### Task 17: Anonymous-auth bootstrap hook

**Files:**
- Create: `lib/hooks/use-anon-auth.ts`

- [ ] **Step 1: Write `lib/hooks/use-anon-auth.ts`**

```ts
'use client';
import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export type AuthState =
  | { status: 'loading' }
  | { status: 'ready'; userId: string }
  | { status: 'error'; error: string };

export function useAnonAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const sb = getSupabaseBrowser();
    let cancelled = false;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        if (!cancelled) setState({ status: 'ready', userId: session.user.id });
        return;
      }
      const { data, error } = await sb.auth.signInAnonymously();
      if (cancelled) return;
      if (error || !data.user) {
        setState({ status: 'error', error: error?.message ?? 'auth_failed' });
      } else {
        setState({ status: 'ready', userId: data.user.id });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/use-anon-auth.ts
git commit -m "feat(auth): anonymous-auth bootstrap hook"
```

---

### Task 18: Player upsert helper

**Files:**
- Create: `lib/api/players.ts`

- [ ] **Step 1: Write `lib/api/players.ts`**

```ts
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { PlayerRow } from '@/lib/types/db';

export async function fetchMyPlayer(userId: string): Promise<PlayerRow | null> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('players')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertMyPlayer(input: {
  id: string; name: string; color: string;
}): Promise<PlayerRow> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('players')
    .upsert({ id: input.id, name: input.name, color: input.color }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPlayersByIds(ids: string[]): Promise<PlayerRow[]> {
  if (ids.length === 0) return [];
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('players')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/api/players.ts
git commit -m "feat(api): player fetch/upsert helpers"
```

---

### Task 19: Tiles + captures fetchers + RPC

**Files:**
- Create: `lib/api/tiles.ts`, `lib/api/captures.ts`

- [ ] **Step 1: Write `lib/api/tiles.ts`**

```ts
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { BigTileRow, CaptureResult, TileRow } from '@/lib/types/db';

export async function fetchAllTiles(): Promise<TileRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from('tiles').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function fetchBigTiles(): Promise<BigTileRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.from('big_tiles').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function captureTile(tileId: string): Promise<CaptureResult> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc('capture_tile', { p_tile_id: tileId });
  if (error) throw error;
  return data as unknown as CaptureResult;
}
```

- [ ] **Step 2: Write `lib/api/captures.ts`**

```ts
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { CaptureRow } from '@/lib/types/db';

export async function fetchRecentCaptures(limit = 30): Promise<CaptureRow[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('captures')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchHotStreak(sinceIso: string): Promise<{ player_id: string; n: number }[]> {
  // Aggregate captures in the last hour per player.
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from('captures')
    .select('player_id')
    .gte('captured_at', sinceIso);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.player_id, (counts.get(r.player_id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([player_id, n]) => ({ player_id, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/api/
git commit -m "feat(api): tiles/captures fetchers + capture RPC client"
```

---

## Phase 4 — Capture RPC integration test

### Task 20: Two-client contention test

**Files:**
- Create: `tests/integration/capture.test.ts`

This is the load-bearing test that proves conflict resolution works.

- [ ] **Step 1: Ensure local Supabase is running**

```bash
pnpm supabase status | head -3
```

If not running: `pnpm supabase start`

- [ ] **Step 2: Write `tests/integration/capture.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function newPlayer(name: string): Promise<SupabaseClient> {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error('no user');
  await sb.from('players').upsert({
    id: data.user.id,
    name,
    color: '#abcdef',
  });
  return sb;
}

async function rpc(sb: SupabaseClient, tileId: string) {
  const { data, error } = await sb.rpc('capture_tile', { p_tile_id: tileId });
  if (error) throw error;
  return data as { ok: boolean; reason: string | null; tile: any };
}

describe('capture_tile contention', () => {
  beforeAll(() => {
    if (!URL || !ANON) throw new Error('Set NEXT_PUBLIC_SUPABASE_* in env');
  });

  it('only one of two parallel captures of the same tile wins', async () => {
    const a = await newPlayer('alice-' + Date.now());
    const b = await newPlayer('bob-' + Date.now());
    const tileId = `s:${1 + Math.floor(Math.random() * 90)},${1 + Math.floor(Math.random() * 90)}`;

    const [ra, rb] = await Promise.all([rpc(a, tileId), rpc(b, tileId)]);
    const oks = [ra, rb].filter(r => r.ok).length;
    const locks = [ra, rb].filter(r => !r.ok && r.reason === 'locked').length;
    expect(oks).toBe(1);
    expect(locks).toBe(1);
  }, 15_000);

  it('cooldown rejects second capture by same user within 10s', async () => {
    const a = await newPlayer('cool-' + Date.now());
    const t1 = `s:50,50`;
    const t2 = `s:51,50`;
    const r1 = await rpc(a, t1);
    expect(r1.ok).toBe(true);
    const r2 = await rpc(a, t2);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe('cooldown');
  }, 15_000);
});
```

- [ ] **Step 3: Add a separate `vitest.integration.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globals: true,
    testTimeout: 20_000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 4: Add npm script to `package.json`**

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 5: Run integration tests**

```bash
set -a; source .env.local; set +a
pnpm test:integration
```

Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/ vitest.integration.config.ts package.json
git commit -m "test(db): capture RPC contention + cooldown"
```

---

## Phase 5 — Client store + realtime

### Task 21: Zustand store

**Files:**
- Create: `lib/store.ts`

- [ ] **Step 1: Write `lib/store.ts`**

```ts
'use client';
import { create } from 'zustand';
import type { BigTileRow, PlayerRow, TileRow } from '@/lib/types/db';
import type { Camera } from '@/lib/grid/camera';
import { buildBigTileIndex, type BigTileIndex } from '@/lib/grid/big-tiles';

export interface PresencePeer { id: string; name: string; color: string }

export interface FlashEntry { tileId: string; until: number }

interface State {
  // identity
  userId: string | null;
  me: PlayerRow | null;

  // world
  bigIndex: BigTileIndex;
  tiles: Map<string, TileRow>;        // tileId -> row
  players: Map<string, PlayerRow>;    // playerId -> row

  // realtime
  online: PresencePeer[];

  // ui
  camera: Camera;
  cooldownUntil: number | null;       // Date.now() ms when cooldown ends
  flashes: FlashEntry[];              // recent capture flashes

  // mutators
  setIdentity(userId: string, me: PlayerRow | null): void;
  setBigTiles(rows: BigTileRow[]): void;
  setInitialTiles(rows: TileRow[]): void;
  upsertTile(row: TileRow): void;
  removeTile(tileId: string): void;
  setPlayers(rows: PlayerRow[]): void;
  setOnline(peers: PresencePeer[]): void;
  setCamera(c: Camera): void;
  startCooldown(seconds: number): void;
  pushFlash(tileId: string, ms: number): void;
}

export const useStore = create<State>((set) => ({
  userId: null,
  me: null,
  bigIndex: buildBigTileIndex([]),
  tiles: new Map(),
  players: new Map(),
  online: [],
  camera: { zoom: 1, x: 0, y: 0 },
  cooldownUntil: null,
  flashes: [],

  setIdentity: (userId, me) => set({ userId, me }),
  setBigTiles: (rows) => set({ bigIndex: buildBigTileIndex(rows) }),
  setInitialTiles: (rows) => set({ tiles: new Map(rows.map(r => [r.id, r])) }),
  upsertTile: (row) => set(s => {
    const next = new Map(s.tiles);
    next.set(row.id, row);
    return { tiles: next };
  }),
  removeTile: (tileId) => set(s => {
    const next = new Map(s.tiles);
    next.delete(tileId);
    return { tiles: next };
  }),
  setPlayers: (rows) => set(s => {
    const next = new Map(s.players);
    for (const r of rows) next.set(r.id, r);
    return { players: next };
  }),
  setOnline: (peers) => set({ online: peers }),
  setCamera: (camera) => set({ camera }),
  startCooldown: (seconds) => set({ cooldownUntil: Date.now() + seconds * 1000 }),
  pushFlash: (tileId, ms) => set(s => ({
    flashes: [...s.flashes.filter(f => f.until > Date.now()), { tileId, until: Date.now() + ms }],
  })),
}));
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/store.ts
git commit -m "feat(state): zustand store"
```

---

### Task 22: Realtime channels

**Files:**
- Create: `lib/realtime.ts`

- [ ] **Step 1: Write `lib/realtime.ts`**

```ts
'use client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { fetchAllTiles, fetchBigTiles } from '@/lib/api/tiles';
import { fetchPlayersByIds } from '@/lib/api/players';
import type { TileRow } from '@/lib/types/db';

export interface RealtimeHandle {
  stop(): void;
}

export async function startRealtime(opts: {
  me: { id: string; name: string; color: string };
  onCaptureBroadcast?: (msg: { playerId: string; tileId: string; kind: 'small'|'big' }) => void;
}): Promise<RealtimeHandle> {
  const sb = getSupabaseBrowser();
  const store = useStore.getState();

  // 1. initial REST loads
  const [bigs, tiles] = await Promise.all([fetchBigTiles(), fetchAllTiles()]);
  store.setBigTiles(bigs);
  store.setInitialTiles(tiles);
  const ownerIds = [...new Set(tiles.map(t => t.owner_id))];
  if (ownerIds.length) {
    const players = await fetchPlayersByIds(ownerIds);
    store.setPlayers(players);
  }

  // 2. Channel A — Postgres Changes on tiles
  const chA: RealtimeChannel = sb
    .channel('tiles-changes')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tiles' },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<TileRow>).id;
            if (oldId) useStore.getState().removeTile(oldId);
          } else {
            const row = payload.new as TileRow;
            useStore.getState().upsertTile(row);
            useStore.getState().pushFlash(row.id, 220);
            // hydrate player if unknown
            if (!useStore.getState().players.get(row.owner_id)) {
              const players = await fetchPlayersByIds([row.owner_id]);
              useStore.getState().setPlayers(players);
            }
          }
        })
    .subscribe();

  // 3. Channel B — presence + capture broadcast
  const chB: RealtimeChannel = sb
    .channel('world', { config: { presence: { key: opts.me.id } } })
    .on('presence', { event: 'sync' }, () => {
      const state = chB.presenceState() as Record<string, Array<{ id: string; name: string; color: string }>>;
      const peers = Object.values(state).flat().map(p => ({ id: p.id, name: p.name, color: p.color }));
      useStore.getState().setOnline(peers);
    })
    .on('broadcast', { event: 'capture' }, (msg) => {
      const payload = msg.payload as { playerId: string; tileId: string; kind: 'small'|'big' };
      opts.onCaptureBroadcast?.(payload);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await chB.track({ id: opts.me.id, name: opts.me.name, color: opts.me.color });
      }
    });

  // 4. reconnect: refetch full snapshot once, on each reconnection
  const onOnline = async () => {
    const [bigs2, tiles2] = await Promise.all([fetchBigTiles(), fetchAllTiles()]);
    useStore.getState().setBigTiles(bigs2);
    useStore.getState().setInitialTiles(tiles2);
  };
  window.addEventListener('online', onOnline);

  return {
    stop: () => {
      window.removeEventListener('online', onOnline);
      sb.removeChannel(chA);
      sb.removeChannel(chB);
    },
  };
}

export function broadcastCapture(payload: { playerId: string; tileId: string; kind: 'small'|'big' }) {
  const sb = getSupabaseBrowser();
  const ch = sb.channel('world');
  ch.send({ type: 'broadcast', event: 'capture', payload });
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/realtime.ts
git commit -m "feat(realtime): two-channel wiring"
```

---

## Phase 6 — Renderer

### Task 23: Renderer module

**Files:**
- Create: `lib/grid/renderer.ts`

The render module is pure functions; the React component wires it next.

- [ ] **Step 1: Write `lib/grid/renderer.ts`**

```ts
import type { Camera } from './camera';
import { worldToScreen } from './camera';
import type { TileRow } from '@/lib/types/db';
import type { PlayerRow } from '@/lib/types/db';
import type { BigTileIndex } from './big-tiles';

export const TILE_PX = 16;
export const WORLD_CELLS = 100;
export const WORLD_PX = TILE_PX * WORLD_CELLS;

export interface PaintInput {
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  viewport: { w: number; h: number };
  bigIndex: BigTileIndex;
  tiles: Map<string, TileRow>;
  players: Map<string, PlayerRow>;
  flashes: Map<string, number>; // tileId -> until ms
  hovered: { x: number; y: number } | null;
}

const BG = '#0a0a0c';
const GRID = '#15161a';
const UNCLAIMED = '#1e1f25';
const BIG_BORDER = 'rgba(255, 215, 0, 0.55)';

export function paint(input: PaintInput) {
  const { ctx, camera, viewport, bigIndex, tiles, players, flashes, hovered } = input;
  ctx.save();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, viewport.w, viewport.h);

  // determine visible cell range
  const tlWorld = { x: camera.x, y: camera.y };
  const brWorld = { x: camera.x + viewport.w / camera.zoom, y: camera.y + viewport.h / camera.zoom };
  const cellPx = TILE_PX * camera.zoom;
  const x0 = Math.max(0, Math.floor(tlWorld.x / TILE_PX) - 1);
  const y0 = Math.max(0, Math.floor(tlWorld.y / TILE_PX) - 1);
  const x1 = Math.min(WORLD_CELLS - 1, Math.ceil(brWorld.x / TILE_PX) + 1);
  const y1 = Math.min(WORLD_CELLS - 1, Math.ceil(brWorld.y / TILE_PX) + 1);

  // 1. paint cells (skip cells inside big-tile footprints; we paint big tiles separately)
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      if (bigIndex.cellToAnchor.has(`${cx},${cy}`)) continue;
      const id = `s:${cx},${cy}`;
      const t = tiles.get(id);
      const screen = worldToScreen(camera, cx * TILE_PX, cy * TILE_PX);
      ctx.fillStyle = t ? colorFor(t, players) : UNCLAIMED;
      ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
      // flash overlay
      const f = flashes.get(id);
      if (f && f > Date.now()) {
        const a = (f - Date.now()) / 220;
        ctx.fillStyle = `rgba(255,255,255,${0.55 * a})`;
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
      }
    }
  }

  // 2. paint big tiles (5x5 footprint each)
  for (const a of bigIndex.anchors) {
    if (a.x + 5 < x0 || a.x > x1 || a.y + 5 < y0 || a.y > y1) continue;
    const id = `b:${a.x},${a.y}`;
    const t = tiles.get(id);
    const screen = worldToScreen(camera, a.x * TILE_PX, a.y * TILE_PX);
    const size = cellPx * 5;
    ctx.fillStyle = t ? colorFor(t, players) : '#26211a';
    ctx.fillRect(screen.x, screen.y, size, size);
    ctx.strokeStyle = BIG_BORDER;
    ctx.lineWidth = Math.max(1, camera.zoom);
    ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, size - 1, size - 1);
    const f = flashes.get(id);
    if (f && f > Date.now()) {
      const a2 = (f - Date.now()) / 220;
      ctx.fillStyle = `rgba(255,255,255,${0.55 * a2})`;
      ctx.fillRect(screen.x, screen.y, size, size);
    }
  }

  // 3. hover ring
  if (hovered) {
    const screen = worldToScreen(camera, hovered.x * TILE_PX, hovered.y * TILE_PX);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(screen.x + 1, screen.y + 1, cellPx - 2, cellPx - 2);
  }

  // 4. grid hairlines (only at zoom >= 1.5)
  if (camera.zoom >= 1.5) {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let cx = x0; cx <= x1 + 1; cx++) {
      const sx = (cx * TILE_PX - camera.x) * camera.zoom;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, viewport.h);
    }
    for (let cy = y0; cy <= y1 + 1; cy++) {
      const sy = (cy * TILE_PX - camera.y) * camera.zoom;
      ctx.moveTo(0, sy); ctx.lineTo(viewport.w, sy);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function colorFor(t: TileRow, players: Map<string, PlayerRow>): string {
  return players.get(t.owner_id)?.color ?? '#6b7280';
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/grid/renderer.ts
git commit -m "feat(renderer): canvas paint with viewport culling"
```

---

### Task 24: Grid canvas component

**Files:**
- Create: `app/_components/grid-canvas.tsx`

- [ ] **Step 1: Write `app/_components/grid-canvas.tsx`**

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { paint, TILE_PX, WORLD_PX } from '@/lib/grid/renderer';
import { clampCamera, pan, zoomAt } from '@/lib/grid/camera';
import { isInsideBigTile, bigTileAt } from '@/lib/grid/big-tiles';
import { captureTile } from '@/lib/api/tiles';
import { broadcastCapture } from '@/lib/realtime';

interface Props { onCaptureRejected?: (reason: string) => void }

export function GridCanvas({ onCaptureRejected }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ x: number; y: number; moved: number; startedAt: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    const ro = new ResizeObserver(() => {
      const rect = containerRef.current!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    ro.observe(containerRef.current!);

    const loop = () => {
      const s = useStore.getState();
      const rect = containerRef.current!.getBoundingClientRect();
      const flashMap = new Map(s.flashes.map(f => [f.tileId, f.until]));
      paint({
        ctx,
        camera: s.camera,
        viewport: { w: rect.width, h: rect.height },
        bigIndex: s.bigIndex,
        tiles: s.tiles,
        players: s.players,
        flashes: flashMap,
        hovered: hoverRef.current,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  function clientToCell(ev: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = ev.clientX - rect.left;
    const sy = ev.clientY - rect.top;
    const { camera } = useStore.getState();
    const wx = camera.x + sx / camera.zoom;
    const wy = camera.y + sy / camera.zoom;
    const cx = Math.floor(wx / TILE_PX);
    const cy = Math.floor(wy / TILE_PX);
    if (cx < 0 || cy < 0 || cx > 99 || cy > 99) return null;
    return { x: cx, y: cy, sx, sy };
  }

  async function handleClick(cellX: number, cellY: number) {
    const s = useStore.getState();
    if (s.cooldownUntil && Date.now() < s.cooldownUntil) {
      onCaptureRejected?.('cooldown');
      return;
    }
    const big = bigTileAt(s.bigIndex, cellX, cellY);
    const tileId = big ? `b:${big.x},${big.y}` : `s:${cellX},${cellY}`;
    // optimistic
    const myColor = s.me?.color ?? '#888';
    const optimistic = {
      id: tileId,
      kind: big ? 'big' as const : 'small' as const,
      x: big?.x ?? cellX,
      y: big?.y ?? cellY,
      owner_id: s.userId ?? '',
      captured_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    };
    const prev = s.tiles.get(tileId);
    s.upsertTile(optimistic);
    s.pushFlash(tileId, 220);

    const res = await captureTile(tileId).catch((e) => ({ ok: false, reason: 'network', tile: null, error: e }));
    if (!res.ok) {
      // revert
      const after = useStore.getState();
      if (prev) after.upsertTile(prev); else after.removeTile(tileId);
      onCaptureRejected?.(res.reason ?? 'unknown');
      return;
    }
    if (res.tile) {
      useStore.getState().upsertTile(res.tile);
    }
    useStore.getState().startCooldown(10);
    if (s.userId && s.me) {
      broadcastCapture({ playerId: s.userId, tileId, kind: optimistic.kind });
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-neutral-950 select-none">
      <canvas
        ref={canvasRef}
        className="block touch-none"
        onMouseDown={(e) => {
          draggingRef.current = { x: e.clientX, y: e.clientY, moved: 0, startedAt: Date.now() };
        }}
        onMouseMove={(e) => {
          const cell = clientToCell(e);
          hoverRef.current = cell ? { x: cell.x, y: cell.y } : null;
          const d = draggingRef.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          d.moved += Math.abs(dx) + Math.abs(dy);
          d.x = e.clientX; d.y = e.clientY;
          const s = useStore.getState();
          const next = pan(s.camera, -dx / s.camera.zoom, -dy / s.camera.zoom);
          s.setCamera(clampCamera(next, { worldPx: WORLD_PX, viewportW: 0, viewportH: 0 }));
        }}
        onMouseUp={async (e) => {
          const d = draggingRef.current;
          draggingRef.current = null;
          if (!d) return;
          const moved = d.moved;
          const dur = Date.now() - d.startedAt;
          if (moved < 4 && dur < 250) {
            const cell = clientToCell(e);
            if (cell) await handleClick(cell.x, cell.y);
          }
        }}
        onMouseLeave={() => { draggingRef.current = null; hoverRef.current = null; }}
        onWheel={(e) => {
          e.preventDefault();
          const rect = canvasRef.current!.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const s = useStore.getState();
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          const next = zoomAt(s.camera, sx, sy, s.camera.zoom * factor);
          s.setCamera(clampCamera(next, { worldPx: WORLD_PX, viewportW: 0, viewportH: 0 }));
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/_components/grid-canvas.tsx
git commit -m "feat(ui): canvas grid with pan/zoom + optimistic capture"
```

---

## Phase 7 — UI chrome

### Task 25: Identity picker modal

**Files:**
- Create: `app/_components/identity-picker.tsx`

- [ ] **Step 1: Write `app/_components/identity-picker.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { randomPlayerColor, isValidHexColor } from '@/lib/colors';

interface Props {
  open: boolean;
  onSubmit(name: string, color: string): void;
  initialName?: string;
  initialColor?: string;
}

export function IdentityPicker({ open, onSubmit, initialName = '', initialColor }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? randomPlayerColor());

  const valid = name.trim().length >= 1 && name.trim().length <= 24 && isValidHexColor(color);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pick a name + color</DialogTitle>
          <DialogDescription>Used for tiles you capture.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex items-center gap-3">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 rounded-md border bg-transparent"
              />
              <Button type="button" variant="ghost" onClick={() => setColor(randomPlayerColor())}>Random</Button>
              <span className="ml-auto h-6 w-6 rounded" style={{ background: color }} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!valid} onClick={() => onSubmit(name.trim(), color)}>Start playing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_components/identity-picker.tsx
git commit -m "feat(ui): identity picker modal"
```

---

### Task 26: Cooldown indicator

**Files:**
- Create: `app/_components/cooldown-indicator.tsx`

- [ ] **Step 1: Write `app/_components/cooldown-indicator.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

export function CooldownIndicator() {
  const cooldownUntil = useStore(s => s.cooldownUntil);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const remaining = cooldownUntil ? Math.max(0, cooldownUntil - Date.now()) : 0;
  const pct = Math.min(1, remaining / 10_000);
  const ready = remaining === 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-neutral-400">{ready ? 'Ready' : `Cooldown ${(remaining/1000).toFixed(1)}s`}</span>
      <div className="h-2 w-40 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className="h-full transition-[width] duration-100"
          style={{ width: `${(1 - pct) * 100}%`, background: ready ? '#22c55e' : '#eab308' }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_components/cooldown-indicator.tsx
git commit -m "feat(ui): cooldown indicator"
```

---

### Task 27: Topbar + presence pill

**Files:**
- Create: `app/_components/topbar.tsx`, `app/_components/presence-pill.tsx`

- [ ] **Step 1: Write `app/_components/presence-pill.tsx`**

```tsx
'use client';
import { useStore } from '@/lib/store';

export function PresencePill() {
  const online = useStore(s => s.online);
  return (
    <div className="flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-sm">
      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
      <span className="font-medium">{online.length}</span>
      <span className="text-neutral-400">online</span>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/_components/topbar.tsx`**

```tsx
'use client';
import { useStore } from '@/lib/store';
import { PresencePill } from './presence-pill';
import { CooldownIndicator } from './cooldown-indicator';

export function Topbar() {
  const me = useStore(s => s.me);
  return (
    <header className="flex items-center justify-between border-b border-neutral-900 bg-neutral-950/95 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-sm bg-gradient-to-br from-amber-400 to-rose-500" />
        <h1 className="text-sm font-semibold tracking-wide">Realtime Grid</h1>
      </div>
      <div className="flex items-center gap-4">
        <CooldownIndicator />
        <PresencePill />
        {me && (
          <div className="flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ background: me.color }} />
            <span>{me.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/_components/topbar.tsx app/_components/presence-pill.tsx
git commit -m "feat(ui): topbar + presence pill"
```

---

### Task 28: Recent captures feed

**Files:**
- Create: `app/_components/recent-feed.tsx`

- [ ] **Step 1: Write `app/_components/recent-feed.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { fetchRecentCaptures } from '@/lib/api/captures';
import { fetchPlayersByIds } from '@/lib/api/players';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FeedItem {
  id: string;
  playerName: string;
  playerColor: string;
  tileId: string;
  kind: 'small'|'big';
  ts: number;
}

const MAX = 50;

export function RecentFeed() {
  const players = useStore(s => s.players);
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchRecentCaptures(MAX);
      const ids = [...new Set(rows.map(r => r.player_id))];
      if (ids.length) {
        const ps = await fetchPlayersByIds(ids);
        useStore.getState().setPlayers(ps);
      }
      if (cancelled) return;
      setItems(rows.map(r => ({
        id: String(r.id),
        playerName: useStore.getState().players.get(r.player_id)?.name ?? '…',
        playerColor: useStore.getState().players.get(r.player_id)?.color ?? '#888',
        tileId: r.tile_id,
        kind: r.kind,
        ts: new Date(r.captured_at).getTime(),
      })));
    })();
    return () => { cancelled = true; };
  }, []);

  // append from broadcast: a tile upsert pushes a flash; we mirror it here.
  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      if (s.flashes.length === prev.flashes.length) return;
      const newest = s.flashes[s.flashes.length - 1];
      if (!newest) return;
      const t = s.tiles.get(newest.tileId);
      if (!t) return;
      const p = s.players.get(t.owner_id);
      setItems((cur) => [{
        id: `f-${newest.tileId}-${newest.until}`,
        playerName: p?.name ?? '…',
        playerColor: p?.color ?? '#888',
        tileId: t.id,
        kind: t.kind,
        ts: Date.now(),
      }, ...cur].slice(0, MAX));
    });
    return unsub;
  }, []);

  return (
    <aside className="flex h-full w-full flex-col border-r border-neutral-900 bg-neutral-950">
      <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Recent captures</h2>
      <ScrollArea className="flex-1 px-3 pb-3">
        <ul className="space-y-1 text-sm">
          {items.map(i => (
            <li key={i.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-neutral-900">
              <span className="h-2 w-2 rounded-full" style={{ background: i.playerColor }} />
              <span className="font-medium">{i.playerName}</span>
              <span className="text-neutral-400">claimed</span>
              <span className="font-mono text-xs text-neutral-300">{i.tileId}</span>
              {i.kind === 'big' && <span className="ml-auto rounded bg-amber-500/20 px-1.5 text-[10px] text-amber-300">big</span>}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_components/recent-feed.tsx
git commit -m "feat(ui): recent-captures feed"
```

---

### Task 29: Leaderboard + hot-streak

**Files:**
- Create: `app/_components/leaderboard.tsx`, `app/_components/hot-streak.tsx`

- [ ] **Step 1: Write `app/_components/leaderboard.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { useStore } from '@/lib/store';

export function Leaderboard() {
  const tiles = useStore(s => s.tiles);
  const players = useStore(s => s.players);

  const rows = useMemo(() => {
    const score = new Map<string, number>();
    for (const t of tiles.values()) {
      score.set(t.owner_id, (score.get(t.owner_id) ?? 0) + (t.kind === 'big' ? 5 : 1));
    }
    return [...score.entries()]
      .map(([id, n]) => ({ id, n, p: players.get(id) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [tiles, players]);

  return (
    <section className="border-b border-neutral-900 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Leaderboard</h2>
      <ol className="space-y-1 text-sm">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="w-5 text-right text-neutral-500">{i + 1}.</span>
            <span className="h-2 w-2 rounded-full" style={{ background: r.p?.color ?? '#888' }} />
            <span className="truncate">{r.p?.name ?? r.id.slice(0, 6)}</span>
            <span className="ml-auto font-mono text-xs">{r.n}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-neutral-500">No captures yet</li>}
      </ol>
    </section>
  );
}
```

- [ ] **Step 2: Write `app/_components/hot-streak.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { fetchHotStreak } from '@/lib/api/captures';
import { useStore } from '@/lib/store';
import { fetchPlayersByIds } from '@/lib/api/players';

export function HotStreak() {
  const players = useStore(s => s.players);
  const [rows, setRows] = useState<{ player_id: string; n: number }[]>([]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const r = await fetchHotStreak(since);
      const ids = r.map(x => x.player_id).filter(id => !useStore.getState().players.has(id));
      if (ids.length) {
        const ps = await fetchPlayersByIds(ids);
        useStore.getState().setPlayers(ps);
      }
      if (alive) setRows(r);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <section className="p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Hot streak (1h)</h2>
      <ol className="space-y-1 text-sm">
        {rows.map((r, i) => {
          const p = players.get(r.player_id);
          return (
            <li key={r.player_id} className="flex items-center gap-2">
              <span className="w-5 text-right text-neutral-500">{i + 1}.</span>
              <span className="h-2 w-2 rounded-full" style={{ background: p?.color ?? '#888' }} />
              <span className="truncate">{p?.name ?? r.player_id.slice(0, 6)}</span>
              <span className="ml-auto font-mono text-xs">{r.n}</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-neutral-500">Quiet hour</li>}
      </ol>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/_components/leaderboard.tsx app/_components/hot-streak.tsx
git commit -m "feat(ui): leaderboard + hot-streak panels"
```

---

### Task 30: Page composition

**Files:**
- Modify: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Realtime Grid',
  description: 'Claim tiles. See others claim in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAnonAuth } from '@/lib/hooks/use-anon-auth';
import { fetchMyPlayer, upsertMyPlayer } from '@/lib/api/players';
import { startRealtime } from '@/lib/realtime';
import { Topbar } from './_components/topbar';
import { RecentFeed } from './_components/recent-feed';
import { Leaderboard } from './_components/leaderboard';
import { HotStreak } from './_components/hot-streak';
import { GridCanvas } from './_components/grid-canvas';
import { IdentityPicker } from './_components/identity-picker';
import { useToast } from '@/lib/hooks/use-toast';

export default function HomePage() {
  const auth = useAnonAuth();
  const me = useStore(s => s.me);
  const setIdentity = useStore(s => s.setIdentity);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (auth.status !== 'ready') return;
    let stop: (() => void) | undefined;
    (async () => {
      const player = await fetchMyPlayer(auth.userId);
      setIdentity(auth.userId, player);
      if (!player) {
        setPickerOpen(true);
        return;
      }
      const handle = await startRealtime({ me: { id: player.id, name: player.name, color: player.color } });
      stop = handle.stop;
    })();
    return () => { stop?.(); };
  }, [auth, setIdentity]);

  async function onPickIdentity(name: string, color: string) {
    if (auth.status !== 'ready') return;
    const player = await upsertMyPlayer({ id: auth.userId, name, color });
    setIdentity(auth.userId, player);
    setPickerOpen(false);
    const handle = await startRealtime({ me: { id: player.id, name: player.name, color: player.color } });
    // store handle on window for cleanup on unload
    (window as any).__rt = handle;
  }

  return (
    <main className="flex h-screen flex-col">
      <Topbar />
      <div className="grid flex-1 grid-cols-[260px_1fr_260px] overflow-hidden">
        <RecentFeed />
        <div className="relative">
          {auth.status === 'ready' && me && <GridCanvas onCaptureRejected={(reason) => toast(reason)} />}
        </div>
        <aside className="border-l border-neutral-900 bg-neutral-950 overflow-y-auto">
          <Leaderboard />
          <HotStreak />
        </aside>
      </div>
      <IdentityPicker open={pickerOpen} onSubmit={onPickIdentity} />
    </main>
  );
}
```

- [ ] **Step 3: Add minimal toast hook `lib/hooks/use-toast.ts`**

```ts
'use client';
import { useCallback } from 'react';

export function useToast() {
  const toast = useCallback((reason: string) => {
    const map: Record<string, string> = {
      cooldown: 'Cooldown — wait a moment',
      locked: 'That tile is owned',
      invalid_tile: 'Invalid tile',
      unauthenticated: 'Sign-in failed',
      no_player: 'Pick a name first',
      network: 'Network error',
    };
    const text = map[reason] ?? reason;
    const el = document.createElement('div');
    el.textContent = text;
    el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm shadow-lg ring-1 ring-neutral-800';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }, []);
  return { toast };
}
```

- [ ] **Step 4: Type-check + run dev**

```bash
pnpm tsc --noEmit && pnpm dev &
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```

Expected: `200`

- [ ] **Step 5: Commit**

```bash
git add app/ lib/hooks/use-toast.ts
git commit -m "feat(ui): wire page composition + identity flow"
```

---

## Phase 8 — Polish

### Task 31: Expiry fade animation

**Files:**
- Modify: `lib/store.ts` (add fading-out tiles map), `lib/grid/renderer.ts` (paint fade overlay)

- [ ] **Step 1: Modify `lib/store.ts` — add fading map + helper**

After the `flashes` field, add:

```ts
fadingOut: new Map<string, { startedAt: number; durationMs: number }>(),
```

Update the `State` type accordingly. Add mutators:

```ts
markFading(tileId: string, durationMs: number): void;
clearFading(tileId: string): void;
```

Implement:

```ts
markFading: (tileId, durationMs) => set(s => {
  const next = new Map(s.fadingOut);
  next.set(tileId, { startedAt: Date.now(), durationMs });
  return { fadingOut: next };
}),
clearFading: (tileId) => set(s => {
  const next = new Map(s.fadingOut);
  next.delete(tileId);
  return { fadingOut: next };
}),
```

- [ ] **Step 2: In `lib/realtime.ts`, on DELETE call `markFading` instead of straight `removeTile`**

Replace the DELETE branch with:

```ts
if (payload.eventType === 'DELETE') {
  const oldId = (payload.old as Partial<TileRow>).id;
  if (oldId) {
    useStore.getState().markFading(oldId, 600);
    setTimeout(() => {
      useStore.getState().removeTile(oldId);
      useStore.getState().clearFading(oldId);
    }, 600);
  }
}
```

- [ ] **Step 3: Modify `lib/grid/renderer.ts` to fade based on `fadingOut`**

Add to `PaintInput`: `fadingOut: Map<string, { startedAt: number; durationMs: number }>`.

After painting the tile color (small + big branches), add an overlay that fades the *previous* color to the unclaimed background:

```ts
const fade = input.fadingOut.get(id);
if (fade) {
  const t = Math.min(1, (Date.now() - fade.startedAt) / fade.durationMs);
  ctx.fillStyle = `rgba(30,31,37,${t})`;            // UNCLAIMED with rising alpha
  ctx.fillRect(screen.x, screen.y, cellPx, cellPx); // or `size, size` for big
}
```

- [ ] **Step 4: Update `app/_components/grid-canvas.tsx` to pass `fadingOut`**

In the `paint(...)` call inside the loop, add `fadingOut: s.fadingOut`.

- [ ] **Step 5: Type-check + dev verify**

```bash
pnpm tsc --noEmit && pnpm dev &
sleep 5; kill %1
```

- [ ] **Step 6: Commit**

```bash
git add lib/store.ts lib/realtime.ts lib/grid/renderer.ts app/_components/grid-canvas.tsx
git commit -m "feat(ui): expiry fade animation"
```

---

### Task 32: Hover tooltip

**Files:**
- Create: `app/_components/hover-tooltip.tsx`
- Modify: `app/_components/grid-canvas.tsx` (track screen pos of hover), `app/page.tsx` (mount tooltip)

- [ ] **Step 1: Add hover screen position to store**

In `lib/store.ts`, add:

```ts
hoverScreen: null as { x: number; y: number } | null,
hoverCell: null as { x: number; y: number } | null,
setHover(screen: { x: number; y: number } | null, cell: { x: number; y: number } | null): void;
```

```ts
setHover: (hoverScreen, hoverCell) => set({ hoverScreen, hoverCell }),
```

- [ ] **Step 2: Update `grid-canvas.tsx` onMouseMove + onMouseLeave to call `setHover`**

```ts
useStore.getState().setHover({ x: cell.sx, y: cell.sy }, { x: cell.x, y: cell.y });
// onMouseLeave -> useStore.getState().setHover(null, null);
```

- [ ] **Step 3: Write `app/_components/hover-tooltip.tsx`**

```tsx
'use client';
import { useStore } from '@/lib/store';
import { bigTileAt } from '@/lib/grid/big-tiles';

function fmtRel(iso: string): string {
  const d = Date.parse(iso) - Date.now();
  if (d <= 0) return 'expired';
  const days = Math.floor(d / 86_400_000);
  const hours = Math.floor((d % 86_400_000) / 3_600_000);
  return `${days}d ${hours}h`;
}

export function HoverTooltip() {
  const hoverScreen = useStore(s => s.hoverScreen);
  const hoverCell = useStore(s => s.hoverCell);
  const tiles = useStore(s => s.tiles);
  const players = useStore(s => s.players);
  const bigIndex = useStore(s => s.bigIndex);
  if (!hoverScreen || !hoverCell) return null;

  const big = bigTileAt(bigIndex, hoverCell.x, hoverCell.y);
  const id = big ? `b:${big.x},${big.y}` : `s:${hoverCell.x},${hoverCell.y}`;
  const t = tiles.get(id);
  const p = t ? players.get(t.owner_id) : null;

  const style: React.CSSProperties = {
    left: hoverScreen.x + 12,
    top: hoverScreen.y + 12,
  };

  return (
    <div className="pointer-events-none absolute z-10 rounded-md bg-neutral-900/95 px-3 py-2 text-xs ring-1 ring-neutral-800" style={style}>
      <div className="font-mono text-neutral-300">{id}{big ? ' (big)' : ''}</div>
      {t ? (
        <>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p?.color ?? '#888' }} />
            <span>{p?.name ?? '…'}</span>
          </div>
          <div className="text-neutral-500">expires in {fmtRel(t.expires_at)}</div>
        </>
      ) : (
        <div className="text-neutral-500">unclaimed</div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount in page (inside the canvas column)**

```tsx
<div className="relative">
  {auth.status === 'ready' && me && <GridCanvas onCaptureRejected={(reason) => toast(reason)} />}
  <HoverTooltip />
</div>
```

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts app/_components/grid-canvas.tsx app/_components/hover-tooltip.tsx app/page.tsx
git commit -m "feat(ui): hover tooltip"
```

---

### Task 33: Mobile sheets

**Files:**
- Modify: `app/page.tsx` to switch to bottom sheets at `md` breakpoint

- [ ] **Step 1: Wrap side panels in responsive containers**

Change the grid div to:

```tsx
<div className="md:grid flex-1 md:grid-cols-[260px_1fr_260px] flex flex-col overflow-hidden">
  <div className="hidden md:block">
    <RecentFeed />
  </div>
  <div className="relative flex-1">
    {auth.status === 'ready' && me && <GridCanvas onCaptureRejected={(reason) => toast(reason)} />}
    <HoverTooltip />
  </div>
  <aside className="hidden md:block border-l border-neutral-900 bg-neutral-950 overflow-y-auto">
    <Leaderboard />
    <HotStreak />
  </aside>
  {/* mobile bottom sheet */}
  <div className="md:hidden flex h-44 border-t border-neutral-900 bg-neutral-950 overflow-y-auto">
    <div className="w-1/2 border-r border-neutral-900"><Leaderboard /></div>
    <div className="w-1/2"><HotStreak /></div>
  </div>
</div>
```

- [ ] **Step 2: Verify on dev**

```bash
pnpm dev &
sleep 5; kill %1
```

(Open in a phone-sized browser window to eyeball.)

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): mobile bottom-sheet layout"
```

---

## Phase 9 — Deployment

### Task 34: vercel.ts

**Files:**
- Create: `vercel.ts`

- [ ] **Step 1: Install config package**

```bash
pnpm add -D @vercel/config
```

- [ ] **Step 2: Write `vercel.ts`**

```ts
import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'next build',
  installCommand: 'pnpm install --frozen-lockfile',
};
```

- [ ] **Step 3: Commit**

```bash
git add vercel.ts package.json
git commit -m "chore: vercel.ts config"
```

---

### Task 35: Provision Supabase + Vercel

**Files:** none (control-plane)

- [ ] **Step 1: Push current code**

```bash
git push origin main
```

- [ ] **Step 2: Link the repo to Vercel**

```bash
pnpm dlx vercel@latest link --yes --repo
```

- [ ] **Step 3: Provision a Supabase project via the Marketplace integration**

Open https://vercel.com/integrations/supabase and add it to the project. Confirm env vars are auto-populated under Project → Settings → Environment Variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

- [ ] **Step 4: Push migrations to the cloud project**

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <ref>
pnpm dlx supabase db push
```

- [ ] **Step 5: Verify big_tiles seeded in cloud**

```bash
pnpm dlx supabase db query --linked "select count(*) from public.big_tiles"
```

Expected: `100`

- [ ] **Step 6: Deploy preview**

```bash
pnpm dlx vercel@latest deploy
```

Open the preview URL, sign in via the modal, capture a tile, open a second tab and confirm the tile shows up in real time.

- [ ] **Step 7: Promote to production**

```bash
pnpm dlx vercel@latest deploy --prod
```

- [ ] **Step 8: Smoke test prod URL**

In two browser tabs of the prod URL, confirm:
- Identity modal appears once.
- Click captures a tile; second tab sees the tile within ~300ms.
- Cooldown bar runs; clicking during cooldown shows the toast.
- Leaderboard updates.
- Hover tooltip shows expires-in.

- [ ] **Step 9: Commit deployment notes to README** (Task 37 finishes the README)

---

## Phase 10 — Submission docs

### Task 36: Update README with the submission answers

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with the submission-grade version**

```markdown
# Realtime Shared Grid

A 100×100 shared grid where any visitor captures tiles. ~100 tiles are rare 5×5 reward squares. Captures appear in real time for everyone connected. Per-user 10-second cooldown, 7-day ownership lock, server-enforced.

**Live demo:** <prod URL goes here>

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, shadcn/ui (chrome only — the grid is Canvas 2D), Zustand, TanStack Query.
- **Backend:** Supabase Postgres with a single `capture_tile` RPC enforcing all conflict rules; RLS denies any direct write.
- **Real-time:** Supabase Realtime — `tiles` Postgres Changes for authoritative state, plus a `world` broadcast channel for presence + capture-feed payloads.
- **Auth:** Supabase Anonymous Auth (silent sign-in on first visit).
- **Hosting:** Vercel for the app, Supabase Cloud for DB + realtime.

## How real-time works

Two channels:

1. **Channel A — Postgres Changes on `tiles`.** Authoritative. Every client subscribes and rerenders the affected cell on insert/update/delete.
2. **Channel B — `world` broadcast.** Ephemeral presence + capture payloads. Drives the "X online" pill and the right-rail recent-captures feed without forcing a JOIN on every state change.

Captures are a single Postgres RPC (`capture_tile`). The function:

1. Resolves `auth.uid()` and rejects if missing.
2. Validates the tile id against world bounds + the `big_tiles` seed table (geometry is server-authoritative — clients can't claim a non-existent big tile or a small tile inside a big-tile footprint).
3. Acquires a row-level lock on the player row for the cooldown check (serializes parallel captures by the same user).
4. Acquires a row-level lock on the target tile (serializes parallel captures of the same tile).
5. Writes the new ownership and bookkeeping in the same transaction.

This means **every contention scenario resolves at the database**, not in JS:
- *Two users, same tile:* Postgres serializes via `select ... for update`. One wins, the other gets `locked`.
- *Same user, two parallel clicks:* serialized via the player-row lock. One wins, the other gets `cooldown`.
- *Malicious client editing JS to skip the cooldown:* RLS denies direct writes; the RPC re-checks `last_capture_at` server-side.

Optimistic UI: clients paint the tile in the player's color the instant they click, then reconcile when the RPC returns. Rejection reverts the paint.

A `pg_cron` job sweeps `expires_at < now()` every minute. The deletes flow through Postgres Changes → all clients fade the freed tiles out. Free correctness + free animation.

## Trade-offs

- **Supabase Realtime over a hand-rolled WS server.** Hides some plumbing, but moves the *interesting* concurrency work into Postgres where it's stronger. The RPC is the part worth reading.
- **Canvas 2D over WebGL/Pixi.** 10k tiles is well within Canvas 2D's range and keeps the renderer readable. Easy migration path if the grid grew to 100k+.
- **Sparse `tiles` table.** Unclaimed tiles aren't rows. The table caps at ~7,600 rows even when the world is fully claimed; "is this free?" is a `not exists` lookup; expiry is just `delete`.
- **Single realtime channel for the whole world.** With a 10s cooldown and 100 cells × 100 cells, peak write rate is bounded. Spatial sharding only matters at >100k cells.
- **Anonymous auth instead of accounts.** Real `auth.uid()` for RLS, zero friction. Identity is per-device — fine for a casual grid game.
- **Optimistic capture client-side.** Snappier; cost is reconciliation logic on rejection. Worth it.

## Bonus features

- Display name + custom color (random suggestion or color picker)
- 10-second per-user cooldown, server-enforced, with cursor-adjacent progress bar
- 7-day ownership lock with automatic expiry sweeper + fade animation
- Rare 5×5 "reward" tiles (~1% of the world, gold border + 5× score)
- Top-10 all-time leaderboard
- Hot-streak board (top 5 captures in the last hour)
- Live recent-captures feed
- Presence pill (live online count)
- Zoom (0.5×–8×) + drag-pan, with cursor-anchored zoom
- Optimistic UI + capture-flash animation
- Hover tooltip (owner, expires-in)
- Mobile-responsive layout (panels collapse to bottom sheet)

## Local development

```bash
pnpm install
pnpm supabase start
pnpm supabase db reset
cp .env.local.example .env.local   # fill from `pnpm supabase status`
pnpm test
pnpm test:integration
pnpm dev
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: submission-grade README"
git push origin main
```

---

## Self-review

**Spec coverage check** — every section of the spec maps to ≥1 task:

| Spec section | Task(s) |
| --- | --- |
| Goals & non-goals | covered by overall plan (no task) |
| Architecture diagram | T16-T19 (clients), T22 (realtime), T7 (RPC) |
| Data model | T6 (schema) |
| Capture RPC + conflict resolution | T7 (RPC), T20 (test) |
| Real-time strategy | T22 |
| Renderer & UI | T23, T24, T31, T32 |
| Identity | T17, T18, T25 |
| Bonus features | T26 (cooldown), T27 (presence), T28 (feed), T29 (leaderboard + hot streak), T31 (fade), T32 (tooltip), T33 (mobile) |
| Project structure | T1-T4 |
| Testing | T12-T15 (helpers), T20 (integration) |
| Deployment | T34, T35 |
| Trade-offs writeup | T36 |

**Placeholder scan** — no TBD/TODO; every code step contains the actual code; no "similar to Task N" handwave; commands have expected outputs where it matters.

**Type consistency** — `TileRow`, `PlayerRow`, `BigTileRow`, `CaptureRow`, `CaptureResult` defined in `lib/types/db.ts` (T16) and consumed by every later task. `Camera` exported from `lib/grid/camera.ts` (T14) and consumed in T21, T23, T24. `BigTileIndex`, `buildBigTileIndex`, `bigTileAt`, `isInsideBigTile` defined in T13 and consumed in T21, T23, T24, T32. Store mutators (`upsertTile`, `removeTile`, `markFading`, `clearFading`, `setHover`) defined and used consistently.

**Known small gaps** — none that block execution.
