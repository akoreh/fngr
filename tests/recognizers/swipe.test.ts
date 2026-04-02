import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwipeRecognizer, swipe } from '../../src/recognizers/swipe';
import { Manager } from '../../src/core/manager';
import { RecognizerState } from '../../src/core/models/types';
import { fire } from '../helpers/pointer';

describe('SwipeRecognizer', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
  });

  /**
   * Simulate a swipe gesture with proper timeStamp values for velocity calculation.
   * PointerTracker.getVelocity uses timeStamp, so we must set it on each event.
   */
  function simulateSwipe(
    target: Element,
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationMs = 50,
    opts: { pointerId?: number } = {},
  ) {
    const steps = 5;
    const pointerId = opts.pointerId ?? 1;

    fire(target, 'pointerdown', {
      clientX: from.x,
      clientY: from.y,
      pointerId,
      timeStamp: 0,
    });

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      fire(target, 'pointermove', {
        clientX: from.x + (to.x - from.x) * t,
        clientY: from.y + (to.y - from.y) * t,
        pointerId,
        timeStamp: (durationMs / steps) * i,
      });
    }

    fire(target, 'pointerup', {
      clientX: to.x,
      clientY: to.y,
      pointerId,
      timeStamp: durationMs,
    });
  }

  describe('directional detection', () => {
    it('detects right swipe', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('right');
    });

    it('detects left swipe', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 200, y: 100 }, { x: 50, y: 100 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('left');
    });

    it('detects down swipe', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 100, y: 50 }, { x: 100, y: 200 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('down');
    });

    it('detects up swipe', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 100, y: 200 }, { x: 100, y: 50 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('up');
    });

    it('uses dominant axis for diagonal swipe', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      // dx=150, dy=50 → horizontal dominant → right
      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 150 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('right');
    });

    it('diagonal with dominant Y axis detects vertical', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      // dx=50, dy=150 → vertical dominant → down
      simulateSwipe(el, { x: 100, y: 50 }, { x: 150, y: 200 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('down');
    });
  });

  describe('distance threshold', () => {
    it('does not fire if distance is below threshold', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 100, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 80, y: 100 }); // 30px < 100px

      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('fires when distance exceeds threshold', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 }); // 150px > 30px

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('uses default threshold of 30px when none specified', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 70, y: 100 }); // 20px < 30px
      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('fires at distance just above threshold', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 81, y: 100 }); // 31px > 30px

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('fires at distance exactly at threshold (boundary is inclusive)', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      // Exactly 30px — should fire since distance >= threshold
      simulateSwipe(el, { x: 50, y: 100 }, { x: 80, y: 100 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });
  });

  describe('velocity threshold', () => {
    it('does not fire if velocity is below minimum', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10, velocity: 5 }));

      // Slow: 100px over 1000ms = 0.1 px/ms, well below 5
      simulateSwipe(el, { x: 50, y: 100 }, { x: 150, y: 100 }, 1000);

      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('fires if velocity exceeds minimum', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10, velocity: 1 }));

      // Fast: 150px over 50ms = 3 px/ms, above 1
      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 }, 50);

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('uses default velocity of 0.3 px/ms when none specified', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10 }));

      // Very slow: 50px over 1000ms = 0.05 px/ms < 0.3
      simulateSwipe(el, { x: 50, y: 100 }, { x: 100, y: 100 }, 1000);
      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('velocity is measured as px/ms', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 }, 50);

      const event = onSwipe.mock.calls[0][0];
      // ~150px / 50ms = ~3 px/ms
      expect(event.velocity).toBeGreaterThan(1);
    });
  });

  describe('direction filtering', () => {
    it('fires for horizontal when direction is horizontal', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(
        new SwipeRecognizer({
          onSwipe,
          threshold: 30,
          velocity: 0,
          direction: 'horizontal',
        }),
      );

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('does not fire for vertical when direction is horizontal', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(
        new SwipeRecognizer({
          onSwipe,
          threshold: 30,
          velocity: 0,
          direction: 'horizontal',
        }),
      );

      simulateSwipe(el, { x: 100, y: 50 }, { x: 100, y: 200 });
      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('fires for vertical when direction is vertical', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(
        new SwipeRecognizer({
          onSwipe,
          threshold: 30,
          velocity: 0,
          direction: 'vertical',
        }),
      );

      simulateSwipe(el, { x: 100, y: 50 }, { x: 100, y: 200 });
      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('does not fire for horizontal when direction is vertical', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(
        new SwipeRecognizer({
          onSwipe,
          threshold: 30,
          velocity: 0,
          direction: 'vertical',
        }),
      );

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('fires for any direction when direction is all', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(
        new SwipeRecognizer({
          onSwipe,
          threshold: 30,
          velocity: 0,
          direction: 'all',
        }),
      );

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('defaults to all directions when not specified', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 100, y: 50 }, { x: 100, y: 200 }); // vertical
      expect(onSwipe).toHaveBeenCalledTimes(1);
    });
  });

  describe('event shape', () => {
    it('includes all required fields', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });

      const event = onSwipe.mock.calls[0][0];
      expect(event.type).toBe('swipe');
      expect(event.direction).toBe('right');
      expect(event.distance).toBeCloseTo(150, 0);
      expect(event.velocity).toBeGreaterThan(0);
      expect(event.target).toBe(el);
      expect(event.pointers).toHaveLength(1);
      expect(event.pointers[0].clientX).toBe(200);
      expect(event.pointers[0].clientY).toBe(100);
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.srcEvent).toBeInstanceOf(PointerEvent);
      expect(typeof event.preventDefault).toBe('function');
    });

    it('distance is Euclidean', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10, velocity: 0 }));

      // dx=30, dy=40 → distance = 50
      simulateSwipe(el, { x: 50, y: 50 }, { x: 80, y: 90 });

      const event = onSwipe.mock.calls[0][0];
      expect(event.distance).toBeCloseTo(50, 0);
    });

    it('preventDefault calls srcEvent.preventDefault', () => {
      const captured: Array<() => void> = [];
      const mgr = new Manager(el);
      mgr.add(
        new SwipeRecognizer({
          onSwipe: (e) => captured.push(e.preventDefault),
          threshold: 10,
          velocity: 0,
        }),
      );

      // Manually fire events to capture the pointerup event for spy
      fire(el, 'pointerdown', { clientX: 50, clientY: 100, timeStamp: 0 });
      fire(el, 'pointermove', { clientX: 100, clientY: 100, timeStamp: 10 });
      fire(el, 'pointermove', { clientX: 200, clientY: 100, timeStamp: 20 });
      const upEvent = fire(el, 'pointerup', { clientX: 200, clientY: 100, timeStamp: 30 });

      expect(captured).toHaveLength(1);
      const preventSpy = vi.spyOn(upEvent, 'preventDefault');
      captured[0]();
      expect(preventSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('CustomEvent dispatch', () => {
    it('dispatches fngr:swipe on the element', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:swipe', listener);

      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('CustomEvent detail contains gesture event', () => {
      let capturedDetail: any = null;
      el.addEventListener('fngr:swipe', (e: Event) => {
        capturedDetail = (e as CustomEvent).detail;
      });

      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });

      expect(capturedDetail).not.toBeNull();
      expect(capturedDetail.type).toBe('swipe');
      expect(capturedDetail.direction).toBe('right');
    });

    it('CustomEvent bubbles', () => {
      const parent = document.createElement('div');
      parent.appendChild(el);
      const listener = vi.fn();
      parent.addEventListener('fngr:swipe', listener);

      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('state machine', () => {
    it('starts in Idle', () => {
      const rec = new SwipeRecognizer({ threshold: 30 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('transitions to Possible on pointerdown', () => {
      const rec = new SwipeRecognizer({ threshold: 30 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 100 });
      expect(rec.state).toBe(RecognizerState.Possible);
    });

    it('returns to Idle after successful swipe', () => {
      const rec = new SwipeRecognizer({ threshold: 30, velocity: 0 });
      const mgr = new Manager(el);
      mgr.add(rec);

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('returns to Idle after failed swipe (too short)', () => {
      const rec = new SwipeRecognizer({ threshold: 100, velocity: 0 });
      const mgr = new Manager(el);
      mgr.add(rec);

      simulateSwipe(el, { x: 50, y: 100 }, { x: 60, y: 100 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('two sequential swipes both fire', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      // First swipe right
      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      // Second swipe left (starts where the first ended)
      simulateSwipe(el, { x: 200, y: 100 }, { x: 50, y: 100 }, 50);

      expect(onSwipe).toHaveBeenCalledTimes(2);
      expect(onSwipe.mock.calls[0][0].direction).toBe('right');
      expect(onSwipe.mock.calls[1][0].direction).toBe('left');
    });

    it('returns to Idle after pointercancel', () => {
      const rec = new SwipeRecognizer({ threshold: 30 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 100 });
      fire(el, 'pointermove', { clientX: 100, clientY: 100 });
      fire(el, 'pointercancel', { clientX: 100, clientY: 100 });

      expect(rec.state).toBe(RecognizerState.Idle);
    });
  });

  describe('pointer cancel', () => {
    it('does not fire on pointercancel', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 100, timeStamp: 0 });
      fire(el, 'pointermove', { clientX: 200, clientY: 100, timeStamp: 20 });
      fire(el, 'pointercancel', { clientX: 200, clientY: 100 });

      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('does not fail on pointercancel from a different pointer', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 100, pointerId: 1, timeStamp: 0 });
      fire(el, 'pointermove', { clientX: 200, clientY: 100, pointerId: 1, timeStamp: 20 });
      fire(el, 'pointercancel', { clientX: 0, clientY: 0, pointerId: 2 });
      fire(el, 'pointerup', { clientX: 200, clientY: 100, pointerId: 1, timeStamp: 30 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });
  });

  describe('pointer ID tracking', () => {
    it('only tracks the first pointer', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 100, pointerId: 1, timeStamp: 0 });
      fire(el, 'pointerdown', { clientX: 50, clientY: 100, pointerId: 2, timeStamp: 0 });
      fire(el, 'pointermove', { clientX: 200, clientY: 100, pointerId: 1, timeStamp: 20 });
      fire(el, 'pointerup', { clientX: 200, clientY: 100, pointerId: 1, timeStamp: 30 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('ignores pointerup from other pointer', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 100, pointerId: 1, timeStamp: 0 });
      fire(el, 'pointermove', { clientX: 200, clientY: 100, pointerId: 1, timeStamp: 20 });
      fire(el, 'pointerup', { clientX: 200, clientY: 100, pointerId: 2, timeStamp: 30 });

      expect(onSwipe).not.toHaveBeenCalled();
    });
  });

  describe('convenience function', () => {
    it('swipe() returns a cleanup function', () => {
      const onSwipe = vi.fn();
      const off = swipe(el, onSwipe);

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      expect(onSwipe).toHaveBeenCalledTimes(1);

      off();
      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('accepts options object', () => {
      const onSwipe = vi.fn();
      const off = swipe(el, {
        onSwipe,
        threshold: 10,
        velocity: 0,
        direction: 'horizontal',
      });

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      expect(onSwipe).toHaveBeenCalledTimes(1);

      off();
    });

    it('cleanup restores touch-action', () => {
      el.style.touchAction = 'auto';
      const off = swipe(el, () => {});

      expect(el.style.touchAction).toBe('none');

      off();
      expect(el.style.touchAction).toBe('auto');
    });

    it('multiple swipe on same element shares Manager', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const off1 = swipe(el, { onSwipe: fn1, threshold: 30, velocity: 0 });
      const off2 = swipe(el, { onSwipe: fn2, threshold: 30, velocity: 0 });

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      off1();
      off2();
    });

    it('double cleanup is safe', () => {
      const off = swipe(el, () => {});
      off();
      expect(() => off()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('multiple swipe cycles work correctly', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      simulateSwipe(el, { x: 200, y: 100 }, { x: 50, y: 100 });

      expect(onSwipe).toHaveBeenCalledTimes(2);
      expect(onSwipe.mock.calls[0][0].direction).toBe('right');
      expect(onSwipe.mock.calls[1][0].direction).toBe('left');
    });

    it('no movement results in failure', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 100, timeStamp: 0 });
      fire(el, 'pointerup', { clientX: 50, clientY: 100, timeStamp: 50 });

      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('destroyed recognizer does not fire', () => {
      const onSwipe = vi.fn();
      const rec = new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 });
      const mgr = new Manager(el);
      mgr.add(rec);

      mgr.remove(rec);
      rec.destroy();

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 });
      expect(onSwipe).not.toHaveBeenCalled();
    });
  });

  describe('mutation killers', () => {
    it('distance uses dx*dx not dx+dx', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      // dx=25, dy=20 → dx*dx + dy*dy = 625 + 400 = 1025, sqrt ≈ 32.0 > 30 (pass)
      // dx+dx + dy+dy = 50 + 40 = 90, sqrt ≈ 9.5 < 30 (fail — DIFFERENT)
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 50 }, { x: 75, y: 70 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('distance uses dy*dy not dy*dx', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      // dx=5, dy=30 → dx*dx + dy*dy = 25 + 900 = 925, sqrt ≈ 30.4 > 30 (pass)
      // dx*dx + dy*dx = 25 + 150 = 175, sqrt ≈ 13.2 < 30 (fail — DIFFERENT)
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 50 }, { x: 55, y: 80 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('custom threshold is applied (not default)', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      // Use threshold=50, movement of 40px should fail with 50 but pass with default 30
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 50, velocity: 0 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 90, y: 100 }); // 40px < 50

      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('custom velocity is applied (not default)', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      // velocity=2, movement 150px / 50ms = 3 px/ms should pass
      // but with default 0.3 it would also pass, so test the other way:
      // velocity=10, movement 150px / 50ms = 3 px/ms should fail
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10, velocity: 10 }));

      simulateSwipe(el, { x: 50, y: 100 }, { x: 200, y: 100 }, 50);

      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('direction comparison uses abs(dx) > abs(dy) not dx > dy', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      // Left swipe: dx=-150 (negative!), dy=10
      // abs(dx)=150 > abs(dy)=10 → horizontal → left
      // Without abs: dx=-150 < dy=10 → would incorrectly say vertical
      simulateSwipe(el, { x: 200, y: 100 }, { x: 50, y: 110 });

      expect(onSwipe.mock.calls[0][0].direction).toBe('left');
    });

    it('threshold check uses < not <= (distance at threshold passes)', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 30, velocity: 0 }));

      // Exactly 30px — should pass (>= threshold)
      simulateSwipe(el, { x: 50, y: 100 }, { x: 80, y: 100 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('speed sqrt uses + not - for vel.y component', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      // Diagonal swipe where Y velocity contributes significantly
      // vel.x*vel.x + vel.y*vel.y → positive, sqrt is real
      // vel.x*vel.x - vel.y*vel.y → could be ≤ 0 if vel.y > vel.x, sqrt is NaN
      // NaN < threshold → false, NaN >= threshold → false → would fail
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10, velocity: 0.1 }));

      // Predominantly vertical swipe — Y velocity larger than X
      simulateSwipe(el, { x: 100, y: 50 }, { x: 110, y: 200 }, 50);

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('horizontal filter allows left swipe (kills dir === "" mutant)', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(
        new SwipeRecognizer({
          onSwipe,
          threshold: 30,
          velocity: 0,
          direction: 'horizontal',
        }),
      );

      simulateSwipe(el, { x: 200, y: 100 }, { x: 50, y: 100 }); // left
      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('left');
    });

    it('vertical filter allows up swipe (kills dir === "" mutant)', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(
        new SwipeRecognizer({
          onSwipe,
          threshold: 30,
          velocity: 0,
          direction: 'vertical',
        }),
      );

      simulateSwipe(el, { x: 100, y: 200 }, { x: 100, y: 50 }); // up
      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('up');
    });

    it('45-degree diagonal defaults to vertical (> not >=)', () => {
      const onSwipe = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new SwipeRecognizer({ onSwipe, threshold: 10, velocity: 0 }));

      // dx=100, dy=100 → abs equal → abs(dx) > abs(dy) is false → vertical branch
      simulateSwipe(el, { x: 50, y: 50 }, { x: 150, y: 150 });

      expect(onSwipe).toHaveBeenCalledTimes(1);
      expect(onSwipe.mock.calls[0][0].direction).toBe('down');
    });
  });
});
