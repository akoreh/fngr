# RotateRecognizer

Recognizes a two-finger rotation gesture. Two pointers must rotate around their midpoint past the configured threshold. Fires `rotatestart` when recognition begins, `rotatemove` on each subsequent move, `rotateend` on pointer-up, and `rotatecancel` if a pointer is cancelled mid-gesture.

## Try It

<RotateDemo />

## Import

**Convenience API** (recommended for most use cases):

```ts
import { rotate } from 'fngr/rotate';
```

**Class API** (for advanced composition with a Manager):

```ts
import { RotateRecognizer } from 'fngr/rotate';
import { Manager } from 'fngr';
```

::: tip
`RotateRecognizer` is exported from `fngr/rotate`, not the main `fngr` barrel. `Manager` comes from `fngr`.
:::

## Convenience API

The `rotate()` function attaches a rotate recognizer to an element and returns a cleanup function.

### Callback form

```ts
import { rotate } from 'fngr/rotate';

const el = document.getElementById('target')!;

const cleanup = rotate(el, (e) => {
  console.log('rotation started at', e.rotation, 'degrees');
});

// Remove the recognizer when no longer needed
cleanup();
```

### Options object form

```ts
import { rotate } from 'fngr/rotate';

const el = document.getElementById('target')!;

const cleanup = rotate(el, {
  threshold: 0,
  onRotatestart(e) {
    console.log('start', e.rotation, e.center);
  },
  onRotatemove(e) {
    console.log('move', e.rotation, e.deltaRotation);
  },
  onRotateend(e) {
    console.log('end', e.rotation);
  },
  onRotatecancel(e) {
    console.log('cancelled', e.rotation);
  },
});

cleanup();
```

## Class API

Use `RotateRecognizer` directly when composing multiple recognizers under a shared `Manager`.

```ts
import { Manager } from 'fngr';
import { RotateRecognizer } from 'fngr/rotate';

const el = document.getElementById('target')!;
const manager = new Manager(el);

const recognizer = new RotateRecognizer({
  threshold: 0,
  onRotatestart(e) {
    console.log('rotatestart', e.rotation);
  },
  onRotatemove(e) {
    console.log('rotatemove', e.rotation, e.deltaRotation);
  },
  onRotateend(e) {
    console.log('rotateend', e.rotation);
  },
  onRotatecancel(e) {
    console.log('rotatecancel');
  },
});

manager.add(recognizer);

// Tear down
manager.remove(recognizer);
recognizer.destroy();
```

## Options

| Option           | Type                       | Default | Description                                         |
| ---------------- | -------------------------- | ------- | --------------------------------------------------- |
| `threshold`      | `number`                   | `0`     | Minimum rotation in degrees to trigger recognition. |
| `onRotatestart`  | `(e: RotateEvent) => void` | ---     | Callback invoked when the rotation begins.          |
| `onRotatemove`   | `(e: RotateEvent) => void` | ---     | Callback invoked on each move during the rotation.  |
| `onRotateend`    | `(e: RotateEvent) => void` | ---     | Callback invoked when a pointer lifts.              |
| `onRotatecancel` | `(e: RotateEvent) => void` | ---     | Callback invoked when a pointer is cancelled.       |

## RotateEvent

The event object passed to all rotate callbacks.

| Property         | Type                                                             | Description                                                                     |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `type`           | `'rotatestart' \| 'rotatemove' \| 'rotateend' \| 'rotatecancel'` | Phase of the rotate lifecycle.                                                  |
| `rotation`       | `number`                                                         | Cumulative rotation in degrees since the gesture started. Positive = clockwise. |
| `deltaRotation`  | `number`                                                         | Change in rotation (degrees) since the previous event.                          |
| `center`         | `Point`                                                          | Midpoint between the two pointers (`{ x, y }`).                                 |
| `isFirst`        | `boolean`                                                        | `true` only on `rotatestart`.                                                   |
| `isFinal`        | `boolean`                                                        | `true` only on `rotateend` or `rotatecancel`.                                   |
| `target`         | `Element`                                                        | The element the gesture was initiated on.                                       |
| `pointers`       | `PointerInfo[]`                                                  | Array with two pointer snapshots at the time of the event.                      |
| `timestamp`      | `number`                                                         | Timestamp when the event fires.                                                 |
| `srcEvent`       | `PointerEvent`                                                   | The raw `PointerEvent` that triggered the event.                                |
| `preventDefault` | `() => void`                                                     | Calls `preventDefault()` on the underlying source event.                        |

Each `PointerInfo` object in `pointers` has the following shape:

```ts
interface PointerInfo {
  id: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
}
```

## CustomEvent

```ts
el.addEventListener('fngr:rotatestart', (e) => {
  const detail = (e as CustomEvent<RotateEvent>).detail;
  console.log('rotate started', detail.rotation);
});

el.addEventListener('fngr:rotatemove', (e) => {
  const detail = (e as CustomEvent<RotateEvent>).detail;
  console.log('rotating', detail.rotation, detail.deltaRotation);
});

el.addEventListener('fngr:rotateend', (e) => {
  const detail = (e as CustomEvent<RotateEvent>).detail;
  console.log('rotate ended', detail.rotation);
});

el.addEventListener('fngr:rotatecancel', (e) => {
  const detail = (e as CustomEvent<RotateEvent>).detail;
  console.log('rotate cancelled');
});
```

## Rotation Detection

Rotation is computed as the angular difference between the current angle formed by the two pointers and the initial angle when both pointers were first down:

```
rotation = normalizeAngle(currentAngle - initialAngle)
```

- Positive values indicate clockwise rotation.
- Negative values indicate counter-clockwise rotation.
- `0` means no rotation.

`deltaRotation` is the difference between the current rotation and the rotation at the previous event, useful for incremental transforms.

The `center` point is the midpoint between the two pointers, reported as `{ x, y }` in client coordinates.

## State Machine

`RotateRecognizer` uses the continuous state machine. Recognition happens on `pointermove` when the rotation change exceeds the threshold.

```
         2x pointerdown
  Idle ─────────────────────► Possible
   ▲                             │
   │  pointerup (before          │ pointermove (rotation change
   │  threshold met)             │ exceeds threshold)
   │         │                   │
   │         └──────► Failed     ▼
   │                    │     Began ──── rotatestart
   │                    │        │
   │                    │        │ pointermove ── rotatemove
   │                    │        ▼
   │                    │     Changed ── rotatemove (repeating)
   │                    │        │
   │                    │        ├── pointerup
   │                    │        │   ▼
   │                    │        │  Ended ── rotateend
   │                    │        │   │
   │                    │        └── pointercancel
   │                    │            ▼
   │                    │         Cancelled ── rotatecancel
   └────────────────────┴────────────┘
               reset
```

| Transition                | Trigger                                                   |
| ------------------------- | --------------------------------------------------------- |
| Idle → Possible           | Two `pointerdown` events received                         |
| Possible → Began          | `pointermove` with rotation change exceeding threshold    |
| Possible → Failed         | `pointerup` before threshold is met                       |
| Began → Changed           | Next `pointermove` after rotatestart (emits `rotatemove`) |
| Changed → Changed         | Additional `pointermove` events                           |
| Began/Changed → Ended     | `pointerup` (emits `rotateend`)                           |
| Began/Changed → Cancelled | `pointercancel` (emits `rotatecancel`)                    |
| All terminal → Idle       | Automatic reset                                           |
