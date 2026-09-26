/**
 * Daemon Vault Service (PRD FR-510, TRD §6.10, §7.7, HR-7).
 * Encapsulates OS keyring access and encrypted envelope distribution.
 */

import { Keyring, KeyringError, type SecretMetadata } from '@tether/keyring';
import {
  bytesToHex,
  deriveSessionKey,
  encrypt,
  exportPublicKeyRaw,
  generateX25519KeyPair,
  hexToBytes,
  zeroBytes,
} from './crypto.js';

export interface ResolveSecretResult {
  encryptedHex: string;
  nonceHex: string;
  serverEphemeralPubHex: string;
}

export class VaultService {
  private keyring: Keyring;

  constructor(keyring?: Keyring) {
    this.keyring = keyring ?? new Keyring('tether-vault');
  }

  async listSecrets(): Promise<SecretMetadata[]> {
    try {
      return this.keyring.list();
    } catch (err: unknown) {
      if (err instanceof KeyringError && err.code === 'VAULT_LOCKED') {
        throw err;
      }
      throw new KeyringError(
        'VAULT_LOCKED',
        `OS keychain is locked or unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async resolveSecret(
    secretId: string,
    clientEphemeralPubHex: string,
  ): Promise<ResolveSecretResult> {
    let rawValue: string | null = null;
    let plaintextBytes: Uint8Array | null = null;

    try {
      try {
        rawValue = this.keyring.get(secretId);
      } catch (err: unknown) {
        throw new KeyringError(
          'VAULT_LOCKED',
          `OS keychain unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (rawValue === null) {
        throw new KeyringError('NOT_FOUND', `Secret "${secretId}" not found in vault`);
      }

      // Generate server ephemeral keypair for X25519 ECDH
      const serverKeyPair = await generateX25519KeyPair();
      const serverPubBytes = await exportPublicKeyRaw(serverKeyPair.publicKey);
      const clientPubBytes = hexToBytes(clientEphemeralPubHex);

      // Derive shared AES-256-GCM session key
      const sessionKey = await deriveSessionKey(serverKeyPair.privateKey, clientPubBytes);

      // Encrypt the secret
      const { ciphertext, nonce } = await encrypt(sessionKey, rawValue);

      return {
        encryptedHex: bytesToHex(ciphertext),
        nonceHex: bytesToHex(nonce),
        serverEphemeralPubHex: bytesToHex(serverPubBytes),
      };
    } finally {
      // Memory hygiene: zero plaintexts
      if (rawValue !== null) {
        plaintextBytes = new TextEncoder().encode(rawValue);
        zeroBytes(plaintextBytes);
      }
    }
  }

  setSecret(
    secretId: string,
    value: string,
    opts?: { label?: string; kind?: SecretMetadata['kind'] },
  ): void {
    this.keyring.set(secretId, value, opts);
  }

  deleteSecret(secretId: string): void {
    this.keyring.delete(secretId);
  }
}
