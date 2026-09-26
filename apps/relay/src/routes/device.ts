// TRD §8.6, PRD FR-304: Device HTTP Long-Polling and Result Ingestion Endpoints
import { Hono } from 'hono';
import { loadRelayConfig } from '../lib/config.js';
import {
  pollDeviceCommand,
  registerDevicePresence,
  storeDeviceResult,
} from '../state/device-registry.js';
import { updateLastSeen } from '../store/devices.js';

export const deviceRouter = new Hono();

// GET /api/device/poll
deviceRouter.get('/api/device/poll', async (c) => {
  const deviceId = c.req.header('x-device-id') || c.req.query('deviceId');
  if (!deviceId) {
    return c.json({ error: 'invalid_request', message: 'Missing deviceId' }, 400);
  }

  const config = loadRelayConfig();
  const qTimeout = c.req.query('timeout');
  const reqTimeout = qTimeout ? Number.parseInt(qTimeout, 10) : undefined;
  const timeoutMs = Math.min(
    config.longPollTimeoutMs,
    reqTimeout && !Number.isNaN(reqTimeout) ? reqTimeout : config.longPollTimeoutMs,
  );

  // Update device presence
  await registerDevicePresence({
    deviceId,
    pubKey: c.req.header('x-device-pubkey') || '',
    label: c.req.header('x-device-label') || 'Extension',
    lastSeen: Date.now(),
  });
  await updateLastSeen(deviceId, Date.now());

  // Long poll loop
  const startTime = Date.now();
  const pollIntervalMs = 100;

  while (Date.now() - startTime < timeoutMs) {
    const cmd = await pollDeviceCommand(deviceId);
    if (cmd) {
      return c.json({ ok: true, command: cmd });
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  // Timeout reached, clean idle response for next cycle
  return c.json({ ok: true, idle: true }, 200);
});

// POST /api/device/ingest
deviceRouter.post('/api/device/ingest', async (c) => {
  const deviceId = c.req.header('x-device-id');
  const body = (await c.req.json().catch(() => null)) as {
    commandId?: string;
    result?: unknown;
  } | null;

  if (!body || !body.commandId) {
    return c.json({ error: 'invalid_request', message: 'Missing commandId' }, 400);
  }

  if (deviceId) {
    await updateLastSeen(deviceId, Date.now());
  }

  await storeDeviceResult(body.commandId, body.result ?? {});
  return c.json({ ok: true });
});
