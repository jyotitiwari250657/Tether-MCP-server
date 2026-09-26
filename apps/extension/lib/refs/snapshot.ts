/**
 * DOM Snapshot Algorithm (PRD FR-201..FR-205, TRD §6.4.1, §6.4.3).
 * Captures an accessible, ref-indexed tree with stable refs and SHA-1 textSig.
 */

import type { SnapshotResult } from '@tether/protocol';
import { accessibleName } from './accessibleName.js';
import { getStates, isHidden, isInteractive, isLandmark, isTextual } from './categories.js';
import { getCssPath, getXPath } from './dom-paths.js';
import { implicitRole } from './implicit-role.js';
import { computeTextSig } from './sha1.js';
import type { Rect, RefEntry, SnapshotOptions } from './types.js';

// Live Node Map: numeric nodeId -> Element in current session
let nextNodeId = 1;
export const liveNodeMap = new Map<number, Element>();
export const liveRefMap = new Map<string, RefEntry>();

export function clearNodeRegistries(): void {
  nextNodeId = 1;
  liveNodeMap.clear();
  liveRefMap.clear();
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'HEAD']);

interface WalkItem {
  entry: RefEntry;
  depth: number;
  category: 'interactive' | 'landmark' | 'textual';
}

function frameLetter(frameIdx: number): string {
  return String.fromCharCode(65 + frameIdx); // 0 -> 'A', 1 -> 'B', etc.
}

/**
 * Executes a depth-first DOM traversal and creates a ref-indexed snapshot (TRD §6.4.1).
 */
