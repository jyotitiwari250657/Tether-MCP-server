/**
 * Shared Action Executor Helpers (PRD FR-207, FR-210, TRD §6.5).
 */

import { accessibleName } from '../refs/accessibleName.js';
import { implicitRole } from '../refs/implicit-role.js';
import type { Rect } from '../refs/types.js';
import type { ActionResult } from './types.js';

export function rect(element: Element): Rect {
  const r = element.getBoundingClientRect
    ? element.getBoundingClientRect()
    : { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: Math.floor(r.x ?? 0),
    y: Math.floor(r.y ?? 0),
    w: Math.floor(r.width ?? 0),
    h: Math.floor(r.height ?? 0),
  };
}

export function isVisible(element: Element): boolean {
  const win = element.ownerDocument?.defaultView ?? globalThis;
  if (win.getComputedStyle) {
    const style = win.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
  }
  return true;
}

/**
 * Waits for element geometric stability across two consecutive animation frames.
 */
export async function stable(element: Element): Promise<boolean> {
  const win = element.ownerDocument?.defaultView ?? globalThis;
  const raf = win.requestAnimationFrame?.bind(win) ?? ((cb: () => void) => setTimeout(cb, 16));

  return new Promise<boolean>((resolve) => {
    raf(() => {
      const r1 = rect(element);
      raf(() => {
        const r2 = rect(element);
        const delta =
          Math.abs(r1.x - r2.x) +
          Math.abs(r1.y - r2.y) +
          Math.abs(r1.w - r2.w) +
          Math.abs(r1.h - r2.h);
        resolve(delta < 1);
      });
    });
  });
}

const OVERLAY_SELECTORS = [
  '#onetrust-banner-sdk',
  '.cookie-banner',
  '.consent-modal',
  '[aria-modal="true"]',
];

/**
 * Checks if the element is covered by an overlay at its center coordinates.
 * Attempts one-time dismissal of known consent overlays if blocked.
 */
export function guardCovered(element: Element): boolean {
  const doc = element.ownerDocument ?? globalThis.document;
  if (!doc?.elementFromPoint) return true;

  const r = element.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  const hit = doc.elementFromPoint(cx, cy);
  if (!hit || hit === element || element.contains(hit)) {
    return true;
  }

  // Attempt dismissal of common overlay banner once
  for (const sel of OVERLAY_SELECTORS) {
    const overlay = doc.querySelector(sel);
    if (overlay?.contains(hit)) {
      const dismissBtn = overlay.querySelector('button');
      if (dismissBtn) {
        dismissBtn.click();
        break;
      }
    }
  }

  // Re-check after dismissal attempt
  const recheckHit = doc.elementFromPoint(cx, cy);
  return !recheckHit || recheckHit === element || element.contains(recheckHit);
}

/**
 * Constructs a normalized ActionResult per PRD FR-210.
 */
export function result(
  element: Element,
  _actionName: string,
  ref = 'A1',
  startTime = 0,
): ActionResult {
  const doc = element.ownerDocument ?? globalThis.document;
  const role =
    element.getAttribute('role') || implicitRole(element) || element.tagName.toLowerCase();
  const name = accessibleName(element);
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const elapsed = startTime > 0 ? Math.round(now - startTime) : 10;

  return {
    ok: true,
    ref,
    role,
    name,
    urlAfter: doc?.location?.href ?? 'about:blank',
    domChanged: true,
    ms: Math.max(1, elapsed),
    trust: 'tether',
  };
}
