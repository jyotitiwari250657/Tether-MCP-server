/**
 * Linux OCR backend — Tesseract CLI subprocess (Prompt 11 §1).
 * Delegates to the `tesseract` binary when installed; used as the fallback
 * OCR engine on every platform when the native backend is unavailable.
 */

import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import type { OcrBackend } from '../select.js';
import type { OcrLine } from '../types.js';

const TESSERACT_TIMEOUT_MS = 15_000;

/** Probe for the tesseract binary without capturing user-visible output. */
export function tesseractAvailable(): boolean {
  try {
    const res = spawnSync('tesseract', ['--version'], {
      timeout: 3000,
      encoding: 'utf-8',
      windowsHide: true,
    });
    return !res.error;
  } catch {
    return false;
  }
}

/**
 * Tesseract TSV columns (per word): level, page, block, par, line, word,
 * left, top, width, height, conf, text.
 */
interface TsvWord {
  level: string;
  left: string;
  top: string;
  width: string;
  height: string;
  conf: string;
  text: string;
}

/** Groups TSV word rows into lines and maps them to OcrLine records. */
export function tsvToLines(tsv: string): OcrLine[] {
  const rows = tsv.split(/\r?\n/).slice(1); // drop header
  const byLine = new Map<string, TsvWord[]>();

  for (const row of rows) {
    if (!row.trim()) continue;
    const cols = row.split('\t');
    if (cols.length < 12) continue;
    const text = (cols[11] ?? '').trim();
    if (!text) continue;
    const key = `${cols[2] ?? '0'}:${cols[3] ?? '0'}:${cols[4] ?? '0'}`;
    const list = byLine.get(key) ?? [];
    list.push({
      level: cols[0] ?? '5',
      left: cols[6] ?? '0',
      top: cols[7] ?? '0',
      width: cols[8] ?? '0',
      height: cols[9] ?? '0',
      conf: cols[10] ?? '-1',
      text,
    });
    byLine.set(key, list);
  }

  const lines: OcrLine[] = [];
  for (const words of byLine.values()) {
    if (words.length === 0) continue;
    const text = words
      .map((w) => w.text)
      .join(' ')
      .trim();
    if (!text) continue;
    const x = Math.min(...words.map((w) => Number.parseInt(w.left, 10) || 0));
    const y = Math.min(...words.map((w) => Number.parseInt(w.top, 10) || 0));
    const right = Math.max(
      ...words.map((w) => (Number.parseInt(w.left, 10) || 0) + (Number.parseInt(w.width, 10) || 0)),
    );
    const bottom = Math.max(
      ...words.map((w) => (Number.parseInt(w.top, 10) || 0) + (Number.parseInt(w.height, 10) || 0)),
    );
    const confRaw = Number.parseFloat(words[0]?.conf ?? '-1');
    const confidence = Number.isFinite(confRaw) && confRaw >= 0 ? Math.min(1, confRaw / 100) : 1;
    lines.push({
      text,
      bbox: { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) },
      confidence,
    });
  }
  return lines;
}

export class TesseractOcrBackend implements OcrBackend {
  readonly name = 'linux-tesseract' as const;
  private probed = false;
  private probeResult = false;

  available(): boolean {
    if (!this.probed) {
      this.probed = true;
      this.probeResult = tesseractAvailable();
    }
    return this.probeResult;
  }

  async recognize(imageBytes: Uint8Array): Promise<OcrLine[]> {
    if (imageBytes.length === 0) return [];

    return new Promise<OcrLine[]>((resolve, reject) => {
      const child = spawn('tesseract', ['stdin', 'stdout', '--tsv'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            child.kill();
          } catch {
            /* ignore */
          }
          reject(new Error('tesseract-timeout'));
        }
      }, TESSERACT_TIMEOUT_MS);

      child.stdout.setEncoding('utf-8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.resume(); // tesseract writes progress to stderr; discard (HR-7)
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('tesseract-spawn-failed'));
      });
      child.on('close', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          resolve(tsvToLines(stdout));
        } catch {
          reject(new Error('tesseract-parse-failed'));
        }
      });

      child.stdin.write(Buffer.from(imageBytes));
      child.stdin.end();
    });
  }
}
