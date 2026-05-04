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

// Warm-paper / parchment palette to match tactical.jsx wireframes.
const BG = '#efe9d8';             // canvas backdrop (parchment)
const GRID = '#cfc8b3';           // hairline lines on the grid
const UNCLAIMED = '#efe9d8';      // unclaimed cell color (matches BG)
const UNCLAIMED_ALT = '#e7e0cb';  // every-other-cell checker, very subtle

// Owner color drawn at 85% alpha so the underlying grid texture peeks
// through and the canvas reads as a single map, not a quilt of opaque cells.
function colorForRgba(t: TileRow, players: Map<string, PlayerRow>): string {
  const hex = players.get(t.owner_id)?.color ?? '#6b7280';
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},0.85)`;
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
      // Owned cells need the unclaimed checker beneath the alpha-85 owner
      // color so the grid texture stays continuous.
      if (t) {
        ctx.fillStyle = checker;
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
        ctx.fillStyle = colorForRgba(t, players);
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
      } else {
        ctx.fillStyle = checker;
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
      }

      // Capture flash — 220ms signal-green pulse on any new ownership write
      const f = flashes.get(id);
      if (f && f > now) {
        const a = (f - now) / 220;
        ctx.fillStyle = `rgba(74,222,128,${0.5 * a})`;
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

  // Hover ring — orange-red accent (matches wireframe), ink halo for contrast
  if (hovered) {
    const screen = worldToScreen(camera, hovered.x * TILE_PX, hovered.y * TILE_PX);
    ctx.strokeStyle = 'rgba(26,26,26,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(screen.x - 0.5, screen.y - 0.5, cellPx + 1, cellPx + 1);
    ctx.strokeStyle = '#e8553a';
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
