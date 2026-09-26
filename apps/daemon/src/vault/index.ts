export { VaultService, type ResolveSecretResult } from './service.js';
export {
  bytesToHex,
  hexToBytes,
  zeroBytes,
  generateX25519KeyPair,
  exportPublicKeyRaw,
  deriveSessionKey,
  encrypt,
  decrypt,
} from './crypto.js';
