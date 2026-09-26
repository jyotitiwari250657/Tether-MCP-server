// @vitest-environment happy-dom
/**
 * Target Tab Resolution and Injection Tests (TRD §6.3, PRD HR-6, HR-11).
 * Verifies scheme validation, automatic injection, permission fallback, and TAB_GONE handling.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ensureInjected, isForbiddenUrl, resolveTargetTab } from '../../lib/session/target.js';

describe('Target Tab Validation and Injection (Prompt 09-FIX-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. chrome://newtab -> UNSUPPORTED_FRAME, fast (< 50 ms)
  test('chrome://newtab returns UNSUPPORTED_FRAME immediately', async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      windows: {
        getLastFocused: vi.fn().mockResolvedValue({
          tabs: [{ id: 1, active: true, url: 'chrome://newtab' }],
        }),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1, active: true, url: 'chrome://newtab' }]),
      },
      extension: {
        isAllowedFileSchemeAccess: vi.fn().mockResolvedValue(false),
      },
    };

    const t0 = performance.now();
    const res = await resolveTargetTab();
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(50);
    expect('code' in res).toBe(true);
    if ('code' in res) {
      expect(res.code).toBe('UNSUPPORTED_FRAME');
      expect(res.hint).toContain('Switch to a normal http(s) page');
      expect(res.retryable).toBe(false);
    }
  });

  // 2. webstore URL -> UNSUPPORTED_FRAME
  test('Chrome Web Store URL returns UNSUPPORTED_FRAME immediately', async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      windows: {
        getLastFocused: vi.fn().mockResolvedValue({
          tabs: [{ id: 2, active: true, url: 'https://chromewebstore.google.com/detail/sample' }],
        }),
      },
      tabs: {
        query: vi
          .fn()
          .mockResolvedValue([
            { id: 2, active: true, url: 'https://chromewebstore.google.com/detail/sample' },
          ]),
      },
    };

    const res = await resolveTargetTab();
    expect('code' in res).toBe(true);
    if ('code' in res) {
      expect(res.code).toBe('UNSUPPORTED_FRAME');
      expect(res.retryable).toBe(false);
    }
  });

  // 3. http tab with pong -> injected true, no executeScript call
  test('http tab with pong returns injected true without executeScript', async () => {
    const executeScriptMock = vi.fn();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        sendMessage: vi.fn().mockResolvedValue({ pong: true }),
      },
      scripting: {
        executeScript: executeScriptMock,
      },
    };

    const res = await ensureInjected(42);
    expect(res).toBe(true);
    expect(executeScriptMock).not.toHaveBeenCalled();
  });

  // 4. no pong + executeScript ok -> injected true
  test('no pong + executeScript ok returns injected true', async () => {
    const executeScriptMock = vi.fn().mockResolvedValue([{ result: true }]);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        sendMessage: vi.fn().mockRejectedValue(new Error('Receiving end does not exist')),
      },
      scripting: {
        executeScript: executeScriptMock,
      },
    };

    const res = await ensureInjected(42);
    expect(res).toBe(true);
    expect(executeScriptMock).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ['content-scripts/content.js'],
    });
  });

  // 5. no pong + executeScript permission rejection -> PERMISSION_REQUIRED with hint
  test('no pong + executeScript permission rejection returns PERMISSION_REQUIRED', async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        sendMessage: vi.fn().mockRejectedValue(new Error('Receiving end does not exist')),
      },
      scripting: {
        executeScript: vi
          .fn()
          .mockRejectedValue(
            new Error(
              'Cannot access contents of url "https://example.com/". Extension manifest must request permission to access the respective host.',
            ),
          ),
      },
    };

    const res = await ensureInjected(42);
    expect(res).not.toBe(true);
    if (res !== true) {
      expect(res.code).toBe('PERMISSION_REQUIRED');
      expect(res.hint).toContain(
        'Click the Tether toolbar icon on this tab and press "Enable Site Access & Inject"',
      );
      expect(res.retryable).toBe(false);
    }
  });

  // 6. tab closed mid-resolve -> TAB_GONE
  test('tab closed mid-resolve returns TAB_GONE', async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        get: vi.fn().mockRejectedValue(new Error('No tab with id: 999')),
      },
    };

    const res = await resolveTargetTab('999');
    expect('code' in res).toBe(true);
    if ('code' in res) {
      expect(res.code).toBe('TAB_GONE');
      expect(res.retryable).toBe(true);
    }
  });

  test('isForbiddenUrl correctly flags internal and restricted protocols', () => {
    expect(isForbiddenUrl('chrome://extensions')).toBe(true);
    expect(isForbiddenUrl('chrome-extension://abcdef/popup.html')).toBe(true);
    expect(isForbiddenUrl('about:blank')).toBe(true);
    expect(isForbiddenUrl('devtools://devtools/bundled/inspector.html')).toBe(true);
    expect(isForbiddenUrl('edge://settings')).toBe(true);
    expect(isForbiddenUrl('view-source:https://example.com')).toBe(true);
    expect(isForbiddenUrl('file:///C:/Users/file.html', false)).toBe(true);
    expect(isForbiddenUrl('file:///C:/Users/file.html', true)).toBe(false);
    expect(isForbiddenUrl('https://example.com')).toBe(false);
  });
});
