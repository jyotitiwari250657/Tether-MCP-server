// TRD §8.4: Health, Readiness, Version and Prometheus Metrics Endpoints
import { Hono } from 'hono';
import { loadRelayConfig } from '../lib/config.js';

export const healthRouter = new Hono();

healthRouter.get('/api/health', (c) => {
  return c.json({ ok: true, version: '0.1.0', time: Date.now() });
});

healthRouter.get('/api/health/ready', (c) => {
  return c.json({ ready: true, time: Date.now() });
});

healthRouter.get('/api/healthz', (c) => {
  return c.text('OK', 200);
});

healthRouter.get('/api/readyz', (c) => {
  return c.json({ ready: true, time: Date.now() });
});

healthRouter.get('/api/version', (c) => {
  const config = loadRelayConfig();
  return c.json({
    name: 'tether-relay',
    version: '0.1.0',
    protocolVersion: 1,
    mode: config.mode,
    relayUrl: config.relayUrl,
  });
});

healthRouter.get('/api/metrics', (c) => {
  const lines = [
    '# HELP tether_relay_uptime_seconds Relay uptime in seconds',
    '# TYPE tether_relay_uptime_seconds gauge',
    `tether_relay_uptime_seconds ${Math.floor(process.uptime ? process.uptime() : 100)}`,
    '# HELP tether_relay_health Status 1=healthy',
    '# TYPE tether_relay_health gauge',
    'tether_relay_health 1',
  ];
  return c.text(`${lines.join('\n')}\n`, 200, {
    'content-type': 'text/plain; version=0.0.4',
  });
});
