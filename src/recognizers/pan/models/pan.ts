import type { Direction, DirectionFilter, GestureEvent } from '../../../core/models/types';

/** Event emitted during a pan (drag) gesture lifecycle. */
export interface PanEvent extends GestureEvent {
  /** Phase of the pan: `'panstart'`, `'panmove'`, `'panend'`, or `'pancancel'`. */
  type: 'panstart' | 'panmove' | 'panend' | 'pancancel';
  /** Horizontal displacement from the pointer-down position, in px. */
  deltaX: number;
  /** Vertical displacement from the pointer-down position, in px. */
  deltaY: number;
  /** Horizontal velocity in px/ms. */
  velocityX: number;
  /** Vertical velocity in px/ms. */
  velocityY: number;
  /** Cardinal direction of the current movement. */
  direction: Direction;
  /** `true` only on the first `'panstart'` event. */
  isFirst: boolean;
  /** `true` only on the final `'panend'` or `'pancancel'` event. */
  isFinal: boolean;
}

/** Options for {@link PanRecognizer} and the `pan()` convenience function. */
export interface PanOptions {
  /** Minimum distance (px) the pointer must move before recognition starts. Default `10`. */
  threshold?: number;
  /** Restrict recognized directions. Default `'all'`. */
  direction?: DirectionFilter;
  /** Number of pointers required. Default `1`. */
  pointers?: number;
  /** Callback fired when the pan begins (movement exceeds threshold). */
  onPanstart?: (e: PanEvent) => void;
  /** Callback fired on each pointer move after the pan has started. */
  onPanmove?: (e: PanEvent) => void;
  /** Callback fired when the pointer lifts after a recognized pan. */
  onPanend?: (e: PanEvent) => void;
  /** Callback fired when the pointer is cancelled during a pan. */
  onPancancel?: (e: PanEvent) => void;
}
