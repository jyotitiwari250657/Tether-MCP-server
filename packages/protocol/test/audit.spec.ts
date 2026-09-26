import { describe, expect, test } from 'vitest';
import { type AuditEntry, canonicalJson, hashEntry, verifyChain } from '../src/audit.js';

describe('Tamper-Evident Audit Chain & Canonical Serialization (PRD FR-512, TRD §6.9)', () => {
  test('TRD §5.3 / PRD FR-512: canonicalJson produces deterministic bytes regardless of key insertion order', () => {
    const objA = { b: 2, a: 1, c: { z: 26, y: 25 } };
    const objB = { c: { y: 25, z: 26 }, a: 1, b: 2 };

    const jsonA = canonicalJson(objA);
    const jsonB = canonicalJson(objB);

    expect(jsonA).toBe('{"a":1,"b":2,"c":{"y":25,"z":26}}');
    expect(jsonA).toBe(jsonB);
  });

  test('TRD §5.3 / PRD FR-512: canonicalJson handles primitives, arrays and ignores undefined properties', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(false)).toBe('false');
    expect(canonicalJson(-0)).toBe('0');
    expect(canonicalJson(Number.POSITIVE_INFINITY)).toBe('null');
    expect(canonicalJson(123.45)).toBe('123.45');
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalJson([3, undefined, 2])).toBe('[3,null,2]');
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  test('PRD FR-512 / TRD §6.9: Five-entry cryptographic hash chain verifies successfully', async () => {
    const entries: AuditEntry[] = [];
    let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 1; i <= 5; i++) {
      const entryWithoutHash: Omit<AuditEntry, 'hash'> = {
        seq: i,
        t: new Date(1758172800000 + i * 1000).toISOString(),
        session: 'ses_test_001',
        client: 'claude_code',
        mode: 'local',
        tool: `browser_tool_${i}`,
        tier: 0,
        argsDigest: `args_digest_${i}`,
        verdict: 'allow',
        prevHash,
      };

      const hash = await hashEntry(entryWithoutHash, prevHash);
      const fullEntry: AuditEntry = { ...entryWithoutHash, hash };
      entries.push(fullEntry);
      prevHash = hash;
    }

    expect(entries.length).toBe(5);
    const result = await verifyChain(entries);
    expect(result.ok).toBe(true);
    expect(result.brokenAt).toBeUndefined();
  });

  test('PRD FR-512 / TRD §6.9: chain verification detects any byte-level tampering', async () => {
    const entries: AuditEntry[] = [];
    let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 1; i <= 5; i++) {
      const entryWithoutHash: Omit<AuditEntry, 'hash'> = {
        seq: i,
        t: new Date(1758172800000 + i * 1000).toISOString(),
        session: 'ses_test_002',
        client: 'cursor_ide',
        mode: 'local',
        tool: i === 3 ? 'browser_click' : 'browser_snapshot',
        tier: i === 3 ? 1 : 0,
        argsDigest: `digest_${i}`,
        verdict: 'allow',
        prevHash,
      };

      const hash = await hashEntry(entryWithoutHash, prevHash);
      entries.push({ ...entryWithoutHash, hash });
      prevHash = hash;
    }

    // Baseline: chain is intact
    const intactResult = await verifyChain(entries);
    expect(intactResult.ok).toBe(true);

    // Tamper with entry index 2 (the 3rd entry: change verdict from 'allow' to 'denied')
    const tamperedEntries: AuditEntry[] = entries.map((e, idx) => {
      if (idx === 2) {
        return { ...e, verdict: 'denied' };
      }
      return { ...e };
    });

    const tamperedResult = await verifyChain(tamperedEntries);
    expect(tamperedResult.ok).toBe(false);
    expect(tamperedResult.brokenAt).toBe(2);
  });

  test('TRD §5.3 / PRD FR-512: canonicalJson handles special numbers and unsupported types', () => {
    expect(canonicalJson(Number.NaN)).toBe('null');
    expect(canonicalJson(Number.POSITIVE_INFINITY)).toBe('null');
    expect(canonicalJson(-0)).toBe('0');
    expect(canonicalJson(() => {})).toBe('null');
  });

  test('PRD FR-512 / TRD §6.9: verifyChain detects broken previous hash pointer', async () => {
    const entry1: AuditEntry = {
      seq: 1,
      t: new Date(1758172800000).toISOString(),
      session: 'ses_1',
      client: 'claude',
      mode: 'local',
      tool: 'browser_snapshot',
      tier: 0,
      argsDigest: 'd1',
      verdict: 'allow',
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: '',
    };
    const { hash: _h1, ...w1 } = entry1;
    entry1.hash = await hashEntry(w1, entry1.prevHash);

    const entry2: AuditEntry = {
      seq: 2,
      t: new Date(1758172801000).toISOString(),
      session: 'ses_1',
      client: 'claude',
      mode: 'local',
      tool: 'browser_click',
      tier: 1,
      argsDigest: 'd2',
      verdict: 'allow',
      prevHash: 'wrong_prev_hash_pointer', // does not match entry1.hash
      hash: '',
    };
    const { hash: _h2, ...w2 } = entry2;
    entry2.hash = await hashEntry(w2, entry2.prevHash);

    const result = await verifyChain([entry1, entry2]);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  test('PRD FR-512 / TRD §6.9: verifyChain handles empty and sparse chains gracefully', async () => {
    expect(await verifyChain([])).toEqual({ ok: true });
    // Sparse entry check to cover line 100
    const sparse = [undefined as unknown as AuditEntry];
    expect(await verifyChain(sparse)).toEqual({ ok: true });
  });
});
