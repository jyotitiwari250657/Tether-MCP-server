// @vitest-environment node
/**
 * Keyring Unit Tests (PRD FR-510, TRD §6.10, §7.7).
 * Verifies set, get, delete, list, metadata retention, and error handling.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Keyring, KeyringError } from '../src/index.js';

// In-memory mock for @napi-rs/keyring
const mockStore = new Map<string, string>();

vi.mock('@napi-rs/keyring', () => {
  return {
    Entry: class MockEntry {
      service: string;
      account: string;

      constructor(service: string, account: string) {
        this.service = service;
        this.account = account;
      }

      setPassword(password: string): void {
        mockStore.set(`${this.service}:${this.account}`, password);
      }

      getPassword(): string | null {
        return mockStore.get(`${this.service}:${this.account}`) ?? null;
      }

      deletePassword(): boolean {
        mockStore.delete(`${this.service}:${this.account}`);
        return true;
      }
    },
  };
});

describe('Keyring (PRD FR-510, TRD §6.10)', () => {
  let keyring: Keyring;

  beforeEach(() => {
    mockStore.clear();
    keyring = new Keyring('tether-test-service');
  });

  test('FR-510: constructor rejects empty service name', () => {
    expect(() => new Keyring('')).toThrow(KeyringError);
  });

  test('FR-510: set and get round-trip stores and retrieves value', () => {
    keyring.set('github-pat', 'ghp_secretToken123', { label: 'GitHub PAT', kind: 'token' });
    const val = keyring.get('github-pat');
    expect(val).toBe('ghp_secretToken123');
  });

  test('FR-510: get returns null for unknown secretId', () => {
    const val = keyring.get('non-existent-secret');
    expect(val).toBeNull();
  });

  test('FR-510: delete removes the secret from store and index', () => {
    keyring.set('temp-pwd', 'hunter2', { label: 'Temp', kind: 'password' });
    expect(keyring.get('temp-pwd')).toBe('hunter2');

    keyring.delete('temp-pwd');
    expect(keyring.get('temp-pwd')).toBeNull();
    expect(keyring.list().some((m) => m.secretId === 'temp-pwd')).toBe(false);
  });

  test('FR-510: list returns metadata without secret values', () => {
    keyring.set('card-1', '4111111111111111', { label: 'Visa Debit', kind: 'card' });
    keyring.set('token-1', 'sk-testKey', { label: 'API Key', kind: 'token' });

    const list = keyring.list();
    expect(list.length).toBe(2);

    const cardMeta = list.find((m) => m.secretId === 'card-1');
    expect(cardMeta).toBeDefined();
    expect(cardMeta?.label).toBe('Visa Debit');
    expect(cardMeta?.kind).toBe('card');
    expect(cardMeta?.createdAt).toBeGreaterThan(0);
    expect((cardMeta as unknown as Record<string, unknown>).value).toBeUndefined();
  });

  test('FR-510: metadata timestamps and label are preserved across updates', () => {
    keyring.set('m-1', 'secret', { label: 'My Secret', kind: 'other' });
    const list1 = keyring.list();
    const created = list1[0]?.createdAt;

    keyring.get('m-1'); // trigger lastUsedAt update
    const list2 = keyring.list();
    expect(list2[0]?.createdAt).toBe(created);
    expect(list2[0]?.lastUsedAt).toBeGreaterThanOrEqual(created ?? 0);
  });

  test('FR-510: invalid input throws KeyringError with code', () => {
    expect(() => keyring.set('', 'val')).toThrow(KeyringError);
    expect(() => keyring.set('id', 123 as unknown as string)).toThrow(KeyringError);
  });

  test('FR-510: get and delete ignore empty or invalid secret IDs', () => {
    expect(keyring.get('')).toBeNull();
    expect(() => keyring.delete('')).not.toThrow();
  });

  test('FR-510: readIndex and list handle corrupt stored JSON gracefully', () => {
    mockStore.set('tether-test-service:__tether_index__', '{invalid-json');
    expect(keyring.list()).toEqual([]);

    mockStore.set('tether-test-service:__tether_index__', JSON.stringify(['corrupt-id']));
    mockStore.set('tether-test-service:corrupt-id', '{corrupt-json');
    expect(keyring.list()).toEqual([]);
  });
});
