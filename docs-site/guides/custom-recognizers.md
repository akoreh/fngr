# Custom Recognizers

fngr is designed to be extended. If the built-in recognizers do not cover your use case, you can build your own by extending `BaseRecognizer`. You get the state machine, event emission, arbitration hooks, and lifecycle management for free.

## What BaseRecognizer Gives You

Extending `BaseRecognizer` provides:

- **State machine** — the `transition()` method enforces valid state changes and throws on invalid ones, so bugs surface immediately.
- **Event emission** — `emit()` invokes the matching `onXxx` callback from options and dispatches a `fngr:<type>` `CustomEvent` on the target element.
- **Arbitration hooks** — `requireFailureOf`, `allowSimultaneous`, and `canRecognizeSimultaneously` are implemented and ready to use without any extra work.
- **Lifecycle** — `reset()` and `destroy()` clean up state and listener references.

## Defining Event and Options Interfaces

Start by declaring the shape of your event and options. Import `GestureEvent` from `fngr` as the base for your event type.

```ts
import type { GestureEvent } from 'fngr';

export interface TripleTapEvent extends GestureEvent {
  type: 'tripletap';
  count: 3;
}

export interface TripleTapOptions {
  threshold?: number;   // max movement in px before failing (default 10)
  interval?: number;    // max ms between taps (default 300)
  onTripleTap?: (e: TripleTapEvent) => void;
}
```

## Implementing the Recognizer

Import `BaseRecognizer` from `fngr/base` and `RecognizerState` from `fngr`. Implement the four required pointer handlers.

```ts
import { BaseRecognizer } from 'fngr/base';
import { RecognizerState, type PointerInfo } from 'fngr';
import { PointerTracker } from 'fngr';
import type { TripleTapEvent, TripleTapOptions } from './tripletap';

const defaultThreshold = 10;
const defaultInterval = 300;

export class TripleTapRecognizer extends BaseRecognizer<TripleTapEvent> {
  private tracker = new PointerTracker();
  private tapCount = 0;
  private lastTapTime = 0;
  private startTime = 0;
  private activePointerId: number | null = null;
  private target: Element | null = null;

  private readonly threshold: number;
  private readonly interval: number;

  constructor(options: TripleTapOptions) {
    super(options);
    this.threshold = options.threshold ?? defaultThreshold;
    this.interval = options.interval ?? defaultInterval;
  }

  onPointerDown(e: PointerEvent): void {
    if (this.state !== RecognizerState.Idle) return;

    this.tracker.onPointerDown(e);
    this.activePointerId = e.pointerId;
    this.startTime = e.timeStamp;
    this.target = (e.currentTarget ?? e.target) as Element;

    // Transition to Possible on the very first pointerdown
    this.transition(RecognizerState.Possible);
  }

  onPointerMove(e: PointerEvent): void {
    this.tracker.onPointerMove(e);
    if (this.state !== RecognizerState.Possible) return;
    if (e.pointerId !== this.activePointerId) return;

    const start = this.tracker.getStartPosition(e.pointerId);
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.sqrt(dx * dx + dy * dy) > this.threshold) {
      this.transition(RecognizerState.Failed);
      this.resetIfTerminal();
    }
  }

  onPointerUp(e: PointerEvent): void {
    if (this.state !== RecognizerState.Possible) {
      this.tracker.onPointerUp(e);
      return;
    }
    if (e.pointerId !== this.activePointerId) {
      this.tracker.onPointerUp(e);
      return;
    }

    const now = e.timeStamp;
    const elapsed = now - this.startTime;

    if (elapsed > this.interval) {
      // Took too long — fail and reset the tap count
      this.tapCount = 0;
      this.transition(RecognizerState.Failed);
      this.tracker.onPointerUp(e);
      this.resetIfTerminal();
      return;
    }

    const gapSinceLast = now - this.lastTapTime;
    if (this.tapCount > 0 && gapSinceLast > this.interval) {
      // Gap between taps too large — start over
      this.tapCount = 0;
      this.transition(RecognizerState.Failed);
      this.tracker.onPointerUp(e);
      this.resetIfTerminal();
      return;
    }

    this.tapCount += 1;
    this.lastTapTime = now;
    this.tracker.onPointerUp(e);

    if (this.tapCount === 3) {
      const pointers: PointerInfo[] = [{
        id: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
      }];

      const event: TripleTapEvent = {
        type: 'tripletap',
        target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
        pointers,
        timestamp: e.timeStamp,
        srcEvent: e,
        count: 3,
        preventDefault: () => e.preventDefault(),
      };

      this.transition(RecognizerState.Recognized);
      this.emit(event);
      this.resetIfTerminal();
    } else {
      // Not three taps yet — reset to Idle and wait for the next tap
      this.reset();
    }
  }

  onPointerCancel(e: PointerEvent): void {
    this.tracker.onPointerCancel(e);
    if (this.state === RecognizerState.Possible) {
      this.transition(RecognizerState.Failed);
    }
    this.resetIfTerminal();
  }

  private resetIfTerminal(): void {
    if (
      this.state === RecognizerState.Recognized ||
      this.state === RecognizerState.Failed
    ) {
      this.reset();
    }
  }

  // Always call super.reset() so BaseRecognizer can restore its own state
  override reset(): void {
    super.reset();
    this.tracker.reset();
    this.tapCount = 0;
    this.lastTapTime = 0;
    this.startTime = 0;
    this.activePointerId = null;
    this.target = null;
  }
}
```

