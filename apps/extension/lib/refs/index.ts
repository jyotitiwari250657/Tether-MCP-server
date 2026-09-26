/**
 * Ref Engine Public API (PRD FR-201..FR-206, TRD §6.4).
 */

export { accessibleName } from './accessibleName.js';
export { getCssPath, getXPath } from './dom-paths.js';
export { implicitRole } from './implicit-role.js';
export {
  calculateScore,
  levenshtein,
  nameSim,
  posProximity,
  resolve,
  verify,
} from './resolve.js';
export { computeTextSig, sha1 } from './sha1.js';
export {
  clearNodeRegistries,
  liveNodeMap,
  liveRefMap,
  snapshot,
} from './snapshot.js';
export type {
  CandidateScore,
  NodeHandle,
  Rect,
  RefEntry,
  ResolveOptions,
  ResolveOutcome,
  SnapshotOptions,
  SnapshotResult,
} from './types.js';
