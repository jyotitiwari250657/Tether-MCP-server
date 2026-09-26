/**
 * OS Keyring Types (PRD FR-510, TRD §6.10, §7.7).
 */

export type SecretKind = 'card' | 'password' | 'token' | 'other';

export interface SecretMetadata {
  secretId: string;
  label: string;
  kind: SecretKind;
  createdAt: number;
  lastUsedAt: number;
}

export interface StoredSecretPayload {
  v: 1;
  value: string;
  metadata: SecretMetadata;
}

export type KeyringErrorCode =
  | 'VAULT_LOCKED'
  | 'LOCKED'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'IO_ERROR';

export class KeyringError extends Error {
  readonly code: KeyringErrorCode;

  constructor(code: KeyringErrorCode, message: string) {
    super(message);
    this.name = 'KeyringError';
    this.code = code;
  }
}
