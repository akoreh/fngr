export interface FireOptions {
  pointerId?: number;
  clientX?: number;
  clientY?: number;
  pointerType?: string;
  isPrimary?: boolean;
  button?: number;
  buttons?: number;
  timeStamp?: number;
}

export function fire(el: Element, type: string, opts: FireOptions = {}): PointerEvent {
  const event = new PointerEvent(type, {
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    pointerType: opts.pointerType ?? 'touch',
    isPrimary: opts.isPrimary ?? true,
    button: opts.button ?? 0,
    buttons: opts.buttons ?? (type === 'pointerup' || type === 'pointercancel' ? 0 : 1),
    bubbles: true,
    cancelable: true,
  });
  if (opts.timeStamp !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: opts.timeStamp });
  }
  el.dispatchEvent(event);
  return event;
}

export function simulateTap(el: Element, opts: FireOptions = {}): void {
  fire(el, 'pointerdown', opts);
  fire(el, 'pointerup', opts);
}

export function simulateMove(
  el: Element,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number = 5,
  opts: Omit<FireOptions, 'clientX' | 'clientY'> = {},
): void {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fire(el, 'pointermove', {
      ...opts,
      clientX: from.x + (to.x - from.x) * t,
      clientY: from.y + (to.y - from.y) * t,
    });
  }
}
