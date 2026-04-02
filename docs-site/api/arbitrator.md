# Arbitrator

`Arbitrator` contains the conflict-resolution logic that determines whether a recognizer is allowed to fire and which competing recognizers should be failed when one wins. The `Manager` uses it internally — you only need to interact with this class directly when building a custom Manager integration.

```ts
import { Arbitrator } from 'fngr';
```

## Methods

### `canRecognize(recognizer, allRecognizers)`

```ts
canRecognize(
  recognizer: BaseRecognizer<any>,
  allRecognizers: BaseRecognizer<any>[],
): boolean
```

Returns `true` if `recognizer` is allowed to transition to a recognized state right now.

A recognizer is blocked when it has at least one failure dependency (added via `requireFailureOf`) that:
- is present in `allRecognizers`, **and**
- is still in the `Possible` state (i.e. it has not yet failed or recognized).

If no dependency is still in the `Possible` state, `canRecognize` returns `true`.

**Example**

```ts
import { Manager } from 'fngr';
import { TapRecognizer } from 'fngr/tap';

const arbitrator = new Arbitrator();

const tap1 = new TapRecognizer({ onTap: handler1 });
const tap2 = new TapRecognizer({ onTap: handler2 });
tap2.requireFailureOf(tap1);

arbitrator.canRecognize(tap2, [tap1, tap2]);
// → false while tap1.state === 'possible'
// → true  once  tap1.state === 'failed'
```

---

### `shouldFail(target, recognized, allRecognizers)`

```ts
shouldFail(
  target: BaseRecognizer<any>,
  recognized: BaseRecognizer<any>,
  allRecognizers: BaseRecognizer<any>[],
): boolean
```

Returns `true` if `target` should be forced to `Failed` because `recognized` just transitioned to a recognized state.

`target` is **not** failed when:
- `target === recognized` (a recognizer never fails itself), or
- `target.canRecognizeSimultaneously(recognized)` returns `true` (the pair has opted in to simultaneous recognition).

---

### `resolveConflicts(recognized, managed)`

```ts
resolveConflicts(
  recognized: BaseRecognizer<any>,
  managed: ManagedEntry[],
): BaseRecognizer<any>[]
```

Returns the list of recognizers that should be failed because `recognized` just won. Iterates `managed`, skipping:
- `recognized` itself,
- recognizers in an inactive state (`Idle`, `Failed`, `Recognized`, `Ended`, `Cancelled`), and
- recognizers that can run simultaneously with `recognized`.

The returned array contains every remaining recognizer in an active state (`Possible`, `Began`, `Changed`). The Manager transitions each of them to `Failed`.

## See Also

- [BaseRecognizer](/api/base-recognizer) — `requireFailureOf`, `allowSimultaneous`
- [Manager](/api/manager) — uses `Arbitrator` to coordinate registered recognizers
- [State Machine Guide](/guides/state-machine) — active vs terminal states
