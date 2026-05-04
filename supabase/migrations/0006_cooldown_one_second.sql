-- Reduce capture cooldown from 10s to 1s (gameplay tuning).
-- Same shape as 0005's capture_tile, only the interval changes.
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

  select pti.x, pti.y into v_x, v_y from public.parse_tile_id(p_tile_id) pti;
  if v_x is null then
    return query select false, 'invalid_tile'::text, null::json;
    return;
  end if;

  select bt.mult into v_mult from public.big_tiles bt where bt.x = v_x and bt.y = v_y;
  v_kind := case
    when v_mult = 10 then 'mult10'
    when v_mult = 5  then 'mult5'
    else 'normal'
  end;
  v_mult := coalesce(v_mult, 1);

  select last_capture_at into v_last
    from public.players where id = v_uid for update;
  if not found then
    return query select false, 'no_player'::text, null::json;
    return;
  end if;
  -- Cooldown reduced 10s -> 1s.
  if v_last is not null and now() - v_last < interval '1 second' then
    return query select false, 'cooldown'::text, null::json;
    return;
  end if;

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

  update public.players set last_capture_at = now() where id = v_uid;
  insert into public.captures (player_id, tile_id, kind)
    values (v_uid, p_tile_id, v_kind);

  return query select true, null::text, row_to_json(v_existing)::json;
end $$;
