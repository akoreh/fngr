import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TapRecognizer, tap } from '../../src/recognizers/tap';
import { Manager } from '../../src/core/manager';
import { RecognizerState } from '../../src/core/models/types';
import { fire, simulateTap } from '../helpers/pointer';

describe('TapRecognizer', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic tap detection', () => {
    it('fires onTap for a quick pointer down+up', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onTap.mock.calls[0][0].type).toBe('tap');
      expect(onTap.mock.calls[0][0].count).toBe(1);
    });

    it('includes pointer info in the event', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 200 });
      fire(el, 'pointerup', { clientX: 100, clientY: 200 });

      const event = onTap.mock.calls[0][0];
      expect(event.pointers).toHaveLength(1);
      expect(event.pointers[0].clientX).toBe(100);
      expect(event.pointers[0].clientY).toBe(200);
    });

    it('includes the source PointerEvent', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      const upEvent = fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onTap.mock.calls[0][0].srcEvent).toBe(upEvent);
    });

    it('preventDefault delegates to the source PointerEvent', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      const upEvent = fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      const tapEvent = onTap.mock.calls[0][0];
      tapEvent.preventDefault();
      expect(upEvent.defaultPrevented).toBe(true);
    });
  });

  describe('movement threshold', () => {
    it('does not fire if movement exceeds threshold', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 70, clientY: 50 }); // 20px > 10px
      fire(el, 'pointerup', { clientX: 70, clientY: 50 });

      expect(onTap).not.toHaveBeenCalled();
    });

    it('fires if movement is within threshold', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 55, clientY: 50 }); // 5px < 10px
      fire(el, 'pointerup', { clientX: 55, clientY: 50 });

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('uses default threshold of 10', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50 }); // 15px > 10px default
      fire(el, 'pointerup', { clientX: 65, clientY: 50 });

      expect(onTap).not.toHaveBeenCalled();
    });

    it('fires when movement is exactly at threshold', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 60, clientY: 50 }); // exactly 10px
      fire(el, 'pointerup', { clientX: 60, clientY: 50 });

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('detects diagonal movement using both axes', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, threshold: 10 }));

      // dx=8, dy=8 → sqrt(64+64) ≈ 11.3 > 10
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 58, clientY: 58 });
      fire(el, 'pointerup', { clientX: 58, clientY: 58 });

      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('interval (max duration)', () => {
    it('does not fire if held longer than interval', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, interval: 250 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, timeStamp: 1000 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50, timeStamp: 1300 }); // 300ms > 250ms

      expect(onTap).not.toHaveBeenCalled();
    });

    it('fires if released within interval', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, interval: 250 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, timeStamp: 1000 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50, timeStamp: 1100 }); // 100ms < 250ms

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('fires at exactly the interval boundary', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, interval: 250 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, timeStamp: 1000 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50, timeStamp: 1250 }); // exactly 250ms

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('does not fire 1ms past interval', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, interval: 250 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, timeStamp: 1000 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50, timeStamp: 1251 }); // 251ms > 250ms

      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('interval (max duration) — state', () => {
    it('transitions to Failed when interval exceeded', () => {
      const onTap = vi.fn();
      const rec = new TapRecognizer({ onTap, interval: 250 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, timeStamp: 1000 });
      // Before pointerup, state should be Possible
      expect(rec.state).toBe(RecognizerState.Possible);

      fire(el, 'pointerup', { clientX: 50, clientY: 50, timeStamp: 1300 }); // 300ms > 250ms
      // After failed interval check, should reset to Idle
      expect(rec.state).toBe(RecognizerState.Idle);
      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('pointer cancel', () => {
    it('does not fire on pointercancel', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });

      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('CustomEvent dispatch', () => {
    it('dispatches fngr:tap on the element', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:tap', listener);

      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({}));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(listener).toHaveBeenCalledTimes(1);
      const customEvent = listener.mock.calls[0][0] as CustomEvent;
      expect(customEvent.detail.type).toBe('tap');
    });
  });

  describe('multiple taps', () => {
    it('fires for each separate tap', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      simulateTap(el, { clientX: 50, clientY: 50 });
      simulateTap(el, { clientX: 60, clientY: 60 });

      expect(onTap).toHaveBeenCalledTimes(2);
    });
  });

  describe('state machine', () => {
    it('returns to Idle after recognition', () => {
      const rec = new TapRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);

      fire(el, 'pointerup', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('returns to Idle after failure (movement)', () => {
      const rec = new TapRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 100, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Failed);

      fire(el, 'pointerup', { clientX: 100, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });
  });

  describe('convenience function', () => {
    it('tap() returns a cleanup function', () => {
      const onTap = vi.fn();
      const off = tap(el, onTap);

      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap).toHaveBeenCalledTimes(1);

      off();
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap).toHaveBeenCalledTimes(1); // not called again
    });

    it('tap() accepts options object', () => {
      const onTap = vi.fn();
      const off = tap(el, { onTap, threshold: 5 });

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 60, clientY: 50 }); // 10px > 5px
      fire(el, 'pointerup', { clientX: 60, clientY: 50 });

      expect(onTap).not.toHaveBeenCalled();
      off();
    });

    it('cleanup restores touch-action on the element', () => {
      el.style.touchAction = 'auto';
      const off = tap(el, vi.fn());
      expect(el.style.touchAction).toBe('none');

      off();
      expect(el.style.touchAction).toBe('auto');
    });

    it('cleanup removes pointer event listeners', () => {
      const off = tap(el, vi.fn());
      off();

      // After cleanup, events should not be routed
      const spy = vi.fn();
      const off2 = tap(el, spy);
      // The old manager should be gone; a fresh one is created
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(spy).toHaveBeenCalledTimes(1);
      off2();
    });

    it('double cleanup is safe (idempotent)', () => {
      const onTap = vi.fn();
      const off = tap(el, onTap);

      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap).toHaveBeenCalledTimes(1);

      off();
      off(); // second call should not throw

      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('destroy clears callbacks to release references', () => {
      const onTap = vi.fn();
      const off = tap(el, onTap);
      off();

      // After cleanup, the recognizer's callbacks should be empty
      // Verify by creating a new tap — the old callback should not fire
      const onTap2 = vi.fn();
      const off2 = tap(el, onTap2);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap).toHaveBeenCalledTimes(0);
      expect(onTap2).toHaveBeenCalledTimes(1);
      off2();
    });

    it('manager is reused for same element', () => {
      const onTap1 = vi.fn();
      const onTap2 = vi.fn();
      const off1 = tap(el, onTap1);
      const off2 = tap(el, onTap2);

      simulateTap(el, { clientX: 50, clientY: 50 });

      // Both should fire — sharing the same manager
      expect(onTap1).toHaveBeenCalledTimes(1);
      expect(onTap2).toHaveBeenCalledTimes(1);

      off1();
      off2();
    });

    it('cleanup only destroys manager when last recognizer removed', () => {
      const onTap1 = vi.fn();
      const onTap2 = vi.fn();
      const off1 = tap(el, onTap1);
      const off2 = tap(el, onTap2);

      off1(); // Remove first, manager should persist

      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap1).not.toHaveBeenCalled(); // Removed
      expect(onTap2).toHaveBeenCalledTimes(1); // Still active

      off2(); // Now manager should be destroyed
    });

    it('idempotent cleanup does not corrupt state for remaining recognizers', () => {
      const onTap1 = vi.fn();
      const onTap2 = vi.fn();
      const off1 = tap(el, onTap1);
      const off2 = tap(el, onTap2);

      off1();
      off1(); // Double cleanup — should be no-op

      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap2).toHaveBeenCalledTimes(1);

      off2();
    });

    it('double cleanup does not destroy manager prematurely', () => {
      // Setup: two taps on same element share a manager
      const onTap1 = vi.fn();
      const onTap2 = vi.fn();
      const off1 = tap(el, onTap1);
      const off2 = tap(el, onTap2);

      // First cleanup removes recognizer 1
      off1();
      // Second call to off1 — without the cleaned guard, this would:
      // 1. call mgr.remove(recognizer) again (no-op)
      // 2. call recognizer.destroy() again
      // 3. check mgr.recognizerCount === 0 (returns 1 since off2's recognizer is there)
      //    But if cleaned=false mutant, the NEXT off2 call would also re-run cleanup,
      //    causing double-destroy.
      off1();

      // Tap 2 should still be fully functional
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap2).toHaveBeenCalledTimes(1);
      expect(onTap1).not.toHaveBeenCalled(); // cleaned up

      // Clean up tap 2
      off2();

      // After full cleanup, verify element is properly restored
      // by confirming a new tap() works cleanly
      const onTap3 = vi.fn();
      const off3 = tap(el, onTap3);
      simulateTap(el, { clientX: 50, clientY: 50 });
      expect(onTap3).toHaveBeenCalledTimes(1);
      off3();
    });

    it('passes options object correctly (not treated as function)', () => {
      const onTap = vi.fn();
      const off = tap(el, { onTap, threshold: 5, interval: 100 });

      // Verify threshold is applied (5px threshold)
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 57, clientY: 50 }); // 7px > 5px
      fire(el, 'pointerup', { clientX: 57, clientY: 50 });
      expect(onTap).not.toHaveBeenCalled();

      // Verify interval is applied (100ms interval)
      fire(el, 'pointerdown', { clientX: 50, clientY: 50, timeStamp: 1000 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50, timeStamp: 1050 }); // 50ms < 100ms
      expect(onTap).toHaveBeenCalledTimes(1);

      off();
    });
  });

  describe('multi-pointer rejection', () => {
    it('second pointer during active tap does not prevent first tap from firing', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      fire(el, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      fire(el, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 100 });
      fire(el, 'pointerup', { pointerId: 2, clientX: 100, clientY: 100 });
      fire(el, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });

      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onTap.mock.calls[0][0].pointers[0].clientX).toBe(50);
    });

    it('movement from second pointer does not fail the tap', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap, threshold: 5 }));

      fire(el, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      // Second pointer moves far — should be ignored for threshold check
      fire(el, 'pointermove', { pointerId: 2, clientX: 200, clientY: 200 });
      fire(el, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });

      expect(onTap).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('pointerup for never-seen pointer does not throw or fire', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      // pointerup without prior pointerdown
      fire(el, 'pointerup', { pointerId: 99, clientX: 50, clientY: 50 });

      expect(onTap).not.toHaveBeenCalled();
    });

    it('pointercancel after movement failure resets to Idle', () => {
      const rec = new TapRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 100, clientY: 50 }); // fails
      expect(rec.state).toBe(RecognizerState.Failed);

      fire(el, 'pointercancel', { clientX: 100, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('rapid pointercancel then pointerup does not throw', () => {
      const onTap = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new TapRecognizer({ onTap }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onTap).not.toHaveBeenCalled();
    });

    it('Manager.destroy() mid-gesture resets recognizer to Idle', () => {
      const onTap = vi.fn();
      const rec = new TapRecognizer({ onTap });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);

      mgr.destroy();
      expect(rec.state).toBe(RecognizerState.Idle);
      expect(onTap).not.toHaveBeenCalled();
    });

    it('pointercancel while Idle does not throw', () => {
      const rec = new TapRecognizer({});
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('pointermove while Idle does not trigger threshold check', () => {
      const onTap = vi.fn();
      const rec = new TapRecognizer({ onTap, threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      // Move without prior pointerdown — state is Idle, should be ignored
      fire(el, 'pointermove', { clientX: 200, clientY: 200 });
      expect(rec.state).toBe(RecognizerState.Idle);

      // Now do a normal tap — should still work
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });
      expect(onTap).toHaveBeenCalledTimes(1);
    });
  });
});
