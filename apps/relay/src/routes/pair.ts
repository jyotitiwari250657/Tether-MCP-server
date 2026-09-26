import type { PairBeginRequest, PairBeginResponse, PairConfirmRequest } from '@tether/protocol';
import { Hono } from 'hono';
import { signAccessToken } from '../crypto/jwt.js';
import { loadRelayConfig } from '../lib/config.js';
import { getKv } from '../state/kv.js';
import { createDevice } from '../store/devices.js';
import { createUser } from '../store/users.js';

export const pairRouter = new Hono();

interface StoredPairingCode {
  code: string;
  devicePubKey: string;
  label: string;
  expiresAt: number;
  confirmed: boolean;
  deviceId?: string | undefined;
  userId?: string | undefined;
  accessToken?: string | undefined;
}

// POST /api/pair/begin
pairRouter.post('/api/pair/begin', async (c) => {
  const body = (await c.req.json().catch(() => null)) as PairBeginRequest | null;
  if (!body || !body.devicePubKey) {
    return c.json({ error: 'invalid_request', message: 'Missing devicePubKey' }, 400);
  }

  const label = body.label || 'Tether Extension';
  const config = loadRelayConfig();
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minute TTL (PRD FR-606)

  const pairData: StoredPairingCode = {
    code,
    devicePubKey: body.devicePubKey,
    label,
    expiresAt,
    confirmed: false,
  };

  const kv = getKv();
  await kv.set(`pair:${code}`, pairData, { ex: 300 });

  const response: PairBeginResponse = {
    code,
    expiresAt,
    relayUrl: config.relayUrl,
  };

  return c.json(response);
});

// POST /api/pair/confirm
pairRouter.post('/api/pair/confirm', async (c) => {
  const body = (await c.req.json().catch(() => null)) as PairConfirmRequest | null;
  if (!body || !body.code) {
    return c.json({ error: 'invalid_request', message: 'Missing code' }, 400);
  }

  const kv = getKv();
  const pairData = await kv.get<StoredPairingCode>(`pair:${body.code}`);
  if (!pairData || Date.now() > pairData.expiresAt) {
    return c.json({ error: 'invalid_code', message: 'Pairing code expired or invalid' }, 400);
  }

  const userId =
    (body as unknown as { userId?: string }).userId || `usr_${globalThis.crypto.randomUUID()}`;
  const deviceId = `dev_${globalThis.crypto.randomUUID()}`;

  await createUser({
    id: userId,
    created_at: Date.now(),
    retention_days: 30,
  });

  await createDevice({
    id: deviceId,
    user_id: userId,
    label: pairData.label,
    profile: 'browser-act',
    pub_key: pairData.devicePubKey,
    last_seen: Date.now(),
  });

  const config = loadRelayConfig();
  const accessToken = await signAccessToken(
    {
      sub: userId,
      client_id: `device_client_${deviceId}`,
      device_id: deviceId,
      scope: 'tether:act tether:readonly',
    },
    config.relayUrl,
    `${config.relayUrl}/mcp`,
    3600,
    config.jwtPrivateKeyJwk,
    config.jwtPublicKeyJwk,
  );

  pairData.confirmed = true;
  pairData.deviceId = deviceId;
  pairData.userId = userId;
  pairData.accessToken = accessToken;
  await kv.set(`pair:${body.code}`, pairData, { ex: 60 });

  return c.json({ ok: true, deviceId, userId, accessToken });
});

// GET /api/pair/:code & GET /api/pair/status/:code
const handlePairStatus = async (c: import('hono').Context) => {
  const code = c.req.param('code');
  const kv = getKv();
  const pairData = await kv.get<StoredPairingCode>(`pair:${code}`);

  if (!pairData || Date.now() > pairData.expiresAt) {
    return c.json({ error: 'not_found', message: 'Pairing code not found or expired' }, 404);
  }

  return c.json({
    code: pairData.code,
    label: pairData.label,
    expiresAt: pairData.expiresAt,
    confirmed: pairData.confirmed,
    status: pairData.confirmed ? 'confirmed' : 'pending',
    deviceId: pairData.deviceId,
    userId: pairData.userId,
    accessToken: pairData.accessToken,
  });
};

pairRouter.get('/api/pair/:code', handlePairStatus);
pairRouter.get('/api/pair/status/:code', handlePairStatus);