export async function snapshot(
  tabId = 0,
  opts: SnapshotOptions = {},
  rootOverride?: Element | Document,
): Promise<SnapshotResult> {
  const doc = (rootOverride?.ownerDocument ?? rootOverride ?? globalThis.document) as Document;
  const root = (rootOverride && 'tagName' in rootOverride ? rootOverride : doc?.body) as Element;

  const maxNodes = opts.maxNodes ?? 200;
  const maxTokens = opts.maxTokens ?? 4000;
  const items: WalkItem[] = [];
  const counters = new Map<string, number>();

  function getRef(prefix: string): string {
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    return `${prefix}${next}`;
  }

  function walk(node: Element, frame: string, prefix: string, depth: number): void {
    const tag = node.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag)) return;
    if (tag === 'DEFS' || (tag === 'G' && !node.hasAttribute('role'))) return;
    if (isHidden(node)) return;

    if (tag === 'IFRAME') {
      const iframe = node as HTMLIFrameElement;
      let sameOriginDoc: Document | null = null;
      try {
        sameOriginDoc = iframe.contentDocument;
      } catch {
        sameOriginDoc = null;
      }
      if (sameOriginDoc?.body) {
        const nextFrame = frameLetter(items.length % 26);
        walk(sameOriginDoc.body, nextFrame, nextFrame, depth);
        return;
      }
      // Cross-origin iframe: emit opaque node and do not recurse
      const ref = getRef(prefix);
      const title = iframe.getAttribute('title') || iframe.getAttribute('src') || 'cross-origin';
      items.push({
        entry: {
          ref,
          frame,
          nodeId: nextNodeId++,
          cssPath: getCssPath(node),
          xpath: getXPath(node),
          role: 'iframe',
          name: title,
          textSig: 'opaque',
          rect: { x: 0, y: 0, w: 0, h: 0 },
          interactive: false,
          opaque: true,
        },
        depth,
        category: 'landmark',
      });
      return;
    }

    const role = node.getAttribute('role') || implicitRole(node) || tag.toLowerCase();
    const name = accessibleName(node);
    const interactive = isInteractive(node, role);
    const textual = isTextual(node);
    const landmark = isLandmark(node, role, name);

    if (interactive || textual || landmark) {
      const ref = getRef(prefix);
      const r = node.getBoundingClientRect
        ? node.getBoundingClientRect()
        : { x: 0, y: 0, width: 0, height: 0 };
      const rect: Rect = {
        x: Math.floor(r.x ?? 0),
        y: Math.floor(r.y ?? 0),
        w: Math.floor(r.width ?? 0),
        h: Math.floor(r.height ?? 0),
      };
      const textSig = computeTextSig(role, name, rect);
      const states = getStates(node);
      const nodeId = nextNodeId++;
      liveNodeMap.set(nodeId, node);

      const entry: RefEntry = {
        ref,
        frame,
        nodeId,
        cssPath: getCssPath(node),
        xpath: getXPath(node),
        role,
        name,
        textSig,
        rect,
        interactive,
        state: states.length > 0 ? states : undefined,
      };

      liveRefMap.set(ref, entry);
      const category: 'interactive' | 'landmark' | 'textual' = interactive
        ? 'interactive'
        : landmark
          ? 'landmark'
          : 'textual';
      items.push({ entry, depth, category });
    }

    // Shadow DOM traversal
    if (node.shadowRoot) {
      for (let i = 0; i < node.shadowRoot.children.length; i++) {
        const child = node.shadowRoot.children[i];
        if (child) walk(child, frame, `${prefix}S`, depth + 1);
      }
    }

    // Children traversal
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child) walk(child, frame, prefix, depth + 1);
    }
  }

  if (root) {
    walk(root, 'F0', 'A', 0);
  }

  // Enforce 200-node cap / 4000-token cap
  let truncated = false;
  let cursor: string | undefined = undefined;

  let activeItems = [...items];
  if (activeItems.length > maxNodes) {
    truncated = true;
    cursor = activeItems[maxNodes]?.entry.cssPath;
    const kept: WalkItem[] = [];
    for (let i = activeItems.length - 1; i >= 0; i--) {
      const item = activeItems[i];
      if (!item) continue;
      if (kept.length < maxNodes || item.category !== 'textual') {
        kept.unshift(item);
      }
    }
    activeItems = kept.slice(0, maxNodes);
  }

  const lines = activeItems.map(({ entry, depth }) => {
    const indent = '  '.repeat(depth);
    const namePart = entry.name ? ` "${entry.name}"` : '';
    const statePart = entry.state && entry.state.length > 0 ? ` [${entry.state.join(', ')}]` : '';
    const opaquePart = entry.opaque ? ' [opaque]' : '';
    return `${indent}- ${entry.role}${namePart}${statePart}${opaquePart} [ref=${entry.ref}]`;
  });

  let tree = lines.join('\n');
  let tokens = Math.ceil(tree.length / 4);

  if (tokens > maxTokens) {
    truncated = true;
    while (tokens > maxTokens && activeItems.length > 1) {
      activeItems.pop();
      tree = activeItems
        .map(({ entry, depth }) => {
          const indent = '  '.repeat(depth);
          const namePart = entry.name ? ` "${entry.name}"` : '';
          const statePart =
            entry.state && entry.state.length > 0 ? ` [${entry.state.join(', ')}]` : '';
          return `${indent}- ${entry.role}${namePart}${statePart} [ref=${entry.ref}]`;
        })
        .join('\n');
      tokens = Math.ceil(tree.length / 4);
    }
  }

  const nodes = activeItems.map((item) => item.entry);
  const refMapRecord: Record<string, RefEntry> = {};
  for (const n of nodes) {
    refMapRecord[n.ref] = n;
  }

  // Persist refMap to chrome.storage.session (PRD HR-2, AC-P05-11)
  if (typeof chrome !== 'undefined' && chrome.storage?.session?.set) {
    try {
      await chrome.storage.session.set({
        [`refMap:${tabId}`]: refMapRecord,
        refMap: refMapRecord,
      });
    } catch {}
  }

  return {
    tree,
    nodes,
    tokens,
    truncated,
    cursor,
    url: doc?.location?.href ?? 'about:blank',
    title: doc?.title ?? '',
    trust: 'untrusted',
    policyVersion: '1.0.0',
    redactionHits: [],
  };
}
