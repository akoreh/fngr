import { BaseRecognizer } from '../../core/base-recognizer';
import { Manager } from '../../core/manager';
import { RecognizerState, type Point, type PointerInfo } from '../../core/models/types';
import type { DoubleTapEvent, DoubleTapOptions } from './models/doubletap';

/**
 * Recognizes two consecutive single-finger taps within
 * {@link DoubleTapOptions.interval | interval} ms. Both taps must land within
 * {@link DoubleTapOptions.threshold | threshold} px of each other.
 */
export class DoubleTapRecognizer extends BaseRecognizer<DoubleTapEvent> {
  private readonly threshold: number;
  private readonly interval: number;
  private tapCount = 0;
  private firstTapPosition: Point | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private target: Element | null = null;
  private activePointerId: number | null = null;
  private startPosition: Point | null = null;
  private readonly defaultThreshold = 10;
  private readonly defaultInterval = 300;

  /** Callbacks invoked when this recognizer resolves (fails or recognizes). */
  private onResolvedCallbacks: Array<() => void> = [];

  constructor(options: DoubleTapOptions) {
    super(options);
    this.threshold = options.threshold ?? this.defaultThreshold;
    this.interval = options.interval ?? this.defaultInterval;
  }

  /** Register a callback for when this recognizer resolves (fail or recognize). */
  onResolved(cb: () => void): void {
    this.onResolvedCallbacks.push(cb);
  }

  onPointerDown(e: PointerEvent): void {
    if (this.state === RecognizerState.Idle) {
      this.activePointerId = e.pointerId;
      this.startPosition = { x: e.clientX, y: e.clientY };
      this.target = (e.currentTarget as Element) ?? (e.target as Element);
      this.transition(RecognizerState.Possible);
    } else if (this.state === RecognizerState.Possible && this.tapCount === 1) {
      if (e.pointerId !== this.activePointerId) return;
      this.startPosition = { x: e.clientX, y: e.clientY };
    }
  }

  onPointerMove(e: PointerEvent): void {
    if (this.state !== RecognizerState.Possible) return;
    if (e.pointerId !== this.activePointerId) return;

    if (this.startPosition && this.exceedsThreshold(this.startPosition, e)) {
      this.fail();
    }
  }

  onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.activePointerId) return;
    if (this.state !== RecognizerState.Possible) return;

    if (this.startPosition && this.exceedsThreshold(this.startPosition, e)) {
      this.fail();
      return;
    }

    this.tapCount++;

    if (this.tapCount === 1) {
      this.recordFirstTap(e);
    } else if (this.tapCount === 2) {
      this.recognizeSecondTap(e);
    }
  }

  private recordFirstTap(e: PointerEvent): void {
    this.firstTapPosition = { x: e.clientX, y: e.clientY };
    this.timeoutId = setTimeout(() => {
      this.fail();
    }, this.interval);
  }

  private recognizeSecondTap(e: PointerEvent): void {
    if (this.firstTapPosition && this.exceedsThreshold(this.firstTapPosition, e)) {
      this.fail();
      return;
    }

    this.clearPendingTimeout();

    const pointers: PointerInfo[] = [
      {
        id: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
      },
    ];

    const event: DoubleTapEvent = {
      type: 'doubletap',
      target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
      pointers,
      timestamp: e.timeStamp,
      srcEvent: e,
      count: 2,
      preventDefault: () => e.preventDefault(),
    };

    this.transition(RecognizerState.Recognized);
    this.emit(event);
    this.notifyResolved();
    this.resetIfTerminal();
  }

  private exceedsThreshold(from: Point, to: { clientX: number; clientY: number }): boolean {
    const dx = to.clientX - from.x;
    const dy = to.clientY - from.y;
    return Math.sqrt(dx * dx + dy * dy) > this.threshold;
  }

  onPointerCancel(e: PointerEvent): void {
    if (e.pointerId !== this.activePointerId) return;
    if (this.state === RecognizerState.Possible) {
      this.fail();
    }
  }

  private notifyResolved(): void {
    for (const cb of this.onResolvedCallbacks) {
      cb();
    }
  }

  private fail(): void {
    if (this.state === RecognizerState.Possible) {
      this.clearPendingTimeout();
      this.transition(RecognizerState.Failed);
      this.notifyResolved();
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
    this.tapCount = 0;
    this.firstTapPosition = null;
    this.activePointerId = null;
    this.startPosition = null;
    this.target = null;
    this.onResolvedCallbacks = [];
  }

  override destroy(): void {
    this.clearPendingTimeout();
    this.onResolvedCallbacks = [];
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
 * Attach a double-tap recognizer to an element.
 * @param el - Target element.
 * @param optionsOrCallback - A {@link DoubleTapOptions} object, or a callback shorthand.
 * @returns Cleanup function that removes the recognizer.
 */
export function doubleTap(
  el: Element,
  optionsOrCallback: DoubleTapOptions | ((e: DoubleTapEvent) => void),
): () => void {
  const options: DoubleTapOptions =
    typeof optionsOrCallback === 'function'
      ? { onDoubletap: optionsOrCallback }
      : optionsOrCallback;

  const mgr = getOrCreateManager(el);
  const recognizer = new DoubleTapRecognizer(options);
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
