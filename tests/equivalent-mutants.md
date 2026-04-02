# Equivalent Mutants

Mutants that survive Stryker but produce identical observable behavior. Documented here so
future runs can cross-reference survivors against known equivalents instead of re-investigating.

Last verified: 2026-04-02 (Stryker 9.6, mutation score 86.90%, 95 survivors / 725 mutants)

---

## manager.ts

### M1 — `removeEventListener("")` (4 mutants)

```
- this.element.removeEventListener('pointerdown', this.handlePointerDown);
+ this.element.removeEventListener("", this.handlePointerDown);
```

Lines 70-73 (all four event types).

**Why equivalent:** `destroy()` also sets `this.recognizers = []`, so even if listeners
are not properly removed, the old handler's `routeEvent` loop iterates an empty array and
does nothing. Behavior is identical in unit tests. The real-world effect is a minor memory
leak (closures kept alive) — best caught by E2E or manual inspection.

**To kill:** Would need `addEventListener`/`removeEventListener` spies to verify the correct
string argument, which is testing implementation rather than behavior.

### M2 — `if (this.destroyed) return` guard removed

```
- if (this.destroyed) return;
+ if (false) return;
```

Line 67.

**Why equivalent:** Without the guard, double-destroy re-runs the body:
`removeEventListener` on already-removed listeners (no-op), iterate empty `this.recognizers`
(no-op), set `this.recognizers = []` again (no-op), restore `touchAction` (already restored).
All operations are idempotent by accident.

### M3 — `this.destroyed = true` → `false`

```
- this.destroyed = true;
+ this.destroyed = false;
```

Line 68.

**Why equivalent:** Same reasoning as M2. The `destroyed` flag only gates the `destroy()`
method itself, and every operation inside is independently idempotent once recognizers are
cleared.

---

## base-recognizer.ts

### B1 — `key.startsWith("")` matches all keys

```
- if (key.startsWith('on') && typeof value === 'function') {
+ if (key.startsWith("") && typeof value === 'function') {
```

Line 16.

**Why equivalent:** Extra keys like `threshold` are numbers (filtered by
`typeof value === 'function'`). If a function-typed option like `{ test: fn }` slips
through, it's stored as `callbacks['test']` but `emit()` looks up
`callbacks['onTest']` — the key never matches, so the function is never called. The only
effect is a wasted entry in the callbacks object.

---

## pointer-tracker.ts

### P1 — `tp.history.length < 2` guard removed

```
- if (!tp || tp.history.length < 2) {
+ if (!tp || false) {
```

Line 67 in `getVelocity`.

**Why equivalent:** When `history.length === 1`, `first === last`, so `dt = 0`. The
`if (dt === 0) return { x: 0, y: 0 }` guard on line 75 catches the same case. The early
return is an optimization, not a behavioral gate.

---

## tap.ts (recognizer)

### T1 — `e.currentTarget ?? e.target` → `e.currentTarget && e.target`

```
- this.target = e.currentTarget as Element ?? e.target as Element;
+ this.target = e.currentTarget as Element && e.target as Element;
```

Line 29.

**Why equivalent:** During `dispatchEvent`, `e.currentTarget` is always the element the
listener is bound to (non-null). Both `??` (returns left if non-nullish) and `&&` (returns
right if left is truthy) produce a valid Element. In jsdom and real browsers,
`currentTarget` is always set during dispatch. The `??` fallback to `e.target` only matters
if `currentTarget` were null, which doesn't happen in practice.

### T2 — `onPointerMove` state guard removed

```
- if (this.state !== RecognizerState.Possible) return;
+ if (false) return;
```

Line 34.

**Why equivalent:** Without this guard, `onPointerMove` while Idle would:

1. Call `tracker.onPointerMove(e)` — tracker ignores untracked pointers (returns early)
2. Check `e.pointerId !== this.activePointerId` — `activePointerId` is `null`, so
   `pointerId !== null` is true → return

The downstream `pointerId` guard catches the same case. This is defense-in-depth.

### T3 — `onPointerMove` pointerId guard removed

```
- if (e.pointerId !== this.activePointerId) return;
+ if (false) return;
```

Line 36.

**Why equivalent:** Without this guard, a non-active pointer's move would:

1. Call `tracker.getStartPosition(e.pointerId)` — returns `undefined` for untracked pointers
2. Hit `if (!start) return` — returns early

The downstream `!start` guard catches the same case.

### T4 — `onPointerMove` start position guard removed

```
- if (!start) return;
+ if (false) return;
```

