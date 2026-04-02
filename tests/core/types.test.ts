import { describe, it, expect } from 'vitest';
import {
  RecognizerState,
  validTransitions,
  type Direction,
  type DirectionFilter,
  type Point,
  type PointerInfo,
} from '../../src/core/models/types';

describe('RecognizerState', () => {
  it('has all required states', () => {
    expect(RecognizerState.Idle).toBe('idle');
    expect(RecognizerState.Possible).toBe('possible');
    expect(RecognizerState.Recognized).toBe('recognized');
    expect(RecognizerState.Failed).toBe('failed');
    expect(RecognizerState.Began).toBe('began');
    expect(RecognizerState.Changed).toBe('changed');
    expect(RecognizerState.Ended).toBe('ended');
    expect(RecognizerState.Cancelled).toBe('cancelled');
  });
});

describe('validTransitions', () => {
  it('Idle can only go to Possible', () => {
    expect(validTransitions[RecognizerState.Idle]).toEqual([RecognizerState.Possible]);
  });

  it('Possible can go to Recognized, Failed, or Began', () => {
    expect(validTransitions[RecognizerState.Possible]).toContain(RecognizerState.Recognized);
    expect(validTransitions[RecognizerState.Possible]).toContain(RecognizerState.Failed);
    expect(validTransitions[RecognizerState.Possible]).toContain(RecognizerState.Began);
  });

  it('Recognized returns to Idle', () => {
    expect(validTransitions[RecognizerState.Recognized]).toEqual([RecognizerState.Idle]);
  });

  it('Failed returns to Idle', () => {
    expect(validTransitions[RecognizerState.Failed]).toEqual([RecognizerState.Idle]);
  });

  it('Began can go to Changed, Ended, or Cancelled', () => {
    expect(validTransitions[RecognizerState.Began]).toContain(RecognizerState.Changed);
    expect(validTransitions[RecognizerState.Began]).toContain(RecognizerState.Ended);
    expect(validTransitions[RecognizerState.Began]).toContain(RecognizerState.Cancelled);
  });

  it('Changed can repeat or go to Ended/Cancelled', () => {
    expect(validTransitions[RecognizerState.Changed]).toContain(RecognizerState.Changed);
    expect(validTransitions[RecognizerState.Changed]).toContain(RecognizerState.Ended);
    expect(validTransitions[RecognizerState.Changed]).toContain(RecognizerState.Cancelled);
  });

  it('Ended returns to Idle', () => {
    expect(validTransitions[RecognizerState.Ended]).toEqual([RecognizerState.Idle]);
  });

  it('Cancelled returns to Idle', () => {
    expect(validTransitions[RecognizerState.Cancelled]).toEqual([RecognizerState.Idle]);
  });
});

describe('type contracts', () => {
  it('Direction accepts valid values', () => {
    const dirs: Direction[] = ['left', 'right', 'up', 'down', 'none'];
    expect(dirs).toHaveLength(5);
  });

  it('DirectionFilter accepts valid values', () => {
    const filters: DirectionFilter[] = ['all', 'horizontal', 'vertical'];
    expect(filters).toHaveLength(3);
  });

  it('Point has x and y', () => {
    const p: Point = { x: 10, y: 20 };
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
  });

  it('PointerInfo has required fields', () => {
    const info: PointerInfo = {
      id: 1,
      clientX: 100,
      clientY: 200,
      pageX: 100,
      pageY: 200,
    };
    expect(info.id).toBe(1);
  });
});
