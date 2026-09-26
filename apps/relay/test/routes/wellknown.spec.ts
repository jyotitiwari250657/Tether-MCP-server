import { describe, expect, it } from 'vitest';
import { app } from '../../src/index.js';

// RFC 9728 & RFC 8414 Well-Known Metadata
describe('RFC 9728 / RFC 8414 Well-Known Endpoints', () => {
  it('GET /.well-known/oauth-authorization-server conforms to RFC 8414', async () => {
    const res = await app.request('/.well-known/oauth-authorization-server');
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint: string;
      response_types_supported: string[];
      code_challenge_methods_supported: string[];
    };

    expect(data.issuer).toBeDefined();
    expect(data.authorization_endpoint).toContain('/api/oauth/authorize');
    expect(data.token_endpoint).toContain('/api/oauth/token');
    expect(data.registration_endpoint).toContain('/api/oauth/register');
    expect(data.response_types_supported).toContain('code');
    expect(data.code_challenge_methods_supported).toContain('S256');
  });

  it('GET /.well-known/openid-configuration conforms to OIDC discovery', async () => {
    const res = await app.request('/.well-known/openid-configuration');
    expect(res.status).toBe(200);

    const data = (await res.json()) as { issuer: string; jwks_uri: string };
    expect(data.issuer).toBeDefined();
    expect(data.jwks_uri).toContain('/.well-known/jwks.json');
  });

  it('GET /.well-known/jwks.json serves valid JSON Web Key Set', async () => {
    const res = await app.request('/.well-known/jwks.json');
    expect(res.status).toBe(200);

    const data = (await res.json()) as { keys: Array<{ kty: string; kid: string }> };
    expect(Array.isArray(data.keys)).toBe(true);
    expect(data.keys.length).toBeGreaterThan(0);
    expect(data.keys[0]?.kty).toBe('OKP');
  });

  it('GET /.well-known/mcp/manifest.json serves Tether MCP manifest', async () => {
    const res = await app.request('/.well-known/mcp/manifest.json');
    expect(res.status).toBe(200);

    const data = (await res.json()) as { name: string; tools: unknown[] };
    expect(data.name).toBe('Tether Relay');
    expect(Array.isArray(data.tools)).toBe(true);
    expect(data.tools.length).toBeGreaterThan(0);
  });
});
