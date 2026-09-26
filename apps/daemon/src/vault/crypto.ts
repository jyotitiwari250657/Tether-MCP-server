/**
 * Daemon Vault Cryptography Utilities (PRD FR-510, TRD §6.10, HR-7).
 * Implements X25519 ECDH key agreement, HKDF-SHA256 derivation, and AES-256-GCM.
 */

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function zeroBytes(bytes: Uint8Array): void {
  bytes.fill(0);
}

const ECDH_ALGO = { name: 'X25519' };

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

export async function deriveSessionKey(
  localPriv: CryptoKey,
  remotePubBytes: Uint8Array,
): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const isX25519 = localPriv.algorithm.name === 'X25519';

  const remotePubKey = await subtle.importKey(
    'raw',
    remotePubBytes as BufferSource,
    isX25519 ? ECDH_ALGO : { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedBits = await subtle.deriveBits(
    {
      name: isX25519 ? 'X25519' : 'ECDH',
      public: remotePubKey,
    } as unknown as AlgorithmIdentifier,
    localPriv,
    256,
  );

  const hkdfKey = await subtle.importKey('raw', sharedBits, { name: 'HKDF' }, false, ['deriveKey']);
  const info = new TextEncoder().encode('tether-vault-v1');
  const salt = new Uint8Array(32);

  return (await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )) as CryptoKey;
}

export async function encrypt(
  key: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const subtle = globalThis.crypto.subtle;
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, encoded);

  return {
    ciphertext: new Uint8Array(cipherBuf),
    nonce,
  };
}

export async function decrypt(
  key: CryptoKey,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const plainBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource },
    key,
    ciphertext as BufferSource,
  );

  return new TextDecoder().decode(plainBuf);
}
