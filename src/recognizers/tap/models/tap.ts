import type { GestureEvent } from '../../../core/models/types';

/** Event emitted when a tap gesture is recognized. */
export interface TapEvent extends GestureEvent {
  type: 'tap';
  /** Always `1` for a single tap. */
  count: 1;
}

/** Options for {@link TapRecognizer} and the `tap()` convenience function. */
export interface TapOptions {
  /** Max distance (px) the pointer may move during the tap. Default `10`. */
  threshold?: number;
  /** Max time (ms) between pointer-down and pointer-up. Default `250`. */
  interval?: number;
  /** Callback fired when a tap is recognized. */
  onTap?: (e: TapEvent) => void;
}
