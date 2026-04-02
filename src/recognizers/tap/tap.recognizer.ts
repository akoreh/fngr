import { BaseRecognizer } from '../../core/base-recognizer';
import { PointerTracker } from '../../core/pointer-tracker';
import { Manager } from '../../core/manager';
import { RecognizerState, type PointerInfo } from '../../core/models/types';
import type { TapEvent, TapOptions } from './models/tap';

export class TapRecognizer extends BaseRecognizer<TapEvent> {
  private tracker = new PointerTracker();
  private startTime = 0;
  private readonly threshold: number;
  private readonly interval: number;
  private activePointerId: number | null = null;
  private target: Element | null = null;
  private pendingEvent: TapEvent | null = null;
  private readonly defaultThreshold = 10;
  private readonly defaultInterval = 250;

  constructor(options: TapOptions) {
    super(options);
    this.threshold = options.threshold ?? this.defaultThreshold;
    this.interval = options.interval ?? this.defaultInterval;
  }

  onPointerDown(e: PointerEvent): void {
    if (this.state !== RecognizerState.Idle) return;
    this.tracker.onPointerDown(e);
    this.activePointerId = e.pointerId;
    this.startTime = e.timeStamp;
    this.target = (e.currentTarget as Element) ?? (e.target as Element);
    this.transition(RecognizerState.Possible);
  }

  onPointerMove(e: PointerEvent): void {
    if (this.state !== RecognizerState.Possible) return;
    if (this.pendingEvent) return;
    if (e.pointerId !== this.activePointerId) return;
    this.tracker.onPointerMove(e);

    const start = this.tracker.getStartPosition(e.pointerId);
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > this.threshold) {
      this.transition(RecognizerState.Failed);
    }
  }

  onPointerUp(e: PointerEvent): void {
    // Already deferred — ignore subsequent pointer events
    if (this.pendingEvent) {
      this.tracker.onPointerUp(e);
      return;
    }

    if (this.state === RecognizerState.Possible && e.pointerId === this.activePointerId) {
      const elapsed = e.timeStamp - this.startTime;

      if (elapsed <= this.interval) {
        const pointers: PointerInfo[] = [
          {
            id: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            pageX: e.pageX,
            pageY: e.pageY,
          },
        ];

        const event: TapEvent = {
          type: 'tap',
          target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
          pointers,
          timestamp: e.timeStamp,
          srcEvent: e,
          count: 1,
          preventDefault: () => e.preventDefault(),
        };

        // Check failure dependencies — defer if any dependency is still pending
        const deps = this.failureDependencies;
        const pendingDeps = deps.filter((d) => d.state === RecognizerState.Possible);

        if (pendingDeps.length > 0) {
          this.pendingEvent = event;
          for (const dep of pendingDeps) {
            if ('onResolved' in dep && typeof (dep as any).onResolved === 'function') {
              (dep as any).onResolved(() => this.tryRecognize());
            }
          }
        } else {
          this.transition(RecognizerState.Recognized);
          this.emit(event);
        }
      } else {
        this.transition(RecognizerState.Failed);
      }
    }

    this.tracker.onPointerUp(e);
    this.resetIfTerminal();
  }

  onPointerCancel(e: PointerEvent): void {
    this.tracker.onPointerCancel(e);
    if (this.state === RecognizerState.Possible) {
      this.transition(RecognizerState.Failed);
    }
    this.resetIfTerminal();
  }

  private tryRecognize(): void {
    if (this.state !== RecognizerState.Possible || !this.pendingEvent) return;

    // Check if all failure deps have resolved
    const stillPending = this.failureDependencies.some((d) => d.state === RecognizerState.Possible);
    if (stillPending) return;

    // If any dep recognized, this tap should fail
    const anyRecognized = this.failureDependencies.some(
      (d) => d.state === RecognizerState.Recognized,
    );

    if (anyRecognized) {
      this.transition(RecognizerState.Failed);
      this.resetIfTerminal();
      return;
    }

    this.transition(RecognizerState.Recognized);
    this.emit(this.pendingEvent);
    this.resetIfTerminal();
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
    this.startTime = 0;
    this.pendingEvent = null;
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

export function tap(
  el: Element,
  optionsOrCallback: TapOptions | ((e: TapEvent) => void),
): () => void {
  const options: TapOptions =
    typeof optionsOrCallback === 'function' ? { onTap: optionsOrCallback } : optionsOrCallback;

  const mgr = getOrCreateManager(el);
  const recognizer = new TapRecognizer(options);
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
