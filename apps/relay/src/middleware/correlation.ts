// TRD §8.4: Correlation ID middleware
import type { MiddlewareHandler } from 'hono';

export const correlationMiddleware: MiddlewareHandler = async (c, next) => {
  const existing = c.req.header('x-correlation-id');
  const correlationId = existing || globalThis.crypto.randomUUID();
  c.set('correlationId', correlationId);
  c.res.headers.set('x-correlation-id', correlationId);
  await next();
};
