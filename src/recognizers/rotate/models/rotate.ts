import type { GestureEvent, Point } from '../../../core/models/types';

/** Event emitted by {@link RotateRecognizer} during a two-finger rotation gesture. */
export interface RotateEvent extends GestureEvent {
  /** Phase of the rotate gesture. */
  type: 'rotatestart' | 'rotatemove' | 'rotateend' | 'rotatecancel';
  /** Cumulative rotation in degrees since the gesture started. Positive = clockwise. */
  rotation: number;
  /** Change in rotation (degrees) since the last event. */
  deltaRotation: number;
  /** Midpoint between the two pointers. */
  center: Point;
  /** `true` only on `'rotatestart'`. */
  isFirst: boolean;
  /** `true` only on `'rotateend'` or `'rotatecancel'`. */
  isFinal: boolean;
}

/** Options for configuring a {@link RotateRecognizer}. */
export interface RotateOptions {
  /** Minimum rotation in degrees to trigger recognition. Default `0`. */
  threshold?: number;
  /** Callback invoked on `'rotatestart'`. */
  onRotatestart?: (e: RotateEvent) => void;
  /** Callback invoked on `'rotatemove'`. */
  onRotatemove?: (e: RotateEvent) => void;
  /** Callback invoked on `'rotateend'`. */
  onRotateend?: (e: RotateEvent) => void;
  /** Callback invoked on `'rotatecancel'`. */
  onRotatecancel?: (e: RotateEvent) => void;
}
