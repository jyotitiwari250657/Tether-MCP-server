// TRD §8.6, PRD FR-602: User Consents Repository
import { getDb, getMemoryTable } from './db.js';

export interface ConsentRecord {
  id: string;
  user_id: string;
  client_id: string;
  scopes: string;
  device_id: string;
  t: number;
  ip_hash?: string | undefined;
}

export async function recordConsent(consent: ConsentRecord): Promise<void> {
  const mem = getMemoryTable('consents');
  mem.set(consent.id, { ...consent });

  const db = getDb();
  try {
    await db(
      'INSERT INTO consents (id, user_id, client_id, scopes, device_id, t, ip_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        consent.id,
        consent.user_id,
        consent.client_id,
        consent.scopes,
        consent.device_id,
        consent.t,
        consent.ip_hash ?? null,
      ],
    );
  } catch {
    // fallback
  }
}

export async function hasConsent(
  userId: string,
  clientId: string,
  deviceId: string,
  requiredScopes: string[],
): Promise<boolean> {
  const mem = getMemoryTable('consents');
  for (const c of mem.values()) {
    if (c.user_id === userId && c.client_id === clientId && c.device_id === deviceId) {
      const granted = ((c.scopes as string) || '').split(' ');
      if (requiredScopes.every((s) => granted.includes(s))) {
        return true;
      }
    }
  }

  const db = getDb();
  try {
    const rows = (await db(
      'SELECT scopes FROM consents WHERE user_id = $1 AND client_id = $2 AND device_id = $3',
      [userId, clientId, deviceId],
    )) as { scopes: string }[];
    for (const r of rows) {
      const granted = r.scopes.split(' ');
      if (requiredScopes.every((s) => granted.includes(s))) {
        return true;
      }
    }
  } catch {
    // fallback
  }
  return false;
}
