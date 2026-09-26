import { describe, expect, it } from 'vitest';
import { app } from '../../src/index.js';
import { getDeviceRegistry } from '../../src/state/device-registry.js';

// TRD §8.6, PRD FR-304: Device HTTP long polling and ingest
describe('Relay Device Long Polling & Ingest Routes', () => {
  it('GET /api/device/poll returns idle when no commands queued (short timeout)', async () => {
    const res = await app.request('/api/device/poll?deviceId=dev_idle_1&timeout=50', {
      headers: {
        'x-device-id': 'dev_idle_1',
        'x-device-pubkey': 'mock_pubkey_123',
      },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; idle: boolean };
    expect(data.ok).toBe(true);
    expect(data.idle).toBe(true);
  });

  it('GET /api/device/poll returns queued command immediately', async () => {
    const registry = getDeviceRegistry();
    await registry.enqueueCommand('dev_cmd_1', {
      id: 'cmd_test_99',
      sessionId: 'sess_1',
      envelope: { ciphertext: 'c_test', nonce: 'n_test', ephemPubKey: 'pk_test' },
      createdAt: Date.now(),
    });

    const res = await app.request('/api/device/poll?deviceId=dev_cmd_1&timeout=2000', {
      headers: {
        'x-device-id': 'dev_cmd_1',
      },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      command: { id: string; envelope: { ciphertext: string } };
    };
    expect(data.ok).toBe(true);
    expect(data.command.id).toBe('cmd_test_99');
    expect(data.command.envelope.ciphertext).toBe('c_test');
  });

  it('POST /api/device/ingest accepts command execution results', async () => {
    const res = await app.request('/api/device/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'dev_cmd_1',
      },
      body: JSON.stringify({
        commandId: 'cmd_test_99',
        result: { status: 'success', refs: [] },
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it('rejects /api/device/poll without deviceId', async () => {
    const res = await app.request('/api/device/poll');
    expect(res.status).toBe(400);
  });
});
