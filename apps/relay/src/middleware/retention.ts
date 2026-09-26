// PRD PRV-04, TRD §8.4: Retention-safe structured logging middleware
// NEVER logs request/response bodies, page content, authorization tokens, or query strings.
import type { MiddlewareHandler } from 'hono';

export const retentionSafeLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  const url = new URL(c.req.url);
  const logEntry = {
    method: c.req.method,
    path: url.pathname, // query parameters stripped
    status: c.res.status,
    durationMs: ms,
    correlationId: c.get('correlationId'),
    t: Date.now(),
  };

  // Structured single-line output
  console.log(JSON.stringify(logEntry));
};
