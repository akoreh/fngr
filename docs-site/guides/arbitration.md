# Arbitration

When multiple recognizers are attached to the same element, they compete for the same pointer events. Arbitration is how fngr decides which recognizer wins, which waits, and which are allowed to run together.

## Failure Dependencies

Use `requireFailureOf` to make one recognizer wait until another has failed before it can recognize.

The classic case is tap and double-tap on the same element. Without a dependency, a tap would fire on every first touch — before the second tap that makes it a double-tap has a chance to arrive.

```ts
import { Manager } from 'fngr';
import { TapRecognizer } from 'fngr/tap';

const manager = new Manager(element);

// Two tap recognizers with different intervals — the slow one
// waits for the fast one to fail before recognizing
const fastTap = new TapRecognizer({ interval: 150, onTap: () => console.log('fast tap') });
const slowTap = new TapRecognizer({ interval: 400, onTap: () => console.log('slow tap') });

slowTap.requireFailureOf(fastTap);

manager.add(fastTap);
manager.add(slowTap);
```

Internally, `canRecognize` checks whether any failure dependency is still in the `Possible` state. If a dependency is still pending, the recognizer waits:

```ts
// Simplified from Arbitrator.canRecognize
for (const dep of recognizer.failureDependencies) {
  if (dep.state === RecognizerState.Possible) {
    return false; // not yet — dependency hasn't resolved
  }
}
return true;
```

Once `fastTap` fails (because the pointer was held too long), `slowTap` is cleared to recognize.

`requireFailureOf` returns `this` so it can be chained:

```ts
slowTap.requireFailureOf(fastTap).requireFailureOf(anotherRecognizer);
```

## Simultaneous Recognition

By default, when a recognizer reaches `Recognized` or `Began`, fngr fails all other active recognizers. To allow two recognizers to be active at the same time, call `allowSimultaneous`:

```ts
import { Manager } from 'fngr';

const manager = new Manager(element);

// When pan and pinch recognizers are available, you'll allow them
// to run simultaneously for map/canvas interactions:
recognizerA.allowSimultaneous(recognizerB);

manager.add(recognizerA);
manager.add(recognizerB);
```

`allowSimultaneous` is symmetric — calling `pan.allowSimultaneous(pinch)` automatically makes `pinch.canRecognizeSimultaneously(pan)` return `true` as well.

## Priority

When two recognizers conflict and are not set up as simultaneous, you can influence which one wins by assigning a higher priority at registration time:

```ts
import { Manager } from 'fngr';
import { TapRecognizer } from 'fngr/tap';

const manager = new Manager(element);

const primary = new TapRecognizer({ onTap: () => console.log('primary') });
const secondary = new TapRecognizer({ onTap: () => console.log('secondary') });

// primary takes precedence — receives pointer events first
manager.add(primary, { priority: 10 });
manager.add(secondary, { priority: 0 }); // default
```

The manager sorts recognizers by priority descending and routes pointer events in that order. Higher priority recognizers get first access to each event.

The default priority is `0`. Any positive integer beats the default; negative integers deprioritize.

## How the Arbitrator Works

The `Arbitrator` class contains the resolution logic. The `Manager` uses it at two points:

**Before recognition (`canRecognize`)** — called when a recognizer is about to transition to `Recognized` or `Began`. It blocks the transition if any failure dependency is still in `Possible`.

**After recognition (`resolveConflicts`)** — called immediately after a recognizer successfully transitions to a recognized state. It returns a list of all other currently-active recognizers that should be moved to `Failed`, excluding any that are allowed to run simultaneously.

```ts
// What resolveConflicts does, simplified:
for (const { recognizer } of managed) {
  if (recognizer === recognized) continue;
  if (!activeStates.has(recognizer.state)) continue;      // already idle/failed
  if (recognizer.canRecognizeSimultaneously(recognized)) continue; // allowed to coexist
  toFail.push(recognizer);
}
```

Active states for conflict purposes are `Possible`, `Began`, and `Changed`.

## Convenience API and Arbitration

The convenience functions (e.g. `tap()`) share a `Manager` per element, so multiple recognizers registered via convenience functions on the same element share the same event listeners. However, failure dependencies, simultaneous recognition, and priority must be configured manually using the Manager API — convenience functions do not set these up automatically.
