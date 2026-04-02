# Contributing

## Architecture Overview

### State machine per recognizer

Every recognizer owns a single state machine that starts at `Idle` and advances through well-defined transitions enforced by `validTransitions` in `src/core/models/types.ts`.

**Discrete gestures** (tap, double-tap, long-press, swipe) use the short path:

```
Idle → Possible → Recognized
                → Failed
```

**Continuous gestures** (pan, pinch, rotate) stay alive across multiple pointer-move events:

```
Idle → Possible → Began → Changed → Ended
                        →          → Cancelled
                → Failed
```

Calling `transition()` with an invalid next state throws immediately, so state bugs surface as test failures rather than silent misbehaviour.

### Manager coordinates pointer events

`Manager` owns a single DOM element. On construction it sets `touch-action: none` (restoring the previous value on `destroy`) and attaches four pointer event listeners. Each raw `PointerEvent` is forwarded to every registered recognizer in priority order via `routeEvent`.

```
PointerEvents (pointerdown / pointermove / pointerup / pointercancel)
    ↓
Manager.routeEvent
    ↓ (for each recognizer, highest priority first)
Recognizer.onPointerDown / onPointerMove / onPointerUp / onPointerCancel
    ↓ (on state transition to Recognized/Began)
BaseRecognizer.emit
    ├── options callback  (e.g. onTap)
    └── CustomEvent       (fngr:<type>, bubbles, cancelable)
```

### Core components

| File                          | Role                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/core/manager.ts`         | Attaches to a DOM element, routes raw pointer events to all registered recognizers                                   |
| `src/core/base-recognizer.ts` | Abstract base class: state machine, `transition()`, `emit()`, failure-dependency and simultaneous-recognition wiring |
| `src/core/arbitrator.ts`      | Decides whether a recognizer may recognize, and which competing recognizers to fail when one succeeds                |
| `src/core/pointer-tracker.ts` | Tracks active pointers and their start positions across a gesture's lifetime                                         |

---

## Project Structure

```
fngr/
├── src/
│   ├── index.ts                        # Barrel: all public exports
│   ├── core/
│   │   ├── arbitrator.ts
│   │   ├── base-recognizer.ts
│   │   ├── manager.ts
│   │   ├── pointer-tracker.ts
│   │   └── models/
│   │       └── types.ts                # RecognizerState, GestureEvent, Point, …
│   └── recognizers/
│       ├── tap/
│       │   ├── index.ts                # Barrel: exports TapRecognizer, tap, types
│       │   ├── tap.recognizer.ts       # TapRecognizer class + tap() helper
│       │   └── models/
│       │       └── tap.ts              # TapEvent, TapOptions
│       ├── doubletap/
│       │   ├── index.ts                # Barrel: exports DoubleTapRecognizer, doubleTap, types
│       │   ├── doubletap.recognizer.ts # DoubleTapRecognizer class + doubleTap() helper
│       │   └── models/
│       │       └── doubletap.ts        # DoubleTapEvent, DoubleTapOptions
│       ├── longpress/
│       │   ├── index.ts                # Barrel: exports LongPressRecognizer, longPress, types
│       │   ├── longpress.recognizer.ts # LongPressRecognizer class + longPress() helper
│       │   └── models/
│       │       └── longpress.ts        # LongPressEvent, LongPressOptions
│       ├── swipe/
│       │   ├── index.ts                # Barrel: exports SwipeRecognizer, swipe, types
│       │   ├── swipe.recognizer.ts     # SwipeRecognizer class + swipe() helper
│       │   └── models/
│       │       └── swipe.ts            # SwipeEvent, SwipeOptions
│       └── models/                     # Type stubs for future recognizers
│           └── …
├── tests/
│   ├── core/                           # Unit tests for core primitives
│   │   ├── arbitrator.test.ts
│   │   ├── base-recognizer.test.ts
│   │   ├── manager.test.ts
│   │   ├── pointer-tracker.test.ts
│   │   └── types.test.ts
│   ├── recognizers/                    # Unit tests for each recognizer
│   │   ├── tap.test.ts
│   │   ├── doubletap.test.ts
│   │   ├── longpress.test.ts
│   │   └── swipe.test.ts
│   └── helpers/                        # Shared test utilities
│       ├── pointer.ts                  # PointerEvent factory helpers
│       └── setup.ts                    # vitest globalSetup (polyfills, etc.)
├── e2e/                                # Playwright end-to-end tests
│   ├── tap.spec.ts
│   ├── doubletap.spec.ts
│   ├── longpress.spec.ts
│   └── swipe.spec.ts
├── examples/                           # Standalone HTML demos (served by Vite)
│   ├── index.html
│   ├── tap.html
│   ├── doubletap.html
│   ├── longpress.html
│   ├── swipe.html
│   └── shared/
│       ├── setup.ts
│       └── style.css
├── docs-site/                          # VitePress documentation site
│   ├── index.md
│   ├── getting-started.md
│   ├── contributing.md
│   ├── api/                            # Per-recognizer API reference pages
│   └── .vitepress/
│       ├── config.ts
│       └── theme/
│           ├── index.ts
│           └── custom.css
├── package.json
├── tsup.config.ts                      # Build entries + subpath exports
├── tsconfig.json
├── vitest.config.ts
├── vite.config.ts                      # Dev server for examples/
└── playwright.config.ts
```

---

## Adding a New Recognizer

The steps below follow the pattern established by `TapRecognizer`. Replace `{name}` with your recognizer name in lowercase (e.g. `swipe`) and `{Name}` with PascalCase (e.g. `Swipe`).

### 1. Create the recognizer folder and model

```
src/recognizers/{name}/
├── index.ts              # Barrel: re-exports recognizer + types
├── {name}.recognizer.ts  # Recognizer class + convenience function
└── models/
    └── {name}.ts         # Event and options interfaces
