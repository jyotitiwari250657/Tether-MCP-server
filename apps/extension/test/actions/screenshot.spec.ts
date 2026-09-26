// @vitest-environment happy-dom
/**
 * browser_screenshot Tests (Prompt 11 §5, TOOL-R03, PRD SEC-05).
 * Covers: OCR default-on, ocrRedact:false bypass, timeout degradation, and
 * mask-painter behaviour via a recording context (AC-P11-01/02).
 *
 * NOTE: happy-dom has no 2D canvas implementation, so pixel-level checks run
 * in the e2e spec (tests/e2e/scenarios-ocr.spec.ts) on real Chromium.
 */

import { describe, expect, test, vi } from 'vitest';
import { screenshot } from '../../lib/actions/screenshot.js';
import { paintMask, redactScreenshot, requestDaemonOcr } from '../../lib/ocr/client.js';
import type { TransportClient } from '../../lib/transport/client.js';

/** Synthetic tiny PNG data URL (content irrelevant to the mocked paths). */
const SYNTHETIC_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

interface Harness {
  listeners: Map<string, Set<(p: unknown) => void>>;
  sent: string[];
  respond: (msg: Record<string, unknown>) => void;
  transport: TransportClient;
}

function makeTransportHarness(): Harness {
  const listeners = new Map<string, Set<(p: unknown) => void>>();
  const sent: string[] = [];
  const transport = {
    on: (evt: string, handler: (p: unknown) => void) => {
      const set = listeners.get(evt) ?? new Set();
      set.add(handler);
      listeners.set(evt, set);
      return () => set.delete(handler);
    },
    state: 'online',
  } as unknown as TransportClient;
  (transport as unknown as { ws: unknown }).ws = {
    readyState: 1,
    send: (s: string) => sent.push(s),
  };
  return {
    listeners,
    sent,
    respond: (msg) => {
      for (const h of listeners.get('ocr.result') ?? []) h(msg);
    },
    transport,
  };
}

