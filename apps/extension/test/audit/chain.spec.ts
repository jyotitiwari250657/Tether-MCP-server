// @vitest-environment node
/**
 * Tamper-Evident Audit Chain Tests (PRD FR-512, FR-513, TRD §6.9).
 * Verifies append sequence, SHA-256 hash chaining, verification, tampering detection, and export.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import {
  append,
  clearAuditChain,
  exportHTML,
  exportJSON,
  list,
  verify,
} from '../../lib/audit/chain.js';

describe('Audit Chain (PRD FR-512, FR-513, TRD §6.9)', () => {
  beforeEach(async () => {
    await clearAuditChain();
  });

  test('FR-512: append increments seq starting from 1 with genesis hash', async () => {
    const e1 = await append({
      t: new Date().toISOString(),
      session: 's-1',
      client: 'client-1',
      mode: 'local',
      tool: 'browser_snapshot',
      tier: 0,
      argsDigest: '0'.repeat(64),
      verdict: 'allow',
    });

    expect(e1.seq).toBe(1);
    expect(e1.prevHash).toBe('0'.repeat(64));
    expect(e1.hash).toBeDefined();
    expect(e1.hash.length).toBe(64);

    const e2 = await append({
      t: new Date().toISOString(),
      session: 's-1',
      client: 'client-1',
      mode: 'local',
      tool: 'browser_click',
      tier: 1,
      argsDigest: '0'.repeat(64),
      verdict: 'allow',
    });

    expect(e2.seq).toBe(2);
    expect(e2.prevHash).toBe(e1.hash);
  });

  test('FR-512: verify returns ok=true for valid untampered chain', async () => {
    for (let i = 0; i < 5; i++) {
      await append({
        t: new Date().toISOString(),
        session: 's-1',
        client: 'client-1',
        mode: 'local',
        tool: `tool_${i}`,
        tier: 0,
        argsDigest: '0'.repeat(64),
        verdict: 'allow',
      });
    }

    const res = await verify();
    expect(res.ok).toBe(true);
    expect(res.count).toBe(5);
  });

  test('FR-512: list returns all entries in sequential order', async () => {
    await append({
      t: new Date().toISOString(),
      session: 's-1',
      client: 'c-1',
      mode: 'local',
      tool: 't1',
      tier: 0,
      argsDigest: '0'.repeat(64),
      verdict: 'allow',
    });
    await append({
      t: new Date().toISOString(),
      session: 's-1',
      client: 'c-1',
      mode: 'local',
      tool: 't2',
      tier: 1,
      argsDigest: '0'.repeat(64),
      verdict: 'allow',
    });

    const entries = await list();
    expect(entries.length).toBe(2);
    expect(entries[0]?.seq).toBe(1);
    expect(entries[1]?.seq).toBe(2);
  });

  test('FR-512: list filters entries by range [from, to]', async () => {
    for (let i = 1; i <= 5; i++) {
      await append({
        t: new Date().toISOString(),
        session: 's-1',
        client: 'c-1',
        mode: 'local',
        tool: `t${i}`,
        tier: 0,
        argsDigest: '0'.repeat(64),
        verdict: 'allow',
      });
    }

    const subset = await list({ from: 2, to: 4 });
    expect(subset.length).toBe(3);
    expect(subset.map((e) => e.seq)).toEqual([2, 3, 4]);
  });

  test('FR-512: verify detects tampering when an entry field is modified', async () => {
    await append({
      t: new Date().toISOString(),
      session: 's-1',
      client: 'c-1',
      mode: 'local',
      tool: 't1',
      tier: 0,
      argsDigest: '0'.repeat(64),
      verdict: 'allow',
    });
    const e2 = await append({
      t: new Date().toISOString(),
      session: 's-1',
      client: 'c-1',
      mode: 'local',
      tool: 't2',
      tier: 1,
      argsDigest: '0'.repeat(64),
      verdict: 'allow',
    });

    // Tamper with e2
    (e2 as { verdict: string }).verdict = 'deny';

    const check = await verify();
    expect(check.ok).toBe(false);
    expect(check.brokenAt).toBe(2);
  });

  test('FR-513: exportJSON produces valid parseable JSON array of entries', async () => {
    await append({
      t: new Date().toISOString(),
      session: 's-1',
      client: 'c-1',
      mode: 'local',
      tool: 'export_test',
      tier: 0,
      argsDigest: '0'.repeat(64),
      verdict: 'allow',
    });

    const jsonStr = await exportJSON();
    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]?.tool).toBe('export_test');
  });

  test('FR-513: exportHTML produces valid HTML report with table', async () => {
    await append({
      t: new Date().toISOString(),
      session: 's-1',
      client: 'c-1',
      mode: 'local',
      tool: 'html_test',
      tier: 1,
      argsDigest: '0'.repeat(64),
      verdict: 'allow',
    });

    const html = await exportHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Tether Audit Chain Export');
    expect(html).toContain('html_test');
  });

  test('FR-512: verify returns ok=true with count=0 when chain is empty', async () => {
    const res = await verify();
    expect(res.ok).toBe(true);
    expect(res.count).toBe(0);
  });

  test('FR-512: supports IndexedDB storage when db is provided', async () => {
    const mockStore: unknown[] = [];
    const mockDb = {
      put: async (_name: string, val: unknown) => {
        mockStore.push(val);
      },
      getAll: async (_name: string) => [...mockStore],
      clear: async (_name: string) => {
        mockStore.length = 0;
      },
    } as unknown as Parameters<typeof setTestDb>[0];

    const { setTestDb } = await import('../../lib/audit/chain.js');
    setTestDb(mockDb);

    try {
      const e = await append({
        t: new Date().toISOString(),
        session: 's-idb',
        client: 'c-idb',
        mode: 'local',
        tool: 'db_tool',
        tier: 0,
        argsDigest: '0'.repeat(64),
        verdict: 'allow',
      });
      expect(e.seq).toBe(1);
      expect(mockStore.length).toBe(1);

      const listed = await list();
      expect(listed.length).toBe(1);

      await clearAuditChain();
      expect(mockStore.length).toBe(0);
    } finally {
      setTestDb(null);
    }
  });

  test('FR-512: getDb catches openDB error when indexedDB is unavailable or throws', async () => {
    (globalThis as unknown as { indexedDB?: unknown }).indexedDB = {};
    try {
      const e = await append({
        t: new Date().toISOString(),
        session: 's-catch',
        client: 'c-catch',
        mode: 'local',
        tool: 't',
        tier: 0,
        argsDigest: '0'.repeat(64),
        verdict: 'allow',
      });
      expect(e.seq).toBeGreaterThan(0);
    } finally {
      (globalThis as unknown as { indexedDB?: unknown }).indexedDB = undefined;
    }
  });
});
