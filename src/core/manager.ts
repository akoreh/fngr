import type { BaseRecognizer } from './base-recognizer';

/** Options for {@link Manager.add}. */
export interface AddOptions {
  /** Higher priority recognizers receive pointer events first. Default `0`. */
  priority?: number;
}

interface ManagedRecognizer {
  recognizer: BaseRecognizer<any>;
  priority: number;
}

/**
 * Binds gesture recognizers to a DOM element.
 *
 * Attaches pointer-event listeners and routes each event to all registered
 * recognizers in priority order. Sets `touch-action: none` on the element
 * (restored on {@link destroy}).
 *
 * @example
 * ```ts
 * const manager = new Manager(el);
 * manager.add(new TapRecognizer({ onTap: console.log }));
 * // later:
 * manager.destroy();
 * ```
 */
export class Manager {
  readonly element: Element;
  private recognizers: ManagedRecognizer[] = [];
  private previousTouchAction: string;
  private destroyed = false;

  private handlePointerDown: (e: Event) => void;
  private handlePointerMove: (e: Event) => void;
  private handlePointerUp: (e: Event) => void;
  private handlePointerCancel: (e: Event) => void;

  constructor(element: Element) {
    this.element = element;
    this.previousTouchAction = (element as HTMLElement).style.touchAction;
    (element as HTMLElement).style.touchAction = 'none';

    this.handlePointerDown = (e) => {
      const pe = e as PointerEvent;
      const target = e.currentTarget as Element;
      if (typeof target.setPointerCapture === 'function') {
        target.setPointerCapture(pe.pointerId);
      }
      this.routeEvent('onPointerDown', pe);
    };
    this.handlePointerMove = (e) => this.routeEvent('onPointerMove', e as PointerEvent);
    this.handlePointerUp = (e) => this.routeEvent('onPointerUp', e as PointerEvent);
    this.handlePointerCancel = (e) => this.routeEvent('onPointerCancel', e as PointerEvent);

    element.addEventListener('pointerdown', this.handlePointerDown);
    element.addEventListener('pointermove', this.handlePointerMove);
    element.addEventListener('pointerup', this.handlePointerUp);
    element.addEventListener('pointercancel', this.handlePointerCancel);
  }

  /** Register a recognizer. Returns the recognizer for chaining. */
  add<T extends BaseRecognizer<any>>(recognizer: T, options: AddOptions = {}): T {
    this.recognizers.push({
      recognizer,
      priority: options.priority ?? 0,
    });
    // Sort by priority descending (higher priority first)
    this.recognizers.sort((a, b) => b.priority - a.priority);
    return recognizer;
  }

  /** Number of recognizers currently registered. */
  get recognizerCount(): number {
    return this.recognizers.length;
  }

  /** Unregister a recognizer. Does nothing if not found. */
  remove(recognizer: BaseRecognizer<any>): void {
    const idx = this.recognizers.findIndex((mr) => mr.recognizer === recognizer);
    if (idx !== -1) {
      this.recognizers.splice(idx, 1);
    }
  }

  private routeEvent(
    method: 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel',
    e: PointerEvent,
  ): void {
    for (const { recognizer } of this.recognizers) {
      recognizer[method](e);
    }
  }

  /** Remove all listeners, destroy all recognizers, restore `touch-action`. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('pointermove', this.handlePointerMove);
    this.element.removeEventListener('pointerup', this.handlePointerUp);
    this.element.removeEventListener('pointercancel', this.handlePointerCancel);

    (this.element as HTMLElement).style.touchAction = this.previousTouchAction;

    for (const { recognizer } of this.recognizers) {
      recognizer.destroy();
    }
    this.recognizers = [];
  }
}
