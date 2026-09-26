/**
 * Egress Monitor Types (PRD FR-511, TRD §6.8, ADR-005).
 */

export interface EgressObservation {
  origin: string;
  method: string;
  bytes: number;
  initiator: 'script' | 'other';
}

export interface BlockedEgress {
  origin: string;
  method: string;
  bytes: number;
  reason: string;
  timestamp: number;
}

export interface EgressReport {
  allowed: string[];
  blocked: BlockedEgress[];
}

export interface EgressPostMessage {
  __tether: 1;
  type: 'egress';
  payload: EgressObservation;
}
