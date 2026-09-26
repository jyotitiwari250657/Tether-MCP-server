/**
 * Wait Action Executor (PRD FR-209, TRD §6.5).
 * Polls exclusively via MutationObserver + requestAnimationFrame. Zero setInterval calls (AC-P05-15).
 */

import type { ToolError } from '@tether/protocol';
import { result } from './common.js';
import type { ActionResult, WaitForOpts } from './types.js';

export async function waitFor(opts: WaitForOpts = {}): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const doc = globalThis.document;
  const win = doc?.defaultView ?? globalThis;

  function checkMatch(): Element | null {
    if (!doc) return null;
    if (opts.selector) {
      const match = doc.querySelector(opts.selector);
      if (match) return match;
    }
    if (opts.text) {
      const textLower = opts.text.toLowerCase();
      if ((doc.body?.textContent ?? '').toLowerCase().includes(textLower)) {
        return doc.body;
      }
    }
    return null;
  }

  // Immediate check before setting up observers
  const immediate = checkMatch();
  if (immediate) {
    return result(immediate, 'waitFor', 'A1', start);
  }

  return new Promise<ActionResult>((resolve, reject) => {
    let resolved = false;
    let observer: MutationObserver | null = null;
    let rafHandle: number | null = null;
    let timerHandle: ReturnType<typeof setTimeout> | null = null;

    function cleanup(): void {
      resolved = true;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (rafHandle !== null && win.cancelAnimationFrame) {
        win.cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      if (timerHandle !== null) {
        clearTimeout(timerHandle);
        timerHandle = null;
      }
    }

    function tryResolve(): void {
      if (resolved) return;
      const el = checkMatch();
      if (el) {
        cleanup();
        resolve(result(el, 'waitFor', 'A1', start));
      }
    }

    // Set up MutationObserver
    if (typeof MutationObserver !== 'undefined' && doc?.body) {
      observer = new MutationObserver(() => {
        tryResolve();
      });
      observer.observe(doc.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    // Also poll via requestAnimationFrame
    const raf = win.requestAnimationFrame?.bind(win);
    function onFrame(): void {
      if (resolved) return;
      tryResolve();
      if (!resolved && raf) {
        rafHandle = raf(onFrame);
      }
    }
    if (raf) {
      rafHandle = raf(onFrame);
    }

    // Single timeout timer
    timerHandle = setTimeout(() => {
      cleanup();
      const err: ToolError = {
        code: 'TIMEOUT',
        message: `Timed out waiting for ${opts.selector ?? opts.text ?? 'condition'} after ${timeoutMs}ms`,
        hint: 'Increase timeoutMs or verify selector/text is rendered on the target page',
        retryable: true,
      };
      reject(err);
    }, timeoutMs);
  });
}
