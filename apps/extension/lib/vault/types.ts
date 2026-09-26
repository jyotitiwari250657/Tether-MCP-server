/**
 * Vault Client Types (PRD FR-510, TRD §6.10, HR-7).
 */

export type SecretKind = 'password' | 'token' | 'api_key' | 'totp' | 'card' | 'other';

export interface SecretMetadata {
  secretId: string;
  label: string;
  kind: SecretKind;
  createdAt: number;
  lastUsedAt?: number;
}

export interface EncryptedSecretPayload {
  v: 1;
  ciphertextHex: string;
  nonceHex: string;
  daemonPubHex: string;
}

export interface ResolveSecretReq {
  secretId: string;
  clientPubHex: string;
}
