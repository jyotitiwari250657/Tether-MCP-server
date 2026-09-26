// PRD FR-602, FR-603: RFC 9728 and RFC 8414 Discovery Endpoints & JWKS
import type { OAuthAuthorizationServerMetadata, OAuthResourceMetadata } from '@tether/protocol';
import { TOOLS } from '@tether/protocol';
import { Hono } from 'hono';
import { getJwks } from '../crypto/jwt.js';
import { loadRelayConfig } from '../lib/config.js';

export const wellknownRouter = new Hono();

// RFC 9728: OAuth 2.0 Protected Resource Metadata
wellknownRouter.get('/.well-known/oauth-protected-resource/mcp', (c) => {
  const config = loadRelayConfig();
  const metadata: OAuthResourceMetadata = {
    resource: `${config.relayUrl}/mcp`,
    authorization_servers: [config.relayUrl],
    scopes_supported: ['tether:readonly', 'tether:act'],
  };
  return c.json(metadata);
});

// RFC 8414: OAuth 2.0 Authorization Server Metadata
wellknownRouter.get('/.well-known/oauth-authorization-server', (c) => {
  const config = loadRelayConfig();
  const metadata: OAuthAuthorizationServerMetadata & {
    registration_endpoint: string;
    code_challenge_methods_supported: string[];
  } = {
    issuer: config.relayUrl,
    authorization_endpoint: `${config.relayUrl}/api/oauth/authorize`,
    token_endpoint: `${config.relayUrl}/api/oauth/token`,
    registration_endpoint: `${config.relayUrl}/api/oauth/register`,
    jwks_uri: `${config.relayUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
  };
  return c.json(metadata);
});

// OpenID Connect Configuration discovery
wellknownRouter.get('/.well-known/openid-configuration', (c) => {
  const config = loadRelayConfig();
  return c.json({
    issuer: config.relayUrl,
    authorization_endpoint: `${config.relayUrl}/api/oauth/authorize`,
    token_endpoint: `${config.relayUrl}/api/oauth/token`,
    jwks_uri: `${config.relayUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
  });
});

// JWKS Endpoints
const handleJwks = async (c: import('hono').Context) => {
  const config = loadRelayConfig();
  const jwks = await getJwks(config.jwtPublicKeyJwk);
  return c.json(jwks);
};

wellknownRouter.get('/api/oauth/jwks.json', handleJwks);
wellknownRouter.get('/.well-known/jwks.json', handleJwks);

// Tether MCP Manifest
wellknownRouter.get('/.well-known/mcp/manifest.json', (c) => {
  return c.json({
    name: 'Tether Relay',
    version: '0.1.0',
    description: 'Tether Browser Remote MCP Service',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
});