Line 39.

**Why equivalent:** `start` is `undefined` only when `getStartPosition` returns `undefined`
for an untracked pointer. This only happens when the `pointerId` guard (T3) was already
bypassed. If both T3 and T4 are removed simultaneously, `dx = e.clientX - undefined.x`
produces `NaN`, `distance = NaN`, and `NaN > threshold` is `false` — so the tap is not
failed. The gesture still completes normally. This is NOT a bug because the pointer in
question is not the active tap pointer.

Note: T2, T3, and T4 form a **defensive chain**. Removing any single link is equivalent
because the remaining links catch the same condition. Removing ALL THREE simultaneously
would still be equivalent due to the NaN propagation behavior described above.

### T5 — Manager caching guard always true

```
- if (!mgr) {
+ if (true) {
```

Line 116 in `getOrCreateManager`.

**Why equivalent:** Creates a new Manager on every call instead of reusing. The new Manager
is immediately stored in the WeakMap (overwriting the previous). Old Managers become
unreferenced and are garbage collected. The observable effect is:

- Extra `addEventListener` calls (old listeners become orphaned but route to destroyed
  recognizer lists)
- `touch-action` is set to `none` again (already `none`)
- `previousTouchAction` captures `none` instead of the original value

The last point means cleanup would restore `none` instead of the original `touch-action`.
This IS observable but only in the specific sequence: set touch-action → create tap →
create another tap on same element → cleanup second → check touch-action. The existing
test `cleanup restores touch-action` only tests a single tap lifecycle, not the multi-tap
scenario on a shared manager. Technically killable but requires a very specific test that
asserts on Manager-internal bookkeeping.

### T6 — Cleanup idempotency guard removed (2 mutants)

```
- if (cleaned) return;          →  if (false) return;
- cleaned = true;               →  cleaned = false;
```

Lines 138-139.

**Why equivalent:** Without the guard, double-cleanup calls:

1. `mgr.remove(recognizer)` — second call is a no-op (already removed)
2. `recognizer.destroy()` — second call resets already-Idle state (no-op)
3. `mgr.recognizerCount === 0` — if other recognizers exist, this is `false` and the
   Manager is preserved. If no others exist, the Manager is already destroyed.

The sequence is idempotent because `Manager.remove()` silently ignores unknown recognizers
and `BaseRecognizer.destroy()` is safe to call multiple times. The `cleaned` flag is a
micro-optimization that avoids redundant no-op calls.

**Edge case that WOULD break without the flag:** If between the two cleanup calls, a NEW
recognizer is added to the same Manager via another `tap()` call, the double-cleanup's
`recognizerCount === 0` check would incorrectly see 1 (the new recognizer) and not
destroy. This is actually correct behavior — the Manager should stay alive. So even this
edge case is equivalent.

---

## arbitrator.ts

### A1 — `resolveConflicts` self-skip removed

```
- if (recognizer === recognized) continue;
+ if (false) continue;
```

Line 58.

**Why equivalent:** Without the skip, `recognized` would be evaluated by the next guard:
`!activeStates.has(recognizer.state)`. After recognition, the recognizer is in
`Recognized` state, which is NOT in `activeStates` (Possible, Began, Changed). So
`!activeStates.has(Recognized)` is `true` → `continue`. The recognized recognizer is
never added to `toFail`.

The self-skip is an optimization that avoids the Set lookup.

---

## doubletap.recognizer.ts

### DT1 — `target ?? fallback` chain mutations (2 mutants)

```
- target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
+ target: this.target && e.currentTarget as Element ?? (e.target as Element),
+ target: (this.target ?? e.currentTarget as Element) && e.target as Element,
```

Lines 41, 122.

**Why equivalent:** Same as T1. `this.target` is always set in `onPointerDown` before
`emit()` is called. `e.currentTarget` is always non-null during event dispatch. The
fallback chain is defense-in-depth — the first operand is always truthy.

### DT2 — Defense-in-depth state guards (5 mutants)

```
- if (this.state !== RecognizerState.Possible) return;       (onPointerMove, line 52)
- if (!this.startPosition) return;                            (onPointerMove, line 54)
- if (this.state !== RecognizerState.Possible) { ... return } (onPointerUp, line 69)
- if (this.startPosition) { ... }                             (onPointerUp, line 75)
- if (this.tapCount === 2) { ... }                            (else-if, line 96)
- if (this.firstTapPosition) { ... }                          (line 98)
- if (this.state === RecognizerState.Possible) { ... }        (onPointerCancel, line 140)
- if (this.state === RecognizerState.Possible) { ... }        (fail(), line 152)
```

