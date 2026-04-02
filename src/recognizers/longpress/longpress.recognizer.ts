import { BaseRecognizer } from '../../core/base-recognizer';
import { Manager } from '../../core/manager';
import { RecognizerState, type Point, type PointerInfo } from '../../core/models/types';
import type { LongPressEvent, LongPressOptions } from './models/longpress';

/**
 * Recognizes a press-and-hold gesture. Fires `'longpress'` when the pointer
 * is held for {@link LongPressOptions.duration | duration} ms without moving
 * more than {@link LongPressOptions.threshold | threshold} px, and
 * `'longpressup'` when the pointer lifts afterward.
 */
export class LongPressRecognizer extends BaseRecognizer<LongPressEvent> {
  private readonly threshold: number;
  private readonly duration: number;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private target: Element | null = null;
  private activePointerId: number | null = null;
  private startPosition: Point | null = null;
  private lastPosition: Point | null = null;
  private startTime = 0;
  private lastEvent: PointerEvent | null = null;

  private readonly defaultThreshold = 10;
  private readonly defaultDuration = 500;

  constructor(options: LongPressOptions) {
    super(options);
    this.threshold = options.threshold ?? this.defaultThreshold;
    this.duration = options.duration ?? this.defaultDuration;
  }

  onPointerDown(e: PointerEvent): void {
    if (this.state !== RecognizerState.Idle) return;

    this.activePointerId = e.pointerId;
    this.startPosition = { x: e.clientX, y: e.clientY };
    this.lastPosition = { x: e.clientX, y: e.clientY };
    this.startTime = Date.now();
    this.target = (e.currentTarget as Element) ?? (e.target as Element);
    this.lastEvent = e;
    this.transition(RecognizerState.Possible);

    this.timeoutId = setTimeout(() => {
      if (this.state !== RecognizerState.Possible) return;
      if (!this.lastPosition || !this.lastEvent || !this.target || this.activePointerId === null)
        return;

      const duration = Date.now() - this.startTime;
      const srcEvent = this.lastEvent;

      const pointers: PointerInfo[] = [
        {
          id: this.activePointerId,
          clientX: this.lastPosition.x,
          clientY: this.lastPosition.y,
          pageX: srcEvent.pageX,
          pageY: srcEvent.pageY,
        },
      ];

      const event: LongPressEvent = {
        type: 'longpress',
        target: this.target,
        pointers,
        timestamp: Date.now(),
        srcEvent,
        duration,
        preventDefault: () => srcEvent.preventDefault(),
      };

      this.transition(RecognizerState.Recognized);
      this.emit(event);
    }, this.duration);
  }

  onPointerMove(e: PointerEvent): void {
    if (this.state !== RecognizerState.Possible) return;
    if (e.pointerId !== this.activePointerId) return;

    this.lastPosition = { x: e.clientX, y: e.clientY };
    this.lastEvent = e;

    if (this.startPosition && this.exceedsThreshold(this.startPosition, e)) {
      this.fail();
    }
  }

  onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.activePointerId) return;

    if (this.state === RecognizerState.Recognized) {
      this.emitLongPressUp(e);
      this.resetIfTerminal();
    } else if (this.state === RecognizerState.Possible) {
      this.clearPendingTimeout();
      this.transition(RecognizerState.Failed);
      this.resetIfTerminal();
    }
  }

  onPointerCancel(e: PointerEvent): void {
    if (e.pointerId !== this.activePointerId) return;
    if (this.state === RecognizerState.Possible) {
      this.fail();
    } else if (this.state === RecognizerState.Recognized) {
      this.resetIfTerminal();
    }
  }

  private emitLongPressUp(e: PointerEvent): void {
    const duration = Date.now() - this.startTime;

    const pointers: PointerInfo[] = [
      {
        id: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
      },
    ];

    const event: LongPressEvent = {
      type: 'longpressup',
      target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
      pointers,
      timestamp: Date.now(),
      srcEvent: e,
      duration,
      preventDefault: () => e.preventDefault(),
    };

    this.emit(event);
  }

  private exceedsThreshold(from: Point, to: { clientX: number; clientY: number }): boolean {
    const dx = to.clientX - from.x;
    const dy = to.clientY - from.y;
    return Math.sqrt(dx * dx + dy * dy) > this.threshold;
  }

  private fail(): void {
    if (this.state === RecognizerState.Possible) {
      this.clearPendingTimeout();
      this.transition(RecognizerState.Failed);
      this.resetIfTerminal();
    }
  }

  private resetIfTerminal(): void {
    if (this.state === RecognizerState.Recognized || this.state === RecognizerState.Failed) {
      this.reset();
    }
  }

  private clearPendingTimeout(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  override reset(): void {
    super.reset();
    this.clearPendingTimeout();
    this.activePointerId = null;
    this.startPosition = null;
    this.lastPosition = null;
    this.target = null;
    this.startTime = 0;
    this.lastEvent = null;
  }

  override destroy(): void {
    this.clearPendingTimeout();
    super.destroy();
  }
}

// --- Convenience API ---

const managers = new WeakMap<Element, Manager>();

function getOrCreateManager(el: Element): Manager {
  let mgr = managers.get(el);
  if (!mgr) {
    mgr = new Manager(el);
    managers.set(el, mgr);
  }
  return mgr;
}

/**
 * Attach a long-press recognizer to an element.
 * @param el - Target element.
 * @param optionsOrCallback - A {@link LongPressOptions} object, or a callback shorthand
 *   (invoked on `'longpress'` only; use the options form for `onLongpressup`).
 * @returns Cleanup function that removes the recognizer.
 */
export function longPress(
  el: Element,
  optionsOrCallback: LongPressOptions | ((e: LongPressEvent) => void),
): () => void {
  const options: LongPressOptions =
    typeof optionsOrCallback === 'function'
      ? { onLongpress: optionsOrCallback }
      : optionsOrCallback;

  const mgr = getOrCreateManager(el);
  const recognizer = new LongPressRecognizer(options);
  mgr.add(recognizer);

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    mgr.remove(recognizer);
    recognizer.destroy();
    if (mgr.recognizerCount === 0) {
      mgr.destroy();
      managers.delete(el);
    }
  };
}
