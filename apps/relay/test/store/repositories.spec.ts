import { describe, expect, it } from 'vitest';
import { listAuditMeta, recordAuditMeta } from '../../src/store/audit-meta.js';
import { createClient, getClient } from '../../src/store/clients.js';
import { hasConsent, recordConsent } from '../../src/store/consents.js';
import { createDevice, getDevice, listDevices } from '../../src/store/devices.js';
import { listEgress, recordEgress } from '../../src/store/egress-log.js';
import { createSession, getSession } from '../../src/store/sessions.js';
import {
  getTokenByHash,
  revokeTokenByHash,
  revokeTokenFamily,
  rotateToken,
  storeToken,
} from '../../src/store/tokens.js';
import { createUser, getUser } from '../../src/store/users.js';

describe('Relay Store Repositories (CRUD & In-Memory Fallback)', () => {
  it('handles user creation and retrieval', async () => {
    await createUser({
      id: 'u1',
      email: 'user@test.dev',
      created_at: Date.now(),
      retention_days: 30,
    });
    const user = await getUser('u1');
    expect(user).not.toBeNull();
    expect(user?.email).toBe('user@test.dev');
  });

  it('handles device registration, listing, and lookup', async () => {
    await createDevice({
      id: 'd1',
      user_id: 'u1',
      label: 'MacBook Pro',
      profile: 'browser-act',
      pub_key: 'pk_x25519_1',
    });

    const dev = await getDevice('d1');
    expect(dev?.label).toBe('MacBook Pro');

    const devices = await listDevices('u1');
    expect(devices.some((d) => d.id === 'd1')).toBe(true);
  });

  it('handles client registration and retrieval', async () => {
    await createClient({
      id: 'c1',
      user_id: 'u1',
      device_id: 'd1',
      label: 'Claude',
      kind: 'desktop',
      scopes: 'tether:act',
      created_at: Date.now(),
    });

    const client = await getClient('c1');
    expect(client?.label).toBe('Claude');
  });

  it('handles token lifecycle: store, lookup, rotate, and revoke', async () => {
    const hash1 = 'hash_refresh_1';
    await storeToken({
      id: 't1',
      client_id: 'c1',
      refresh_hash: hash1,
      family: 'fam_1',
      scopes: 'tether:act',
      expires_at: Date.now() + 10000,
    });

    const tok = await getTokenByHash(hash1);
    expect(tok?.client_id).toBe('c1');

    const hash2 = 'hash_refresh_2';
    await rotateToken(hash1, {
      id: 't2',
      client_id: 'c1',
      refresh_hash: hash2,
      family: 'fam_1',
      scopes: 'tether:act',
      expires_at: Date.now() + 10000,
      rotated_from: 't1',
    });

    const tok2 = await getTokenByHash(hash2);
    expect(tok2?.id).toBe('t2');

    // Revoke family
    await revokeTokenFamily('fam_1');
    const tokRevoked = await getTokenByHash(hash2);
    expect(tokRevoked?.revoked_at).toBeDefined();

    // Revoke single
    await revokeTokenByHash(hash1);
  });

  it('handles session and audit metadata tracking', async () => {
    await createSession({
      id: 's1',
      client_id: 'c1',
      device_id: 'd1',
      started_at: Date.now(),
      steps: 0,
      tokens_used: 0,
    });

    const session = await getSession('s1');
    expect(session?.device_id).toBe('d1');

    await recordAuditMeta({
      session_id: 's1',
      seq: 1,
      tool: 'click',
      tier: 1,
      verdict: 'allow',
      hash: 'sha256_hash_1',
      prev_hash: 'genesis',
      t: Date.now(),
    });

    const auditList = await listAuditMeta('s1');
    expect(auditList).toHaveLength(1);
    expect(auditList[0]?.tool).toBe('click');
  });

  it('handles consents and egress logging', async () => {
    await recordConsent({
      id: 'cons_1',
      user_id: 'u1',
      client_id: 'c1',
      scopes: 'tether:act',
      device_id: 'd1',
      t: Date.now(),
    });

    const granted = await hasConsent('u1', 'c1', 'd1', ['tether:act']);
    expect(granted).toBe(true);

    await recordEgress({
      session_id: 's1',
      origin_registrable: 'example.com',
      method: 'POST',
      bytes: 128,
      decision: 'allow',
      t: Date.now(),
    });

    const logs = await listEgress('s1');
    expect(logs).toHaveLength(1);
    expect(logs[0]?.origin_registrable).toBe('example.com');
  });
});
