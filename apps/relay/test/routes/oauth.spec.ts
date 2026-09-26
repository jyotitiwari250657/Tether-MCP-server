import { describe, expect, it } from 'vitest';
import { sha256Base64Url } from '../../src/crypto/hash.js';
import { app } from '../../src/index.js';

// PRD FR-602, FR-604: OAuth 2.1 RFC 7591 DCR, Authorization Code + PKCE, Token Rotation & Revocation
describe('RFC 7591 / RFC 6749 / RFC 9728 OAuth 2.1 Routes', () => {
  it('registers a client dynamically via RFC 7591 DCR', async () => {
    const res = await app.request('/api/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Claude Desktop Test',
        redirect_uris: ['http://localhost:8080/callback'],
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as { client_id: string; client_name: string };
    expect(data.client_id).toBeDefined();
    expect(data.client_id.startsWith('client_')).toBe(true);
    expect(data.client_name).toBe('Claude Desktop Test');
  });

  it('completes the full authorization code flow with PKCE and token rotation', async () => {
    // 1. Dynamic Client Registration
    const regRes = await app.request('/api/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'ChatGPT Plugin',
        redirect_uris: ['https://chatgpt.com/aip/oauth/callback'],
      }),
    });
    const { client_id } = (await regRes.json()) as { client_id: string };

    // 2. Authorize request with PKCE S256
    const codeVerifier = 'high_entropy_pkce_verifier_string_sample_0123456789';
    const codeChallenge = sha256Base64Url(codeVerifier);
    const state = 'state_xyz';

    const authUrl = `/api/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent('https://chatgpt.com/aip/oauth/callback')}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`;
    const authRes = await app.request(authUrl);

    expect(authRes.status).toBe(302);
    const location = authRes.headers.get('location') || '';
    expect(location).toContain('https://chatgpt.com/aip/oauth/callback');
    const redirectParams = new URL(location).searchParams;
    const code = redirectParams.get('code');
    expect(code).toBeDefined();
    expect(redirectParams.get('state')).toBe(state);

    // 3. Token exchange
    const tokenRes = await app.request('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        client_id,
      }),
    });

    expect(tokenRes.status).toBe(200);
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
      refresh_token: string;
      expires_in: number;
    };
    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeDefined();

    // 4. Token rotation (grant_type=refresh_token)
    const refreshRes = await app.request('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      }),
    });

    expect(refreshRes.status).toBe(200);
    const rotated = (await refreshRes.json()) as {
      access_token: string;
      refresh_token: string;
    };
    expect(rotated.access_token).toBeDefined();
    expect(rotated.refresh_token).toBeDefined();
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token);

    // 5. Replaying the old refresh token must be rejected (SEC-08 reuse detection)
    const reuseRes = await app.request('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      }),
    });
    expect(reuseRes.status).toBe(400);

    // 6. Revocation
    const revokeRes = await app.request('/api/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rotated.refresh_token }),
    });
    expect(revokeRes.status).toBe(200);
  });

  it('rejects authorization code with incorrect PKCE verifier', async () => {
    const regRes = await app.request('/api/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Test Client' }),
    });
    const { client_id } = (await regRes.json()) as { client_id: string };

    const verifier = 'real_verifier_123';
    const challenge = sha256Base64Url(verifier);

    const authRes = await app.request(
      `/api/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent('https://example.com/cb')}&code_challenge=${challenge}&code_challenge_method=S256`,
    );
    const location = authRes.headers.get('location') || '';
    const code = new URL(location).searchParams.get('code');

    // Exchange with wrong verifier
    const tokenRes = await app.request('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        code_verifier: 'wrong_verifier',
        client_id,
      }),
    });

    expect(tokenRes.status).toBe(400);
    const err = (await tokenRes.json()) as { error: string };
    expect(err.error).toBe('invalid_grant');
  });
});
