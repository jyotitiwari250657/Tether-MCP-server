/**
 * OCR Redaction Types (Prompt 11 §1, PRD SEC-05 residual-risk mitigation, TRD §6.7).
 * OCR runs locally in the daemon — no page content or image bytes ever leave the
 * machine (PRD HR-1, HR-13, NG-10, NG-11).
 */

/** Axis-aligned bounding box in image pixel coordinates (origin top-left). */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Kinds of secrets recognised in OCR text. Mirrors the text redactor (FR-509). */
export type SecretKind = 'PAN' | 'EMAIL' | 'PHONE' | 'IBAN' | 'TOKEN' | 'APIKEY' | 'PRIVATEKEY';

/**
 * One detected secret inside an image.
 * `replacement` is a non-reversible mask label — the raw value never crosses
 * a trust boundary (PRD HR-7).
 */
export interface RedactionHit {
  bbox: BBox;
  kind: SecretKind;
  /** OCR confidence for the source line, 0..1. */
  confidence: number;
  replacement: string;
}

/** One line of OCR output with its bounding box. */
export interface OcrLine {
  text: string;
  bbox: BBox;
  /** Backend-reported confidence, 0..1. Backends without confidence report 1. */
  confidence: number;
}

/** Degradation reason codes (Prompt 11 §1 graceful degradation). */
export type OcrDegradedReason = 'ocr-backend-unavailable' | 'ocr-error' | 'ocr-input-invalid';

/** Result of running the full OCR → pattern-match pipeline. */
export interface RedactionResult {
  hits: RedactionHit[];
  degraded: boolean;
  reason?: OcrDegradedReason | undefined;
}

/** Minimum OCR line confidence required before a hit is emitted. */
export const MIN_OCR_CONFIDENCE = 0.6;