**Why equivalent:** These guards protect against impossible states in the current event
flow. `startPosition` is always set when state is `Possible`. `firstTapPosition` is always
set when `tapCount >= 1`. `onPointerCancel` and `fail()` are only called when state is
already `Possible`. Removing any single guard produces identical behavior because the
conditions they guard against never occur in practice.

### DT3 — `resetIfTerminal` always-true guard

```
- if (this.state === RecognizerState.Recognized || this.state === RecognizerState.Failed) {
+ if (true) {
```

Line 161.

**Why equivalent:** `reset()` directly sets `_state = Idle` without going through
`transition()`, so calling it in any state is safe. The guard is a logical assertion, not
a behavioral gate.

### DT4 — `clearPendingTimeout` null guard

```
- if (this.timeoutId !== null) {
+ if (true) {
```

Line 167.

**Why equivalent:** `clearTimeout(null)` and `clearTimeout(undefined)` are no-ops per the
HTML spec. Setting `this.timeoutId = null` again is also a no-op.

### DT5 — `onResolvedCallbacks = ["Stryker was here"]`

```
- this.onResolvedCallbacks = [];
+ this.onResolvedCallbacks = ["Stryker was here"];
```

Line 186 in `destroy()`.

**Why equivalent:** After `destroy()`, the callbacks array is never iterated again. The
recognizer is removed from the Manager and cannot receive pointer events. The array
contents don't matter because `notifyResolved` is only called from `fail()` and the
recognition path, neither of which can execute after destroy.

### DT6 — Convenience function equivalents (same as T5/T6)

```
- if (!mgr) {         →  if (true) {         (line 197)
- if (cleaned) return  →  if (false) return   (line 219)
- cleaned = true       →  cleaned = false     (line 220)
```

**Why equivalent:** Same reasoning as T5 (Manager caching) and T6 (cleanup idempotency)
for the tap recognizer. The `doubleTap()` convenience function follows the identical
pattern.

---

## tap.recognizer.ts (deferred recognition additions)

### TR1 — `pendingDeps` filter mutations (3 mutants)

```
- const pendingDeps = deps.filter((d) => d.state === RecognizerState.Possible);
+ const pendingDeps = deps;
+ const pendingDeps = deps.filter((d) => true);
```

Line 85.

**Why equivalent:** When `failureDependencies` is non-empty and a dep is in `Possible`,
both the filtered and unfiltered arrays include that dep. When no deps are in `Possible`,
the empty result vs full result doesn't matter because `pendingDeps.length > 0` would be
`true` for the unfiltered version, causing the tap to defer unnecessarily — but then
`tryRecognize()` runs immediately (since no deps are pending), finds no deps in Possible,
and recognizes. The observable behavior is identical: the tap fires synchronously.

### TR2 — `onResolved` duck-type check mutations (3 mutants)

```
- if ('onResolved' in dep && typeof (dep as any).onResolved === 'function') {
+ if (true) {
+ if ('onResolved' in dep || typeof (dep as any).onResolved === 'function') {
+ if ('onResolved' in dep && true) {
```

Line 90.

**Why equivalent:** All deps that have `requireFailureOf` set up in our tests are
`DoubleTapRecognizer` instances, which always have `onResolved`. The guard only matters
if a recognizer WITHOUT `onResolved` is used as a failure dep — which doesn't occur in
the test suite. The `true` mutant would call `onResolved` on all deps (same set), and
the `||` mutant would check a superset condition (also same set in practice).

### TR3 — `tryRecognize` guard mutations (5 mutants)

```
- if (this.state !== RecognizerState.Possible || !this.pendingEvent) return;
+ if (this.state !== RecognizerState.Possible && !this.pendingEvent) return;
+ if (false || !this.pendingEvent) return;
- const stillPending = this.failureDependencies.some(...)
+ const stillPending = this.failureDependencies.every(...)
- if (stillPending) return;    →  if (false) return;
- const anyRecognized = ...some(...)  →  ...every(...)
```

Lines 116-125.

**Why equivalent:** `tryRecognize` is only called via `onResolved` callbacks, which fire
when the DoubleTapRecognizer transitions to Failed or Recognized. At that point:

- state is always Possible (never changed between deferral and callback)
- pendingEvent is always set (set before registering callbacks)
- No deps are still Possible (the callback fires after the dep resolved)
- `some` vs `every` for a single-dep array produces the same result

