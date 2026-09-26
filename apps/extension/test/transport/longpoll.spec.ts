import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpLongPollTransport } from '../../lib/transport/longpoll.js';

// TRD §8.6, PRD FR-304: HttpLongPollTransport
describe('HttpLongPollTransport (Mode B Device Communication)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('polls the relay server and dispatches received commands', async () => {
    let pollCount = 0;
    const dispatchedCommands: unknown[] = [];

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/device/poll')) {
        pollCount++;
        if (pollCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                command: {
                  id: 'cmd-poll-1',
                  sessionId: 'sess-1',
                  envelope: { action: 'snapshot' },
                },
              }),
          } as Response);
        }
        return new Promise((r) =>
          setTimeout(
            () =>
              r({
                ok: true,
                json: () => Promise.resolve({ ok: true, idle: true }),
              } as Response),
            30,
          ),
        );
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    const transport = new HttpLongPollTransport({
      relayUrl: 'https://relay.tether.dev',
      deviceId: 'test-device-1',
      devicePubKey: 'pub-key-1',
      timeoutMs: 100,
    });

    transport.onCommand((cmd) => {
      dispatchedCommands.push(cmd);
    });

    transport.start();

    // Wait for poll execution
    await new Promise((r) => setTimeout(r, 60));
    transport.stop();

    expect(dispatchedCommands.length).toBeGreaterThanOrEqual(1);
    expect((dispatchedCommands[0] as { id: string }).id).toBe('cmd-poll-1');
  });

  it('posts ingest results back to the relay', async () => {
    let capturedBody: string | null = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/device/ingest')) {
        capturedBody = init?.body as string;
        return Promise.resolve({ ok: true } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ idle: true }) } as Response);
    });

    const transport = new HttpLongPollTransport({
      relayUrl: 'https://relay.tether.dev',
      deviceId: 'test-device-1',
    });

    const success = await transport.sendIngest('cmd-123', {
      status: 'ok',
      data: 'test-result',
    });

    expect(success).toBe(true);
    expect(capturedBody).not.toBeNull();
    const parsed = JSON.parse(capturedBody!);
    expect(parsed.commandId).toBe('cmd-123');
    expect(parsed.result.status).toBe('ok');
  });

  it('stops cleanly and aborts pending fetch request', () => {
    const transport = new HttpLongPollTransport({
      relayUrl: 'https://relay.tether.dev',
      deviceId: 'test-device-1',
    });

    transport.start();
    expect(transport.active).toBe(true);

    transport.stop();
    expect(transport.active).toBe(false);
  });
});
