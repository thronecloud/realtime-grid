'use client';
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { paint, TILE_PX, WORLD_PX } from '@/lib/grid/renderer';
import { clampCamera, pan, zoomAt } from '@/lib/grid/camera';
import { bigTileAt } from '@/lib/grid/big-tiles';
import { captureTile } from '@/lib/api/tiles';
import { broadcastCapture } from '@/lib/realtime';

interface Props { onCaptureRejected?: (reason: string) => void }

export function GridCanvas({ onCaptureRejected }: Props) {
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
      const hasActiveFlash = s.flashes.some((f) => f.until > now);
      const hasActiveFade = s.fadingOut.size > 0;
      if (s.dirty || hasActiveFlash || hasActiveFade) {
        const rect = containerRef.current!.getBoundingClientRect();
        const flashMap = new Map(s.flashes.map((f) => [f.tileId, f.until]));
        paint({
          ctx,
          camera: s.camera,
          viewport: { w: rect.width, h: rect.height },
          bigIndex: s.bigIndex,
          tiles: s.tiles,
          players: s.players,
          flashes: flashMap,
          fadingOut: s.fadingOut,
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
    if (s.cooldownUntil && Date.now() < s.cooldownUntil) {
      onCaptureRejected?.('cooldown');
      return;
    }
    const big = bigTileAt(s.bigIndex, cellX, cellY);
    const tileId = big ? `b:${big.x},${big.y}` : `s:${cellX},${cellY}`;
    const optimistic = {
      id: tileId,
      kind: big ? ('big' as const) : ('small' as const),
      x: big?.x ?? cellX,
      y: big?.y ?? cellY,
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
    }
    useStore.getState().startCooldown(10);
    if (s.userId && s.me) {
      broadcastCapture({ playerId: s.userId, tileId, kind: optimistic.kind });
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
