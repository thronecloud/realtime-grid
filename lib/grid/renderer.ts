import type { Camera } from './camera';
import { worldToScreen } from './camera';
import type { PlayerRow, TileRow } from '@/lib/types/db';

export const TILE_PX = 16;
export const WORLD_CELLS = 100;
export const WORLD_PX = TILE_PX * WORLD_CELLS;

export interface PaintInput {
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  viewport: { w: number; h: number };
  tiles: Map<string, TileRow>;
  players: Map<string, PlayerRow>;
  flashes: Map<string, number>;
  fadingOut: Map<string, { startedAt: number; durationMs: number }>;
  hovered: { x: number; y: number } | null;
  // Recently-revealed jackpot cells: tileId -> until ms. Renders a brief
  // gold sparkle overlay so the captor sees the multiplier reveal.
  reveals: Map<string, { until: number; mult: number }>;
}

const BG = '#07080a';
const GRID = '#1c2230';
const UNCLAIMED = '#21263a';      // brighter so the grid texture is always visible
const UNCLAIMED_ALT = '#1c2030';  // checker contrast cell — every other column

function colorFor(t: TileRow, players: Map<string, PlayerRow>): string {
  return players.get(t.owner_id)?.color ?? '#6b7280';
}

export function paint(input: PaintInput) {
  const { ctx, camera, viewport, tiles, players, flashes, fadingOut, hovered, reveals } = input;
  ctx.save();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, viewport.w, viewport.h);

  const tlWorld = { x: camera.x, y: camera.y };
  const brWorld = {
    x: camera.x + viewport.w / camera.zoom,
    y: camera.y + viewport.h / camera.zoom,
  };
  const cellPx = TILE_PX * camera.zoom;
  const x0 = Math.max(0, Math.floor(tlWorld.x / TILE_PX) - 1);
  const y0 = Math.max(0, Math.floor(tlWorld.y / TILE_PX) - 1);
  const x1 = Math.min(WORLD_CELLS - 1, Math.ceil(brWorld.x / TILE_PX) + 1);
  const y1 = Math.min(WORLD_CELLS - 1, Math.ceil(brWorld.y / TILE_PX) + 1);

  const now = Date.now();

  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const id = `s:${cx},${cy}`;
      const t = tiles.get(id);
      const screen = worldToScreen(camera, cx * TILE_PX, cy * TILE_PX);
      // Subtle 2x2 checker on unclaimed cells so the grid texture reads as a
      // grid even when no tiles are captured.
      const checker = ((cx + cy) & 1) === 0 ? UNCLAIMED : UNCLAIMED_ALT;
      ctx.fillStyle = t ? colorFor(t, players) : checker;
      ctx.fillRect(screen.x, screen.y, cellPx, cellPx);

      // Capture flash — instant white pulse on any new ownership write
      const f = flashes.get(id);
      if (f && f > now) {
        const a = (f - now) / 220;
        ctx.fillStyle = `rgba(255,255,255,${0.55 * a})`;
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
      }

      // Jackpot reveal — gold pulse + sparkle ring on multiplier captures
      const rev = reveals.get(id);
      if (rev && rev.until > now) {
        const remain = rev.until - now;
        const total = rev.mult === 10 ? 1500 : 1000;
        const a = Math.min(1, remain / total);
        // gold inner glow
        ctx.fillStyle = `rgba(245,194,69,${0.55 * a})`;
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
        // sparkle ring (inflating)
        const grow = (1 - a) * cellPx * (rev.mult === 10 ? 4 : 2.5);
        ctx.strokeStyle = `rgba(245,194,69,${a})`;
        ctx.lineWidth = Math.max(1, camera.zoom);
        ctx.strokeRect(
          screen.x - grow / 2,
          screen.y - grow / 2,
          cellPx + grow,
          cellPx + grow,
        );
      }

      // Expiry fade — UNCLAIMED with rising alpha
      const fade = fadingOut.get(id);
      if (fade) {
        const t2 = Math.min(1, (now - fade.startedAt) / fade.durationMs);
        ctx.fillStyle = `rgba(26,29,38,${t2})`;
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
      }
    }
  }

  // Hover ring
  if (hovered) {
    const screen = worldToScreen(camera, hovered.x * TILE_PX, hovered.y * TILE_PX);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(screen.x + 1, screen.y + 1, cellPx - 2, cellPx - 2);
  }

  // Grid hairlines (only at zoom >= 1.5 — they get noisy at low zoom)
  if (camera.zoom >= 1.5) {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let cx = x0; cx <= x1 + 1; cx++) {
      const sx = (cx * TILE_PX - camera.x) * camera.zoom;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, viewport.h);
    }
    for (let cy = y0; cy <= y1 + 1; cy++) {
      const sy = (cy * TILE_PX - camera.y) * camera.zoom;
      ctx.moveTo(0, sy);
      ctx.lineTo(viewport.w, sy);
    }
    ctx.stroke();
  }

  ctx.restore();
}
