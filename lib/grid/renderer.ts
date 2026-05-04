import type { Camera } from './camera';
import { worldToScreen } from './camera';
import type { PlayerRow, TileRow } from '@/lib/types/db';
import type { BigTileIndex } from './big-tiles';

export const TILE_PX = 16;
export const WORLD_CELLS = 100;
export const WORLD_PX = TILE_PX * WORLD_CELLS;

export interface PaintInput {
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  viewport: { w: number; h: number };
  bigIndex: BigTileIndex;
  tiles: Map<string, TileRow>;
  players: Map<string, PlayerRow>;
  flashes: Map<string, number>;
  fadingOut: Map<string, { startedAt: number; durationMs: number }>;
  hovered: { x: number; y: number } | null;
}

const BG = '#0a0a0c';
const GRID = '#15161a';
const UNCLAIMED = '#1e1f25';
const BIG_UNCLAIMED = '#26211a';
const BIG_BORDER = 'rgba(255, 215, 0, 0.55)';

function colorFor(t: TileRow, players: Map<string, PlayerRow>): string {
  return players.get(t.owner_id)?.color ?? '#6b7280';
}

export function paint(input: PaintInput) {
  const { ctx, camera, viewport, bigIndex, tiles, players, flashes, fadingOut, hovered } = input;
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

  // 1. small cells (skipping big-tile footprints)
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      if (bigIndex.cellToAnchor.has(`${cx},${cy}`)) continue;
      const id = `s:${cx},${cy}`;
      const t = tiles.get(id);
      const screen = worldToScreen(camera, cx * TILE_PX, cy * TILE_PX);
      ctx.fillStyle = t ? colorFor(t, players) : UNCLAIMED;
      ctx.fillRect(screen.x, screen.y, cellPx, cellPx);

      const f = flashes.get(id);
      if (f && f > Date.now()) {
        const a = (f - Date.now()) / 220;
        ctx.fillStyle = `rgba(255,255,255,${0.55 * a})`;
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
      }

      const fade = fadingOut.get(id);
      if (fade) {
        const t2 = Math.min(1, (Date.now() - fade.startedAt) / fade.durationMs);
        ctx.fillStyle = `rgba(30,31,37,${t2})`;
        ctx.fillRect(screen.x, screen.y, cellPx, cellPx);
      }
    }
  }

  // 2. big tiles (5x5 footprint each)
  for (const a of bigIndex.anchors) {
    if (a.x + 4 < x0 || a.x > x1 || a.y + 4 < y0 || a.y > y1) continue;
    const id = `b:${a.x},${a.y}`;
    const t = tiles.get(id);
    const screen = worldToScreen(camera, a.x * TILE_PX, a.y * TILE_PX);
    const size = cellPx * 5;
    ctx.fillStyle = t ? colorFor(t, players) : BIG_UNCLAIMED;
    ctx.fillRect(screen.x, screen.y, size, size);
    ctx.strokeStyle = BIG_BORDER;
    ctx.lineWidth = Math.max(1, camera.zoom);
    ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, size - 1, size - 1);

    const f = flashes.get(id);
    if (f && f > Date.now()) {
      const aLevel = (f - Date.now()) / 220;
      ctx.fillStyle = `rgba(255,255,255,${0.55 * aLevel})`;
      ctx.fillRect(screen.x, screen.y, size, size);
    }
    const fade = fadingOut.get(id);
    if (fade) {
      const t2 = Math.min(1, (Date.now() - fade.startedAt) / fade.durationMs);
      ctx.fillStyle = `rgba(38,33,26,${t2})`;
      ctx.fillRect(screen.x, screen.y, size, size);
    }
  }

  // 3. hover ring
  if (hovered) {
    const screen = worldToScreen(camera, hovered.x * TILE_PX, hovered.y * TILE_PX);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(screen.x + 1, screen.y + 1, cellPx - 2, cellPx - 2);
  }

  // 4. grid hairlines (only at zoom >= 1.5)
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
