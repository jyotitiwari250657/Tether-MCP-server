/**
 * Egress Monitor Service Worker Aggregator (PRD FR-511, TRD §6.8).
 * Establishes baseline of trusted origins and detects novel script-driven outbound data flows.
 */

import type { BlockedEgress, EgressObservation, EgressReport } from './types.js';

export class EgressMonitor {
  readonly baseline: Set<string> = new Set();
  readonly allowed: Set<string> = new Set();
  readonly blocked: BlockedEgress[] = [];
  private onBlockedListener: ((blocked: BlockedEgress) => void) | null = null;

  constructor() {
    this.reset();
  }

  onBlocked(listener: (blocked: BlockedEgress) => void): () => void {
    this.onBlockedListener = listener;
    return () => {
      if (this.onBlockedListener === listener) {
        this.onBlockedListener = null;
      }
    };
  }

  beginSession(initialOrigins: string[] = []): void {
    this.reset();

    // Baseline includes provided initial origins (e.g. active tab origin)
    for (const o of initialOrigins) {
      this.baseline.add(this.normalizeOrigin(o));
    }

    // Capture resources loaded prior to session from Performance API if available
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      try {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        for (const r of resources) {
          const u = this.extractOrigin(r.name);
          if (u) this.baseline.add(u);
        }
      } catch {
        // Ignore in environments where resource timing is restricted
      }
    }
  }

  private normalizeOrigin(origin: string): string {
    return origin.toLowerCase().trim().replace(/\/+$/, '');
  }

  private extractOrigin(urlStr: string): string | null {
    try {
      const u = new URL(urlStr);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }

  observe(entry: EgressObservation): { allowed: boolean; reason?: string } {
    const origin = this.normalizeOrigin(entry.origin);

    // Rule 1: Allow origins present in the session baseline
    if (this.baseline.has(origin)) {
      this.allowed.add(origin);
      return { allowed: true };
    }

    // Rule 2: Flag novel origins when data is being exfiltrated by script (bytes > 0)
    if (entry.initiator === 'script' && entry.bytes > 0) {
      const blockedRecord: BlockedEgress = {
        origin,
        method: entry.method.toUpperCase(),
        bytes: entry.bytes,
        reason: 'novel_origin_script_egress',
        timestamp: Date.now(),
      };

      this.blocked.push(blockedRecord);
      this.onBlockedListener?.(blockedRecord);

      return {
        allowed: false,
        reason: 'novel_origin_script_egress',
      };
    }

    // Rule 3: Allow non-script or zero-byte resource loads
    this.allowed.add(origin);
    return { allowed: true };
  }

  report(): EgressReport {
    return {
      allowed: Array.from(this.allowed),
      blocked: [...this.blocked],
    };
  }

  reset(): void {
    this.baseline.clear();
    this.allowed.clear();
    this.blocked.length = 0;
  }
}
