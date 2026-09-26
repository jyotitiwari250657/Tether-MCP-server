import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DaemonHttpServer } from '../../src/server/http.js';

describe('Daemon HTTP Server (TRD §7.2, PRD FR-301)', () => {
  let server: DaemonHttpServer;
  const testPort = 19876;

  beforeEach(async () => {
    server = new DaemonHttpServer({ port: testPort });
    await server.start();
  });

  afterEach(async () => {
    await server.close();
  });

  it('serves /healthz with 200 OK', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/healthz`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('ok');
  });

  it('serves /readyz with 503 when offline and 200 when extension connected', async () => {
    const res1 = await fetch(`http://127.0.0.1:${testPort}/readyz`);
    expect(res1.status).toBe(503);

    const { metrics } = await import('../../src/server/health.js');
    metrics.extensionConnected = true;

    const res2 = await fetch(`http://127.0.0.1:${testPort}/readyz`);
    expect(res2.status).toBe(200);
    const data = (await res2.json()) as { status: string };
    expect(data.status).toBe('ready');

    metrics.extensionConnected = false;
  });

  it('serves /version with version info', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/version`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { version: string };
    expect(data.version).toBe('0.1.0');
  });

  it('serves /metrics with prometheus text format', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/metrics`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('tether_daemon_uptime_seconds');
  });

  it('returns 404 for unknown route', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/nonexistent`);
    expect(res.status).toBe(404);
  });
});
