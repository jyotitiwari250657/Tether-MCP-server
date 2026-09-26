/**
 * Self-Healing Ref Resolution Cascade (PRD FR-204, TRD §6.4.4).
 * Implements 5-step fallback: nodeId -> cssPath -> xpath -> fuzzy match -> REF_STALE.
 */

import type { ToolError } from '@tether/protocol';
import { accessibleName } from './accessibleName.js';
import { implicitRole } from './implicit-role.js';
import { computeTextSig } from './sha1.js';
import { liveNodeMap, liveRefMap, snapshot } from './snapshot.js';
import type {
  CandidateScore,
  NodeHandle,
  Rect,
  RefEntry,
  ResolveOptions,
  ResolveOutcome,
} from './types.js';

/**
 * Hand-rolled Levenshtein distance implementation (AC-P05-10, TRD §6.4.4).
 * Dynamic programming table with O(min(m, n)) space optimization.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i++) {
    curr[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min((curr[j] ?? 0) + 1, (prev[j + 1] ?? 0) + 1, (prev[j] ?? 0) + cost);
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[b.length] ?? 0;
}

export function nameSim(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return Math.max(0, 1 - levenshtein(a, b) / maxLen);
}

function getNodeRect(node: Element): Rect {
  const r = node.getBoundingClientRect
    ? node.getBoundingClientRect()
    : { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: Math.floor(r.x ?? 0),
    y: Math.floor(r.y ?? 0),
    w: Math.floor(r.width ?? 0),
    h: Math.floor(r.height ?? 0),
  };
}

function getNodeRole(node: Element): string {
  return node.getAttribute('role') || implicitRole(node) || node.tagName.toLowerCase();
}

function isNodeVisibleAndEnabled(node: Element): boolean {
  if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  if (node.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  const win = node.ownerDocument?.defaultView ?? globalThis;
  if (win.getComputedStyle) {
    const style = win.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
  }
  return true;
}

export function verify(node: Element, entry: RefEntry): boolean {
  const role = getNodeRole(node);
  if (role !== entry.role) return false;

  const currentName = accessibleName(node);
  const sim = nameSim(currentName, entry.name);
  if (sim < 0.85) return false;

  return isNodeVisibleAndEnabled(node);
}

function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function euclidean(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export function posProximity(c: Rect, e: Rect, viewportDiag = 1500): number {
  const dist = euclidean(center(c), center(e));
  return 1 - Math.min(1, dist / viewportDiag);
}

export function calculateScore(
  cRole: string,
  cName: string,
  cRect: Rect,
  entry: RefEntry,
  viewportDiag = 1500,
): number {
  const roleScore = cRole === entry.role ? 0.5 : 0.0;
  const nameScore = 0.3 * nameSim(cName, entry.name);
  const proxScore = 0.2 * posProximity(cRect, entry.rect, viewportDiag);
  return roleScore + nameScore + proxScore;
}

function queryXpath(doc: Document, xpath: string): Element | null {
  try {
    const res = doc.evaluate(xpath, doc, null, 9 /* XPathResult.FIRST_ORDERED_NODE_TYPE */, null);
    return res.singleNodeValue as Element | null;
  } catch {
    return null;
  }
}

/**
 * Resolves a ref using the normative 5-step self-healing cascade (TRD §6.4.4).
 */
export async function resolve(ref: string, options: ResolveOptions = {}): Promise<ResolveOutcome> {
  if (liveRefMap.size === 0 || !liveRefMap.has(ref)) {
    try {
      await snapshot(0, {}, options.root);
    } catch {}
  }
  const entry = liveRefMap.get(ref);
  if (!entry) {
    const notFoundError: ToolError = {
      code: 'REF_NOT_FOUND',
      message: `Ref "${ref}" not found in current session`,
      hint: 'Run browser_snapshot to refresh refs for the page',
      retryable: false,
    };
    return { ok: false, error: notFoundError };
  }

  const doc = (options.root?.ownerDocument ?? options.root ?? globalThis.document) as Document;

  // Step 1: Live nodeId check
  const liveNode = liveNodeMap.get(entry.nodeId);
  if (liveNode?.isConnected && verify(liveNode, entry)) {
    return { ok: true, handle: { node: liveNode, ref, entry } };
  }

  // Step 2: cssPath re-query + textSig verification
  try {
    const cssNode = doc?.querySelector?.(entry.cssPath);
    if (cssNode) {
      const sig = computeTextSig(
        getNodeRole(cssNode),
        accessibleName(cssNode),
        getNodeRect(cssNode),
      );
      if (sig === entry.textSig && verify(cssNode, entry)) {
        liveNodeMap.set(entry.nodeId, cssNode);
        return {
          ok: true,
          handle: { node: cssNode, ref, entry },
          healed: true,
          healDetail: `ref ${ref} → cssPath ${entry.cssPath}`,
        };
      }
    }
  } catch {
    // Ignore invalid selector, continue to Step 3
  }

  // Step 3: xpath re-query + textSig verification
  if (typeof doc?.evaluate === 'function') {
    const xpathNode = queryXpath(doc, entry.xpath);
    if (xpathNode) {
      const sig = computeTextSig(
        getNodeRole(xpathNode),
        accessibleName(xpathNode),
        getNodeRect(xpathNode),
      );
      if (sig === entry.textSig && verify(xpathNode, entry)) {
        liveNodeMap.set(entry.nodeId, xpathNode);
        return {
          ok: true,
          handle: { node: xpathNode, ref, entry },
          healed: true,
          healDetail: `ref ${ref} → xpath ${entry.xpath}`,
        };
      }
    }
  }

  // Step 4: Fuzzy match within same landmark / scope
  const container = options.landmarkContext ?? doc?.body ?? doc?.documentElement;
  const allElements = container ? Array.from(container.querySelectorAll('*')) : [];
  const candidates: { node: Element; role: string; name: string; rect: Rect; score: number }[] = [];

  for (const el of allElements) {
    const role = getNodeRole(el);
    if (role === entry.role) {
      const name = accessibleName(el);
      const rect = getNodeRect(el);
      const score = calculateScore(role, name, rect, entry);
      candidates.push({ node: el, role, name, rect, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (
    best &&
    best.score >= 0.72 &&
    nameSim(best.name, entry.name) >= 0.85 &&
    verify(best.node, entry)
  ) {
    liveNodeMap.set(entry.nodeId, best.node);
    return {
      ok: true,
      handle: { node: best.node, ref, entry },
      healed: true,
      healDetail: `ref ${ref} → fuzzy match "${best.name}" (score ${best.score.toFixed(2)})`,
    };
  }

  // Step 5: Structured REF_STALE error with top 5 candidates (AC-P05-12)
  const topCandidates: CandidateScore[] = candidates.slice(0, 5).map((c, i) => ({
    ref: `candidate_${i + 1}`,
    role: c.role,
    name: c.name,
    score: Number(c.score.toFixed(3)),
  }));

  const staleError: ToolError = {
    code: 'REF_STALE',
    message: `Element for ref "${ref}" (${entry.role} "${entry.name}") has changed or detached from DOM`,
    hint: 'Page DOM mutated; run browser_snapshot to generate fresh refs',
    retryable: false,
    details: { candidates: topCandidates },
  };

  return { ok: false, error: staleError };
}
