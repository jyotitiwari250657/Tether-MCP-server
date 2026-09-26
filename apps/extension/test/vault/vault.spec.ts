// @vitest-environment happy-dom
/**
 * Vault Client Unit Tests (PRD FR-510, TRD §6.10, HR-7, SEC-05).
 * Verifies ECDH/AES-GCM encryption, local decryption, typing injection, and transport gating.
 */

import type { Req, ResOk } from '@tether/protocol';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { liveNodeMap, liveRefMap } from '../../lib/refs/snapshot.js';
import type { TransportClient } from '../../lib/transport/client.js';
import { VaultClient } from '../../lib/vault/client.js';
import {
  bytesToHex,
  decrypt,
  deriveSessionKey,
  encrypt,
  exportPublicKeyRaw,
  generateX25519KeyPair,
  hexToBytes,
  zeroBytes,
} from '../../lib/vault/crypto.js';

describe('Vault Client & Crypto (PRD FR-510, TRD §6.10)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <input id="pwd-field" type="password" aria-label="Password" value="" />
      </div>
    `;

    const input = document.getElementById('pwd-field') as HTMLInputElement;
    liveRefMap.set('A1', {
      ref: 'A1',
      frame: 'F0',
      nodeId: 1,
      cssPath: '#pwd-field',
      xpath: '//*[@id="pwd-field"]',
      role: 'textbox',
      name: 'Password',
      textSig: 'test',
      rect: { x: 10, y: 10, w: 100, h: 30 },
      interactive: true,
    });
    liveNodeMap.set(1, input);
  });

  // 1. Crypto round-trip
  test('FR-510, HR-7: ECDH key exchange + AES-GCM encrypt/decrypt round trip', async () => {
    const aliceKeys = await generateX25519KeyPair();
    const bobKeys = await generateX25519KeyPair();

    const alicePubRaw = await exportPublicKeyRaw(aliceKeys.publicKey);
    const bobPubRaw = await exportPublicKeyRaw(bobKeys.publicKey);

    const aliceSessionKey = await deriveSessionKey(aliceKeys.privateKey, bobPubRaw);
    const bobSessionKey = await deriveSessionKey(bobKeys.privateKey, alicePubRaw);

    const secret = 'super-secret-password-42';
    const { ciphertext, nonce } = await encrypt(aliceSessionKey, secret);

    const decrypted = await decrypt(bobSessionKey, ciphertext, nonce);
    expect(decrypted).toBe(secret);
  });

  // 2. zeroBytes utility zeroes the array
  test('HR-7: zeroBytes overwrites buffer content with zeroes', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    zeroBytes(buf);
    expect(buf.every((b) => b === 0)).toBe(true);
  });

  // 3. VaultClient.list calls transport
  test('FR-510: VaultClient list requests metadata from daemon', async () => {
    const mockTransport = {
      state: 'online',
      request: vi.fn(async (_tool: string, _args: unknown) => {
        const res: ResOk = {
          v: 1,
          id: 'v-1',
          session: 'vault',
          ts: Date.now(),
          kind: 'res',
          reqId: 'v-1',
          ok: true,
          result: {
            secrets: [
              {
                secretId: 'sec-1',
                label: 'Main Card',
                kind: 'card',
                createdAt: 100,
                lastUsedAt: 200,
              },
            ],
          },
          ms: 5,
        };
        return res;
      }),
    } as unknown as TransportClient;

    const vault = new VaultClient(mockTransport);
    const list = await vault.list();
    expect(list.length).toBe(1);
    expect(list[0]?.secretId).toBe('sec-1');
  });

  // 4. VaultClient.list returns empty array if offline
  test('FR-510: VaultClient list returns empty array when offline', async () => {
    const mockTransport = {
      state: 'closed',
      request: vi.fn(),
    } as unknown as TransportClient;

    const vault = new VaultClient(mockTransport);
    const list = await vault.list();
    expect(list).toEqual([]);
    expect(mockTransport.request).not.toHaveBeenCalled();
  });

  // 5. VaultClient.typeIn throws NEEDS_CONFIRMATION if offline
  test('HR-8, FR-510: typeIn throws NEEDS_CONFIRMATION error when transport is offline', async () => {
    const mockTransport = {
      state: 'connecting',
      request: vi.fn(),
    } as unknown as TransportClient;

    const vault = new VaultClient(mockTransport);
    await expect(vault.typeIn('A1', 'sec-1')).rejects.toMatchObject({
      code: 'NEEDS_CONFIRMATION',
    });
  });

  // 6. VaultClient.typeIn successfully decrypts and injects into DOM
  test('FR-510, HR-7: typeIn fetches encrypted secret, decrypts, and types into field', async () => {
    const daemonKeys = await generateX25519KeyPair();
    const daemonPubRaw = await exportPublicKeyRaw(daemonKeys.publicKey);

    const secretValue = 'uncompromised-secret-99';

    const mockTransport = {
      state: 'online',
      request: vi.fn(async (tool: string, args: unknown) => {
        // Daemon side simulation: derive key with client pub and encrypt
        const clientPubBytes = hexToBytes((args as { clientPubHex: string }).clientPubHex);
        const daemonSessionKey = await deriveSessionKey(daemonKeys.privateKey, clientPubBytes);
        const { ciphertext, nonce } = await encrypt(daemonSessionKey, secretValue);

        const res: ResOk = {
          v: 1,
          id: 'v-2',
          session: 'vault',
          ts: Date.now(),
          kind: 'res',
          reqId: 'v-2',
          ok: true,
          result: {
            v: 1,
            ciphertextHex: bytesToHex(ciphertext),
            nonceHex: bytesToHex(nonce),
            daemonPubHex: bytesToHex(daemonPubRaw),
          },
          ms: 5,
        };
        return res;
      }),
    } as unknown as TransportClient;

    const vault = new VaultClient(mockTransport);
    await vault.typeIn('A1', 'sec-target');

    const input = document.getElementById('pwd-field') as HTMLInputElement;
    expect(input.value).toBe(secretValue);
  });
});
