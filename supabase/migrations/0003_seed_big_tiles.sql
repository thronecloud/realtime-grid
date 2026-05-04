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
