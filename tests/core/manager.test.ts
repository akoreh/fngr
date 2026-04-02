import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Manager } from '../../src/core/manager';
import { BaseRecognizer } from '../../src/core/base-recognizer';
import { type GestureEvent } from '../../src/core/models/types';
import { fire } from '../helpers/pointer';

class MockRecognizer extends BaseRecognizer<GestureEvent> {
  onPointerDown = vi.fn();
  onPointerMove = vi.fn();
  onPointerUp = vi.fn();
  onPointerCancel = vi.fn();
}

describe('Manager', () => {
  let el: HTMLElement;
  let mgr: Manager;

  beforeEach(() => {
    el = document.createElement('div');
    mgr = new Manager(el);
  });

  describe('construction', () => {
    it('stores the target element', () => {
      expect(mgr.element).toBe(el);
    });
  });

  describe('adding/removing recognizers', () => {
    it('adds a recognizer and returns it', () => {
      const rec = new MockRecognizer({});
      const result = mgr.add(rec);
      expect(result).toBe(rec);
    });

    it('removes a recognizer', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec);
      mgr.remove(rec);

      fire(el, 'pointerdown');
      expect(rec.onPointerDown).not.toHaveBeenCalled();
    });

    it('accepts priority option', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec, { priority: 10 });
      expect(rec).toBeDefined();
    });
  });

  describe('event routing', () => {
    it('routes pointerdown to all recognizers', () => {
      const rec1 = new MockRecognizer({});
      const rec2 = new MockRecognizer({});
      mgr.add(rec1);
      mgr.add(rec2);

      fire(el, 'pointerdown', { clientX: 50, clientY: 75 });

      expect(rec1.onPointerDown).toHaveBeenCalledTimes(1);
      expect(rec2.onPointerDown).toHaveBeenCalledTimes(1);
    });

    it('routes pointermove to all recognizers', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec);

      fire(el, 'pointermove', { clientX: 100, clientY: 100 });

      expect(rec.onPointerMove).toHaveBeenCalledTimes(1);
    });

    it('routes pointerup to all recognizers', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec);

      fire(el, 'pointerup');

      expect(rec.onPointerUp).toHaveBeenCalledTimes(1);
    });

    it('routes pointercancel to all recognizers', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec);

      fire(el, 'pointercancel');

      expect(rec.onPointerCancel).toHaveBeenCalledTimes(1);
    });

    it('does not route events after destroy', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec);
      mgr.destroy();

      fire(el, 'pointerdown');
      expect(rec.onPointerDown).not.toHaveBeenCalled();
    });
  });

  describe('recognizerCount', () => {
    it('reports the number of active recognizers', () => {
      expect(mgr.recognizerCount).toBe(0);

      const rec1 = new MockRecognizer({});
      const rec2 = new MockRecognizer({});
      mgr.add(rec1);
      expect(mgr.recognizerCount).toBe(1);

      mgr.add(rec2);
      expect(mgr.recognizerCount).toBe(2);

      mgr.remove(rec1);
      expect(mgr.recognizerCount).toBe(1);
    });
  });

  describe('touch-action', () => {
    it('sets touch-action none on the element', () => {
      expect(el.style.touchAction).toBe('none');
    });

    it('restores touch-action on destroy', () => {
      el.style.touchAction = 'auto';
      const mgr2 = new Manager(el);
      mgr2.destroy();
      expect(el.style.touchAction).toBe('auto');
    });
  });

  describe('destroy', () => {
    it('destroys all recognizers on manager destroy', () => {
      const rec1 = new MockRecognizer({});
      const rec2 = new MockRecognizer({});
      const spy1 = vi.spyOn(rec1, 'destroy');
      const spy2 = vi.spyOn(rec2, 'destroy');

      mgr.add(rec1);
      mgr.add(rec2);
      mgr.destroy();

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });

    it('double destroy does not throw', () => {
      mgr.destroy();
      mgr.destroy(); // should not throw
    });
  });

  describe('priority ordering', () => {
    it('routes events to higher-priority recognizers first', () => {
      const order: string[] = [];
      const low = new MockRecognizer({});
      const high = new MockRecognizer({});
      low.onPointerDown = vi.fn(() => order.push('low'));
      high.onPointerDown = vi.fn(() => order.push('high'));

      mgr.add(low, { priority: 1 });
      mgr.add(high, { priority: 10 });

      fire(el, 'pointerdown');

      expect(order).toEqual(['high', 'low']);
    });

    it('defaults priority to 0 when not specified', () => {
      const order: string[] = [];
      const first = new MockRecognizer({});
      const second = new MockRecognizer({});
      first.onPointerDown = vi.fn(() => order.push('first'));
      second.onPointerDown = vi.fn(() => order.push('second'));

      mgr.add(first);
      mgr.add(second, { priority: 1 });

      fire(el, 'pointerdown');

      expect(order).toEqual(['second', 'first']);
    });
  });

  describe('destroy cleanup', () => {
    it('removes pointer event listeners from element', () => {
      // Add a fresh recognizer that we'll use to detect events post-destroy
      const rec = new MockRecognizer({});
      mgr.add(rec);
      mgr.destroy();

      // Create a second manager to prove the element still works
      const rec2 = new MockRecognizer({});
      const mgr2 = new Manager(el);
      mgr2.add(rec2);

      fire(el, 'pointerdown');
      fire(el, 'pointermove');
      fire(el, 'pointerup');
      fire(el, 'pointercancel');

      // Old recognizer should NOT receive events
      expect(rec.onPointerDown).not.toHaveBeenCalled();
      expect(rec.onPointerMove).not.toHaveBeenCalled();
      expect(rec.onPointerUp).not.toHaveBeenCalled();
      expect(rec.onPointerCancel).not.toHaveBeenCalled();

      // New recognizer SHOULD receive events (proves element isn't broken)
      expect(rec2.onPointerDown).toHaveBeenCalledTimes(1);
      expect(rec2.onPointerMove).toHaveBeenCalledTimes(1);
      expect(rec2.onPointerUp).toHaveBeenCalledTimes(1);
      expect(rec2.onPointerCancel).toHaveBeenCalledTimes(1);

      mgr2.destroy();
    });

    it('clears recognizer list on destroy', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec);
      mgr.destroy();
      expect(mgr.recognizerCount).toBe(0);
    });

    it('double destroy does not throw and does not double-remove listeners', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec);
      mgr.destroy();
      mgr.destroy(); // second destroy — should be no-op

      // Verify by adding a new manager and checking it works fine
      const rec2 = new MockRecognizer({});
      const mgr2 = new Manager(el);
      mgr2.add(rec2);
      fire(el, 'pointerdown');
      expect(rec2.onPointerDown).toHaveBeenCalledTimes(1);
      mgr2.destroy();
    });
  });

  describe('remove precision', () => {
    it('only removes the specified recognizer', () => {
      const rec1 = new MockRecognizer({});
      const rec2 = new MockRecognizer({});
      mgr.add(rec1);
      mgr.add(rec2);

      mgr.remove(rec1);

      fire(el, 'pointerdown');
      expect(rec1.onPointerDown).not.toHaveBeenCalled();
      expect(rec2.onPointerDown).toHaveBeenCalledTimes(1);
      expect(mgr.recognizerCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('removing a recognizer that was never added is a no-op', () => {
      const rec = new MockRecognizer({});
      mgr.remove(rec);
      expect(mgr.recognizerCount).toBe(0);
    });

    it('removing non-existent recognizer does not affect existing ones', () => {
      const rec1 = new MockRecognizer({});
      const rec2 = new MockRecognizer({});
      mgr.add(rec1);

      mgr.remove(rec2);

      expect(mgr.recognizerCount).toBe(1);
      fire(el, 'pointerdown');
      expect(rec1.onPointerDown).toHaveBeenCalledTimes(1);
    });

    it('adding the same recognizer twice routes events to it twice', () => {
      const rec = new MockRecognizer({});
      mgr.add(rec);
      mgr.add(rec);

      fire(el, 'pointerdown');

      expect(rec.onPointerDown).toHaveBeenCalledTimes(2);
      expect(mgr.recognizerCount).toBe(2);
    });
  });
});
