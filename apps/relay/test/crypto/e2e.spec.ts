import { describe, expect, it } from 'vitest';
import {
  exportPublicKeyRaw,
  generateKeyPair,
  openEnvelope,
  sealEnvelope,
} from '../../src/crypto/e2e.js';

// TRD §8.5: E2E envelope unit tests
describe('TRD §8.5 E2E envelope (X25519 + AES-256-GCM)', () => {
  it('seals and opens an envelope successfully with matching keypairs', async () => {
    const sender = await generateKeyPair();
    const recipient = await generateKeyPair();

    const payload = {
      action: 'click',
      ref: 'btn-submit',
      timestamp: 1726830000000,
    };

    const recipientPubBytes = await exportPublicKeyRaw(recipient.publicKey);
    const envelope = await sealEnvelope(sender, recipientPubBytes, JSON.stringify(payload));

    expect(typeof envelope.ephemPubKey).toBe('string');
    expect(typeof envelope.nonce).toBe('string');
    expect(typeof envelope.ciphertext).toBe('string');

    const decryptedStr = await openEnvelope(recipient.privateKey, envelope);
    const decrypted = JSON.parse(decryptedStr);

    expect(decrypted).toEqual(payload);
  });

  it('rejects envelope if ciphertext has been tampered with', async () => {
    const sender = await generateKeyPair();
    const recipient = await generateKeyPair();

    const recipientPubBytes = await exportPublicKeyRaw(recipient.publicKey);
    const envelope = await sealEnvelope(sender, recipientPubBytes, 'secret data');

    // Tamper ciphertext
    const tampered = {
      ...envelope,
      ciphertext: `${envelope.ciphertext.slice(0, -4)}AAAA`,
    };

    await expect(openEnvelope(recipient.privateKey, tampered)).rejects.toThrow();
  });

  it('rejects envelope when opened with the wrong private key', async () => {
    const sender = await generateKeyPair();
    const recipient = await generateKeyPair();
    const wrongRecipient = await generateKeyPair();

    const recipientPubBytes = await exportPublicKeyRaw(recipient.publicKey);
    const envelope = await sealEnvelope(sender, recipientPubBytes, 'hello');

    await expect(openEnvelope(wrongRecipient.privateKey, envelope)).rejects.toThrow();
  });

  it('supports string, array, and object payloads', async () => {
    const sender = await generateKeyPair();
    const recipient = await generateKeyPair();
    const recipientPubBytes = await exportPublicKeyRaw(recipient.publicKey);

    const stringPayload = 'plain string payload';
    const envStr = await sealEnvelope(sender, recipientPubBytes, stringPayload);
    expect(await openEnvelope(recipient.privateKey, envStr)).toBe(stringPayload);

    const arrayPayload = [1, 2, 'three', { four: true }];
    const envArr = await sealEnvelope(sender, recipientPubBytes, JSON.stringify(arrayPayload));
    expect(JSON.parse(await openEnvelope(recipient.privateKey, envArr))).toEqual(arrayPayload);
  });
});
