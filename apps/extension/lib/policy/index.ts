/**
 * Policy Module Exports (PRD FR-501..FR-505, TRD §6.6).
 */

export { BLOCKLIST, classify, hasCredentialEntry } from './categories.js';
export { decide } from './engine.js';
export { grant, listRules, load, revoke, save } from './store.js';
export type {
  DecideOpts,
  Decision,
  DiffRow,
  DomainPattern,
  GrantLevel,
  PolicyContext,
  PolicyRule,
  PolicyStore,
  Scope,
  SensitiveCategory,
  Tier,
  ToolSpec,
} from './types.js';
