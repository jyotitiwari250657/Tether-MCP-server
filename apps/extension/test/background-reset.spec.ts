// @vitest-environment happy-dom
/**
 * Prompt 12 AC-P12-01 (PRD HR-10): user-gesture kill-switch reset flow.
 * Extracted from background.spec.ts for the TRD §4.3 300-line cap.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import backgroundEntry, { transport } from '../entrypoints/background.js';

describe('Background kill-switch reset flow (AC-P12-01, HR-10)', () => {
  beforeEach(() => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        session: {
          get: vi.fn(async (key: string) => ({ [key]: undefined })),
          set: vi.fn(async () => {}),
          remove: vi.fn(async () => {}),
        },
        local: {
          get: vi.fn(async (key: string) => ({ [key]: undefined })),
          set: vi.fn(async () => {}),
        },
      },
      runtime: {
        sendMessage: vi.fn(),
        onConnect: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
      },
      alarms: {
        onAlarm: { addListener: vi.fn() },
      },
    };
  });

  /** Registers the background onMessage listener and returns the invocation hook. */
  const captureMessageHandler = (): ((msg: unknown) => {
    isAsync: boolean;
    respond: () => Promise<unknown>;
  }) => {
    let handler: ((m: unknown, s: unknown, cb: (r: unknown) => void) => boolean) | null = null;
    const chromeObj = globalThis as unknown as {
      chrome: {
        runtime: {
          onMessage: {
            addListener: (
              fn: (m: unknown, s: unknown, cb: (r: unknown) => void) => boolean,
            ) => void;
          };
        };
      };
    };
    chromeObj.chrome.runtime.onMessage = {
      addListener: (fn) => {
        handler = fn;
      },
    };
    const entry = backgroundEntry as unknown as { main?: () => void } | (() => void);
    if (typeof entry === 'function') entry();
    else if (typeof entry?.main === 'function') entry.main();

    return (msg: unknown) => {
      let response: unknown;
      const sendResponse = (r: unknown): void => {
        response = r;
      };
      const isAsync = handler?.(msg, {}, sendResponse) ?? false;
      return { isAsync, respond: async () => response };
    };
  };

  test('AC-P12-01: reset_kill_switch user gesture forwards {type:reset_kill_switch} to daemon', async () => {
    const invoke = captureMessageHandler();
    const ensureSpy = vi.spyOn(transport, 'ensureConnected').mockResolvedValue();
    const sendControlSpy = vi.spyOn(transport, 'sendControl').mockImplementation(() => true);

    const { isAsync, respond } = invoke({ type: 'reset_kill_switch' });
    expect(isAsync).toBe(true);
    await new Promise((r) => setTimeout(r, 10));

    expect(ensureSpy).toHaveBeenCalled();
    expect(sendControlSpy).toHaveBeenCalledWith({ type: 'reset_kill_switch' });
    expect(await respond()).toEqual({ ok: true });
    ensureSpy.mockRestore();
    sendControlSpy.mockRestore();
  });

  test('AC-P12-01: reset_kill_switch reports ok:false when the daemon is unreachable (HR-10)', async () => {
    const invoke = captureMessageHandler();
    const ensureSpy = vi.spyOn(transport, 'ensureConnected').mockResolvedValue();
    const sendControlSpy = vi.spyOn(transport, 'sendControl').mockImplementation(() => false);

    const { respond } = invoke({ type: 'reset_kill_switch' });
    await new Promise((r) => setTimeout(r, 10));

    expect(await respond()).toEqual({ ok: false });
    ensureSpy.mockRestore();
    sendControlSpy.mockRestore();
  });
});
