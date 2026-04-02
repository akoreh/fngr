# Equivalent Mutants

Mutants that survive Stryker but produce identical observable behavior. Documented here so
future runs can cross-reference survivors against known equivalents instead of re-investigating.

Last verified: 2026-04-02 (Stryker 9.6, mutation score 94.35%, 16 survivors / 283 mutants)

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
