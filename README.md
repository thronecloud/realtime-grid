# Realtime Shared Grid

A 100×100 shared grid where any visitor can claim tiles. Captures appear instantly for every connected user. ~1% of tiles are rare 5×5 reward tiles. Per-user 10s cooldown, 7-day ownership lock.

> Status: in design. See [`docs/superpowers/specs/2026-05-04-realtime-grid-design.md`](docs/superpowers/specs/2026-05-04-realtime-grid-design.md) for the full architecture.

## Stack
- Next.js 16 (App Router) on Vercel
- Supabase Postgres + Realtime + Anonymous Auth
- Canvas 2D renderer, Zustand state, Tailwind + shadcn/ui chrome
- TypeScript, Vitest

## Local development
Setup instructions land here once the implementation is in place.
