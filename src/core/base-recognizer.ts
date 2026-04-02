import { RecognizerState, validTransitions, type GestureEvent } from './models/types';

export abstract class BaseRecognizer<T extends GestureEvent> {
  private _state: RecognizerState = RecognizerState.Idle;
  private _failureDeps: Set<BaseRecognizer<any>> = new Set();
  private _simultaneousWith: Set<BaseRecognizer<any>> = new Set();
  protected callbacks: Record<string, ((e: any) => void) | undefined>;

  constructor(options: Record<string, any>) {
    this.callbacks = {};
    for (const [key, value] of Object.entries(options)) {
      if (key.startsWith('on') && typeof value === 'function') {
        this.callbacks[key] = value;
      }
    }
  }

  get state(): RecognizerState {
    return this._state;
  }

  get failureDependencies(): ReadonlyArray<BaseRecognizer<any>> {
    return Array.from(this._failureDeps);
  }

  abstract onPointerDown(e: PointerEvent): void;
  abstract onPointerMove(e: PointerEvent): void;
  abstract onPointerUp(e: PointerEvent): void;
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

  requireFailureOf(other: BaseRecognizer<any>): this {
    this._failureDeps.add(other);
    return this;
  }

  hasFailureDependency(other: BaseRecognizer<any>): boolean {
    return this._failureDeps.has(other);
  }

  allowSimultaneous(other: BaseRecognizer<any>): this {
    this._simultaneousWith.add(other);
    other._simultaneousWith.add(this);
    return this;
  }

  canRecognizeSimultaneously(other: BaseRecognizer<any>): boolean {
    return this._simultaneousWith.has(other);
  }

  reset(): void {
    this._state = RecognizerState.Idle;
  }

  destroy(): void {
    this.reset();
    this._failureDeps.clear();
    this._simultaneousWith.clear();
    this.callbacks = {};
  }
}
