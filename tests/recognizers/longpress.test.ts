import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LongPressRecognizer, longPress } from '../../src/recognizers/longpress';
import { Manager } from '../../src/core/manager';
import { RecognizerState } from '../../src/core/models/types';
import { fire } from '../helpers/pointer';

describe('LongPressRecognizer', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic long-press detection', () => {
    it('fires after holding for the required duration', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
      expect(onLongpress.mock.calls[0][0].type).toBe('longpress');
    });

    it('does not fire if released early', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(200);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      vi.advanceTimersByTime(500);
      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('uses default duration of 500ms when none specified', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(499);
      expect(onLongpress).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('does not fire without pointerdown', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      vi.advanceTimersByTime(1000);
      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('fires only once per gesture', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      vi.advanceTimersByTime(500); // extra time while still holding
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });
  });

  describe('duration configuration', () => {
    it('fires after custom duration', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 1000 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(999);
      expect(onLongpress).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('does not fire if released 1ms before duration', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(499);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      vi.advanceTimersByTime(100);
      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('fires with very short duration', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 50 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(50);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });
  });

  describe('movement threshold', () => {
    it('does not fire if pointer moves beyond threshold', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 70, clientY: 50 }); // 20px > 10px
      vi.advanceTimersByTime(500);

      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('fires if movement stays within threshold', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 55, clientY: 50 }); // 5px < 10px
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('uses default threshold of 10px when none specified', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 59, clientY: 50 }); // 9px < 10px
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('fails on Y-axis movement exceeding threshold', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 50, clientY: 70 }); // 20px Y
      vi.advanceTimersByTime(500);

      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('uses Euclidean distance for threshold check', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      // dx=8, dy=8, distance = sqrt(128) ≈ 11.31 > 10
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 58, clientY: 58 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('allows diagonal movement within threshold', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      // dx=5, dy=5, distance = sqrt(50) ≈ 7.07 < 10
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 55, clientY: 55 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('does not fail when movement equals exactly the threshold', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      // dx=10, dy=0, distance = 10 — NOT > 10, so it should pass
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 60, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('fails on movement just past threshold boundary', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      // dx=10.1, distance > 10
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 60.1, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('ignores movement after recognition', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      expect(onLongpress).toHaveBeenCalledTimes(1);

      // Big movement after recognized — should not cause issues
      fire(el, 'pointermove', { clientX: 200, clientY: 200 });
      fire(el, 'pointerup', { clientX: 200, clientY: 200 });

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });
  });

  describe('onLongpressup', () => {
    it('fires onLongpressup when pointer lifts after long press', () => {
      const onLongpressup = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpressup, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onLongpressup).toHaveBeenCalledTimes(1);
      expect(onLongpressup.mock.calls[0][0].type).toBe('longpressup');
    });

    it('does not fire onLongpressup if long press did not trigger', () => {
      const onLongpressup = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpressup, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(200);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onLongpressup).not.toHaveBeenCalled();
    });

    it('includes duration in longpressup event', () => {
      const onLongpressup = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpressup, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      vi.advanceTimersByTime(200); // hold a bit longer
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      const event = onLongpressup.mock.calls[0][0];
      expect(event.duration).toBeGreaterThanOrEqual(700);
    });

    it('does not fire onLongpressup on pointercancel after recognized', () => {
      const onLongpressup = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpressup, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });

      expect(onLongpressup).not.toHaveBeenCalled();
    });

    it('fires both onLongpress and onLongpressup in correct order', () => {
      const calls: string[] = [];
      const mgr = new Manager(el);
      mgr.add(
        new LongPressRecognizer({
          onLongpress: () => calls.push('longpress'),
          onLongpressup: () => calls.push('longpressup'),
          duration: 500,
        }),
      );

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(calls).toEqual(['longpress', 'longpressup']);
    });
  });

  describe('pointer cancel', () => {
    it('does not fire on pointercancel during hold', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('clears timer on pointercancel', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(400);
      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(200); // past original timeout

      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('returns to Idle after pointercancel', () => {
      const rec = new LongPressRecognizer({ duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);

      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });
  });

  describe('CustomEvent dispatch', () => {
    it('dispatches fngr:longpress on the element', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:longpress', listener);

      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('dispatches fngr:longpressup on pointer lift after longpress', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:longpressup', listener);

      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('CustomEvent contains the gesture event as detail', () => {
      let capturedDetail: any = null;
      el.addEventListener('fngr:longpress', (e: Event) => {
        capturedDetail = (e as CustomEvent).detail;
      });

      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ duration: 500 }));

      fire(el, 'pointerdown', { clientX: 80, clientY: 90 });
      vi.advanceTimersByTime(500);

      expect(capturedDetail).not.toBeNull();
      expect(capturedDetail.type).toBe('longpress');
      expect(capturedDetail.duration).toBeGreaterThanOrEqual(500);
    });
  });

  describe('state machine', () => {
    it('starts in Idle', () => {
      const rec = new LongPressRecognizer({ duration: 500 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('transitions Idle -> Possible on pointerdown', () => {
      const rec = new LongPressRecognizer({ duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);
    });

    it('transitions Possible -> Recognized on timer fire', () => {
      const rec = new LongPressRecognizer({ duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(rec.state).toBe(RecognizerState.Recognized);
    });

    it('transitions Possible -> Failed on early release', () => {
      const rec = new LongPressRecognizer({ duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      // Immediately transitions to Failed then resets to Idle
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('transitions Possible -> Failed on movement', () => {
      const rec = new LongPressRecognizer({ threshold: 10, duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 100, clientY: 50 }); // 50px

      expect(rec.state).toBe(RecognizerState.Idle); // Failed -> auto-reset
    });

    it('returns to Idle after full lifecycle', () => {
      const rec = new LongPressRecognizer({ duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('stays in Recognized until pointerup', () => {
      const rec = new LongPressRecognizer({ duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(rec.state).toBe(RecognizerState.Recognized);

      // Still in Recognized — hasn't received pointerup yet
      vi.advanceTimersByTime(1000);
      expect(rec.state).toBe(RecognizerState.Recognized);
    });
  });

  describe('event shape', () => {
    it('longpress event has correct fields', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 80, clientY: 90 });
      vi.advanceTimersByTime(500);

      const event = onLongpress.mock.calls[0][0];
      expect(event.type).toBe('longpress');
      expect(event.duration).toBeGreaterThanOrEqual(500);
      expect(event.target).toBe(el);
      expect(event.pointers).toHaveLength(1);
      expect(event.pointers[0].clientX).toBe(80);
      expect(event.pointers[0].clientY).toBe(90);
      expect(event.timestamp).toBeGreaterThan(0);
      expect(typeof event.preventDefault).toBe('function');
    });

    it('longpress event srcEvent is the last pointer event before recognition', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 7 });
      vi.advanceTimersByTime(500);

      const event = onLongpress.mock.calls[0][0];
      expect(event.srcEvent).toBeInstanceOf(PointerEvent);
    });

    it('longpressup event has correct fields', () => {
      const onLongpressup = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpressup, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointerup', { clientX: 55, clientY: 60 });

      const event = onLongpressup.mock.calls[0][0];
      expect(event.type).toBe('longpressup');
      expect(event.duration).toBeGreaterThanOrEqual(500);
      expect(event.target).toBe(el);
      expect(event.pointers).toHaveLength(1);
      expect(event.pointers[0].clientX).toBe(55);
      expect(event.pointers[0].clientY).toBe(60);
      expect(event.srcEvent).toBeInstanceOf(PointerEvent);
      expect(typeof event.preventDefault).toBe('function');
    });

    it('longpress event pointer reflects position at time of recognition', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 53, clientY: 54 }); // small movement
      vi.advanceTimersByTime(500);

      const event = onLongpress.mock.calls[0][0];
      // Should reflect the latest known position
      expect(event.pointers[0].clientX).toBe(53);
      expect(event.pointers[0].clientY).toBe(54);
    });
  });

  describe('pointer ID tracking', () => {
    it('only tracks the first pointer', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      fire(el, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 2 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
      expect(onLongpress.mock.calls[0][0].pointers[0].id).toBe(1);
    });

    it('ignores move events from other pointers', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      // Big movement from a different pointer — should be ignored
      fire(el, 'pointermove', { clientX: 200, clientY: 200, pointerId: 2 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('ignores up events from other pointers', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50, pointerId: 2 });
      vi.advanceTimersByTime(500);

      // Should still fire — the tracked pointer (1) is still down
      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('ignores cancel events from other pointers', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      // Cancel from a different pointer — should be ignored
      fire(el, 'pointercancel', { clientX: 50, clientY: 50, pointerId: 2 });
      vi.advanceTimersByTime(500);

      // Should still fire — the tracked pointer (1) is still active
      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('ignores cancel from other pointer after recognition', () => {
      const onLongpress = vi.fn();
      const onLongpressup = vi.fn();
      const rec = new LongPressRecognizer({ onLongpress, onLongpressup, duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      vi.advanceTimersByTime(500);
      expect(onLongpress).toHaveBeenCalledTimes(1);

      // Cancel from a different pointer while Recognized — should NOT reset
      fire(el, 'pointercancel', { clientX: 50, clientY: 50, pointerId: 2 });
      expect(rec.state).toBe(RecognizerState.Recognized);

      // Original pointer up should still emit longpressup
      fire(el, 'pointerup', { clientX: 50, clientY: 50, pointerId: 1 });
      expect(onLongpressup).toHaveBeenCalledTimes(1);
    });

    it('longpressup only fires for the tracked pointer', () => {
      const onLongpressup = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpressup, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      vi.advanceTimersByTime(500);

      fire(el, 'pointerup', { clientX: 50, clientY: 50, pointerId: 2 });
      expect(onLongpressup).not.toHaveBeenCalled();

      fire(el, 'pointerup', { clientX: 50, clientY: 50, pointerId: 1 });
      expect(onLongpressup).toHaveBeenCalledTimes(1);
    });
  });

  describe('convenience function', () => {
    it('longPress() returns a cleanup function', () => {
      const onLongpress = vi.fn();
      const off = longPress(el, onLongpress);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      expect(onLongpress).toHaveBeenCalledTimes(1);

      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      off();
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('accepts options object', () => {
      const onLongpress = vi.fn();
      const off = longPress(el, { onLongpress, duration: 300, threshold: 5 });

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(300);

      expect(onLongpress).toHaveBeenCalledTimes(1);
      off();
    });

    it('options object form supports onLongpressup', () => {
      const onLongpressup = vi.fn();
      const off = longPress(el, { onLongpressup, duration: 500 });

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onLongpressup).toHaveBeenCalledTimes(1);
      off();
    });

    it('cleanup restores touch-action', () => {
      el.style.touchAction = 'auto';
      const off = longPress(el, () => {});

      expect(el.style.touchAction).toBe('none');

      off();
      expect(el.style.touchAction).toBe('auto');
    });

    it('multiple longPress on same element shares Manager', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const off1 = longPress(el, fn1);
      const off2 = longPress(el, fn2);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      off1();
      // off2 still works
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(2);

      off2();
    });

    it('double cleanup is safe', () => {
      const off = longPress(el, () => {});
      off();
      expect(() => off()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('second pointerdown while in Possible is ignored', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      vi.advanceTimersByTime(200);
      fire(el, 'pointerdown', { clientX: 60, clientY: 60, pointerId: 1 });
      vi.advanceTimersByTime(300);

      // Should still fire from the original pointerdown
      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('multiple gesture cycles work correctly', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      // First cycle: success
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });
      expect(onLongpress).toHaveBeenCalledTimes(1);

      // Second cycle: fail (early release)
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(200);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });
      expect(onLongpress).toHaveBeenCalledTimes(1);

      // Third cycle: success
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });
      expect(onLongpress).toHaveBeenCalledTimes(2);
    });

    it('destroyed recognizer clears timer', () => {
      const onLongpress = vi.fn();
      const rec = new LongPressRecognizer({ onLongpress, duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(200);

      mgr.remove(rec);
      rec.destroy();

      vi.advanceTimersByTime(500);
      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('reset clears all internal state', () => {
      const rec = new LongPressRecognizer({ duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(200);

      rec.reset();
      expect(rec.state).toBe(RecognizerState.Idle);

      // Timer should be cleared — advancing should not fire
      vi.advanceTimersByTime(500);
      // No error, no callback
    });

    it('movement exactly at threshold does not fail (uses > not >=)', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      // Euclidean distance = exactly 10.0
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 56, clientY: 58 }); // sqrt(36+64) = 10.0
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });
  });

  describe('mutation killers — targeted', () => {
    it('custom threshold is applied (kills ?? → && mutant)', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      // threshold=20, different from default 10
      // dx=15 should be within 20 threshold but would fail with default 10
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 20, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50 }); // 15px < 20
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('duration is calculated as now - startTime, not now + startTime', () => {
      vi.setSystemTime(1000); // Start clock at 1000ms
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      const event = onLongpress.mock.calls[0][0];
      // With - : 1500 - 1000 = 500
      // With + : 1500 + 1000 = 2500 (wrong!)
      expect(event.duration).toBeLessThanOrEqual(600);
      expect(event.duration).toBeGreaterThanOrEqual(500);
    });

    it('longpressup duration is calculated as now - startTime', () => {
      vi.setSystemTime(1000);
      const onLongpressup = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpressup, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      vi.advanceTimersByTime(200);
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      const event = onLongpressup.mock.calls[0][0];
      // With - : 1700 - 1000 = 700
      // With + : 1700 + 1000 = 2700 (wrong!)
      expect(event.duration).toBeLessThanOrEqual(800);
      expect(event.duration).toBeGreaterThanOrEqual(700);
    });

    it('longpress preventDefault calls srcEvent.preventDefault', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 500 }));

      const downEvent = fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      const preventSpy = vi.spyOn(downEvent, 'preventDefault');
      vi.advanceTimersByTime(500);

      const event = onLongpress.mock.calls[0][0];
      event.preventDefault();
      expect(preventSpy).toHaveBeenCalledTimes(1);
    });

    it('longpressup preventDefault calls srcEvent.preventDefault', () => {
      const captured: Array<() => void> = [];
      const mgr = new Manager(el);
      mgr.add(
        new LongPressRecognizer({
          onLongpressup: (e) => {
            captured.push(e.preventDefault);
          },
          duration: 500,
        }),
      );

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);

      const upEvent = fire(el, 'pointerup', { clientX: 50, clientY: 50 });
      // onLongpressup was called synchronously during fire()
      expect(captured).toHaveLength(1);

      const preventSpy = vi.spyOn(upEvent, 'preventDefault');
      captured[0]();
      expect(preventSpy).toHaveBeenCalledTimes(1);
    });

    it('pointercancel after recognition resets to Idle', () => {
      const onLongpressup = vi.fn();
      const rec = new LongPressRecognizer({ onLongpressup, duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(500);
      expect(rec.state).toBe(RecognizerState.Recognized);

      fire(el, 'pointercancel', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
      expect(onLongpressup).not.toHaveBeenCalled();
    });
  });

  describe('mutation killers', () => {
    it('distance uses multiplication not addition (dx*dx not dx+dx)', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      // threshold = 10, so threshold^2 = 100
      // dx=3, dy=4 → dx*dx + dy*dy = 9 + 16 = 25, sqrt = 5 < 10 (pass)
      // dx+dx + dy+dy = 6 + 8 = 14, sqrt ≈ 3.74 < 10 (also pass — same result)
      // Use dx=8, dy=6 → dx*dx + dy*dy = 64 + 36 = 100, sqrt = 10 = threshold (pass)
      // dx+dx + dy+dy = 16 + 12 = 28, sqrt ≈ 5.29 < 10 (also pass — same)
      // Need: dx=9, dy=5 → dx*dx + dy*dy = 81 + 25 = 106, sqrt ≈ 10.3 > 10 (fail!)
      // dx+dx + dy+dy = 18 + 10 = 28, sqrt ≈ 5.29 < 10 (pass — DIFFERENT!)
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 59, clientY: 55 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('distance uses dy*dy not dy*dx (cross-multiplication mutant)', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      // dx=2, dy=10 → dx*dx + dy*dy = 4 + 100 = 104, sqrt ≈ 10.2 > 10 (fail)
      // dx*dx + dy*dx = 4 + 20 = 24, sqrt ≈ 4.9 < 10 (pass — DIFFERENT!)
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 52, clientY: 60 });
      vi.advanceTimersByTime(500);

      expect(onLongpress).not.toHaveBeenCalled();
    });

    it('movement check uses startPosition not (0,0)', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      // Start far from origin — if check used (0,0), distance would be different
      fire(el, 'pointerdown', { clientX: 500, clientY: 500 });
      fire(el, 'pointermove', { clientX: 505, clientY: 500 }); // 5px from start
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('timer uses configured duration not hardcoded value', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, duration: 200 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      vi.advanceTimersByTime(200);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('threshold check uses > not >= (boundary precision)', () => {
      const onLongpress = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new LongPressRecognizer({ onLongpress, threshold: 10, duration: 500 }));

      // Exactly at threshold (10.0px) — should NOT fail
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 60, clientY: 50 }); // 10.0px
      vi.advanceTimersByTime(500);

      expect(onLongpress).toHaveBeenCalledTimes(1);
    });

    it('early release transitions to Failed not Recognized', () => {
      const onLongpress = vi.fn();
      const rec = new LongPressRecognizer({ onLongpress, duration: 500 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onLongpress).not.toHaveBeenCalled();
      expect(rec.state).toBe(RecognizerState.Idle);
    });
  });
});
