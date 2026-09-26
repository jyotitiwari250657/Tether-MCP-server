/**
 * Daemon Update Verifier (TRD §7, HR-1, HR-14).
 * Validates SHA256 hash and Ed25519 signature of incoming updates.
 */

import * as crypto from 'node:crypto';

export function verifySha256(data: Buffer, expectedHex: string): boolean {
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash.toLowerCase() === expectedHex.toLowerCase();
}

export function verifySignature(data: Buffer, signatureHex: string, publicKeyPem: string): boolean {
  try {
    const signature = Buffer.from(signatureHex, 'hex');
    const verifier = crypto.createVerify('SHA256');
    verifier.update(data);
    return verifier.verify(publicKeyPem, signature);
  } catch {
    return false;
  }
}
