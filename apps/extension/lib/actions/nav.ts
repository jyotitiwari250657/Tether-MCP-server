/**
 * Navigation and Tabs Actions (PRD FR-207, FR-210, TRD §6.5).
 */

import type { ToolError } from '@tether/protocol';
import { result } from './common.js';
import type { ActionResult, NavigateOpts, TabsAction } from './types.js';

export async function navigate(opts: NavigateOpts): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const doc = globalThis.document;

  if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
    if (opts.tab) {
      await chrome.tabs.update(Number.parseInt(opts.tab, 10), { url: opts.url });
    } else {
      await chrome.tabs.update({ url: opts.url });
    }
  } else if (globalThis.window?.location) {
    globalThis.window.location.href = opts.url;
  }

  const el = doc?.body ?? doc?.documentElement;
  return result(el, 'navigate', 'A1', start);
}

/**
 * Tab management actions. Closing a tab is a T2 action requiring user confirmation (AC-P05-17).
 */
export async function tabs(action: TabsAction): Promise<ActionResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;

  if (action.action === 'close') {
    const error: ToolError = {
      code: 'NEEDS_CONFIRMATION',
      message: `Tab closure (tabId: ${action.tabId ?? 'current'}) requires confirmation`,
      hint: 'Closing a tab is a T2 destructive action requiring user approval diff (PRD HR-8)',
      retryable: false,
    };
    throw error;
  }

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    if (action.action === 'new') {
      await chrome.tabs.create({});
    } else if (action.action === 'select' && action.tabId) {
      await chrome.tabs.update(action.tabId, { active: true });
    } else if (action.action === 'duplicate' && action.tabId) {
      await chrome.tabs.duplicate(action.tabId);
    }
  }

  const doc = globalThis.document;
  const el = doc?.body ?? doc?.documentElement;
  return result(el, 'tabs', 'A1', start);
}
