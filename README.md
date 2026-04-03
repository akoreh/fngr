<p align="center">
  <img src="assets/logo.png" alt="fngr" width="200">
</p>

<p align="center">
  <a href="https://github.com/akoreh/fngr/actions"><img src="https://github.com/akoreh/fngr/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/fngr"><img src="https://img.shields.io/npm/v/fngr" alt="npm"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/fngr" alt="license"></a>
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies">
</p>

Modern gesture recognition for the web. A HammerJS replacement built on the PointerEvent API.

- **PointerEvent-based** — unified mouse, touch, and pen input; no legacy fallbacks
- **TypeScript-first** — fully typed API and gesture events
- **Tree-shakeable** — each gesture is an independent entry point (~1-2 kB brotli)
- **Zero dependencies**
- **Framework-agnostic** — works with React, Vue, Svelte, Angular, or vanilla JS
- **SSR-safe** — no top-level DOM access, safe to import in Node

## Install

```
npm install fngr
```

## Quick Start

Each gesture has a convenience function that returns a cleanup function:

```ts
import { tap } from 'fngr/tap';

const cleanup = tap(element, (e) => {
  console.log('tapped!', e.pointers[0].clientX);
});

// later
cleanup();
```

Use the options form for more control:

```ts
import { pan } from 'fngr/pan';

const cleanup = pan(element, {
  threshold: 10,
  direction: 'horizontal',
  onPanstart(e) {
    console.log('start', e.deltaX);
  },
  onPanmove(e) {
    console.log('move', e.deltaX, e.deltaY);
  },
  onPanend(e) {
    console.log('end', e.deltaX);
  },
});
```

## Gestures

| Gesture    | Import           | Convenience   | Events                                                   |
| ---------- | ---------------- | ------------- | -------------------------------------------------------- |
| Tap        | `fngr/tap`       | `tap()`       | `tap`                                                    |
| Double Tap | `fngr/doubletap` | `doubleTap()` | `doubletap`                                              |
| Long Press | `fngr/longpress` | `longPress()` | `longpress`, `longpressup`                               |
| Swipe      | `fngr/swipe`     | `swipe()`     | `swipe`                                                  |
| Pan        | `fngr/pan`       | `pan()`       | `panstart`, `panmove`, `panend`, `pancancel`             |
| Pinch      | `fngr/pinch`     | `pinch()`     | `pinchstart`, `pinchmove`, `pinchend`, `pinchcancel`     |
| Rotate     | `fngr/rotate`    | `rotate()`    | `rotatestart`, `rotatemove`, `rotateend`, `rotatecancel` |

### Tap

```ts
tap(el, {
  threshold: 10, // max movement in px (default 10)
  interval: 250, // max duration in ms (default 250)
  onTap(e) {
    /* TapEvent */
  },
});
```

### Double Tap

```ts
doubleTap(el, {
  threshold: 10, // max distance between taps in px (default 10)
  interval: 300, // max time between taps in ms (default 300)
  onDoubletap(e) {
    /* DoubleTapEvent */
  },
});
```

### Long Press

```ts
longPress(el, {
  threshold: 10, // max movement in px (default 10)
  duration: 500, // hold time in ms (default 500)
  onLongpress(e) {
    console.log(e.duration);
  },
  onLongpressup(e) {
    console.log('released');
  },
});
```

### Swipe

```ts
swipe(el, {
  threshold: 30, // min distance in px (default 30)
  velocity: 0.3, // min speed in px/ms (default 0.3)
  direction: 'horizontal', // 'all' | 'horizontal' | 'vertical' (default 'all')
  onSwipe(e) {
    console.log(e.direction, e.velocity);
  },
});
```

### Pan

```ts
pan(el, {
  threshold: 10,
  direction: 'all', // 'all' | 'horizontal' | 'vertical'
  onPanstart(e) {
    /* deltaX, deltaY, velocityX, velocityY, direction */
  },
  onPanmove(e) {},
  onPanend(e) {},
  onPancancel(e) {},
});
```

