import { describe, it, expect, beforeEach } from 'vitest';
import { PointerTracker } from '../../src/core/pointer-tracker';

function makePointerEvent(
  type: string,
  overrides: Partial<PointerEventInit & { pointerId: number; timeStamp: number }> = {},
): PointerEvent {
  const e = new PointerEvent(type, {
    pointerId: overrides.pointerId ?? 1,
    clientX: overrides.clientX ?? 0,
    clientY: overrides.clientY ?? 0,
    pointerType: overrides.pointerType ?? 'touch',
    isPrimary: overrides.isPrimary ?? true,
    bubbles: true,
  });
  // Override timeStamp if provided
  if (overrides.timeStamp !== undefined) {
    Object.defineProperty(e, 'timeStamp', { value: overrides.timeStamp });
  }
  return e;
}

describe('PointerTracker', () => {
  let tracker: PointerTracker;

  beforeEach(() => {
    tracker = new PointerTracker();
  });

  describe('pointer management', () => {
    it('starts with zero active pointers', () => {
      expect(tracker.count).toBe(0);
      expect(tracker.pointers).toEqual([]);
    });

    it('tracks a pointer on pointerdown', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', {
          pointerId: 1,
          clientX: 100,
          clientY: 200,
        }),
      );
      expect(tracker.count).toBe(1);
      expect(tracker.pointers[0].id).toBe(1);
      expect(tracker.pointers[0].clientX).toBe(100);
      expect(tracker.pointers[0].clientY).toBe(200);
    });

    it('updates pointer position on pointermove', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', {
          pointerId: 1,
          clientX: 100,
          clientY: 200,
        }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', {
          pointerId: 1,
          clientX: 150,
          clientY: 250,
        }),
      );
      expect(tracker.pointers[0].clientX).toBe(150);
      expect(tracker.pointers[0].clientY).toBe(250);
    });

    it('removes pointer on pointerup', () => {
      tracker.onPointerDown(makePointerEvent('pointerdown', { pointerId: 1 }));
      tracker.onPointerUp(makePointerEvent('pointerup', { pointerId: 1 }));
      expect(tracker.count).toBe(0);
    });

    it('removes pointer on pointercancel', () => {
      tracker.onPointerDown(makePointerEvent('pointerdown', { pointerId: 1 }));
      tracker.onPointerCancel(makePointerEvent('pointercancel', { pointerId: 1 }));
      expect(tracker.count).toBe(0);
    });

    it('tracks multiple pointers simultaneously', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }),
      );
      expect(tracker.count).toBe(2);
    });

    it('only removes the correct pointer', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }),
      );
      tracker.onPointerUp(makePointerEvent('pointerup', { pointerId: 1 }));
      expect(tracker.count).toBe(1);
      expect(tracker.pointers[0].id).toBe(2);
    });

    it('ignores pointermove for untracked pointers', () => {
      tracker.onPointerMove(makePointerEvent('pointermove', { pointerId: 99, clientX: 500 }));
      expect(tracker.count).toBe(0);
    });

    it('resets all pointers', () => {
      tracker.onPointerDown(makePointerEvent('pointerdown', { pointerId: 1 }));
      tracker.onPointerDown(makePointerEvent('pointerdown', { pointerId: 2 }));
      tracker.reset();
      expect(tracker.count).toBe(0);
      expect(tracker.pointers).toEqual([]);
    });
  });

  describe('start position', () => {
    it('records the start position of a pointer', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 50, clientY: 75 }),
      );
      expect(tracker.getStartPosition(1)).toEqual({ x: 50, y: 75 });
    });

    it('start position does not change on move', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 50, clientY: 75 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 200, clientY: 300 }),
      );
      expect(tracker.getStartPosition(1)).toEqual({ x: 50, y: 75 });
    });

    it('returns undefined for unknown pointer', () => {
      expect(tracker.getStartPosition(99)).toBeUndefined();
    });
  });

  describe('velocity', () => {
    it('returns zero velocity with no movement', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, timeStamp: 0 }),
      );
      expect(tracker.getVelocity(1)).toEqual({ x: 0, y: 0 });
    });

    it('computes velocity from movement history', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 0, timeStamp: 100 }),
      );
      const vel = tracker.getVelocity(1);
      expect(vel.x).toBeCloseTo(1.0, 1); // 100px / 100ms
      expect(vel.y).toBeCloseTo(0, 1);
    });

    it('uses windowed average for velocity', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 }),
      );
      // Old movement (outside window)
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 1000, clientY: 0, timeStamp: 10 }),
      );
      // Recent movement (inside window)
      tracker.onPointerMove(
        makePointerEvent('pointermove', {
          pointerId: 1,
          clientX: 1050,
          clientY: 0,
          timeStamp: 200,
        }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', {
          pointerId: 1,
          clientX: 1100,
          clientY: 0,
          timeStamp: 250,
        }),
      );
      const vel = tracker.getVelocity(1);
      expect(vel.x).toBeCloseTo(1.0, 1); // 50px / 50ms
    });

    it('returns zero velocity for unknown pointer', () => {
      expect(tracker.getVelocity(99)).toEqual({ x: 0, y: 0 });
    });

    it('computes y-axis velocity independently from x', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 200, timeStamp: 100 }),
      );
      const vel = tracker.getVelocity(1);
      expect(vel.x).toBeCloseTo(0, 1);
      expect(vel.y).toBeCloseTo(2.0, 1); // 200px / 100ms
    });

    it('returns zero velocity when time delta is zero', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 100 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 50, timeStamp: 100 }),
      );
      const vel = tracker.getVelocity(1);
      expect(vel.x).toBe(0);
      expect(vel.y).toBe(0);
    });

    it('trims old history entries outside velocity window', () => {
      // Window is 100ms. At t=100, cutoff = 100-100 = 0.
      // t=0 entry: 0 < 0 is false → kept. All 4 entries kept.
      // velocity = (200-0)/(100-0) = 2.0
      //
      // With wrong cutoff (ts+window = 200):
      //   All entries have t < 200, trim aggressively to length=2.
      //   Only [{t=80,x=100},{t=100,x=200}] remain → velocity = 100/20 = 5.0
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 50 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 0, timeStamp: 80 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 200, clientY: 0, timeStamp: 100 }),
      );

      const vel = tracker.getVelocity(1);
      expect(vel.x).toBeCloseTo(2.0, 1);
    });

    it('preserves at least 2 history entries even when all are old', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 0, timeStamp: 10 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 0, timeStamp: 20 }),
      );
      // Big time jump — all prior entries are outside the 100ms window
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 200, clientY: 0, timeStamp: 500 }),
      );

      const vel = tracker.getVelocity(1);
      // Old entries trimmed to 2: [{t=20,x=100}, {t=500,x=200}]
      // velocity = 100/480 ≈ 0.208
      // If length >= 2 mutant: would trim to 1, getVelocity returns 0
      expect(vel.x).toBeCloseTo(0.208, 1);
    });

    it('velocity computed from single history entry returns zero', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 200, timeStamp: 0 }),
      );
      // Only one history entry (the initial down), no moves
      const vel = tracker.getVelocity(1);
      expect(vel.x).toBe(0);
      expect(vel.y).toBe(0);
    });

    it('y-axis velocity uses subtraction not addition', () => {
      // With non-zero start, (last.y - first.y) !== (last.y + first.y)
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 100, timeStamp: 0 }),
      );
      tracker.onPointerMove(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 200, timeStamp: 100 }),
      );
      const vel = tracker.getVelocity(1);
      // (200-100)/100 = 1.0, not (200+100)/100 = 3.0
      expect(vel.y).toBeCloseTo(1.0, 1);
    });
  });

  describe('multi-touch geometry', () => {
    it('computes center between two pointers', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
      );
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 }),
      );
      expect(tracker.getCenter()).toEqual({ x: 100, y: 50 });
    });

    it('computes distance between two pointers', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
      );
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 2, clientX: 300, clientY: 400 }),
      );
      expect(tracker.getDistance()).toBeCloseTo(500, 1); // 3-4-5 triangle
    });

    it('computes distance with asymmetric non-origin coordinates', () => {
      // Non-zero start ensures b-a !== b+a
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 50, clientY: 30 }),
      );
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 2, clientX: 90, clientY: 60 }),
      );
      // dx=40, dy=30 → distance = 50
      expect(tracker.getDistance()).toBeCloseTo(50, 1);
    });

    it('computes angle between two pointers', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
      );
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 2, clientX: 100, clientY: 0 }),
      );
      expect(tracker.getAngle()).toBeCloseTo(0, 5);
    });

    it('computes 90-degree angle', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
      );
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 2, clientX: 0, clientY: 100 }),
      );
      expect(tracker.getAngle()).toBeCloseTo(90, 5);
    });

    it('computes angle with asymmetric non-origin coordinates', () => {
      // Non-zero start at (100, 50), end at (200, 150)
      // dx=100, dy=100 → atan2(100, 100) = 45°
      // With addition: dx=300, dy=200 → atan2(200, 300) ≈ 33.7° (wrong)
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 50 }),
      );
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 150 }),
      );
      expect(tracker.getAngle()).toBeCloseTo(45, 1);
    });

    it('returns zero center with no pointers', () => {
      expect(tracker.getCenter()).toEqual({ x: 0, y: 0 });
    });

    it('returns zero distance with fewer than 2 pointers', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 }),
      );
      expect(tracker.getDistance()).toBe(0);
    });

    it('returns zero angle with fewer than 2 pointers', () => {
      expect(tracker.getAngle()).toBe(0);
    });

    it('center with single pointer is that pointer', () => {
      tracker.onPointerDown(
        makePointerEvent('pointerdown', { pointerId: 1, clientX: 75, clientY: 125 }),
      );
      expect(tracker.getCenter()).toEqual({ x: 75, y: 125 });
    });
  });
});
