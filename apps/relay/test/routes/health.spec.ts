import { describe, expect, it } from 'vitest';
import { app } from '../../src/index.js';

describe('Relay Health & Discovery Routes', () => {
  it('GET /api/health returns status ok with version and timestamp', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const json = (await res.json()) as { ok: boolean; version: string; time: number };
    expect(json.ok).toBe(true);
    expect(json.version).toBeDefined();
    expect(typeof json.time).toBe('number');
  });

  it('GET /api/health/ready returns status ok', async () => {
    const res = await app.request('/api/health/ready');
    expect(res.status).toBe(200);

    const json = (await res.json()) as { ready: boolean };
    expect(json.ready).toBe(true);
  });
});
