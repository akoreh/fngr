import type { PointerInfo, Point, TrackedPointer } from './models/types';

export class PointerTracker {
  private tracked = new Map<number, TrackedPointer>();
  private readonly velocityWindowMs = 100;

  get count(): number {
    return this.tracked.size;
  }

  get pointers(): PointerInfo[] {
    return Array.from(this.tracked.values()).map((t) => t.info);
  }

  onPointerDown(e: PointerEvent): void {
    if (this.tracked.has(e.pointerId)) return;
    const info: PointerInfo = {
      id: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
    };

    this.tracked.set(e.pointerId, {
      info,
      start: { x: e.clientX, y: e.clientY },
      history: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    });
  }

  onPointerMove(e: PointerEvent): void {
    const tp = this.tracked.get(e.pointerId);
    if (!tp) return;

    tp.info = {
      id: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
    };

    tp.history.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });

    // Trim history older than the velocity window
    const cutoff = e.timeStamp - this.velocityWindowMs;

    while (tp.history.length > 2 && tp.history[0].t < cutoff) {
      tp.history.shift();
    }
  }

  onPointerUp(e: PointerEvent): void {
    this.tracked.delete(e.pointerId);
  }

  onPointerCancel(e: PointerEvent): void {
    this.tracked.delete(e.pointerId);
  }

  getStartPosition(pointerId: number): Point | undefined {
    return this.tracked.get(pointerId)?.start;
  }

  getVelocity(pointerId: number): { x: number; y: number } {
    const tp = this.tracked.get(pointerId);
    if (!tp || tp.history.length < 2) {
      return { x: 0, y: 0 };
    }

    const first = tp.history[0];
    const last = tp.history[tp.history.length - 1];
    const dt = last.t - first.t;

    if (dt === 0) return { x: 0, y: 0 };

    return {
      x: (last.x - first.x) / dt,
      y: (last.y - first.y) / dt,
    };
  }

  getCenter(): Point {
    if (this.tracked.size === 0) return { x: 0, y: 0 };

    let sumX = 0;
    let sumY = 0;
    for (const tp of this.tracked.values()) {
      sumX += tp.info.clientX;
      sumY += tp.info.clientY;
    }

    return {
      x: sumX / this.tracked.size,
      y: sumY / this.tracked.size,
    };
  }

  getDistance(): number {
    if (this.tracked.size < 2) return 0;

    const ptrs = Array.from(this.tracked.values());
    const a = ptrs[0].info;
    const b = ptrs[1].info;
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  getAngle(): number {
    if (this.tracked.size < 2) return 0;

    const ptrs = Array.from(this.tracked.values());
    const a = ptrs[0].info;
    const b = ptrs[1].info;
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;

    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  reset(): void {
    this.tracked.clear();
  }
}
