import { describe, expect, it } from 'vitest';
import { generateRefreshToken } from '../../src/crypto/hash.js';
import {
  getJwks,
  getSigningKey,
  signAccessToken,
  verifyAccessToken,
} from '../../src/crypto/jwt.js';

// RFC 9728 / RFC 8414 OAuth token verification
describe('RFC 9728 / RFC 8414 Token and Key Management', () => {
  it('generates Ed25519 keypair and exports valid JWKS', async () => {
    const keyPair = await getSigningKey();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.jwk).toBeDefined();

    const jwks = await getJwks();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]?.kty).toBe('OKP');
    expect(jwks.keys[0]?.crv).toBe('Ed25519');
    expect(jwks.keys[0]?.kid).toBe('tether-key-1');
  });

  it('issues and verifies access token with claims', async () => {
    const issuer = 'https://relay.tether.dev';
    const audience = 'https://relay.tether.dev/mcp';

    const token = await signAccessToken(
      {
        sub: 'user-123',
        client_id: 'client-abc',
        device_id: 'dev-xyz',
        scope: 'tether:act tether:read',
      },
      issuer,
      audience,
      60,
    );

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = await verifyAccessToken(token, issuer, audience);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('user-123');
    expect(payload?.client_id).toBe('client-abc');
    expect(payload?.device_id).toBe('dev-xyz');
    expect(payload?.scope).toBe('tether:act tether:read');
    expect(payload?.iss).toBe(issuer);
    expect(payload?.aud).toBe(audience);
  });

  it('rejects token with wrong issuer or audience', async () => {
    const issuer = 'https://relay.tether.dev';
    const audience = 'https://relay.tether.dev/mcp';

    const token = await signAccessToken(
      {
        sub: 'user-123',
        client_id: 'client-abc',
        device_id: 'dev-xyz',
        scope: 'tether:act',
      },
      issuer,
      audience,
    );

    // Verify with wrong issuer
    const resultWrongIssuer = await verifyAccessToken(token, 'https://wrong-issuer.dev', audience);
    expect(resultWrongIssuer).toBeNull();

    // Verify with wrong audience
    const resultWrongAudience = await verifyAccessToken(
      token,
      issuer,
      'https://wrong-audience.dev',
    );
    expect(resultWrongAudience).toBeNull();
  });

  it('generates cryptographically secure refresh token', () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();

    expect(typeof token1).toBe('string');
    expect(token1.length).toBeGreaterThanOrEqual(40);
    expect(token1).not.toBe(token2);
  });
});
