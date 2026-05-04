import { describe, it, expect } from 'vitest';
import {
  createCamera,
  pan,
  zoomAt,
  screenToWorld,
  worldToScreen,
  clampCamera,
} from '@/lib/grid/camera';

describe('camera', () => {
  it('round-trips screen<->world', () => {
    const cam = createCamera({ zoom: 2, x: 100, y: 50 });
    const w = screenToWorld(cam, 300, 200);
    const s = worldToScreen(cam, w.x, w.y);
    expect(s.x).toBeCloseTo(300);
    expect(s.y).toBeCloseTo(200);
  });

  it('zoomAt anchors on cursor', () => {
    const cam = createCamera({ zoom: 1, x: 0, y: 0 });
    const before = screenToWorld(cam, 200, 100);
    const next = zoomAt(cam, 200, 100, 2);
    const after = screenToWorld(next, 200, 100);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(next.zoom).toBe(2);
  });

  it('pan translates camera', () => {
    const cam = createCamera({ zoom: 1, x: 10, y: 20 });
    const next = pan(cam, 5, -3);
    expect(next.x).toBe(15);
    expect(next.y).toBe(17);
  });

  it('clampCamera enforces zoom + world bounds', () => {
    const cam = createCamera({ zoom: 0.1, x: -1e6, y: 1e6 });
    const c = clampCamera(cam, { worldPx: 1000, viewportW: 800, viewportH: 600 });
    expect(c.zoom).toBeGreaterThanOrEqual(0.5);
    expect(c.zoom).toBeLessThanOrEqual(8);
    expect(c.x).toBeGreaterThanOrEqual(-1000);
  });
});
