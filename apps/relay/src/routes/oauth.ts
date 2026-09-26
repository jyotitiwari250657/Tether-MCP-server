// PRD FR-602, FR-604: OAuth 2.1 RFC 7591 DCR, Authorization Code + PKCE, Token Rotation & Revocation
import { Hono } from 'hono';
import { hashRefreshToken, sha256Base64Url } from '../crypto/hash.js';
import { signAccessToken } from '../crypto/jwt.js';
import { loadRelayConfig } from '../lib/config.js';
import { getKv } from '../state/kv.js';
import { createClient, getClient } from '../store/clients.js';
import {
  getTokenByHash,
  revokeTokenByHash,
  revokeTokenFamily,
  rotateToken,
  storeToken,
} from '../store/tokens.js';

export const oauthRouter = new Hono();

interface AuthCodeData {
  clientId: string;
  userId: string;
  deviceId: string;
  scope: string;
  codeChallenge: string;
  redirectUri: string;
}

// RFC 7591 Dynamic Client Registration
oauthRouter.post('/api/oauth/register', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const clientName = (body.client_name as string) || 'AI Agent Client';
  const redirectUris = (body.redirect_uris as string[]) || [];
  const clientId = `client_${globalThis.crypto.randomUUID()}`;

  await createClient({
    id: clientId,
    user_id: 'default_user',
    device_id: 'default_device',
    label: clientName,
    kind: 'dynamic',
    scopes: 'tether:readonly tether:act',
    created_at: Date.now(),
  });

  return c.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none',
    },
    201,
  );
});

// GET /api/oauth/authorize
oauthRouter.get('/api/oauth/authorize', async (c) => {
  const clientId = c.req.query('client_id');
  const redirectUri = c.req.query('redirect_uri');
  const codeChallenge = c.req.query('code_challenge');
  const codeChallengeMethod = c.req.query('code_challenge_method');
  const state = c.req.query('state');
  const scope = c.req.query('scope') || 'tether:act';

  if (!clientId || !redirectUri || !codeChallenge) {
    return c.json(
      { error: 'invalid_request', message: 'Missing client_id, redirect_uri, or code_challenge' },
      400,
    );
  }

  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return c.json(
      { error: 'invalid_request', message: 'Only S256 code_challenge_method is supported' },
      400,
    );
  }

  const client = await getClient(clientId);
  if (!client || client.revoked_at) {
    return c.json({ error: 'unauthorized_client', message: 'Unknown or revoked client' }, 401);
  }

  const code = `code_${globalThis.crypto.randomUUID()}`;
  const authCodeData: AuthCodeData = {
    clientId,
    userId: client.user_id,
    deviceId: client.device_id,
    scope,
    codeChallenge,
    redirectUri,
  };

  const kv = getKv();
  await kv.set(`oauth:code:${code}`, authCodeData, { ex: 300 });

  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);

  return c.redirect(url.toString(), 302);
});

// POST /api/oauth/token
oauthRouter.post('/api/oauth/token', async (c) => {
  const ct = c.req.header('content-type') || '';
  const body = (
    ct.includes('application/json')
      ? await c.req.json().catch(() => ({}))
      : await c.req.parseBody().catch(() => ({}))
  ) as Record<string, string>;
  const grantType = body.grant_type;
  const config = loadRelayConfig();

  if (grantType === 'authorization_code') {
    const code = body.code;
    const codeVerifier = body.code_verifier;
    const clientId = body.client_id;

    if (!code || !codeVerifier) {
      return c.json({ error: 'invalid_request', message: 'Missing code or code_verifier' }, 400);
    }

    const kv = getKv();
    const stored = await kv.get<AuthCodeData>(`oauth:code:${code}`);
    if (!stored) {
      return c.json(
        { error: 'invalid_grant', message: 'Invalid or expired authorization code' },
        400,
      );
    }
    await kv.del(`oauth:code:${code}`);

    if (clientId && stored.clientId !== clientId) {
      return c.json({ error: 'invalid_grant', message: 'Client ID mismatch' }, 400);
    }

    const computedChallenge = sha256Base64Url(codeVerifier);
    if (computedChallenge !== stored.codeChallenge) {
      return c.json({ error: 'invalid_grant', message: 'PKCE challenge verification failed' }, 400);
    }

    const accessToken = await signAccessToken(
      {
        sub: stored.userId,
        client_id: stored.clientId,
        device_id: stored.deviceId,
        scope: stored.scope,
      },
      config.relayUrl,
      `${config.relayUrl}/mcp`,
      3600,
      config.jwtPrivateKeyJwk,
      config.jwtPublicKeyJwk,
    );

    const refreshToken = `rft_${globalThis.crypto.randomUUID()}`;
    const family = `fam_${globalThis.crypto.randomUUID()}`;
    const refreshHash = hashRefreshToken(refreshToken);

    await storeToken({
      id: `tok_${globalThis.crypto.randomUUID()}`,
      client_id: stored.clientId,
      refresh_hash: refreshHash,
      family,
      scopes: stored.scope,
      expires_at: Date.now() + 30 * 86400 * 1000,
    });

    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: stored.scope,
    });
  }

  if (grantType === 'refresh_token') {
    const refreshToken = body.refresh_token;
    if (!refreshToken) {
      return c.json({ error: 'invalid_request', message: 'Missing refresh_token' }, 400);
    }

    const refreshHash = hashRefreshToken(refreshToken);
    const existing = await getTokenByHash(refreshHash);

    if (!existing) {
      return c.json({ error: 'invalid_grant', message: 'Unknown refresh token' }, 400);
    }

    if (existing.revoked_at) {
      // Reuse detected! Revoke entire family per RFC 6749 / SEC-08
      await revokeTokenFamily(existing.family);
      return c.json(
        { error: 'invalid_grant', message: 'Refresh token reuse detected; family revoked' },
        400,
      );
    }

    const newRefreshToken = `rft_${globalThis.crypto.randomUUID()}`;
    const newRefreshHash = hashRefreshToken(newRefreshToken);

    const newTokenRecord = {
      id: `tok_${globalThis.crypto.randomUUID()}`,
      client_id: existing.client_id,
      refresh_hash: newRefreshHash,
      family: existing.family,
      scopes: existing.scopes,
      expires_at: Date.now() + 30 * 86400 * 1000,
      rotated_from: existing.id,
    };

    await rotateToken(refreshHash, newTokenRecord);

    const client = await getClient(existing.client_id);
    const accessToken = await signAccessToken(
      {
        sub: client?.user_id ?? 'default_user',
        client_id: existing.client_id,
        device_id: client?.device_id ?? 'default_device',
        scope: existing.scopes,
      },
      config.relayUrl,
      `${config.relayUrl}/mcp`,
      3600,
      config.jwtPrivateKeyJwk,
      config.jwtPublicKeyJwk,
    );

    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: existing.scopes,
    });
  }

  return c.json({ error: 'unsupported_grant_type', message: 'Unsupported grant_type' }, 400);
});

// POST /api/oauth/revoke
oauthRouter.post('/api/oauth/revoke', async (c) => {
  const ct = c.req.header('content-type') || '';
  const body = (
    ct.includes('application/json')
      ? await c.req.json().catch(() => ({}))
      : await c.req.parseBody().catch(() => ({}))
  ) as Record<string, string>;
  const token = body.token;
  if (token) {
    const hash = hashRefreshToken(token);
    await revokeTokenByHash(hash);
  }
  return c.json({ ok: true });
});
