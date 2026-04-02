# TapRecognizer

Recognizes a single finger tap gesture. The pointer must lift within the configured time interval and without exceeding the movement threshold.

## Try It

<TapDemo />

## Import

**Convenience API** (recommended for most use cases):

```ts
import { tap } from 'fngr/tap';
```

**Class API** (for advanced composition with a Manager):

```ts
import { TapRecognizer } from 'fngr/tap';
import { Manager } from 'fngr';
```

::: tip
`TapRecognizer` is exported from `fngr/tap`, not the main `fngr` barrel. `Manager` comes from `fngr`.
:::

## Convenience API

The `tap()` function attaches a tap recognizer to an element and returns a cleanup function.

### Callback form

```ts
import { tap } from 'fngr/tap';

const el = document.getElementById('target')!;

const cleanup = tap(el, (e) => {
  console.log('tapped at', e.pointers[0].clientX, e.pointers[0].clientY);
});

// Remove the recognizer when no longer needed
cleanup();
```

### Options object form

```ts
import { tap } from 'fngr/tap';

const el = document.getElementById('target')!;

const cleanup = tap(el, {
  threshold: 15,
  interval: 300,
  onTap(e) {
    console.log('tap count:', e.count);
  },
});

cleanup();
```

## Class API

Use `TapRecognizer` directly when composing multiple recognizers under a shared `Manager`.

```ts
import { Manager } from 'fngr';
import { TapRecognizer } from 'fngr/tap';

const el = document.getElementById('target')!;
const manager = new Manager(el);

const recognizer = new TapRecognizer({
  threshold: 10,
  interval: 250,
  onTap(e) {
    console.log('tap', e);
  },
});

manager.add(recognizer);

// Tear down
manager.remove(recognizer);
recognizer.destroy();
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `10` | Maximum pointer movement in pixels before the gesture is failed. |
| `interval` | `number` | `250` | Maximum duration in milliseconds from pointer down to pointer up for a valid tap. |
| `onTap` | `(e: TapEvent) => void` | — | Callback invoked when a tap is recognized. |

## TapEvent

The event object passed to the `onTap` callback.

| Property | Type | Description |
|---|---|---|
| `type` | `'tap'` | Always `'tap'`. |
| `count` | `1` | Tap count (always `1` for single tap; `2` for DoubleTapEvent). |
| `target` | `Element` | The element the gesture was initiated on. |
| `pointers` | `PointerInfo[]` | Array of pointer snapshots at the time of recognition. |
| `timestamp` | `number` | The `PointerEvent.timeStamp` value from the triggering event. |
| `srcEvent` | `PointerEvent` | The raw DOM `PointerEvent` that triggered recognition. |
| `preventDefault` | `() => void` | Calls `preventDefault()` on the underlying source event. |

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

In addition to the `onTap` callback, `fngr` dispatches a DOM `CustomEvent` on the target element so you can listen with standard event listeners.

```ts
el.addEventListener('fngr:tap', (e) => {
  const detail = (e as CustomEvent<TapEvent>).detail;
  console.log('tap at', detail.pointers[0].clientX, detail.pointers[0].clientY);
});
```

## State Machine

`TapRecognizer` follows the standard `fngr` state machine:

```
         pointerdown
  Idle ─────────────► Possible
   ▲                     │
   │      movement       │ pointerup within interval
   │   exceeds threshold │ and within threshold
   │         │           ▼
   │         └──────► Failed          Recognized
   │                    │                  │
   └────────────────────┘                  │
         reset                             │
   ◄──────────────────────────────────────┘
                    reset
```

| Transition | Trigger |
|---|---|
| Idle → Possible | `pointerdown` received |
| Possible → Failed | Pointer moved beyond `threshold`, or pointer cancel |
| Possible → Recognized | `pointerup` within `threshold` and `interval` |
| Recognized → Idle | Automatic reset after emitting the event |
| Failed → Idle | Automatic reset after failure |
