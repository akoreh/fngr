import type { Direction, DirectionFilter, GestureEvent } from '../../core/models/types';

export interface SwipeEvent extends GestureEvent {
  type: 'swipe';
  direction: Exclude<Direction, 'none'>;
  velocity: number;
  distance: number;
}

export interface SwipeOptions {
  threshold?: number;
  velocity?: number;
  direction?: DirectionFilter;
  onSwipe?: (e: SwipeEvent) => void;
}
