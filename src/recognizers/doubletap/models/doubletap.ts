import type { GestureEvent } from '../../../core/models/types';

export interface DoubleTapEvent extends GestureEvent {
  type: 'doubletap';
  count: 2;
}

export interface DoubleTapOptions {
  threshold?: number;
  interval?: number;
  onDoubletap?: (e: DoubleTapEvent) => void;
}
