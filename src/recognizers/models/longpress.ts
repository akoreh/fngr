import type { GestureEvent } from '../../core/models/types';

export interface LongPressEvent extends GestureEvent {
  type: 'longpress' | 'longpressup';
  duration: number;
}

export interface LongPressOptions {
  threshold?: number;
  duration?: number;
  onLongPress?: (e: LongPressEvent) => void;
  onLongPressUp?: (e: LongPressEvent) => void;
}
