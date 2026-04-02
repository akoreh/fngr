# LongPressRecognizer

Recognizes a single-finger press-and-hold gesture. The pointer must stay within the movement threshold for the configured duration. Fires `longpress` when the hold duration is reached, and `longpressup` when the pointer lifts afterward.

## Import

**Convenience API** (recommended for most use cases):

```ts
import { longPress } from 'fngr/longpress';
```

**Class API** (for advanced composition with a Manager):

```ts
import { LongPressRecognizer } from 'fngr/longpress';
import { Manager } from 'fngr';
```

::: tip
`LongPressRecognizer` is exported from `fngr/longpress`, not the main `fngr` barrel. `Manager` comes from `fngr`.
:::

## Convenience API

The `longPress()` function attaches a long-press recognizer to an element and returns a cleanup function.

### Callback form

```ts
import { longPress } from 'fngr/longpress';

const el = document.getElementById('target')!;

const cleanup = longPress(el, (e) => {
  console.log('long-pressed for', e.duration, 'ms');
});

// Remove the recognizer when no longer needed
cleanup();
```

### Options object form

```ts
import { longPress } from 'fngr/longpress';

const el = document.getElementById('target')!;

const cleanup = longPress(el, {
  threshold: 15,
  duration: 800,
  onLongpress(e) {
    console.log('long-press at', e.pointers[0].clientX, e.pointers[0].clientY);
  },
  onLongpressup(e) {
    console.log('released after', e.duration, 'ms');
  },
});

cleanup();
```

## Class API

Use `LongPressRecognizer` directly when composing multiple recognizers under a shared `Manager`.

```ts
import { Manager } from 'fngr';
import { LongPressRecognizer } from 'fngr/longpress';

const el = document.getElementById('target')!;
const manager = new Manager(el);

const recognizer = new LongPressRecognizer({
  threshold: 10,
  duration: 500,
  onLongpress(e) {
    console.log('longpress', e.duration);
  },
  onLongpressup(e) {
    console.log('longpressup', e.duration);
  },
});

manager.add(recognizer);

// Tear down
manager.remove(recognizer);
recognizer.destroy();
```

## Options

| Option          | Type                          | Default | Description                                                             |
| --------------- | ----------------------------- | ------- | ----------------------------------------------------------------------- |
| `threshold`     | `number`                      | `10`    | Maximum distance in pixels the pointer may move during the hold.        |
| `duration`      | `number`                      | `500`   | Time in milliseconds the pointer must be held before recognition fires. |
| `onLongpress`   | `(e: LongPressEvent) => void` | —       | Callback invoked when the hold duration is reached.                     |
| `onLongpressup` | `(e: LongPressEvent) => void` | —       | Callback invoked when the pointer lifts after a recognized long press.  |

## LongPressEvent

The event object passed to both `onLongpress` and `onLongpressup` callbacks.

| Property         | Type                           | Description                                                                   |
| ---------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| `type`           | `'longpress' \| 'longpressup'` | `'longpress'` for the hold event, `'longpressup'` for the release event.      |
| `duration`       | `number`                       | Elapsed time in milliseconds from pointer-down to the moment the event fires. |
| `target`         | `Element`                      | The element the gesture was initiated on.                                     |
| `pointers`       | `PointerInfo[]`                | Array with one pointer snapshot at the time the event fires.                  |
| `timestamp`      | `number`                       | Timestamp at the moment the event fires.                                      |
| `srcEvent`       | `PointerEvent`                 | The raw DOM `PointerEvent` (the latest one at the time of the event).         |
| `preventDefault` | `() => void`                   | Calls `preventDefault()` on the underlying source event.                      |

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

In addition to the callbacks, `fngr` dispatches DOM `CustomEvent`s on the target element.

```ts
el.addEventListener('fngr:longpress', (e) => {
  const detail = (e as CustomEvent<LongPressEvent>).detail;
  console.log('held for', detail.duration, 'ms');
});

el.addEventListener('fngr:longpressup', (e) => {
  const detail = (e as CustomEvent<LongPressEvent>).detail;
  console.log('released after', detail.duration, 'ms');
});
```

## State Machine

`LongPressRecognizer` uses the standard `fngr` discrete state machine, but recognition happens on a timer (while the pointer is still down) rather than on pointer-up.

```
         pointerdown
  Idle ─────────────────────► Possible
   ▲                             │
   │  movement exceeds           │ duration timer fires
   │  threshold, cancel,         │
   │  or early pointerup         │
   │         │                   ▼
   │         └──────► Failed  Recognized
   │                    │        │
   │                    │        │ pointerup → emit longpressup
   └────────────────────┘        │
          reset                  │
   ◄─────────────────────────────┘
                  reset
```

| Transition            | Trigger                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Idle → Possible       | `pointerdown` received — start the duration timer                                            |
| Possible → Recognized | Duration timer fires while pointer is still within threshold                                 |
| Possible → Failed     | `pointerup` before timer, movement exceeds `threshold`, `pointercancel`                      |
| Recognized → Idle     | `pointerup` after recognition (emits `longpressup` first), or `pointercancel` (silent reset) |
| Failed → Idle         | Automatic reset after failure                                                                |
