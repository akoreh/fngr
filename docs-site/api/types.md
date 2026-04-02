# Types

Core types and interfaces shared across the fngr library.

```ts
import type { RecognizerState, GestureEvent, PointerInfo, Point, Direction, DirectionFilter } from 'fngr';
```

---

## `RecognizerState`

An enum describing every state a recognizer can occupy. See the [State Machine Guide](/guides/state-machine) for the full set of valid transitions.

```ts
enum RecognizerState {
  Idle       = 'idle',
  Possible   = 'possible',
  Recognized = 'recognized',
  Failed     = 'failed',
  Began      = 'began',
  Changed    = 'changed',
  Ended      = 'ended',
  Cancelled  = 'cancelled',
}
```

| Value | Meaning |
|---|---|
| `Idle` | Initial state. The recognizer is waiting for input. |
| `Possible` | A gesture sequence has started; outcome is not yet determined. |
| `Recognized` | A discrete gesture (e.g. tap) was successfully recognized. Transitions back to `Idle`. |
| `Failed` | The gesture was definitively ruled out. Transitions back to `Idle`. |
| `Began` | A continuous gesture (e.g. pan) has started. |
| `Changed` | A continuous gesture is ongoing and data has updated. |
| `Ended` | A continuous gesture ended normally. Transitions back to `Idle`. |
| `Cancelled` | A continuous gesture was interrupted (e.g. by a system event). Transitions back to `Idle`. |

---

## `GestureEvent`

The base interface for all gesture event objects passed to callbacks and dispatched as `CustomEvent` detail.

```ts
interface GestureEvent {
  type: string;
  target: Element;
  pointers: PointerInfo[];
  timestamp: number;
  srcEvent: PointerEvent;
  preventDefault(): void;
}
```

| Property | Type | Description |
|---|---|---|
| `type` | `string` | Gesture type identifier, e.g. `'tap'`. Used to derive the `fngr:<type>` CustomEvent name and the `on<Type>` callback name. |
| `target` | `Element` | The element the gesture was recognized on. |
| `pointers` | `PointerInfo[]` | All active pointers at the moment of recognition. |
| `timestamp` | `number` | Time of the event in milliseconds (from `PointerEvent.timeStamp`). |
| `srcEvent` | `PointerEvent` | The raw `PointerEvent` that triggered recognition. |
| `preventDefault` | `() => void` | Calls `preventDefault()` on `srcEvent`. |

---

## `PointerInfo`

A plain-object snapshot of pointer coordinates, extracted from a `PointerEvent`.

```ts
interface PointerInfo {
  id: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
}
```

| Property | Type | Description |
|---|---|---|
| `id` | `number` | The `PointerEvent.pointerId` that identifies this pointer across events. |
| `clientX` | `number` | X coordinate relative to the viewport. |
| `clientY` | `number` | Y coordinate relative to the viewport. |
| `pageX` | `number` | X coordinate relative to the document. |
| `pageY` | `number` | Y coordinate relative to the document. |

---

## `Point`

A minimal 2-D coordinate pair.

```ts
type Point = { x: number; y: number };
```

Used by [PointerTracker](/api/pointer-tracker) for `getCenter()`, `getStartPosition()`, and related geometry methods.

---

## `Direction`

The resolved direction of a gesture.

```ts
type Direction = 'left' | 'right' | 'up' | 'down' | 'none';
```

`'none'` is returned when movement is negligible or perfectly diagonal.

---

## `DirectionFilter`

A constraint on which directions a recognizer should respond to.

```ts
type DirectionFilter = 'all' | 'horizontal' | 'vertical';
```

| Value | Permitted directions |
|---|---|
| `'all'` | `left`, `right`, `up`, `down` |
| `'horizontal'` | `left`, `right` |
| `'vertical'` | `up`, `down` |

---

## `TapEvent`

Extends `GestureEvent` for the tap gesture. Emitted by `TapRecognizer` and dispatched as `fngr:tap`.

```ts
import type { TapEvent } from 'fngr/tap';
```

```ts
interface TapEvent extends GestureEvent {
  type: 'tap';
  count: 1;
}
```

| Property | Type | Description |
|---|---|---|
| `type` | `'tap'` | Always `'tap'`. |
| `count` | `1` | Always `1`. Reserved for multi-tap variants in future releases. |

---

## `TapOptions`

Configuration accepted by the `TapRecognizer` constructor and the `tap()` convenience function.

```ts
import type { TapOptions } from 'fngr/tap';
```

```ts
interface TapOptions {
  threshold?: number;
  interval?: number;
  onTap?: (e: TapEvent) => void;
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `10` | Maximum pointer movement in pixels between `pointerdown` and `pointerup` for a tap to be recognized. |
| `interval` | `number` | `250` | Maximum time in milliseconds between `pointerdown` and `pointerup`. |
| `onTap` | `(e: TapEvent) => void` | — | Callback invoked when a tap is recognized. |

## See Also

- [State Machine Guide](/guides/state-machine) — `RecognizerState` transitions in depth
- [PointerTracker](/api/pointer-tracker) — uses `PointerInfo` and `Point`
- [BaseRecognizer](/api/base-recognizer) — accepts and emits `GestureEvent`
