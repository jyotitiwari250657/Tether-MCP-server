// @vitest-environment node
/**
 * Transport Client Tests (PRD FR-401..FR-405, TRD §6.11, Prompt 09-FIX-01).
 * Verifies WebSocket connection lifecycle, bootstrap handshake, alarms, backoff, and concurrency.
 */

import type { EnvelopeType, Evt, ResOk } from '@tether/protocol';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { TransportClient } from '../../lib/transport/client.js';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev?: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      if (this.onopen) this.onopen();
    });
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code });
  }
}

describe('Transport Client (PRD FR-401..FR-405, TRD §6.11)', () => {
  const activeClients: TransportClient[] = [];
  const storageLocal: Record<string, unknown> = {};
  const alarms = new Map<string, unknown>();

  const trackClient = (c: TransportClient) => {
    activeClients.push(c);
    return c;
  };

  beforeAll(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storageLocal[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(storageLocal, items);
          }),
        },
      },
      alarms: {
        create: vi.fn((name: string, info: unknown) => {
          alarms.set(name, info);
        }),
        clear: vi.fn((name: string) => {
          alarms.delete(name);
        }),
      },
      runtime: { sendMessage: vi.fn(async () => {}) },
    };
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    MockWebSocket.instances = [];
    alarms.clear();
    for (const k of Object.keys(storageLocal)) delete storageLocal[k];
  });

  afterEach(() => {
    for (const c of activeClients) c.close();
    activeClients.length = 0;
  });

  test('FR-401: connect opens WebSocket and sends hello envelope', async () => {
    const client = trackClient(new TransportClient());
    client.connect({ url: 'ws://127.0.0.1:18795', token: 'test-token' });
    expect(client.state).toBe('connecting');

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    expect(ws).toBeDefined();
    expect(ws?.sent.length).toBeGreaterThan(0);

    const firstMsg = JSON.parse(ws?.sent[0] ?? '{}');
    expect(firstMsg.kind).toBe('evt');
    expect(firstMsg.evt).toBe('hello');
    expect(firstMsg.payload.token).toBe('test-token');
  });

  const sendAck = (ws?: MockWebSocket, payload: Record<string, unknown> = { ok: true }) => {
    ws?.onmessage?.({
      data: JSON.stringify({
        v: 1,
        id: 'ack',
        session: 's',
        ts: Date.now(),
        kind: 'evt',
        evt: 'hello-ack',
        payload,
      }),
    });
  };

  test('FR-401: handles hello-ack and transitions to online', async () => {
    const client = trackClient(new TransportClient());
    client.connect({ url: 'ws://127.0.0.1:18795', token: 'test-token' });

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    sendAck(ws);

    expect(client.state).toBe('online');
  });

  test('FR-401, FR-509: send queues messages when offline, redacts sensitive payload upon sending', async () => {
    const client = trackClient(new TransportClient());
    const sensitiveEvt: Evt = {
      v: 1,
      id: 'e1',
      session: 's',
      ts: Date.now(),
      kind: 'evt',
      evt: 'step',
      payload: { email: 'user@example.com' },
    };

    client.send(sensitiveEvt);
    client.connect({ url: 'ws://127.0.0.1:18795', token: 'tok' });

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    sendAck(ws);

    expect(ws?.sent.length).toBe(2);
    const queuedMsg = JSON.parse(ws?.sent[1] ?? '{}');
    expect(queuedMsg.payload.email).toContain('EMAIL:');
  });

  test('FR-401: request resolves when matching res received', async () => {
    const client = trackClient(new TransportClient());
    client.connect({ url: 'ws://127.0.0.1:18795', token: 'tok' });

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    sendAck(ws);

    const promise = client.request('browser_snapshot', {});
    await new Promise((r) => setTimeout(r, 10));

    const reqMsg = JSON.parse(ws?.sent[ws.sent.length - 1] ?? '{}');
    const resMsg: ResOk = {
      v: 1,
      id: reqMsg.id,
      session: 's',
      ts: Date.now(),
      kind: 'res',
      reqId: reqMsg.id,
      ok: true,
      result: { tree: 'body' },
      ms: 5,
    };
    ws?.onmessage?.({ data: JSON.stringify(resMsg) });

    const result = await promise;
    expect(result.ok).toBe(true);
  });

  test('FR-402: socket error triggers reconnect backoff state', async () => {
    const client = trackClient(new TransportClient());
    client.connect({ url: 'ws://127.0.0.1:18795', token: 'tok' });

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws?.onerror?.();
    expect(client.state).toBe('backoff');
  });

  test('HR-10: close rejects all pending requests with error', async () => {
    const client = trackClient(new TransportClient());
    client.connect({ url: 'ws://127.0.0.1:18795', token: 'tok' });
    await new Promise((r) => setTimeout(r, 20));

    const pendingPromise = client.request('browser_snapshot', {}, 10000);
    client.close('kill_switch');
    await expect(pendingPromise).rejects.toThrow('Transport closed: kill_switch');
  });

  // Prompt 09-FIX-02: token omission, stored token sending, and reject logging
  test('FIX-02: boot with no stored token -> sends hello WITHOUT token field, persists token from ack', async () => {
    const client = trackClient(new TransportClient());
    void client.ensureConnected();

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    const hello = JSON.parse(ws?.sent[0] ?? '{}');
    expect('token' in hello.payload).toBe(false);
    expect(hello.payload.token).toBeUndefined();

    sendAck(ws, {
      ok: true,
      token: 'issued-token-123',
      protocolVersion: 1,
      daemonVersion: '0.1.0',
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(client.state).toBe('online');
    expect(storageLocal['daemon:token']).toBe('issued-token-123');
  });

  test('FIX-02: boot with stored token -> sends hello with it; ack without token field keeps stored value', async () => {
    storageLocal['daemon:token'] = 'existing-saved-token';
    const client = trackClient(new TransportClient());
    void client.ensureConnected();

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    const hello = JSON.parse(ws?.sent[0] ?? '{}');
    expect(hello.payload.token).toBe('existing-saved-token');

    sendAck(ws);

    expect(client.state).toBe('online');
    expect(storageLocal['daemon:token']).toBe('existing-saved-token');
  });

  test('FIX-02: socket close on code 4001 logs handshake rejected by daemon', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = trackClient(new TransportClient());
    void client.ensureConnected();

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws?.onclose?.({ code: 4001 });

    const logged = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    warnSpy.mockRestore();
    expect(logged).toContain('[Tether] transport: handshake rejected by daemon');
  });

  test('FIX-01: socket close -> state backoff, alarm created, retry fires', async () => {
    vi.useFakeTimers();
    try {
      const client = trackClient(new TransportClient());
      void client.ensureConnected();
      await vi.advanceTimersByTimeAsync(20);

      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      ws?.onclose?.();

      expect(client.state).toBe('backoff');
      expect(alarms.has('tether-reconnect')).toBe(true);

      const countBefore = MockWebSocket.instances.length;
      await vi.advanceTimersByTimeAsync(20000);
      expect(MockWebSocket.instances.length).toBeGreaterThan(countBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  test('FIX-01: reaching online clears the reconnect alarm', async () => {
    alarms.set('tether-reconnect', { periodInMinutes: 0.5 });
    const client = trackClient(new TransportClient());
    void client.ensureConnected();

    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    sendAck(ws);

    expect(client.state).toBe('online');
    expect(alarms.has('tether-reconnect')).toBe(false);
  });

  test('FIX-01: ensureConnected() called twice concurrently opens exactly ONE socket', async () => {
    const client = trackClient(new TransportClient());
    const p1 = client.ensureConnected();
    const p2 = client.ensureConnected();

    await Promise.all([p1, p2]);
    await new Promise((r) => setTimeout(r, 20));

    expect(MockWebSocket.instances.length).toBe(1);
  });
});
