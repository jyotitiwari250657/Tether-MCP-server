/**
 * Policy Engine Types (TRD §6.6, PRD FR-501..FR-505).
 * Core definitions for domain capability policies, contextual decisions, and rules storage.
 */

import type {
  Decision,
  DiffRow,
  DomainPattern,
  GrantLevel,
  PolicyRule,
  Scope,
  SensitiveCategory,
  Tier,
  ToolSpec,
} from '@tether/protocol';

export type {
  Decision,
  DiffRow,
  DomainPattern,
  GrantLevel,
  PolicyRule,
  Scope,
  SensitiveCategory,
  Tier,
  ToolSpec,
};

export interface PolicyContext {
  tool: ToolSpec<unknown, unknown>;
  origin: string;
  frameOrigin?: string | undefined;
  tier: Tier;
  session: string;
  clientScopes: Scope[];
  powerMode: boolean;
}

export interface PolicyStore {
  rules: PolicyRule[];
  version: string;
}

export interface DecideOpts {
  killSwitchEngaged?: boolean | undefined;
  confirmToken?: string | undefined;
}
