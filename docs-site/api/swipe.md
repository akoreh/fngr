# SwipeRecognizer

Recognizes a single-finger directional flick gesture. The pointer must travel at least the configured distance at or above the configured velocity. Direction is determined by the dominant axis of movement.

## Try It

<SwipeDemo />

## Import

**Convenience API** (recommended for most use cases):

```ts
import { swipe } from 'fngr/swipe';
```

**Class API** (for advanced composition with a Manager):

```ts
import { SwipeRecognizer } from 'fngr/swipe';
import { Manager } from 'fngr';
```

::: tip
`SwipeRecognizer` is exported from `fngr/swipe`, not the main `fngr` barrel. `Manager` comes from `fngr`.
:::

## Convenience API

The `swipe()` function attaches a swipe recognizer to an element and returns a cleanup function.

### Callback form

```ts
import { swipe } from 'fngr/swipe';

const el = document.getElementById('target')!;

const cleanup = swipe(el, (e) => {
  console.log('swiped', e.direction, 'at', e.velocity.toFixed(2), 'px/ms');
});

// Remove the recognizer when no longer needed
cleanup();
```

### Options object form

```ts
import { swipe } from 'fngr/swipe';

const el = document.getElementById('target')!;

const cleanup = swipe(el, {
  threshold: 50,
  velocity: 0.5,
  direction: 'horizontal',
  onSwipe(e) {
    console.log(e.direction, e.distance, 'px');
  },
});

cleanup();
```

## Class API

Use `SwipeRecognizer` directly when composing multiple recognizers under a shared `Manager`.

```ts
import { Manager } from 'fngr';
import { SwipeRecognizer } from 'fngr/swipe';

const el = document.getElementById('target')!;
const manager = new Manager(el);

const recognizer = new SwipeRecognizer({
  threshold: 30,
  velocity: 0.3,
  direction: 'all',
  onSwipe(e) {
    console.log('swipe', e.direction, e.distance);
  },
});

manager.add(recognizer);

// Tear down
manager.remove(recognizer);
recognizer.destroy();
```

## Options

| Option      | Type                      | Default | Description                                                               |
| ----------- | ------------------------- | ------- | ------------------------------------------------------------------------- |
| `threshold` | `number`                  | `30`    | Minimum distance in pixels for a swipe to be recognized.                  |
| `velocity`  | `number`                  | `0.3`   | Minimum velocity in px/ms for a swipe to be recognized.                   |
| `direction` | `DirectionFilter`         | `'all'` | Restrict recognized directions: `'all'`, `'horizontal'`, or `'vertical'`. |
| `onSwipe`   | `(e: SwipeEvent) => void` | —       | Callback invoked when a swipe is recognized.                              |

## SwipeEvent

The event object passed to the `onSwipe` callback.

| Property         | Type                                  | Description                                                    |
| ---------------- | ------------------------------------- | -------------------------------------------------------------- |
| `type`           | `'swipe'`                             | Always `'swipe'`.                                              |
| `direction`      | `'left' \| 'right' \| 'up' \| 'down'` | Cardinal direction determined by the dominant movement axis.   |
| `distance`       | `number`                              | Straight-line distance from pointer-down to pointer-up, in px. |
| `velocity`       | `number`                              | Speed of the swipe in px/ms.                                   |
| `target`         | `Element`                             | The element the gesture was initiated on.                      |
| `pointers`       | `PointerInfo[]`                       | Array with one pointer snapshot at the time of recognition.    |
| `timestamp`      | `number`                              | Timestamp when the swipe was recognized.                       |
| `srcEvent`       | `PointerEvent`                        | The raw `pointerup` event that completed the swipe.            |
| `preventDefault` | `() => void`                          | Calls `preventDefault()` on the underlying source event.       |

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
el.addEventListener('fngr:swipe', (e) => {
  const detail = (e as CustomEvent<SwipeEvent>).detail;
  console.log('swiped', detail.direction, detail.distance, 'px');
});
```

## Direction Detection

Direction is computed from the displacement between pointer-down and pointer-up:

1. If `|dx| > |dy|` → horizontal: `dx > 0` is `'right'`, otherwise `'left'`
2. If `|dy| >= |dx|` → vertical: `dy > 0` is `'down'`, otherwise `'up'`

The `direction` option filters which directions are accepted:

| Filter         | Accepts               |
| -------------- | --------------------- |
| `'all'`        | left, right, up, down |
| `'horizontal'` | left, right           |
| `'vertical'`   | up, down              |

## State Machine

`SwipeRecognizer` follows the standard `fngr` discrete state machine. Recognition happens on `pointerup`.

```
         pointerdown
  Idle ─────────────────────► Possible
   ▲                             │
   │  pointercancel              │ pointerup
   │         │                   │
   │         └──────► Failed     ├── distance < threshold → Failed
   │                    │        ├── velocity < minimum   → Failed
   │                    │        ├── direction filtered    → Failed
   │                    │        │
   │                    │        └── all checks pass
   └────────────────────┘             ▼
          reset               Recognized
   ◄─────────────────────────────────┘
                  reset
```
