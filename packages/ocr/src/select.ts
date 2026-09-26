/**
 * OCR Backend Selection (Prompt 11 §1, select.ts).
 * Picks the best available backend at runtime; NEVER throws on a missing
 * backend — falls through to graceful degradation instead (AC-P11-04).
 */

import type { OcrLine } from './types.js';

/** Uniform interface every backend implements. */
export interface OcrBackend {
  readonly name: 'windows-ocr' | 'macos-vision' | 'linux-tesseract' | 'fallback';
  /** Synchronous capability probe — must not spawn processes. */
  available(): boolean;
  /** Run OCR on PNG bytes; implementations may keep helper processes warm. */
  recognize(imageBytes: Uint8Array): Promise<OcrLine[]>;
  /** Release keep-alive resources (PowerShell child process, etc.). */
  dispose?(): void;
}

/**
 * Ordered platform priority lists (Prompt 11 §1):
 * Windows → Windows.Media.Ocr, then Tesseract, then fallback;
 * macOS → Vision stub, then fallback; Linux → Tesseract, then fallback.
 */
export function backendPriority(platform: string): string[] {
  switch (platform) {
    case 'win32':
      return ['windows-ocr', 'linux-tesseract', 'fallback'];
    case 'darwin':
      return ['macos-vision', 'linux-tesseract', 'fallback'];
    case 'linux':
      return ['linux-tesseract', 'fallback'];
    default:
      return ['fallback'];
  }
}

/**
 * Picks the first available backend from `candidates` according to the
 * platform priority list. A candidate whose `available()` throws is treated
 * as unavailable. Returns `null` only if no candidate matches any priority
 * entry — callers then degrade gracefully.
 */
export function selectBackend<T extends OcrBackend>(candidates: T[], platform: string): T | null {
  const priority = backendPriority(platform);
  for (const wanted of priority) {
    for (const candidate of candidates) {
      if (candidate.name !== wanted) continue;
      try {
        if (candidate.available()) return candidate;
      } catch {
        // A probing crash means "unavailable", never a crash (AC-P11-04)
      }
    }
  }
  return null;
}
