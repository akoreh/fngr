import type { GestureEvent, Point } from '../../core/models/types';

export interface RotateEvent extends GestureEvent {
  type: 'rotatestart' | 'rotatemove' | 'rotateend' | 'rotatecancel';
  rotation: number;
  deltaRotation: number;
  center: Point;
}

export interface RotateOptions {
  threshold?: number;
  pointers?: number;
  onRotateStart?: (e: RotateEvent) => void;
  onRotateMove?: (e: RotateEvent) => void;
  onRotateEnd?: (e: RotateEvent) => void;
  onRotateCancel?: (e: RotateEvent) => void;
}
