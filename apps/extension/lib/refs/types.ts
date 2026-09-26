/**
 * Ref Engine Type Definitions (PRD FR-201..FR-206, TRD §6.4, Appendix A).
 */

import type { Rect, RefEntry, SnapshotResult, ToolError } from '@tether/protocol';

export type { Rect, RefEntry, SnapshotResult };

export interface NodeHandle {
  node: Element;
  ref: string;
  entry?: RefEntry | undefined;
}

export interface SnapshotOptions {
  tab?: string | undefined;
  format?: 'markdown' | 'a11y' | undefined;
  refs?: boolean | undefined;
  maxNodes?: number | undefined;
  maxTokens?: number | undefined;
  cursor?: string | undefined;
}

export interface ResolveOptions {
  root?: Document | Element | undefined;
  landmarkContext?: Element | undefined;
}

export interface CandidateScore {
  ref: string;
  role: string;
  name: string;
  score: number;
}

export type ResolveOutcome =
  | {
      ok: true;
      handle: NodeHandle;
      healed?: boolean | undefined;
      healDetail?: string | undefined;
    }
  | {
      ok: false;
      error: ToolError;
    };
