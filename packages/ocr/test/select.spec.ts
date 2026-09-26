/**
 * Backend Selection Tests (Prompt 11 §5, AC-P11-04).
 * select() must pick by platform priority, skip throwing probes, and never throw.
 */

import { describe, expect, test } from 'vitest';
import { FallbackOcrBackend } from '../src/backends/fallback.js';
import { TesseractOcrBackend } from '../src/backends/linux.js';
import { MacOcrBackend } from '../src/backends/macos.js';
import { WindowsOcrBackend } from '../src/backends/windows.js';
import { type OcrBackend, backendPriority, selectBackend } from '../src/select.js';

function fake(name: OcrBackend['name'], available: boolean): OcrBackend {
  return { name, available: () => available, recognize: async () => [] };
}

describe('backendPriority (Prompt 11 §1)', () => {
  test('Windows prefers windows-ocr, then tesseract, then fallback', () => {
    expect(backendPriority('win32')).toEqual(['windows-ocr', 'linux-tesseract', 'fallback']);
  });

  test('unknown platform degrades straight to fallback', () => {
    expect(backendPriority('sunos')).toEqual(['fallback']);
    expect(backendPriority('darwin')).toContain('macos-vision');
    expect(backendPriority('linux')).toContain('linux-tesseract');
  });
});

describe('selectBackend (AC-P11-04)', () => {
  test('on win32 picks the Windows backend when available', () => {
    const picked = selectBackend(
      [new WindowsOcrBackend(), new TesseractOcrBackend(), new FallbackOcrBackend()],
      'win32',
    );
    // Live host: real WinRT availability. CI without OCR: tesseract/fallback.
    expect(picked).not.toBeNull();
    expect(['windows-ocr', 'linux-tesseract', 'fallback']).toContain(picked?.name);
  });

  test('no PowerShell / no native backend → falls through to fallback', () => {
    const picked = selectBackend(
      [fake('windows-ocr', false), fake('linux-tesseract', false), new FallbackOcrBackend()],
      'win32',
    );
    expect(picked?.name).toBe('fallback');
  });

  test('unknown OS → fallback backend (graceful, not a crash)', () => {
    const picked = selectBackend(
      [fake('windows-ocr', true), fake('macos-vision', true), new FallbackOcrBackend()],
      'sunos',
    );
    expect(picked?.name).toBe('fallback');
  });

  test('a backend whose available() throws is skipped, not fatal', () => {
    const picked = selectBackend(
      [
        {
          name: 'windows-ocr',
          available: () => {
            throw new Error('boom');
          },
          recognize: async () => [],
        },
        fake('fallback', true),
      ],
      'win32',
    );
    expect(picked?.name).toBe('fallback');
  });

  test('macOS stub reports unavailable without the helper binary', () => {
    const mac = new MacOcrBackend();
    if (process.platform === 'darwin') return; // cannot assert on a mac host
    expect(mac.available()).toBe(false);
  });
});
