# Manager

The `Manager` binds pointer listeners to a DOM element and routes each `PointerEvent` through every registered recognizer in priority order. It is the entry point for the Manager API.

```ts
import { Manager } from 'fngr';
```

## Constructor

```ts
new Manager(element: Element)
```

Attaches `pointerdown`, `pointermove`, `pointerup`, and `pointercancel` listeners to `element`. Sets `touch-action: none` on the element to suppress browser-native scrolling and zooming during gesture tracking. The previous value of `touch-action` is saved and restored on `destroy()`.

## Properties

| Property | Type | Description |
|---|---|---|
| `element` | `Element` (read-only) | The element the Manager is bound to. |
| `recognizerCount` | `number` (read-only) | The number of currently registered recognizers. |

## Methods

### `add(recognizer, options?)`

```ts
add<T extends BaseRecognizer<any>>(recognizer: T, options?: AddOptions): T
```

Registers a recognizer and returns it so calls can be chained. The internal list is kept sorted by `priority` descending — recognizers with higher priority numbers receive pointer events first.

**`AddOptions`**

| Option | Type | Default | Description |
|---|---|---|---|
| `priority` | `number` | `0` | Higher values run earlier in the dispatch loop. |

**Example**

```ts
const manager = new Manager(element);

const tap = manager.add(new TapRecognizer({ onTap: handler }), { priority: 10 });
const tap2 = manager.add(new TapRecognizer({ onTap: otherHandler }));
```

---

### `remove(recognizer)`

```ts
remove(recognizer: BaseRecognizer<any>): void
```

Unregisters the recognizer. The recognizer is removed from the dispatch loop but is **not** destroyed — call `recognizer.destroy()` yourself if you no longer need it.

---

### `destroy()`

```ts
destroy(): void
```

- Removes all pointer event listeners from `element`.
- Restores the previous `touch-action` value.
- Calls `destroy()` on every registered recognizer.
- Clears the internal recognizer list.

Calling `destroy()` more than once is safe — subsequent calls are no-ops.

## See Also

- [Getting Started](/getting-started) — convenience API vs Manager API
- [BaseRecognizer](/api/base-recognizer) — the recognizer interface
- [Arbitrator](/api/arbitrator) — conflict-resolution logic used internally by the Manager
