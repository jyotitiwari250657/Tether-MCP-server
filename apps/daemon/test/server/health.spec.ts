import { describe, expect, it } from 'vitest';
import {
  getHealthz,
  getMetricsPrometheus,
  getReadyz,
  getVersion,
  metrics,
} from '../../src/server/health.js';

describe('Daemon Health & Observability (TRD §7.2, NFR-109)', () => {
  it('returns healthz status', () => {
    const res = getHealthz();
    expect(res.status).toBe('ok');
    expect(typeof res.uptime).toBe('number');
  });

  it('returns readyz status reflecting extension connection', () => {
    metrics.extensionConnected = false;
    const res1 = getReadyz();
    expect(res1.status).toBe('not_ready');
    expect(res1.extensionConnected).toBe(false);

    metrics.extensionConnected = true;
    const res2 = getReadyz();
    expect(res2.status).toBe('ready');
    expect(res2.extensionConnected).toBe(true);
  });

  it('returns daemon version info', () => {
    const res = getVersion();
    expect(res.version).toBe('0.1.0');
    expect(res.protocolVersion).toBe('1.0.0');
  });

  it('generates Prometheus metrics text format', () => {
    metrics.totalRequests = 42;
    metrics.activeSessions = 1;
    const text = getMetricsPrometheus();
    expect(text).toContain('# HELP tether_requests_total');
    expect(text).toContain('tether_requests_total 42');
    expect(text).toContain('tether_active_connections 1');
  });
});
