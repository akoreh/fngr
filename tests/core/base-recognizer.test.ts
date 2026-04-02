import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRecognizer } from '../../src/core/base-recognizer';
import { RecognizerState, type GestureEvent } from '../../src/core/models/types';

// Concrete test subclass
class TestRecognizer extends BaseRecognizer<GestureEvent> {
  onPointerDown = vi.fn();
  onPointerMove = vi.fn();
  onPointerUp = vi.fn();
  onPointerCancel = vi.fn();

  public doTransition(state: RecognizerState) {
    this.transition(state);
  }

  public doEmit(event: GestureEvent) {
    this.emit(event);
  }
}

function makeGestureEvent(type: string, target?: Element): GestureEvent {
  const el = target ?? document.createElement('div');
  return {
    type,
    target: el,
    pointers: [],
    timestamp: performance.now(),
    srcEvent: new PointerEvent('pointerdown'),
    preventDefault: vi.fn(),
  };
}

describe('BaseRecognizer', () => {
  let el: HTMLElement;
  let recognizer: TestRecognizer;

  beforeEach(() => {
    el = document.createElement('div');
    recognizer = new TestRecognizer({});
  });

  describe('initial state', () => {
    it('starts in Idle state', () => {
      expect(recognizer.state).toBe(RecognizerState.Idle);
    });
  });

  describe('state transitions', () => {
    it('transitions from Idle to Possible', () => {
      recognizer.doTransition(RecognizerState.Possible);
      expect(recognizer.state).toBe(RecognizerState.Possible);
    });

    it('transitions from Possible to Recognized', () => {
      recognizer.doTransition(RecognizerState.Possible);
      recognizer.doTransition(RecognizerState.Recognized);
      expect(recognizer.state).toBe(RecognizerState.Recognized);
    });

    it('transitions from Possible to Failed', () => {
      recognizer.doTransition(RecognizerState.Possible);
      recognizer.doTransition(RecognizerState.Failed);
      expect(recognizer.state).toBe(RecognizerState.Failed);
    });

    it('transitions through continuous gesture lifecycle', () => {
      recognizer.doTransition(RecognizerState.Possible);
      recognizer.doTransition(RecognizerState.Began);
      expect(recognizer.state).toBe(RecognizerState.Began);

      recognizer.doTransition(RecognizerState.Changed);
      expect(recognizer.state).toBe(RecognizerState.Changed);

      recognizer.doTransition(RecognizerState.Changed);
      expect(recognizer.state).toBe(RecognizerState.Changed);

      recognizer.doTransition(RecognizerState.Ended);
      expect(recognizer.state).toBe(RecognizerState.Ended);
    });

    it('transitions from Changed to Cancelled', () => {
      recognizer.doTransition(RecognizerState.Possible);
      recognizer.doTransition(RecognizerState.Began);
      recognizer.doTransition(RecognizerState.Changed);
      recognizer.doTransition(RecognizerState.Cancelled);
      expect(recognizer.state).toBe(RecognizerState.Cancelled);
    });

    it('throws on invalid transition with descriptive message', () => {
      expect(() => {
        recognizer.doTransition(RecognizerState.Recognized);
      }).toThrow(/Invalid state transition.*idle.*recognized/);
    });

    it('throws on Idle to Failed', () => {
      expect(() => {
        recognizer.doTransition(RecognizerState.Failed);
      }).toThrow();
    });
  });

  describe('reset', () => {
    it('resets to Idle from any state', () => {
      recognizer.doTransition(RecognizerState.Possible);
      recognizer.doTransition(RecognizerState.Began);
      recognizer.reset();
      expect(recognizer.state).toBe(RecognizerState.Idle);
    });
  });

  describe('event emission', () => {
    it('calls the callback when emit is called', () => {
      const callback = vi.fn();
      recognizer = new TestRecognizer({ onTest: callback });
      const event = makeGestureEvent('test');

      recognizer.doEmit(event);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('dispatches a CustomEvent on the target element', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:test', listener);

      const event = makeGestureEvent('test', el);

      recognizer.doEmit(event);

      expect(listener).toHaveBeenCalledTimes(1);
      const customEvent = listener.mock.calls[0][0] as CustomEvent;
      expect(customEvent.detail).toBe(event);
    });

    it('CustomEvent bubbles to parent elements', () => {
      const parent = document.createElement('div');
      const child = document.createElement('div');
      parent.appendChild(child);

      const listener = vi.fn();
      parent.addEventListener('fngr:test', listener);

      const event = makeGestureEvent('test', child);
      recognizer.doEmit(event);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('CustomEvent is cancelable', () => {
      const listener = vi.fn((e: Event) => e.preventDefault());
      el.addEventListener('fngr:test', listener);

      const event = makeGestureEvent('test', el);
      recognizer.doEmit(event);

      const customEvent = listener.mock.calls[0][0] as CustomEvent;
      expect(customEvent.defaultPrevented).toBe(true);
    });

    it('does not throw when target has no dispatchEvent', () => {
      const event: GestureEvent = {
        type: 'test',
        target: {} as any,
        pointers: [],
        timestamp: 0,
        srcEvent: new PointerEvent('pointerdown'),
        preventDefault: vi.fn(),
      };

      expect(() => recognizer.doEmit(event)).not.toThrow();
    });
  });

  describe('callback extraction', () => {
    it('only stores keys starting with "on"', () => {
      const onCallback = vi.fn();
      const notCallback = vi.fn();
      const rec = new TestRecognizer({ onTest: onCallback, test: notCallback, threshold: 10 });
      const event = makeGestureEvent('test');

      rec.doEmit(event);
      expect(onCallback).toHaveBeenCalledTimes(1);
      // 'test' does NOT start with 'on', so should never be stored or called
      expect(notCallback).not.toHaveBeenCalled();
    });

    it('ignores non-function "on" keys', () => {
      const rec = new TestRecognizer({ onTest: 'not a function' as any });
      const event = makeGestureEvent('test');

      // Should not throw when trying to call a non-function
      expect(() => rec.doEmit(event)).not.toThrow();
    });
  });

  describe('failure dependencies', () => {
    it('tracks requireFailureOf relationships', () => {
      const other = new TestRecognizer({});
      recognizer.requireFailureOf(other);
      expect(recognizer.failureDependencies).toContain(other);
    });

    it('hasFailureDependency returns true when dependency exists', () => {
      const other = new TestRecognizer({});
      recognizer.requireFailureOf(other);
      expect(recognizer.hasFailureDependency(other)).toBe(true);
    });

    it('hasFailureDependency returns false when no dependency', () => {
      const other = new TestRecognizer({});
      expect(recognizer.hasFailureDependency(other)).toBe(false);
    });
  });

  describe('simultaneous recognition', () => {
    it('tracks allowSimultaneous relationships', () => {
      const other = new TestRecognizer({});
      recognizer.allowSimultaneous(other);
      expect(recognizer.canRecognizeSimultaneously(other)).toBe(true);
    });

    it('simultaneous is bidirectional', () => {
      const other = new TestRecognizer({});
      recognizer.allowSimultaneous(other);
      expect(other.canRecognizeSimultaneously(recognizer)).toBe(true);
    });

    it('returns false by default', () => {
      const other = new TestRecognizer({});
      expect(recognizer.canRecognizeSimultaneously(other)).toBe(false);
    });
  });

  describe('destroy', () => {
    it('resets state on destroy', () => {
      recognizer.doTransition(RecognizerState.Possible);
      recognizer.destroy();
      expect(recognizer.state).toBe(RecognizerState.Idle);
    });

    it('clears callbacks on destroy', () => {
      const callback = vi.fn();
      const rec = new TestRecognizer({ onTest: callback });
      rec.destroy();

      const event = makeGestureEvent('test');
      rec.doEmit(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('clears failure dependencies on destroy', () => {
      const other = new TestRecognizer({});
      recognizer.requireFailureOf(other);
      expect(recognizer.hasFailureDependency(other)).toBe(true);

      recognizer.destroy();
      expect(recognizer.hasFailureDependency(other)).toBe(false);
    });

    it('clears simultaneous relationships on destroy', () => {
      const other = new TestRecognizer({});
      recognizer.allowSimultaneous(other);
      expect(recognizer.canRecognizeSimultaneously(other)).toBe(true);

      recognizer.destroy();
      expect(recognizer.canRecognizeSimultaneously(other)).toBe(false);
    });
  });
});
