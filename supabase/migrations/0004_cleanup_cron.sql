-- pg_cron is preinstalled on Supabase; enable if not already.
-- Note: Vercel Cron route at /api/cron/expire is the always-available fallback.
create extension if not exists pg_cron with schema extensions;

-- Sweep expired tiles every 60 seconds. Deletes flow through Postgres
-- Changes -> Supabase Realtime -> all clients fade the freed tiles out.
select cron.schedule(
  'expire_tiles',
  '* * * * *',
  $$ delete from public.tiles where expires_at < now() $$
);
