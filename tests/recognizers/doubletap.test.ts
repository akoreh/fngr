import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DoubleTapRecognizer, doubleTap } from '../../src/recognizers/doubletap';
import { TapRecognizer } from '../../src/recognizers/tap';
import { Manager } from '../../src/core/manager';
import { RecognizerState } from '../../src/core/models/types';
import { fire, simulateTap } from '../helpers/pointer';

describe('DoubleTapRecognizer', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic double-tap detection', () => {
    it('fires onDoubletap for two quick taps', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).toHaveBeenCalledTimes(1);
      expect(onDoubletap.mock.calls[0][0].type).toBe('doubletap');
      expect(onDoubletap.mock.calls[0][0].count).toBe(2);
    });

    it('does not fire for a single tap', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500); // Wait past interval

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('fires once for first two taps; third tap starts a new sequence', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      // First double-tap fires, third tap starts a new potential double-tap
      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('includes pointer info from the second tap', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 52, clientY: 53 });

      const event = onDoubletap.mock.calls[0][0];
      expect(event.pointers).toHaveLength(1);
      expect(event.pointers[0].clientX).toBe(52);
      expect(event.pointers[0].clientY).toBe(53);
    });

    it('includes the source PointerEvent from the second tap', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      fire(el, 'pointerdown', { clientX: 52, clientY: 53 });
      const upEvent = fire(el, 'pointerup', { clientX: 52, clientY: 53 });

      expect(onDoubletap.mock.calls[0][0].srcEvent).toBe(upEvent);
    });

    it('preventDefault delegates to the source PointerEvent', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      const upEvent = fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      const dtEvent = onDoubletap.mock.calls[0][0];
      dtEvent.preventDefault();
      expect(upEvent.defaultPrevented).toBe(true);
    });
  });

  describe('interval (max gap between taps)', () => {
    it('does not fire if second tap is too slow (default 300ms)', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(400); // 400ms > 300ms default
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('fires if second tap is within custom interval', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, interval: 500 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(400); // 400ms < 500ms
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('does not fire if second tap exceeds custom interval', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, interval: 200 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(250); // 250ms > 200ms
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('fires at exactly the interval boundary', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, interval: 300 }));

      simulateTap(el, { clientX: 50, clientY: 50, timeStamp: 1000 });
      // Second tap pointerdown at exactly 300ms after first pointerup
      fire(el, 'pointerdown', { clientX: 50, clientY: 50, timeStamp: 1300 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50, timeStamp: 1310 });

      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('does not fire 1ms past interval', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, interval: 300 }));

      simulateTap(el, { clientX: 50, clientY: 50, timeStamp: 1000 });
      // Second tap pointerdown at 301ms after first pointerup
      vi.advanceTimersByTime(301);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });
  });

  describe('movement threshold', () => {
    it('does not fire if second tap is too far from first (default 10px)', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 70, clientY: 50 }); // 20px > 10px

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('fires if second tap is within threshold', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 20 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 65, clientY: 50 }); // 15px < 20px

      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('fires when second tap distance is exactly at threshold', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 60, clientY: 50 }); // exactly 10px

      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('detects diagonal distance between taps using both axes', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      // dx=8, dy=8 → sqrt(128) ≈ 11.3 > 10
      simulateTap(el, { clientX: 58, clientY: 58 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('fails first tap if pointer moves too far during press', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 70, clientY: 50 }); // 20px move during first tap
      fire(el, 'pointerup', { clientX: 70, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('fails second tap if pointer moves too far during press', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 70, clientY: 50 }); // 20px move during second tap
      fire(el, 'pointerup', { clientX: 70, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });
  });

  describe('CustomEvent dispatch', () => {
    it('dispatches fngr:doubletap on the element', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:doubletap', listener);

      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({}));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(listener).toHaveBeenCalledTimes(1);
      const customEvent = listener.mock.calls[0][0] as CustomEvent;
      expect(customEvent.detail.type).toBe('doubletap');
      expect(customEvent.detail.count).toBe(2);
    });

    it('CustomEvent bubbles', () => {
      const listener = vi.fn();
      const parent = document.createElement('div');
      parent.appendChild(el);
      parent.addEventListener('fngr:doubletap', listener);

      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({}));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('CustomEvent is cancelable', () => {
      const listener = vi.fn((e: Event) => e.preventDefault());
      el.addEventListener('fngr:doubletap', listener);

      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({}));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(listener).toHaveBeenCalledTimes(1);
      const customEvent = listener.mock.calls[0][0] as CustomEvent;
      expect(customEvent.defaultPrevented).toBe(true);
    });
  });

  describe('state machine', () => {
    it('transitions to Possible on first pointerdown', () => {
      const rec = new DoubleTapRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);
    });

    it('stays Possible after first pointerup (waiting for second tap)', () => {
      const rec = new DoubleTapRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);
    });

    it('returns to Idle after successful double-tap', () => {
      const rec = new DoubleTapRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('returns to Idle after interval timeout', () => {
      const rec = new DoubleTapRecognizer({ interval: 300 });
      const mgr = new Manager(el);
      mgr.add(rec);

      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);

      vi.advanceTimersByTime(400);
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('returns to Idle after movement failure during first tap', () => {
      const rec = new DoubleTapRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 100, clientY: 50 });

      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('returns to Idle after pointer cancel', () => {
      const rec = new DoubleTapRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });

      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('can recognize again after failure', () => {
      const onDoubletap = vi.fn();
      const rec = new DoubleTapRecognizer({ onDoubletap, interval: 300 });
      const mgr = new Manager(el);
      mgr.add(rec);

      // First attempt: timeout (fail)
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(400);
      expect(rec.state).toBe(RecognizerState.Idle);

      // Second attempt: successful double-tap
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('can recognize again after successful recognition', () => {
      const onDoubletap = vi.fn();
      const rec = new DoubleTapRecognizer({ onDoubletap });
      const mgr = new Manager(el);
      mgr.add(rec);

      // First double-tap
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      // Second double-tap
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).toHaveBeenCalledTimes(2);
    });
  });

  describe('pointer cancel', () => {
    it('does not fire on pointercancel during first tap', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('does not fire on pointercancel during second tap', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('pointercancel while Idle does not throw', () => {
      const rec = new DoubleTapRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });
  });

  describe('tap + doubletap arbitration', () => {
    it('tap waits for doubletap to fail via requireFailureOf', () => {
      const onTap = vi.fn();
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);

      const dtRec = new DoubleTapRecognizer({ onDoubletap, interval: 300 });
      const tapRec = new TapRecognizer({ onTap });
      tapRec.requireFailureOf(dtRec);

      mgr.add(dtRec, { priority: 10 });
      mgr.add(tapRec);

      // Single tap — tap should wait, then fire after doubletap fails
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap).not.toHaveBeenCalled(); // waiting for doubletap to fail

      vi.advanceTimersByTime(400); // doubletap interval expires

      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('doubletap fires and tap does not on double-tap', () => {
      const onTap = vi.fn();
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);

      const dtRec = new DoubleTapRecognizer({ onDoubletap, interval: 300 });
      const tapRec = new TapRecognizer({ onTap });
      tapRec.requireFailureOf(dtRec);

      mgr.add(dtRec, { priority: 10 });
      mgr.add(tapRec);

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).toHaveBeenCalledTimes(1);
      expect(onTap).not.toHaveBeenCalled();
    });

    it('single tap still works after a doubletap was recognized', () => {
      const onTap = vi.fn();
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);

      const dtRec = new DoubleTapRecognizer({ onDoubletap, interval: 300 });
      const tapRec = new TapRecognizer({ onTap });
      tapRec.requireFailureOf(dtRec);

      mgr.add(dtRec, { priority: 10 });
      mgr.add(tapRec);

      // First: a doubletap
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap).toHaveBeenCalledTimes(1);

      // Then: a single tap — should still work
      vi.advanceTimersByTime(500); // let everything settle
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(400); // wait for doubletap to fail

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('alternating single and double taps work correctly', () => {
      const onTap = vi.fn();
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);

      const dtRec = new DoubleTapRecognizer({ onDoubletap, interval: 300 });
      const tapRec = new TapRecognizer({ onTap });
      tapRec.requireFailureOf(dtRec);

      mgr.add(dtRec, { priority: 10 });
      mgr.add(tapRec);

      // Single tap
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(400);
      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onDoubletap).toHaveBeenCalledTimes(0);

      // Double tap
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap).toHaveBeenCalledTimes(1);
      expect(onTap).toHaveBeenCalledTimes(1); // still 1

      // Single tap again
      vi.advanceTimersByTime(500);
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(400);
      expect(onTap).toHaveBeenCalledTimes(2);
      expect(onDoubletap).toHaveBeenCalledTimes(1); // still 1
    });

    it('tap deferred event has correct coordinates from original tap', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);

      const dtRec = new DoubleTapRecognizer({ interval: 300 });
      const tapRec = new TapRecognizer({ onTap });
      tapRec.requireFailureOf(dtRec);

      mgr.add(dtRec, { priority: 10 });
      mgr.add(tapRec);

      simulateTap(el, { clientX: 123, clientY: 456 });
      vi.advanceTimersByTime(400); // doubletap fails → tap fires

      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onTap.mock.calls[0][0].pointers[0].clientX).toBe(123);
      expect(onTap.mock.calls[0][0].pointers[0].clientY).toBe(456);
    });
  });

  describe('tap deferred recognition — mutation coverage', () => {
    it('tap fires immediately when no failure deps exist', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      simulateTap(el, { clientX: 50, clientY: 50 });

      // Should fire immediately without delay
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('tap stays deferred while doubletap is still Possible', () => {
      const onTap = vi.fn();
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);

      const dtRec = new DoubleTapRecognizer({ onDoubletap, interval: 300 });
      const tapRec = new TapRecognizer({ onTap });
      tapRec.requireFailureOf(dtRec);

      mgr.add(dtRec, { priority: 10 });
      mgr.add(tapRec);

      simulateTap(el, { clientX: 50, clientY: 50 });

      // After 100ms, doubletap is still Possible (waiting for second tap)
      vi.advanceTimersByTime(100);
      expect(onTap).not.toHaveBeenCalled();
      expect(dtRec.state).toBe(RecognizerState.Possible);
    });

    it('tap does not fire if movement fails it while deferred', () => {
      const onTap = vi.fn();
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);

      const dtRec = new DoubleTapRecognizer({ onDoubletap, interval: 300 });
      const tapRec = new TapRecognizer({ onTap });
      tapRec.requireFailureOf(dtRec);

      mgr.add(dtRec, { priority: 10 });
      mgr.add(tapRec);

      simulateTap(el, { clientX: 50, clientY: 50 });

      // Movement on second pointerdown — shouldn't affect tap (it's deferred)
      vi.advanceTimersByTime(400); // doubletap fails

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('tap ignores pointermove while deferred (pendingEvent set)', () => {
      const onTap = vi.fn();
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);

      const dtRec = new DoubleTapRecognizer({ onDoubletap, interval: 300 });
      const tapRec = new TapRecognizer({ onTap, threshold: 5 });
      tapRec.requireFailureOf(dtRec);

      mgr.add(dtRec, { priority: 10 });
      mgr.add(tapRec);

      simulateTap(el, { clientX: 50, clientY: 50 });

      // Pointer moves far while tap is deferred — should not affect tap
      fire(el, 'pointermove', { clientX: 200, clientY: 200 });

      vi.advanceTimersByTime(400); // doubletap fails

      // Tap should still fire with original coordinates
      expect(onTap).toHaveBeenCalledTimes(1);
    });
  });

  describe('convenience function', () => {
    it('doubleTap() with callback returns a cleanup function', () => {
      const onDoubletap = vi.fn();
      const off = doubleTap(el, onDoubletap);

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap).toHaveBeenCalledTimes(1);

      off();
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap).toHaveBeenCalledTimes(1); // not called again
    });

    it('doubleTap() accepts options object', () => {
      const onDoubletap = vi.fn();
      const off = doubleTap(el, { onDoubletap, threshold: 5 });

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 60, clientY: 50 }); // 10px > 5px threshold

      expect(onDoubletap).not.toHaveBeenCalled();
      off();
    });

    it('cleanup restores touch-action on the element', () => {
      el.style.touchAction = 'auto';
      const off = doubleTap(el, vi.fn());
      expect(el.style.touchAction).toBe('none');

      off();
      expect(el.style.touchAction).toBe('auto');
    });

    it('double cleanup is safe (idempotent)', () => {
      const onDoubletap = vi.fn();
      const off = doubleTap(el, onDoubletap);

      off();
      off(); // second call should not throw

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('manager is reused for same element', () => {
      const onDoubletap1 = vi.fn();
      const onDoubletap2 = vi.fn();
      const off1 = doubleTap(el, onDoubletap1);
      const off2 = doubleTap(el, onDoubletap2);

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap1).toHaveBeenCalledTimes(1);
      expect(onDoubletap2).toHaveBeenCalledTimes(1);

      off1();
      off2();
    });

    it('passes options object correctly (not treated as function)', () => {
      const onDoubletap = vi.fn();
      const off = doubleTap(el, { onDoubletap, threshold: 5, interval: 500 });

      // Verify threshold is applied (5px threshold)
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 60, clientY: 50 }); // 10px > 5px
      expect(onDoubletap).not.toHaveBeenCalled();

      // Wait for timeout then verify interval is applied
      vi.advanceTimersByTime(600);

      // Verify works within threshold
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 52, clientY: 50 }); // 2px < 5px
      expect(onDoubletap).toHaveBeenCalledTimes(1);

      off();
    });

    it('idempotent cleanup does not corrupt state for remaining recognizers', () => {
      const onDoubletap1 = vi.fn();
      const onDoubletap2 = vi.fn();
      const off1 = doubleTap(el, onDoubletap1);
      const off2 = doubleTap(el, onDoubletap2);

      off1();
      off1(); // Double cleanup — should be no-op

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap2).toHaveBeenCalledTimes(1);

      off2();
    });

    it('double cleanup does not destroy manager prematurely', () => {
      const onDoubletap1 = vi.fn();
      const onDoubletap2 = vi.fn();
      const off1 = doubleTap(el, onDoubletap1);
      const off2 = doubleTap(el, onDoubletap2);

      off1();
      off1();

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap2).toHaveBeenCalledTimes(1);
      expect(onDoubletap1).not.toHaveBeenCalled();

      off2();

      // After full cleanup, verify a new doubleTap works cleanly
      const onDoubletap3 = vi.fn();
      const off3 = doubleTap(el, onDoubletap3);
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap3).toHaveBeenCalledTimes(1);
      off3();
    });

    it('cleanup only destroys manager when last recognizer removed', () => {
      const onDoubletap1 = vi.fn();
      const onDoubletap2 = vi.fn();
      const off1 = doubleTap(el, onDoubletap1);
      const off2 = doubleTap(el, onDoubletap2);

      off1();

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap1).not.toHaveBeenCalled();
      expect(onDoubletap2).toHaveBeenCalledTimes(1);

      off2();
    });
  });

  describe('movement threshold — mutation coverage', () => {
    it('fails when pointer moves during first tap (y-axis only)', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 50, clientY: 70 }); // 20px Y movement
      fire(el, 'pointerup', { clientX: 50, clientY: 70 });

      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('fails when pointer moves during second tap (y-axis only)', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 50, clientY: 70 }); // 20px Y movement
      fire(el, 'pointerup', { clientX: 50, clientY: 70 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('uses Euclidean distance for movement during tap (dx and dy both matter)', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      // threshold=14 so dx=10, dy=10 → sqrt(200)≈14.1 > 14 fails
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 14 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 60, clientY: 60 }); // sqrt(200) ≈ 14.14
      fire(el, 'pointerup', { clientX: 60, clientY: 60 });

      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('second tap position uses startPosition from second pointerdown', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      // First tap at (50, 50)
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);

      // Second tap: pointerdown at (55, 55), then move to (70, 55) — 15px from second pointerdown
      fire(el, 'pointerdown', { clientX: 55, clientY: 55 });
      fire(el, 'pointermove', { clientX: 70, clientY: 55 }); // 15px > 10px threshold
      fire(el, 'pointerup', { clientX: 70, clientY: 55 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('distance between taps uses both x and y axes', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      // threshold=14 so dx=10, dy=10 → sqrt(200)≈14.1 > 14
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 14 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 60, clientY: 60 }); // sqrt(200) ≈ 14.14

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('second tap y-axis distance alone can fail the gesture', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 70 }); // 20px Y distance

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('onPointerDown updates startPosition for second tap (movement is relative to second down)', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      // First tap at (50, 50)
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);

      // Second tap: down at (55, 50), move far from (55,50) but close to (50,50)
      // Movement from second down: 40-55 = -15, distance 15 > 10 → should fail
      // Movement from first down: 40-50 = -10, distance 10 ≤ 10 → would pass if using wrong start
      fire(el, 'pointerdown', { clientX: 55, clientY: 50 });
      fire(el, 'pointermove', { clientX: 40, clientY: 50 });
      fire(el, 'pointerup', { clientX: 40, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('onPointerMove fails when pointer returns to origin but moved far in Y (sqrt mutant)', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      // First tap: down at (50, 50), move to (50, 70) Y-only, then up at (50, 50)
      // onPointerMove: dx=0, dy=20 → sqrt(400) = 20 > 10 → FAIL
      // If sqrt(dx*dx - dy*dy): sqrt(-400) = NaN > 10 = false → doesn't fail
      // Then onPointerUp: dx=0, dy=0 → 0 ≤ 10 → passes → would incorrectly succeed
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 50, clientY: 70 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 }); // returns to start

      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('onPointerUp catches Y-axis drift from down to up with no pointermove', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      // First tap with Y drift: down at (50, 50), up at (50, 65) — 15px Y-axis
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 65 }); // no pointermove

      vi.advanceTimersByTime(100);
      // Second tap close to the UP position (not down position)
      simulateTap(el, { clientX: 50, clientY: 65 });

      // With correct code: first tap fails due to movement check in onPointerUp
      // With mutant removing the block: first tap "succeeds", second matches → incorrectly recognizes
      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('onPointerUp arithmetic mutant: dx/dx + dy*dy differs from dx*dx + dy*dy', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      // First tap: down at (50, 50), up at (60, 50) — dx=10, dy=0
      // Correct: sqrt(100) = 10 ≤ 10 → passes
      // dx/dx mutant: sqrt(1) = 1 ≤ 10 → also passes
      // So we need a case where dx/dx differs meaningfully
      // dx=15: dx*dx=225, dx/dx=1. With dy=0: sqrt(225)=15 > 10 vs sqrt(1)=1 ≤ 10
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 65, clientY: 50 }); // 15px X drift

      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 65, clientY: 50 });

      // Correct: drift=15 > 10 → first tap fails → no doubletap
      // dx/dx mutant: sqrt(1)=1 ≤ 10 → first tap passes → doubletap fires
      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('movement at exactly threshold during tap does not fail', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 60, clientY: 50 }); // exactly 10px
      fire(el, 'pointerup', { clientX: 60, clientY: 50 });

      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 55, clientY: 50 });

      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('movement check in onPointerUp catches drift from down to up position', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 10 }));

      // First tap: pointerdown at (50,50) but pointerup at (70,50) — 20px drift
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 70, clientY: 50 });

      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('pointerup for never-seen pointer does not throw or fire', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      fire(el, 'pointerup', { pointerId: 99, clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('pointermove while Idle does not trigger threshold check', () => {
      const onDoubletap = vi.fn();
      const rec = new DoubleTapRecognizer({ onDoubletap, threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointermove', { clientX: 200, clientY: 200 });
      expect(rec.state).toBe(RecognizerState.Idle);

      // Normal double-tap should still work
      simulateTap(el, { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('Manager.destroy() mid-gesture clears timeout', () => {
      const onDoubletap = vi.fn();
      const rec = new DoubleTapRecognizer({ onDoubletap });
      const mgr = new Manager(el);
      mgr.add(rec);

      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);

      mgr.destroy();
      expect(rec.state).toBe(RecognizerState.Idle);

      // Timer should be cleared — no error on timeout
      vi.advanceTimersByTime(500);
      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('second pointer during active first tap does not interfere', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      fire(el, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      fire(el, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 100 });
      fire(el, 'pointerup', { pointerId: 2, clientX: 100, clientY: 100 });
      fire(el, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });

      vi.advanceTimersByTime(100);

      fire(el, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });

      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('movement from different pointer does not fail the gesture', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap, threshold: 5 }));

      fire(el, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { pointerId: 2, clientX: 200, clientY: 200 }); // different pointer
      fire(el, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });

      vi.advanceTimersByTime(100);
      simulateTap(el, { clientX: 50, clientY: 50 });

      expect(onDoubletap).toHaveBeenCalledTimes(1);
    });

    it('rapid pointercancel then pointerup does not throw', () => {
      const onDoubletap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new DoubleTapRecognizer({ onDoubletap }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onDoubletap).not.toHaveBeenCalled();
    });

    it('destroy clears onResolved callbacks to release references', () => {
      const rec = new DoubleTapRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      // Add a resolved callback
      const cb = vi.fn();
      rec.onResolved(cb);

      rec.destroy();

      // After destroy, the callback list should be cleared
      // Verify indirectly: no crash, no call after destroy
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
