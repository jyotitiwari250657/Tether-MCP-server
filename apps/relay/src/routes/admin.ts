// TRD §8.4: Minimal Admin and Revocation Console Endpoints
import { Hono } from 'hono';
import { loadRelayConfig } from '../lib/config.js';
import { getDevice, revokeDevice } from '../store/devices.js';

export const adminRouter = new Hono();

adminRouter.get('/api/admin/status', (c) => {
  const config = loadRelayConfig();
  return c.json({
    status: 'operational',
    mode: config.mode,
    retentionDays: config.retentionDays,
    longPollTimeoutMs: config.longPollTimeoutMs,
  });
});

adminRouter.post('/api/admin/revoke-device', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { deviceId?: string } | null;
  if (!body || !body.deviceId) {
    return c.json({ error: 'invalid_request', message: 'Missing deviceId' }, 400);
  }

  const device = await getDevice(body.deviceId);
  if (!device) {
    return c.json({ error: 'not_found', message: 'Device not found' }, 404);
  }

  await revokeDevice(body.deviceId);
  return c.json({ ok: true, deviceId: body.deviceId, revokedAt: Date.now() });
});
