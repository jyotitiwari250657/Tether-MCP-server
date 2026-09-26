/**
 * Vault Client Module Exports (PRD FR-510, TRD §6.10, HR-7).
 */

export { VaultClient } from './client.js';
export {
  bytesToHex,
  decrypt,
  deriveSessionKey,
  encrypt,
  exportPublicKeyRaw,
  generateX25519KeyPair,
  hexToBytes,
  zeroBytes,
} from './crypto.js';
export type { EncryptedSecretPayload, ResolveSecretReq, SecretMetadata } from './types.js';
