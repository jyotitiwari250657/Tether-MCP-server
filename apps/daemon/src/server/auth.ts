/**
 * Daemon Authentication & Token Manager (PRD FR-301, SEC-07, TRD §7.2).
 * Handles bearer token generation, 24h rotation, constant-time verification, and 0600 permissions.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTetherDir } from '../config.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TokenRecord {
  token: string;
  createdAt: number;
}

export function getTokenPath(): string {
  return join(getTetherDir(), 'token');
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function loadOrCreateToken(): string {
  const tokenPath = getTokenPath();

  if (existsSync(tokenPath)) {
    try {
      const raw = readFileSync(tokenPath, 'utf-8').trim();
      const stat = statSync(tokenPath);
      const isFresh = Date.now() - stat.mtimeMs < TOKEN_TTL_MS;

      if (raw.length >= 32 && isFresh) {
        return raw;
      }
    } catch {
      // Fall through to rotation
    }
  }

  const newToken = generateToken();
  writeFileSync(tokenPath, newToken, { encoding: 'utf-8', mode: 0o600 });
  return newToken;
}

export function verifyToken(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;

  const bufProvided = Buffer.from(provided, 'utf-8');
  const bufExpected = Buffer.from(expected, 'utf-8');

  if (bufProvided.length !== bufExpected.length) {
    return false;
  }

  return timingSafeEqual(bufProvided, bufExpected);
}
