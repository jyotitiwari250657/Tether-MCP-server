export {
  OcrService,
  consoleAuditSink,
  isRateLimited,
  type OcrAuditSink,
  type OcrServiceOptions,
  type RateLimitedRefusal,
  type RedactImageResult,
  type RedactOutcome,
} from './service.js';
export { handleOcrRedact, type OcrRedactMessage } from './handler.js';
export {
  OcrRateLimiter,
  OCR_RATE_LIMIT,
  OCR_WINDOW_MS,
  type RateLimitVerdict,
} from './rate-limit.js';
