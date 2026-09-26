/**
 * Click Action Executor (PRD FR-207, TRD §6.5).
 * Dispatches the normative 8-event pointer+mouse sequence with stability check.
 */

import type { ToolError } from '@tether/protocol';
import type { NodeHandle } from '../refs/types.js';
import { debugLogger } from '../session/debug-logger.js';
import { guardCovered, result, stable } from './common.js';
import type { ActionResult, ClickOpts } from './types.js';

export async function click(handle: NodeHandle, opts: ClickOpts = {}): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const el = handle.node as HTMLElement;

  if (el.scrollIntoView) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior });
  }

  await stable(el);

  if (!guardCovered(el)) {
    const error: ToolError = {
      code: 'REF_STALE',
      message: `Element for ref "${handle.ref}" is covered by an overlay`,
      hint: 'Dismiss or close the overlay before attempting to click the element',
      retryable: false,
    };
    throw error;
  }

  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const win = el.ownerDocument?.defaultView ?? globalThis.window;

  const init: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: win as Window,
    clientX: x,
    clientY: y,
    button: opts.button ?? 0,
    ctrlKey: !!opts.modifiers?.ctrl,
    metaKey: !!opts.modifiers?.meta,
    shiftKey: !!opts.modifiers?.shift,
    altKey: !!opts.modifiers?.alt,
  };

  el.dispatchEvent(new PointerEvent('pointerover', init));
  el.dispatchEvent(new PointerEvent('pointerenter', { ...init, bubbles: false }));
  el.dispatchEvent(new PointerEvent('pointerdown', init));
  el.dispatchEvent(new MouseEvent('mousedown', init));

  if (typeof el.focus === 'function') {
    el.focus({ preventScroll: true });
  }

  el.dispatchEvent(new PointerEvent('pointerup', init));
  el.dispatchEvent(new MouseEvent('mouseup', init));
  el.dispatchEvent(new MouseEvent('click', init));
  debugLogger.logDomOperation('click', el, { button: opts.button ?? 0, ref: handle.ref });

  return result(el, 'click', handle.ref, start);
}
