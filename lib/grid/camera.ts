export interface Camera {
  zoom: number;
  x: number;
  y: number;
}

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 8;

export function createCamera(c: Camera): Camera {
  return { zoom: c.zoom, x: c.x, y: c.y };
}

export function pan(c: Camera, dx: number, dy: number): Camera {
  return { ...c, x: c.x + dx, y: c.y + dy };
}

export function screenToWorld(c: Camera, sx: number, sy: number): { x: number; y: number } {
  return { x: c.x + sx / c.zoom, y: c.y + sy / c.zoom };
}

export function worldToScreen(c: Camera, wx: number, wy: number): { x: number; y: number } {
  return { x: (wx - c.x) * c.zoom, y: (wy - c.y) * c.zoom };
}

export function zoomAt(c: Camera, sx: number, sy: number, nextZoom: number): Camera {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
  const w = screenToWorld(c, sx, sy);
  return { zoom: z, x: w.x - sx / z, y: w.y - sy / z };
}

export interface ClampInput { worldPx: number; viewportW: number; viewportH: number }

export function clampCamera(c: Camera, b: ClampInput): Camera {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, c.zoom));
  const margin = 200 / z;
  const x = Math.min(b.worldPx + margin, Math.max(-margin, c.x));
  const y = Math.min(b.worldPx + margin, Math.max(-margin, c.y));
  return { zoom: z, x, y };
}