async function waitForSend(h: Harness): Promise<{ reqId: string; image: string }> {
  for (let i = 0; i < 200; i++) {
    const frame = h.sent.find((s) => s.includes('"ocr.redact"'));
    if (frame) return JSON.parse(frame) as { reqId: string; image: string };
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('no ocr.redact frame sent');
}

describe('browser_screenshot action (Prompt 11 §3, TOOL-R03)', () => {
  test('AC-P11-01: default calls the OCR client with the capture bytes (redaction path)', async () => {
    const h = makeTransportHarness();
    const capture = vi.fn(async () => SYNTHETIC_DATA_URL);

    // happy-dom cannot rasterize images (no 2D canvas), so the client
    // exercises its degradation contract: OCR round-trip happens, then the
    // ORIGINAL image is returned with degraded:true. The full redacted-image
    // path (real canvas) is asserted in tests/e2e/scenarios-ocr.spec.ts.
    const pending = screenshot({}, h.transport, capture);
    const { reqId, image } = await waitForSend(h);
    h.respond({
      type: 'ocr.result',
      reqId,
      ok: true,
      degraded: false,
      hits: [
        { bbox: { x: 0, y: 0, w: 4, h: 4 }, kind: 'PAN', confidence: 1, replacement: '⟨PAN⟩' },
      ],
      mask: [{ x: 0, y: 0, w: 4, h: 4 }],
    });
    const res = await pending;

    expect(capture).toHaveBeenCalledTimes(1);
    expect(reqId).toContain('ocr-');
    expect(image.length).toBeGreaterThan(50); // PNG base64 payload sent to daemon
    expect(res.trust).toBe('untrusted');
    // Degraded here ⇒ no hits counted (nothing was actually redacted)
    expect(res.ocrRedactionHits).toBe(0);
    expect(res.ocrDegraded).toBe(true);
    expect(res.dataUrl).toBe(SYNTHETIC_DATA_URL);
  });

  test('AC-P11-02: ocrRedact:false skips the daemon and returns the original image', async () => {
    const h = makeTransportHarness();
    const capture = vi.fn(async () => SYNTHETIC_DATA_URL);

    const res = await screenshot({ ocrRedact: false }, h.transport, capture);

    expect(res.dataUrl).toBe(SYNTHETIC_DATA_URL);
    expect(res.ocrRedactionHits).toBe(0);
    expect(res.ocrDegraded).toBe(false);
    expect(h.sent).toHaveLength(0); // no OCR request left the extension
  });

  test('no transport (daemon offline) → capture still succeeds, degraded:false passthrough', async () => {
    const capture = vi.fn(async () => SYNTHETIC_DATA_URL);
    const res = await screenshot({}, null, capture);
    expect(res.dataUrl).toBe(SYNTHETIC_DATA_URL);
    expect(res.ocrRedactionHits).toBe(0);
  });

  test('requestDaemonOcr resolves null after timeout (8s default; shortened here)', async () => {
    const h = makeTransportHarness();
    const t0 = Date.now();
    const res = await requestDaemonOcr(h.transport, 'aGVsbG8=', 40);
    expect(res).toBeNull();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(35);
  });

  test('redactScreenshot with short timeout → original image + degraded:true', async () => {
    const h = makeTransportHarness();
    const res = await redactScreenshot(h.transport, SYNTHETIC_DATA_URL, { timeoutMs: 40 });
    expect(res.degraded).toBe(true);
    expect(res.redactedDataUrl).toBe(SYNTHETIC_DATA_URL);
    expect(res.hits).toEqual([]);
  });

  test('no active socket → immediate null (no hang)', async () => {
    const h = makeTransportHarness();
    (h.transport as unknown as { ws: null }).ws = null;
    const res = await requestDaemonOcr(h.transport, 'aGVsbG8=', 1000);
    expect(res).toBeNull();
  });

  test('malformed data URL → degraded without any transport traffic', async () => {
    const h = makeTransportHarness();
    const res = await redactScreenshot(h.transport, 'not-a-data-url', { timeoutMs: 50 });
    expect(res.degraded).toBe(true);
    expect(h.sent).toHaveLength(0);
  });
});

describe('paintMask (Prompt 11 §3, blur/black styles)', () => {
  /** Recording 2D context stub — asserts the paint contract without pixels. */
  function recordingCtx() {
    const calls: { op: string; args: unknown[] }[] = [];
    let currentFilter = '';
    const ctx = {
      canvas: { width: 200, height: 100 },
      fillStyle: '',
      // Real canvas filters are unsupported in happy-dom; paintMask probes the
      // setter and fails closed to black. Simulate a filter-capable context
      // via a property accessor so the blur branch is exercised here; the
      // real-filter pixel check lives in the e2e spec.
      get filter() {
        return currentFilter;
      },
      set filter(v: string) {
        currentFilter = v;
      },
      fillRect: (...a: unknown[]) => calls.push({ op: 'fillRect', args: a }),
      drawImage: (...a: unknown[]) => calls.push({ op: 'drawImage', args: a }),
      save: () => calls.push({ op: 'save', args: [] }),
      restore: () => calls.push({ op: 'restore', args: [] }),
      beginPath: () => calls.push({ op: 'beginPath', args: [] }),
      clip: () => calls.push({ op: 'clip', args: [] }),
      rect: (...a: unknown[]) => calls.push({ op: 'rect', args: a }),
    } as unknown as CanvasRenderingContext2D;
    return { ctx, calls, getFilter: () => currentFilter };
  }

  test('black style issues exactly one solid fillRect per mask rect', () => {
    const { ctx, calls } = recordingCtx();
    paintMask(ctx, [{ x: 10, y: 10, w: 30, h: 20 }], 'black');
    const fills = calls.filter((c) => c.op === 'fillRect');
    expect(fills).toHaveLength(1);
    expect(fills[0]?.args).toEqual([10, 10, 30, 20]);
    expect(ctx.fillStyle).toBe('rgb(0, 0, 0)');
  });

  test('blur style clips to the mask rect and draws blurred patches', () => {
    const { ctx, calls } = recordingCtx();
    // happy-dom canvas has no 2D context → stub the tmp canvas used for blurring
    const origCreate = document.createElement.bind(document);
    const spy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tag: string) =>
        tag === 'canvas'
          ? { width: 0, height: 0, getContext: () => ({ drawImage: () => {} }) }
          : origCreate(tag)) as typeof document.createElement);
    try {
      paintMask(ctx, [{ x: 10, y: 10, w: 30, h: 20 }], 'blur');
    } finally {
      spy.mockRestore();
    }
    const ops = calls.map((c) => c.op);
    expect(ops).toContain('save');
    expect(ops).toContain('clip');
    expect(ops).toContain('restore');
    expect(calls.filter((c) => c.op === 'drawImage').length).toBeGreaterThanOrEqual(3);
    expect(ctx.filter).toBe('none'); // filter reset after painting (no bleed)
    expect(calls.filter((c) => c.op === 'clip')).toHaveLength(1);
  });

  test('degenerate masks (zero/negative size after clamp) are skipped safely', () => {
    const { ctx, calls } = recordingCtx();
    paintMask(ctx, [{ x: 0, y: 0, w: 0, h: 0 }], 'blur');
    expect(calls.filter((c) => c.op === 'drawImage')).toHaveLength(0);
  });
});
