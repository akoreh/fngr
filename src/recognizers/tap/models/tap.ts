import type { GestureEvent } from '../../../core/models/types';

export interface TapEvent extends GestureEvent {
  type: 'tap';
  count: 1;
}

export interface TapOptions {
  threshold?: number;
  interval?: number;
  onTap?: (e: TapEvent) => void;
}
