/**
 * browser_screenshot Action (TOOL-R03, T0 — Prompt 11 §3, PRD SEC-05).
 * 1. Captures the visible tab via chrome.tabs.captureVisibleTab.
 * 2. Default-on OCR redaction through the daemon (opts.ocrRedact !== false).
 * 3. Returns { dataUrl, trust:'untrusted', ocrRedactionHits, ocrDegraded }.
 *
 * AC-P11-02: ocrRedact:false skips the daemon entirely and returns the
 * original capture.
 */

import { type RedactStyle, redactScreenshot } from '../ocr/client.js';
import type { TransportClient } from '../transport/client.js';

export interface ScreenshotOpts {
  ref?: string | undefined;
  fullPage?: boolean | undefined;
  ocrRedact?: boolean | undefined;
  redactStyle?: RedactStyle | undefined;
  tab?: string | undefined;
}

export interface ScreenshotResult {
  dataUrl: string;
  trust: 'untrusted';
  ocrRedactionHits: number;
  ocrDegraded: boolean;
}

type CaptureFn = (windowId: number, opts: { format: 'png' }) => Promise<string>;

/** Resolves the capture implementation (injectable for tests). */
export function resolveCaptureFn(): CaptureFn | null {
  if (typeof chrome !== 'undefined' && chrome.tabs?.captureVisibleTab) {
    return (windowId, opts) =>
      chrome.tabs.captureVisibleTab(windowId, opts) as unknown as Promise<string>;
  }
  return null;
}

export async function screenshot(
  opts: ScreenshotOpts,
  transport: TransportClient | null,
  captureFn: CaptureFn | null = resolveCaptureFn(),
): Promise<ScreenshotResult> {
  if (!captureFn) {
    throw {
      code: 'PERMISSION_REQUIRED',
      message: 'Screenshot capture is unavailable in this context.',
      hint: 'Grant site access, or retry on a normal http(s) tab.',
      retryable: true,
    };
  }

  let windowId = -2; // chrome.windows.WINDOW_ID_CURRENT
  try {
    if (typeof chrome !== 'undefined' && chrome.windows?.getLastFocused) {
      const win = await chrome.windows.getLastFocused();
      if (win?.id !== undefined) windowId = win.id;
    }
  } catch {
    windowId = -2;
  }

  let dataUrl: string;
  try {
    dataUrl = await captureFn(windowId, { format: 'png' });
  } catch (err) {
    throw {
      code: 'PERMISSION_REQUIRED',
      message: 'Failed to capture the visible tab.',
      hint: 'Click the Tether toolbar icon on this tab and enable site access, then retry.',
      retryable: true,
      details: { reason: err instanceof Error ? err.message.slice(0, 80) : 'capture-error' },
    };
  }

  // AC-P11-02: explicit opt-out returns the raw capture untouched.
  if (opts.ocrRedact === false || !transport) {
    return { dataUrl, trust: 'untrusted', ocrRedactionHits: 0, ocrDegraded: false };
  }

  const res = await redactScreenshot(transport, dataUrl, {
    ...(opts.redactStyle !== undefined ? { redactStyle: opts.redactStyle } : {}),
  });

  return {
    dataUrl: res.redactedDataUrl,
    trust: 'untrusted',
    ocrRedactionHits: res.hits.length,
    ocrDegraded: res.degraded,
  };
}
