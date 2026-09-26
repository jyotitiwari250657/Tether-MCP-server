/**
 * Governance & Domain Policy Contracts (TRD §5.3, §6.6, Appendix A, PRD FR-501..508).
 * Defines capability grant rules, risk tiers, and confirmation diff structures.
 */

import type { GrantLevel, Tier } from './envelope.js';
import type { ErrorCode } from './errors.js';

export type { GrantLevel };

export interface DomainPattern {
  kind: 'exact' | 'wildcard' | 'all';
  value: string;
}

// Built-in high-risk category blocklist (PRD FR-503)
export type SensitiveCategory =
  | 'banking'
  | 'email'
  | 'crypto'
  | 'cloud-console'
  | 'health'
  | 'government'
  | 'credential-form';

export interface PolicyRule {
  id: string;
  match: DomainPattern;
  level: GrantLevel;
  scope: 'session' | 'persistent';
  category?: SensitiveCategory | undefined;
  tools?: string[] | undefined;
  createdAt: number;
  expiresAt?: number | undefined;
  actor: 'user' | 'default' | 'enterprise';
}

// Row in the structured confirmation diff presented to the user (PRD HR-8, FR-507)
export interface DiffRow {
  label: string;
  value: string;
  tone?: 'neutral' | 'warn' | 'danger' | undefined;
}

export interface Decision {
  verdict: 'allow' | 'ask' | 'deny';
  reason: string;
  code?: ErrorCode | undefined;
  requiresConfirm: boolean;
  confirmId?: string | undefined;
  diff?: DiffRow[] | undefined;
  diffHash?: string | undefined;
  ruleId?: string | undefined;
  policyVersion: string;
  tier: Tier;
}
