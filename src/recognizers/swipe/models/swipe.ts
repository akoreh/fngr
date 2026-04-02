import type { Direction, DirectionFilter, GestureEvent } from '../../../core/models/types';

/** Event emitted when a swipe gesture is recognized. */
export interface SwipeEvent extends GestureEvent {
  type: 'swipe';
  /** Cardinal direction of the swipe (`'left'`, `'right'`, `'up'`, or `'down'`). */
  direction: Exclude<Direction, 'none'>;
  /** Speed of the swipe in px/ms. */
  velocity: number;
  /** Total distance traveled from pointer-down to pointer-up, in px. */
  distance: number;
}

/** Options for {@link SwipeRecognizer} and the `swipe()` convenience function. */
export interface SwipeOptions {
  /** Minimum distance (px) for a swipe to be recognized. Default `30`. */
  threshold?: number;
  /** Minimum velocity (px/ms) for a swipe to be recognized. Default `0.3`. */
  velocity?: number;
  /** Restrict recognized directions. Default `'all'`. */
  direction?: DirectionFilter;
  /** Callback fired when a swipe is recognized. */
  onSwipe?: (e: SwipeEvent) => void;
}
