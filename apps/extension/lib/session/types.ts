/**
 * Session Orchestrator Types (PRD FR-108, FR-109, TRD §6.3, §6.12).
 */

import type { Scope, TransportMode } from '@tether/protocol';

export interface SessionClient {
  id: string;
  label: string;
  scopes: Scope[];
}

export interface Session {
  id: string;
  client: SessionClient;
  mode: TransportMode;
  startedAt: number;
  steps: number;
  tokensUsed: number;
  lastCompletedStepId?: string | undefined;
  pendingSteps: number;
}

export interface SwState {
  v: 1;
  activeSessionId?: string | undefined;
  attachedClients: number;
  powerMode: boolean;
  policyVersion: string;
}
