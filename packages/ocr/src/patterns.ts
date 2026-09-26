/**
 * Secret pattern matchers for OCR text (Prompt 11 §1, PRD FR-509 / HR-7 / SEC-05).
 *
 * These MUST stay semantically identical to the extension text redactor
 * (`apps/extension/lib/redact/detectors.ts`) — same shapes, same Luhn check,
 * same replacement labels. The extension bundle is unaffected: this copy lives
 * in the daemon-only @tether/ocr package so the extension gains zero bytes
 * (AC-P11-03).
 */

import type { BBox, OcrLine, RedactionHit, SecretKind } from './types.js';

/** Luhn checksum (ISO/IEC 7812-1) — identical algorithm to the text redactor. */
export function isLuhnValid(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number.parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function getCardBrand(digits: string): string {
  if (digits.startsWith('4')) return 'visa';
  if (
    /^5[1-5]/.test(digits) ||
    /^2(22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[0-1][0-9]|720)/.test(digits)
  ) {
    return 'mastercard';
  }
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^6(011|5)/.test(digits)) return 'discover';
  return 'card';
}

interface SpanMatch {
  kind: SecretKind;
  start: number;
  end: number;
  replacement: string;
}

/** Applies every secret pattern to one OCR text line; spans are non-overlapping. */
export function detectSecretsInText(text: string): SpanMatch[] {
  if (!text) return [];

  const hits: SpanMatch[] = [];

  // 1. Private key blocks
  const privKeyRe = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
  let m = privKeyRe.exec(text);
  while (m !== null) {
    hits.push({
      kind: 'PRIVATEKEY',
      start: m.index,
      end: m.index + m[0].length,
      replacement: '⟨PRIVATEKEY⟩',
    });
    m = privKeyRe.exec(text);
  }

  // 2. Bearer / JWT tokens
  const bearerRe = /\bBearer\s+([A-Za-z0-9_\-.~+/]+=*)/gi;
  m = bearerRe.exec(text);
  while (m !== null) {
    hits.push({
      kind: 'TOKEN',
      start: m.index,
      end: m.index + m[0].length,
      replacement: '⟨TOKEN⟩',
    });
    m = bearerRe.exec(text);
  }
  const jwtRe = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
  m = jwtRe.exec(text);
  while (m !== null) {
    hits.push({
      kind: 'TOKEN',
      start: m.index,
      end: m.index + m[0].length,
      replacement: '⟨TOKEN⟩',
    });
    m = jwtRe.exec(text);
  }

  // 3. API key shapes
  const apiKeyRe = /\b((?:sk|pk|ghp|gho|xox[baprs]|AKIA|AIza)[-_A-Za-z0-9]{16,})\b/g;
  m = apiKeyRe.exec(text);
  while (m !== null) {
    const raw = m[1] ?? '';
    const prefix = raw.split('_')[0] ?? raw.slice(0, 4);
    hits.push({
      kind: 'APIKEY',
      start: m.index,
      end: m.index + m[0].length,
      replacement: `⟨APIKEY:${prefix}⟩`,
    });
    m = apiKeyRe.exec(text);
  }

  // 4. IBAN
  const ibanRe = /\b([A-Z]{2}[0-9]{2}[A-Z0-9]{11,30})\b/g;
  m = ibanRe.exec(text);
  while (m !== null) {
    hits.push({
      kind: 'IBAN',
      start: m.index,
      end: m.index + m[0].length,
      replacement: '⟨IBAN:••••⟩',
    });
    m = ibanRe.exec(text);
  }

  // 5. PAN: 13–19 digit runs with optional spaces/dashes, Luhn-valid
  const panRe = /\b(?:\d[ -]*?){13,19}\b/g;
  m = panRe.exec(text);
  while (m !== null) {
    const raw = m[0];
    const digits = raw.replace(/[\s-]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && isLuhnValid(digits)) {
      const brand = getCardBrand(digits);
      const last4 = digits.slice(-4);
      hits.push({
        kind: 'PAN',
        start: m.index,
        end: m.index + raw.length,
        replacement: `⟨PAN:${brand}••••${last4}⟩`,
      });
    }
    m = panRe.exec(text);
  }

  // 6. Email
  const emailRe = /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  m = emailRe.exec(text);
  while (m !== null) {
    const user = m[1] ?? '';
    const domain = m[2] ?? '';
    hits.push({
      kind: 'EMAIL',
      start: m.index,
      end: m.index + m[0].length,
      replacement: `⟨EMAIL:${user.charAt(0)}•••@${domain}⟩`,
    });
    m = emailRe.exec(text);
  }

  // 7. Phone
  const phoneRe = /(?:\+?(\d{1,3}))?[-.\s]?(?:\(?(\d{3})\)?)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g;
  m = phoneRe.exec(text);
  while (m !== null) {
    const digits = m[0].trim().replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      hits.push({
        kind: 'PHONE',
        start: m.index,
        end: m.index + m[0].length,
        replacement: `⟨PHONE:•••${digits.slice(-4)}⟩`,
      });
    }
    m = phoneRe.exec(text);
  }

  // Sort ascending; drop overlapping spans (same policy as the text redactor)
  hits.sort((a, b) => a.start - b.start);
  const nonOverlapping: SpanMatch[] = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.start >= lastEnd) {
      nonOverlapping.push(h);
      lastEnd = h.end;
    }
  }
  return nonOverlapping;
}

/**
 * Maps text spans inside OCR lines back to image-space bounding boxes.
 * A proportional estimate covers multi-line contexts where the backend merges
 * or splits words; when the span covers the whole line the bbox is exact.
 */
export function spanToBBox(line: OcrLine, span: { start: number; end: number }): BBox {
  const { text, bbox } = line;
  const len = Math.max(1, text.length);
  const startFrac = Math.min(1, Math.max(0, span.start / len));
  const endFrac = Math.min(1, Math.max(0, span.end / len));
  return {
    x: Math.round(bbox.x + startFrac * bbox.w),
    y: bbox.y,
    w: Math.max(1, Math.round((endFrac - startFrac) * bbox.w)),
    h: bbox.h,
  };
}

/** Runs the pattern matchers over every OCR line and returns image-space hits. */
export function matchOcrLines(lines: OcrLine[]): RedactionHit[] {
  const out: RedactionHit[] = [];
  for (const line of lines) {
    for (const span of detectSecretsInText(line.text)) {
      out.push({
        bbox: spanToBBox(line, span),
        kind: span.kind,
        confidence: line.confidence,
        replacement: span.replacement,
      });
    }
  }
  return out;
}
