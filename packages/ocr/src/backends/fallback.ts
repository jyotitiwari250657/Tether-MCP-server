/**
 * Fallback OCR backend (Prompt 11 §1, AC-P11-04).
 * Always "available"; returns no lines with a structured degrade reason so
 * callers still get the screenshot and the model is warned via openWorldHint.
 */

import type { OcrBackend } from '../select.js';
import type { OcrLine } from '../types.js';

export class FallbackOcrBackend implements OcrBackend {
  readonly name = 'fallback' as const;

  available(): boolean {
    return true;
  }

  async recognize(_imageBytes: Uint8Array): Promise<OcrLine[]> {
    return [];
  }
}
