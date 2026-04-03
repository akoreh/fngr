import { BaseRecognizer } from '../../core/base-recognizer';
import { PointerTracker } from '../../core/pointer-tracker';
import { Manager } from '../../core/manager';
import {
  RecognizerState,
  type Direction,
  type DirectionFilter,
  type PointerInfo,
} from '../../core/models/types';
import type { SwipeEvent, SwipeOptions } from './models/swipe';

/**
 * Recognizes a directional flick gesture. On `pointerup`, checks that distance
 * exceeds {@link SwipeOptions.threshold | threshold} and velocity exceeds
 * {@link SwipeOptions.velocity | velocity}, then fires with the detected
 * {@link SwipeEvent.direction | direction}.
 */
export class SwipeRecognizer extends BaseRecognizer<SwipeEvent> {
  private tracker = new PointerTracker();
  private readonly threshold: number;
  private readonly velocityThreshold: number;
  private readonly directionFilter: DirectionFilter;
  private activePointerId: number | null = null;
  private target: Element | null = null;

  private readonly defaultThreshold = 30;
  private readonly defaultVelocity = 0.3;

  constructor(options: SwipeOptions) {
    super(options);
    this.threshold = options.threshold ?? this.defaultThreshold;
    this.velocityThreshold = options.velocity ?? this.defaultVelocity;
    this.directionFilter = options.direction ?? 'all';
  }

  onPointerDown(e: PointerEvent): void {
    if (this.state !== RecognizerState.Idle) return;
    this.tracker.onPointerDown(e);
    this.activePointerId = e.pointerId;
    this.target = (e.currentTarget as Element) ?? (e.target as Element);
    this.transition(RecognizerState.Possible);
  }

  onPointerMove(e: PointerEvent): void {
    this.tracker.onPointerMove(e);
  }

  onPointerUp(e: PointerEvent): void {
    if (this.state !== RecognizerState.Possible || e.pointerId !== this.activePointerId) {
      this.tracker.onPointerUp(e);
      return;
    }

    const start = this.tracker.getStartPosition(e.pointerId);
    if (!start) {
      this.tracker.onPointerUp(e);
      this.fail();
      return;
    }

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Get velocity BEFORE removing pointer from tracker
    const vel = this.tracker.getVelocity(e.pointerId);
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (distance < this.threshold || speed < this.velocityThreshold) {
      this.tracker.onPointerUp(e);
      this.fail();
      return;
    }

    const direction = this.computeDirection(dx, dy);

    if (!this.matchesDirectionFilter(direction)) {
      this.tracker.onPointerUp(e);
      this.fail();
      return;
    }

    const pointers: PointerInfo[] = [
      {
        id: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
      },
    ];

    const event: SwipeEvent = {
      type: 'swipe',
      target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
      pointers,
      timestamp: e.timeStamp,
      srcEvent: e,
      direction,
      velocity: speed,
      distance,
      preventDefault: () => e.preventDefault(),
    };

    this.transition(RecognizerState.Recognized);
    this.emit(event);
    this.tracker.onPointerUp(e);
    this.resetIfTerminal();
  }

  onPointerCancel(e: PointerEvent): void {
    this.tracker.onPointerCancel(e);
    if (e.pointerId !== this.activePointerId) return;
    if (this.state === RecognizerState.Possible) {
      this.fail();
    }
  }

  private computeDirection(dx: number, dy: number): Exclude<Direction, 'none'> {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  private matchesDirectionFilter(dir: Exclude<Direction, 'none'>): boolean {
    if (this.directionFilter === 'all') return true;
    if (this.directionFilter === 'horizontal') return dir === 'left' || dir === 'right';
    if (this.directionFilter === 'vertical') return dir === 'up' || dir === 'down';
    return false;
  }

  private fail(): void {
    if (this.state === RecognizerState.Possible) {
      this.transition(RecognizerState.Failed);
      this.resetIfTerminal();
    }
  }

  private resetIfTerminal(): void {
    if (this.state === RecognizerState.Recognized || this.state === RecognizerState.Failed) {
      this.reset();
    }
  }

  override reset(): void {
    super.reset();
    this.tracker.reset();
    this.activePointerId = null;
    this.target = null;
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
 * Attach a swipe recognizer to an element.
 * @param el - Target element.
 * @param optionsOrCallback - A {@link SwipeOptions} object, or a callback shorthand.
 * @returns Cleanup function that removes the recognizer.
 */
export function swipe(
  el: Element,
  optionsOrCallback: SwipeOptions | ((e: SwipeEvent) => void),
): () => void {
  const options: SwipeOptions =
    typeof optionsOrCallback === 'function' ? { onSwipe: optionsOrCallback } : optionsOrCallback;

  const mgr = getOrCreateManager(el);
  const recognizer = new SwipeRecognizer(options);
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
