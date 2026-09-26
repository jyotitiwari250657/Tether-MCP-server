import { Keyring, KeyringError } from '@tether/keyring';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bytesToHex,
  decrypt,
  deriveSessionKey,
  exportPublicKeyRaw,
  generateX25519KeyPair,
  hexToBytes,
} from '../../src/vault/crypto.js';
import { VaultService } from '../../src/vault/service.js';

describe('Daemon Vault Service (PRD FR-510, TRD §6.10, §7.7, HR-7)', () => {
  let mockStore: Map<string, string>;
  let keyring: Keyring;
  let vaultService: VaultService;

  beforeEach(() => {
    mockStore = new Map<string, string>();
    keyring = new Keyring('test-daemon-vault');

    // Stub Keyring methods
    vi.spyOn(keyring, 'list').mockImplementation(() => [
      {
        secretId: 'sec-openai',
        label: 'OpenAI API Key',
        kind: 'api_key',
        createdAt: 1000,
        lastUsedAt: 1000,
      },
    ]);

    vi.spyOn(keyring, 'get').mockImplementation((id: string) => {
      if (id === 'sec-openai') return 'sk-test-secret-value-12345';
      return null;
    });

    vaultService = new VaultService(keyring);
  });

  it('lists secret metadata with zero plaintext exposure', async () => {
    const list = await vaultService.listSecrets();
    expect(list).toHaveLength(1);
    expect(list[0]?.secretId).toBe('sec-openai');
    expect((list[0] as unknown as { value?: unknown }).value).toBeUndefined();
  });

  it('resolves and encrypts secret using X25519 ECDH + AES-256-GCM', async () => {
    // Simulate extension client generating ephemeral keypair
    const clientKeyPair = await generateX25519KeyPair();
    const clientPubBytes = await exportPublicKeyRaw(clientKeyPair.publicKey);
    const clientPubHex = bytesToHex(clientPubBytes);

    // Daemon resolves and encrypts secret
    const resolved = await vaultService.resolveSecret('sec-openai', clientPubHex);

    expect(resolved.encryptedHex).toBeDefined();
    expect(resolved.nonceHex).toBeDefined();
    expect(resolved.serverEphemeralPubHex).toBeDefined();

    // Client decrypts using daemon's ephemeral public key
    const serverPubBytes = hexToBytes(resolved.serverEphemeralPubHex);
    const clientSessionKey = await deriveSessionKey(clientKeyPair.privateKey, serverPubBytes);

    const decrypted = await decrypt(
      clientSessionKey,
      hexToBytes(resolved.encryptedHex),
      hexToBytes(resolved.nonceHex),
    );

    expect(decrypted).toBe('sk-test-secret-value-12345');
  });

  it('throws NOT_FOUND when secret does not exist', async () => {
    const clientKeyPair = await generateX25519KeyPair();
    const clientPubBytes = await exportPublicKeyRaw(clientKeyPair.publicKey);
    const clientPubHex = bytesToHex(clientPubBytes);

    await expect(vaultService.resolveSecret('non-existent', clientPubHex)).rejects.toThrow(
      'not found in vault',
    );
  });

  it('throws VAULT_LOCKED when OS keychain is locked or unavailable', async () => {
    vi.spyOn(keyring, 'get').mockImplementation(() => {
      throw new KeyringError('IO_ERROR', 'Keychain access denied');
    });

    const clientKeyPair = await generateX25519KeyPair();
    const clientPubBytes = await exportPublicKeyRaw(clientKeyPair.publicKey);
    const clientPubHex = bytesToHex(clientPubBytes);

    await expect(vaultService.resolveSecret('sec-openai', clientPubHex)).rejects.toThrow(
      /OS keychain unavailable/i,
    );
  });

  it('sets and deletes secrets via Keyring passthrough', () => {
    const setSpy = vi.spyOn(keyring, 'set').mockImplementation(() => {});
    const delSpy = vi.spyOn(keyring, 'delete').mockImplementation(() => {});

    vaultService.setSecret('sec-new', 'val', { label: 'New', kind: 'password' });
    expect(setSpy).toHaveBeenCalledWith('sec-new', 'val', { label: 'New', kind: 'password' });

    vaultService.deleteSecret('sec-new');
    expect(delSpy).toHaveBeenCalledWith('sec-new');
  });

  it('wraps generic list error into VAULT_LOCKED', async () => {
    vi.spyOn(keyring, 'list').mockImplementation(() => {
      throw new Error('OS failure');
    });

    await expect(vaultService.listSecrets()).rejects.toThrow(
      /OS keychain is locked or unavailable/,
    );
  });
});
