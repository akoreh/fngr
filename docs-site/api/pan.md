# PanRecognizer

Recognizes a single-finger drag gesture. The pointer must move beyond the configured threshold to start. Fires `panstart` when recognition begins, `panmove` on each subsequent move, `panend` on pointer-up, and `pancancel` if the pointer is cancelled mid-gesture.

## Try It

<PanDemo />

## Import

**Convenience API** (recommended for most use cases):

```ts
import { pan } from 'fngr/pan';
```

**Class API** (for advanced composition with a Manager):

```ts
import { PanRecognizer } from 'fngr/pan';
import { Manager } from 'fngr';
```

::: tip
`PanRecognizer` is exported from `fngr/pan`, not the main `fngr` barrel. `Manager` comes from `fngr`.
:::

## Convenience API

The `pan()` function attaches a pan recognizer to an element and returns a cleanup function.

### Callback form

```ts
import { pan } from 'fngr/pan';

const el = document.getElementById('target')!;

const cleanup = pan(el, (e) => {
  console.log('pan started at', e.deltaX, e.deltaY);
});

// Remove the recognizer when no longer needed
cleanup();
```

### Options object form

```ts
import { pan } from 'fngr/pan';

const el = document.getElementById('target')!;

const cleanup = pan(el, {
  threshold: 15,
  direction: 'horizontal',
  onPanstart(e) {
    console.log('start', e.direction);
  },
  onPanmove(e) {
    console.log('move', e.deltaX, e.deltaY);
  },
  onPanend(e) {
    console.log('end', e.deltaX, e.deltaY);
  },
});

cleanup();
```

## Class API

Use `PanRecognizer` directly when composing multiple recognizers under a shared `Manager`.

```ts
import { Manager } from 'fngr';
import { PanRecognizer } from 'fngr/pan';

const el = document.getElementById('target')!;
const manager = new Manager(el);

const recognizer = new PanRecognizer({
  threshold: 20,
  direction: 'all',
  onPanstart(e) {
    console.log('panstart', e.direction);
  },
  onPanmove(e) {
    console.log('panmove', e.deltaX, e.deltaY);
  },
  onPanend(e) {
    console.log('panend', e.deltaX, e.deltaY);
  },
  onPancancel(e) {
    console.log('pancancel');
  },
});

manager.add(recognizer);

// Tear down
manager.remove(recognizer);
recognizer.destroy();
```

## Options

| Option        | Type                    | Default | Description                                                            |
| ------------- | ----------------------- | ------- | ---------------------------------------------------------------------- |
| `threshold`   | `number`                | `10`    | Minimum distance in pixels before the pan starts.                      |
| `direction`   | `DirectionFilter`       | `'all'` | Restrict recognized directions: `'all'`, `'horizontal'`, `'vertical'`. |
| `pointers`    | `number`                | `1`     | Number of pointers required.                                           |
| `onPanstart`  | `(e: PanEvent) => void` | —       | Callback invoked when the pan begins.                                  |
| `onPanmove`   | `(e: PanEvent) => void` | —       | Callback invoked on each move during the pan.                          |
| `onPanend`    | `(e: PanEvent) => void` | —       | Callback invoked when the pointer lifts.                               |
| `onPancancel` | `(e: PanEvent) => void` | —       | Callback invoked when the pointer is cancelled.                        |

## PanEvent

The event object passed to all pan callbacks.

| Property         | Type                                                 | Description                                                    |
| ---------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `type`           | `'panstart' \| 'panmove' \| 'panend' \| 'pancancel'` | Phase of the pan lifecycle.                                    |
| `deltaX`         | `number`                                             | Horizontal displacement from the pointer-down position, in px. |
| `deltaY`         | `number`                                             | Vertical displacement from the pointer-down position, in px.   |
| `velocityX`      | `number`                                             | Horizontal velocity in px/ms.                                  |
| `velocityY`      | `number`                                             | Vertical velocity in px/ms.                                    |
| `direction`      | `Direction`                                          | Cardinal direction of the current displacement.                |
| `isFirst`        | `boolean`                                            | `true` only on `panstart`.                                     |
| `isFinal`        | `boolean`                                            | `true` only on `panend` or `pancancel`.                        |
| `target`         | `Element`                                            | The element the gesture was initiated on.                      |
| `pointers`       | `PointerInfo[]`                                      | Array with one pointer snapshot at the time of the event.      |
| `timestamp`      | `number`                                             | Timestamp when the event fires.                                |
| `srcEvent`       | `PointerEvent`                                       | The raw `PointerEvent` that triggered the event.               |
| `preventDefault` | `() => void`                                         | Calls `preventDefault()` on the underlying source event.       |

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
el.addEventListener('fngr:panstart', (e) => {
  const detail = (e as CustomEvent<PanEvent>).detail;
  console.log('pan started', detail.deltaX, detail.deltaY);
});

el.addEventListener('fngr:panmove', (e) => {
  const detail = (e as CustomEvent<PanEvent>).detail;
  console.log('panning', detail.deltaX, detail.deltaY);
});

el.addEventListener('fngr:panend', (e) => {
  const detail = (e as CustomEvent<PanEvent>).detail;
  console.log('pan ended', detail.deltaX, detail.deltaY);
});

el.addEventListener('fngr:pancancel', (e) => {
  const detail = (e as CustomEvent<PanEvent>).detail;
  console.log('pan cancelled');
});
```

## Direction Detection

Direction is computed from the displacement between pointer-down and the current position:

1. If `dx === 0 && dy === 0` → `'none'`
2. If `|dx| > |dy|` → horizontal: `dx > 0` is `'right'`, otherwise `'left'`
3. If `|dy| >= |dx|` → vertical: `dy > 0` is `'down'`, otherwise `'up'`

The `direction` option filters which initial directions are accepted:

| Filter         | Accepts               |
| -------------- | --------------------- |
| `'all'`        | left, right, up, down |
| `'horizontal'` | left, right           |
| `'vertical'`   | up, down              |

Direction filtering happens at recognition time (`panstart`). Once a pan is started, all subsequent moves are reported regardless of direction changes.

## State Machine

`PanRecognizer` uses the continuous state machine. Recognition happens on `pointermove` when the threshold is exceeded.

```
         pointerdown
  Idle ─────────────────────► Possible
   ▲                             │
   │  pointercancel or           │ pointermove (distance > threshold
   │  pointerup (early)          │ and direction passes filter)
   │         │                   │
   │         └──────► Failed     ▼
   │                    │     Began ──── panstart
   │                    │        │
   │                    │        │ pointermove
   │                    │        ▼
   │                    │     Changed ── panmove (repeating)
   │                    │        │
   │                    │        ├── pointerup
   │                    │        │   ▼
   │                    │        │  Ended ── panend
   │                    │        │   │
   │                    │        └── pointercancel
   │                    │            ▼
   │                    │         Cancelled ── pancancel
   └────────────────────┴────────────┘
               reset
```

| Transition                | Trigger                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| Idle → Possible           | `pointerdown` received                                              |
| Possible → Began          | `pointermove` with distance > threshold and direction passes filter |
| Possible → Failed         | `pointerup`, `pointercancel`, or direction filter rejects           |
| Began → Changed           | Next `pointermove` after panstart                                   |
| Changed → Changed         | Additional `pointermove` events                                     |
| Began/Changed → Ended     | `pointerup` (emits `panend`)                                        |
| Began/Changed → Cancelled | `pointercancel` (emits `pancancel`)                                 |
| All terminal → Idle       | Automatic reset                                                     |