## Using with Manager

Add your recognizer to a `Manager` exactly like any built-in recognizer:

```ts
import { Manager } from 'fngr';
import { TripleTapRecognizer } from './tripletap-recognizer';

const manager = new Manager(element);

const tripleTap = new TripleTapRecognizer({
  interval: 400,
  onTripleTap: (e) => {
    console.log('triple tap at', e.pointers[0].clientX, e.pointers[0].clientY);
  },
});

manager.add(tripleTap);

// Cleanup when done
manager.destroy();
```

You can also use it alongside built-in recognizers and apply arbitration rules:

```ts
import { Manager } from 'fngr';
import { TapRecognizer } from 'fngr/tap';
import { TripleTapRecognizer } from './tripletap-recognizer';

const manager = new Manager(element);

const tripleTap = new TripleTapRecognizer({ onTripleTap: handleTriple });
const tap = new TapRecognizer({ onTap: handleTap });

// Tap waits for triple-tap to fail first
tap.requireFailureOf(tripleTap);

manager.add(tripleTap, { priority: 10 });
manager.add(tap, { priority: 0 });
```

## Guidelines

**Transition to `Possible` on the first `pointerdown`.** This signals that the recognizer is tracking input. Do not skip straight to `Began` or `Recognized` from `Idle`.

**Fail fast.** As soon as you know the gesture cannot succeed — pointer moved too far, wrong finger count, timeout exceeded — transition to `Failed` and call `reset()`. Staying in `Possible` blocks other recognizers that depend on your failure.

**Reset after every terminal state.** After reaching `Recognized`, `Failed`, `Ended`, or `Cancelled`, call `reset()` so the recognizer returns to `Idle` and is ready for the next gesture.

**Always call `super.reset()`.** `BaseRecognizer.reset()` transitions internal state back to `Idle`. If you override `reset()` without calling `super.reset()`, the state machine will be stuck and subsequent gestures will be silently ignored.

**Use `transition()`, not direct assignment.** The `state` property is read-only from outside and write-protected inside. `transition()` validates the move and throws on invalid sequences, making bugs easy to find.

**Emit events after transitioning.** Call `transition(RecognizerState.Recognized)` (or `Began`, `Changed`, `Ended`) first, then call `emit()`. This ensures the state is accurate if any listener reads `rec.state` during the callback.
