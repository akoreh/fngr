# PinchRecognizer

Recognizes a two-finger pinch (zoom) gesture. Two pointers must move closer together or farther apart past the configured threshold. Fires `pinchstart` when recognition begins, `pinchmove` on each subsequent move, `pinchend` on pointer-up, and `pinchcancel` if a pointer is cancelled mid-gesture.

## Try It

<PinchDemo />

## Import

**Convenience API** (recommended for most use cases):

```ts
import { pinch } from 'fngr/pinch';
```

**Class API** (for advanced composition with a Manager):

```ts
import { PinchRecognizer } from 'fngr/pinch';
import { Manager } from 'fngr';
```

::: tip
`PinchRecognizer` is exported from `fngr/pinch`, not the main `fngr` barrel. `Manager` comes from `fngr`.
:::

## Convenience API

The `pinch()` function attaches a pinch recognizer to an element and returns a cleanup function.

### Options object form

```ts
import { pinch } from 'fngr/pinch';

const el = document.getElementById('target')!;

const cleanup = pinch(el, {
  threshold: 0,
  onPinchstart(e) {
    console.log('start', e.scale, e.center);
  },
  onPinchmove(e) {
    console.log('move', e.scale, e.deltaScale);
  },
  onPinchend(e) {
    console.log('end', e.scale);
  },
});

cleanup();
```

## Class API

Use `PinchRecognizer` directly when composing multiple recognizers under a shared `Manager`.

```ts
import { Manager } from 'fngr';
import { PinchRecognizer } from 'fngr/pinch';

const el = document.getElementById('target')!;
const manager = new Manager(el);

const recognizer = new PinchRecognizer({
  threshold: 0,
  onPinchstart(e) {
    console.log('pinchstart', e.scale);
  },
  onPinchmove(e) {
    console.log('pinchmove', e.scale, e.deltaScale);
  },
  onPinchend(e) {
    console.log('pinchend', e.scale);
  },
  onPinchcancel(e) {
    console.log('pinchcancel');
  },
});

manager.add(recognizer);

// Tear down
manager.remove(recognizer);
recognizer.destroy();
```

## Options

| Option          | Type                      | Default | Description                                     |
| --------------- | ------------------------- | ------- | ----------------------------------------------- |
| `threshold`     | `number`                  | `0`     | Minimum scale change to trigger recognition.    |
| `onPinchstart`  | `(e: PinchEvent) => void` | ---     | Callback invoked when the pinch begins.         |
| `onPinchmove`   | `(e: PinchEvent) => void` | ---     | Callback invoked on each move during the pinch. |
| `onPinchend`    | `(e: PinchEvent) => void` | ---     | Callback invoked when a pointer lifts.          |
| `onPinchcancel` | `(e: PinchEvent) => void` | ---     | Callback invoked when a pointer is cancelled.   |

## PinchEvent

The event object passed to all pinch callbacks.

| Property         | Type                                                         | Description                                                         |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `type`           | `'pinchstart' \| 'pinchmove' \| 'pinchend' \| 'pinchcancel'` | Phase of the pinch lifecycle.                                       |
| `scale`          | `number`                                                     | Cumulative scale factor since the gesture started. `1` = no change. |
| `deltaScale`     | `number`                                                     | Change in scale since the previous event.                           |
| `center`         | `Point`                                                      | Midpoint between the two pointers (`{ x, y }`).                     |
| `isFirst`        | `boolean`                                                    | `true` only on `pinchstart`.                                        |
| `isFinal`        | `boolean`                                                    | `true` only on `pinchend` or `pinchcancel`.                         |
| `target`         | `Element`                                                    | The element the gesture was initiated on.                           |
| `pointers`       | `PointerInfo[]`                                              | Array with two pointer snapshots at the time of the event.          |
| `timestamp`      | `number`                                                     | Timestamp when the event fires.                                     |
| `srcEvent`       | `PointerEvent`                                               | The raw `PointerEvent` that triggered the event.                    |
| `preventDefault` | `() => void`                                                 | Calls `preventDefault()` on the underlying source event.            |

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
el.addEventListener('fngr:pinchstart', (e) => {
  const detail = (e as CustomEvent<PinchEvent>).detail;
  console.log('pinch started', detail.scale);
});

el.addEventListener('fngr:pinchmove', (e) => {
  const detail = (e as CustomEvent<PinchEvent>).detail;
  console.log('pinching', detail.scale, detail.deltaScale);
});

el.addEventListener('fngr:pinchend', (e) => {
  const detail = (e as CustomEvent<PinchEvent>).detail;
  console.log('pinch ended', detail.scale);
});

el.addEventListener('fngr:pinchcancel', (e) => {
  const detail = (e as CustomEvent<PinchEvent>).detail;
  console.log('pinch cancelled');
});
```

## Scale Detection

Scale is computed as the ratio of the current distance between the two pointers to the initial distance when both pointers were first down:

```
scale = currentDistance / initialDistance
```

- `scale > 1` means the pointers have spread apart (zoom in).
- `scale < 1` means the pointers have moved closer together (zoom out).
- `scale === 1` means no change.

`deltaScale` is the difference between the current scale and the scale at the previous event, useful for incremental transforms.

The `center` point is the midpoint between the two pointers, reported as `{ x, y }` in client coordinates.

## State Machine

`PinchRecognizer` uses the continuous state machine. Recognition happens on `pointermove` when the scale change exceeds the threshold.

```
         2x pointerdown
  Idle ─────────────────────► Possible
   ▲                             │
   │  pointerup (before          │ pointermove (scale change
   │  threshold met)             │ exceeds threshold)
   │         │                   │
   │         └──────► Failed     ▼
   │                    │     Began ──── pinchstart
   │                    │        │
   │                    │        │ pointermove ── pinchmove
   │                    │        ▼
   │                    │     Changed ── pinchmove (repeating)
   │                    │        │
   │                    │        ├── pointerup
   │                    │        │   ▼
   │                    │        │  Ended ── pinchend
   │                    │        │   │
   │                    │        └── pointercancel
   │                    │            ▼
   │                    │         Cancelled ── pinchcancel
   └────────────────────┴────────────┘
               reset
```

| Transition                | Trigger                                                 |
| ------------------------- | ------------------------------------------------------- |
| Idle → Possible           | Two `pointerdown` events received                       |
| Possible → Began          | `pointermove` with scale change exceeding threshold     |
| Possible → Failed         | `pointerup` before threshold is met                     |
| Began → Changed           | Next `pointermove` after pinchstart (emits `pinchmove`) |
| Changed → Changed         | Additional `pointermove` events                         |
| Began/Changed → Ended     | `pointerup` (emits `pinchend`)                          |
| Began/Changed → Cancelled | `pointercancel` (emits `pinchcancel`)                   |
| All terminal → Idle       | Automatic reset                                         |
