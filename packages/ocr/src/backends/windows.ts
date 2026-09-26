/**
 * Windows OCR Backend — Windows.Media.Ocr via a PowerShell/WinRT bridge
 * (Prompt 11 §1, AC-P11-01). The helper script `scripts/ocr.ps1` runs in a
 * single keep-alive child process; images stream in as base64 on stdin and
 * JSON line results stream back on stdout, avoiding the ~400 ms PowerShell
 * cold start on every call.
 *
 * Everything runs locally (PRD HR-1, HR-13, NG-11): the child process is
 * `powershell.exe` executing a file shipped inside this package, with no
 * network access. Raw OCR text never enters logs or errors (PRD HR-7).
 */

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OcrBackend } from '../select.js';
import type { OcrLine } from '../types.js';

const SCRIPT_NAME = 'ocr.ps1';
const READY_TIMEOUT_MS = 60_000;
const REQ_TIMEOUT_MS = 20_000;

/** Resolves the shipped helper script relative to this module's build output. */
export function helperScriptPath(): string | null {
  try {
    // dist/backends/windows.js → packages/ocr/scripts/ocr.ps1
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, '..', '..', 'scripts', SCRIPT_NAME),
      join(here, '..', '..', '..', 'packages', 'ocr', 'scripts', SCRIPT_NAME),
      join(process.cwd(), 'packages', 'ocr', 'scripts', SCRIPT_NAME),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return null;
  } catch {
    return null;
  }
}

interface PendingRequest {
  resolve: (lines: OcrLine[]) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface OcrJsonLine {
  ok: boolean;
  error?: string | undefined;
  lines?:
    | Array<{
        text: string;
        bbox: { x: number; y: number; w: number; h: number };
        confidence: number;
      }>
    | undefined;
}

export class WindowsOcrBackend implements OcrBackend {
  readonly name = 'windows-ocr' as const;
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = '';
  private ready = false;
  private readyWaiters: Array<{
    resolve: () => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private lastError: string | null = null;

  available(): boolean {
    if (process.platform !== 'win32') return false;
    if (this.lastError) return false;
    return helperScriptPath() !== null;
  }

  private script(): string {
    const p = helperScriptPath();
    if (!p) throw new Error('ocr.ps1 not found');
    return p;
  }

  private ensureChild(): ChildProcessWithoutNullStreams {
    if (this.child && this.child.exitCode === null) return this.child;

    const script = this.script();
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-File', script],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );

    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => this.onStdout(chunk));
    child.stderr.on('data', (chunk: string) => {
      // Aggregated only; raw page-derived text is never logged (HR-7)
      this.lastError = `ocr-bridge-stderr(${chunk.length} bytes)`;
    });
    child.on('error', (err: Error) => {
      this.lastError = err.message.slice(0, 120);
      this.failAll(new Error('ocr-bridge-spawn-failed'));
      this.child = null;
    });
    child.on('exit', () => {
      this.failAll(new Error('ocr-bridge-exited'));
      this.ready = false;
      this.child = null;
    });

    this.child = child;
    this.buffer = '';
    this.ready = false;
    return child;
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let idx = this.buffer.indexOf('\n');
    while (idx >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line.length > 0) this.handleLine(line);
      idx = this.buffer.indexOf('\n');
    }
  }

  private handleLine(line: string): void {
    if (line === 'READY') {
      this.ready = true;
      for (const w of this.readyWaiters.splice(0)) {
        clearTimeout(w.timer);
        w.resolve();
      }
      return;
    }

    let msg: OcrJsonLine | null = null;
    try {
      msg = JSON.parse(line) as OcrJsonLine;
    } catch {
      return; // Ignore malformed bridge output
    }

    const id = (msg as unknown as { id?: number }).id;
    if (typeof id !== 'number') return;
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);

    if (!msg.ok) {
      // Structured degradation, never raw content (HR-11, HR-7)
      pending.reject(new Error('ocr-bridge-error'));
      return;
    }

    const lines: OcrLine[] = [];
    for (const l of msg.lines ?? []) {
      if (typeof l?.text !== 'string') continue;
      const b = l.bbox ?? { x: 0, y: 0, w: 0, h: 0 };
      lines.push({
        text: l.text,
        bbox: { x: b.x, y: b.y, w: b.w, h: b.h },
        confidence: typeof l.confidence === 'number' ? l.confidence : 1,
      });
    }
    pending.resolve(lines);
  }

  private failAll(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  private waitReady(timeoutMs = READY_TIMEOUT_MS): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w.timer !== timer);
        reject(new Error('ocr-bridge-ready-timeout'));
      }, timeoutMs);
      this.readyWaiters.push({ resolve, reject, timer });
    });
  }

  async recognize(imageBytes: Uint8Array): Promise<OcrLine[]> {
    if (imageBytes.length === 0) return [];
    const child = this.ensureChild();
    await this.waitReady();

    const id = this.nextId++;
    const payload = Buffer.from(imageBytes).toString('base64');
    const line = `${JSON.stringify({ id, image: payload })}\n`;

    return new Promise<OcrLine[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('ocr-bridge-request-timeout'));
      }, REQ_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(line);
    });
  }

  dispose(): void {
    this.failAll(new Error('ocr-bridge-disposed'));
    if (this.child) {
      try {
        this.child.kill();
      } catch {
        // Ignore
      }
      this.child = null;
    }
    this.ready = false;
  }
}
