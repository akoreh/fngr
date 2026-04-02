import { BaseRecognizer } from '../../core/base-recognizer';
import { PointerTracker } from '../../core/pointer-tracker';
import { Manager } from '../../core/manager';
import { RecognizerState, type Direction, type DirectionFilter } from '../../core/models/types';
import type { PanEvent, PanOptions } from './models/pan';

/**
 * Recognizes a single-finger drag (pan) gesture. Fires `'panstart'` when the
 * pointer moves beyond {@link PanOptions.threshold | threshold} px,
 * `'panmove'` on each subsequent move, `'panend'` on pointer-up, and
 * `'pancancel'` if the pointer is cancelled mid-gesture.
 *
 * Uses the continuous state machine: Idle → Possible → Began → Changed → Ended | Cancelled.
 */
export class PanRecognizer extends BaseRecognizer<PanEvent> {
  private tracker = new PointerTracker();
  private readonly threshold: number;
  private readonly directionFilter: DirectionFilter;
  private activePointerId: number | null = null;
  private target: Element | null = null;
  private startX = 0;
  private startY = 0;

  private readonly defaultThreshold = 10;

  constructor(options: PanOptions) {
    super(options);
    this.threshold = options.threshold ?? this.defaultThreshold;
    this.directionFilter = options.direction ?? 'all';
  }

  onPointerDown(e: PointerEvent): void {
    this.tracker.onPointerDown(e);
    if (this.state !== RecognizerState.Idle) return;
    this.activePointerId = e.pointerId;
    this.target = (e.currentTarget as Element) ?? (e.target as Element);
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.transition(RecognizerState.Possible);
  }

  onPointerMove(e: PointerEvent): void {
    this.tracker.onPointerMove(e);
    if (e.pointerId !== this.activePointerId) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (this.state === RecognizerState.Possible) {
      if (distance > this.threshold) {
        const dir = this.computeDirection(dx, dy);
        if (!this.matchesDirectionFilter(dir)) {
          this.transition(RecognizerState.Failed);
          this.resetIfTerminal();
          return;
        }
        this.transition(RecognizerState.Began);
        this.emitPan('panstart', e, dx, dy, true, false);
      }
    } else if (this.state === RecognizerState.Began || this.state === RecognizerState.Changed) {
      if (this.state === RecognizerState.Began) {
        this.transition(RecognizerState.Changed);
      }
      this.emitPan('panmove', e, dx, dy, false, false);
    }
  }

  onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.activePointerId) {
      this.tracker.onPointerUp(e);
      return;
    }

    if (this.state === RecognizerState.Began || this.state === RecognizerState.Changed) {
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      this.transition(RecognizerState.Ended);
      this.emitPan('panend', e, dx, dy, false, true);
    } else if (this.state === RecognizerState.Possible) {
      this.transition(RecognizerState.Failed);
    }

    this.tracker.onPointerUp(e);
    this.resetIfTerminal();
  }

  onPointerCancel(e: PointerEvent): void {
    if (this.state === RecognizerState.Began || this.state === RecognizerState.Changed) {
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      this.transition(RecognizerState.Cancelled);
      this.emitPan('pancancel', e, dx, dy, false, true);
    } else if (this.state === RecognizerState.Possible) {
      this.transition(RecognizerState.Failed);
    }

    this.tracker.onPointerCancel(e);
    this.resetIfTerminal();
  }

  private emitPan(
    type: PanEvent['type'],
    e: PointerEvent,
    dx: number,
    dy: number,
    isFirst: boolean,
    isFinal: boolean,
  ): void {
    const vel = this.tracker.getVelocity(e.pointerId);

    const event: PanEvent = {
      type,
      target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
      pointers: this.tracker.pointers,
      timestamp: e.timeStamp,
      srcEvent: e,
      deltaX: dx,
      deltaY: dy,
      velocityX: vel.x,
      velocityY: vel.y,
      direction: this.computeDirection(dx, dy),
      isFirst,
      isFinal,
      preventDefault: () => e.preventDefault(),
    };

    this.emit(event);
  }

  private computeDirection(dx: number, dy: number): Direction {
    if (dx === 0 && dy === 0) return 'none';
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  private matchesDirectionFilter(dir: Direction): boolean {
    if (this.directionFilter === 'all') return true;
    if (this.directionFilter === 'horizontal') return dir === 'left' || dir === 'right';
    if (this.directionFilter === 'vertical') return dir === 'up' || dir === 'down';
    return false;
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
    this.activePointerId = null;
    this.target = null;
    this.startX = 0;
    this.startY = 0;
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
 * Attach a pan recognizer to an element.
 * @param el - Target element.
 * @param optionsOrCallback - A {@link PanOptions} object, or a callback shorthand
 *   (invoked on `'panstart'` only; use the options form for other events).
 * @returns Cleanup function that removes the recognizer.
 */
export function pan(
  el: Element,
  optionsOrCallback: PanOptions | ((e: PanEvent) => void),
): () => void {
  const options: PanOptions =
    typeof optionsOrCallback === 'function' ? { onPanstart: optionsOrCallback } : optionsOrCallback;

  const mgr = getOrCreateManager(el);
  const recognizer = new PanRecognizer(options);
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
