import type { GestureEvent } from '../../../core/models/types';

/** Event emitted during a long-press gesture lifecycle. */
export interface LongPressEvent extends GestureEvent {
  /** Phase of the long-press: `'longpress'` on recognition, `'longpressup'` on release. */
  type: 'longpress' | 'longpressup';
  /** Milliseconds from pointer-down to the moment this event fires. */
  duration: number;
}

/** Options for {@link LongPressRecognizer} and the `longPress()` convenience function. */
export interface LongPressOptions {
  /** Maximum pointer movement in px before the gesture fails. Default `10`. */
  threshold?: number;
  /** Hold time in ms before recognition fires. Default `500`. */
  duration?: number;
  /** Callback fired when the long-press is recognized (pointer still down). */
  onLongpress?: (e: LongPressEvent) => void;
  /** Callback fired when the pointer lifts after a recognized long-press. */
  onLongpressup?: (e: LongPressEvent) => void;
}
