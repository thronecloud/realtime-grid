'use client';
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { paint, TILE_PX, WORLD_PX } from '@/lib/grid/renderer';
import { clampCamera, pan, zoomAt } from '@/lib/grid/camera';
import { captureTile } from '@/lib/api/tiles';
import { broadcastCapture } from '@/lib/realtime';
import type { TileRow } from '@/lib/types/db';

interface Props { onCaptureRejected?: (reason: string) => void; onJackpot?: (mult: number) => void }

export function GridCanvas({ onCaptureRejected, onJackpot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ x: number; y: number; moved: number; startedAt: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    const ro = new ResizeObserver(() => {
      const rect = containerRef.current!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      useStore.getState().setCamera({ ...useStore.getState().camera });
    });
    ro.observe(containerRef.current!);

    const loop = () => {
      const s = useStore.getState();
      const now = Date.now();
      const hasFlash = s.flashes.some((f) => f.until > now);
      const hasFade = s.fadingOut.size > 0;
      const hasReveal = [...s.reveals.values()].some((r) => r.until > now);
      if (s.dirty || hasFlash || hasFade || hasReveal) {
        const rect = containerRef.current!.getBoundingClientRect();
        const flashMap = new Map(s.flashes.map((f) => [f.tileId, f.until]));
        paint({
          ctx,
          camera: s.camera,
          viewport: { w: rect.width, h: rect.height },
          tiles: s.tiles,
          players: s.players,
          flashes: flashMap,
          fadingOut: s.fadingOut,
          reveals: s.reveals,
          hovered: s.hoverCell,
        });
        if (s.dirty) useStore.getState().clearDirty();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  function clientToCell(ev: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = ev.clientX - rect.left;
    const sy = ev.clientY - rect.top;
    const { camera } = useStore.getState();
    const wx = camera.x + sx / camera.zoom;
    const wy = camera.y + sy / camera.zoom;
    const cx = Math.floor(wx / TILE_PX);
    const cy = Math.floor(wy / TILE_PX);
    if (cx < 0 || cy < 0 || cx > 99 || cy > 99) return null;
    return { x: cx, y: cy, sx, sy };
  }

  async function handleClick(cellX: number, cellY: number) {
    const s = useStore.getState();
    const tileId = `s:${cellX},${cellY}`;
    // Silent no-op when the click lands on a tile we already own — clicking
    // your own territory shouldn't fire a "rejected" toast.
    const existing = s.tiles.get(tileId);
    if (existing && s.userId && existing.owner_id === s.userId) {
      return;
    }
    if (s.cooldownUntil && Date.now() < s.cooldownUntil) {
      onCaptureRejected?.('cooldown');
      return;
    }
    // Optimistic — assume normal tile. The server-returned kind reveals the
    // multiplier; we then upgrade and fire the jackpot animation.
    const optimistic: TileRow = {
      id: tileId,
      kind: 'normal',
      x: cellX,
      y: cellY,
      owner_id: s.userId ?? '',
      captured_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    };
    const prev = s.tiles.get(tileId);
    s.upsertTile(optimistic);
    s.pushFlash(tileId, 220);

    const res = await captureTile(tileId).catch(
      () => ({ ok: false as const, reason: 'network', tile: null }),
    );
    if (!res.ok) {
      const after = useStore.getState();
      const current = after.tiles.get(tileId);
      const stillMine =
        current &&
        current.owner_id === optimistic.owner_id &&
        current.captured_at === optimistic.captured_at;
      if (stillMine) {
        if (prev) after.upsertTile(prev);
        else after.removeTile(tileId);
      }
      onCaptureRejected?.(res.reason ?? 'unknown');
      return;
    }
    if (res.tile) {
      useStore.getState().upsertTile(res.tile);
      // Jackpot reveal: kind comes back as 'mult5' or 'mult10' if the cell
      // was a hidden multiplier. Fire the gold sparkle + a toast.
      if (res.tile.kind === 'mult5' || res.tile.kind === 'mult10') {
        const mult = res.tile.kind === 'mult10' ? 10 : 5;
        const dur = mult === 10 ? 1500 : 1000;
        useStore.getState().pushReveal(tileId, mult, dur);
        setTimeout(() => useStore.getState().clearReveal(tileId), dur);
        onJackpot?.(mult);
      }
    }
    useStore.getState().startCooldown(10);
    if (s.userId && s.me && res.tile) {
      broadcastCapture({ playerId: s.userId, tileId, kind: res.tile.kind });
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-neutral-950 select-none"
    >
      <canvas
        ref={canvasRef}
        className="block touch-none"
        onMouseDown={(e) => {
          draggingRef.current = {
            x: e.clientX,
            y: e.clientY,
            moved: 0,
            startedAt: Date.now(),
          };
        }}
        onMouseMove={(e) => {
          const cell = clientToCell(e);
          useStore
            .getState()
            .setHover(
              cell ? { x: cell.sx, y: cell.sy } : null,
              cell ? { x: cell.x, y: cell.y } : null,
            );
          const d = draggingRef.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          d.moved += Math.abs(dx) + Math.abs(dy);
          d.x = e.clientX;
          d.y = e.clientY;
          const s = useStore.getState();
          const next = pan(s.camera, -dx / s.camera.zoom, -dy / s.camera.zoom);
          s.setCamera(clampCamera(next, { worldPx: WORLD_PX, viewportW: 0, viewportH: 0 }));
        }}
        onMouseUp={async (e) => {
          const d = draggingRef.current;
          draggingRef.current = null;
          if (!d) return;
          const moved = d.moved;
          const dur = Date.now() - d.startedAt;
          if (moved < 4 && dur < 250) {
            const cell = clientToCell(e);
            if (cell) await handleClick(cell.x, cell.y);
          }
        }}
        onMouseLeave={() => {
          draggingRef.current = null;
          useStore.getState().setHover(null, null);
        }}
        onWheel={(e) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const s = useStore.getState();
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          const next = zoomAt(s.camera, sx, sy, s.camera.zoom * factor);
          s.setCamera(clampCamera(next, { worldPx: WORLD_PX, viewportW: 0, viewportH: 0 }));
        }}
      />
    </div>
  );
}
