/**
 * Form Element Actions (PRD FR-207..FR-210, TRD §6.5).
 * Select dropdown values and dispatch keyboard events.
 */

import type { NodeHandle } from '../refs/types.js';
import { result } from './common.js';
import type { ActionResult, PressKeyOpts, SelectOpts } from './types.js';

export async function select(handle: NodeHandle, opts: SelectOpts = {}): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const selectEl = handle.node as HTMLSelectElement;
  const options = Array.from(selectEl.options ?? []);

  let matchedOption: HTMLOptionElement | undefined = undefined;

  if (opts.value !== undefined) {
    matchedOption = options.find((opt) => opt.value === opts.value);
  } else if (opts.label !== undefined) {
    matchedOption = options.find((opt) => (opt.textContent ?? '').trim() === opts.label);
  } else if (opts.index !== undefined && opts.index >= 0 && opts.index < options.length) {
    matchedOption = options[opts.index];
  }

  if (matchedOption) {
    for (const opt of options) {
      opt.selected = false;
    }
    matchedOption.selected = true;
    selectEl.value = matchedOption.value;
    selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return result(selectEl, 'select', handle.ref, start);
}

export async function pressKey(handle: NodeHandle, opts: PressKeyOpts): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const el = handle.node as HTMLElement;

  const init: KeyboardEventInit = {
    key: opts.key,
    bubbles: true,
    cancelable: true,
    ctrlKey: !!opts.modifiers?.ctrl,
    metaKey: !!opts.modifiers?.meta,
    shiftKey: !!opts.modifiers?.shift,
    altKey: !!opts.modifiers?.alt,
  };

  el.dispatchEvent(new KeyboardEvent('keydown', init));
  if (opts.key.length === 1) {
    el.dispatchEvent(new KeyboardEvent('keypress', init));
  }
  el.dispatchEvent(new KeyboardEvent('keyup', init));

  return result(el, 'pressKey', handle.ref, start);
}
