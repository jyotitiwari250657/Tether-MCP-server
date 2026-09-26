/**
 * DOM Snapshot & Accessible Node Representation (TRD §5.4, §6.4, Appendix A).
 * Represents structured, ref-indexed accessibility trees derived from web pages.
 */

import type { Trust } from './envelope.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RefEntry {
  ref: string;
  frame: string;
  nodeId: number;
  cssPath: string;
  xpath: string;
  role: string;
  name: string;
  textSig: string;
  rect: Rect;
  interactive: boolean;
  opaque?: boolean | undefined;
  state?: string[] | undefined;
}

export interface SnapshotResult {
  tree: string;
  nodes: RefEntry[];
  tokens: number;
  truncated: boolean;
  cursor?: string | undefined;
  url: string;
  title: string;
  trust: Trust;
  policyVersion: string;
  redactionHits: { kind: string; count: number }[];
}
