/**
 * Target Tab Resolution, Validation, and Injection (TRD §6.3, PRD HR-6, HR-11).
 * Validates schemes, prevents hangs on restricted URLs, and injects content bridge.
 */

import type { ToolError } from '@tether/protocol';

const FORBIDDEN_SCHEMES = [
  'chrome:',
  'chrome-extension:',
  'about:',
  'devtools:',
  'edge:',
  'moz-extension:',
  'view-source:',
];

const DOM_TOOLS = new Set([
  'browser_snapshot',
  'browser_find',
  'browser_click',
  'browser_type',
  'browser_press_key',
  'browser_select',
  'browser_select_option',
  'browser_scroll',
  'browser_hover',
  'browser_drag',
  'browser_wait',
  'browser_wait_for',
  'browser_submit',
  'browser_type_secret',
  'browser_get_text',
  'browser_fill_form',
  'browser_extract',
]);

export function isDomTool(tool: string): boolean {
  return DOM_TOOLS.has(tool);
}

export function isForbiddenUrl(urlString: string, allowFile = false): boolean {
  if (!urlString) return false;
  const lower = urlString.trim().toLowerCase();
  if (FORBIDDEN_SCHEMES.some((s) => lower.startsWith(s))) return true;
  if (!allowFile && lower.startsWith('file:')) return true;
  return (
    lower.includes('chromewebstore.google.com') || lower.includes('chrome.google.com/webstore')
  );
}

export async function resolveTargetTab(
  tabArg?: string,
): Promise<{ tabId: number; url: string } | ToolError> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return { tabId: 0, url: 'http://localhost' };
  }

  let tab: chrome.tabs.Tab | undefined;

  if (tabArg !== undefined && tabArg !== null && tabArg !== '') {
    const parsedId = Number.parseInt(tabArg, 10);
    if (!Number.isNaN(parsedId)) {
      try {
        tab = await chrome.tabs.get(parsedId);
      } catch {
        return {
          code: 'TAB_GONE',
          message: `Target tab ${tabArg} not found or closed.`,
          hint: 'The specified tab was closed or does not exist',
          retryable: true,
        };
      }
    }
  }

  if (!tab) {
    try {
      if (chrome.windows?.getLastFocused) {
        const win = await chrome.windows.getLastFocused({ populate: true });
        tab = win?.tabs?.find((t) => t.active);
      }
      if (!tab && chrome.tabs.query) {
        const all = await chrome.tabs.query({});
        const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        tab = t ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
        if (!tab || (tab.url && isForbiddenUrl(tab.url))) {
          tab = all.find((x) => x.id && (!x.url || !isForbiddenUrl(x.url))) ?? tab;
        }
      }
    } catch {
      return {
        code: 'TAB_GONE',
        message: 'Failed to resolve active tab.',
        hint: 'Open a tab in Chrome first',
        retryable: true,
      };
    }
  }

  if (!tab || tab.id === undefined) {
    return {
      code: 'TAB_GONE',
      message: 'No active tab found.',
      hint: 'Open a tab in Chrome first',
      retryable: true,
    };
  }

  let url = tab.url || tab.pendingUrl || '';

  if (!url && tab.id && typeof chrome !== 'undefined') {
    try {
      const pingPromise = chrome.tabs.sendMessage(tab.id, { type: 'tether_ping' });
      const timeoutPromise = new Promise<{ url?: string }>((r) => setTimeout(() => r({}), 300));
      const ping = await Promise.race([pingPromise, timeoutPromise]);
      if (ping?.url) url = ping.url;
    } catch {}
    if (!url && chrome.scripting?.executeScript) {
      try {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.location.href,
        });
        if (typeof res?.result === 'string') url = res.result;
      } catch {}
    }
  }

  let allowFile = false;
  if (url.toLowerCase().startsWith('file:')) {
    try {
      if (chrome.extension?.isAllowedFileSchemeAccess) {
        allowFile = await chrome.extension.isAllowedFileSchemeAccess();
      }
    } catch {
      allowFile = false;
    }
  }

  if (isForbiddenUrl(url, allowFile)) {
    return {
      code: 'UNSUPPORTED_FRAME',
      message: `Cannot automate tab with URL: ${url}`,
      hint: 'This page type cannot be automated. Switch to a normal http(s) page.',
      retryable: false,
    };
  }

  return { tabId: tab.id, url };
}

export async function ensureInjected(tabId: number): Promise<true | ToolError> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) return true;

  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'tether_ping' });
    if (res?.pong) return true;
  } catch {}

  if (!chrome.scripting?.executeScript) return true;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content.js'],
    });
    return true;
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    const isPerm = /cannot access|permission|host|denied|not allowed|access/.test(msg);
    return isPerm
      ? {
          code: 'PERMISSION_REQUIRED',
          message: 'Permission required to access and inject into target tab.',
          hint: 'Click the Tether toolbar icon on this tab and press "Enable Site Access & Inject", or grant persistent site access in the popup.',
          retryable: false,
        }
      : {
          code: 'TAB_GONE',
          message: `Target tab ${tabId} is unavailable: ${msg}`,
          hint: 'The target tab was closed or is no longer available.',
          retryable: true,
        };
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError?: ToolError,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        timeoutError ?? {
          code: 'TIMEOUT',
          message: `Operation timed out after ${ms}ms`,
          hint: 'Extension-side budget exceeded; retry or use browser_task_start.',
          retryable: true,
        },
      );
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}
