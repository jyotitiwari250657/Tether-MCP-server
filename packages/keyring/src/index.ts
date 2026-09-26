/**
 * Cross-Platform OS Keyring Wrapper (PRD FR-510, TRD §6.10, §7.7, HR-7).
 * Wraps @napi-rs/keyring to securely store and retrieve secrets with metadata.
 */

import { Entry } from '@napi-rs/keyring';
import {
  KeyringError,
  type SecretKind,
  type SecretMetadata,
  type StoredSecretPayload,
} from './types.js';

export { KeyringError } from './types.js';
export type { SecretKind, SecretMetadata, StoredSecretPayload } from './types.js';

const INDEX_ACCOUNT = '__tether_index__';

export class Keyring {
  readonly service: string;

  constructor(service: string) {
    if (!service || typeof service !== 'string') {
      throw new KeyringError('IO_ERROR', 'Service name must be a non-empty string');
    }
    this.service = service;
  }

  private readIndex(): string[] {
    try {
      const entry = new Entry(this.service, INDEX_ACCOUNT);
      const raw = entry.getPassword();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }

  private writeIndex(ids: string[]): void {
    try {
      const entry = new Entry(this.service, INDEX_ACCOUNT);
      entry.setPassword(JSON.stringify(ids));
    } catch (err: unknown) {
      throw new KeyringError('IO_ERROR', `Failed to write keyring index: ${String(err)}`);
    }
  }

  set(secretId: string, value: string, opts: { label?: string; kind?: SecretKind } = {}): void {
    if (!secretId || typeof secretId !== 'string') {
      throw new KeyringError('IO_ERROR', 'secretId must be a non-empty string');
    }
    if (typeof value !== 'string') {
      throw new KeyringError('IO_ERROR', 'value must be a string');
    }

    const now = Date.now();
    const metadata: SecretMetadata = {
      secretId,
      label: opts.label ?? secretId,
      kind: opts.kind ?? 'other',
      createdAt: now,
      lastUsedAt: now,
    };

    const payload: StoredSecretPayload = {
      v: 1,
      value,
      metadata,
    };

    try {
      const entry = new Entry(this.service, secretId);
      entry.setPassword(JSON.stringify(payload));
      const index = this.readIndex();
      if (!index.includes(secretId)) {
        index.push(secretId);
        this.writeIndex(index);
      }
    } catch (err: unknown) {
      if (err instanceof KeyringError) throw err;
      throw new KeyringError(
        'IO_ERROR',
        `Failed to store secret "${secretId}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  get(secretId: string): string | null {
    if (!secretId) return null;
    try {
      const entry = new Entry(this.service, secretId);
      const raw = entry.getPassword();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredSecretPayload;

      // Update lastUsedAt timestamp on successful read
      parsed.metadata.lastUsedAt = Date.now();
      try {
        entry.setPassword(JSON.stringify(parsed));
      } catch {
        // Non-critical timestamp update failure
      }

      return parsed.value;
    } catch {
      return null;
    }
  }

  delete(secretId: string): void {
    if (!secretId) return;
    try {
      const entry = new Entry(this.service, secretId);
      entry.deletePassword();
      const index = this.readIndex().filter((id) => id !== secretId);
      this.writeIndex(index);
    } catch (err: unknown) {
      throw new KeyringError(
        'IO_ERROR',
        `Failed to delete secret "${secretId}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  list(): SecretMetadata[] {
    const ids = this.readIndex();
    const result: SecretMetadata[] = [];

    for (const id of ids) {
      try {
        const entry = new Entry(this.service, id);
        const raw = entry.getPassword();
        if (raw) {
          const parsed = JSON.parse(raw) as StoredSecretPayload;
          if (parsed.metadata) {
            result.push(parsed.metadata);
          }
        }
      } catch {
        // Skip unparseable or locked entries
      }
    }

    return result;
  }
}