```

`src/recognizers/{name}/models/{name}.ts`

```ts
import type { GestureEvent } from '../../../core/models/types';

export interface {Name}Event extends GestureEvent {
  type: '{name}';
  // … gesture-specific fields
}

export interface {Name}Options {
  // … threshold, interval, etc.
  on{Name}?: (e: {Name}Event) => void;
}
```

### 2. Write failing tests

`tests/recognizers/{name}.test.ts`

Write tests before the implementation. Use the pointer helpers in `tests/helpers/pointer.ts` to simulate `PointerEvent` sequences. At minimum cover:

- Happy path: gesture is recognised
- Threshold exceeded: recognizer fails
- Cancel mid-gesture: recognizer fails and resets
- State transitions end up back at `Idle`

### 3. Implement the recognizer

`src/recognizers/{name}/{name}.recognizer.ts`

Extend `BaseRecognizer<{Name}Event>` and implement the four abstract methods. Use `PointerTracker` for multi-pointer gestures (pan, pinch, rotate) or track pointers directly for single-pointer gestures (tap, longpress, swipe).

```ts
import { BaseRecognizer } from '../../core/base-recognizer';
import { RecognizerState } from '../../core/models/types';
import type { {Name}Event, {Name}Options } from './models/{name}';

export class {Name}Recognizer extends BaseRecognizer<{Name}Event> {

  constructor(options: {Name}Options) {
    super(options);
  }

  onPointerDown(e: PointerEvent): void { /* … */ }
  onPointerMove(e: PointerEvent): void { /* … */ }
  onPointerUp(e: PointerEvent): void { /* … */ }
  onPointerCancel(e: PointerEvent): void { /* … */ }
}
```

Create the barrel export at `src/recognizers/{name}/index.ts`:

```ts
export { {Name}Recognizer, {name} } from './{name}.recognizer';
export type { {Name}Event, {Name}Options } from './models/{name}';
```

Optionally add a convenience function (like `tap()`) that handles `Manager` lifecycle automatically.

### 4. Add to barrel export

`src/index.ts`

```ts
export type { {Name}Event, {Name}Options } from './recognizers/{name}';
```

If you are also exporting the recognizer class or convenience function:

```ts
export { {Name}Recognizer, {name} } from './recognizers/{name}';
```

### 5. Add subpath export

`package.json`

```json
"./{name}": {
  "types": "./dist/recognizers/{name}.d.ts",
  "import": "./dist/recognizers/{name}.mjs"
}
```

`tsup.config.ts`

```ts
entry: {
  // … existing entries
  'recognizers/{name}': 'src/recognizers/{name}/index.ts',
},
```

### 6. Write E2E tests

`e2e/{name}.spec.ts`

Use Playwright to load `examples/{name}.html` and exercise the recognizer with real simulated pointer input. E2E covers things unit tests cannot: actual timing, DOM event bubbling, `touch-action` enforcement, and scrollable containers.

### 7. Add an example page

`examples/{name}.html`

A minimal self-contained HTML page that imports from the built source and demonstrates the recognizer visually. Follow the structure of `examples/tap.html`.

### 8. Add a docs page

`docs-site/api/{name}.md`

Document the options interface, event shape, and at least one usage example. Register the page in the sidebar inside `docs-site/.vitepress/config.ts`.

### 9. Add a demo component

`docs-site/demos/{Name}Demo.vue`

An interactive Vue component embedded in the docs page so readers can try the gesture live in the browser.

### 10. Update llms.txt

`docs-site/public/llms.txt`

Add a section for the new recognizer following the pattern of existing entries: convenience API example, options with defaults, event interface, and any CustomEvent names. This file is served at `/llms.txt` so LLMs can ingest the full API in one request.

### 11. Add JSDoc to public exports

Add JSDoc comments to the recognizer class, convenience function, event interface, and options interface. These are what autocomplete LLMs (Copilot, Cursor) see when users work with fngr.

---

## Testing

### Unit tests

```sh
npm test
```

Runs the full unit-test suite with **vitest** in a **jsdom** environment. A `PointerEvent` polyfill is loaded automatically via `tests/helpers/setup.ts`, so every test file can fire pointer events without a real browser.

### E2E tests

```sh
npm run test:e2e
```

Runs **Playwright** against a **Vite** dev server. These tests cover browser-specific behaviour that jsdom cannot replicate: real gesture timing, native scroll interaction, `touch-action` CSS, and multi-touch sequences from distinct pointer IDs.

### Everything at once

```sh
npm run test:all
```

Runs unit tests then E2E tests sequentially.

---

## Code Style

- **Constants**: camelCase, not `SCREAMING_SNAKE_CASE` (e.g. `defaultThreshold`, not `DEFAULT_THRESHOLD`).
- **Types and interfaces**: live in `models/` folders alongside the code that consumes them, not in a top-level `types/` directory.
- **Imports**: extensionless (e.g. `'../core/manager'`, not `'../core/manager.ts'`).
- **Dependencies**: zero runtime dependencies, ever. All `devDependencies` are build/test tooling only.
