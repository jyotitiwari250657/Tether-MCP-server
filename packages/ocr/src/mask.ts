/**
 * Mask helpers (Prompt 11 §2): merge per-hit bounding boxes into paint-ready
 * mask rectangles for the extension's canvas redaction step.
 */

import type { BBox, RedactionHit } from './types.js';

function intersects(a: BBox, b: BBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function union(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y };
}

/** Grow a rect by `pad` px on every side, clamped at 0. */
export function expandBBox(b: BBox, pad: number): BBox {
  return {
    x: Math.max(0, b.x - pad),
    y: Math.max(0, b.y - pad),
    w: Math.max(1, b.w + pad * 2),
    h: Math.max(1, b.h + pad * 2),
  };
}

/**
 * Merges overlapping/nearby hit bboxes into disjoint mask rectangles.
 * Overlapping merges happen when one secret spans several OCR lines or when
 * two secrets share a rendered row; merging avoids double-painting seams.
 */
export function mergeBBoxes(hits: RedactionHit[]): BBox[] {
  const rects: BBox[] = hits.map((h) => ({ ...h.bbox }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        if (a && b && intersects(a, b)) {
          rects[i] = union(a, b);
          rects.splice(j, 1);
          merged = true;
        }
      }
    }
  }
  return rects;
}
