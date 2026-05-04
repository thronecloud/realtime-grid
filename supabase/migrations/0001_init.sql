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