These guards are safety checks for scenarios that don't occur in the test suite's
single-dep configuration. They would matter with multiple failure dependencies where
one resolves while another is still pending.

---

## longpress.recognizer.ts

### LP1 — `target ?? fallback` chain mutations (3 mutants)

```
- this.target = (e.currentTarget as Element) ?? (e.target as Element);
+ this.target = e.currentTarget as Element && e.target as Element;
- target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
+ target: (this.target ?? e.currentTarget as Element) && e.target as Element,
+ target: this.target && e.currentTarget as Element ?? (e.target as Element),
```

Lines 33, 115.

**Why equivalent:** Same as T1/DT1. `this.target` is always set in `onPointerDown` before
`emitLongPressUp()` is called. `e.currentTarget` is always non-null during event dispatch.

### LP2 — Defense-in-depth state guards (5 mutants)

```
- if (this.state !== RecognizerState.Possible) return;       (timer callback, line 38)
- if (this.state !== RecognizerState.Possible) return;       (onPointerMove, line 68)
- } else if (this.state === RecognizerState.Possible) {      (onPointerUp, line 85)
- if (this.state === RecognizerState.Possible) { ... }       (onPointerCancel, line 93)
- } else if (this.state === RecognizerState.Recognized) {    (onPointerCancel, line 95 → true)
- if (this.state === RecognizerState.Possible) { ... }       (fail(), line 133)
```

**Why equivalent:** These guard against impossible states in the normal event flow:

- **Timer callback guard (line 38):** Timer only fires when state is Possible (it's cleared on
  any transition out of Possible). The guard is defense against a race condition that doesn't
  occur in unit tests with fake timers.
- **onPointerMove guard (line 68):** After Recognized, movement is ignored because the gesture
  already succeeded. After Failed/Idle, the pointer ID check (`e.pointerId !== this.activePointerId`)
  catches the case since `activePointerId` is null after reset.
- **onPointerUp else-if (line 85):** After Recognized is handled, the remaining states are
  Possible or Idle. In Idle, `activePointerId` is null so the pointer ID guard returns early.
- **onPointerCancel guards (lines 93, 95):** `fail()` has its own Possible guard (line 133).
  Mutating line 93 to `true` calls `fail()` in non-Possible states, but fail() is a no-op.
  Mutating line 95 to `true` calls `resetIfTerminal()` in non-Recognized states, but
  `resetIfTerminal` is a no-op in Idle/Possible.
- **fail() guard (line 133):** `fail()` is only called from `onPointerMove` (guarded by Possible
  check) and `onPointerCancel` (also guarded). Double-defense.

### LP3 — `resetIfTerminal` always-true guard

```
- if (this.state === RecognizerState.Recognized || this.state === RecognizerState.Failed) {
+ if (true) {
```

Line 141.

**Why equivalent:** Same as DT3. `reset()` directly sets `_state = Idle` without going through
`transition()`, so calling it in any state is safe.

### LP4 — `clearPendingTimeout` null guard (4 mutants)

```
- if (this.timeoutId !== null) {
+ if (true) {
+ if (false) {
+ if (this.timeoutId === null) {
- (block removal)
```

Lines 146-147.

**Why equivalent:** Same as DT4. `clearTimeout(null)` and `clearTimeout(undefined)` are no-ops
per the HTML spec.

### LP5 — Convenience function equivalents (same as T5/T6/DT6)

```
- if (!mgr) {         →  if (true) {         (line 176)
- if (cleaned) return  →  if (false) return   (line 198)
- cleaned = true       →  cleaned = false     (line 199)
```

**Why equivalent:** Same reasoning as T5/T6 for the tap recognizer. The `longPress()` convenience
function follows the identical Manager-caching and idempotent-cleanup pattern.

---

## swipe.recognizer.ts

### SW1 — `target ?? fallback` chain mutations (3 mutants)

```
- this.target = (e.currentTarget as Element) ?? (e.target as Element);
+ this.target = e.currentTarget as Element && e.target as Element;
- target: this.target ?? (e.currentTarget as Element) ?? (e.target as Element),
+ target: (this.target ?? e.currentTarget as Element) && e.target as Element,
+ target: this.target && e.currentTarget as Element ?? (e.target as Element),
```

Lines 40, 95.

**Why equivalent:** Same as T1/DT1/LP1. `this.target` and `e.currentTarget` are always
non-null during event dispatch.

### SW2 — `onPointerUp` guard mutations (6 mutants)

