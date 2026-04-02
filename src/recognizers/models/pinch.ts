import type { GestureEvent, Point } from '../../core/models/types';

export interface PinchEvent extends GestureEvent {
  type: 'pinchstart' | 'pinchmove' | 'pinchend' | 'pinchcancel';
  scale: number;
  deltaScale: number;
  center: Point;
}

export interface PinchOptions {
  threshold?: number;
  pointers?: number;
  onPinchStart?: (e: PinchEvent) => void;
  onPinchMove?: (e: PinchEvent) => void;
  onPinchEnd?: (e: PinchEvent) => void;
  onPinchCancel?: (e: PinchEvent) => void;
}
