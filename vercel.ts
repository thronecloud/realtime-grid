import { type VercelConfig } from '@vercel/config/v1';

// pg_cron on the Supabase side runs the expiry sweep every minute (see
// migrations/0004_cleanup_cron.sql). The /api/cron/expire route stays in
// the codebase as a fallback you can wire up via Vercel Cron on Pro plans
// or trigger manually with a Bearer CRON_SECRET if pg_cron isn't enabled.
export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'next build',
  installCommand: 'pnpm install --frozen-lockfile',
};
