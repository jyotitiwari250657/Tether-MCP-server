// TRD §8.4, PRD FR-602, FR-603: OAuth 2.1 Bearer Authentication Middleware
import type { MiddlewareHandler } from 'hono';
import { verifyAccessToken } from '../crypto/jwt.js';
import { loadRelayConfig } from '../lib/config.js';

export interface AuthContext {
  sub: string;
  clientId: string;
  deviceId: string;
  scope: string;
}

export interface RelayEnv {
  Variables: {
    auth: AuthContext;
    correlationId: string;
  };
}

export const requireAuth = (requiredScope?: string): MiddlewareHandler<RelayEnv> => {
  return async (c, next) => {
    const config = loadRelayConfig();
    const authHeader = c.req.header('authorization');
    const resourceMetadataUrl = `${config.relayUrl}/.well-known/oauth-protected-resource/mcp`;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      c.header('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}"`);
      return c.json({ error: 'unauthorized', message: 'Bearer token required' }, 401);
    }

    const token = authHeader.slice(7).trim();
    const claims = await verifyAccessToken(
      token,
      config.relayUrl,
      `${config.relayUrl}/mcp`,
      config.jwtPublicKeyJwk,
    );

    if (!claims) {
      c.header(
        'WWW-Authenticate',
        `Bearer error="invalid_token", resource_metadata="${resourceMetadataUrl}"`,
      );
      return c.json({ error: 'invalid_token', message: 'Token is invalid or expired' }, 401);
    }

    if (requiredScope) {
      const granted = claims.scope.split(' ');
      if (!granted.includes(requiredScope)) {
        return c.json(
          { error: 'insufficient_scope', message: `Required scope: ${requiredScope}` },
          403,
        );
      }
    }

    c.set('auth', {
      sub: claims.sub,
      clientId: claims.client_id,
      deviceId: claims.device_id,
      scope: claims.scope,
    });

    return await next();
  };
};
