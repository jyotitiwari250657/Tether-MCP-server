/**
 * Scroll and Hover Actions (PRD FR-207, TRD §6.5).
 */

import { liveNodeMap, liveRefMap } from '../refs/snapshot.js';
import type { NodeHandle } from '../refs/types.js';
import { result } from './common.js';
import type { ActionResult, ScrollOpts } from './types.js';

export async function scroll(opts: ScrollOpts = {}): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const doc = globalThis.document;
  const win = doc?.defaultView ?? globalThis.window;

  let targetEl: Element = doc?.body ?? doc?.documentElement;
  let targetRef = 'A1';

  if (opts.ref) {
    const entry = liveRefMap.get(opts.ref);
    const el = entry ? liveNodeMap.get(entry.nodeId) : null;
    if (el) {
      targetEl = el;
      targetRef = opts.ref;
      if (el.scrollIntoView) {
        el.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'instant' as ScrollBehavior,
        });
      }
      return result(targetEl, 'scroll', targetRef, start);
    }
  }

  const amount = opts.amount ?? 300;
  let dx = 0;
  let dy = 0;

  switch (opts.direction) {
    case 'up':
      dy = -amount;
      break;
    case 'left':
      dx = -amount;
      break;
    case 'right':
      dx = amount;
      break;
    default:
      dy = amount;
      break;
  }

  if (typeof win?.scrollBy === 'function') {
    win.scrollBy({ left: dx, top: dy, behavior: 'instant' as ScrollBehavior });
  }

  return result(targetEl, 'scroll', targetRef, start);
}

export async function hover(handle: NodeHandle): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const el = handle.node as HTMLElement;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;

  const win = (el.ownerDocument?.defaultView ?? null) as Window | null;

  const init: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    view: win,
  };

  el.dispatchEvent(new PointerEvent('pointerover', init));
  el.dispatchEvent(new PointerEvent('pointerenter', { ...init, bubbles: false }));
  el.dispatchEvent(new MouseEvent('mouseover', init));
  el.dispatchEvent(new MouseEvent('mousemove', init));

  return result(el, 'hover', handle.ref, start);
}
