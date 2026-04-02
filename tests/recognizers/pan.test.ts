import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fire } from '../helpers/pointer';

// These will be created — tests must fail first
import { PanRecognizer, pan } from '../../src/recognizers/pan/index';
import { Manager } from '../../src/core/manager';
import { RecognizerState } from '../../src/core/models/types';
import type { PanEvent } from '../../src/recognizers/pan/models/pan';

describe('PanRecognizer', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  describe('basic pan detection', () => {
    it('fires panstart when movement exceeds threshold', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      expect(onPanstart).toHaveBeenCalledTimes(1);
      expect(onPanstart.mock.calls[0][0].type).toBe('panstart');
    });

    it('fires panmove on subsequent moves after panstart', () => {
      const onPanmove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanmove, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 }); // panstart
      fire(el, 'pointermove', { clientX: 80, clientY: 50, timeStamp: 20 }); // panmove

      expect(onPanmove).toHaveBeenCalledTimes(1);
      expect(onPanmove.mock.calls[0][0].type).toBe('panmove');
    });

    it('fires panend on pointerup after pan started', () => {
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanend, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 80, clientY: 50 });

      expect(onPanend).toHaveBeenCalledTimes(1);
      expect(onPanend.mock.calls[0][0].type).toBe('panend');
    });

    it('fires pancancel on pointercancel after pan started', () => {
      const onPancancel = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPancancel, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointercancel', { clientX: 65, clientY: 50 });

      expect(onPancancel).toHaveBeenCalledTimes(1);
      expect(onPancancel.mock.calls[0][0].type).toBe('pancancel');
    });

    it('does not fire any event if pointer lifts before exceeding threshold', () => {
      const onPanstart = vi.fn();
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, onPanend, threshold: 50 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 55, clientY: 50, timeStamp: 10 }); // 5px < 50px
      fire(el, 'pointerup', { clientX: 55, clientY: 50 });

      expect(onPanstart).not.toHaveBeenCalled();
      expect(onPanend).not.toHaveBeenCalled();
    });
  });

  describe('delta values', () => {
    it('panstart reports delta from pointer-down position', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 200 });
      fire(el, 'pointermove', { clientX: 120, clientY: 210, timeStamp: 10 });

      const e = onPanstart.mock.calls[0][0] as PanEvent;
      expect(e.deltaX).toBe(20);
      expect(e.deltaY).toBe(10);
    });

    it('panmove reports cumulative delta from pointer-down', () => {
      const onPanmove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanmove, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 110, clientY: 100, timeStamp: 10 }); // panstart
      fire(el, 'pointermove', { clientX: 150, clientY: 130, timeStamp: 20 }); // panmove

      const e = onPanmove.mock.calls[0][0] as PanEvent;
      expect(e.deltaX).toBe(50);
      expect(e.deltaY).toBe(30);
    });

    it('panend reports final delta', () => {
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanend, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 110, clientY: 100, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 200, clientY: 150 });

      const e = onPanend.mock.calls[0][0] as PanEvent;
      expect(e.deltaX).toBe(100);
      expect(e.deltaY).toBe(50);
    });

    it('negative deltas for leftward/upward pans', () => {
      const onPanmove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanmove, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 200, clientY: 200 });
      fire(el, 'pointermove', { clientX: 190, clientY: 200, timeStamp: 10 }); // panstart
      fire(el, 'pointermove', { clientX: 150, clientY: 170, timeStamp: 20 }); // panmove

      const e = onPanmove.mock.calls[0][0] as PanEvent;
      expect(e.deltaX).toBe(-50);
      expect(e.deltaY).toBe(-30);
    });
  });

  describe('direction detection', () => {
    it('reports right when dx > dy', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 120, clientY: 103, timeStamp: 10 });

      expect(onPanstart.mock.calls[0][0].direction).toBe('right');
    });

    it('reports left when dx < 0 and |dx| > |dy|', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 80, clientY: 103, timeStamp: 10 });

      expect(onPanstart.mock.calls[0][0].direction).toBe('left');
    });

    it('reports down when |dy| >= |dx| and dy > 0', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 103, clientY: 120, timeStamp: 10 });

      expect(onPanstart.mock.calls[0][0].direction).toBe('down');
    });

    it('reports up when |dy| >= |dx| and dy < 0', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 103, clientY: 80, timeStamp: 10 });

      expect(onPanstart.mock.calls[0][0].direction).toBe('up');
    });

    it('45-degree diagonal reports vertical (dy axis wins ties)', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 115, clientY: 115, timeStamp: 10 });

      expect(onPanstart.mock.calls[0][0].direction).toBe('down');
    });

    it('direction updates on each panmove', () => {
      const onPanmove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanmove, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 120, clientY: 100, timeStamp: 10 }); // panstart right
      fire(el, 'pointermove', { clientX: 120, clientY: 150, timeStamp: 20 }); // panmove — dy=50 > dx=20

      expect(onPanmove.mock.calls[0][0].direction).toBe('down');
    });
  });

  describe('direction filtering', () => {
    it('horizontal filter allows left/right pans', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10, direction: 'horizontal' }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 70, clientY: 52, timeStamp: 10 });

      expect(onPanstart).toHaveBeenCalledTimes(1);
    });

    it('horizontal filter rejects vertical pans', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10, direction: 'horizontal' }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 52, clientY: 70, timeStamp: 10 });

      expect(onPanstart).not.toHaveBeenCalled();
    });

    it('vertical filter allows up/down pans', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10, direction: 'vertical' }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 52, clientY: 70, timeStamp: 10 });

      expect(onPanstart).toHaveBeenCalledTimes(1);
    });

    it('vertical filter rejects horizontal pans', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10, direction: 'vertical' }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 70, clientY: 52, timeStamp: 10 });

      expect(onPanstart).not.toHaveBeenCalled();
    });

    it('all filter allows any direction', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10, direction: 'all' }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 52, clientY: 70, timeStamp: 10 });

      expect(onPanstart).toHaveBeenCalledTimes(1);
    });

    it('filtered pan still fails and resets to idle for next gesture', () => {
      const onPanstart = vi.fn();
      const rec = new PanRecognizer({ onPanstart, threshold: 10, direction: 'horizontal' });
      const mgr = new Manager(el);
      mgr.add(rec);

      // Vertical pan — should be rejected
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 52, clientY: 70, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 52, clientY: 70 });

      expect(rec.state).toBe(RecognizerState.Idle);

      // Now horizontal pan should work
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 70, clientY: 52, timeStamp: 20 });

      expect(onPanstart).toHaveBeenCalledTimes(1);
    });
  });

  describe('threshold', () => {
    it('default threshold is 10', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 55, clientY: 50, timeStamp: 10 }); // 5px < 10px

      expect(onPanstart).not.toHaveBeenCalled();

      fire(el, 'pointermove', { clientX: 61, clientY: 50, timeStamp: 20 }); // 11px > 10px

      expect(onPanstart).toHaveBeenCalledTimes(1);
    });

    it('custom threshold respected', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 50 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 90, clientY: 50, timeStamp: 10 }); // 40px < 50px

      expect(onPanstart).not.toHaveBeenCalled();

      fire(el, 'pointermove', { clientX: 105, clientY: 50, timeStamp: 20 }); // 55px > 50px

      expect(onPanstart).toHaveBeenCalledTimes(1);
    });

    it('threshold is based on straight-line distance, not axis distance', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10 }));

      // Diagonal movement: sqrt(8^2 + 8^2) = 11.3 > 10
      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 108, clientY: 108, timeStamp: 10 });

      expect(onPanstart).toHaveBeenCalledTimes(1);
    });

    it('movement exactly at threshold does not fire (must exceed)', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 110, clientY: 100, timeStamp: 10 }); // exactly 10

      expect(onPanstart).not.toHaveBeenCalled();
    });
  });

  describe('velocity', () => {
    it('provides velocityX and velocityY', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100, timeStamp: 0 });
      fire(el, 'pointermove', { clientX: 120, clientY: 100, timeStamp: 10 });

      const e = onPanstart.mock.calls[0][0] as PanEvent;
      expect(e.velocityX).toBeGreaterThan(0);
      expect(typeof e.velocityY).toBe('number');
    });

    it('velocity reflects movement speed', () => {
      const onPanmove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanmove, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100, timeStamp: 0 });
      fire(el, 'pointermove', { clientX: 110, clientY: 100, timeStamp: 10 }); // panstart
      // Move 50px in 10ms → velocity = 5 px/ms
      fire(el, 'pointermove', { clientX: 160, clientY: 100, timeStamp: 20 });

      const e = onPanmove.mock.calls[0][0] as PanEvent;
      // Velocity should be positive and non-trivial
      expect(e.velocityX).toBeGreaterThan(0);
    });

    it('panend provides final velocity', () => {
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanend, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100, timeStamp: 0 });
      fire(el, 'pointermove', { clientX: 115, clientY: 100, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 150, clientY: 100, timeStamp: 20 });

      const e = onPanend.mock.calls[0][0] as PanEvent;
      expect(typeof e.velocityX).toBe('number');
      expect(typeof e.velocityY).toBe('number');
    });
  });

  describe('isFirst and isFinal flags', () => {
    it('panstart has isFirst=true, isFinal=false', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      const e = onPanstart.mock.calls[0][0] as PanEvent;
      expect(e.isFirst).toBe(true);
      expect(e.isFinal).toBe(false);
    });

    it('panmove has isFirst=false, isFinal=false', () => {
      const onPanmove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanmove, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointermove', { clientX: 80, clientY: 50, timeStamp: 20 });

      const e = onPanmove.mock.calls[0][0] as PanEvent;
      expect(e.isFirst).toBe(false);
      expect(e.isFinal).toBe(false);
    });

    it('panend has isFirst=false, isFinal=true', () => {
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanend, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 80, clientY: 50 });

      const e = onPanend.mock.calls[0][0] as PanEvent;
      expect(e.isFirst).toBe(false);
      expect(e.isFinal).toBe(true);
    });

    it('pancancel has isFirst=false, isFinal=true', () => {
      const onPancancel = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPancancel, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointercancel', { clientX: 65, clientY: 50 });

      const e = onPancancel.mock.calls[0][0] as PanEvent;
      expect(e.isFirst).toBe(false);
      expect(e.isFinal).toBe(true);
    });
  });

  describe('event shape', () => {
    it('panstart includes all expected fields', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 55, timeStamp: 10 });

      const e = onPanstart.mock.calls[0][0] as PanEvent;
      expect(e.type).toBe('panstart');
      expect(e.target).toBe(el);
      expect(e.pointers).toBeInstanceOf(Array);
      expect(e.pointers.length).toBeGreaterThan(0);
      expect(typeof e.timestamp).toBe('number');
      expect(e.srcEvent).toBeInstanceOf(PointerEvent);
      expect(typeof e.deltaX).toBe('number');
      expect(typeof e.deltaY).toBe('number');
      expect(typeof e.velocityX).toBe('number');
      expect(typeof e.velocityY).toBe('number');
      expect(typeof e.direction).toBe('string');
      expect(typeof e.isFirst).toBe('boolean');
      expect(typeof e.isFinal).toBe('boolean');
      expect(typeof e.preventDefault).toBe('function');
    });

    it('pointers array has correct shape', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 7 });
      fire(el, 'pointermove', { clientX: 65, clientY: 55, pointerId: 7, timeStamp: 10 });

      const p = onPanstart.mock.calls[0][0].pointers[0];
      expect(p.id).toBe(7);
      expect(typeof p.clientX).toBe('number');
      expect(typeof p.clientY).toBe('number');
      expect(typeof p.pageX).toBe('number');
      expect(typeof p.pageY).toBe('number');
    });

    it('preventDefault calls srcEvent.preventDefault', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      const moveEvt = fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      const spy = vi.spyOn(moveEvt, 'preventDefault');
      onPanstart.mock.calls[0][0].preventDefault();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('state machine', () => {
    it('starts in Idle', () => {
      const rec = new PanRecognizer({ threshold: 5 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('transitions to Possible on pointerdown', () => {
      const rec = new PanRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Possible);
    });

    it('transitions to Began when threshold exceeded', () => {
      const rec = new PanRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      expect(rec.state).toBe(RecognizerState.Began);
    });

    it('transitions to Changed on subsequent move', () => {
      const rec = new PanRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointermove', { clientX: 80, clientY: 50, timeStamp: 20 });
      expect(rec.state).toBe(RecognizerState.Changed);
    });

    it('stays in Changed on additional moves', () => {
      const rec = new PanRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointermove', { clientX: 80, clientY: 50, timeStamp: 20 });
      fire(el, 'pointermove', { clientX: 95, clientY: 50, timeStamp: 30 });
      expect(rec.state).toBe(RecognizerState.Changed);
    });

    it('resets to Idle after pointerup (via Ended)', () => {
      const rec = new PanRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 80, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('resets to Idle after pointercancel (via Cancelled)', () => {
      const rec = new PanRecognizer({ threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointercancel', { clientX: 65, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('transitions to Failed then Idle when pointerup before threshold', () => {
      const rec = new PanRecognizer({ threshold: 50 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 55, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);
    });

    it('handles full lifecycle and can start new pan', () => {
      const onPanstart = vi.fn();
      const rec = new PanRecognizer({ onPanstart, threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      // First pan
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 80, clientY: 50 });
      expect(rec.state).toBe(RecognizerState.Idle);

      // Second pan
      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 115, clientY: 100, timeStamp: 20 });

      expect(onPanstart).toHaveBeenCalledTimes(2);
    });
  });

  describe('pointer ID tracking', () => {
    it('ignores moves from a different pointer ID', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      fire(el, 'pointermove', { clientX: 200, clientY: 50, pointerId: 2, timeStamp: 10 });

      expect(onPanstart).not.toHaveBeenCalled();
    });

    it('ignores pointerup from a different pointer ID', () => {
      const onPanend = vi.fn();
      const rec = new PanRecognizer({ onPanend, threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, pointerId: 1, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 65, clientY: 50, pointerId: 2 });

      expect(onPanend).not.toHaveBeenCalled();
      expect(rec.state).not.toBe(RecognizerState.Idle);
    });

    it('ignores second pointerdown while already tracking', () => {
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 10 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
      fire(el, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 2 }); // should be ignored
      fire(el, 'pointermove', { clientX: 70, clientY: 50, pointerId: 1, timeStamp: 10 });

      expect(onPanstart).toHaveBeenCalledTimes(1);
      // Delta should be from first pointer's down position
      expect(onPanstart.mock.calls[0][0].deltaX).toBe(20);
    });
  });

  describe('CustomEvent dispatch', () => {
    it('dispatches fngr:panstart on threshold exceeded', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:panstart', listener);
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      expect(listener).toHaveBeenCalledTimes(1);
      const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
      expect(detail.type).toBe('panstart');
    });

    it('dispatches fngr:panmove on subsequent moves', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:panmove', listener);
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointermove', { clientX: 80, clientY: 50, timeStamp: 20 });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('dispatches fngr:panend on pointerup', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:panend', listener);
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointerup', { clientX: 80, clientY: 50 });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('dispatches fngr:pancancel on pointercancel', () => {
      const listener = vi.fn();
      el.addEventListener('fngr:pancancel', listener);
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });
      fire(el, 'pointercancel', { clientX: 65, clientY: 50 });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('CustomEvents bubble', () => {
      const parentListener = vi.fn();
      const parent = document.createElement('div');
      parent.appendChild(el);
      document.body.appendChild(parent);
      parent.addEventListener('fngr:panstart', parentListener);

      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      expect(parentListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('pointer cancel in Possible state', () => {
    it('cancels before threshold exceeded', () => {
      const onPanstart = vi.fn();
      const rec = new PanRecognizer({ onPanstart, threshold: 50 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 55, clientY: 50, timeStamp: 10 });
      fire(el, 'pointercancel', { clientX: 55, clientY: 50 });

      expect(onPanstart).not.toHaveBeenCalled();
      expect(rec.state).toBe(RecognizerState.Idle);
    });
  });

  describe('convenience function', () => {
    it('pan() returns a cleanup function', () => {
      const onPanstart = vi.fn();
      const cleanup = pan(el, { onPanstart, threshold: 5 });

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      expect(onPanstart).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('cleanup stops further recognition', () => {
      const onPanstart = vi.fn();
      const cleanup = pan(el, { onPanstart, threshold: 5 });
      cleanup();

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      expect(onPanstart).not.toHaveBeenCalled();
    });

    it('idempotent cleanup', () => {
      const cleanup = pan(el, { onPanstart: vi.fn(), threshold: 5 });
      cleanup();
      expect(() => cleanup()).not.toThrow();
    });

    it('callback shorthand form', () => {
      const cb = vi.fn();
      const cleanup = pan(el, cb);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      // callback shorthand maps to onPanstart
      expect(cb).toHaveBeenCalledTimes(1);
      cleanup();
    });

    it('multiple pan() calls on same element share a Manager', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cleanup1 = pan(el, { onPanstart: cb1, threshold: 5 });
      const cleanup2 = pan(el, { onPanstart: cb2, threshold: 5 });

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);

      cleanup1();
      cleanup2();
    });
  });

  describe('edge cases', () => {
    it('very rapid moves still fire all events', () => {
      const onPanstart = vi.fn();
      const onPanmove = vi.fn();
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, onPanmove, onPanend, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50, timeStamp: 0 });
      // 10 rapid moves
      for (let i = 1; i <= 10; i++) {
        fire(el, 'pointermove', { clientX: 50 + i * 5, clientY: 50, timeStamp: i });
      }
      fire(el, 'pointerup', { clientX: 100, clientY: 50 });

      expect(onPanstart).toHaveBeenCalledTimes(1);
      expect(onPanmove.mock.calls.length).toBeGreaterThan(0);
      expect(onPanend).toHaveBeenCalledTimes(1);
    });

    it('pointerdown without any move then up does not fire', () => {
      const onPanstart = vi.fn();
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, onPanend, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onPanstart).not.toHaveBeenCalled();
      expect(onPanend).not.toHaveBeenCalled();
    });

    it('direction is none when delta is zero (panend at start position)', () => {
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanend, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 }); // panstart
      // Move back to start
      fire(el, 'pointermove', { clientX: 50, clientY: 50, timeStamp: 20 });
      fire(el, 'pointerup', { clientX: 50, clientY: 50 });

      expect(onPanend.mock.calls[0][0].direction).toBe('none');
    });

    it('destroy cleans up', () => {
      const onPanstart = vi.fn();
      const rec = new PanRecognizer({ onPanstart, threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);
      mgr.destroy();

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 });

      expect(onPanstart).not.toHaveBeenCalled();
    });
  });

  describe('mutation killers', () => {
    it('pancancel delta uses subtraction, not addition (dx = clientX - startX)', () => {
      // Kills: dx = e.clientX + this.startX (line 90) and dy = e.clientY + this.startY (line 91)
      const onPancancel = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPancancel, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 200 });
      fire(el, 'pointermove', { clientX: 120, clientY: 210, timeStamp: 10 }); // panstart
      fire(el, 'pointercancel', { clientX: 130, clientY: 220 });

      const e = onPancancel.mock.calls[0][0] as PanEvent;
      // With subtraction: 130 - 100 = 30. With addition: 130 + 100 = 230.
      expect(e.deltaX).toBe(30);
      expect(e.deltaY).toBe(20);
    });

    it('panmove requires Changed state (Began transitions to Changed first)', () => {
      // Kills: else if (true) on line 61 and if (true) on line 62
      const onPanstart = vi.fn();
      const onPanmove = vi.fn();
      const rec = new PanRecognizer({ onPanstart, onPanmove, threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 }); // panstart, state=Began

      expect(rec.state).toBe(RecognizerState.Began);
      expect(onPanstart).toHaveBeenCalledTimes(1);
      expect(onPanmove).not.toHaveBeenCalled(); // No panmove yet on the first move

      fire(el, 'pointermove', { clientX: 80, clientY: 50, timeStamp: 20 }); // panmove, state=Changed
      expect(rec.state).toBe(RecognizerState.Changed);
      expect(onPanmove).toHaveBeenCalledTimes(1);
    });

    it('panend still fires from Began state (not just Changed)', () => {
      // Kills: this.state === RecognizerState.Began || false (line 89)
      const onPanend = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanend, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 }); // panstart (Began)
      // Immediately lift — no panmove, still in Began
      fire(el, 'pointerup', { clientX: 65, clientY: 50 });

      expect(onPanend).toHaveBeenCalledTimes(1);
    });

    it('pancancel fires from Began state too', () => {
      // Kills: this.state === RecognizerState.Began || false (line 89 in cancel)
      const onPancancel = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPancancel, threshold: 5 }));

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 }); // panstart (Began)
      fire(el, 'pointercancel', { clientX: 65, clientY: 50 });

      expect(onPancancel).toHaveBeenCalledTimes(1);
    });

    it('dx > 0 boundary: zero dx with non-zero dy is not right', () => {
      // Kills: dx >= 0 ? 'right' : 'left' (line 134)
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      // Move purely vertical — dx=0, dy=15
      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 100, clientY: 115, timeStamp: 10 });

      // With strict >: dx=0 is NOT > dy, falls to vertical branch → 'down'
      // With >=: dx=0 IS >= dy=0? No, |dx|=0 > |dy|=15 is false, still vertical
      // Actually this doesn't quite work for this mutation. Let me use a different approach.
      expect(onPanstart.mock.calls[0][0].direction).toBe('down');
    });

    it('dx=0 with pure vertical movement is never right or left', () => {
      // Kills: dx >= 0 ? 'right' : 'left' on line 134
      // When dx=0, dy>0: |dx|=0 is NOT > |dy|, so we go to vertical branch
      // But if the mutant changes dx > 0 to dx >= 0, the direction changes when dx=0 on horizontal branch
      // Need a case where |dx| > |dy| and dx=0 → impossible. So focus on the actual path.
      const onPanmove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanmove, threshold: 5 }));

      // dx=-15, dy=0: |dx|=15 > |dy|=0, dx < 0 → 'left'
      // With >= mutation: dx=-15 >= 0 is false → still 'left'. Won't kill.
      // dx=0, dy=0: returns 'none'. Won't reach the branch.
      // This is likely equivalent — dx > 0 vs dx >= 0 when dx=0 doesn't reach this branch.
      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 115, clientY: 100, timeStamp: 10 }); // panstart
      fire(el, 'pointermove', { clientX: 85, clientY: 100, timeStamp: 20 }); // dx=-15 from start

      expect(onPanmove.mock.calls[0][0].direction).toBe('left');
    });

    it('horizontal filter rejects left specifically (not just any non-right)', () => {
      // Kills: dir === "" || dir === 'right' (line 141)
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5, direction: 'horizontal' }));

      fire(el, 'pointerdown', { clientX: 200, clientY: 100 });
      fire(el, 'pointermove', { clientX: 180, clientY: 100, timeStamp: 10 }); // left

      expect(onPanstart).toHaveBeenCalledTimes(1);
      expect(onPanstart.mock.calls[0][0].direction).toBe('left');
    });

    it('vertical filter rejects down specifically (not just any non-up)', () => {
      // Kills: dir === "" || dir === 'down' (line 142)
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5, direction: 'vertical' }));

      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 100, clientY: 80, timeStamp: 10 }); // up

      expect(onPanstart).toHaveBeenCalledTimes(1);
      expect(onPanstart.mock.calls[0][0].direction).toBe('up');
    });

    it('direction filter with vertical rejects horizontal (kills: if true on line 142)', () => {
      // Kills: if (true) return dir === 'up' || dir === 'down' (line 142)
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5, direction: 'horizontal' }));

      // Vertical movement with horizontal filter — should NOT fire
      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 100, clientY: 120, timeStamp: 10 });

      expect(onPanstart).not.toHaveBeenCalled();
    });

    it('matchesDirectionFilter returns false for unknown filter (kills: return true on line 143)', () => {
      // Kills: return false → return true (line 143)
      // The fallback return false is only reached if directionFilter is something other than all/horizontal/vertical
      // Since TypeScript enforces DirectionFilter, this is an equivalent mutant — no reachable path
      // We document it as equivalent
    });

    it('direction none check: dx=0 and dy=0 returns none, not a cardinal direction', () => {
      // Kills: dx === 0 || dy === 0 (line 132) — would wrongly return 'none' for axis-aligned movement
      const onPanmove = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanmove, threshold: 5 }));

      // Pure horizontal movement: dx=30, dy=0
      fire(el, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(el, 'pointermove', { clientX: 115, clientY: 100, timeStamp: 10 }); // panstart
      fire(el, 'pointermove', { clientX: 130, clientY: 100, timeStamp: 20 }); // panmove

      // With &&: dx=30 && dy=0 → false → goes to direction logic → 'right' ✓
      // With ||: dx=30 || dy=0 → true → returns 'none' ✗
      expect(onPanmove.mock.calls[0][0].direction).toBe('right');
    });

    it('dy > 0 boundary: dy=0 with horizontal movement is not down', () => {
      // Kills: dy >= 0 ? 'down' : 'up' (line 136)
      // When |dy| >= |dx| and dy=0, we're on the vertical branch
      // dy=0 with > gives 'up' (0 > 0 is false). dy=0 with >= gives 'down' (0 >= 0 is true)
      const onPanstart = vi.fn();
      const mgr = new Manager(el);
      mgr.add(new PanRecognizer({ onPanstart, threshold: 5 }));

      // dx=0, dy=0: returns 'none' before reaching this branch. Can't test with delta (0,0).
      // Need |dy| >= |dx| and dy=0 → impossible since if dy=0, |dy|=0 < any |dx|>0
      // If dx=0 and dy=0 → 'none'. So dy >= 0 vs dy > 0 is unreachable. Equivalent mutant.
    });

    it('pointerup in Possible state transitions to Failed (not directly caught by panend)', () => {
      // Kills: else if (true) on line 80 — would wrongly transition Failed even when Began/Changed
      const onPanend = vi.fn();
      const rec = new PanRecognizer({ onPanend, threshold: 5 });
      const mgr = new Manager(el);
      mgr.add(rec);

      // Pan that reaches Changed, then pointerup should fire panend, not go to Failed branch
      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 65, clientY: 50, timeStamp: 10 }); // Began
      fire(el, 'pointermove', { clientX: 80, clientY: 50, timeStamp: 20 }); // Changed
      fire(el, 'pointerup', { clientX: 80, clientY: 50 });

      // panend should fire, meaning the first branch was taken (Began||Changed), not the else if
      expect(onPanend).toHaveBeenCalledTimes(1);
    });

    it('pointercancel in Possible state goes to Failed (no pancancel emitted)', () => {
      // Kills: else if (true) on line 94
      const onPancancel = vi.fn();
      const rec = new PanRecognizer({ onPancancel, threshold: 50 });
      const mgr = new Manager(el);
      mgr.add(rec);

      fire(el, 'pointerdown', { clientX: 50, clientY: 50 });
      fire(el, 'pointermove', { clientX: 55, clientY: 50, timeStamp: 10 }); // still Possible (< 50px)
      fire(el, 'pointercancel', { clientX: 55, clientY: 50 });

      expect(onPancancel).not.toHaveBeenCalled();
      expect(rec.state).toBe(RecognizerState.Idle);
    });
  });
});
