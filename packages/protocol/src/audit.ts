/**
 * Tamper-Evident Audit Chain & Canonical JSON (TRD §5.3, §6.9, Appendix A, PRD FR-512, FR-513).
 * Provides deterministic serialization and cryptographic SHA-256 hash chaining.
 */

import type { Tier, TransportMode } from './envelope.js';

export interface AuditEntry {
  seq: number;
  t: string; // ISO 8601 string
  session: string;
  client: string;
  mode: TransportMode;
  tool: string;
  tier: Tier;
  argsDigest: string;
  verdict: 'allow' | 'deny' | 'ask' | 'approved' | 'denied' | 'blocked' | 'aborted' | 'complete';
  userApproval?: 'approved' | 'denied' | undefined;
  diffHash?: string | undefined;
  confirmTokenDigest?: string | undefined;
  egressBlocked?: string[] | undefined;
  redactionHits?: { kind: string; count: number }[] | undefined;
  thumbSha?: string | undefined;
  prevHash: string;
  hash: string;
}

/**
 * Deterministically serializes values to canonical JSON per RFC 8785 principles.
 * Lexicographically sorts object keys, removes all extraneous whitespace, and normalizes numbers.
 */
export function canonicalJson(v: unknown): string {
  if (v === null || v === undefined) {
    return 'null';
  }

  const type = typeof v;

  if (type === 'number') {
    if (!Number.isFinite(v)) {
      return 'null';
    }
    return Object.is(v, -0) ? '0' : String(v);
  }

  if (type === 'boolean') {
    return v ? 'true' : 'false';
  }

  if (type === 'string') {
    return JSON.stringify(v);
  }

  if (Array.isArray(v)) {
    const items = v.map((item) => (item === undefined ? 'null' : canonicalJson(item)));
    return `[${items.join(',')}]`;
  }

  if (type === 'object') {
    const record = v as Record<string, unknown>;
    const sortedKeys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();

    const entries = sortedKeys.map((key) => {
      const keyStr = JSON.stringify(key);
      const valStr = canonicalJson(record[key]);
      return `${keyStr}:${valStr}`;
    });

    return `{${entries.join(',')}}`;
  }

  return 'null';
}

/**
 * Computes SHA-256 hash across prevHash + canonicalJson(entry).
 */
export async function hashEntry(
  entry: Omit<AuditEntry, 'hash'>,
  prevHash: string,
): Promise<string> {
  const payload = prevHash + canonicalJson(entry);
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates cryptographic integrity of an audit chain (PRD FR-512, TRD §6.9).
 */
export async function verifyChain(
  entries: AuditEntry[],
): Promise<{ ok: boolean; brokenAt?: number | undefined }> {
  for (let i = 0; i < entries.length; i++) {
    const current = entries[i];
    if (!current) continue;

    // Check link to previous hash
    if (i > 0) {
      const prev = entries[i - 1];
      if (prev && current.prevHash !== prev.hash) {
        return { ok: false, brokenAt: i };
      }
    }

    // Verify self hash
    const { hash, ...withoutHash } = current;
    const computedHash = await hashEntry(withoutHash, current.prevHash);

    if (computedHash !== hash) {
      return { ok: false, brokenAt: i };
    }
  }

  return { ok: true };
}
