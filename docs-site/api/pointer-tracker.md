# PointerTracker

`PointerTracker` tracks the position history of one or more active pointers and exposes derived geometry (velocity, center, distance, angle). Recognizers that need multi-pointer support or velocity-based thresholds use it internally.

```ts
import { PointerTracker } from 'fngr';
```

## Properties

| Property | Type | Description |
|---|---|---|
| `count` | `number` (read-only) | Number of currently active (tracked) pointers. |
| `pointers` | `PointerInfo[]` (read-only) | Snapshot of the current position of every active pointer. |

## Pointer Management Methods

These methods mirror the `PointerEvent` lifecycle and are called directly from recognizer implementations.

| Method | Signature | Description |
|---|---|---|
| `onPointerDown` | `(e: PointerEvent): void` | Starts tracking a new pointer. Records its initial position as the start position and seeds the position history. |
| `onPointerMove` | `(e: PointerEvent): void` | Updates the current position of an existing pointer and appends to the history. Prunes history entries older than the velocity window (~100 ms). |
| `onPointerUp` | `(e: PointerEvent): void` | Stops tracking the pointer. |
| `onPointerCancel` | `(e: PointerEvent): void` | Stops tracking the pointer (same effect as `onPointerUp`). |
| `reset` | `(): void` | Removes all tracked pointers immediately. |

## Query Methods

### `getStartPosition(pointerId)`

```ts
getStartPosition(pointerId: number): Point | undefined
```

Returns the `{ x, y }` client coordinates where the pointer first made contact, or `undefined` if the pointer is not tracked. Useful for computing total displacement from the gesture origin.

---

### `getVelocity(pointerId)`

```ts
getVelocity(pointerId: number): { x: number; y: number }
```

Returns instantaneous velocity in **px/ms** for the given pointer, computed over a rolling ~100 ms window. Returns `{ x: 0, y: 0 }` if the pointer is not tracked or has fewer than two history entries.

---

### `getCenter()`

```ts
getCenter(): Point
```

Returns the centroid of all currently active pointers as `{ x, y }` in client coordinates. Returns `{ x: 0, y: 0 }` when no pointers are tracked. Useful for pinch and rotate recognizers.

---

### `getDistance()`

```ts
getDistance(): number
```

Returns the Euclidean distance in pixels between the first two tracked pointers. Returns `0` if fewer than two pointers are active. Primarily used by pinch recognizers to measure spread.

---

### `getAngle()`

```ts
getAngle(): number
```

Returns the angle in degrees (−180 to 180) between the first two tracked pointers, measured with `Math.atan2`. Returns `0` if fewer than two pointers are active. Used by rotation recognizers.

## Example

```ts
import { PointerTracker } from 'fngr';

const tracker = new PointerTracker();

element.addEventListener('pointerdown',   (e) => tracker.onPointerDown(e));
element.addEventListener('pointermove',   (e) => tracker.onPointerMove(e));
element.addEventListener('pointerup',     (e) => tracker.onPointerUp(e));
element.addEventListener('pointercancel', (e) => tracker.onPointerCancel(e));

element.addEventListener('pointermove', () => {
  if (tracker.count === 2) {
    console.log('distance:', tracker.getDistance());
    console.log('angle:',    tracker.getAngle());
    console.log('center:',   tracker.getCenter());
  }
});
```

## See Also

- [Types](/api/types) — `PointerInfo`, `Point`
- [BaseRecognizer](/api/base-recognizer) — abstract recognizer that typically owns a PointerTracker instance
