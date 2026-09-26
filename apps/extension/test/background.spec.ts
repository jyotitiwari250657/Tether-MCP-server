// @vitest-environment happy-dom
/**
 * Service Worker Tool Router & Idempotency Tests (PRD FR-101..FR-104, TRD §6.1).
 */

import type { Req } from '@tether/protocol';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import backgroundEntry, { handleToolRequest, transport } from '../entrypoints/background.js';
import { bootstrap } from '../lib/boot/bootstrap.js';
import { clearNodeRegistries } from '../lib/refs/snapshot.js';

function makeReq(partial: Partial<Req> & { tool: string }): Req {
  return {
    v: 1,
    id: partial.id ?? 'req-1',
    session: partial.session ?? 'sess-1',
    ts: Date.now(),
    kind: 'req',
    token: 'token-test',
    idem: partial.idem ?? '',
    budgetMs: 5000,
    tool: partial.tool,
    args: partial.args ?? {},
  };
}

describe('Background Router & Idempotency Cache (AC-P05-18, AC-P05-19, HR-11)', () => {
  const sessionStore: Record<string, unknown> = {};

  beforeEach(() => {
    clearNodeRegistries();
    document.body.innerHTML = '<div><button id="main-btn">Hello</button></div>';

    // Mock chrome.storage.session and local
    for (const k of Object.keys(sessionStore)) {
      delete sessionStore[k];
    }
    const localStore: Record<string, unknown> = {
      'policy:store': {
        version: '1.0.0',
        rules: [
          {
            id: 'allow-all',
            match: { kind: 'all', value: '<all>' },
            level: 'WRITE',
            scope: 'persistent',
            actor: 'user',
            createdAt: Date.now(),
          },
        ],
      },
    };
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        session: {
          get: vi.fn(async (key: string | string[]) => {
            if (Array.isArray(key)) {
              const res: Record<string, unknown> = {};
              for (const k of key) res[k] = sessionStore[k];
              return res;
            }
            return { [key]: sessionStore[key] };
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(sessionStore, items);
          }),
          remove: vi.fn(async (key: string) => {
            delete sessionStore[key];
          }),
        },
        local: {
          get: vi.fn(async (key: string) => ({ [key]: localStore[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(localStore, items);
          }),
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

  // 1. Routes browser_snapshot
  test('AC-P05-18: routes browser_snapshot and returns SnapshotResult', async () => {
    const req = makeReq({
      id: 'req-1',
      tool: 'browser_snapshot',
    });

    const res = await handleToolRequest(req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect((res.result as { tree: string }).tree).toContain('button "Hello"');
    }
  });

  // 2. Routes browser_find
  test('AC-P05-18: routes browser_find and returns matching refs', async () => {
    const req = makeReq({
      id: 'req-2',
      tool: 'browser_find',
      args: { query: 'Hello' },
    });

    const res = await handleToolRequest(req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const matches = (res.result as { matches: { name: string }[] }).matches;
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.name).toBe('Hello');
    }
  });

  // 3. Routes browser_click
  test('AC-P05-18: routes browser_click and executes click on resolved ref', async () => {
    // Generate snapshot first
    await handleToolRequest(
      makeReq({
        id: 'req-snap',
        tool: 'browser_snapshot',
      }),
    );

    const clickReq = makeReq({
      id: 'req-click',
      tool: 'browser_click',
      args: { ref: 'A1' },
    });

    const res = await handleToolRequest(clickReq);
    expect(res.ok).toBe(true);
  });

  // 4. Routes browser_type
  test('AC-P05-18: routes browser_type and writes into input field', async () => {
    document.body.innerHTML = '<input id="text-target" />';
    await handleToolRequest(
      makeReq({
        id: 'req-snap2',
        tool: 'browser_snapshot',
      }),
    );

    const typeReq = makeReq({
      id: 'req-type',
      tool: 'browser_type',
      args: { ref: 'A1', text: 'Tether typing' },
    });

    const res = await handleToolRequest(typeReq);
    expect(res.ok).toBe(true);
    const inp = document.getElementById('text-target') as HTMLInputElement;
    expect(inp.value).toBe('Tether typing');
  });

  // 5. Routes browser_navigate
  test('AC-P05-18: routes browser_navigate', async () => {
    const navReq = makeReq({
      id: 'req-nav',
      tool: 'browser_navigate',
      args: { url: 'https://example.com' },
    });

    const res = await handleToolRequest(navReq);
    expect(res.ok).toBe(true);
  });

  // 6. Non-M0 tools return NOT_IMPLEMENTED (AC-P05-18)
  test('AC-P05-18: unhandled tools return NOT_IMPLEMENTED error', async () => {
    const req = makeReq({
      id: 'req-unknown',
      tool: 'browser_read_console',
    });

    const res = await handleToolRequest(req);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INTERNAL');
      expect(res.error.message).toContain('not implemented');
    }
  });

  // 7. 10-minute idempotency cache (AC-P05-19)
  test('AC-P05-19: returns cached response when same idem is presented within 10 minutes', async () => {
    const firstReq = makeReq({
      id: 'req-initial',
      idem: 'unique-idem-token-123',
      tool: 'browser_snapshot',
    });

    const firstRes = await handleToolRequest(firstReq);
    expect(firstRes.ok).toBe(true);

    // Modify DOM to ensure cached result is returned rather than fresh execution
    document.body.innerHTML = '<div>Completely Different</div>';

    const secondReq = makeReq({
      id: 'req-second',
      idem: 'unique-idem-token-123',
      tool: 'browser_snapshot',
    });

    const secondRes = await handleToolRequest(secondReq);
    expect(secondRes.ok).toBe(true);
    expect(secondRes.id).toBe('req-second'); // Updated to current req id
    if (secondRes.ok) {
      // Tree should be the cached one with button "Hello", not "Completely Different"
      expect((secondRes.result as { tree: string }).tree).toContain('button "Hello"');
    }
  });

  // 8. FIX-01: boot triggers ensureConnected
  test('FIX-01: boot triggers ensureConnected', async () => {
    const ensureSpy = vi.spyOn(transport, 'ensureConnected').mockResolvedValue();
    await bootstrap(transport);
    expect(ensureSpy).toHaveBeenCalled();
    ensureSpy.mockRestore();
  });

  // 9. FIX-01: SW wake via onConnect triggers ensureConnected
  test('FIX-01: SW wake via onConnect triggers ensureConnected', () => {
    const onConnectListeners: (() => void)[] = [];
    (
      globalThis as unknown as {
        chrome: { runtime: { onConnect: { addListener: (fn: () => void) => void } } };
      }
    ).chrome.runtime.onConnect = {
      addListener: (fn: () => void) => onConnectListeners.push(fn),
    };
    const ensureSpy = vi.spyOn(transport, 'ensureConnected').mockResolvedValue();
    const entry = backgroundEntry as unknown as { main?: () => void } | (() => void);
    if (typeof entry === 'function') {
      entry();
    } else if (typeof entry?.main === 'function') {
      entry.main();
    }
    for (const fn of onConnectListeners) fn();
    expect(ensureSpy).toHaveBeenCalled();
    ensureSpy.mockRestore();
  });

  // 10. FIX-03: get_transport_status responds synchronously with state and does NOT route to tool handler
  test('FIX-03: get_transport_status responds with state and does NOT route to tool handler', () => {
    let messageHandler: ((msg: unknown, s: unknown, cb: (res: unknown) => void) => boolean) | null =
      null;
    const chromeObj = globalThis as unknown as {
      chrome: {
        runtime: {
          onMessage: {
            addListener: (
              fn: (msg: unknown, s: unknown, cb: (res: unknown) => void) => boolean,
            ) => void;
          };
          sendMessage: (msg: unknown) => Promise<unknown>;
        };
      };
    };
    chromeObj.chrome.runtime.onMessage = {
      addListener: (fn) => {
        messageHandler = fn;
      },
    };

    const entry = backgroundEntry as unknown as { main?: () => void } | (() => void);
    if (typeof entry === 'function') entry();
    else if (typeof entry?.main === 'function') entry.main();

    expect(messageHandler).not.toBeNull();
    const sendResponseSpy = vi.fn();
    const isAsync = messageHandler?.({ type: 'get_transport_status' }, {}, sendResponseSpy);

    expect(isAsync).toBe(false);
    expect(sendResponseSpy).toHaveBeenCalledWith({ state: transport.state });
  });

  // 11. FIX-03: state transition emits transport.state broadcast
  test('FIX-03: state transition emits transport.state broadcast', () => {
    const chromeObj = globalThis as unknown as {
      chrome: { runtime: { sendMessage: (msg: unknown) => Promise<unknown> } };
    };
    const sendMsgSpy = vi.spyOn(chromeObj.chrome.runtime, 'sendMessage');
    (transport as unknown as { emitState: (state: string) => void }).emitState('online');
    expect(sendMsgSpy).toHaveBeenCalledWith({ type: 'transport.state', state: 'online' });
    sendMsgSpy.mockRestore();
  });

  // Prompt 12 AC-P12-01 (HR-10): kill-switch reset flow specs live in
  // background-reset.spec.ts (extracted for the TRD §4.3 300-line cap).
});
