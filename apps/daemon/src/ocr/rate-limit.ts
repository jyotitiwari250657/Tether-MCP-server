/**
 * OCR Rate Limiter (Prompt 11 §2, AC-P11-06, PRD FR-306 analogue).
 * Fixed 10 calls / minute / extension — protects against runaway OCR loops.
 * Pure time-based logic with an injected clock for deterministic tests.
 */

export const OCR_RATE_LIMIT = 10;
export const OCR_WINDOW_MS = 60_000;

export interface RateLimitVerdict {
  allowed: boolean;
  /** Milliseconds until the oldest windowed call ages out (when blocked). */
  retryAfterMs: number;
  remaining: number;
}

export class OcrRateLimiter {
  private timestamps: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(opts: { limit?: number; windowMs?: number; now?: () => number } = {}) {
    this.limit = opts.limit ?? OCR_RATE_LIMIT;
    this.windowMs = opts.windowMs ?? OCR_WINDOW_MS;
    this.now = opts.now ?? Date.now;
  }

  check(): RateLimitVerdict {
    const t = this.now();
    this.timestamps = this.timestamps.filter((ts) => t - ts < this.windowMs);
    if (this.timestamps.length < this.limit) {
      return { allowed: true, retryAfterMs: 0, remaining: this.limit - this.timestamps.length - 1 };
    }
    const oldest = this.timestamps[0] ?? t;
    return {
      allowed: false,
      retryAfterMs: Math.max(1, this.windowMs - (t - oldest)),
      remaining: 0,
    };
  }

  /** Records one admitted call. Only call after a positive `check()`. */
  admit(): void {
    this.timestamps.push(this.now());
  }

  reset(): void {
    this.timestamps = [];
  }
}
