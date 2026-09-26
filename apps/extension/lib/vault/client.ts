/**
 * Vault Client for Chrome Extension (PRD FR-510, TRD §6.10, HR-7, SEC-05).
 * Requests encrypted secrets from daemon and injects them locally with zero plaintext over the wire.
 */

import type { Req, ResErr, ResOk, ToolError } from '@tether/protocol';
import { type } from '../actions/type.js';
import { resolve } from '../refs/resolve.js';
import type { TransportClient } from '../transport/client.js';
import {
  bytesToHex,
  decrypt,
  deriveSessionKey,
  exportPublicKeyRaw,
  generateX25519KeyPair,
  hexToBytes,
  zeroBytes,
} from './crypto.js';
import type { EncryptedSecretPayload, SecretMetadata } from './types.js';

export class VaultClient {
  constructor(private readonly transport: TransportClient) {}

  async list(): Promise<SecretMetadata[]> {
    if (this.transport.state !== 'online') {
      return [];
    }

    const res = await this.transport.request('vault.list', {}, 5000);
    if (!res.ok) {
      return [];
    }
    return ((res as ResOk).result as { secrets: SecretMetadata[] }).secrets ?? [];
  }

  async typeIn(ref: string, secretId: string): Promise<void> {
    if (this.transport.state !== 'online') {
      const err: ToolError = {
        code: 'NEEDS_CONFIRMATION',
        message: 'Vault requires daemon connection. Connect the daemon to use secrets.',
        hint: 'Start the Tether local daemon (tether serve) and pair with the extension',
        retryable: true,
      };
      throw err;
    }

    // 1. Resolve DOM target element
    const resolved = await resolve(ref);
    if (!resolved.ok) {
      throw resolved.error;
    }

    // 2. Generate ephemeral key agreement pair
    const keyPair = await generateX25519KeyPair();
    const clientPubRaw = await exportPublicKeyRaw(keyPair.publicKey);
    const clientPubHex = bytesToHex(clientPubRaw);

    // 3. Request encrypted secret from daemon
    const res = await this.transport.request('vault.resolve', { secretId, clientPubHex }, 5000);
    if (!res.ok) {
      throw (res as ResErr).error;
    }

    const payload = (res as ResOk).result as EncryptedSecretPayload;

    // 4. Derive shared session key via ECDH + HKDF
    const daemonPubBytes = hexToBytes(payload.daemonPubHex);
    const sessionKey = await deriveSessionKey(keyPair.privateKey, daemonPubBytes);

    // 5. Decrypt secret locally
    const ciphertext = hexToBytes(payload.ciphertextHex);
    const nonce = hexToBytes(payload.nonceHex);
    const plaintext = await decrypt(sessionKey, ciphertext, nonce);

    // 6. Type secret keystroke-by-keystroke into resolved element
    try {
      await type(resolved.handle, { text: plaintext, jitterMs: 15 });
    } finally {
      // 7. Securely zero memory buffers (HR-7)
      zeroBytes(clientPubRaw);
      zeroBytes(ciphertext);
      zeroBytes(nonce);
      zeroBytes(daemonPubBytes);
    }
  }
}
