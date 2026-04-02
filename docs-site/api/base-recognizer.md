# BaseRecognizer

`BaseRecognizer` is the abstract base class for all gesture recognizers. It manages the state machine, failure dependencies, simultaneous-recognition opt-ins, and event emission. Build a custom recognizer by extending it and implementing the four abstract pointer methods.

```ts
import { BaseRecognizer } from 'fngr/base';
```

See also: [State Machine Guide](/guides/state-machine) — detailed walkthrough of every state and valid transition.

## Properties

| Property | Type | Description |
|---|---|---|
| `state` | `RecognizerState` (read-only) | The recognizer's current state machine state. |
| `failureDependencies` | `ReadonlyArray<BaseRecognizer<any>>` | Recognizers that must have failed before this one can recognize. |

## Abstract Methods

Subclasses must implement all four methods. The `Manager` calls them in pointer-event order.

| Method | Signature | Description |
|---|---|---|
| `onPointerDown` | `(e: PointerEvent): void` | Called when a pointer is pressed on the element. |
| `onPointerMove` | `(e: PointerEvent): void` | Called when a tracked pointer moves. |
| `onPointerUp` | `(e: PointerEvent): void` | Called when a pointer is lifted. |
| `onPointerCancel` | `(e: PointerEvent): void` | Called when a pointer is cancelled (e.g. system interruption). |

## Protected Methods

### `transition(newState)`

```ts
protected transition(newState: RecognizerState): void
```

Moves the recognizer to `newState`. Throws if the transition is not permitted by the state machine (see [valid transitions](/guides/state-machine)). Call this inside your abstract method implementations to advance the recognizer through its lifecycle.

---

### `emit(event)`

```ts
protected emit(event: T): void
```

Delivers a `GestureEvent` to consumers in two ways:

1. Invokes the matching `on<Type>` callback passed in the constructor options (e.g. `onTap` for an event with `type: 'tap'`).
2. Dispatches a bubbling, cancelable `CustomEvent` named `fngr:<type>` on `event.target`, with the event object available as `event.detail`.

## Public Methods

### `requireFailureOf(other)`

```ts
requireFailureOf(other: BaseRecognizer<any>): this
```

Declares that this recognizer must wait until `other` has failed before it is allowed to recognize. Returns `this` for chaining.

---

### `allowSimultaneous(other)`

```ts
allowSimultaneous(other: BaseRecognizer<any>): this
```

Opts this recognizer and `other` into simultaneous recognition. By default, when one recognizer in a Manager reaches a recognized state all others in an active state are failed. Calling this on either recognizer exempts the pair. Returns `this` for chaining.

---

### `canRecognizeSimultaneously(other)`

```ts
canRecognizeSimultaneously(other: BaseRecognizer<any>): boolean
```

Returns `true` if `allowSimultaneous(other)` has been called on either recognizer in the pair.

---

### `hasFailureDependency(other)`

```ts
hasFailureDependency(other: BaseRecognizer<any>): boolean
```

Returns `true` if `other` is in this recognizer's failure-dependency set.

---

### `reset()`

```ts
reset(): void
```

Forces the state back to `Idle` by directly setting the state, bypassing transition validation. Called by recognizer implementations after reaching a terminal state (Recognized, Failed, Ended, Cancelled).

---

### `destroy()`

```ts
destroy(): void
```

Calls `reset()`, clears all failure dependencies, simultaneous-recognition registrations, and registered callbacks.

## Example — Custom Recognizer Skeleton

```ts
import { BaseRecognizer } from 'fngr/base';
import { RecognizerState, type GestureEvent } from 'fngr';

interface MyEvent extends GestureEvent {
  type: 'mygesture';
}

export class MyRecognizer extends BaseRecognizer<MyEvent> {
  onPointerDown(e: PointerEvent): void {
    this.transition(RecognizerState.Possible);
  }

  onPointerMove(e: PointerEvent): void {
    // check gesture criteria...
  }

  onPointerUp(e: PointerEvent): void {
    this.transition(RecognizerState.Recognized);
    this.emit({ type: 'mygesture', target: e.target as Element, /* ... */ });
    this.reset();
  }

  onPointerCancel(e: PointerEvent): void {
    this.transition(RecognizerState.Failed);
    this.reset();
  }
}
```

## See Also

- [State Machine Guide](/guides/state-machine)
- [Manager](/api/manager)
- [Types](/api/types) — `RecognizerState`, `GestureEvent`
