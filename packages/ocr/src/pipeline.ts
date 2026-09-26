/**
 * OCR → secret-pattern → redaction-hit pipeline (Prompt 11 §1).
 * Pure and deterministic apart from the injected backend: OCR lines are
 * matched with the FR-509 secret patterns and low-confidence lines are
 * filtered before mapping hits back to image bboxes (HR-7).
 */

import { FallbackOcrBackend } from './backends/fallback.js';
import { TesseractOcrBackend } from './backends/linux.js';
import { MacOcrBackend } from './backends/macos.js';
import { WindowsOcrBackend } from './backends/windows.js';
import { matchOcrLines } from './patterns.js';
import { type OcrBackend, selectBackend } from './select.js';
import { MIN_OCR_CONFIDENCE, type OcrLine, type RedactionResult } from './types.js';

/** Minimum confidence (0..1) an OCR line needs before hits are emitted. */
export { MIN_OCR_CONFIDENCE } from './types.js';

/** Portion of a select() failure surfaced as degradation (never raw text). */
export interface OcrDeps {
  platform?: string;
  backends?: OcrBackend[];
}

export function defaultBackends(): OcrBackend[] {
  return [
    new WindowsOcrBackend(),
    new MacOcrBackend(),
    new TesseractOcrBackend(),
    new FallbackOcrBackend(),
  ];
}

/**
 * Runs OCR on PNG bytes and returns redaction hits in image space.
 * Degrades gracefully — never throws — when no backend can process the
 * image (AC-P11-04).
 */
export async function detectSecretsInImage(
  imageBytes: Uint8Array,
  deps: OcrDeps = {},
): Promise<RedactionResult> {
  if (!imageBytes || imageBytes.length === 0) {
    return { hits: [], degraded: true, reason: 'ocr-input-invalid' };
  }

  let backend: OcrBackend | null = null;
  try {
    backend = selectBackend(deps.backends ?? defaultBackends(), deps.platform ?? process.platform);
  } catch {
    backend = null;
  }

  if (!backend || backend.name === 'fallback') {
    return { hits: [], degraded: true, reason: 'ocr-backend-unavailable' };
  }

  let lines: OcrLine[];
  try {
    lines = await backend.recognize(imageBytes);
  } catch {
    return { hits: [], degraded: true, reason: 'ocr-error' };
  }

  const usable = lines.filter((l) => l.confidence >= MIN_OCR_CONFIDENCE);
  return { hits: matchOcrLines(usable), degraded: false };
}
