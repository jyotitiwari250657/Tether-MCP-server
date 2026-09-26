/**
 * macOS OCR backend — Vision framework via a compiled Swift helper
 * (Prompt 11 §1). Stub for v0.1: reports unavailable so selection falls
 * through to Tesseract / fallback with graceful degradation (AC-P11-04).
 * The helper binary contract is pre-declared here so the backend can be
 * completed without changing the public API.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { OcrBackend } from '../select.js';
import type { OcrLine } from '../types.js';

/** Expected on-disk location of the compiled `ocr-vision` helper. */
export function visionHelperPath(): string {
  return join(process.cwd(), 'packages', 'ocr', 'bin', 'ocr-vision');
}

export class MacOcrBackend implements OcrBackend {
  readonly name = 'macos-vision' as const;

  available(): boolean {
    // v0.1 stub: the swift helper is not shipped or compiled yet.
    return process.platform === 'darwin' && existsSync(visionHelperPath());
  }

  async recognize(_imageBytes: Uint8Array): Promise<OcrLine[]> {
    // Unreachable in v0.1 (available() is false without the helper binary).
    return [];
  }
}
