/**
 * Extension OCR Client (Prompt 11 §3, PRD HR-7/HR-9, SEC-05, AC-P11-03/04).
 * Sends screenshot PNG bytes to the daemon over the existing loopback WS and
 * paints the returned mask onto an offscreen canvas. Orchestration only —
 * all OCR runs in the daemon (@tether/ocr is a daemon-only dep), so the
 * extension bundle grows by ~2 KB (AC-P11-03).
 *
 * Degradation contract: on timeout, transport failure, or degraded daemon
 * response, the ORIGINAL image is returned with degraded:true — the caller
 * still gets a screenshot (openWorldHint already warns the model).
 */

import type { TransportClient } from '../transport/client.js';

/**
 * Wire shape of an OCR hit (Prompt 11 §2). Mirrors the canonical type defined
 * in packages/ocr (daemon-side); re-declared here structurally because
 * @tether/ocr is a daemon-only dependency and MUST NOT be bundled into the
 * extension (AC-P11-03). The authoritative definition stays in the ocr package.
 */
export interface OcrHitDTO {
  bbox: { x: number; y: number; w: number; h: number };
  kind: string;
  confidence: number;
  replacement: string;
}

export type RedactStyle = 'blur' | 'black';

export interface RedactScreenshotResult {
  redactedDataUrl: string;
  hits: OcrHitDTO[];
  degraded: boolean;
}

const OCR_TIMEOUT_MS = 8_000;

interface OcrResultMessage {
  type: 'ocr.result';
  reqId: string;
  ok: boolean;
  hits?: OcrHitDTO[];
  mask?: Array<{ x: number; y: number; w: number; h: number }>;
  degraded?: boolean;
  reason?: string;
  error?: { code: string; message: string };
}

let reqCounter = 0;

/** Sends {type:'ocr.redact'} over the transport and awaits the matching result. */
export async function requestDaemonOcr(
  transport: TransportClient,
  imageBase64: string,
  timeoutMs = OCR_TIMEOUT_MS,
): Promise<OcrResultMessage | null> {
  const reqId = `ocr-${Date.now().toString(36)}-${++reqCounter}`;

  return new Promise<OcrResultMessage | null>((resolve) => {
    const timer = setTimeout(() => {
      off();
      resolve(null); // timeout → degraded
    }, timeoutMs);

    const off = transport.on('ocr.result', (payload) => {
      const msg = payload as OcrResultMessage;
      if (msg && msg.reqId === reqId) {
        clearTimeout(timer);
        off();
        resolve(msg);
      }
    });

    const ws = (transport as unknown as { ws?: WebSocket | null }).ws;
    if (!ws || ws.readyState !== 1) {
      clearTimeout(timer);
      off();
      resolve(null);
      return;
    }
    try {
      ws.send(JSON.stringify({ type: 'ocr.redact', reqId, image: imageBase64 }));
    } catch {
      clearTimeout(timer);
      off();
      resolve(null);
    }
  });
}

/** Allocates a scratch canvas that works in both SW (OffscreenCanvas) and DOM. */
function makeScratchCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

/** Paints mask rectangles onto a canvas context (blur kernel or solid black). */
export function paintMask(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  mask: Array<{ x: number; y: number; w: number; h: number }>,
  style: RedactStyle,
): void {
  for (const r of mask) {
    // 12 px box blur, clipped to the mask rect (Prompt 11 §3).
    // Blur support is probed: if the runtime has no canvas filter support we
    // FAIL CLOSED to solid black — an unredacted secret must never survive.
    ctx.filter = 'blur(12px)';
    const blurOk = style === 'blur' && ctx.filter !== 'none';
    ctx.filter = 'none';

    if (!blurOk) {
      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      continue;
    }

    const pad = 12;
    const sx = Math.max(0, r.x - pad);
    const sy = Math.max(0, r.y - pad);
    const sw = Math.min(ctx.canvas.width - sx, r.w + pad * 2);
    const sh = Math.min(ctx.canvas.height - sy, r.h + pad * 2);
    if (sw <= 0 || sh <= 0) continue;

    const tmp = makeScratchCanvas(sw, sh);
    const tctx = tmp?.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!tmp || !tctx) continue;
    tctx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    // Three offset box-blur passes approximate a Gaussian kernel (radius 12)
    ctx.filter = 'blur(12px)';
    ctx.drawImage(tmp as CanvasImageSource, sx, sy);
    ctx.drawImage(tmp as CanvasImageSource, sx - 2, sy);
    ctx.drawImage(tmp as CanvasImageSource, sx + 2, sy);
    ctx.restore();
    ctx.filter = 'none';
  }
}

/** Encodes image bytes as a PNG data URL (chunked — safe in SW, no FileReader). */
function bytesToPngDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

/**
 * Rasterizes the source PNG, paints the mask, and re-encodes.
 * Uses OffscreenCanvas + createImageBitmap — the ONLY canvas path available
 * inside an MV3 service worker (no DOM). Returns null on any failure.
 */
async function maskToDataUrl(
  dataUrl: string,
  mask: Array<{ x: number; y: number; w: number; h: number }>,
  style: RedactStyle,
): Promise<string | null> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    return null;
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    paintMask(ctx, mask, style);
    const out = await canvas.convertToBlob({ type: 'image/png' });
    return bytesToPngDataUrl(new Uint8Array(await out.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Redacts a screenshot data URL via daemon OCR.
 * Always resolves with an image; degraded:true means the original came back.
 */
export async function redactScreenshot(
  transport: TransportClient,
  dataUrl: string,
  opts: { redactStyle?: RedactStyle; timeoutMs?: number } = {},
): Promise<RedactScreenshotResult> {
  const style: RedactStyle = opts.redactStyle ?? 'blur';

  const fail: RedactScreenshotResult = { redactedDataUrl: dataUrl, hits: [], degraded: true };

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return fail;
  const base64 = dataUrl.slice(commaIdx + 1);
  if (!base64) return fail;

  const res = await requestDaemonOcr(transport, base64, opts.timeoutMs);
  if (!res || !res.ok || !res.mask || res.mask.length === 0) {
    return fail;
  }

  const masked = await maskToDataUrl(dataUrl, res.mask, style);
  if (!masked) {
    return fail; // rasterization unavailable → original image, degraded
  }

  return {
    redactedDataUrl: masked,
    hits: res.hits ?? [],
    degraded: res.degraded === true,
  };
}
