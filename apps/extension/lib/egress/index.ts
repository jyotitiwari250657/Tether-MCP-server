/**
 * Egress Monitor Module Exports (PRD FR-511, TRD §6.8).
 */

export { setupContentBridge } from './content-bridge.js';
export { installNetworkInstrumentation } from './instrument.js';
export { EgressMonitor } from './monitor.js';
export type {
  BlockedEgress,
  EgressObservation,
  EgressPostMessage,
  EgressReport,
} from './types.js';
