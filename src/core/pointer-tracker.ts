import type { PointerInfo, Point, TrackedPointer } from './models/types';

/**
 * Tracks active pointers and computes derived multi-touch geometry.
 *
 * Maintains a per-pointer history window used for velocity estimation,
 * and exposes helpers for center, distance, and angle between pointers.
 */
export class PointerTracker {
  private tracked = new Map<number, TrackedPointer>();
  private readonly velocityWindowMs = 100;

  /** Number of pointers currently being tracked. */
  get count(): number {
    return this.tracked.size;
  }

  /** Snapshot of every pointer currently being tracked. */
  get pointers(): PointerInfo[] {
    return Array.from(this.tracked.values()).map((t) => t.info);
  }

  /** Begin tracking a new pointer. Ignored if the pointer is already tracked. */
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

  /** Update a tracked pointer's position and append to its history window. */
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

  /** Stop tracking a pointer when it is released. */
  onPointerUp(e: PointerEvent): void {
    this.tracked.delete(e.pointerId);
  }

  /** Stop tracking a pointer when it is cancelled. */
  onPointerCancel(e: PointerEvent): void {
    this.tracked.delete(e.pointerId);
  }

  /**
   * Get the position where a pointer initially went down.
   *
   * @param pointerId - The `PointerEvent.pointerId` to look up.
   * @returns The start position, or `undefined` if the pointer is not tracked.
   */
  getStartPosition(pointerId: number): Point | undefined {
    return this.tracked.get(pointerId)?.start;
  }

  /**
   * Compute the velocity (px/ms) of a tracked pointer over the recent history window.
   *
   * @param pointerId - The `PointerEvent.pointerId` to look up.
   * @returns Velocity vector `{ x, y }` in pixels per millisecond, or `{ 0, 0 }` if unavailable.
   */
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

  /**
   * Compute the centroid of all currently tracked pointers.
   *
   * @returns The center point, or `{ 0, 0 }` if no pointers are tracked.
   */
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

  /**
   * Compute the Euclidean distance (px) between the first two tracked pointers.
   *
   * @returns The distance in pixels, or `0` if fewer than two pointers are tracked.
   */
  getDistance(): number {
    if (this.tracked.size < 2) return 0;

    const ptrs = Array.from(this.tracked.values());
    const a = ptrs[0].info;
    const b = ptrs[1].info;
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Compute the angle (degrees) between the first two tracked pointers.
   *
   * @returns The angle in degrees (`-180` to `180`), or `0` if fewer than two pointers are tracked.
   */
  getAngle(): number {
    if (this.tracked.size < 2) return 0;

    const ptrs = Array.from(this.tracked.values());
    const a = ptrs[0].info;
    const b = ptrs[1].info;
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;

    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  /** Remove all tracked pointers. */
  reset(): void {
    this.tracked.clear();
  }
}
