import type { BaseRecognizer } from './base-recognizer';
import { RecognizerState } from './models/types';

interface ManagedEntry {
  recognizer: BaseRecognizer<any>;
  priority: number;
}

const activeStates = new Set([
  RecognizerState.Possible,
  RecognizerState.Began,
  RecognizerState.Changed,
]);

export class Arbitrator {
  /**
   * Check whether a recognizer is allowed to transition to Recognized/Began,
   * given its failure dependencies.
   */
  canRecognize(recognizer: BaseRecognizer<any>, allRecognizers: BaseRecognizer<any>[]): boolean {
    for (const dep of recognizer.failureDependencies) {
      if (!allRecognizers.includes(dep)) continue;
      if (dep.state === RecognizerState.Possible) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check whether `target` should be failed because `recognized` just
   * transitioned to a recognized state.
   */
  shouldFail(
    target: BaseRecognizer<any>,
    recognized: BaseRecognizer<any>,
    _allRecognizers: BaseRecognizer<any>[],
  ): boolean {
    if (target === recognized) return false;
    if (target.canRecognizeSimultaneously(recognized)) return false;
    return true;
  }

  /**
   * When a recognizer transitions to Recognized/Began, determine which
   * other recognizers should be forced to Failed.
   */
  resolveConflicts(
    recognized: BaseRecognizer<any>,
    managed: ManagedEntry[],
  ): BaseRecognizer<any>[] {
    const toFail: BaseRecognizer<any>[] = [];

    for (const { recognizer } of managed) {
      if (recognizer === recognized) continue;
      if (!activeStates.has(recognizer.state)) continue;
      if (recognizer.canRecognizeSimultaneously(recognized)) continue;
      toFail.push(recognizer);
    }

    return toFail;
  }
}
