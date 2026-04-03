import { RecognizerState, validTransitions, type GestureEvent } from './models/types';

/**
 * Abstract base class for all gesture recognizers.
 *
 * Provides the state machine, event emission, failure-dependency wiring, and
 * simultaneous-recognition support. Subclasses implement the four pointer-event
 * handlers to drive transitions.
 *
 * @typeParam T - The specific gesture event type this recognizer emits.
 */
export abstract class BaseRecognizer<T extends GestureEvent> {
  private _state: RecognizerState = RecognizerState.Idle;
  private _failureDeps: Set<BaseRecognizer<any>> = new Set();
  private _simultaneousWith: Set<BaseRecognizer<any>> = new Set();
  protected callbacks: Record<string, ((e: any) => void) | undefined>;

  /**
   * @param options - Recognizer options. Properties whose keys start with `on`
   *   and whose values are functions are extracted as gesture-event callbacks.
   */
  constructor(options: Record<string, any>) {
    this.callbacks = {};
    for (const [key, value] of Object.entries(options)) {
      if (key.startsWith('on') && typeof value === 'function') {
        this.callbacks[key] = value;
      }
    }
  }

  /** Current state of the recognizer's state machine. */
  get state(): RecognizerState {
    return this._state;
  }

  /** Recognizers that must fail before this one can recognize. */
  get failureDependencies(): ReadonlyArray<BaseRecognizer<any>> {
    return Array.from(this._failureDeps);
  }

  /** Handle a `pointerdown` event. Subclasses drive state transitions from here. */
  abstract onPointerDown(e: PointerEvent): void;
  /** Handle a `pointermove` event. */
  abstract onPointerMove(e: PointerEvent): void;
  /** Handle a `pointerup` event. */
  abstract onPointerUp(e: PointerEvent): void;
  /** Handle a `pointercancel` event. */
  abstract onPointerCancel(e: PointerEvent): void;

  protected transition(newState: RecognizerState): void {
    const valid = validTransitions[this._state];
    if (!valid.includes(newState)) {
      throw new Error(`Invalid state transition: ${this._state} → ${newState}`);
    }
    this._state = newState;
  }

  protected emit(event: T): void {
    const callbackName = `on${event.type.charAt(0).toUpperCase()}${event.type.slice(1)}`;
    this.callbacks[callbackName]?.(event);

    if (event.target && typeof event.target.dispatchEvent === 'function') {
      const customEvent = new CustomEvent(`fngr:${event.type}`, {
        detail: event,
        bubbles: true,
        cancelable: true,
      });
      event.target.dispatchEvent(customEvent);
    }
  }

  /**
   * This recognizer will defer recognition until `other` has failed.
   * Used for tap/doubletap arbitration — tap waits for doubletap to fail first.
   */
  requireFailureOf(other: BaseRecognizer<any>): this {
    this._failureDeps.add(other);
    return this;
  }

  /** Returns `true` if this recognizer must wait for `other` to fail before recognizing. */
  hasFailureDependency(other: BaseRecognizer<any>): boolean {
    return this._failureDeps.has(other);
  }

  /** Allow this recognizer and `other` to recognize at the same time. */
  allowSimultaneous(other: BaseRecognizer<any>): this {
    this._simultaneousWith.add(other);
    other._simultaneousWith.add(this);
    return this;
  }

  /** Returns `true` if this recognizer is allowed to recognize at the same time as `other`. */
  canRecognizeSimultaneously(other: BaseRecognizer<any>): boolean {
    return this._simultaneousWith.has(other);
  }

  /** Reset the recognizer to Idle. Subclasses should call `super.reset()` and clear their own state. */
  reset(): void {
    this._state = RecognizerState.Idle;
  }

  /** Tear down the recognizer, clearing all state, deps, and callbacks. */
  destroy(): void {
    this.reset();
    this._failureDeps.clear();
    this._simultaneousWith.clear();
    this.callbacks = {};
  }
}
