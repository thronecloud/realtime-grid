-- Gameplay redesign: drop visually-distinct 5x5 BIG tiles. All tiles are now
-- uniform 1x1 cells. ~1% of cells are SECRET multipliers worth 5x or 10x points.
-- Players don't know which tiles are jackpots until they capture them.

-- 1. Add multiplier to the seed table (kept the name big_tiles for migration
--    simplicity; semantically these are "multiplier tiles"). Each row marks a
--    single cell with a 5x or 10x payoff.
alter table public.big_tiles add column if not exists mult int not null default 5;
alter table public.big_tiles add constraint big_tiles_mult_chk check (mult in (5, 10));
-- Drop the legacy 0..95 bounds (those were for 5x5 footprint margins).
-- Multipliers are single cells, so any 0..99 position is valid.
alter table public.big_tiles drop constraint if exists big_tiles_x_check;
alter table public.big_tiles drop constraint if exists big_tiles_y_check;
alter table public.big_tiles add constraint big_tiles_x_chk check (x between 0 and 99);
alter table public.big_tiles add constraint big_tiles_y_chk check (y between 0 and 99);

-- Re-seed: 100 multipliers in a 100x100 world (~1% density).
-- Roughly 70 are 5x and 30 are 10x.
truncate public.big_tiles;
do $$
declare
  v_x int;
  v_y int;
  v_count int := 0;
  v_attempts int := 0;
  v_mult int;
begin
  perform setseed(0.42);
  while v_count < 100 and v_attempts < 5000 loop
    v_attempts := v_attempts + 1;
    v_x := floor(random() * 100)::int;  -- 0..99 (no footprint margin needed)
    v_y := floor(random() * 100)::int;
    v_mult := case when random() < 0.3 then 10 else 5 end;
    if not exists (
      select 1 from public.big_tiles where x = v_x and y = v_y
    ) then
      insert into public.big_tiles (x, y, mult) values (v_x, v_y, v_mult);
      v_count := v_count + 1;
    end if;
  end loop;
  if v_count < 100 then
    raise exception 'multiplier seed: only placed % of 100', v_count;
  end if;
end $$;

-- 2. Update tiles.kind enum: 'normal' (1pt), 'mult5' (5pt), 'mult10' (10pt).
--    Backfill any existing rows: 'small' -> 'normal', 'big' -> 'mult5'.
alter table public.tiles drop constraint if exists tiles_kind_check;
update public.tiles set kind = 'normal' where kind = 'small';
update public.tiles set kind = 'mult5'  where kind = 'big';
alter table public.tiles add constraint tiles_kind_check
  check (kind in ('normal', 'mult5', 'mult10'));

alter table public.captures drop constraint if exists captures_kind_check;
update public.captures set kind = 'normal' where kind = 'small';
update public.captures set kind = 'mult5'  where kind = 'big';
alter table public.captures add constraint captures_kind_check
  check (kind in ('normal', 'mult5', 'mult10'));

-- 3. parse_tile_id now only accepts 's:x,y' (no separate 'b:' format —
--    multipliers are hidden, every tile id is a small-cell id).
-- Return shape changed from (kind,x,y) to (x,y), so drop the old one first.
drop function if exists public.parse_tile_id(text);
create or replace function public.parse_tile_id(p_id text)
returns table(x int, y int)
language plpgsql immutable as $$
declare
  v_x int;
  v_y int;
  v_match text[];
begin
  v_match := regexp_match(p_id, '^s:(\d{1,2}),(\d{1,2})$');
  if v_match is null then return; end if;
  v_x := v_match[1]::int;
  v_y := v_match[2]::int;
  if v_x < 0 or v_x > 99 or v_y < 0 or v_y > 99 then return; end if;
  return query select v_x, v_y;
end $$;

-- 4. capture_tile now looks up the multiplier table and tags the captured
--    tile with its multiplier kind. Returns the multiplier in the payload so
--    the client can fire a jackpot animation.
create or replace function public.capture_tile(p_tile_id text)
returns table(ok boolean, reason text, tile json)
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_x int; v_y int;
  v_kind      text;
  v_mult      int;
  v_last      timestamptz;
  v_existing  public.tiles%rowtype;
begin
  if v_uid is null then
    return query select false, 'unauthenticated'::text, null::json;
    return;
  end if;

  -- 1. parse + bounds check
  select pti.x, pti.y into v_x, v_y from public.parse_tile_id(p_tile_id) pti;
  if v_x is null then
    return query select false, 'invalid_tile'::text, null::json;
    return;
  end if;

  -- 2. multiplier lookup
  select bt.mult into v_mult from public.big_tiles bt where bt.x = v_x and bt.y = v_y;
  v_kind := case
    when v_mult = 10 then 'mult10'
    when v_mult = 5  then 'mult5'
    else 'normal'
  end;
  v_mult := coalesce(v_mult, 1);

  -- 3. cooldown
  select last_capture_at into v_last
    from public.players where id = v_uid for update;
  if not found then
    return query select false, 'no_player'::text, null::json;
    return;
  end if;
  if v_last is not null and now() - v_last < interval '10 seconds' then
    return query select false, 'cooldown'::text, null::json;
    return;
  end if;

  -- 4. atomic capture (insert or steal-if-expired)
  insert into public.tiles (id, kind, x, y, owner_id, captured_at, expires_at)
  values (p_tile_id, v_kind, v_x, v_y, v_uid, now(), now() + interval '7 days')
  on conflict (id) do update
    set owner_id = excluded.owner_id,
        kind = excluded.kind,
        captured_at = excluded.captured_at,
        expires_at = excluded.expires_at
    where public.tiles.expires_at <= now()
  returning * into v_existing;

  if not found then
    select * into v_existing from public.tiles where id = p_tile_id;
    return query select false, 'locked'::text, row_to_json(v_existing)::json;
    return;
  end if;

  -- 5. bookkeeping
  update public.players set last_capture_at = now() where id = v_uid;
  insert into public.captures (player_id, tile_id, kind)
    values (v_uid, p_tile_id, v_kind);

  return query select true, null::text, row_to_json(v_existing)::json;
end $$;

revoke all on function public.capture_tile(text) from public;
grant execute on function public.capture_tile(text) to authenticated;
