// TRD §8.5 (LOCKED MODULE): End-to-end encryption envelope (X25519 ECDH + HKDF + AES-256-GCM)
// The relay forwards this envelope without having access to the plaintext.

export interface EncryptedEnvelope {
  ciphertext: string; // Base64 encoded AES-256-GCM ciphertext + tag
  nonce: string; // Base64 encoded 12-byte IV
  ephemPubKey: string; // Base64 encoded X25519 public key of sender
}

const ECDH_ALGO = { name: 'X25519' };
const HKDF_INFO = new TextEncoder().encode('tether-relay-e2e-v1');

export async function generateX25519KeyPair(): Promise<CryptoKeyPair> {
  const subtle = globalThis.crypto.subtle;
  try {
    return (await subtle.generateKey(ECDH_ALGO, true, [
      'deriveBits',
      'deriveKey',
    ])) as CryptoKeyPair;
  } catch {
    return (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
      'deriveKey',
    ])) as CryptoKeyPair;
  }
}

export async function exportPublicKeyRaw(key: CryptoKey): Promise<Uint8Array> {
  const buf = await globalThis.crypto.subtle.exportKey('raw', key);
  return new Uint8Array(buf);
}

export async function exportPublicKeyBase64(key: CryptoKey): Promise<string> {
  const raw = await exportPublicKeyRaw(key);
  return Buffer.from(raw).toString('base64');
}

export async function importPublicKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  try {
    return await subtle.importKey('raw', rawBytes as BufferSource, ECDH_ALGO, false, []);
  } catch {
    return await subtle.importKey(
      'raw',
      rawBytes as BufferSource,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
  }
}

export async function deriveSharedKey(
  localPriv: CryptoKey,
  remotePub: CryptoKey,
): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const isX25519 = localPriv.algorithm.name === 'X25519';

  const sharedBits = await subtle.deriveBits(
    {
      name: isX25519 ? 'X25519' : 'ECDH',
      public: remotePub,
    } as unknown as AlgorithmIdentifier,
    localPriv,
    256,
  );

  const hkdfKey = await subtle.importKey('raw', sharedBits, { name: 'HKDF' }, false, ['deriveKey']);
  const salt = new Uint8Array(32);

  return (await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )) as CryptoKey;
}

export const generateKeyPair = generateX25519KeyPair;

export async function sealEnvelope(
  senderKey: CryptoKeyPair | CryptoKey,
  recipientPubBytes: Uint8Array,
  plaintext: string,
): Promise<EncryptedEnvelope> {
  const subtle = globalThis.crypto.subtle;
  const recipientPub = await importPublicKey(recipientPubBytes);

  let senderPriv: CryptoKey;
  let senderPubBytes: Uint8Array;

  if ('privateKey' in senderKey && 'publicKey' in senderKey) {
    senderPriv = senderKey.privateKey;
    senderPubBytes = await exportPublicKeyRaw(senderKey.publicKey);
  } else {
    // Use ephemeral keypair for forward secrecy
    const ephem = await generateX25519KeyPair();
    senderPriv = ephem.privateKey;
    senderPubBytes = await exportPublicKeyRaw(ephem.publicKey);
  }

  const key = await deriveSharedKey(senderPriv, recipientPub);
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, encoded);

  return {
    ciphertext: Buffer.from(cipherBuf).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
    ephemPubKey: Buffer.from(senderPubBytes).toString('base64'),
  };
}

export async function openEnvelope(
  recipientPriv: CryptoKey,
  envelope: EncryptedEnvelope,
): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const senderPubBytes = Buffer.from(envelope.ephemPubKey, 'base64');
  const senderPub = await importPublicKey(senderPubBytes);
  const key = await deriveSharedKey(recipientPriv, senderPub);

  const nonce = Buffer.from(envelope.nonce, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  const plainBuf = await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext);

  return new TextDecoder().decode(plainBuf);
}
