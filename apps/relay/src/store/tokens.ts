// TRD §8.6, PRD FR-602, FR-604: OAuth Tokens Repository (Hash-only, refresh rotation)
import { getDb, getMemoryTable } from './db.js';

export interface TokenRecord {
  id: string;
  client_id: string;
  refresh_hash: string;
  family: string;
  scopes: string;
  expires_at: number;
  rotated_from?: string | undefined;
  revoked_at?: number | undefined;
}

export async function storeToken(token: TokenRecord): Promise<void> {
  const mem = getMemoryTable('tokens');
  mem.set(token.refresh_hash, { ...token });

  const db = getDb();
  try {
    await db(
      'INSERT INTO tokens (id, client_id, refresh_hash, family, scopes, expires_at, rotated_from, revoked_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        token.id,
        token.client_id,
        token.refresh_hash,
        token.family,
        token.scopes,
        token.expires_at,
        token.rotated_from ?? null,
        token.revoked_at ?? null,
      ],
    );
  } catch {
    // fallback
  }
}

export async function getTokenByHash(hash: string): Promise<TokenRecord | null> {
  const mem = getMemoryTable('tokens');
  const cached = mem.get(hash);
  if (cached) return cached as unknown as TokenRecord;

  const db = getDb();
  try {
    const rows = (await db('SELECT * FROM tokens WHERE refresh_hash = $1', [
      hash,
    ])) as TokenRecord[];
    if (rows[0]) {
      mem.set(hash, { ...rows[0] });
      return rows[0];
    }
  } catch {
    // fallback
  }
  return null;
}

export async function rotateToken(oldHash: string, newToken: TokenRecord): Promise<void> {
  const mem = getMemoryTable('tokens');
  const old = mem.get(oldHash);
  if (old) old.revoked_at = Date.now();
  mem.set(newToken.refresh_hash, { ...newToken });

  const db = getDb();
  try {
    await db('UPDATE tokens SET revoked_at = $1 WHERE refresh_hash = $2', [Date.now(), oldHash]);
    await db(
      'INSERT INTO tokens (id, client_id, refresh_hash, family, scopes, expires_at, rotated_from, revoked_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        newToken.id,
        newToken.client_id,
        newToken.refresh_hash,
        newToken.family,
        newToken.scopes,
        newToken.expires_at,
        newToken.rotated_from ?? null,
        newToken.revoked_at ?? null,
      ],
    );
  } catch {
    // fallback
  }
}

export async function revokeTokenByHash(hash: string): Promise<void> {
  const mem = getMemoryTable('tokens');
  const t = mem.get(hash);
  if (t) t.revoked_at = Date.now();

  const db = getDb();
  try {
    await db('UPDATE tokens SET revoked_at = $1 WHERE refresh_hash = $2', [Date.now(), hash]);
  } catch {
    // fallback
  }
}

export async function revokeTokenFamily(family: string): Promise<void> {
  const mem = getMemoryTable('tokens');
  for (const t of mem.values()) {
    if (t.family === family) {
      t.revoked_at = Date.now();
    }
  }

  const db = getDb();
  try {
    await db('UPDATE tokens SET revoked_at = $1 WHERE family = $2', [Date.now(), family]);
  } catch {
    // fallback
  }
}