### Pinch

```ts
pinch(el, {
  threshold: 0, // min scale change (default 0)
  onPinchstart(e) {
    /* scale, deltaScale, center */
  },
  onPinchmove(e) {},
  onPinchend(e) {},
  onPinchcancel(e) {},
});
```

`scale > 1` = zoom in, `scale < 1` = zoom out. `center` is the midpoint between the two pointers.

### Rotate

```ts
rotate(el, {
  threshold: 0, // min rotation in degrees (default 0)
  onRotatestart(e) {
    /* rotation, deltaRotation, center */
  },
  onRotatemove(e) {},
  onRotateend(e) {},
  onRotatecancel(e) {},
});
```

`rotation` is cumulative degrees since gesture start. Positive = clockwise. `center` is the midpoint between the two pointers.

## Manager API

Compose multiple recognizers on one element with arbitration:

```ts
import { Manager } from 'fngr';
import { TapRecognizer } from 'fngr/tap';
import { DoubleTapRecognizer } from 'fngr/doubletap';

const manager = new Manager(el);

const dtap = manager.add(
  new DoubleTapRecognizer({
    onDoubletap(e) {
      console.log('double-tap');
    },
  }),
  { priority: 10 },
);

const tap = manager.add(
  new TapRecognizer({
    onTap(e) {
      console.log('tap');
    },
  }),
);

// Tap waits for double-tap to fail before firing
tap.requireFailureOf(dtap);

manager.destroy(); // cleanup
```

### Manager Methods

| Method                           | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| `new Manager(element)`           | Attach pointer listeners, set `touch-action: none`                |
| `add(recognizer, { priority? })` | Register a recognizer (higher priority = events first)            |
| `remove(recognizer)`             | Unregister a recognizer                                           |
| `destroy()`                      | Remove all listeners, destroy recognizers, restore `touch-action` |

### Arbitration

| Method                                | Description                                |
| ------------------------------------- | ------------------------------------------ |
| `recognizer.requireFailureOf(other)`  | Defer recognition until `other` fails      |
| `recognizer.allowSimultaneous(other)` | Let both recognizers fire at the same time |

## DOM Events

Every gesture also dispatches a `CustomEvent` on the target element, so you can use standard `addEventListener`:

```ts
el.addEventListener('fngr:tap', (e) => {
  const detail = (e as CustomEvent).detail; // TapEvent
});

el.addEventListener('fngr:panmove', (e) => {
  const { deltaX, deltaY } = (e as CustomEvent).detail;
});
```

All events bubble and are cancelable. Event names are prefixed with `fngr:`.

## State Machine

Each recognizer follows a state machine:

- **Discrete** (tap, doubletap, swipe): `Idle -> Possible -> Recognized | Failed`
- **Continuous** (pan, pinch, rotate): `Idle -> Possible -> Began -> Changed -> Ended | Cancelled`
- **Long press** is a hybrid: `Idle -> Possible -> Recognized` (on hold timeout), then waits for pointer lift to emit `longpressup` before resetting.

After terminal states (`Recognized`, `Failed`, `Ended`, `Cancelled`), recognizers auto-reset to `Idle`.

## Custom Recognizers

Extend `BaseRecognizer` to create custom gestures:

```ts
import { BaseRecognizer } from 'fngr/base';

class MyGesture extends BaseRecognizer<MyEvent> {
  onPointerDown(e: PointerEvent) {
    /* ... */
  }
  onPointerMove(e: PointerEvent) {
    /* ... */
  }
  onPointerUp(e: PointerEvent) {
    /* ... */
  }
  onPointerCancel(e: PointerEvent) {
    /* ... */
  }
}
```

## Bundle Size

| Entry                | Size (brotli)            |
| -------------------- | ------------------------ |
| Single gesture       | ~1.1-1.3 kB              |
| Full barrel (`fngr`) | ~700 B (re-exports only) |

## License

MIT
