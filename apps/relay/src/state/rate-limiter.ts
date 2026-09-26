// TRD §8.6: Sliding Window Rate Limiter using Vercel KV / Redis sorted sets
import { getKv } from './kv.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const kv = getKv();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const setKey = `ratelimit:${key}`;

  // Purge expired elements
  await kv.zremrangebyscore(setKey, 0, windowStart);

  const count = await kv.zcard(setKey);
  const resetAt = Math.floor((now + windowSeconds * 1000) / 1000);

  if (count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Add current hit
  await kv.zadd(setKey, { score: now, member: `${now}:${Math.random()}` });

  return {
    allowed: true,
    remaining: Math.max(0, limit - count - 1),
    resetAt,
  };
}