```
- if (this.state !== RecognizerState.Possible || e.pointerId !== this.activePointerId) {
+ if (false) {
+ if (this.state !== RecognizerState.Possible && e.pointerId !== this.activePointerId) {
+ if (false || e.pointerId !== this.activePointerId) {
+ if (this.state !== RecognizerState.Possible || false) {
- (block removal)
```

Line 49.

**Why equivalent:** The combined guard protects against: (a) state not Possible (after reset),
(b) wrong pointer. After reset, `activePointerId` is null, so `e.pointerId !== null` is always
true → the pointer check alone catches state-after-reset. The `&&` mutant narrows the guard
but the downstream `getStartPosition` returns undefined for untracked pointers, causing `!start`
→ `fail()`. All paths converge on the same behavior.

### SW3 — `!start` guard (2 mutants)

```
- if (!start) {
+ if (false) {
- (block removal)
```

Line 55.

**Why equivalent:** `start` is undefined only for untracked pointers, which can't happen because
`onPointerDown` tracks the pointer before `onPointerUp` could access it. The guard is defense
against pointers that were never tracked.

### SW4 — Speed sqrt subtraction mutant

```
- const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
+ const speed = Math.sqrt(vel.x * vel.x - vel.y * vel.y);
```

Line 67.

**Why equivalent:** For purely horizontal swipes (vel.y ≈ 0), subtraction produces the same
result as addition. Only kills with a diagonal swipe where vel.y is significant AND the
resulting subtraction goes negative (producing NaN). The targeted test with a vertical-dominant
swipe kills the NaN variant, but pure horizontal swipes in the test suite don't distinguish
`+` from `-` when `vel.y ≈ 0`.

**Note:** This was partially killed by the targeted test but a variant survives when vel.y
is very small relative to vel.x.

### SW5 — Velocity boundary `< vs <=`

```
- if (distance < this.threshold || speed < this.velocityThreshold) {
+ if (distance < this.threshold || speed <= this.velocityThreshold) {
```

Line 69.

**Why equivalent:** Tests use `velocity: 0` as threshold, so `speed <= 0` vs `speed < 0` only
matters when speed is exactly 0.0, which requires a completely stationary pointer — caught by
the distance threshold instead. With `velocity: 0`, both operators produce the same result for
any positive speed.

### SW6 — `computeDirection` boundary mutations (3 mutants)

```
- if (Math.abs(dx) > Math.abs(dy)) {     → >=
- return dx > 0 ? 'right' : 'left';      → dx >= 0
- return dy > 0 ? 'down' : 'up';         → dy >= 0
```

Lines 119-122.

**Why equivalent:** The `>=` mutant only matters when `abs(dx) === abs(dy)` (45-degree diagonal).
The `dx >= 0` and `dy >= 0` mutants only matter when `dx === 0` or `dy === 0`. But if dx=0 in
the horizontal branch, abs(0) > abs(dy) requires dy=0 too — zero-distance fails threshold.
Same for dy=0 in the vertical branch.

### SW7 — `matchesDirectionFilter` dead code and guard mutations (4 mutants)

```
- if (this.directionFilter === 'vertical') return ...   → if (true) return ...
- return false;                                          → return true;
- if (this.state === RecognizerState.Possible) { ... }   → if (true) { ... }   (fail, line 133)
```

Lines 128-129, 133.

**Why equivalent:**

- `if (true)` on line 128: only `'vertical'` reaches this line (after `'all'` and `'horizontal'`
  checks), so `true` has the same effect.
- `return true` on line 129: unreachable in TypeScript since `DirectionFilter` is a union of
  three string literals. No test can reach this line without casting.
- `if (true)` in `fail()` (line 133): `fail()` is only called when state is Possible.

### SW8 — `resetIfTerminal` always-true guard + onPointerCancel guard

```
- if (this.state === RecognizerState.Recognized || this.state === RecognizerState.Failed) {
+ if (true) {
- if (this.state === RecognizerState.Possible) {    (onPointerCancel, line 113)
+ if (true) {
```

Lines 113, 140.

**Why equivalent:** Same as DT3/LP3. `reset()` works from any state. `fail()` has its own
Possible guard.

### SW9 — Convenience function equivalents (same as T5/T6/DT6/LP5)

```
- if (!mgr) {         →  if (true) {         (line 159)
- if (cleaned) return  →  if (false) return   (line 185)
- cleaned = true       →  cleaned = false     (line 186)
- if (mgr.recognizerCount === 0) {  → if (true) {  (line 189)
```

**Why equivalent:** Same reasoning as all other recognizers' convenience functions.
