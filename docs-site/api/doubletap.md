# DoubleTapRecognizer

Recognizes two consecutive single-finger taps within a configurable time interval. Both taps must land within the movement threshold of each other.

## Import

**Convenience API** (recommended for most use cases):

```ts
import { doubleTap } from 'fngr/doubletap';
```

**Class API** (for advanced composition with a Manager):

```ts
import { DoubleTapRecognizer } from 'fngr/doubletap';
import { Manager } from 'fngr';
```

::: tip
`DoubleTapRecognizer` is exported from `fngr/doubletap`, not the main `fngr` barrel. `Manager` comes from `fngr`.
:::

## Convenience API

The `doubleTap()` function attaches a double-tap recognizer to an element and returns a cleanup function.

### Callback form

```ts
import { doubleTap } from 'fngr/doubletap';

const el = document.getElementById('target')!;

const cleanup = doubleTap(el, (e) => {
  console.log('double-tapped at', e.pointers[0].clientX, e.pointers[0].clientY);
});

// Remove the recognizer when no longer needed
cleanup();
```

### Options object form

```ts
import { doubleTap } from 'fngr/doubletap';

const el = document.getElementById('target')!;

const cleanup = doubleTap(el, {
  threshold: 15,
  interval: 400,
  onDoubletap(e) {
    console.log('double-tap count:', e.count);
  },
});

cleanup();
```

## Class API

Use `DoubleTapRecognizer` directly when composing multiple recognizers under a shared `Manager`.

```ts
import { Manager } from 'fngr';
import { DoubleTapRecognizer } from 'fngr/doubletap';

const el = document.getElementById('target')!;
const manager = new Manager(el);

const recognizer = new DoubleTapRecognizer({
  threshold: 10,
  interval: 300,
  onDoubletap(e) {
    console.log('doubletap', e);
  },
});

manager.add(recognizer);

// Tear down
manager.remove(recognizer);
recognizer.destroy();
```

## Tap + DoubleTap Arbitration

When you need both tap and double-tap on the same element, use `requireFailureOf` to prevent the tap from firing before the double-tap has had a chance to complete:

```ts
import { Manager } from 'fngr';
import { TapRecognizer } from 'fngr/tap';
import { DoubleTapRecognizer } from 'fngr/doubletap';

const el = document.getElementById('target')!;
const manager = new Manager(el);

const doubleTap = new DoubleTapRecognizer({
  interval: 300,
  onDoubletap(e) {
    console.log('double-tap!');
  },
});

const tap = new TapRecognizer({
  onTap(e) {
    console.log('single tap!');
  },
});

// Tap waits for double-tap to fail first
tap.requireFailureOf(doubleTap);

// Higher priority ensures double-tap gets pointer events first
manager.add(doubleTap, { priority: 10 });
manager.add(tap);
```

With this setup:

- **Single tap:** The tap fires after the double-tap interval expires (300ms delay).
- **Double-tap:** The double-tap fires immediately on the second tap. The single tap does not fire.

## Options

| Option        | Type                          | Default | Description                                                                                    |
| ------------- | ----------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `threshold`   | `number`                      | `10`    | Maximum distance in pixels between the two taps, and maximum pointer movement within each tap. |
| `interval`    | `number`                      | `300`   | Maximum time in milliseconds between the first tap and the second tap.                         |
| `onDoubletap` | `(e: DoubleTapEvent) => void` | —       | Callback invoked when a double-tap is recognized.                                              |

## DoubleTapEvent

The event object passed to the `onDoubletap` callback.

| Property         | Type            | Description                                                                           |
| ---------------- | --------------- | ------------------------------------------------------------------------------------- |
| `type`           | `'doubletap'`   | Always `'doubletap'`.                                                                 |
| `count`          | `2`             | Always `2`.                                                                           |
| `target`         | `Element`       | The element the gesture was initiated on.                                             |
| `pointers`       | `PointerInfo[]` | Array of pointer snapshots from the second tap at the time of recognition.            |
| `timestamp`      | `number`        | The `PointerEvent.timeStamp` value from the triggering event.                         |
| `srcEvent`       | `PointerEvent`  | The raw DOM `PointerEvent` that triggered recognition (the second tap's `pointerup`). |
| `preventDefault` | `() => void`    | Calls `preventDefault()` on the underlying source event.                              |

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

In addition to the `onDoubletap` callback, `fngr` dispatches a DOM `CustomEvent` on the target element so you can listen with standard event listeners.

```ts
el.addEventListener('fngr:doubletap', (e) => {
  const detail = (e as CustomEvent<DoubleTapEvent>).detail;
  console.log('doubletap at', detail.pointers[0].clientX, detail.pointers[0].clientY);
});
```

## State Machine

`DoubleTapRecognizer` follows a variation of the standard `fngr` discrete state machine. It stays in `Possible` between the two taps:

```
         pointerdown (1st)
  Idle ─────────────────────► Possible
   ▲                             │
   │  movement exceeds           │ pointerup (1st, valid)
   │  threshold, cancel,         │ → stays Possible, starts timeout
   │  or timeout                 │
   │         │                   │ pointerdown (2nd)
   │         └──────► Failed     │ → stays Possible
   │                    │        │
   │                    │        │ pointerup (2nd, within
   │                    │        │ threshold + interval)
   │                    │        ▼
   └────────────────────┘   Recognized
         reset                   │
   ◄─────────────────────────────┘
                  reset
```

| Transition            | Trigger                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Idle → Possible       | First `pointerdown` received                                                                |
| Possible → Possible   | First `pointerup` valid (waiting for second tap), or second `pointerdown`                   |
| Possible → Failed     | Movement exceeds `threshold`, `pointercancel`, or timeout (no second tap within `interval`) |
| Possible → Recognized | Second `pointerup` within `threshold` and `interval`                                        |
| Recognized → Idle     | Automatic reset after emitting the event                                                    |
| Failed → Idle         | Automatic reset after failure                                                               |
