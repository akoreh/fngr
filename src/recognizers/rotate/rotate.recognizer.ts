import { BaseRecognizer } from '../../core/base-recognizer';
import { PointerTracker } from '../../core/pointer-tracker';
import { Manager } from '../../core/manager';
import { RecognizerState } from '../../core/models/types';
import type { RotateEvent, RotateOptions } from './models/rotate';

/**
 * Recognizes a two-finger rotation gesture. Fires when two pointers rotate
 * around their midpoint, reporting cumulative {@link RotateEvent.rotation | rotation}
 * in degrees, per-event {@link RotateEvent.deltaRotation | deltaRotation}, and the
 * {@link RotateEvent.center | center} point between the two pointers.
 *
 * Positive rotation = clockwise (in screen coordinates where Y points down).
 */
export class RotateRecognizer extends BaseRecognizer<RotateEvent> {
  private tracker = new PointerTracker();
  private readonly threshold: number;
  private target: Element | null = null;
  private lastAngle = 0;
  private cumulativeRotation = 0;
  private lastEmittedRotation = 0;
  private pointerIds: [number, number] | null = null;

  private readonly defaultThreshold = 0;

  constructor(options: RotateOptions) {
    super(options);
    this.threshold = options.threshold ?? this.defaultThreshold;
  }

  onPointerDown(e: PointerEvent): void {
    this.tracker.onPointerDown(e);

    if (this.state === RecognizerState.Idle && this.tracker.count >= 2 && !this.pointerIds) {
      this.target = (e.currentTarget as Element) ?? (e.target as Element);
      this.lastAngle = this.tracker.getAngle();
      this.cumulativeRotation = 0;
      this.lastEmittedRotation = 0;
      this.pointerIds = this.capturePointerIds();
      this.transition(RecognizerState.Possible);
    }
  }

  onPointerMove(e: PointerEvent): void {
    this.tracker.onPointerMove(e);

    if (!this.pointerIds || !this.isTrackedPointer(e.pointerId)) return;
    if (this.tracker.count < 2) return;

    const currentAngle = this.tracker.getAngle();
    const delta = this.normalizeAngle(currentAngle - this.lastAngle);
    this.lastAngle = currentAngle;
    this.cumulativeRotation += delta;

    if (this.state === RecognizerState.Possible) {
      if (Math.abs(this.cumulativeRotation) > this.threshold) {
        this.transition(RecognizerState.Began);
        this.emitRotate('rotatestart', e, this.cumulativeRotation, true, false);
      }
    } else if (this.state === RecognizerState.Began || this.state === RecognizerState.Changed) {
      if (this.state === RecognizerState.Began) {
        this.transition(RecognizerState.Changed);
      }
      this.emitRotate('rotatemove', e, this.cumulativeRotation, false, false);
    }
  }

  onPointerUp(e: PointerEvent): void {
    if (!this.isTrackedPointer(e.pointerId)) {
      this.tracker.onPointerUp(e);
      return;
    }

    if (this.state === RecognizerState.Began || this.state === RecognizerState.Changed) {
      const currentAngle = this.tracker.getAngle();
      const delta = this.normalizeAngle(currentAngle - this.lastAngle);
      this.cumulativeRotation += delta;
      this.transition(RecognizerState.Ended);
      this.emitRotate('rotateend', e, this.cumulativeRotation, false, true);
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
      const currentAngle = this.tracker.getAngle();
      const delta = this.normalizeAngle(currentAngle - this.lastAngle);
      this.cumulativeRotation += delta;
      this.transition(RecognizerState.Cancelled);
      this.emitRotate('rotatecancel', e, this.cumulativeRotation, false, true);
    } else if (this.state === RecognizerState.Possible) {
      this.transition(RecognizerState.Failed);
    }

    this.tracker.onPointerCancel(e);
    this.resetIfTerminal();
  }

  private emitRotate(
    type: RotateEvent['type'],
    e: PointerEvent,
    rotation: number,
    isFirst: boolean,
    isFinal: boolean,
  ): void {
    const deltaRotation = rotation - this.lastEmittedRotation;
    this.lastEmittedRotation = rotation;

    const center = this.tracker.getCenter();

    const event: RotateEvent = {
      type,
      target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
      pointers: this.tracker.pointers,
      timestamp: e.timeStamp,
      srcEvent: e,
      rotation,
      deltaRotation,
      center,
      isFirst,
      isFinal,
      preventDefault: () => e.preventDefault(),
    };

    this.emit(event);
  }

  /**
   * Normalize an angle difference to the range (-180, 180].
   * Prevents jumps when crossing the ±180° boundary.
   */
  private normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle <= -180) angle += 360;
    return angle;
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
    this.lastAngle = 0;
    this.cumulativeRotation = 0;
    this.lastEmittedRotation = 0;
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
 * Attach a rotate recognizer to an element.
 * @param el - Target element.
 * @param optionsOrCallback - A {@link RotateOptions} object, or a callback shorthand
 *   (invoked on `'rotatestart'` only; use the options form for other events).
 * @returns Cleanup function that removes the recognizer.
 */
export function rotate(
  el: Element,
  optionsOrCallback: RotateOptions | ((e: RotateEvent) => void),
): () => void {
  const options: RotateOptions =
    typeof optionsOrCallback === 'function'
      ? { onRotatestart: optionsOrCallback }
      : optionsOrCallback;

  const mgr = getOrCreateManager(el);
  const recognizer = new RotateRecognizer(options);
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
