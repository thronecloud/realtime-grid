import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'next build',
  installCommand: 'pnpm install --frozen-lockfile',
  crons: [{ path: '/api/cron/expire', schedule: '* * * * *' }],
};
