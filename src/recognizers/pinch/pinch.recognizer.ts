import { BaseRecognizer } from '../../core/base-recognizer';
import { PointerTracker } from '../../core/pointer-tracker';
import { Manager } from '../../core/manager';
import { RecognizerState } from '../../core/models/types';
import type { PinchEvent, PinchOptions } from './models/pinch';

/**
 * Recognizes a two-finger pinch (zoom) gesture. Fires when two pointers move
 * closer together or farther apart, reporting cumulative {@link PinchEvent.scale | scale},
 * per-event {@link PinchEvent.deltaScale | deltaScale}, and the
 * {@link PinchEvent.center | center} point between the two pointers.
 */
export class PinchRecognizer extends BaseRecognizer<PinchEvent> {
  private tracker = new PointerTracker();
  private readonly threshold: number;
  private target: Element | null = null;
  private initialDistance = 0;
  private lastScale = 1;
  private pointerIds: [number, number] | null = null;

  private readonly defaultThreshold = 0;

  constructor(options: PinchOptions) {
    super(options);
    this.threshold = options.threshold ?? this.defaultThreshold;
  }

  onPointerDown(e: PointerEvent): void {
    this.tracker.onPointerDown(e);

    if (this.state === RecognizerState.Idle && this.tracker.count >= 2 && !this.pointerIds) {
      this.target = (e.currentTarget as Element) ?? (e.target as Element);
      this.initialDistance = this.tracker.getDistance();
      this.lastScale = 1;
      this.pointerIds = this.capturePointerIds();
      this.transition(RecognizerState.Possible);
    }
  }

  onPointerMove(e: PointerEvent): void {
    this.tracker.onPointerMove(e);

    if (!this.pointerIds || !this.isTrackedPointer(e.pointerId)) return;
    if (this.tracker.count < 2) return;

    const currentDistance = this.tracker.getDistance();

    if (this.state === RecognizerState.Possible) {
      const scaleDelta = Math.abs(currentDistance / this.initialDistance - 1);
      if (this.initialDistance === 0 || scaleDelta > this.threshold) {
        this.transition(RecognizerState.Began);
        this.emitPinch('pinchstart', e, currentDistance, true, false);
      }
    } else if (this.state === RecognizerState.Began || this.state === RecognizerState.Changed) {
      if (this.state === RecognizerState.Began) {
        this.transition(RecognizerState.Changed);
      }
      this.emitPinch('pinchmove', e, currentDistance, false, false);
    }
  }

  onPointerUp(e: PointerEvent): void {
    if (!this.isTrackedPointer(e.pointerId)) {
      this.tracker.onPointerUp(e);
      return;
    }

    if (this.state === RecognizerState.Began || this.state === RecognizerState.Changed) {
      const currentDistance = this.tracker.getDistance();
      this.transition(RecognizerState.Ended);
      this.emitPinch('pinchend', e, currentDistance, false, true);
    } else if (this.state === RecognizerState.Possible) {
      this.transition(RecognizerState.Failed);
    }

    this.tracker.onPointerUp(e);
    this.resetIfTerminal();
  }

  onPointerCancel(e: PointerEvent): void {
    if (!this.isTrackedPointer(e.pointerId)) {
      this.tracker.onPointerCancel(e);
      return;
    }

    if (this.state === RecognizerState.Began || this.state === RecognizerState.Changed) {
      const currentDistance = this.tracker.getDistance();
      this.transition(RecognizerState.Cancelled);
      this.emitPinch('pinchcancel', e, currentDistance, false, true);
    } else if (this.state === RecognizerState.Possible) {
      this.transition(RecognizerState.Failed);
    }

    this.tracker.onPointerCancel(e);
    this.resetIfTerminal();
  }

  private emitPinch(
    type: PinchEvent['type'],
    e: PointerEvent,
    currentDistance: number,
    isFirst: boolean,
    isFinal: boolean,
  ): void {
    const scale = this.initialDistance > 0 ? currentDistance / this.initialDistance : 1;
    const deltaScale = scale - this.lastScale;
    this.lastScale = scale;

    const center = this.tracker.getCenter();

    const event: PinchEvent = {
      type,
      target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
      pointers: this.tracker.pointers,
      timestamp: e.timeStamp,
      srcEvent: e,
      scale,
      deltaScale,
      center,
      isFirst,
      isFinal,
      preventDefault: () => e.preventDefault(),
    };

    this.emit(event);
  }

  private capturePointerIds(): [number, number] {
    const ids = this.tracker.pointers.map((p) => p.id);
    return [ids[0], ids[1]];
  }

  private isTrackedPointer(pointerId: number): boolean {
    if (!this.pointerIds) return false;
    return this.pointerIds[0] === pointerId || this.pointerIds[1] === pointerId;
  }

  private resetIfTerminal(): void {
    if (
      this.state === RecognizerState.Ended ||
      this.state === RecognizerState.Cancelled ||
      this.state === RecognizerState.Failed
    ) {
      this.reset();
    }
  }

  override reset(): void {
    super.reset();
    this.tracker.reset();
    this.target = null;
    this.initialDistance = 0;
    this.lastScale = 1;
    this.pointerIds = null;
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
 * Attach a pinch recognizer to an element.
 * @param el - Target element.
 * @param options - A {@link PinchOptions} object.
 * @returns Cleanup function that removes the recognizer.
 */
export function pinch(el: Element, options: PinchOptions): () => void {
  const mgr = getOrCreateManager(el);
  const recognizer = new PinchRecognizer(options);
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
