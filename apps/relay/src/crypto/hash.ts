// TRD §8.5: Cryptographic hashing and comparison helpers
import { createHash, timingSafeEqual } from 'node:crypto';

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function sha256Base64(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('base64');
}

export function sha256Base64Url(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('base64url');
}

export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function hashRefreshToken(token: string): string {
  return sha256Hex(`refresh:${token}`);
}

export function hashIp(ip: string): string {
  return sha256Hex(`ip:${ip}`);
}

export function generateRefreshToken(): string {
  return `rft_${globalThis.crypto.randomUUID()}_${Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(24))).toString('base64url')}`;
}
