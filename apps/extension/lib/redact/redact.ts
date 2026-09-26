/**
 * Outbound Redactor Choke Point (TRD §6.7, PRD FR-509, HR-7).
 * Recursively redacts sensitive patterns from outbound payloads before wire transmission.
 */

import { type RedactionHit, detect } from './detectors.js';

export function redactString(str: string): { redacted: string; hits: RedactionHit[] } {
  const hits = detect(str);
  if (hits.length === 0) {
    return { redacted: str, hits: [] };
  }

  // Replace from end to start to avoid offset shifting
  let out = str;
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    if (hit) {
      out = out.slice(0, hit.start) + hit.replacement + out.slice(hit.end);
    }
  }

  return { redacted: out, hits };
}

export function redact(payload: unknown): { redacted: unknown; hits: RedactionHit[] } {
  const allHits: RedactionHit[] = [];

  function walk(val: unknown): unknown {
    if (typeof val === 'string') {
      const { redacted, hits } = redactString(val);
      allHits.push(...hits);
      return redacted;
    }

    if (Array.isArray(val)) {
      return val.map((item) => walk(item));
    }

    if (val !== null && typeof val === 'object') {
      const record = val as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      const skipKeys = new Set(['id', 'reqId', 'session', 'kind', 'evt', 'tool', 'v', 'ts']);
      for (const [key, prop] of Object.entries(record)) {
        if (skipKeys.has(key)) {
          out[key] = prop;
        } else {
          out[key] = walk(prop);
        }
      }
      return out;
    }

    return val;
  }

  const redacted = walk(payload);
  return { redacted, hits: allHits };
}
