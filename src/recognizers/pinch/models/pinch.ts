import type { GestureEvent, Point } from '../../../core/models/types';

/** Event emitted by {@link PinchRecognizer} during a two-finger pinch gesture. */
export interface PinchEvent extends GestureEvent {
  /** Phase of the pinch gesture. */
  type: 'pinchstart' | 'pinchmove' | 'pinchend' | 'pinchcancel';
  /** Cumulative scale factor since the gesture started. `1` means no change. */
  scale: number;
  /** Change in scale since the last event. */
  deltaScale: number;
  /** Midpoint between the two pointers. */
  center: Point;
  /** `true` only on the first `'pinchstart'` event. */
  isFirst: boolean;
  /** `true` only on `'pinchend'` or `'pinchcancel'`. */
  isFinal: boolean;
}

/** Options for configuring a {@link PinchRecognizer}. */
export interface PinchOptions {
  /** Minimum scale change to trigger recognition. Default `0`. */
  threshold?: number;
  /** Callback invoked on `'pinchstart'`. */
  onPinchstart?: (e: PinchEvent) => void;
  /** Callback invoked on `'pinchmove'`. */
  onPinchmove?: (e: PinchEvent) => void;
  /** Callback invoked on `'pinchend'`. */
  onPinchend?: (e: PinchEvent) => void;
  /** Callback invoked on `'pinchcancel'`. */
  onPinchcancel?: (e: PinchEvent) => void;
}
