/**
 * States a gesture recognizer can be in.
 *
 * Discrete gestures (tap, doubletap, longpress): Idle → Possible → Recognized | Failed.
 * Continuous gestures (pan, pinch, rotate): Idle → Possible → Began → Changed → Ended | Cancelled.
 */
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

/** Cardinal swipe direction, or `'none'` when velocity is below threshold. */
export type Direction = 'left' | 'right' | 'up' | 'down' | 'none';
/** Filter to restrict which swipe directions a recognizer accepts. */
export type DirectionFilter = 'all' | 'horizontal' | 'vertical';
/** 2D point in pixel coordinates. */
export type Point = { x: number; y: number };

/** Snapshot of a pointer's position at the time a gesture event fires. */
export interface PointerInfo {
  /** The `PointerEvent.pointerId`. */
  id: number;
  /** Horizontal position relative to the viewport. */
  clientX: number;
  /** Vertical position relative to the viewport. */
  clientY: number;
  /** Horizontal position relative to the document. */
  pageX: number;
  /** Vertical position relative to the document. */
  pageY: number;
}

/** Base shape shared by all gesture events emitted by fngr recognizers. */
export interface GestureEvent {
  /** Gesture type identifier (e.g. `'tap'`, `'longpress'`, `'pan'`). */
  type: string;
  /** The DOM element the recognizer is attached to. */
  target: Element;
  /** Pointer snapshots at the time the event fires. */
  pointers: PointerInfo[];
  /** Timestamp (ms) when the event fires. */
  timestamp: number;
  /** The raw DOM `PointerEvent` that triggered or was active at recognition time. */
  srcEvent: PointerEvent;
  /** Calls `preventDefault()` on the underlying `PointerEvent`. */
  preventDefault(): void;
}

export interface TrackedPointer {
  info: PointerInfo;
  start: Point;
  history: Array<{ x: number; y: number; t: number }>;
}
