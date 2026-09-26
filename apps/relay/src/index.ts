// TRD §8: Tether Hosted Relay Hono App Entrypoint
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { loadRelayConfig } from './lib/config.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { retentionSafeLogger } from './middleware/retention.js';
import { adminRouter } from './routes/admin.js';
import { deviceRouter } from './routes/device.js';
import { healthRouter } from './routes/health.js';
import { mcpRouter } from './routes/mcp.js';
import { oauthRouter } from './routes/oauth.js';
import { pairRouter } from './routes/pair.js';
import { wellknownRouter } from './routes/wellknown.js';

export function createRelayApp(): Hono {
  const app = new Hono();

  // Middleware pipeline
  app.use('*', correlationMiddleware);
  app.use('*', retentionSafeLogger);

  // Mount routers
  app.route('/', wellknownRouter);
  app.route('/', oauthRouter);
  app.route('/', pairRouter);
  app.route('/', deviceRouter);
  app.route('/', mcpRouter);
  app.route('/', healthRouter);
  app.route('/', adminRouter);

  return app;
}

export const app = createRelayApp();

// Run standalone server if started directly
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const config = loadRelayConfig();
  console.log(`[Tether Relay] Starting in ${config.mode} mode on port ${config.port}`);
  serve({
    fetch: app.fetch,
    port: config.port,
  });
}
