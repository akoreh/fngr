export enum RecognizerState {
  Idle = 'idle',
  Possible = 'possible',
  Recognized = 'recognized',
  Failed = 'failed',
  Began = 'began',
  Changed = 'changed',
  Ended = 'ended',
  Cancelled = 'cancelled',
}

export const validTransitions: Record<RecognizerState, RecognizerState[]> = {
  [RecognizerState.Idle]: [RecognizerState.Possible],
  [RecognizerState.Possible]: [
    RecognizerState.Recognized,
    RecognizerState.Failed,
    RecognizerState.Began,
  ],
  [RecognizerState.Recognized]: [RecognizerState.Idle],
  [RecognizerState.Failed]: [RecognizerState.Idle],
  [RecognizerState.Began]: [
    RecognizerState.Changed,
    RecognizerState.Ended,
    RecognizerState.Cancelled,
  ],
  [RecognizerState.Changed]: [
    RecognizerState.Changed,
    RecognizerState.Ended,
    RecognizerState.Cancelled,
  ],
  [RecognizerState.Ended]: [RecognizerState.Idle],
  [RecognizerState.Cancelled]: [RecognizerState.Idle],
};

export type Direction = 'left' | 'right' | 'up' | 'down' | 'none';
export type DirectionFilter = 'all' | 'horizontal' | 'vertical';
export type Point = { x: number; y: number };

export interface PointerInfo {
  id: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
}

export interface GestureEvent {
  type: string;
  target: Element;
  pointers: PointerInfo[];
  timestamp: number;
  srcEvent: PointerEvent;
  preventDefault(): void;
}

export interface TrackedPointer {
  info: PointerInfo;
  start: Point;
  history: Array<{ x: number; y: number; t: number }>;
}
