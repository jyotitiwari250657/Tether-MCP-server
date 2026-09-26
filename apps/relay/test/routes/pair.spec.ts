import { describe, expect, it } from 'vitest';
import { app } from '../../src/index.js';

// PRD FR-601: Pairing routes
describe('Relay Device Pairing Routes', () => {
  it('handles pairing lifecycle: begin -> status -> confirm -> paired', async () => {
    // 1. Begin pairing
    const beginRes = await app.request('/api/pair/begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'dev_test_456',
        devicePubKey: 'pub_test_key_456',
      }),
    });

    expect(beginRes.status).toBe(200);
    const beginData = (await beginRes.json()) as {
      code: string;
      expiresAt: number;
    };
    expect(beginData.code).toBeDefined();
    expect(beginData.code.length).toBeGreaterThan(0);

    // 2. Check status (should be pending)
    const statusRes1 = await app.request(`/api/pair/status/${beginData.code}`);
    expect(statusRes1.status).toBe(200);
    const statusData1 = (await statusRes1.json()) as { status: string };
    expect(statusData1.status).toBe('pending');

    // 3. User confirms pairing on web / pair page
    const confirmRes = await app.request('/api/pair/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: beginData.code,
        userId: 'user_alice',
      }),
    });

    expect(confirmRes.status).toBe(200);
    const confirmData = (await confirmRes.json()) as { ok: boolean };
    expect(confirmData.ok).toBe(true);

    // 4. Check status again (should be confirmed)
    const statusRes2 = await app.request(`/api/pair/status/${beginData.code}`);
    expect(statusRes2.status).toBe(200);
    const statusData2 = (await statusRes2.json()) as {
      status: string;
      userId: string;
      accessToken: string;
    };
    expect(statusData2.status).toBe('confirmed');
    expect(statusData2.userId).toBe('user_alice');
    expect(statusData2.accessToken).toBeDefined();
  });

  it('returns 404 or expired for unknown pairing code', async () => {
    const res = await app.request('/api/pair/status/nonexistent-code-999');
    expect(res.status).toBe(404);
  });
});
