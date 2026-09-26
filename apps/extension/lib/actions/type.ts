/**
 * Type & Form Value Actions (PRD FR-208, TRD §6.5).
 * Implements React-compatible value setter and human-like typing jitter.
 */

import type { ToolError } from '@tether/protocol';
import { resolve } from '../refs/resolve.js';
import { liveNodeMap, liveRefMap } from '../refs/snapshot.js';
import type { NodeHandle } from '../refs/types.js';
import { debugLogger } from '../session/debug-logger.js';
import { result } from './common.js';
import type { ActionResult, FillFormEntry, TypeOpts } from './types.js';

export type InputLikeElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Resolves an element or label to its associated input/textarea/select element.
 */
export function resolveInputTarget(node: Element): InputLikeElement | null {
  const win = node.ownerDocument?.defaultView ?? globalThis;
  const isInput =
    (win as typeof globalThis).HTMLInputElement &&
    node instanceof (win as typeof globalThis).HTMLInputElement;
  const isTextArea =
    (win as typeof globalThis).HTMLTextAreaElement &&
    node instanceof (win as typeof globalThis).HTMLTextAreaElement;
  const isSelect =
    (win as typeof globalThis).HTMLSelectElement &&
    node instanceof (win as typeof globalThis).HTMLSelectElement;

  if (isInput || isTextArea || isSelect) {
    return node as InputLikeElement;
  }

  if (node.tagName === 'LABEL') {
    const label = node as HTMLLabelElement;
    debugLogger.logDomOperation('traverse_label', label, { htmlFor: label.htmlFor });
    if (label.control) {
      return label.control as InputLikeElement;
    }
    if (label.htmlFor) {
      const byId = label.ownerDocument?.getElementById(label.htmlFor);
      if (byId) return byId as InputLikeElement;
    }
    const child = label.querySelector('input, textarea, select');
    if (child) return child as InputLikeElement;
    if (
      label.nextElementSibling &&
      /INPUT|TEXTAREA|SELECT/i.test(label.nextElementSibling.tagName)
    ) {
      return label.nextElementSibling as InputLikeElement;
    }
  }

  // If node is a form or container, resolve first editable input
  const nested = node.querySelector('input:not([type="hidden"]), textarea, select');
  if (nested) {
    debugLogger.logDomOperation('traverse_container_to_input', node, { inputId: nested.id });
    return nested as InputLikeElement;
  }

  return null;
}

/**
 * Waits up to timeoutMs for element to become enabled and visible.
 */
export async function waitForReady(el: Element, timeoutMs = 500): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const disabled =
      (el as HTMLInputElement).disabled || el.getAttribute('aria-disabled') === 'true';
    const isHidden =
      (el as HTMLElement).offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML';
    if (!disabled && !isHidden) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

/**
 * React/Vue compatible value setter using native prototype descriptor (PRD FR-208).
 */
export function setValue(el: InputLikeElement, v: string): void {
  try {
    const win = el.ownerDocument?.defaultView ?? globalThis;
    const tag = el.tagName?.toUpperCase();
    const proto =
      tag === 'TEXTAREA'
        ? (win as typeof globalThis).HTMLTextAreaElement?.prototype
        : tag === 'SELECT'
          ? (win as typeof globalThis).HTMLSelectElement?.prototype
          : (win as typeof globalThis).HTMLInputElement?.prototype;

    const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
    if (descriptor?.set) {
      descriptor.set.call(el, v);
    } else {
      (el as HTMLInputElement).value = v;
    }
  } catch {
    try {
      (el as HTMLInputElement).value = v;
    } catch {
      el.textContent = v;
    }
  }

  try {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  } catch {}

  debugLogger.logDomOperation('value_set', el, { value: v });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Types text into an input element with human jitter (18-45ms) and key events (TRD §6.5).
 */
export async function type(handle: NodeHandle, opts: TypeOpts): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const target = handle.node as HTMLElement;
  const el = resolveInputTarget(target) ?? (target as InputLikeElement);

  await waitForReady(el, 500);

  if (opts.clear) {
    setValue(el, '');
  }

  let accumulated = (el as HTMLInputElement).value ?? '';
  for (const char of opts.text) {
    const jitter = opts.jitterMs ?? Math.floor(18 + Math.random() * 28);
    if (jitter > 0) {
      await sleep(jitter);
    }

    el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));

    accumulated += char;
    setValue(el, accumulated);

    el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
  }

  debugLogger.logDomOperation('type', el, {
    text: opts.text,
    value: (el as HTMLInputElement).value,
  });
  return result(el, 'type', handle.ref, start);
}

/**
 * Multi-field form filler (TOOL-A04, PRD FR-208, AC-P05-16).
 */
export async function fillForm(
  entries: FillFormEntry[],
): Promise<ActionResult & { count: number }> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;

  for (const entry of entries) {
    if (entry.secretId) {
      const error: ToolError = {
        code: 'NEEDS_CONFIRMATION',
        message: `Field "${entry.ref}" requires resolving secret "${entry.secretId}" from vault`,
        hint: 'Secret insertion requires explicit per-action user confirmation (PRD HR-7, HR-8)',
        retryable: false,
      };
      throw error;
    }
  }

  let lastElement: Element | null = null;
  let lastRef = 'A1';
  let count = 0;

  for (const entry of entries) {
    let el: Element | null = null;
    const refRes = await resolve(entry.ref);
    if (refRes.ok) {
      el = refRes.handle.node;
    } else {
      const refEntry = liveRefMap.get(entry.ref);
      el = refEntry ? (liveNodeMap.get(refEntry.nodeId) ?? null) : null;
    }

    if (el) {
      const targetInput = resolveInputTarget(el) ?? (el as InputLikeElement);
      await waitForReady(targetInput, 500);
      setValue(targetInput, entry.value ?? '');
      lastElement = targetInput;
      lastRef = entry.ref;
      count++;
    }
  }

  const fallback = lastElement ?? globalThis.document?.body;
  const res = result(fallback, 'fillForm', lastRef, start);
  return { ...res, count };
}
