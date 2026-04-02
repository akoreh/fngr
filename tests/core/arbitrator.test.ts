import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Arbitrator } from '../../src/core/arbitrator';
import { BaseRecognizer } from '../../src/core/base-recognizer';
import { RecognizerState, type GestureEvent } from '../../src/core/models/types';

class TestRecognizer extends BaseRecognizer<GestureEvent> {
  onPointerDown = vi.fn();
  onPointerMove = vi.fn();
  onPointerUp = vi.fn();
  onPointerCancel = vi.fn();

  public doTransition(state: RecognizerState) {
    this.transition(state);
  }
}

describe('Arbitrator', () => {
  let arbitrator: Arbitrator;

  beforeEach(() => {
    arbitrator = new Arbitrator();
  });

  describe('failure dependencies', () => {
    it('blocks recognition when dependency is still Possible', () => {
      const tap = new TestRecognizer({});
      const doubleTap = new TestRecognizer({});
      tap.requireFailureOf(doubleTap);

      tap.doTransition(RecognizerState.Possible);
      doubleTap.doTransition(RecognizerState.Possible);

      expect(arbitrator.canRecognize(tap, [tap, doubleTap])).toBe(false);
    });

    it('allows recognition when dependency has Failed', () => {
      const tap = new TestRecognizer({});
      const doubleTap = new TestRecognizer({});
      tap.requireFailureOf(doubleTap);

      tap.doTransition(RecognizerState.Possible);
      doubleTap.doTransition(RecognizerState.Possible);
      doubleTap.doTransition(RecognizerState.Failed);

      expect(arbitrator.canRecognize(tap, [tap, doubleTap])).toBe(true);
    });

    it('allows recognition when dependency is Idle', () => {
      const tap = new TestRecognizer({});
      const doubleTap = new TestRecognizer({});
      tap.requireFailureOf(doubleTap);

      tap.doTransition(RecognizerState.Possible);

      expect(arbitrator.canRecognize(tap, [tap, doubleTap])).toBe(true);
    });

    it('ignores dependencies not present in allRecognizers list', () => {
      const tap = new TestRecognizer({});
      const detached = new TestRecognizer({});
      tap.requireFailureOf(detached);

      detached.doTransition(RecognizerState.Possible);
      tap.doTransition(RecognizerState.Possible);

      // detached is Possible but not in allRecognizers, so it should be ignored
      expect(arbitrator.canRecognize(tap, [tap])).toBe(true);
    });
  });

  describe('simultaneous recognition', () => {
    it('allows simultaneous recognizers to both be active', () => {
      const pan = new TestRecognizer({});
      const pinch = new TestRecognizer({});
      pan.allowSimultaneous(pinch);

      pan.doTransition(RecognizerState.Possible);
      pan.doTransition(RecognizerState.Began);

      expect(arbitrator.shouldFail(pinch, pan, [pan, pinch])).toBe(false);
    });

    it('fails non-simultaneous recognizer when another recognizes', () => {
      const rec1 = new TestRecognizer({});
      const rec2 = new TestRecognizer({});

      rec1.doTransition(RecognizerState.Possible);
      rec1.doTransition(RecognizerState.Recognized);

      expect(arbitrator.shouldFail(rec2, rec1, [rec1, rec2])).toBe(true);
    });

    it('shouldFail returns false when target is the recognized recognizer', () => {
      const rec = new TestRecognizer({});
      rec.doTransition(RecognizerState.Possible);
      rec.doTransition(RecognizerState.Recognized);

      expect(arbitrator.shouldFail(rec, rec, [rec])).toBe(false);
    });
  });

  describe('resolveConflicts', () => {
    it('fails lower-priority recognizers when higher recognizes', () => {
      const high = new TestRecognizer({});
      const low = new TestRecognizer({});

      high.doTransition(RecognizerState.Possible);
      low.doTransition(RecognizerState.Possible);
      high.doTransition(RecognizerState.Recognized);

      const managed = [
        { recognizer: high, priority: 10 },
        { recognizer: low, priority: 5 },
      ];

      const toFail = arbitrator.resolveConflicts(high, managed);
      expect(toFail).toContain(low);
    });

    it('does not fail simultaneous recognizers', () => {
      const pan = new TestRecognizer({});
      const pinch = new TestRecognizer({});
      pan.allowSimultaneous(pinch);

      pan.doTransition(RecognizerState.Possible);
      pinch.doTransition(RecognizerState.Possible);
      pan.doTransition(RecognizerState.Began);

      const managed = [
        { recognizer: pan, priority: 0 },
        { recognizer: pinch, priority: 0 },
      ];

      const toFail = arbitrator.resolveConflicts(pan, managed);
      expect(toFail).not.toContain(pinch);
    });

    it('does not fail recognizers already in Idle or Failed', () => {
      const rec1 = new TestRecognizer({});
      const rec2 = new TestRecognizer({});

      rec1.doTransition(RecognizerState.Possible);
      rec1.doTransition(RecognizerState.Recognized);

      const managed = [
        { recognizer: rec1, priority: 0 },
        { recognizer: rec2, priority: 0 },
      ];

      const toFail = arbitrator.resolveConflicts(rec1, managed);
      expect(toFail).not.toContain(rec2);
    });

    it('does not include the recognized recognizer in toFail', () => {
      const recognized = new TestRecognizer({});
      const active = new TestRecognizer({});

      recognized.doTransition(RecognizerState.Possible);
      active.doTransition(RecognizerState.Possible);
      recognized.doTransition(RecognizerState.Recognized);

      const managed = [
        { recognizer: recognized, priority: 10 },
        { recognizer: active, priority: 5 },
      ];

      const toFail = arbitrator.resolveConflicts(recognized, managed);
      expect(toFail).not.toContain(recognized);
      expect(toFail).toContain(active);
    });

    it('returns empty array when no conflicts exist', () => {
      const rec = new TestRecognizer({});
      rec.doTransition(RecognizerState.Possible);
      rec.doTransition(RecognizerState.Recognized);

      const managed = [{ recognizer: rec, priority: 0 }];

      const toFail = arbitrator.resolveConflicts(rec, managed);
      expect(toFail).toEqual([]);
    });
  });
});
