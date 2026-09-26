// TRD §8.6: Users Repository
import { getDb, getMemoryTable } from './db.js';

export interface UserRecord {
  id: string;
  email?: string | undefined;
  created_at: number;
  retention_days: number;
  deleted_at?: number | undefined;
}

export async function createUser(user: UserRecord): Promise<void> {
  const mem = getMemoryTable('users');
  mem.set(user.id, { ...user });

  const db = getDb();
  try {
    await db(
      'INSERT INTO users (id, email, created_at, retention_days, deleted_at) VALUES ($1, $2, $3, $4, $5)',
      [user.id, user.email ?? null, user.created_at, user.retention_days, user.deleted_at ?? null],
    );
  } catch {
    // Memory store populated
  }
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const mem = getMemoryTable('users');
  const cached = mem.get(id);
  if (cached) return cached as unknown as UserRecord;

  const db = getDb();
  try {
    const rows = (await db('SELECT * FROM users WHERE id = $1', [id])) as UserRecord[];
    if (rows[0]) {
      mem.set(id, { ...rows[0] });
      return rows[0];
    }
  } catch {
    // fallback
  }
  return null;
}

export async function deleteUser(id: string): Promise<void> {
  const mem = getMemoryTable('users');
  mem.delete(id);

  const db = getDb();
  try {
    await db('UPDATE users SET deleted_at = $1 WHERE id = $2', [Date.now(), id]);
  } catch {
    // fallback
  }
}
