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
  select pti.kind, pti.x, pti.y into v_kind, v_x, v_y
    from public.parse_tile_id(p_tile_id) pti;
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
