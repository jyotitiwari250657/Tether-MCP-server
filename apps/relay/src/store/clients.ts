// TRD §8.6, PRD FR-602: OAuth Clients Repository (DCR & CIMD)
import { getDb, getMemoryTable } from './db.js';

export interface ClientRecord {
  id: string;
  user_id: string;
  device_id: string;
  label: string;
  kind: string;
  scopes: string;
  created_at: number;
  revoked_at?: number | undefined;
}

export async function createClient(client: ClientRecord): Promise<void> {
  const mem = getMemoryTable('clients');
  mem.set(client.id, { ...client });

  const db = getDb();
  try {
    await db(
      'INSERT INTO clients (id, user_id, device_id, label, kind, scopes, created_at, revoked_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        client.id,
        client.user_id,
        client.device_id,
        client.label,
        client.kind,
        client.scopes,
        client.created_at,
        client.revoked_at ?? null,
      ],
    );
  } catch {
    // fallback
  }
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  const mem = getMemoryTable('clients');
  const cached = mem.get(id);
  if (cached) return cached as unknown as ClientRecord;

  const db = getDb();
  try {
    const rows = (await db('SELECT * FROM clients WHERE id = $1', [id])) as ClientRecord[];
    if (rows[0]) {
      mem.set(id, { ...rows[0] });
      return rows[0];
    }
  } catch {
    // fallback
  }
  return null;
}

export async function revokeClient(id: string): Promise<void> {
  const mem = getMemoryTable('clients');
  const c = mem.get(id);
  if (c) c.revoked_at = Date.now();

  const db = getDb();
  try {
    await db('UPDATE clients SET revoked_at = $1 WHERE id = $2', [Date.now(), id]);
  } catch {
    // fallback
  }
}
