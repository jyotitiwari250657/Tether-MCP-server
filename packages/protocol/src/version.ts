/**
 * Protocol versioning and compatibility rules (TRD §5.1, PRD HR-5).
 *
 * Compatibility Rules:
 * 1. Minor / additive changes: new optional fields, new tools, new event names retain the same PROTOCOL_VERSION.
 * 2. Breaking changes: require bumping PROTOCOL_VERSION, plus maintaining a backward-compatible decoder
 *    for the previous version for >= 2 releases.
 * 3. Frozen post-launch: after public launch (M4), no breaking changes are permitted under any circumstance.
 *    Any capability expansion must be introduced as a new tool or optional field.
 */

// PRD HR-4 / TRD §5.1: single canonical protocol version
export const PROTOCOL_VERSION = 1 as const;

/**
 * Evaluates whether a remote peer's protocol version is compatible with this host.
 *
 * @param peer The protocol version advertised by the peer.
 * @returns boolean True if the peer version matches PROTOCOL_VERSION.
 */
export function isCompatible(peer: number): boolean {
  return peer === PROTOCOL_VERSION;
}
