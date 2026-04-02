# Getting Started

## Install

```sh
npm install fngr
```

## Your First Gesture

Bind a tap gesture to any element in three lines:

```ts
import { tap } from 'fngr/tap';

const element = document.getElementById('my-button');

const cleanup = tap(element, (event) => {
  console.log(event.pointers[0].clientX, event.pointers[0].clientY);
});

// Later — unbind the gesture and release all listeners
cleanup();
```

## What Happened

Calling `tap()` creates a `Manager` instance bound to the element and registers a `TapRecognizer` on it. The Manager listens for `pointerdown`, `pointermove`, and `pointerup` events and feeds each one through the recognizer's state machine. When the state machine reaches the `RECOGNIZED` state — meaning the pointer lifted within the movement threshold and time interval — the callback fires and a `fngr:tap` CustomEvent is dispatched on the element.

`cleanup()` removes the recognizer from the Manager. If no recognizers remain, the Manager is destroyed automatically — removing all event listeners and restoring the element's `touch-action`.

## Convenience API vs Manager API

The `tap()` function is the convenience API — zero configuration, ideal for simple cases. When you need to tune recognizer options or attach multiple recognizers to one element, use the Manager API directly.

**Convenience API**

```ts
import { tap } from 'fngr/tap';

const cleanup = tap(element, (event) => {
  console.log(event.pointers[0].clientX, event.pointers[0].clientY);
});

cleanup(); // unbind
```

**Manager API**

```ts
import { Manager } from 'fngr';
import { TapRecognizer } from 'fngr/tap';

const manager = new Manager(element);

manager.add(new TapRecognizer({
  threshold: 15,   // max movement in px (default: 10)
  interval: 300,   // max duration in ms (default: 250)
  onTap: (event) => console.log(event),
}));

// Later — tear everything down
manager.destroy();
```

The Manager API gives you full control over recognizer configuration and lets you compose multiple recognizers on a single element without duplicating event listeners.

## CustomEvent Integration

Every recognized gesture dispatches a native `CustomEvent` on the target element, so you can integrate fngr with any framework or vanilla event bus without importing fngr in the file that handles the event.

```ts
element.addEventListener('fngr:tap', (e) => {
  console.log(e.detail); // TapEvent
});
```

The event bubbles, so you can also delegate from a parent container:

```ts
document.addEventListener('fngr:tap', (e) => {
  if (e.target === myButton) {
    console.log('button tapped', e.detail);
  }
});
```

## Next Steps

- [State Machine Guide](/guides/state-machine) — understand how recognizer states (Idle → Possible → Recognized / Failed) work
- [Tap API Reference](/api/tap) — full options, types, and return values for `tap()` and `TapRecognizer`
- [Custom Recognizers](/guides/custom-recognizers) — build your own gesture by extending `BaseRecognizer`
