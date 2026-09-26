/**
 * Daemon OCR Service (Prompt 11 §2, PRD HR-1/HR-7/HR-11, PRV-03, AC-P11-04/05/06).
 * Wraps @tether/ocr and exposes redactImage() over the loopback WS as a
 * daemon-internal service (NOT a tool — no MCP surface, no policy surface).
 *
 * Invariants:
 *  - Image bytes and OCR text NEVER enter audit entries, logs or errors
 *    (PRV-03, HR-7, AC-P11-05).
 *  - Backend failure degrades to { degraded: true } — the caller still gets
 *    the screenshot (AC-P11-04).
 *  - Rate limit 10 calls/min/extension (AC-P11-06).
 */

import {
  type RedactionHit,
  type RedactionResult,
  detectSecretsInImage,
  expandBBox,
  mergeBBoxes,
} from '@tether/ocr';
import { OCR_RATE_LIMIT, OcrRateLimiter } from './rate-limit.js';

/** Extra padding (px) painted around each hit so masks cover anti-aliased edges. */
const MASK_PAD_PX = 4;

export interface RedactImageResult {
  hits: RedactionHit[];
  /** Disjoint, padded rectangles ready for canvas painting. */
  mask: Array<{ x: number; y: number; w: number; h: number }>;
  degraded: boolean;
  reason?: string | undefined;
}

/** Rate-limit refusal surfaced by the router as a RATE_LIMITED error (AC-P11-06). */
export interface RateLimitedRefusal {
  rateLimited: true;
  retryAfterMs: number;
}

export type RedactOutcome = RedactImageResult | RateLimitedRefusal;

export function isRateLimited(o: RedactOutcome): o is RateLimitedRefusal {
  return (o as RateLimitedRefusal).rateLimited === true;
}

export type OcrAuditSink = (entry: {
  tool: string;
  verdict: 'allow' | 'warn';
  hits: number;
  ms: number;
}) => void;

export interface OcrServiceOptions {
  /** Injected audit sink; defaults to console JSON line with no content (PRV-03). */
  audit?: OcrAuditSink | undefined;
  rateLimit?: number | undefined;
  now?: (() => number) | undefined;
  /**
   * Injected detection pipeline (test seam — avoids spawning real OCR
   * backends in unit tests; mirrors the injectable-Clock standard, TRD §4.3.9).
   */
  detect?: ((bytes: Uint8Array) => Promise<RedactionResult>) | undefined;
}

/** Default audit sink: metadata-only JSON line. Never image bytes (AC-P11-05). */
export function consoleAuditSink(entry: {
  tool: string;
  verdict: 'allow' | 'warn';
  hits: number;
  ms: number;
}): void {
  console.log(JSON.stringify(entry));
}

export class OcrService {
  private limiter: OcrRateLimiter;
  private audit: OcrAuditSink;
  private detect: (bytes: Uint8Array) => Promise<RedactionResult>;

  constructor(opts: OcrServiceOptions = {}) {
    this.limiter = new OcrRateLimiter({
      limit: opts.rateLimit ?? OCR_RATE_LIMIT,
      ...(opts.now !== undefined ? { now: opts.now } : {}),
    });
    this.audit = opts.audit ?? consoleAuditSink;
    this.detect = opts.detect ?? detectSecretsInImage;
  }

  /** Current limiter budget (observability only; no content). */
  get remainingCalls(): number {
    return this.limiter.check().remaining;
  }

  async redactImage(imageBytes: Uint8Array): Promise<RedactOutcome> {
    const start = Date.now();

    const verdict = this.limiter.check();
    if (!verdict.allowed) {
      // Refused calls are NOT audited as actions; the router answers with a
      // structured RATE_LIMITED error (AC-P11-06, HR-11).
      return { rateLimited: true, retryAfterMs: verdict.retryAfterMs };
    }
    this.limiter.admit();

    const result = await this.detect(imageBytes);

    // One audit entry per call — counts and durations only (PRV-03, FR-513).
    this.audit({
      tool: 'ocr.redact',
      verdict: result.degraded ? 'warn' : 'allow',
      hits: result.hits.length,
      ms: Date.now() - start,
    });

    return {
      hits: result.hits,
      mask: mergeBBoxes(result.hits.map((h) => ({ ...h, bbox: expandBBox(h.bbox, MASK_PAD_PX) }))),
      degraded: result.degraded,
      reason: result.reason,
    };
  }
}
