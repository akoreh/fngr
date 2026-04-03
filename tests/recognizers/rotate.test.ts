import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Manager } from '../../src/core/manager';
import { RecognizerState } from '../../src/core/models/types';
import { fire } from '../helpers/pointer';
import { RotateRecognizer, rotate } from '../../src/recognizers/rotate';

describe('RotateRecognizer', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  // --- Two-finger helpers ---

  function twoFingerDown(target: Element, x1: number, y1: number, x2: number, y2: number) {
    fire(target, 'pointerdown', {
      pointerId: 1,
      clientX: x1,
      clientY: y1,
      pointerType: 'touch',
      isPrimary: true,
    });
    fire(target, 'pointerdown', {
      pointerId: 2,
      clientX: x2,
      clientY: y2,
      pointerType: 'touch',
      isPrimary: false,
    });
  }

  function twoFingerUp(target: Element) {
    fire(target, 'pointerup', { pointerId: 1, pointerType: 'touch' });
    fire(target, 'pointerup', { pointerId: 2, pointerType: 'touch' });
  }

  // =========================================================================
  // Basic rotation detection
  // =========================================================================

  describe('basic rotation detection', () => {
    it('fires rotatestart when two pointers rotate past threshold', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      // Horizontal: pointer1 left, pointer2 right (angle = 0°)
      twoFingerDown(el, 100, 150, 200, 150);
      // Rotate clockwise: pointer1 moves up, pointer2 moves down
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(onRotatestart).toHaveBeenCalledTimes(1);
      expect(onRotatestart.mock.calls[0][0].type).toBe('rotatestart');
    });

    it('fires rotatemove on continued rotation', () => {
      const onRotatemove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatemove }));

      twoFingerDown(el, 100, 150, 200, 150);
      // First move triggers rotatestart
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      // Second move triggers rotatemove
      fire(el, 'pointermove', {
        pointerId: 2,
        clientX: 170,
        clientY: 190,
        pointerType: 'touch',
      });

      expect(onRotatemove).toHaveBeenCalled();
    });

    it('fires rotateend on pointer up during active rotation', () => {
      const onRotateend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotateend }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      twoFingerUp(el);

      expect(onRotateend).toHaveBeenCalledTimes(1);
      expect(onRotateend.mock.calls[0][0].type).toBe('rotateend');
    });

    it('fires rotatecancel on pointer cancel during active rotation', () => {
      const onRotatecancel = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatecancel }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      fire(el, 'pointercancel', { pointerId: 1, pointerType: 'touch' });

      expect(onRotatecancel).toHaveBeenCalledTimes(1);
      expect(onRotatecancel.mock.calls[0][0].type).toBe('rotatecancel');
    });
  });

  // =========================================================================
  // Rotation calculation
  // =========================================================================

  describe('rotation calculation', () => {
    it('rotation is 0 at initial angle', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      // Start horizontal
      twoFingerDown(el, 100, 150, 200, 150);
      // Small rotation
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      // Rotation should be non-zero (some clockwise rotation happened)
      expect(onRotatestart.mock.calls[0][0].rotation).not.toBe(0);
    });

    it('clockwise rotation produces positive values', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      // Pointer 1 at left (100, 150), pointer 2 at right (200, 150) → angle ≈ 0°
      twoFingerDown(el, 100, 150, 200, 150);
      // Move pointer 1 up-right → rotates clockwise
      // New angle: atan2(190-110, 200-130) ≈ atan2(80, 70) ≈ 48.8°
      // But wait, angle goes from ptr1 to ptr2: atan2(y2-y1, x2-x1)
      // Initial: atan2(0, 100) = 0°
      // After: pointer1 at (130, 110), pointer2 still at (200, 150)
      // atan2(150-110, 200-130) = atan2(40, 70) ≈ 29.7°
      // Delta = 29.7 - 0 = 29.7° ... but that's not CW.
      // Actually need to think about what "clockwise" means.
      // atan2 uses screen coords (y-down), so positive angle = CW
      // Moving pointer1 up (lower y) while keeping pointer2 fixed:
      // angle from p1 to p2 increases → positive delta → CW
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(onRotatestart.mock.calls[0][0].rotation).toBeGreaterThan(0);
    });

    it('counterclockwise rotation produces negative values', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      twoFingerDown(el, 100, 150, 200, 150);
      // Move pointer 1 down → counterclockwise
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 190,
        pointerType: 'touch',
      });

      expect(onRotatestart.mock.calls[0][0].rotation).toBeLessThan(0);
    });

    it('deltaRotation tracks change between events', () => {
      const onRotatestart = vi.fn();
      const onRotatemove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart, onRotatemove }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      const startRotation = onRotatestart.mock.calls[0][0].rotation;
      const startDelta = onRotatestart.mock.calls[0][0].deltaRotation;
      // On rotatestart, deltaRotation equals rotation (since last was 0)
      expect(startDelta).toBeCloseTo(startRotation, 1);

      // Continue rotating
      fire(el, 'pointermove', {
        pointerId: 2,
        clientX: 170,
        clientY: 190,
        pointerType: 'touch',
      });

      const moveEvent = onRotatemove.mock.calls[0][0];
      // deltaRotation = current rotation - previous rotation
      expect(moveEvent.deltaRotation).toBeCloseTo(moveEvent.rotation - startRotation, 1);
    });

    it('90-degree clockwise rotation', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      // Start: pointer2 directly right of pointer1
      // atan2(0, 100) = 0°
      twoFingerDown(el, 150, 150, 250, 150);
      // Rotate ~90° CW: pointer2 directly below pointer1
      // atan2(100, 0) = 90°
      fire(el, 'pointermove', {
        pointerId: 2,
        clientX: 150,
        clientY: 250,
        pointerType: 'touch',
      });

      expect(onRotatestart.mock.calls[0][0].rotation).toBeCloseTo(90, 0);
    });
  });

  // =========================================================================
  // Center point
  // =========================================================================

  describe('center point', () => {
    it('center is midpoint between two pointers', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      twoFingerDown(el, 100, 100, 200, 200);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 80,
        clientY: 120,
        pointerType: 'touch',
      });

      const center = onRotatestart.mock.calls[0][0].center;
      // Center of (80, 120) and (200, 200) = (140, 160)
      expect(center.x).toBeCloseTo(140, 0);
      expect(center.y).toBeCloseTo(160, 0);
    });
  });

  // =========================================================================
  // Requires two pointers
  // =========================================================================

  describe('requires two pointers', () => {
    it('does not start with single pointer', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      fire(el, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { pointerId: 1, clientX: 200, clientY: 200 });

      expect(onRotatestart).not.toHaveBeenCalled();
    });

    it('starts when second pointer arrives', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      fire(el, 'pointerdown', {
        pointerId: 1,
        clientX: 100,
        clientY: 150,
        pointerType: 'touch',
      });
      fire(el, 'pointerdown', {
        pointerId: 2,
        clientX: 200,
        clientY: 150,
        pointerType: 'touch',
      });
      // Now rotate
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(onRotatestart).toHaveBeenCalledTimes(1);
    });

    it('ends when one pointer lifts during active rotation', () => {
      const onRotateend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotateend }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      fire(el, 'pointerup', { pointerId: 1, pointerType: 'touch' });

      expect(onRotateend).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Threshold
  // =========================================================================

  describe('threshold', () => {
    it('does not fire below rotation threshold', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart, threshold: 30 }));

      twoFingerDown(el, 100, 150, 200, 150);
      // Tiny rotation — ~5°
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 105,
        clientY: 141,
        pointerType: 'touch',
      });

      expect(onRotatestart).not.toHaveBeenCalled();
    });

    it('fires once threshold is exceeded', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart, threshold: 10 }));

      twoFingerDown(el, 100, 150, 200, 150);
      // Small rotation — under threshold
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 105,
        clientY: 145,
        pointerType: 'touch',
      });
      expect(onRotatestart).not.toHaveBeenCalled();

      // Larger rotation — over threshold
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      expect(onRotatestart).toHaveBeenCalledTimes(1);
    });

    it('default threshold of 0 fires on any rotation', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      twoFingerDown(el, 100, 150, 200, 150);
      // Tiny 1px vertical offset → minimal rotation
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 100,
        clientY: 149,
        pointerType: 'touch',
      });

      expect(onRotatestart).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // State machine
  // =========================================================================

  describe('state machine', () => {
    it('starts in Idle', () => {
      const rec = new RotateRecognizer({});
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('transitions Idle → Possible on two pointers down', () => {
      const rec = new RotateRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      twoFingerDown(el, 100, 150, 200, 150);
      expect(rec.state).toBe(RecognizerState.Possible);
    });

    it('transitions Possible → Began on threshold crossing', () => {
      const rec = new RotateRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      expect(rec.state).toBe(RecognizerState.Began);
    });

    it('transitions Began → Changed on continued movement', () => {
      const rec = new RotateRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      fire(el, 'pointermove', {
        pointerId: 2,
        clientX: 170,
        clientY: 190,
        pointerType: 'touch',
      });
      expect(rec.state).toBe(RecognizerState.Changed);
    });

    it('transitions to Ended on pointer up, then resets to Idle', () => {
      const rec = new RotateRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      twoFingerUp(el);
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('transitions to Cancelled on pointer cancel, then resets to Idle', () => {
      const rec = new RotateRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      fire(el, 'pointercancel', { pointerId: 1, pointerType: 'touch' });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('resets fully after complete lifecycle', () => {
      const onRotatestart = vi.fn();
      const rec = new RotateRecognizer({ onRotatestart });
      const mgr = new Manager(el);
      mgr.add(rec);

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      twoFingerUp(el);
      expect(onRotatestart).toHaveBeenCalledTimes(1);

      // Second gesture
      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      expect(onRotatestart).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Event payload
  // =========================================================================

  describe('event payload', () => {
    it('includes all required fields on rotatestart', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      const event = onRotatestart.mock.calls[0][0];
      expect(event.type).toBe('rotatestart');
      expect(event.target).toBe(el);
      expect(event.pointers).toBeInstanceOf(Array);
      expect(typeof event.rotation).toBe('number');
      expect(typeof event.deltaRotation).toBe('number');
      expect(typeof event.center.x).toBe('number');
      expect(typeof event.center.y).toBe('number');
      expect(typeof event.timestamp).toBe('number');
      expect(event.srcEvent).toBeInstanceOf(PointerEvent);
      expect(typeof event.preventDefault).toBe('function');
    });

    it('isFirst is true only on rotatestart', () => {
      const onRotatestart = vi.fn();
      const onRotatemove = vi.fn();
      const onRotateend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart, onRotatemove, onRotateend }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      fire(el, 'pointermove', {
        pointerId: 2,
        clientX: 170,
        clientY: 190,
        pointerType: 'touch',
      });
      twoFingerUp(el);

      expect(onRotatestart.mock.calls[0][0].isFirst).toBe(true);
      expect(onRotatemove.mock.calls[0][0].isFirst).toBe(false);
      expect(onRotateend.mock.calls[0][0].isFirst).toBe(false);
    });

    it('isFinal is true only on rotateend', () => {
      const onRotatestart = vi.fn();
      const onRotatemove = vi.fn();
      const onRotateend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart, onRotatemove, onRotateend }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      fire(el, 'pointermove', {
        pointerId: 2,
        clientX: 170,
        clientY: 190,
        pointerType: 'touch',
      });
      twoFingerUp(el);

      expect(onRotatestart.mock.calls[0][0].isFinal).toBe(false);
      expect(onRotatemove.mock.calls[0][0].isFinal).toBe(false);
      expect(onRotateend.mock.calls[0][0].isFinal).toBe(true);
    });

    it('isFinal is true on rotatecancel', () => {
      const onRotatecancel = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatecancel }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });
      fire(el, 'pointercancel', { pointerId: 1, pointerType: 'touch' });

      expect(onRotatecancel.mock.calls[0][0].isFinal).toBe(true);
    });
  });

  // =========================================================================
  // Pointer ID tracking
  // =========================================================================

  describe('pointer ID tracking', () => {
    it('foreign pointer cancel does not terminate active rotation', () => {
      const onRotatecancel = vi.fn();
      const onRotatemove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatecancel, onRotatemove }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      fire(el, 'pointercancel', { pointerId: 99, pointerType: 'touch' });
      expect(onRotatecancel).not.toHaveBeenCalled();

      fire(el, 'pointermove', {
        pointerId: 2,
        clientX: 170,
        clientY: 190,
        pointerType: 'touch',
      });
      expect(onRotatemove).toHaveBeenCalled();
    });

    it('foreign pointer up does not terminate active rotation', () => {
      const onRotateend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotateend }));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      fire(el, 'pointerup', { pointerId: 99, pointerType: 'touch' });
      expect(onRotateend).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // CustomEvent DOM dispatch
  // =========================================================================

  describe('CustomEvent DOM dispatch', () => {
    it('dispatches fngr:rotatestart on the element', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:rotatestart', listener);
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({}));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('CustomEvent bubbles up to ancestor listeners', () => {
      const bodyListener = vi.fn();
      document.body.addEventListener('fngr:rotatestart', bodyListener);
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({}));

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(bodyListener).toHaveBeenCalledTimes(1);
      document.body.removeEventListener('fngr:rotatestart', bodyListener);
    });
  });

  // =========================================================================
  // Cleanup and destroy
  // =========================================================================

  describe('cleanup and destroy', () => {
    it('destroy stops all event processing', () => {
      const onRotatestart = vi.fn();
      const rec = new RotateRecognizer({ onRotatestart });
      const mgr = new Manager(el);
      mgr.add(rec);
      rec.destroy();

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(onRotatestart).not.toHaveBeenCalled();
    });

    it('reset returns recognizer to Idle', () => {
      const rec = new RotateRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      twoFingerDown(el, 100, 150, 200, 150);
      expect(rec.state).toBe(RecognizerState.Possible);

      rec.reset();
      expect(rec.state).toBe(RecognizerState.Idle);
    });
  });

  // =========================================================================
  // Convenience API
  // =========================================================================

  describe('convenience API', () => {
    it('rotate() attaches recognizer and returns cleanup', () => {
      const onRotatestart = vi.fn();
      const cleanup = rotate(el, { onRotatestart });

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(onRotatestart).toHaveBeenCalledTimes(1);
      cleanup();
    });

    it('rotate() accepts callback shorthand', () => {
      const callback = vi.fn();
      const cleanup = rotate(el, callback);

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].type).toBe('rotatestart');
      cleanup();
    });

    it('cleanup function stops recognition', () => {
      const onRotatestart = vi.fn();
      const cleanup = rotate(el, { onRotatestart });
      cleanup();

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointermove', {
        pointerId: 1,
        clientX: 130,
        clientY: 110,
        pointerType: 'touch',
      });

      expect(onRotatestart).not.toHaveBeenCalled();
    });

    it('cleanup is idempotent', () => {
      const cleanup = rotate(el, {});
      cleanup();
      expect(() => cleanup()).not.toThrow();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('pointer cancel in Possible state fails without emitting', () => {
      const onRotatecancel = vi.fn();
      const rec = new RotateRecognizer({ onRotatecancel });
      const mgr = new Manager(el);
      mgr.add(rec);

      twoFingerDown(el, 100, 150, 200, 150);
      fire(el, 'pointercancel', { pointerId: 1, pointerType: 'touch' });

      expect(onRotatecancel).not.toHaveBeenCalled();
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('single pointer movement does not trigger rotate', () => {
      const onRotatestart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotatestart }));

      fire(el, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { pointerId: 1, clientX: 200, clientY: 200 });

      expect(onRotatestart).not.toHaveBeenCalled();
    });

    it('rotateend reports final rotation correctly', () => {
      const onRotateend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new RotateRecognizer({ onRotateend }));

      twoFingerDown(el, 150, 150, 250, 150);
      // Rotate ~90° CW
      fire(el, 'pointermove', {
        pointerId: 2,
        clientX: 150,
        clientY: 250,
        pointerType: 'touch',
      });
      twoFingerUp(el);

      expect(onRotateend.mock.calls[0][0].rotation).toBeCloseTo(90, 0);
    });
  });
});
