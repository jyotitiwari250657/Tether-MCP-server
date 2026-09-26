/**
 * Daemon OCR Service Tests (Prompt 11 §5, PRD HR-7/HR-11, PRV-03).
 * Covers: redaction round-trip, audit emission, image-byte containment
 * (AC-P11-05), and the 10/min rate limit (AC-P11-06).
 */

import type { RedactionResult } from '@tether/ocr';
import { describe, expect, test } from 'vitest';
import { OcrRateLimiter } from '../../src/ocr/rate-limit.js';
import { type OcrAuditSink, OcrService } from '../../src/ocr/service.js';

/** Minimal valid-ish PNG bytes (fixtures are unnecessary for the fake backend path). */
const IMAGE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

/** Deterministic fake pipeline via module-mockable seam: we stub the ocr package. */
const TEST_PAN = '4532015112830366';

describe('OcrRateLimiter (AC-P11-06)', () => {
  test('admits 10 calls then blocks with retryAfterMs, recovering after the window', () => {
    let now = 1_000_000;
    const limiter = new OcrRateLimiter({ now: () => now });

    for (let i = 0; i < 10; i++) {
      const v = limiter.check();
      expect(v.allowed).toBe(true);
      limiter.admit();
    }

    const blocked = limiter.check();
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);

    now += 60_001;
    expect(limiter.check().allowed).toBe(true);
  });
});

describe('OcrService (Prompt 11 §2)', () => {
  /** Deterministic fake pipeline: one PAN hit on the left half of the image. */
  const fakeDetect = async (): Promise<RedactionResult> => ({
    degraded: false,
    hits: [
      {
        kind: 'PAN',
        bbox: { x: 10, y: 10, w: 100, h: 20 },
        confidence: 1,
        replacement: '⟨PAN:visa••••0366⟩',
      },
    ],
  });

  test('redaction round-trip returns hits + padded mask rectangles (injected pipeline)', async () => {
    const svc = new OcrService({ audit: () => {}, detect: fakeDetect });
    const out = await svc.redactImage(IMAGE_BYTES);

    if ('rateLimited' in out) throw new Error('unexpected rate limit on fresh limiter');
    expect(out.degraded).toBe(false);
    expect(out.hits).toHaveLength(1);
    expect(out.hits[0]?.kind).toBe('PAN');
    // Mask rect = hit bbox expanded by 4 px on every side
    expect(out.mask[0]).toEqual({ x: 6, y: 6, w: 108, h: 28 });
  });

  test('emits exactly one audit entry per call with no content fields (PRV-03, AC-P11-05)', async () => {
    const audits: unknown[] = [];
    const sink: OcrAuditSink = (e) => audits.push(e);
    const svc = new OcrService({ audit: sink, detect: fakeDetect });

    await svc.redactImage(IMAGE_BYTES);

    expect(audits).toHaveLength(1);
    const entry = audits[0] as Record<string, unknown>;
    expect(entry.tool).toBe('ocr.redact');
    expect(entry.verdict).toBe('allow');
    expect(entry.hits).toBe(1);
    expect(typeof entry.ms).toBe('number');
    expect(Object.keys(entry).sort()).toEqual(['hits', 'ms', 'tool', 'verdict']);
  });

  test('degraded calls audit verdict warn with zero hits', async () => {
    const audits: unknown[] = [];
    const svc = new OcrService({
      audit: (e) => audits.push(e),
      detect: async () => ({ hits: [], degraded: true, reason: 'ocr-backend-unavailable' }),
    });

    await svc.redactImage(IMAGE_BYTES);

    expect(audits).toHaveLength(1);
    const entry = audits[0] as Record<string, unknown>;
    expect(entry.tool).toBe('ocr.redact');
    expect(entry.verdict).toBe('warn');
    expect(typeof entry.ms).toBe('number');
    expect(Object.keys(entry).sort()).toEqual(['hits', 'ms', 'tool', 'verdict']);
  });

  test('AC-P11-05: image bytes never appear in audit entries, results, or errors', async () => {
    // Give the payload a marker string that must never leak anywhere.
    const marker = 'MARKER-IMAGE-BYTES-7f3a';
    const bytes = new TextEncoder().encode(marker);
    const audits: unknown[] = [];
    const svc = new OcrService({ audit: (e) => audits.push(e), detect: fakeDetect });

    const out = await svc.redactImage(bytes);
    const serializedAudit = JSON.stringify(audits);
    const serializedResult = JSON.stringify(out);

    expect(serializedAudit).not.toContain(marker);
    expect(serializedResult).not.toContain(marker);
    // base64 of the marker must not leak either (wire-format containment)
    expect(serializedResult).not.toContain(Buffer.from(bytes).toString('base64').slice(0, 10));
  });

  test('AC-P11-06: 11th call within one minute is refused with RATE_LIMITED + retryAfterMs', async () => {
    const svc = new OcrService({ audit: () => {}, rateLimit: 10, detect: fakeDetect });

    for (let i = 0; i < 10; i++) {
      const out = await svc.redactImage(IMAGE_BYTES);
      expect('rateLimited' in out).toBe(false);
    }
    // (fake pipeline keeps each call ~0 ms; real-backend timing is covered in packages/ocr)

    const eleventh = await svc.redactImage(IMAGE_BYTES);
    expect('rateLimited' in eleventh).toBe(true);
    if ('rateLimited' in eleventh) {
      expect(eleventh.retryAfterMs).toBeGreaterThan(0);
      expect(eleventh.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  test('refused calls do not emit audit entries (only executed calls are audited)', async () => {
    const audits: unknown[] = [];
    const svc = new OcrService({ audit: (e) => audits.push(e), rateLimit: 1, detect: fakeDetect });

    await svc.redactImage(IMAGE_BYTES);
    await svc.redactImage(IMAGE_BYTES); // refused
    expect(audits).toHaveLength(1);
  });
});

describe('TEST_PAN sanity (FR-509 parity)', () => {
  test('fixture PAN remains Luhn-valid', async () => {
    const { isLuhnValid } = await import('@tether/ocr');
    expect(isLuhnValid(TEST_PAN)).toBe(true);
  });
});
