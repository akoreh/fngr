# State Machine

Every recognizer in fngr is driven by a finite state machine. Understanding the states and their valid transitions lets you reason about gesture lifecycle, write reliable custom recognizers, and debug unexpected behavior.

## The 8 States

| State | Value | Meaning |
|---|---|---|
| `Idle` | `'idle'` | No active gesture. The recognizer is waiting for input. |
| `Possible` | `'possible'` | A pointer is down and the gesture might still qualify. |
| `Recognized` | `'recognized'` | A discrete gesture completed successfully. |
| `Failed` | `'failed'` | The gesture did not meet its criteria. |
| `Began` | `'began'` | A continuous gesture started. |
| `Changed` | `'changed'` | A continuous gesture is ongoing and has updated. |
| `Ended` | `'ended'` | A continuous gesture finished normally. |
| `Cancelled` | `'cancelled'` | A continuous gesture was interrupted (e.g. a `pointercancel` event). |

## Discrete Gesture Flow

Discrete gestures — like tap or double-tap — fire once and complete. They follow the short path:

```
Idle → Possible → Recognized → Idle
                ↘ Failed → Idle
```

- `Idle → Possible` — first `pointerdown` is received.
- `Possible → Recognized` — all criteria met on `pointerup` (within threshold, within time interval).
- `Possible → Failed` — pointer moved too far, time expired, wrong number of fingers, etc.
- `Recognized → Idle` / `Failed → Idle` — the recognizer resets after any terminal state, ready for the next gesture.

## Continuous Gesture Flow

Continuous gestures — like pan, pinch, or rotate — emit multiple events over time. They follow the longer path:

```
Idle → Possible → Began → Changed → Changed → … → Ended → Idle
                                                  ↘ Cancelled → Idle
                ↘ Failed → Idle
```

- `Idle → Possible` — first `pointerdown` is received.
- `Possible → Began` — the gesture threshold is crossed and the gesture begins.
- `Began → Changed` / `Changed → Changed` — the gesture continues as the pointer moves.
- `Changed → Ended` / `Began → Ended` — the pointer is lifted cleanly (`pointerup`).
- `Changed → Cancelled` / `Began → Cancelled` — the gesture is interrupted (`pointercancel`).
- `Ended → Idle` / `Cancelled → Idle` — the recognizer resets.

## Valid Transitions Table

The `validTransitions` map, exported from `fngr`, encodes every legal state change:

| From | To |
|---|---|
| `Idle` | `Possible` |
| `Possible` | `Recognized`, `Failed`, `Began` |
| `Recognized` | `Idle` |
| `Failed` | `Idle` |
| `Began` | `Changed`, `Ended`, `Cancelled` |
| `Changed` | `Changed`, `Ended`, `Cancelled` |
| `Ended` | `Idle` |
| `Cancelled` | `Idle` |

Attempting an invalid transition throws at runtime:

```
Error: Invalid state transition: idle → began
```

This is intentional — it surfaces bugs in custom recognizers early.

## Accessing State

The current state is exposed as a read-only property on every recognizer:

```ts
import { RecognizerState } from 'fngr';
import { TapRecognizer } from 'fngr/tap';

const rec = new TapRecognizer({ onTap: () => {} });

console.log(rec.state); // 'idle'

// rec.state = RecognizerState.Possible; // TypeError — state is read-only
```

You can compare against the `RecognizerState` enum or its string values:

```ts
if (rec.state === RecognizerState.Possible) {
  // gesture is in progress
}

if (rec.state === 'possible') {
  // equivalent — enum values are plain strings
}
```

## Resetting After Terminal States

After a recognizer reaches `Recognized`, `Failed`, `Ended`, or `Cancelled`, it must transition back to `Idle` before it can handle a new gesture. Built-in recognizers call `reset()` automatically. When writing custom recognizers, call `reset()` (which directly sets the state back to `Idle`, bypassing transition validation) at the end of any terminal path:

```ts
private resetIfTerminal(): void {
  if (
    this.state === RecognizerState.Recognized ||
    this.state === RecognizerState.Failed
  ) {
    this.reset(); // transitions back to Idle
  }
}
```

See the [Custom Recognizers](./custom-recognizers) guide for a complete example.
