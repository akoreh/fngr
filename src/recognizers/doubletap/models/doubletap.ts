import type { GestureEvent } from '../../../core/models/types';

/** Event emitted when a double-tap gesture is recognized. */
export interface DoubleTapEvent extends GestureEvent {
  type: 'doubletap';
  /** Always `2`. */
  count: 2;
}

/** Options for {@link DoubleTapRecognizer} and the `doubleTap()` convenience function. */
export interface DoubleTapOptions {
  /** Max distance (px) between the two taps, and max movement within each tap. Default `10`. */
  threshold?: number;
  /** Max time (ms) between the first and second tap. Default `300`. */
  interval?: number;
  /** Callback fired when a double-tap is recognized. */
  onDoubletap?: (e: DoubleTapEvent) => void;
}
