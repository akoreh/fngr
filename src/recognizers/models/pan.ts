import type { Direction, DirectionFilter, GestureEvent } from '../../core/models/types';

export interface PanEvent extends GestureEvent {
  type: 'panstart' | 'panmove' | 'panend' | 'pancancel';
  deltaX: number;
  deltaY: number;
  velocityX: number;
  velocityY: number;
  direction: Direction;
  isFirst: boolean;
  isFinal: boolean;
}

export interface PanOptions {
  threshold?: number;
  direction?: DirectionFilter;
  pointers?: number;
  onPanStart?: (e: PanEvent) => void;
  onPanMove?: (e: PanEvent) => void;
  onPanEnd?: (e: PanEvent) => void;
  onPanCancel?: (e: PanEvent) => void;
}
