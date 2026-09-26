/**
 * OCR Pipeline Tests (Prompt 11 §5, PRD SEC-05/FR-509, AC-P11-01, AC-P11-04).
 * Uses committed synthetic fixtures (no real PII) plus injected fake backends
 * for deterministic confidence / degradation paths.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { FallbackOcrBackend } from '../src/backends/fallback.js';
import { detectSecretsInText, matchOcrLines, spanToBBox } from '../src/patterns.js';
import { detectSecretsInImage } from '../src/pipeline.js';
import type { OcrBackend } from '../src/select.js';
import { MIN_OCR_CONFIDENCE, type OcrLine } from '../src/types.js';

const FIXTURES = join(__dirname, 'fixtures');

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, `${name}.png`)));
}

/** Deterministic fake backend returning canned OCR lines. */
function fakeBackend(lines: OcrLine[], name: OcrBackend['name'] = 'windows-ocr'): OcrBackend {
  return {
    name,
    available: () => true,
    recognize: async () => lines,
  };
}

const TEST_PAN = '4532015112830366'; // Luhn-valid test constant (see fixtures)

describe('OCR pattern matching (FR-509 parity)', () => {
  test('FR-509: PAN in text is detected with Luhn validation and brand', () => {
    const hits = detectSecretsInText(`Card ${TEST_PAN} please`);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.kind).toBe('PAN');
    expect(hits[0]?.replacement).toBe('⟨PAN:visa••••0366⟩');
  });

  test('FR-509: email, bearer, api key and iban shapes are detected', () => {
    expect(detectSecretsInText('mail user@example.com now')[0]?.kind).toBe('EMAIL');
    expect(detectSecretsInText('Authorization: Bearer abc123XYZ')[0]?.kind).toBe('TOKEN');
    expect(detectSecretsInText('key sk_test_4eC39HqLyjWDarjtT1zdp7dc')[0]?.kind).toBe('APIKEY');
    expect(detectSecretsInText('IBAN GB82WEST12345698765432')[0]?.kind).toBe('IBAN');
  });

  test('FR-509: plain text yields no hits (no false positives)', () => {
    expect(detectSecretsInText('Quarterly revenue exceeded expectations')).toEqual([]);
  });
});

describe('bbox mapping (Prompt 11 §1)', () => {
  test('span covering the whole line maps to the full line bbox', () => {
    const line: OcrLine = {
      text: '4532015112830366',
      bbox: { x: 100, y: 50, w: 300, h: 20 },
      confidence: 1,
    };
    const hits = matchOcrLines([line]);
    expect(hits[0]?.bbox).toEqual({ x: 100, y: 50, w: 300, h: 20 });
  });

  test('partial span maps proportionally into the line bbox within 5 px', () => {
    const line: OcrLine = {
      text: 'Card 4532015112830366 ends',
      bbox: { x: 0, y: 40, w: 500, h: 30 },
      confidence: 1,
    };
    const hits = matchOcrLines([line]);
    const bb = hits[0]?.bbox;
    expect(bb).toBeDefined();
    if (!bb) return;
    // Digits span chars 5..21 of 26 (≈ 96 px offset, ≈ 308 px wide) — ±5 px
    expect(Math.abs(bb.x - 96)).toBeLessThanOrEqual(5);
    expect(Math.abs(bb.w - 308)).toBeLessThanOrEqual(5);
    expect(spanToBBox(line, { start: 0, end: line.text.length })).toEqual(line.bbox);
  });
});

describe('detectSecretsInImage (Prompt 11 §1, AC-P11-01/04)', () => {
  test('SEC-05: PAN rendered in a fixture image is detected (live backend or skipped)', async () => {
    const res = await detectSecretsInImage(loadFixture('pan'));
    if (res.degraded) {
      expect(res.reason).toBe('ocr-backend-unavailable');
      return; // CI without a native OCR backend degrades gracefully
    }
    expect(res.hits.some((h) => h.kind === 'PAN')).toBe(true);
  }, 30_000);

  test('SEC-05: multiple secrets in one image all produce hits', async () => {
    const res = await detectSecretsInImage(loadFixture('multi'));
    if (res.degraded) return;
    const kinds = res.hits.map((h) => h.kind).sort();
    expect(kinds).toEqual(['EMAIL', 'PAN']);
  }, 30_000);

  test('SEC-05: plain-text image produces no hits (false-positive guard)', async () => {
    const res = await detectSecretsInImage(loadFixture('plain'));
    if (res.degraded) return;
    expect(res.hits).toEqual([]);
  }, 30_000);

  test('AC-P11-04: fallback-only backend degrades with structured reason', async () => {
    const res = await detectSecretsInImage(loadFixture('pan'), {
      backends: [new FallbackOcrBackend()],
    });
    expect(res).toEqual({ hits: [], degraded: true, reason: 'ocr-backend-unavailable' });
  });

  test('low-confidence OCR lines (< 0.6) are filtered out before matching', async () => {
    const res = await detectSecretsInImage(new Uint8Array([1, 2, 3]), {
      backends: [
        fakeBackend([
          { text: `Card ${TEST_PAN}`, bbox: { x: 0, y: 0, w: 200, h: 30 }, confidence: 0.55 },
        ]),
      ],
    });
    expect(res.hits).toEqual([]);
    expect(res.degraded).toBe(false);
  });

  test('confidence at exactly MIN_OCR_CONFIDENCE is accepted (boundary)', async () => {
    const res = await detectSecretsInImage(new Uint8Array([1, 2, 3]), {
      backends: [
        fakeBackend([
          { text: TEST_PAN, bbox: { x: 0, y: 0, w: 200, h: 30 }, confidence: MIN_OCR_CONFIDENCE },
        ]),
      ],
    });
    expect(res.hits).toHaveLength(1);
  });

  test('empty image bytes degrade without crashing', async () => {
    const res = await detectSecretsInImage(new Uint8Array([]));
    expect(res).toEqual({ hits: [], degraded: true, reason: 'ocr-input-invalid' });
  });

  test('AC-P11-04: backend that throws degrades with ocr-error, never crashes', async () => {
    const throwing: OcrBackend = {
      name: 'windows-ocr',
      available: () => true,
      recognize: async () => {
        throw new Error('bridge exploded');
      },
    };
    const res = await detectSecretsInImage(new Uint8Array([9, 9, 9]), { backends: [throwing] });
    expect(res).toEqual({ hits: [], degraded: true, reason: 'ocr-error' });
  });

  test('available() that throws is treated as unavailable (select never throws)', async () => {
    const res = await detectSecretsInImage(new Uint8Array([9, 9, 9]), {
      backends: [
        {
          name: 'windows-ocr',
          available: () => {
            throw new Error('probe fail');
          },
          recognize: async () => [],
        },
        new FallbackOcrBackend(),
      ],
    });
    expect(res).toEqual({ hits: [], degraded: true, reason: 'ocr-backend-unavailable' });
  });
});
