// PRD FR-608, TRD §8.6: Relay configuration and mode switching
export type RelayMode = 'managed' | 'selfhost';

export interface RelayConfig {
  mode: RelayMode;
  port: number;
  relayUrl: string;
  databaseUrl: string;
  kvRestApiUrl?: string | undefined;
  kvRestApiToken?: string | undefined;
  longPollTimeoutMs: number;
  retentionDays: number;
  jwtPrivateKeyJwk?: string | undefined;
  jwtPublicKeyJwk?: string | undefined;
}

export function loadRelayConfig(
  env: Record<string, string | undefined> = process.env,
): RelayConfig {
  const mode: RelayMode = env.RELAY_MODE === 'selfhost' ? 'selfhost' : 'managed';

  // Long poll timeout: 8000ms for managed (Vercel Hobby 10s limit), 25000ms for selfhost / pro
  let defaultTimeout = mode === 'managed' ? 8000 : 25000;
  if (env.VERCEL_PLAN === 'pro' || env.VERCEL_PLAN === 'enterprise') {
    defaultTimeout = 25000;
  }
  const parsedTimeout = env.LONG_POLL_TIMEOUT_MS
    ? Number.parseInt(env.LONG_POLL_TIMEOUT_MS, 10)
    : undefined;
  const longPollTimeoutMs =
    parsedTimeout && !Number.isNaN(parsedTimeout) ? parsedTimeout : defaultTimeout;

  const port = env.PORT ? Number.parseInt(env.PORT, 10) : 8787;
  const relayUrl = env.RELAY_URL ?? 'https://mcp.tether.dev';
  const databaseUrl = env.DATABASE_URL ?? '';

  const kvRestApiUrl = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const kvRestApiToken = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;

  // Default retention: 30 days for managed, 0 days for selfhost (PRD FR-607, FR-608)
  const retentionDays =
    mode === 'selfhost' ? 0 : env.RETENTION_DAYS ? Number.parseInt(env.RETENTION_DAYS, 10) : 30;

  return {
    mode,
    port: Number.isNaN(port) ? 8787 : port,
    relayUrl,
    databaseUrl,
    kvRestApiUrl,
    kvRestApiToken,
    longPollTimeoutMs,
    retentionDays: Number.isNaN(retentionDays) ? 30 : retentionDays,
    jwtPrivateKeyJwk: env.JWT_PRIVATE_KEY_JWK,
    jwtPublicKeyJwk: env.JWT_PUBLIC_KEY_JWK,
  };
}
