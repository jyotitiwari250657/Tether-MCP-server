/**
 * Daemon OCR WS Message Handler (Prompt 11 §2).
 * Handles the extension→daemon {type:'ocr.redact'} internal message and
 * replies {type:'ocr.result', reqId, ...}. This is NOT an MCP tool and never
 * touches the policy engine (TRD §2.3 — transport only; the extension's SW
 * decides what is redacted before it reaches the model).
 *
 * Invariants: image bytes and OCR text never enter errors or logs
 * (HR-7, HR-11, PRV-03, AC-P11-05).
 */

import type { WebSocket } from 'ws';
import { type OcrService, isRateLimited } from './index.js';

/** Internal extension→daemon OCR request (Prompt 11 §2; NOT an MCP tool). */
export interface OcrRedactMessage {
  type: 'ocr.redact';
  reqId: string;
  /** base64-encoded PNG bytes (never logged — PRV-03, HR-7). */
  image: string;
}

type OcrWireErrorCode = 'INTERNAL' | 'SCHEMA_INVALID' | 'RATE_LIMITED';

function ocrError(
  code: OcrWireErrorCode,
  message: string,
  hint: string,
  retryable: boolean,
): Record<string, unknown> {
  return { code, message, hint, retryable };
}

/**
 * Handles one ocr.redact message. All failure paths answer with a structured,
 * content-free error; the extension degrades to the unredacted screenshot.
 */
export function handleOcrRedact(
  msg: OcrRedactMessage,
  ws: WebSocket,
  ocrService: OcrService | undefined,
): void {
  const reply = (payload: Record<string, unknown>): void => {
    if (ws.readyState === 1) ws.send(JSON.stringify(payload));
  };

  if (!ocrService) {
    reply({
      type: 'ocr.result',
      reqId: msg.reqId,
      ok: false,
      error: ocrError(
        'INTERNAL',
        'OCR service unavailable',
        'Retry later; screenshots are returned unredacted with degraded:true',
        true,
      ),
    });
    return;
  }

  let imageBytes: Uint8Array;
  try {
    imageBytes = new Uint8Array(Buffer.from(msg.image ?? '', 'base64'));
  } catch {
    reply({
      type: 'ocr.result',
      reqId: msg.reqId,
      ok: false,
      error: ocrError(
        'SCHEMA_INVALID',
        'Invalid image encoding',
        'Send base64-encoded PNG bytes',
        false,
      ),
    });
    return;
  }

  ocrService
    .redactImage(imageBytes)
    .then((outcome) => {
      if (isRateLimited(outcome)) {
        reply({
          type: 'ocr.result',
          reqId: msg.reqId,
          ok: false,
          error: {
            ...ocrError(
              'RATE_LIMITED',
              'OCR rate limit exceeded (10 calls/minute)',
              'Wait retryAfterMs, then retry once.',
              true,
            ),
            details: { retryAfterMs: outcome.retryAfterMs },
          },
          retryAfterMs: outcome.retryAfterMs,
        });
        return;
      }
      reply({ type: 'ocr.result', reqId: msg.reqId, ok: true, ...outcome });
    })
    .catch(() => {
      reply({
        type: 'ocr.result',
        reqId: msg.reqId,
        ok: false,
        error: ocrError(
          'INTERNAL',
          'OCR redaction failed',
          'Screenshot is returned unredacted; degraded:true is set',
          true,
        ),
      });
    });
}
