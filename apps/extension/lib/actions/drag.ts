/**
 * Drag and Drop Action Executor (PRD FR-207, TRD §6.5).
 */

import type { NodeHandle } from '../refs/types.js';
import { result } from './common.js';
import type { ActionResult } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function drag(from: NodeHandle, to: NodeHandle): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const fromEl = from.node as HTMLElement;
  const toEl = to.node as HTMLElement;

  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();

  const startX = fromRect.left + fromRect.width / 2;
  const startY = fromRect.top + fromRect.height / 2;
  const endX = toRect.left + toRect.width / 2;
  const endY = toRect.top + toRect.height / 2;

  const doc = fromEl.ownerDocument ?? globalThis.document;

  fromEl.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: startX,
      clientY: startY,
      button: 0,
    }),
  );

  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const currX = startX + ((endX - startX) * i) / steps;
    const currY = startY + ((endY - startY) * i) / steps;
    doc.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: currX,
        clientY: currY,
        button: 0,
      }),
    );
    await sleep(8);
  }

  toEl.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      clientX: endX,
      clientY: endY,
      button: 0,
    }),
  );

  return result(toEl, 'drag', to.ref, start);
}
