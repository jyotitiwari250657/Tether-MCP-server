/**
 * Session Module Exports (PRD FR-108, FR-109, TRD §6.3, §6.12).
 */

export { dispatch, setVaultClient } from './orchestrator.js';
export {
  ensureInjected,
  isForbiddenUrl,
  resolveTargetTab,
  withTimeout,
} from './target.js';
export {
  endSession,
  getActiveSession,
  getAttachedClients,
  isPowerMode,
  rehydrate,
  setAttachedClients,
  setPowerMode,
  startSession,
} from './lifecycle.js';
export type { Session, SessionClient, SwState } from './types.js';
